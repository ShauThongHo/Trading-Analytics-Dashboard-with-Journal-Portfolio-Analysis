/**
 * Trade Record Type Definition
 * 
 * Represents a single trade fetched from the Solana blockchain.
 * BigInt values are stored as strings to prevent JSON serialization issues.
 */

export type TradeSide = "LONG" | "SHORT" | "UNKNOWN";
export type EventType = "TRADE" | "TRANSFER" | "UNKNOWN";

export interface TradeRecord {
  /** Transaction signature (unique identifier) */
  signature: string;

  /** Unix timestamp in seconds */
  timestamp: number;

  /** Market identifier (e.g., "SOL-PERP") */
  market: string;

  /** Event type (TRADE, TRANSFER, etc.) */
  eventType: EventType;

  /** Trade direction */
  side: TradeSide;

  /** Action type (TRADE, FEE, etc.) */
  action?: string;

  /** Sequence ID from the event */
  sequenceId?: string;

  /** Position size in human-readable format (converted from raw value) */
  size: string;

  /** Price in human-readable format (converted from raw value) */
  price: string;

  /** Fee amount in human-readable format (for FEE events) */
  fee?: string;

  /** Raw size value before conversion */
  rawSize?: string;

  /** Raw price value before conversion */
  rawPrice?: string;

  /** Original Base64 log for debugging and re-parsing */
  originalLog: string;
}

/**
 * Partial trade data extracted from logs before validation
 */
export interface PartialTradeData {
  eventType?: EventType;
  action?: string;
  sequenceId?: string;
  size?: string;
  price?: string;
  fee?: string;
  rawSize?: string;
  rawPrice?: string;
  timestamp?: number;
  side?: TradeSide;
}
