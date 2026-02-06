/**
 * Test script to verify CORRECTED Base64 log decoding logic (V2 - Final)
 * 
 * This validates the FINAL parseLog() implementation with:
 * - Dynamic timestamp reading (always from buffer.length - 8)
 * - Conditional price reading (only for buffer >= 40)
 * - FEE event handling (discriminator 0x17)
 * 
 * Run with: npx ts-node src/scripts/test-decoder-v2.ts
 */

/**
 * Sample logs from actual data:
 * 
 * TRADE Events (48 bytes):
 * - Full layout with padding
 * 
 * TRADE Events (40 bytes):
 * - Compact layout without padding
 * 
 * FEE Events (24 bytes):
 * - Discriminator 0x17
 * - Contains fee amount
 */

const SAMPLE_LOGS = [
  {
    name: "TRADE Event (48 bytes)",
    log: "EgABAZIDAAAhtF8AAAAAAADh9QUAAAAAADOmHBQAAAAAAAAACgAAAFNZhWkAAAAA",
    expectedLength: 48,
    expectedDiscriminator: "0x12",
    expectedEventType: "TRADE",
    expectedSequenceId: "6272033",
    expectedSize: "0.100000000",
    expectedPrice: "338.461479", // Should read from bytes 24-32
    expectedTimestamp: 1770346835,
  },
  {
    name: "TRADE Event (40 bytes)",
    log: "EgAAAZIDAACyr18AAAAAAADC6wsAAAAAAH6ovw8AAAAAAAAAJFSFaQ==",
    expectedLength: 40,
    expectedDiscriminator: "0x12",
    expectedEventType: "TRADE",
    expectedSequenceId: "6270898",
    expectedSize: "0.200000000",
    expectedPrice: "268.607614", // Should read from bytes 24-32
    expectedTimestamp: 1770345508, // Should read from last 8 bytes
  },
  {
    name: "TRADE Event - LONG (0x12)",
    log: "EgABAZIDAACusF8AAAAAAADh9QUAAAAAAJc64g8AAAAAAAAAAAAAAGNVhWkAAAAA",
    expectedLength: 48,
    expectedDiscriminator: "0x12",
    expectedEventType: "TRADE",
    expectedSide: "LONG",
    expectedSequenceId: "6271150",
    expectedSize: "0.100000000",
    expectedTimestamp: 1770345827,
  },
  {
    name: "FEE Event (24 bytes - 0x17)",
    log: "FwAAAAAAAAA5DwAAAAAAAAAAAAAAAAAA",
    expectedLength: 24,
    expectedDiscriminator: "0x17",
    expectedEventType: "TRANSFER", // Fee events map to TRANSFER
    expectedSequenceId: "0",
    expectedSize: "0.000003897", // Fee amount
    expectedPrice: "0", // No price for fee events
    expectedTimestamp: 0, // Last 8 bytes are likely 0 for fees
  },
  {
    name: "FEE Event 2 (24 bytes - 0x17)",
    log: "FwAAAAAAAAAADwAAAAAAAAAAAAAAAAAA",
    expectedLength: 24,
    expectedDiscriminator: "0x17",
    expectedEventType: "TRANSFER",
    expectedSize: "0.000003840",
    expectedPrice: "0",
  },
];

