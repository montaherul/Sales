/**
 * Integration & Domain Test Suite: XLSX Import & Pre-flight Validator
 * Tests Rule 2, 3, 13, 14, 15, 16, 28 from AGENTS.md
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { parseAndValidateXLSX } from '@/lib/excel/import';
import { verifyImportDateSafety, extractDateFromFilename } from '@/lib/excel/date-safety';
import { ExcelImportService } from '@/modules/excel-import';
import { ROLES } from '@/shared/constants';

async function runImportTests() {
  console.log('====================================================');
  console.log('📊 RUNNING TESTS: XLSX IMPORT & DATE SAFETY VALIDATOR');
  console.log('====================================================');

  // Test 1: Date extraction from filename formats
  console.log('[Test 1] Testing Date Extraction from Various Filenames...');
  const f1 = extractDateFromFilename('Daily sales and Closing Stock Information October 6 2026.xlsx');
  assert.deepStrictEqual(f1, { day: 6, month: 10, year: 2026 });
  console.log('  ✅ PASS: "October 6 2026" extracted correctly');

  const f2 = extractDateFromFilename('Daily sales and Closing Stock Information 2026-10-06.xlsx');
  assert.deepStrictEqual(f2, { day: 6, month: 10, year: 2026 });
  console.log('  ✅ PASS: ISO "2026-10-06" extracted correctly');

  const f3 = extractDateFromFilename('Daily sales 06.10.2026.xlsx');
  assert.deepStrictEqual(f3, { day: 6, month: 10, year: 2026 });
  console.log('  ✅ PASS: Dot format "06.10.2026" extracted correctly');

  // Test 2: Date Safety Verification Logic
  console.log('\n[Test 2] Testing Date Safety Conflict Detection (Rule 14)...');
  const safeRes = verifyImportDateSafety({
    applicationDate: '2026-10-06',
    fileName: 'Daily sales and Closing Stock Information October 6 2026.xlsx',
    headerDateText: 'Date:06.10.2026',
    sheetNumber: 6,
  });
  assert.strictEqual(safeRes.isValid, true);
  assert.strictEqual(safeRes.conflicts.length, 0);
  console.log('  ✅ PASS: Matching dates pass date safety check');

  const conflictRes = verifyImportDateSafety({
    applicationDate: '2026-10-07',
    fileName: 'Daily sales and Closing Stock Information October 6 2026.xlsx',
    headerDateText: 'Date:06.10.2026',
    sheetNumber: 7,
  });
  assert.strictEqual(conflictRes.isValid, false);
  assert(conflictRes.conflicts.length >= 1);
  console.log('  ✅ PASS: Conflicting dates blocked with message:', conflictRes.conflicts[0]);

  // Test 3: Parse Authoritative Template excel/TEMPLATE.xlsx
  console.log('\n[Test 3] Parsing Authoritative Template excel/TEMPLATE.xlsx...');
  const templateBuffer = fs.readFileSync(path.join(process.cwd(), 'excel', 'TEMPLATE.xlsx'));
  const parseRes = await parseAndValidateXLSX({
    buffer: templateBuffer,
    fileName: 'Daily sales and Closing Stock Information October 6 2026.xlsx',
    applicationDate: '2026-10-06',
  });

  assert.strictEqual(parseRes.isValid, true, 'Template should be completely valid');
  assert.strictEqual(parseRes.totalSheetsFound, 34, 'Should contain 34 sheets');
  assert.strictEqual(parseRes.records.length, 5, 'Should extract 5 territories');
  assert.strictEqual(parseRes.records[0].territoryName, 'Kerani hat');
  assert.strictEqual(parseRes.records[1].territoryName, 'Satkania');
  assert.strictEqual(parseRes.records[2].territoryName, 'Bandarban');
  assert.strictEqual(parseRes.records[3].territoryName, 'Rajasthali');
  assert.strictEqual(parseRes.records[4].territoryName, 'Dohazari');

  // Verify Tab Resolution & Review Summary for SEARCHED_TAB_MATCH
  assert.strictEqual(parseRes.matchedSheet.matchMethod, 'SEARCHED_TAB_MATCH', 'Should search and find tab 6 when first tab is day 1');
  assert.strictEqual(parseRes.matchedSheet.name, '6', 'Matched worksheet name should be "6"');
  assert.strictEqual(parseRes.matchedSheet.resolvedDate, '2026-10-06', 'Resolved date must match 2026-10-06');
  assert.strictEqual(parseRes.summary.totalRecords, 5, 'Summary total records must equal 5');
  assert(parseRes.summary.totalCigaretteSales >= 0, 'Should have non-negative recalculated cigarette sales');
  assert(parseRes.summary.totalCigaretteStock >= 0, 'Should have non-negative recalculated cigarette stock');
  assert(parseRes.availableSheets.length >= 31, 'Should list available day sheets');
  console.log('  ✅ PASS: 34 sheets verified, SEARCHED_TAB_MATCH found sheet "6", and review summary computed correctly');

  // Test 4: Commit Valid Records
  console.log('\n[Test 4] Testing Commit Import Records (Rule 15 & Rule 16)...');
  const mockActor = {
    id: 'test-admin-uuid',
    email: 'admin@afaztobacco.com',
    role: ROLES.SUPER_ADMIN,
    companyId: '53ea4edf-b686-45cb-816e-b29581847213',
    territoryId: null,
    regionId: null,
    permissions: [],
  };

  const commitRes = await ExcelImportService.commitRecords(
    parseRes.records,
    'Daily sales and Closing Stock Information October 6 2026.xlsx',
    mockActor
  );
  assert.strictEqual(commitRes.count, 5, 'Should commit 5 records');
  console.log('  ✅ PASS: Committed 5 records successfully into submission repository');

  // Test 5: Duplicate Detection on Second Parse
  console.log('\n[Test 5] Testing Duplicate Detection...');
  const secondParse = await parseAndValidateXLSX({
    buffer: templateBuffer,
    fileName: 'Daily sales and Closing Stock Information October 6 2026.xlsx',
    applicationDate: '2026-10-06',
  });
  assert(secondParse.duplicateTerritories.length > 0, 'Should detect previously committed submissions as duplicates');
  assert.strictEqual(secondParse.summary.revisionRecordsCount, 5, 'All 5 records should be flagged as revisions');
  assert.strictEqual(secondParse.summary.newRecordsCount, 0, 'New records count should be 0');
  console.log(`  ✅ PASS: Duplicate detection flagged ${secondParse.duplicateTerritories.length} territories as revisions`);

  // Test 6: FIRST_TAB_MATCH on Single Daily File
  console.log('\n[Test 6] Testing First-Tab Match on Single Daily Workbook...');
  const singleDailyBuffer = fs.readFileSync(path.join(process.cwd(), 'scratch', 'test_daily.xlsx'));
  const firstTabRes = await parseAndValidateXLSX({
    buffer: singleDailyBuffer,
    fileName: 'Daily sales 06.10.2026.xlsx',
    applicationDate: '2026-10-06',
  });
  assert.strictEqual(firstTabRes.isValid, true, 'Single daily workbook should be valid');
  assert.strictEqual(firstTabRes.matchedSheet.matchMethod, 'FIRST_TAB_MATCH', 'Should match on the first tab');
  assert.strictEqual(firstTabRes.matchedSheet.name, 'Daily Report - Day 6');
  assert.strictEqual(firstTabRes.records.length, 5, 'Should extract 5 territories');
  assert(firstTabRes.summary.totalCigaretteSales > 0, 'Single daily sheet should have positive cigarette sales');
  assert(firstTabRes.summary.totalCigaretteStock > 0, 'Single daily sheet should have positive cigarette stock');
  console.log('  ✅ PASS: FIRST_TAB_MATCH verified on single daily sheet "Daily Report - Day 6" with positive sales & stock');

  // Test 7: Auto-detection when applicationDate is not provided
  console.log('\n[Test 7] Testing Date Auto-Detection from Filename...');
  const autoDetectRes = await parseAndValidateXLSX({
    buffer: templateBuffer,
    fileName: 'Daily sales and Closing Stock Information October 6 2026.xlsx',
  });
  assert.strictEqual(autoDetectRes.isValid, true, 'Auto-detected date should be valid');
  assert.strictEqual(autoDetectRes.targetDate, '2026-10-06', 'Date should be auto-detected as 2026-10-06');
  assert.strictEqual(autoDetectRes.matchedSheet.name, '6', 'Should find sheet "6" automatically');
  console.log('  ✅ PASS: Auto-detected date "2026-10-06" and matched sheet "6"');

  // Test 8: Explicit Sheet Selection Override
  console.log('\n[Test 8] Testing Explicit Sheet Selection Override...');
  const explicitRes = await parseAndValidateXLSX({
    buffer: templateBuffer,
    fileName: 'Daily sales and Closing Stock Information October 6 2026.xlsx',
    applicationDate: '2026-10-06',
    sheetName: '6',
  });
  assert.strictEqual(explicitRes.isValid, true);
  assert.strictEqual(explicitRes.matchedSheet.name, '6');
  console.log('  ✅ PASS: Explicit sheet selection "6" honored');

  console.log('====================================================');
  console.log('🎉 ALL EXCEL IMPORT INTEGRATION TESTS PASSED!');
  console.log('====================================================');
}

runImportTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
