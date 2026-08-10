import assert from 'node:assert/strict';
import {
  MAX_REPORT_DETAILS_LENGTH,
  REPORT_REASON_OPTIONS,
  normalizeReportDetails,
} from './reportModel';

assert.equal(REPORT_REASON_OPTIONS.length, 8);
assert.equal(
  new Set(REPORT_REASON_OPTIONS.map((option) => option.value)).size,
  REPORT_REASON_OPTIONS.length,
  'Report reasons must not contain duplicate API values.',
);
assert.equal(normalizeReportDetails('  Useful context  '), 'Useful context');
assert.equal(normalizeReportDetails('   '), null);
assert.equal(MAX_REPORT_DETAILS_LENGTH, 500);

console.log('Report model QA passed.');
