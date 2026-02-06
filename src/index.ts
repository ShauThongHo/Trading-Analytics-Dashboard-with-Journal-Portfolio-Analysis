/**
 * Deriverse Analytics - Main Entry Point
 * 
 * This module provides the core functionality for fetching and analyzing
 * trading history from Solana Devnet.
 */

export { TradeFetcher } from './services/TradeFetcher';
export { TradeRecord, TradeSide, EventType, PartialTradeData } from './types/trade';

// Default export for convenience
export { TradeFetcher as default } from './services/TradeFetcher';
