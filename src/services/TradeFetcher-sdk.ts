import { Connection, PublicKey, ParsedTransactionWithMeta } from "@solana/web3.js";
import { Buffer } from "buffer";
import * as fs from "fs";
import { PerpFillOrderReportModel, PerpFeesReportModel } from "@deriverse/kit";

/**
 * TradeFetcher - Trading history parser using @deriverse/kit SDK
 * 
 * Integration Strategy:
 * - Uses SDK models (PerpFillOrderReportModel, PerpFeesReportModel) for parsing
 * - Calculates unit price from crncy/perps (SDK's price field is not unit price)
 * - Maintains strict event type system matching UI requirements
 * 
 * SDK Event Tags:
 * - Tag 19 (0x13): perpFillOrder - Executed trades
 * - Tag 23 (0x17): perpFees - Fee payments
 */

// ============================================================================
// EVENT TYPE DEFINITIONS (Strict UI Format)
// ============================================================================

interface BaseEvent {
    type: "TRADE" | "FEE" | "ORDER";
    instrument: "SOL/USDC";
    signature: string;
    timestamp: number;
    originalLog: string;
}

export interface TradeEvent extends BaseEvent {
    type: "TRADE";
    orderId: string;
    amount: string;          // Position size in SOL
    price: string;           // Unit price (USDC per SOL)
    orderType: "Market" | "Limit";
    orderSide: "Bid" | "Ask";
    role: "Taker" | "Maker";
    tradeAction: "Buy" | "Sell";
}

export interface FeeEvent extends BaseEvent {
    type: "FEE";
    orderId: string;         // "N/A" for fees
    amount: string;          // Fee amount in USDC
}

export interface OrderMgmtEvent extends BaseEvent {
    type: "ORDER";
    subType: "New Ask Order" | "Ask Order Cancel" | "New Bid Order" | "Bid Order Cancel";
    orderId: string;
    amount: string;
    price: string;
    orderSide: "Bid" | "Ask";
}

export type ParsedEvent = TradeEvent | FeeEvent | OrderMgmtEvent;

// ============================================================================
// TRADE FETCHER CLASS
// ============================================================================

export class TradeFetcher {
    private connection: Connection;
    private walletAddress: PublicKey;

    constructor(rpcUrl: string, walletAddress: string) {
        this.connection = new Connection(rpcUrl, "confirmed");
        this.walletAddress = new PublicKey(walletAddress);
    }

    // ========================================================================
    // LOG PARSING - SDK Integration
    // ========================================================================
    
