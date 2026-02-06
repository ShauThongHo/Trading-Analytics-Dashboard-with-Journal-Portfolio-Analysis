# Data Field Mapping - CORRECTED ✅

This document explains the corrected field mapping after debugging the actual blockchain data.

## Summary of Changes

### What Was Wrong ❌

| JSON Field | OLD Interpretation | Actual Data |
|------------|-------------------|-------------|
| `size` | Position size | **Sequence ID** (e.g., 6272319, 6271150) |
| `price` | Price | **Raw Size/Amount** (e.g., 150000000 = 0.15) |
| (missing) | - | **Actual Price** (in bytes 24-32) |

### What's Correct Now ✅

| JSON Field | Correct Interpretation | Example | Conversion |
|------------|----------------------|---------|------------|
| `sequenceId` | Event sequence number | 6272319 | Raw value |
| `rawSize` | Raw size before conversion | 150000000 | Raw value |
| `size` | Position size in human format | 0.150000000 | rawSize / 1e9 |
| `rawPrice` | Raw price before conversion | 338461479 | Raw value |
| `price` | Price in human format | 338.461479 | rawPrice / 1e6 |
| `eventType` | Type of event | "TRADE" or "TRANSFER" | Based on log length |

---

## Buffer Layout (Corrected)

### TRADE Event (Long logs, ≥32 bytes)

```
Offset | Bytes | Type   | Field Name  | Description
-------|-------|--------|-------------|----------------------------------
0-8    | 8     | u8[8]  | Discriminator | Event type identifier (0x12, etc.)
8-16   | 8     | u64    | Sequence ID | Event sequence number
16-24  | 8     | u64    | Raw Size    | Position size (divide by 1e9)
24-32  | 8     | u64    | Raw Price   | Price (divide by 1e6)
...    | ...   | ...    | Other data  | Additional fields
-8-end | 8     | i64    | Timestamp   | Unix timestamp (seconds)
```

### TRANSFER Event (Short logs, ≤24 bytes)

```
Offset | Bytes | Type   | Field Name  | Description
-------|-------|--------|-------------|----------------------------------
0-8    | 8     | u8[8]  | Discriminator | Event type identifier
8-16   | 8     | u64    | Amount/ID   | Transfer amount or ID
16-24  | 8     | i64    | Timestamp   | Unix timestamp (might be here)
```

---

## Conversion Examples

### Example 1: TRADE Event

**Raw Log:** `EgABAZIDAAAhtF8AAAAAAADh9QUAAAAAADOmHBQAAAAAAAAACgAAAFNZhWkAAAAA`

**Decoded:**
```
Discriminator: 0x12 (TRADE)
Sequence ID:   6272033
Raw Size:      100000000
  → Size:      0.100000000 (100000000 / 1e9 = 0.1 SOL)
Raw Price:     338461479
  → Price:     338.461479 (338461479 / 1e6 = $338.46)
Timestamp:     1770346835 (2026-02-04T...)
```

### Example 2: TRANSFER Event

**Raw Log:** `FwAAAAAAAAA5DwAAAAAAAAAAAAAAAAAA`

**Decoded:**
```
Discriminator: 0x17 (TRANSFER)
Sequence ID:   (not present or 0)
Raw Size:      3897
  → Size:      0.000003897 (3897 / 1e9)
Price:         0 (not applicable for transfers)
Timestamp:     0 (invalid or not present)
```

---

## Updated TradeRecord Schema

```typescript
interface TradeRecord {
  signature: string;           // Transaction signature
  timestamp: number;           // Unix timestamp (seconds)
  market: string;              // "SOL-PERP"
  eventType: EventType;        // "TRADE" | "TRANSFER" | "UNKNOWN"
  side: TradeSide;            // "LONG" | "SHORT" | "UNKNOWN"
  
  // NEW FIELDS
  sequenceId?: string;         // Event sequence ID (raw value)
  rawSize?: string;            // Raw size before conversion
  rawPrice?: string;           // Raw price before conversion
  
  // CORRECTED FIELDS
  size: string;                // Human-readable size (rawSize / 1e9)
  price: string;               // Human-readable price (rawPrice / 1e6)
  
  originalLog: string;         // Base64 log for debugging
}
```

---

## Why This Matters

### Before Correction
```json
{
  "size": "6272319",           // ❌ This is actually Sequence ID!
  "price": "150000000"         // ❌ This is actually Raw Size!
}
```

### After Correction
```json
{
  "sequenceId": "6272319",     // ✅ Correct: Sequence ID
  "rawSize": "150000000",      // ✅ Correct: Raw size value
  "size": "0.150000000",       // ✅ Correct: Converted size (0.15 SOL)
  "rawPrice": "338461479",     // ✅ New: Raw price value
  "price": "338.461479"        // ✅ New: Converted price ($338.46)
}
```

---

## Verification Steps

### 1. Run the Test Decoder
```bash
npx ts-node src/scripts/test-decoder-v2.ts
```

This will show you the hex dump and parsed fields for sample logs.

### 2. Re-fetch Data
```bash
# Backup old data
mv data/history.json data/history-old.json

# Fetch with corrected parsing
npm run fetch:trades
```

### 3. Compare Results
```bash
# Old data showed:
# "size": "6272319" (sequence ID mistaken for size)
# "price": "150000000" (raw size mistaken for price)

# New data shows:
# "sequenceId": "6272319" ✅
# "size": "0.150000000" ✅
# "price": "338.461479" ✅
```

---

## Impact on Analytics

### Old Data Analysis (WRONG)
- Size reported as 6,272,319 (meaningless)
- Price reported as 150,000,000 (too high)
- Actual size and price were unknown

### New Data Analysis (CORRECT)
- Size: 0.15 SOL (real position size)
- Price: $338.46 (real market price)
- Can now calculate PnL, volume, etc.

---

## Next Steps

1. ✅ Re-fetch all historical data with corrected parser
2. ✅ Verify size and price values match UI screenshots
3. 🔄 Build analytics dashboard using corrected fields
4. 🔄 Add price chart visualization
5. 🔄 Calculate portfolio metrics (PnL, total volume, etc.)

---

## Questions?

See:
- [test-decoder-v2.ts](../scripts/test-decoder-v2.ts) - Test the parsing logic
- [TradeFetcher.ts](../services/TradeFetcher.ts) - Implementation
- [trade.ts](../types/trade.ts) - Type definitions
