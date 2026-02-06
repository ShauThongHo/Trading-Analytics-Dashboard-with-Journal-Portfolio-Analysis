/**
 * Test script to verify Base64 log decoding logic
 * 
 * This helps validate the parseLog() implementation against known sample data
 * Run with: npx ts-node src/scripts/test-decoder.ts
 */

/**
 * Sample Base64 log from the requirement:
 * EgABAZIDAACusF8AAAAAAADh9QUAAAAAAJc64g8AAAAAAAAAAAAAAGNVhWkAAAAA
 * 
 * Expected values:
 * - timestamp: 0x69855563 (1769855563) at the end
 */
const SAMPLE_LOG = 'EgABAZIDAACusF8AAAAAAADh9QUAAAAAAJc64g8AAAAAAAAAAAAAAGNVhWkAAAAA';

function decodeLog(log: string): void {
  console.log('🔍 Decoding Base64 Log\n');
  console.log(`Input: ${log}\n`);

  const buffer = Buffer.from(log, 'base64');
  console.log(`Buffer length: ${buffer.length} bytes\n`);

  // Display hex dump
  console.log('Hex dump:');
  for (let i = 0; i < buffer.length; i += 8) {
    const chunk = buffer.slice(i, i + 8);
    const hex = chunk.toString('hex').match(/.{2}/g)?.join(' ') || '';
    console.log(`  [${i.toString().padStart(2, '0')}-${(i + 7).toString().padStart(2, '0')}] ${hex}`);
  }
  console.log('');

  // Parse fields
  console.log('Parsed fields:');

  // Bytes 0-8: Discriminator
  const discriminator = buffer.slice(0, 8).toString('hex');
  console.log(`  Discriminator (0-8):   0x${discriminator}`);

  // Bytes 8-16: Size (u64)
  const size = buffer.readBigUInt64LE(8);
  console.log(`  Size (8-16):           ${size} (0x${size.toString(16)})`);

  // Bytes 16-24: Price/Quote (u64)
  const price = buffer.readBigUInt64LE(16);
  console.log(`  Price (16-24):         ${price} (0x${price.toString(16)})`);

  // Bytes 24-32: Unknown field
  if (buffer.length >= 32) {
    const unknown1 = buffer.readBigUInt64LE(24);
    console.log(`  Unknown1 (24-32):      ${unknown1} (0x${unknown1.toString(16)})`);
  }

  // Bytes 32-40: Unknown field
  if (buffer.length >= 40) {
    const unknown2 = buffer.readBigUInt64LE(32);
    console.log(`  Unknown2 (32-40):      ${unknown2} (0x${unknown2.toString(16)})`);
  }

  // Last 8 bytes: Timestamp (i64)
  const timestampOffset = buffer.length - 8;
  const timestamp = buffer.readBigInt64LE(timestampOffset);
  const timestampNum = Number(timestamp);
  const date = new Date(timestampNum * 1000);

  console.log(`  Timestamp (${timestampOffset}-${buffer.length}):    ${timestamp} (0x${timestamp.toString(16)})`);
  console.log(`                         ${timestampNum}`);
  console.log(`                         ${date.toISOString()}`);

  console.log('');

  // Verify expected values
  console.log('✅ Validation:');
  const expectedTimestamp = 0x69855563;
  if (timestampNum === expectedTimestamp) {
    console.log(`  ✓ Timestamp matches expected: ${expectedTimestamp}`);
  } else {
    console.log(`  ✗ Timestamp mismatch! Expected: ${expectedTimestamp}, Got: ${timestampNum}`);
  }

  // JSON serialization test
  console.log('\n🧪 JSON Serialization Test:');
  
  const tradeData = {
    size: size.toString(),
    price: price.toString(),
    timestamp: timestampNum
  };

  try {
    const json = JSON.stringify(tradeData, null, 2);
    console.log('  ✓ JSON serialization successful:');
    console.log(json);
  } catch (error) {
    console.log(`  ✗ JSON serialization failed: ${error}`);
  }
}

// Run test
console.log('═══════════════════════════════════════════════════════');
console.log('  Deriverse Analytics - Log Decoder Test');
console.log('═══════════════════════════════════════════════════════\n');

decodeLog(SAMPLE_LOG);

console.log('\n═══════════════════════════════════════════════════════');
console.log('  Test complete!');
console.log('═══════════════════════════════════════════════════════');