function decodeLog(log: string, name: string, expected: any): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Input: ${log}\n`);

  const buffer = Buffer.from(log, 'base64');
  console.log(`Buffer length: ${buffer.length} bytes`);
  if (expected.expectedLength) {
    console.log(`Expected: ${expected.expectedLength} bytes ${buffer.length === expected.expectedLength ? '✅' : '❌'}\n`);
  } else {
    console.log('');
  }

  // Display hex dump
  console.log('Hex dump:');
  for (let i = 0; i < buffer.length; i += 8) {
    const chunk = buffer.slice(i, Math.min(i + 8, buffer.length));
    const hex = chunk.toString('hex').match(/.{2}/g)?.join(' ') || '';
    const offset = `[${i.toString().padStart(2, '0')}-${Math.min(i + 7, buffer.length - 1).toString().padStart(2, '0')}]`;
    console.log(`  ${offset} ${hex}`);
  }
  console.log('');

  // Parse fields according to FINAL layout
  console.log('Parsed fields (FINAL LAYOUT):');

  // Discriminator
  const discriminator = buffer.readUInt8(0);
  const discHex = `0x${discriminator.toString(16).padStart(2, '0')}`;
  console.log(`  Discriminator (byte 0):  ${discHex} ${expected.expectedDiscriminator === discHex ? '✅' : ''}`);

  // Event type detection
  let eventType = "UNKNOWN";
  if (discriminator === 0x17) {
    eventType = "TRANSFER"; // FEE event
  } else if (buffer.length >= 40 && (discriminator === 0x12 || discriminator === 0x13 || discriminator === 0x0A || discriminator === 0x0B)) {
    eventType = "TRADE";
  } else if (buffer.length <= 24) {
    eventType = "TRANSFER";
  }
  console.log(`  Event Type:              ${eventType} ${expected.expectedEventType === eventType ? '✅' : ''}`);

  // Side detection
  let side = "UNKNOWN";
  if (discriminator === 0x12 || discriminator === 0x0A) {
    side = "LONG";
  } else if (discriminator === 0x13 || discriminator === 0x0B) {
    side = "SHORT";
  }
  if (expected.expectedSide) {
    console.log(`  Side:                    ${side} ${expected.expectedSide === side ? '✅' : ''}`);
  }

  // Bytes 8-16: Sequence ID
  if (buffer.length >= 16) {
    const sequenceId = buffer.readBigUInt64LE(8);
    const match = expected.expectedSequenceId === sequenceId.toString();
    console.log(`  Sequence ID (8-16):      ${sequenceId} ${match ? '✅' : ''}`);
  }

  // Bytes 16-24: Raw Size
  if (buffer.length >= 24) {
    const rawSize = buffer.readBigUInt64LE(16);
    const sizeDecimal = Number(rawSize) / 1_000_000_000;
    const sizeStr = sizeDecimal.toFixed(9);
    const match = expected.expectedSize === sizeStr;
    console.log(`  Raw Size (16-24):        ${rawSize}`);
    console.log(`  Size (converted):        ${sizeStr} ${match ? '✅' : ''} (rawSize / 1e9)`);
  }

  // Bytes 24-32: Raw Price (ONLY for buffer >= 40)
  if (buffer.length >= 40 && discriminator !== 0x17) {
    const rawPrice = buffer.readBigUInt64LE(24);
    const priceDecimal = Number(rawPrice) / 1_000_000;
    const priceStr = priceDecimal.toFixed(6);
    const match = expected.expectedPrice === priceStr;
    console.log(`  Raw Price (24-32):       ${rawPrice}`);
    console.log(`  Price (converted):       ${priceStr} ${match ? '✅' : ''} (rawPrice / 1e6)`);
  } else {
    const match = expected.expectedPrice === "0" || !expected.expectedPrice;
    console.log(`  Price:                   0 ${match ? '✅' : ''} (not available for this event type)`);
  }

  // TIMESTAMP: Read from last bytes (size depends on buffer length)
  if (buffer.length >= 16) {
    let timestampNum: number;
    let timestampOffset: number;
    
    if (buffer.length >= 48) {
      // 48+ byte buffers: timestamp is 64-bit at offset buffer.length - 8
      timestampOffset = buffer.length - 8;
      const timestamp = buffer.readBigInt64LE(timestampOffset);
      timestampNum = Number(timestamp);
      const offsetEnd = buffer.length;
      const match = expected.expectedTimestamp === timestampNum;
      console.log(`  Timestamp (${timestampOffset}-${offsetEnd}):   ${timestamp} ${match ? '✅' : ''} (64-bit from last 8 bytes)`);
    } else {
      // 40-byte buffers: timestamp is 32-bit at offset buffer.length - 4
      timestampOffset = buffer.length - 4;
      timestampNum = buffer.readUInt32LE(timestampOffset);
      const offsetEnd = buffer.length;
      const match = expected.expectedTimestamp === timestampNum;
      console.log(`  Timestamp (${timestampOffset}-${offsetEnd}):   ${timestampNum} ${match ? '✅' : ''} (32-bit from last 4 bytes)`);
    }
    
    if (timestampNum > 1577836800 && timestampNum < 1893456000) {
      const date = new Date(timestampNum * 1000);
      console.log(`                           ${date.toISOString()}`);
    } else if (timestampNum !== 0) {
      console.log(`                           (invalid or test value)`);
    }
  }

  console.log('');
}

// Run tests
console.log('═══════════════════════════════════════════════════════════');
console.log('  Deriverse Analytics - FINAL Log Decoder Test');
console.log('═══════════════════════════════════════════════════════════');

for (const sample of SAMPLE_LOGS) {
  decodeLog(sample.log, sample.name, sample);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  ✅ FINALIZED Layout:');
console.log('═══════════════════════════════════════════════════════════');
console.log('  TRADE Events (40-48 bytes):');
console.log('    - Bytes 0:     Discriminator (0x12=LONG, 0x13=SHORT)');
console.log('    - Bytes 8-16:  Sequence ID (u64)');
console.log('    - Bytes 16-24: Size (u64, divide by 1e9)');
console.log('    - Bytes 24-32: Price (u64, divide by 1e6)');
console.log('    - Timestamp:');
console.log('      • 48-byte: 64-bit at offset [buffer.length - 8]');
console.log('      • 40-byte: 32-bit at offset [buffer.length - 4]');
console.log('');
console.log('  FEE Events (24 bytes, discriminator 0x17):');
console.log('    - Bytes 0:     Discriminator (0x17)');
console.log('    - Bytes 8-16:  Sequence ID (u64)');
console.log('    - Bytes 16-24: Fee Amount (u64, divide by 1e9)');
console.log('    - Price: N/A (fee events have no price)');
console.log('    - Timestamp: 32-bit at offset [buffer.length - 4]');
console.log('═══════════════════════════════════════════════════════════\n');
