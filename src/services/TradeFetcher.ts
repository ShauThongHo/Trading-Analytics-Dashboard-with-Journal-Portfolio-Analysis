import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { Buffer } from "buffer";

/**
 * TradeFetcher - FINAL VERSION
 * 
 * Combines:
 * 1. Robust Fetching (Anti-429 with batching and retry logic)
 * 2. Accurate Parsing (FEE detection + correct field mapping)
 * 
 * Verified against Deriverse UI screenshots.
 */

// Define the Trade Record Interface
export interface TradeRecord {
    signature: string;
    timestamp: number;
    market: string;
    action: "TRADE" | "FEE" | "LIQUIDATE" | "UNKNOWN";
    side: "LONG" | "SHORT" | "UNKNOWN";
    size: string;  // Store as string to preserve precision
    price: string;
    fee: number;   // Store as number for easy calculation
    originalLog: string;
}

export class TradeFetcher {
    private connection: Connection;
    private walletAddress: PublicKey;

    constructor(rpcUrl: string, walletAddress: string) {
        this.connection = new Connection(rpcUrl, "confirmed");
        this.walletAddress = new PublicKey(walletAddress);
    }

    // Helper: Sleep to avoid 429
    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 1. The Core Parsing Logic (Verified against Screenshots)
    private parseLog(log: string, blockTime: number): Partial<TradeRecord> | null {
        try {
            const buffer = Buffer.from(log, 'base64');
            if (buffer.length < 16) return null;

            const discriminator = buffer.readUInt8(0);

            // CASE A: FEE / TRANSFER (Discriminator 0x17)
            // Logic: Fee amount is in bytes 8-16
            if (discriminator === 0x17) {
                const rawFee = buffer.readBigUInt64LE(8);
                const fee = Number(rawFee) / 1_000_000; // 6 decimals (USDC)

                return {
                    action: "FEE",
                    side: "UNKNOWN",
                    size: "0",
                    price: "0",
                    fee: fee,
                    timestamp: blockTime // Fees don't have internal timestamp, use block time
                };
            }

            // CASE B: TRADE (Buffer Length >= 40)
            // Logic: Standard trade event
            if (buffer.length >= 40) {
                // 1. Timestamp (Always last 8 bytes for 48-byte events, last 4 bytes for 40-byte events)
                let timestamp = blockTime;
                if (buffer.length >= 48) {
                    const tsRaw = buffer.readBigInt64LE(buffer.length - 8);
                    const ts = Number(tsRaw);
                    // Sanity check: is year between 2020 and 2030?
                    if (ts > 1577836800 && ts < 1893456000) timestamp = ts;
                } else if (buffer.length >= 40) {
                    const tsRaw = buffer.readUInt32LE(buffer.length - 4);
                    if (tsRaw > 1577836800 && tsRaw < 1893456000) timestamp = tsRaw;
                }

                // 2. Size (Bytes 16-24)
                const rawSize = buffer.readBigUInt64LE(16);
                const size = Number(rawSize) / 1_000_000_000; // 9 decimals (SOL)

                // 3. Quote Amount (Bytes 24-32) - This is TOTAL USDC value, not unit price
                const rawQuoteAmount = buffer.readBigUInt64LE(24);
                const quoteAmount = Number(rawQuoteAmount) / 1_000_000;   // 6 decimals (USDC)

                // 4. Calculate Unit Price: price = quoteAmount / size
                let finalPrice = "0";
                if (size > 0) {
                    finalPrice = (quoteAmount / size).toFixed(2);
                }

                // 5. Side
                let side: "LONG" | "SHORT" | "UNKNOWN" = "UNKNOWN";
                if (discriminator === 0x12 || discriminator === 0x0A) side = "LONG";
                if (discriminator === 0x13 || discriminator === 0x0B) side = "SHORT";

                return {
                    action: "TRADE",
                    side,
                    size: size.toFixed(9),
                    price: finalPrice, // Calculated unit price
                    fee: 0,
                    timestamp
                };
            }

            return null;
        } catch (e) {
            return null;
        }
    }

