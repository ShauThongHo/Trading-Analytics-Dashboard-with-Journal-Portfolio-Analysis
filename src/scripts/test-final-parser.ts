/**
 * Final Parser Test - Validates FEE and TRADE event mappings
 */

import { Buffer } from 'buffer';

// Sample logs from actual blockchain data
const TEST_CASES = [
  {
    name: "FEE Event (0x17)",
    log: "FwAAAAAAAAA5DwAAAAAAAAAAAAAAAAAA",
    expectedAction: "FEE",
    expectedFee: "0.003897", // 3897 / 1e6
    expectedSize: "0",
    expectedPrice: "0",
  },
  {
    name: "TRADE Event - LONG (0x12, 48 bytes)",
    log: "EgABAZIDAAAhtF8AAAAAAADh9QUAAAAAADOmHBQAAAAAAAAACgAAAFNZhWkAAAAA",
    expectedAction: "TRADE",
    expectedSide: "LONG",
    expectedSize: "0.100000000", // 100000000 / 1e9
    expectedPrice: "863800.00", // quoteAmount(86380) / size(0.1)
    expectedTimestamp: 1770346835,
  },
  {
    name: "TRADE Event - LONG (0x12, 40 bytes)",
    log: "EgAAAZIDAACyr18AAAAAAADC6wsAAAAAAH6ovw8AAAAAAAAAJFSFaQ==",
    expectedAction: "TRADE",
    expectedSide: "LONG",
    expectedSize: "0.200000000", // 200000000 / 1e9
    expectedPrice: "338200.00", // quoteAmount(67640) / size(0.2)
    expectedTimestamp: 1770345508,
  },
];

function parseLog(log: string, blockTime: number): any {
  const buffer = Buffer.from(log, 'base64');
  
  if (buffer.length < 16) {
    return { eventType: "UNKNOWN" };
  }

  const data: any = {};
  const discriminator = buffer.readUInt8(0);

  // **Case A: FEE Events (Discriminator 0x17)**
  if (discriminator === 0x17) {
    data.action = "FEE";
    data.side = "UNKNOWN";
    data.timestamp = blockTime;
    
    // Fee amount at bytes 8-16, divide by 1e6 (6 decimals)
    if (buffer.length >= 16) {
      const feeRaw = buffer.readBigUInt64LE(8);
      const feeInDecimals = Number(feeRaw) / 1_000_000;
      data.fee = feeInDecimals.toFixed(6);
    }
    
    data.size = "0";
    data.price = "0";
  }
  // **Case B: TRADE Events (Buffer >= 40)**
  else if (buffer.length >= 40 && (discriminator === 0x12 || discriminator === 0x13 || discriminator === 0x0A || discriminator === 0x0B)) {
    data.action = "TRADE";
    
    // Determine side
    if (discriminator === 0x12 || discriminator === 0x0A) {
      data.side = "LONG";
    } else if (discriminator === 0x13 || discriminator === 0x0B) {
      data.side = "SHORT";
    }
    
    // Timestamp from last bytes
    let ts: number = 0;
    if (buffer.length >= 48) {
      const timestampRaw = buffer.readBigInt64LE(buffer.length - 8);
      ts = Number(timestampRaw);
    } else {
      ts = buffer.readUInt32LE(buffer.length - 4);
    }
    
    // Use buffer timestamp if valid, otherwise fallback to blockTime
    if (ts > 1577836800 && ts < 1893456000) {
      data.timestamp = ts;
    } else {
      data.timestamp = blockTime;
    }
    
    // Size at bytes 16-24, divide by 1e9 (9 decimals)
    const rawSize = buffer.readBigUInt64LE(16);
    const sizeInDecimals = Number(rawSize) / 1_000_000_000;
    data.size = sizeInDecimals.toFixed(9);
    
    // Quote Amount at bytes 24-32, divide by 1e6 (6 decimals)
    // This is TOTAL USDC value, not unit price
    const rawQuoteAmount = buffer.readBigUInt64LE(24);
    const quoteAmount = Number(rawQuoteAmount) / 1_000_000;
    
    // Calculate unit price: price = quoteAmount / size
    if (sizeInDecimals > 0) {
      data.price = (quoteAmount / sizeInDecimals).toFixed(2);
    } else {
      data.price = "0";
    }
  }

  return data;
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  Final Parser Test - FEE & TRADE Event Validation');
console.log('═══════════════════════════════════════════════════════════\n');

for (const test of TEST_CASES) {
  console.log(`Testing: ${test.name}`);
  console.log(`Input: ${test.log}\n`);
  
  const result = parseLog(test.log, 1770000000);
  
  const checks = {
    action: result.action === test.expectedAction,
    side: !test.expectedSide || result.side === test.expectedSide,
    size: result.size === test.expectedSize,
    price: result.price === test.expectedPrice,
    fee: !test.expectedFee || result.fee === test.expectedFee,
    timestamp: !test.expectedTimestamp || result.timestamp === test.expectedTimestamp,
  };
  
  console.log(`  Action:    ${result.action} ${checks.action ? '✅' : '❌'} (expected: ${test.expectedAction})`);
  if (test.expectedSide) {
    console.log(`  Side:      ${result.side} ${checks.side ? '✅' : '❌'} (expected: ${test.expectedSide})`);
  }
  console.log(`  Size:      ${result.size} ${checks.size ? '✅' : '❌'} (expected: ${test.expectedSize})`);
  console.log(`  Price:     ${result.price} ${checks.price ? '✅' : '❌'} (expected: ${test.expectedPrice})`);
  if (test.expectedFee) {
    console.log(`  Fee:       ${result.fee} ${checks.fee ? '✅' : '❌'} (expected: ${test.expectedFee})`);
  }
  if (test.expectedTimestamp) {
    console.log(`  Timestamp: ${result.timestamp} ${checks.timestamp ? '✅' : '❌'} (expected: ${test.expectedTimestamp})`);
  }
  
  const allPass = Object.values(checks).every(v => v);
  console.log(`\n  ${allPass ? '✅ PASS' : '❌ FAIL'}\n`);
  console.log('─'.repeat(60) + '\n');
}

console.log('═══════════════════════════════════════════════════════════');
console.log('  ✅ Final Mapping Summary');
console.log('═══════════════════════════════════════════════════════════');
console.log('  FEE Events (discriminator 0x17):');
console.log('    - action: "FEE"');
console.log('    - fee: bytes 8-16 ÷ 1,000,000 (6 decimals)');
console.log('    - size: "0"');
console.log('    - price: "0"');
console.log('    - timestamp: blockTime\n');
console.log('  TRADE Events (discriminator 0x12/0x13):');
console.log('    - action: "TRADE"');
console.log('    - size: bytes 16-24 ÷ 1,000,000,000 (9 decimals)');
console.log('    - quoteAmount: bytes 24-32 ÷ 1,000,000 (6 decimals)');
console.log('    - price: CALCULATED as quoteAmount / size');
console.log('    - timestamp: from buffer or blockTime fallback');
console.log('═══════════════════════════════════════════════════════════\n');
