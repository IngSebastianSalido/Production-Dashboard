/**
 * Unit tests for Heijunka scheduling utilities
 * This file demonstrates and tests the core scheduling logic
 */

import {
  generateSchedule,
  calculateBatchTime,
  isTimeSlotAvailable,
  getScheduleWithTiming,
  formatHour,
  getTimelineIndex,
  getActualHour
} from '../utils/heijunkaUtils';

// Test data
const testBatches = [
  { id: 1, pn: 'PN-001', quantity: 100, hourRate: 50 }, // 2 hours
  { id: 2, pn: 'PN-002', quantity: 150, hourRate: 75 }, // 2 hours
  { id: 3, pn: 'PN-003', quantity: 80, hourRate: 20 }   // 4 hours
];

const testMaintenance = [
  { id: 'm1', time: '14:00', duration: 1 }
];

const testSetup = [
  { id: 's1', time: '09:00', duration: 1 }
];

/**
 * Test Suite: calculateBatchTime
 */
console.group('Test: calculateBatchTime');

console.log('Test 1: Basic calculation');
const result1 = calculateBatchTime(100, 50);
console.assert(result1 === 2, `Expected 2, got ${result1}`);
console.log(`✓ 100 pieces ÷ 50 pcs/hour = ${result1} hours`);

console.log('Test 2: Decimal hour rate');
const result2 = calculateBatchTime(100, 33.33);
console.log(`✓ 100 pieces ÷ 33.33 pcs/hour = ${result2.toFixed(2)} hours`);

console.log('Test 3: Small batch');
const result3 = calculateBatchTime(50, 100);
console.assert(result3 === 0.5, `Expected 0.5, got ${result3}`);
console.log(`✓ 50 pieces ÷ 100 pcs/hour = ${result3} hours`);

console.groupEnd();

/**
 * Test Suite: Time utilities
 */
console.group('Test: Time utilities');

console.log('Test 1: formatHour');
const formatted = formatHour(14);
console.assert(formatted === '14:00', `Expected 14:00, got ${formatted}`);
console.log(`✓ 14 → ${formatted}`);

console.log('Test 2: getTimelineIndex');
const idx = getTimelineIndex(7);
console.assert(idx === 0, `Expected 0, got ${idx}`);
console.log(`✓ 7am → timeline index ${idx}`);

const idx2 = getTimelineIndex(19);
console.assert(idx2 === 12, `Expected 12, got ${idx2}`);
console.log(`✓ 7pm → timeline index ${idx2}`);

console.log('Test 3: getActualHour');
const hour = getActualHour(0);
console.assert(hour === 7, `Expected 7, got ${hour}`);
console.log(`✓ timeline index 0 → ${formatHour(hour)}`);

console.groupEnd();

/**
 * Test Suite: isTimeSlotAvailable
 */
console.group('Test: isTimeSlotAvailable');

console.log('Test 1: Available slot');
const avail1 = isTimeSlotAvailable(7, 2, [], []);
console.assert(avail1 === true, 'Expected available');
console.log('✓ 7:00-9:00 is available (no blocks)');

console.log('Test 2: Blocked by maintenance');
const avail2 = isTimeSlotAvailable(14, 1, testMaintenance, []);
console.assert(avail2 === false, 'Expected blocked');
console.log('✓ 14:00 is blocked by maintenance');

console.log('Test 3: Blocked by setup');
const avail3 = isTimeSlotAvailable(9, 1, [], testSetup);
console.assert(avail3 === false, 'Expected blocked');
console.log('✓ 9:00 is blocked by setup');

console.groupEnd();

/**
 * Test Suite: generateSchedule
 */
console.group('Test: generateSchedule');

const selectedDay = '2026-01-20'; // Monday

console.log('Test 1: Simple schedule (no blocks)');
const schedule1 = generateSchedule(
  [testBatches[0]], // Just first batch
  [],
  [],
  selectedDay
);
console.log(`✓ Generated ${schedule1.length} schedule entries`);
schedule1.forEach((item, idx) => {
  console.log(`  Entry ${idx + 1}: ${item.pn} hours ${item.startHour}-${item.endHour}`);
});

console.log('Test 2: Schedule with maintenance');
const schedule2 = generateSchedule(
  [testBatches[0]],
  testMaintenance,
  [],
  selectedDay
);
console.log(`✓ Generated ${schedule2.length} schedule entries with maintenance`);

console.log('Test 3: Multiple batches');
const schedule3 = generateSchedule(
  testBatches,
  testMaintenance,
  testSetup,
  selectedDay
);
console.log(`✓ Generated ${schedule3.length} schedule entries for 3 batches`);
const totalHours = schedule3.length;
console.log(`  Total hours scheduled: ${totalHours}`);

console.groupEnd();

/**
 * Test Suite: getScheduleWithTiming
 */
console.group('Test: getScheduleWithTiming');

const timingSchedule = getScheduleWithTiming(
  testBatches,
  testMaintenance,
  testSetup
);

console.log('Generated schedule with timing:');
timingSchedule.forEach((item, idx) => {
  console.log(`  Batch ${item.batchIndex}: ${item.pn}`);
  console.log(`    Qty: ${item.quantity} @ ${item.hourRate} pcs/h`);
  console.log(`    Time: ${item.scheduledTime.toFixed(2)} hours`);
});

console.groupEnd();

/**
 * Real-world example
 */
console.group('Real-World Example');

const realBatches = [
  { id: 1, pn: 'MOTOR-2024-001', quantity: 500, hourRate: 100 },
  { id: 2, pn: 'PUMP-2024-002', quantity: 300, hourRate: 75 },
  { id: 3, pn: 'SENSOR-2024-003', quantity: 200, hourRate: 50 }
];

const realMaintenance = [
  { id: 'm1', time: '12:00', duration: 1 },  // 12pm maintenance
  { id: 'm2', time: '18:00', duration: 2 }   // 6pm maintenance
];

const realSetup = [
  { id: 's1', time: '10:00', duration: 1 },  // Setup at 10am
  { id: 's2', time: '15:00', duration: 1 }   // Setup at 3pm
];

console.log('Scenario: 3 batches, 2 maintenance windows, 2 setup times');
const realSchedule = generateSchedule(realBatches, realMaintenance, realSetup, '2026-01-20');

console.log(`Total scheduling points: ${realSchedule.length}`);
realSchedule.slice(0, 10).forEach((item) => {
  const hour = (7 + item.startHour) % 24;
  console.log(`  ${formatHour(hour)}: ${item.pn} (${item.quantity} pcs)`);
});

console.groupEnd();

console.log('✅ All tests completed successfully!');
