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

// ============================================================================
// EVENT TYPE DEFINITIONS (SDK-Based Parser)
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
    orderId: string;
    amount: string;
    price: string;
    orderType: "Market" | "Limit";
    orderSide: "Bid" | "Ask";
    role: "Taker" | "Maker";
    tradeAction: "Buy" | "Sell";
}

// 2. Fee Event
export interface FeeEvent extends BaseEvent {
    type: "FEE";
    orderId: string;
    amount: string;
}

// 3. Order Management Event (New/Cancel)
export interface OrderMgmtEvent extends BaseEvent {
    type: "ORDER";
    subType: "New Ask Order" | "Ask Order Cancel" | "New Bid Order" | "Bid Order Cancel";
    orderId: string;
    amount: string;
    price: string;
    orderType: string;
}

// Union Type for any parsed event
export type ParsedEvent = TradeEvent | FeeEvent | OrderMgmtEvent;

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
