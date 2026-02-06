# Deriverse Analytics Dashboard

[English](./README.md) | [中文](./README.zh-CN.md)

> **Trading Analytics Dashboard with Journal & Portfolio Analysis for Solana**

A comprehensive TypeScript-based solution for fetching, decoding, and analyzing trading history from Solana blockchain with strict type safety and precise event parsing.

## 🎯 Project Overview

This project provides robust infrastructure for:
- ✅ Fetching complete trading history from Solana Devnet
- ✅ Decoding Anchor event logs without IDL (manual Base64 decoding)
- ✅ **Calculating unit prices from quoteAmount/size formula**
- ✅ **Strict event type system (TradeEvent | FeeEvent | OrderMgmtEvent)**
- ✅ Handling BigInt values for u64/i64 Solana types
- ✅ **Price sanity filtering (1-5000 USDC range for SOL)**
- ✅ Exporting formatted JSON matching UI requirements

## 📁 Project Structure

```
Trading-Analytics-Dashboard/
├── src/
│   ├── types/
│   │   └── trade.ts              # Event type definitions (TradeEvent, FeeEvent, etc.)
│   ├── services/
│   │   └── TradeFetcher.ts       # Core fetching, decoding & price calculation
│   ├── scripts/
│   │   ├── run-fetch.ts          # Main execution script
│   │   ├── test-final-parser.ts  # Parser validation with price tests
│   │   └── decode-history.ts     # Re-decode existing history with new logic
│   └── index.ts                  # Module exports
│
├── data/
│   ├── .gitkeep                  # Keep directory in git
│   └── history.json              # Generated trade history (gitignored)
│
├── .env.example                  # Environment variables template
├── .gitignore                    # Git ignore rules
├── package.json                  # Dependencies & scripts
├── tsconfig.json                 # TypeScript configuration
├── README.md                     # This file
├── QUICKSTART.md                 # Quick start guide
└── TRADE_FETCHER_README.md       # Detailed technical documentation
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your Helius API key and target wallet
```

### 3. Run Trade Fetcher
```bash
npm run fetch:trades
```

See [QUICKSTART.md](./QUICKSTART.md) for detailed setup instructions.

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Get started in 5 minutes
- **[TRADE_FETCHER_README.md](./TRADE_FETCHER_README.md)** - Deep dive into the architecture
- **[RATE_LIMIT_CONFIG.md](./RATE_LIMIT_CONFIG.md)** - Adjust rate limiting for your RPC plan
- **[DATA_MAPPING_CORRECTED.md](./DATA_MAPPING_CORRECTED.md)** - ✅ Field mapping corrections & conversions

## 🔧 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run fetch:trades` | Fetch complete trading history and save to data/history.json |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run test:parser` | Test parser logic with price calculation validation |
| `npm run decode:history` | Re-decode existing history.json with updated logic |

## 🏗️ Architecture

### Data Flow

```
Solana Devnet
    ↓
Helius RPC API (Free Tier Compatible)
    ↓
TradeFetcher.fetchAllTrades()
    ↓
Pagination Loop (getSignaturesForAddress)
    ↓
Individual Transaction Fetch (getParsedTransaction)
    ↓
Log Extraction & Base64 Decoding
    ↓
Event Type Detection (0x12/0x13=Trade, 0x17=Fee)
    ↓
Field Parsing (orderId, size, quoteAmount, timestamp)
    ↓
Unit Price Calculation (price = quoteAmount / size)
    ↓
Price Sanity Filter (1-5000 range)
    ↓
ParsedEvent Array (TradeEvent | FeeEvent)
    ↓
JSON Export (strict format matching UI)
    ↓
data/history.json
```

### Key Components

#### 1. **TradeFetcher Service** (`src/services/TradeFetcher.ts`)
- Manages connection to Solana RPC (free tier compatible)
- Implements pagination for fetching all transactions
- Decodes Base64 Anchor events manually
- **Calculates unit prices from quoteAmount/size formula**
- **Filters unrealistic prices (1-5000 USDC range)**
- **Returns strictly typed ParsedEvent[] (TradeEvent | FeeEvent)**

