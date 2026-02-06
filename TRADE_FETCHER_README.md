# Deriverse Analytics - Trade History Fetcher

A robust TypeScript module for fetching and decoding trading history from Solana Devnet.

## Features

✅ **Pagination Support** - Fetches entire trading history using efficient batching  
✅ **Manual Log Decoding** - Decodes Anchor events without requiring the IDL  
✅ **BigInt Handling** - Properly serializes u64/i64 values to JSON  
✅ **Type Safety** - Full TypeScript support with clean interfaces  
✅ **Error Resilience** - Gracefully handles parsing failures

## Architecture

### Files Created

```
src/
├── types/
│   └── trade.ts              # Type definitions (TradeRecord interface)
├── services/
│   └── TradeFetcher.ts       # Core fetching and decoding logic
└── scripts/
    └── run-fetch.ts          # Runnable script with CLI output

data/
└── history.json             # Output file (generated after running)
```

## Setup

### 1. Install Dependencies

```bash
npm install @solana/web3.js dotenv
npm install -D @types/node typescript ts-node
```

### 2. Configure Environment

Create a `.env` file (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
HELIUS_API_KEY=your_helius_api_key_here
TARGET_WALLET=your_solana_wallet_address_here
```

### 3. Run the Fetcher

```bash
npx ts-node src/scripts/run-fetch.ts
```

Or add to `package.json`:

```json
{
  "scripts": {
    "fetch:trades": "ts-node src/scripts/run-fetch.ts"
  }
}
```

Then run:

```bash
npm run fetch:trades
```

## How It Works

### 1. Pagination Logic

The `TradeFetcher` class fetches all transactions for a wallet using the `before` parameter:

```typescript
while (hasMore) {
  const signatures = await connection.getSignaturesForAddress(wallet, { before, limit: 100 });
  const transactions = await connection.getParsedTransactions(signatures);
  // Process transactions...
  before = signatures[signatures.length - 1].signature;
}
```

### 2. Log Decoding

Anchor events are emitted as Base64-encoded logs. We decode them manually:

```typescript
private parseLog(log: string): PartialTradeData {
  const buffer = Buffer.from(log, 'base64');
  
  // Layout based on sample log analysis:
  // Bytes 0-8: Discriminator (skip)
  // Bytes 8-16: size (u64)
  // Bytes 16-24: price (u64)
  // Last 8 bytes: timestamp (i64)
  
  const size = buffer.readBigUInt64LE(8).toString();
  const price = buffer.readBigUInt64LE(16).toString();
  const timestamp = Number(buffer.readBigInt64LE(buffer.length - 8));
  
  return { size, price, timestamp };
}
```

### 3. BigInt Serialization

To prevent `JSON.stringify` crashes, we use a custom replacer:

```typescript
const bigIntReplacer = (key: string, value: any) =>
  typeof value === 'bigint' ? value.toString() : value;

JSON.stringify(trades, bigIntReplacer, 2);
```

## Output Format

The generated `data/history.json` contains an array of trade records:

```json
[
  {
    "signature": "5Xj8...",
    "timestamp": 1769855563,
    "market": "SOL-PERP",
    "side": "LONG",
    "size": "234898",
    "price": "6058825",
    "originalLog": "EgABAZIDAACusF8AAAAAAADh9QUAAAAAAJc64g8AAAAAAAAAAAAAAAAA"
  }
]
```

## Key Design Decisions

### Why store `size` and `price` as strings?
Solana uses u64/i64 types which JavaScript's BigInt cannot natively serialize to JSON. Storing as strings preserves full precision.

### Why manual decoding instead of IDL?
For rapid prototyping or when the IDL is unavailable, manual decoding provides a fast path to accessing event data.

### Why the specific byte layout?
Based on analysis of the sample log: `EgABAZIDAACusF8AAAAAAADh9QUAAAAAAJc64g8AAAAAAAAAAAAAAGNVhWkAAAAA`

- Verified timestamp `0x69855563` (1769855563) appears at the end
- Size and price fields appear in the first 24 bytes after discriminator

## Extending the System

### Adding More Fields

Edit `src/types/trade.ts`:

```typescript
export interface TradeRecord {
  // ... existing fields
  fee?: string;
  leverage?: number;
}
```

Update `parseLog()` to extract new fields from the buffer.

### Supporting Multiple Markets

Modify the `extractTradesFromTransaction` method to detect market from program ID or instruction data.

### Adding IDL Support

Once you have the IDL:

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import idl from './idl.json';

const program = new Program(idl, programId, provider);
const event = program.coder.events.decode(log);
```

## Troubleshooting

### "Cannot convert a BigInt value to number"

Ensure you're using the `bigIntReplacer` when calling `JSON.stringify`.

### "Invalid public key input"

Check that `TARGET_WALLET` in `.env` is a valid Solana address.

### "429 Too Many Requests" or Rate Limiting

The fetcher includes **automatic retry logic with exponential backoff**:
- Retries up to 5 times with increasing delays (500ms → 8000ms)
- Processes transactions in chunks of 10 to respect rate limits
- 500ms delay between batches

If you still hit rate limits:
- Reduce `TX_BATCH_SIZE` from 10 to 5 in `TradeFetcher.ts`
- Increase `BATCH_DELAY_MS` from 500ms to 1000ms
- Upgrade to a paid Helius plan for higher rate limits

### No trades found

- Verify the wallet has trading activity on Devnet
- Check that the program logs match the expected pattern
- Use `originalLog` field to inspect raw data

## Performance

**Current Configuration (Free Tier Optimized):**
- **Signature Batching**: Fetches 20 signatures per batch
- **Transaction Chunking**: Processes 1 transaction at a time (extremely conservative)
- **Rate Limiting**: 2000ms (2 second) delay between requests
- **Resilience**: Auto-retries up to 7 times with exponential backoff (2s → 128s)

**Typical Performance (Free Tier):** 
  - **~30 transactions per minute** (1 transaction every 2 seconds)
  - Small wallets (<50 txs): 2-3 minutes
  - Medium wallets (50-100 txs): 3-4 minutes
  - Large wallets (100-500 txs): 10-20 minutes
  - Very large wallets (500+ txs): 30+ minutes

**Speed Up Options:**
1. **Get Paid RPC Access** - Helius paid plans offer 100x higher rate limits
2. **Adjust Configuration** in `TradeFetcher.ts`:
   - Increase `TX_BATCH_SIZE` from 1 to 10-20
   - Decrease `BATCH_DELAY_MS` from 2000 to 500-1000

### Rate Limit Protection Features

1. **Exponential Backoff**: Automatically retries with increasing delays (2s → 128s)
2. **Conservative Chunking**: Fetches 1 transaction at a time for free tier safety
3. **Configurable Delays**: Easily adjustable `BATCH_DELAY_MS` and `TX_BATCH_SIZE`
4. **Graceful Degradation**: Continues processing even if some transactions fail

## Next Steps

- [ ] Implement proper side detection (LONG vs SHORT)
- [ ] Add support for multiple markets
- [ ] Create real-time websocket listener
- [ ] Add data validation and anomaly detection
- [ ] Build dashboard visualization layer
