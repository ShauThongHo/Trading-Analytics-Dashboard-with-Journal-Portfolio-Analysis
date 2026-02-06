# Rate Limit Configuration Guide

## Important: Free Tier Compatibility

**The fetcher now uses INDIVIDUAL API calls** instead of batch requests, making it compatible with Helius free tier and other free RPC providers.

## Current Settings (Free Tier)

The fetcher is configured for **any free tier RPC** including Helius, QuickNode, Alchemy, etc.

### Default Configuration
```typescript
// In src/services/TradeFetcher.ts (lines 29-31)
SIGNATURE_BATCH_SIZE = 20    // How many signatures to fetch at once
BATCH_DELAY_MS = 2000        // Delay between individual transaction fetches (milliseconds)
```

**Note:** `TX_BATCH_SIZE` is **no longer used** - we fetch transactions one at a time using individual API calls.

**Performance:** ~30 transactions/minute, 1 transaction every 2 seconds

---

## Upgrade Scenarios

### 🎯 Scenario 1: You Got a Paid Helius/RPC Plan

If you upgraded to a paid plan with higher rate limits:

```typescript
// Edit src/services/TradeFetcher.ts lines 29-31

SIGNATURE_BATCH_SIZE = 100   // Fetch more signatures at once
BATCH_DELAY_MS = 500         // Reduce delay to 500ms (or even 200ms)
```

**Expected Performance:** ~120 transactions/minute (4x faster!)

---

### 🎯 Scenario 2: Still Getting 429 Errors on Free Tier

If the fetcher still hits rate limits with default settings:

```typescript
// Edit src/services/TradeFetcher.ts lines 29-31

SIGNATURE_BATCH_SIZE = 10    // Reduce signature batch
BATCH_DELAY_MS = 3000        // Increase delay to 3 seconds
```

**Expected Performance:** ~20 transactions/minute (slower but more reliable)

---

### 🎯 Scenario 3: Using Different RPC Provider

Different providers have different limits. Start conservative and increase:

```typescript
// Start with these and gradually decrease delay if no errors

SIGNATURE_BATCH_SIZE = 20
BATCH_DELAY_MS = 1500        // 1.5 seconds
```

Monitor the console output. If you see "⏳ Rate limited" messages frequently, increase `BATCH_DELAY_MS`.

---

## How to Edit

1. Open `src/services/TradeFetcher.ts`
2. Find lines 29-31 (the CONFIGURATION section)
3. Update the values
4. Save the file
5. Run `npm run fetch:trades` again

## Configuration Examples by Provider

### Helius Free Tier ✅
```typescript
BATCH_DELAY_MS = 2000  // Current default
```

### Helius Pro
```typescript
BATCH_DELAY_MS = 500   // Much faster
```

### QuickNode Free
```typescript
BATCH_DELAY_MS = 2500  // Slightly slower
```

### QuickNode (Paid)
```typescript
BATCH_DELAY_MS = 400
```

### Alchemy Free
```typescript
BATCH_DELAY_MS = 2000
```

### Alchemy (Paid)
```typescript
BATCH_DELAY_MS = 600
```

### Public RPC (VERY Limited)
```typescript
BATCH_DELAY_MS = 5000  // 5 seconds!
```

---

## Troubleshooting

### "403 Forbidden: Batch requests are only available for paid plans"

**This should NOT happen anymore!** The fetcher now uses individual API calls. If you see this error:
1. Make sure you're using the latest version of the code
2. Check that `getParsedTransaction` (singular) is being used, not `getParsedTransactions` (plural)

### "Still getting 429 errors even with BATCH_DELAY_MS = 2000"

Try these in order:

1. **Increase delay:**
   ```typescript
   BATCH_DELAY_MS = 5000  // 5 seconds
   ```

2. **Check your API key usage** - You might have exhausted your daily quota

3. **Try a different time** - RPC providers may have peak hours

4. **Create a new API key** - Your current one might be rate-limited

5. **Wait 1 hour** - Some rate limits reset hourly

### "How can I see what values I'm currently using?"

The fetcher prints this info at startup:
```
⚠️  Using conservative rate limiting (1 tx every 2s) to avoid API limits
```

---

## Performance Calculator

Calculate expected fetch time:

```
Time (minutes) = Number of Transactions / Transactions per Minute

Where Transactions per Minute ≈ 60 / (BATCH_DELAY_MS / 1000)
```

### Examples:

| BATCH_DELAY_MS | Txs/Min | Time for 100 txs |
|----------------|---------|-------------------|
| 5000           | 12      | ~8 minutes       |
| 3000           | 20      | ~5 minutes       |
| 2000           | 30      | ~3.3 minutes     |
| 1500           | 40      | ~2.5 minutes     |
| 1000           | 60      | ~1.7 minutes     |
| 500            | 120     | ~50 seconds      |
| 250            | 240     | ~25 seconds      |

---

## Recommended Starting Points

| Use Case | BATCH_DELAY_MS |
|----------|----------------|
| First time user (any free tier) | 2000 |
| Verified working (free tier) | 1500 |
| Paid tier (cautious) | 1000 |
| Paid tier (normal) | 500 |
| Paid tier (aggressive) | 250 |
| Enterprise/Dedicated RPC | 100 |

---

## Need Help?

If you're still having issues after adjusting these settings:
1. Check [QUICKSTART.md](./QUICKSTART.md) troubleshooting section
2. Verify your RPC provider's documentation for rate limits
3. Consider upgrading your RPC plan if you need faster fetching