#### 2. **Type Definitions** (`src/types/trade.ts`)
```typescript
// Union Type System
type ParsedEvent = TradeEvent | FeeEvent | OrderMgmtEvent;

// Base Event (common fields)
interface BaseEvent {
  type: string;
  instrument: string;
  signature: string;
  timestamp: number;
  originalLog: string;
}

// Trade Event
interface TradeEvent extends BaseEvent {
  type: "TRADE";
  orderId: string;
  amount: string;       // Formatted: "0.02" SOL
  price: string;        // Unit price: "76.18" USDC
  orderType: string;    // "Market"
  orderSide: "Bid" | "Ask";
  role: string;         // "Taker"
  tradeAction: "Buy" | "Sell";
}

// Fee Event
interface FeeEvent extends BaseEvent {
  type: "FEE";
  orderId: "N/A";
  amount: string;       // Fee amount: "0.000761" USDC
}
```

#### 3. **Runner Script** (`src/scripts/run-fetch.ts`)
- CLI interface with progress logging
- Environment variable validation
- BigInt-safe JSON serialization
- **Displays formatted trade summaries ("Sell 0.02 @ 76.18")**
- Sample output for both TRADE and FEE events

## 🔐 Environment Variables

Create a `.env` file with:

```env
HELIUS_API_KEY=your_helius_api_key_here
TARGET_WALLET=your_solana_wallet_address_here
```

## 📊 Output Format

The fetcher generates `data/history.json` with strictly formatted events:

### TradeEvent Structure
```json
{
  "type": "TRADE",
  "instrument": "SOL/USDC",
  "orderId": "6273814",
  "amount": "0.02",
  "price": "76.18",
  "orderType": "Market",
  "orderSide": "Ask",
  "role": "Taker",
  "tradeAction": "Sell",
  "signature": "4bKNcHAtzkmoaezyZjp61fF8hCNXTVg1YUKqURfnHsB1bq...",
  "timestamp": 1770348400,
  "originalLog": "EwAAAAEAAAAWu18AAAAAAAAtMQEAAAAAkD8XAAAAAA..."
}
```

### FeeEvent Structure
```json
{
  "type": "FEE",
  "instrument": "SOL/USDC",
  "orderId": "N/A",
  "amount": "0.000761",
  "signature": "4bKNcHAtzkmoaezyZjp61fF8hCNXTVg1YUKqURfnHsB1bq...",
  "timestamp": 1770348400,
  "originalLog": "FwAAAAAAAAD5AgAAAAAAAAAAAAAAAAAA"
}
```

## 🧪 Testing

Test the parser with price calculation validation:

```bash
npm run test:parser
```

This verifies:
- Base64 to Buffer conversion
- Event type detection (0x12/0x13/0x17)
- Field extraction (orderId, size, quoteAmount)
- **Unit price calculation (quoteAmount / size)**
- Dynamic timestamp reading
- Price sanity filtering

Re-decode existing history with updated logic:
```bash
npm run decode:history
```

## 🎯 Key Features

### 1. Pagination Support
Fetches **entire** trading history using signature batching (20 signatures per request).

### 2. Manual Log Decoding with Price Calculation
Decodes Anchor events without requiring the IDL:

**Buffer Layout:**
- **Byte 0**: Event discriminator
  - `0x12` = LONG/Bid/Buy
  - `0x13` = SHORT/Ask/Sell
  - `0x17` = FEE event
- **Bytes 8-16**: Order ID (u64, little-endian)
- **Bytes 16-24**: Trade size/amount (u64, ÷1e9 for SOL)
- **Bytes 24-32**: Quote amount - **TOTAL USDC value** (u64, ÷1e6 for USDC)
- **Last 8/4 bytes**: Timestamp (i64 or u32, depends on buffer length)

**⚠️ Critical Discovery:**
Bytes 24-32 contain **total quote amount** (not unit price).

**Price Calculation Formula:**
```typescript
const size = rawSize / 1_000_000_000;       // Convert to SOL
const quoteAmount = rawQuote / 1_000_000;   // Convert to USDC
const unitPrice = quoteAmount / size;        // Calculate unit price
```

Example:
- Raw size: `20000000` → `0.02 SOL`
- Raw quote: `1523600` → `1.5236 USDC`
- Unit price: `1.5236 / 0.02 = 76.18 USDC/SOL`

### 3. Price Sanity Filtering
Filters unrealistic prices to ensure data quality:
```typescript
if (unitPrice < 1 || unitPrice > 5000) {
  return null; // Reject unrealistic prices
}
```

### 4. Dynamic Timestamp Reading
Adapts to different buffer lengths:
- 48+ bytes: Read 64-bit timestamp from last 8 bytes
- 40 bytes: Read 32-bit timestamp from last 4 bytes