    // 2. The Fetch Loop (With 429 Protection)
    public async fetchAllTrades(): Promise<TradeRecord[]> {
        console.log(`⏳ Fetching trades for ${this.walletAddress.toString()}...`);
        
        const allTrades: TradeRecord[] = [];
        let lastSignature: string | undefined = undefined;
        let hasMore = true;
        const BATCH_SIZE = 3; // Strict limit for Free Tier (3 transactions at a time)
        const DELAY_MS = 2000; // 2 seconds between batches
        let totalProcessed = 0;

        while (hasMore) {
            // A. Fetch Signatures
            try {
                const signatures = await this.connection.getSignaturesForAddress(this.walletAddress, {
                    before: lastSignature,
                    limit: 20
                });

                if (signatures.length === 0) {
                    hasMore = false;
                    break;
                }

                console.log(`📦 Found ${signatures.length} signatures. Processing in batches of ${BATCH_SIZE}...`);

                // B. Process in Small Batches (Anti-429 Strategy)
                for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
                    const batch = signatures.slice(i, i + BATCH_SIZE);
                    const batchSigs = batch.map(s => s.signature);

                    let retryCount = 0;
                    const MAX_RETRIES = 3;
                    let batchSuccess = false;

                    while (!batchSuccess && retryCount < MAX_RETRIES) {
                        try {
                            // C. Fetch Transactions (Individual calls for Free Tier)
                            const txPromises = batchSigs.map(sig => 
                                this.connection.getParsedTransaction(sig, {
                                    maxSupportedTransactionVersion: 0
                                })
                            );

                            const transactions = await Promise.all(txPromises);

                            // D. Parse Each Transaction
                            for (let j = 0; j < transactions.length; j++) {
                                const tx = transactions[j];
                                const sigInfo = batch[j];

                                if (!tx || !tx.meta || !tx.meta.logMessages) continue;

                                // Look for "Program data: <base64>" logs
                                for (const logLine of tx.meta.logMessages) {
                                    const match = logLine.match(/Program data: (.+)/);
                                    if (!match) continue;

                                    const base64Log = match[1];
                                    const parsed = this.parseLog(base64Log, tx.blockTime || sigInfo.blockTime || 0);

                                    if (parsed && (parsed.action === "TRADE" || parsed.action === "FEE")) {
                                        const trade: TradeRecord = {
                                            signature: sigInfo.signature,
                                            timestamp: parsed.timestamp!,
                                            market: "SOL-PERP",
                                            action: parsed.action,
                                            side: parsed.side!,
                                            size: parsed.size!,
                                            price: parsed.price!,
                                            fee: parsed.fee!,
                                            originalLog: base64Log
                                        };

                                        allTrades.push(trade);
                                    }
                                }
                            }

                            batchSuccess = true;
                            totalProcessed += batchSigs.length;
                            console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} complete. Total processed: ${totalProcessed}`);

                        } catch (err: any) {
                            // Handle 429 Rate Limit Error
                            if (err.message && err.message.includes("429")) {
                                retryCount++;
                                const waitTime = 10000 * retryCount; // 10s, 20s, 30s
                                console.warn(`⚠️  Rate limit hit (429). Retry ${retryCount}/${MAX_RETRIES} after ${waitTime/1000}s...`);
                                await this.sleep(waitTime);
                            } else {
                                console.error(`❌ Batch error:`, err.message);
                                batchSuccess = true; // Skip this batch
                            }
                        }
                    }

                    // E. Delay Between Batches (Critical for Free Tier)
                    if (i + BATCH_SIZE < signatures.length) {
                        await this.sleep(DELAY_MS);
                    }
                }

                // Update pagination
                lastSignature = signatures[signatures.length - 1].signature;
                
                // Delay between signature pages
                await this.sleep(DELAY_MS);

            } catch (err: any) {
                console.error(`❌ Error fetching signatures:`, err.message);
                hasMore = false;
            }
        }

        console.log(`\n✅ Fetch complete! Total trades: ${allTrades.length}`);
        return allTrades;
    }

    // 3. Save to File
    public async saveToFile(trades: TradeRecord[], outputPath: string) {
        const fs = await import('fs');
        const path = await import('path');
        
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Custom JSON serialization (in case we add BigInt support later)
        const json = JSON.stringify(trades, (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        }, 2);

        fs.writeFileSync(outputPath, json, 'utf-8');
        console.log(`💾 Saved ${trades.length} trades to ${outputPath}`);
    }
}