    /**
     * Parses a base64 log using @deriverse/kit SDK models
     * 
     * @param log Base64 encoded log data
     * @param blockTime Transaction timestamp
     * @param signature Transaction signature
     * @returns ParsedEvent or null if parsing fails
     */
    private parseLog(log: string, blockTime: number, signature: string): ParsedEvent | null {
        try {
            const buffer = Buffer.from(log, "base64");
            
            if (buffer.length < 16) {
                return null;
            }

            // Read tag (discriminator) at byte 0
            const tag = buffer.readUInt8(0);

            // ================================================================
            // CASE A: FEE EVENT (Tag 23 = 0x17)
            // ================================================================
            if (tag === 23) { // perpFees
                try {
                    const feeModel = PerpFeesReportModel.fromBuffer(buffer);
                    
                    // SDK provides: tag, refClientId, fees, refPayment
                    // fees is in raw units (divide by 1e6 for USDC)
                    const feeAmount = Number(feeModel.fees) / 1_000_000;

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
                } catch (error) {
                    console.warn(`⚠️  SDK FeeModel parse error: ${error}`);
                    return null;
                }
            }

            // ================================================================
            // CASE B: TRADE EVENT (Tags: 0x12, 0x13, 0x0A, 0x0B)
            // - 0x12 (18): LONG Taker
            // - 0x13 (19): SHORT Taker
            // - 0x0A (10): LONG Maker
            // - 0x0B (11): SHORT Maker
            // ================================================================
            if (tag === 0x12 || tag === 0x13 || tag === 0x0A || tag === 0x0B) { // perpFillOrder
                try {
                    const tradeModel = PerpFillOrderReportModel.fromBuffer(buffer);
                    
                    // SDK Model Fields:
                    // - tag: number (19)
                    // - side: number (0 or 1)
                    // - clientId: number
                    // - orderId: number (BigInt converted to number)
                    // - perps: number (raw amount, divide by 1e9 for SOL)
                    // - crncy: number (raw quote amount, divide by 1e6 for USDC)
                    // - price: number (NOT unit price! Need to calculate)
                    // - rebates: number

                    // 1. Convert amounts
                    const amountSOL = Number(tradeModel.perps) / 1_000_000_000; // 9 decimals
                    const quoteUSDC = Number(tradeModel.crncy) / 1_000_000;     // 6 decimals

                    // 2. Calculate unit price (CRITICAL: SDK price field is wrong)
                    let unitPrice = 0;
                    if (amountSOL > 0) {
                        unitPrice = quoteUSDC / amountSOL;
                    }

                    // 3. Sanity filter (reject unrealistic prices)
                    if (unitPrice < 1 || unitPrice > 5000) {
                        return null;
                    }

                    // 4. Determine trade direction from discriminator (tag field)
                    // Use the same logic as manual decoder:
                    // - Discriminator 0x12 or 0x0A = LONG = Bid = Buy
                    // - Discriminator 0x13 or 0x0B = SHORT = Ask = Sell
                    // NOTE: SDK's side field (byte 1) is different from discriminator
                    // and doesn't reliably map to Buy/Sell direction
                    const discriminator = tradeModel.tag;
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

                    // 5. Determine Order Type from byte 4 (manual read)
                    // SDK FillOrder model doesn't include orderType
                    const orderTypeRaw = buffer.readUInt8(4);
                    let orderType: "Market" | "Limit" = "Limit";
                    
                    if (orderTypeRaw === 1) {
                        orderType = "Market";
                    } else {
                        orderType = "Limit"; // 0, 2, or other values
                    }

                    // 6. Determine Role from discriminator (same logic as manual decoder)
                    // - Discriminator 0x0A or 0x0B = Maker (passive orders)
                    // - Discriminator 0x12 or 0x13 = Taker (aggressive orders)
                    let role: "Taker" | "Maker" = "Taker"; // Default
                    if (discriminator === 0x0A || discriminator === 0x0B) {
                        role = "Maker";
                    }

                    const tradeEvent: TradeEvent = {
                        type: "TRADE",
                        instrument: "SOL/USDC",
                        orderId: tradeModel.orderId.toString(),
                        amount: amountSOL.toFixed(2),
                        price: unitPrice.toFixed(2),
                        orderType: orderType,
                        orderSide: orderSide,
                        role: role,
                        tradeAction: tradeAction,
                        signature: signature,
                        timestamp: blockTime,
                        originalLog: log
                    };

                    return tradeEvent;
                } catch (error) {
                    console.warn(`⚠️  SDK TradeModel parse error: ${error}`);
                    return null;
                }
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
        const BATCH_SIZE = 3; // Free tier limit
        const DELAY_MS = 2000; // 2 seconds between batches
        let totalProcessed = 0;

        while (hasMore) {
            try {
                // A. Fetch Signatures
                const signatures = await this.connection.getSignaturesForAddress(
                    this.walletAddress,
                    {
                        before: lastSignature,
                        limit: 20
                    }
                );

                if (signatures.length === 0) {
                    hasMore = false;
                    break;
                }

                console.log(`📦 Found ${signatures.length} signatures. Processing in batches of ${BATCH_SIZE}...`);

                // B. Process in Small Batches
                for (let i = 0; i < signatures.length; i += BATCH_SIZE) {
                    const batch = signatures.slice(i, i + BATCH_SIZE);
                    const batchSigs = batch.map(s => s.signature);

                    let retryCount = 0;
                    const MAX_RETRIES = 7;
                    let batchSuccess = false;

                    while (retryCount < MAX_RETRIES && !batchSuccess) {
                        try {
                            // Fetch transactions individually (free tier compatible)
                            for (const sig of batchSigs) {
                                const tx = await this.connection.getParsedTransaction(sig, {
                                    maxSupportedTransactionVersion: 0
                                });

                                if (!tx || !tx.meta || !tx.meta.logMessages) {
                                    continue;
                                }

                                const blockTime = tx.blockTime || Math.floor(Date.now() / 1000);

                                // Extract program data logs
                                const logs = tx.meta.logMessages
                                    .filter(log => log.startsWith("Program data: "))
                                    .map(log => log.replace("Program data: ", "").trim());

                                // Parse each log
                                for (const log of logs) {
                                    const event = this.parseLog(log, blockTime, sig);
                                    if (event) {
                                        allEvents.push(event);
                                    }
                                }

                                totalProcessed++;
                            }

                            batchSuccess = true;

                        } catch (error: any) {
                            if (error.message?.includes("429") || error.message?.includes("Too Many Requests")) {
                                retryCount++;
                                const backoffDelay = Math.min(DELAY_MS * Math.pow(2, retryCount), 128000);
                                console.log(`⚠️  Rate limited. Retry ${retryCount}/${MAX_RETRIES} after ${backoffDelay}ms...`);
                                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                            } else {
                                throw error;
                            }
                        }
                    }

                    if (!batchSuccess) {
                        console.error(`❌ Batch failed after ${MAX_RETRIES} retries`);
                    }

                    // Rate limiting: 2 second delay between batches
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                    console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} complete. Total processed: ${totalProcessed}`);
                }

                // Move to next page
                lastSignature = signatures[signatures.length - 1].signature;

            } catch (error) {
                console.error(`❌ Error in fetch loop: ${error}`);
                hasMore = false;
            }
        }

        return allEvents;
    }

    // ========================================================================
    // PUBLIC API - Save to JSON
    // ========================================================================
    
    public async fetchAndSave(outputPath: string): Promise<void> {
        const events = await this.fetchAllTrades();
        
        // BigInt-safe JSON serialization
        const jsonContent = JSON.stringify(events, (key, value) =>
            typeof value === "bigint" ? value.toString() : value
        , 2);

        fs.writeFileSync(outputPath, jsonContent, "utf-8");
        console.log(`💾 Saved ${events.length} events to ${outputPath}`);
    }
}

// CommonJS-style export for backward compatibility
export default TradeFetcher;
