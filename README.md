# Deriverse Analytics Dashboard

> **Trading Analytics Dashboard with Journal & Portfolio Analysis for Solana**

A comprehensive TypeScript-based solution for fetching, decoding, and analyzing trading history from Solana blockchain.

## 🎯 Project Overview

This project provides robust infrastructure for:
- ✅ Fetching complete trading history from Solana Devnet
- ✅ Decoding Anchor event logs without IDL (manual Base64 decoding)
- ✅ Handling BigInt values for u64/i64 Solana types
- ✅ Exporting data to JSON for analytics and visualization

## 📁 Project Structure

```
Trading-Analytics-Dashboard/
├── src/
│   ├── types/
│   │   └── trade.ts              # TradeRecord interface & types
│   ├── services/
│   │   └── TradeFetcher.ts       # Core fetching & decoding logic
│   ├── scripts/
│   │   ├── run-fetch.ts          # Main execution script
│   │   └── test-decoder.ts       # Log decoder testing utility
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
| `npm run fetch:trades` | Fetch complete trading history for configured wallet |
| `npm run build` | Compile TypeScript to JavaScript |
| `npx ts-node src/scripts/test-decoder.ts` | Test log decoder with sample data |

## 🏗️ Architecture

### Data Flow

```
Solana Devnet
    ↓
Helius RPC API
    ↓
TradeFetcher.fetchAllTrades()
    ↓
Pagination Loop (getSignaturesForAddress)
    ↓
Batch Transaction Fetch (getParsedTransactions)
    ↓
Log Extraction & Base64 Decoding
    ↓
TradeRecord Array
    ↓
JSON Export (with BigInt handling)
    ↓
data/history.json
```

### Key Components

#### 1. **TradeFetcher Service** (`src/services/TradeFetcher.ts`)
- Manages connection to Solana RPC
- Implements pagination for fetching all transactions
- Decodes Base64 Anchor events manually
- Extracts trade data (size, price, timestamp, side)

#### 2. **Type Definitions** (`src/types/trade.ts`)
```typescript
interface TradeRecord {
  signature: string;
  timestamp: number;
  market: string;
  side: "LONG" | "SHORT" | "UNKNOWN";
  size: string;    // BigInt as string
  price: string;   // BigInt as string
  originalLog: string;
}
```

#### 3. **Runner Script** (`src/scripts/run-fetch.ts`)
- CLI interface with progress logging
- Environment variable validation
- BigInt-safe JSON serialization
- Sample output display

## 🔐 Environment Variables

Create a `.env` file with:

```env
HELIUS_API_KEY=your_helius_api_key_here
TARGET_WALLET=your_solana_wallet_address_here
```

## 📊 Output Format

The fetcher generates `data/history.json`:

```json
[
  {
    "signature": "5Xj8hM2p...",
    "timestamp": 1769855563,
    "market": "SOL-PERP",
    "side": "LONG",
    "size": "234898",
    "price": "6058825",
    "originalLog": "EgABAZIDAACusF8AAAA..."
  }
]
```

## 🧪 Testing

Test the Base64 decoder with sample data:

```bash
npx ts-node src/scripts/test-decoder.ts
```

This verifies the log parsing logic against the known sample:
```
EgABAZIDAACusF8AAAAAAADh9QUAAAAAAJc64g8AAAAAAAAAAAAAAGNVhWkAAAAA
```

## 🎯 Key Features

### 1. Pagination Support
Fetches **entire** trading history using efficient batching (100 transactions per request).

### 2. Manual Log Decoding
Decodes Anchor events without requiring the IDL:
- Bytes 0-8: Discriminator (skip)
- Bytes 8-16: Size (u64, little-endian)
- Bytes 16-24: Price (u64, little-endian)
- Last 8 bytes: Timestamp (i64, little-endian)

### 3. BigInt Handling
Safely serializes Solana's u64/i64 types:
```typescript
const bigIntReplacer = (key: string, value: any) =>
  typeof value === 'bigint' ? value.toString() : value;

JSON.stringify(trades, bigIntReplacer, 2);
```

### 4. Error Resilience
Gracefully handles:
- Missing transaction data
- Unparseable logs
- **Automatic retry with exponential backoff** (500ms → 8s)
- **Rate limiting protection** (chunked requests + delays)

## 🔍 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot convert BigInt to number" | Use `bigIntReplacer` in JSON.stringify |
| "Invalid public key" | Verify TARGET_WALLET is valid Solana address |
| **429 Too Many Requests** | **Auto-retries included. Reduce `TX_BATCH_SIZE` or increase `BATCH_DELAY_MS` if persists** |
| No trades found | Check wallet has Devnet activity; inspect logs |

## 📈 Performance

**Current Settings (Optimized for Free Tier):**
- **FREE TIER COMPATIBLE**: Uses individual RPC calls (not batch requests)
- **Signature Batching**: 20 signatures per batch
- **Transaction Fetching**: Individual API calls (one at a time)
- **Rate Limiting**: 2 second delay + exponential backoff (auto-retry up to 7x)
- **Memory**: Efficient streaming, no full history in memory

**Typical Speed (Free Tier):**
- **~30 transactions per minute** (1 tx every 2 seconds)
- Small wallets (<50 txs): 2-3 minutes
- Medium wallets (50-100 txs): 3-4 minutes
- Large wallets (100-500 txs): 10-20 minutes

**To Speed Up:** Upgrade to paid RPC plan, then adjust `BATCH_DELAY_MS` in `TradeFetcher.ts`:
- Decrease to 500-1000ms for faster fetching

## 🚧 Roadmap

- [ ] Implement proper LONG/SHORT side detection
- [ ] Support multiple market types
- [ ] Add real-time WebSocket subscriptions
- [ ] Implement data validation & anomaly detection
- [ ] Build React dashboard for visualization
- [ ] Add support for IDL-based decoding
- [ ] Implement historical data caching
- [ ] Add portfolio analysis features

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
