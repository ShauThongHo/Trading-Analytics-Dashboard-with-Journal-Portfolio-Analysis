import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { Buffer } from "buffer";

/**
 * TradeFetcher - FINAL VERSION with Strict Event Formatting
 * 
 * Outputs three distinct event types:
 * 1. TradeEvent - Taker/Maker trades with order details
 * 2. FeeEvent - Fee payments
 * 3. OrderMgmtEvent - Order creation/cancellation
 * 
 * Verified against Deriverse UI format requirements.
 */

// ============================================================================
// EVENT TYPE DEFINITIONS
// ============================================================================

// Common fields for all events
interface BaseEvent {
    type: "TRADE" | "FEE" | "ORDER";
    instrument: "SOL/USDC";
    signature: string;
    timestamp: number;
    originalLog: string;
}

// 1. Taker/Maker Trade Event
export interface TradeEvent extends BaseEvent {
    type: "TRADE";
    orderId: string;         // Sequence ID from blockchain
    amount: string;          // Position size (SOL)
    price: string;           // Unit price (USDC per SOL)
    orderType: "Market" | "Limit";
    orderSide: "Bid" | "Ask";
    role: "Taker" | "Maker";
    tradeAction: "Buy" | "Sell";
}

// 2. Fee Event
export interface FeeEvent extends BaseEvent {
    type: "FEE";
    orderId: string;         // Usually "N/A" for fees
    amount: string;          // Fee amount in USDC
}

// 3. Order Management Event (New/Cancel)
export interface OrderMgmtEvent extends BaseEvent {
    type: "ORDER";
    subType: "New Ask Order" | "Ask Order Cancel" | "New Bid Order" | "Bid Order Cancel";
    orderId: string;
    amount: string;
    price: string;
    orderSide: "Ask" | "Bid";
}

// Union type for all possible events
export type ParsedEvent = TradeEvent | FeeEvent | OrderMgmtEvent;

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

    // ========================================================================
    // CORE PARSING LOGIC - Returns Strict Event Types
    // ========================================================================
    private parseLog(log: string, blockTime: number, signature: string): ParsedEvent | null {
        try {
            const buffer = Buffer.from(log, 'base64');
            if (buffer.length < 16) return null;

            const discriminator = buffer.readUInt8(0);

            // ====================================================================
            // CASE A: FEE EVENT (Discriminator 0x17)
            // ====================================================================
            if (discriminator === 0x17) {
                const rawFee = buffer.readBigUInt64LE(8);
                const feeAmount = Number(rawFee) / 1_000_000; // 6 decimals (USDC)

                const feeEvent: FeeEvent = {
                    type: "FEE",
                    instrument: "SOL/USDC",
                    orderId: "N/A",
                    amount: feeAmount.toFixed(6),
                    signature: signature,
                    timestamp: blockTime,
                    originalLog: log
                };

                return feeEvent;
            }

            // ====================================================================
            // CASE B: TRADE EVENT (Buffer Length >= 40)
            // ====================================================================
            if (buffer.length >= 40 && (discriminator === 0x12 || discriminator === 0x13 || discriminator === 0x0A || discriminator === 0x0B)) {
                // 1. Timestamp (from buffer or fallback to blockTime)
                let timestamp = blockTime;
                if (buffer.length >= 48) {
                    const tsRaw = buffer.readBigInt64LE(buffer.length - 8);
                    const ts = Number(tsRaw);
                    if (ts > 1577836800 && ts < 1893456000) timestamp = ts;
                } else if (buffer.length >= 40) {
                    const tsRaw = buffer.readUInt32LE(buffer.length - 4);
                    if (tsRaw > 1577836800 && tsRaw < 1893456000) timestamp = tsRaw;
                }

                // 2. Order ID (Bytes 8-16)
                const rawOrderId = buffer.readBigUInt64LE(8);
                const orderId = rawOrderId.toString();

                // 3. Amount/Size (Bytes 16-24)
                const rawSize = buffer.readBigUInt64LE(16);
                const size = Number(rawSize) / 1_000_000_000; // 9 decimals (SOL)

                // 4. Quote Amount (Bytes 24-32) - Total USDC value
                const rawQuoteAmount = buffer.readBigUInt64LE(24);
                const quoteAmount = Number(rawQuoteAmount) / 1_000_000; // 6 decimals (USDC)

                // 5. Calculate Unit Price: price = quoteAmount / size
                let unitPrice = 0;
                if (size > 0) {
                    unitPrice = quoteAmount / size;
                }

                // 6. Sanity Filter: Only accept realistic prices (1 < price < 5000 for SOL)
                if (unitPrice < 1 || unitPrice > 5000) {
                    // Skip unrealistic prices
                    return null;
                }

                // 7. Determine Trade Direction
                let orderSide: "Bid" | "Ask";
                let tradeAction: "Buy" | "Sell";

                if (discriminator === 0x12 || discriminator === 0x0A) {
                    // LONG = Bid = Buy
                    orderSide = "Bid";
                    tradeAction = "Buy";
                } else {
                    // SHORT = Ask = Sell
                    orderSide = "Ask";
                    tradeAction = "Sell";
                }

                const tradeEvent: TradeEvent = {
                    type: "TRADE",
                    instrument: "SOL/USDC",
                    orderId: orderId,
                    amount: size.toFixed(2), // Show 2 decimals for UI
                    price: unitPrice.toFixed(2), // Unit price
                    orderType: "Market", // Default assumption
                    orderSide: orderSide,
                    role: "Taker", // Default assumption
                    tradeAction: tradeAction,
                    signature: signature,
                    timestamp: timestamp,
                    originalLog: log
                };

                return tradeEvent;
            }

            // Unknown event type
            return null;

        } catch (error) {
            console.warn(`⚠️  Parse error: ${error}`);
            return null;
        }
    }

    // ========================================================================
    // FETCH LOOP - Returns Formatted Events
    // ========================================================================
    public async fetchAllTrades(): Promise<ParsedEvent[]> {
        console.log(`⏳ Fetching trades for ${this.walletAddress.toString()}...`);
        
        const allEvents: ParsedEvent[] = [];
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
                                    const parsed = this.parseLog(
                                        base64Log, 
                                        tx.blockTime || sigInfo.blockTime || 0,
                                        sigInfo.signature
                                    );

                                    if (parsed) {
                                        allEvents.push(parsed);
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

        console.log(`\n✅ Fetch complete! Total events: ${allEvents.length}`);
        return allEvents;
    }

    // ========================================================================
    // SAVE TO FILE
    // ========================================================================
    public async saveToFile(events: ParsedEvent[], outputPath: string) {
        const fs = await import('fs');
        const path = await import('path');
        
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Custom JSON serialization (in case we add BigInt support later)
        const json = JSON.stringify(events, (key, value) => {
            if (typeof value === 'bigint') {
                return value.toString();
            }
            return value;
        }, 2);

        fs.writeFileSync(outputPath, json, 'utf-8');
        console.log(`💾 Saved ${events.length} events to ${outputPath}`);
    }
}
