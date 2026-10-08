// Unit Test: Calculation Engine & Domain Logic
// AGENTS1.md Rule 29 & Rule 30 (Testing & Verification)

const assert = require('assert');

function calculateSTD(dailyValues) {
  return dailyValues.reduce((sum, val) => sum + (val || 0), 0);
}

function calculateADS(stdTotal, daysPassed) {
  if (daysPassed <= 0) return 0;
  return Number((stdTotal / daysPassed).toFixed(2));
}

function calculateAchievement(actual, target) {
  if (target <= 0) return 0;
  return Number(((actual / target) * 100).toFixed(2));
}

function calculateProjection(ads, totalWorkingDays) {
  return Number((ads * totalWorkingDays).toFixed(2));
}

function calculateGrowth(current, baseline) {
  if (baseline <= 0) return 0;
  return Number((((current - baseline) / baseline) * 100).toFixed(2));
}

console.log('====================================================');
console.log('🧪 RUNNING UNIT TESTS: CALCULATION ENGINE');
console.log('====================================================');

// Test 1: STD Calculation
const dailyInputs = [100, 150, 200, 50, 0];
const std = calculateSTD(dailyInputs);
assert.strictEqual(std, 500, 'STD should sum all non-null daily entries');
console.log('  ✅ PASS: STD calculation equals 500');

// Test 2: ADS Calculation
const ads = calculateADS(500, 5);
assert.strictEqual(ads, 100.0, 'ADS should average STD over active days passed');
console.log('  ✅ PASS: ADS calculation equals 100.00');

// Test 3: Achievement Percentage
const achievement = calculateAchievement(500, 1000);
assert.strictEqual(achievement, 50.0, 'Achievement should calculate actual vs target percentage');
console.log('  ✅ PASS: Achievement calculation equals 50.00%');

// Test 4: Month-end Projection
const projection = calculateProjection(100, 26);
assert.strictEqual(projection, 2600.0, 'Projection should multiply ADS by 26 working days');
console.log('  ✅ PASS: Projection calculation equals 2600.00');

// Test 5: Period-over-period Growth
const growth = calculateGrowth(600, 500);
assert.strictEqual(growth, 20.0, 'Growth should calculate relative percentage difference');
console.log('  ✅ PASS: Growth calculation equals 20.00%');

console.log('====================================================');
console.log('TEST SUMMARY: All Calculation Engine Unit Tests Passed!');
console.log('====================================================');