### 5. Strict Type System
Union types ensure compile-time safety:
```typescript
type ParsedEvent = TradeEvent | FeeEvent | OrderMgmtEvent;
```

### 6. BigInt Handling
Safely serializes Solana's u64/i64 types:
```typescript
const bigIntReplacer = (key: string, value: any) =>
  typeof value === 'bigint' ? value.toString() : value;

JSON.stringify(trades, bigIntReplacer, 2);
```

### 7. Error Resilience
Gracefully handles:
- Missing transaction data
- Unparseable logs
- **Automatic retry with exponential backoff** (2s → 128s, 7 retries)
- **Rate limiting protection** (2s delays between calls)
- **Free tier compatible** (individual API calls, no batch requests)

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot convert BigInt to number" | Use `bigIntReplacer` in JSON.stringify |
| "Invalid public key" | Verify TARGET_WALLET is valid Solana address |
| **429 Too Many Requests** | **Auto-retries included (up to 7x with exponential backoff). Reduce `BATCH_SIZE` to 1-2 if persists** |
| **403 Batch requests error** | **Using individual calls (free tier compatible). No action needed** |
| No trades found | Check wallet has Devnet activity; inspect console logs |
| **Unrealistic prices** | **Automatic filtering (1-5000 range). Adjust filter in `parseLog()` if needed** |
| **0 price showing** | **Division by zero (size=0). Parser returns null for invalid trades** |
| Slow fetching | Normal for free tier (3 tx per 2s). Upgrade to paid plan for faster speeds |

## 📈 Performance

**Current Settings (Optimized for Free Tier):**
- **FREE TIER COMPATIBLE**: Uses individual RPC calls (not batch requests)
- **Signature Batching**: 20 signatures per batch
- **Transaction Fetching**: Individual `getParsedTransaction` calls (BATCH_SIZE=3)
- **Rate Limiting**: 2 second delay + exponential backoff (auto-retry up to 7x: 2s→4s→8s→16s→32s→64s→128s)
- **Memory**: Efficient streaming, no full history in memory
- **Price Filtering**: Rejects prices outside 1-5000 USDC range

**Typical Speed (Free Tier):**
- **~90 transactions per minute** (3 txs every 2 seconds)
- Small wallets (<50 txs): **30-40 seconds**
- Medium wallets (50-100 txs): **1-2 minutes**
- Large wallets (100-500 txs): **3-10 minutes**

**Recent Performance:**
- 11 events fetched in **12.93 seconds** (0.85 events/sec)
- 100% parse success rate
- 0 unrealistic prices in output

**To Speed Up:** Upgrade to paid RPC plan, then adjust in `TradeFetcher.ts`:
- Increase `BATCH_SIZE` to 10-50
- Decrease `DELAY_MS` to 500-1000ms

## 🚧 Roadmap

- [x] Implement price calculation from quoteAmount/size formula
- [x] Strict event type system (TradeEvent | FeeEvent | OrderMgmtEvent)
- [x] Price sanity filtering (1-5000 range)
- [x] Dynamic timestamp reading (64-bit / 32-bit)
- [x] FEE event detection and parsing
- [x] Side/action mapping (Bid/Buy, Ask/Sell)
- [ ] OrderMgmtEvent implementation (New/Cancel orders)
- [ ] Support for additional market types (beyond SOL/USDC)
- [ ] Add real-time WebSocket subscriptions
- [ ] Implement data validation & anomaly detection
- [ ] Build React dashboard for visualization
- [ ] Add support for IDL-based decoding
- [ ] Implement historical data caching
- [ ] Add portfolio analysis features (PnL tracking, statistics)

## 🛠️ Tech Stack

- **TypeScript** - Type-safe development
- **@solana/web3.js** - Solana blockchain interaction
- **Node.js Buffer** - Binary data manipulation
- **dotenv** - Environment configuration

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read the code structure in [TRADE_FETCHER_README.md](./TRADE_FETCHER_README.md) before submitting PRs.

## 📞 Support

For detailed technical documentation, see:
- [TRADE_FETCHER_README.md](./TRADE_FETCHER_README.md) - Architecture & implementation details
- [QUICKSTART.md](./QUICKSTART.md) - Setup walkthrough

---

**Built for Deriverse Analytics** - Empowering traders with data-driven insights
