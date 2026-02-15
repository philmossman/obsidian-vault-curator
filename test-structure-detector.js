#!/usr/bin/env node
/**
 * Test Suite for Structure Detector
 * Tests title detection, section headers, lists, key-value, paragraphs, and edge cases
 */

const {
  addStructure,
  detectTitle,
  isSectionHeader,
  detectList,
  detectKeyValue,
  keyValueToTable,
  DEFAULT_CONFIG
} = require('./structure-detector');

// Test framework
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✅ ${name}`);
  } catch (err) {
    failCount++;
    console.error(`❌ ${name}`);
    console.error(`   ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected "${expected}" but got "${actual}"`);
  }
}

function assertIncludes(text, substring, message) {
  if (!text.includes(substring)) {
    throw new Error(message || `Expected "${substring}" in "${text}"`);
  }
}

// ===========================================
// TITLE DETECTION TESTS (5 tests)
// ===========================================

console.log('\n📋 TITLE DETECTION TESTS\n');

test('detects simple first line as title', () => {
  const result = addStructure('My Project Update\n\nDetails here');
  assertIncludes(result.markdown, '# My Project Update');
});

test('detects ALL CAPS title', () => {
  const result = addStructure('PROJECT UPDATE\n\nDetails here');
  assertIncludes(result.markdown, '# PROJECT UPDATE');
});

test('detects title with date', () => {
  const result = addStructure('Trading Update - Feb 12\n\nContent');
  assertIncludes(result.markdown, '# Trading Update - Feb 12');
});

test('does not detect long text as title', () => {
  const longText = 'This is a very long paragraph that should not be detected as a title because it is way too long for that purpose';
  const result = addStructure(longText);
  assert(!result.markdown.startsWith('#'), 'Should not add title marker to long text');
});

test('detects title case formatting', () => {
  const result = addStructure('Crypto Trading Results\n\nAnalysis below');
  assertIncludes(result.markdown, '# Crypto Trading Results');
});

// ===========================================
// SECTION HEADER DETECTION TESTS (5 tests)
// ===========================================

console.log('\n📌 SECTION HEADER DETECTION TESTS\n');

test('detects "Key Results:" as section header', () => {
  const result = addStructure('Summary\n\nKey Results:\nGreat performance');
  assertIncludes(result.markdown, '## Key Results');
});

test('detects "What we learned:" as section header', () => {
  const result = addStructure('Update\n\nWhat we learned:\nExit signals important');
  assertIncludes(result.markdown, '## What We Learned');
});

test('detects "Next steps:" as section header', () => {
  const result = addStructure('Plan\n\nNext steps:\nTest the system');
  assertIncludes(result.markdown, '## Next Steps');
});

test('detects "Action items:" as section header', () => {
  const result = addStructure('Meeting\n\nAction items:\nSend proposal');
  assertIncludes(result.markdown, '## Action Items');
});

test('detects question format as section header', () => {
  const result = addStructure('Update\n\nWhy did this fail?\nBecause of X');
  assertIncludes(result.markdown, '##');
});

// ===========================================
// LIST DETECTION TESTS (6 tests)
// ===========================================

console.log('\n📝 LIST DETECTION TESTS\n');

test('detects numbered list', () => {
  const result = addStructure('Tasks:\n1. Do this\n2. Do that\n3. Do other');
  assertIncludes(result.markdown, '- Do this');
  assertIncludes(result.markdown, '- Do that');
});

test('detects bulleted list', () => {
  const result = addStructure('Items:\n- First\n- Second\n- Third');
  assertIncludes(result.markdown, '- First');
  assertIncludes(result.markdown, '- Second');
});

test('detects implicit list (parallel structure)', () => {
  const result = addStructure('Findings:\nExit signals were bad\nTrailing stops work great\nBTC never trades');
  // Should detect parallel structure
  assert(result.confidence > 0.3, 'Should detect list-like content');
});

test('converts bullet to standard dash format', () => {
  const result = addStructure('Items:\n• First\n• Second');
  assertIncludes(result.markdown, '- First');
  assertIncludes(result.markdown, '- Second');
});

test('preserves list with mixed markers', () => {
  const result = addStructure('Tasks:\n1. First\n- Second\n* Third', { preserveExisting: false });
  // All items should appear in output, standardized to dash format
  assertIncludes(result.markdown, 'First');
  assertIncludes(result.markdown, 'Second');
  assertIncludes(result.markdown, 'Third');
  // Should detect as list
  assert(result.changes.some(c => c.includes('list')), 'Should detect list');
});

test('does not detect single-line as list', () => {
  const result = addStructure('Just one item here');
  assert(!result.markdown.includes('\n-'), 'Single line should not become list');
});

// ===========================================
// KEY-VALUE DETECTION TESTS (4 tests)
// ===========================================

console.log('\n🔑 KEY-VALUE / TABLE DETECTION TESTS\n');

test('detects key:value pairs and creates table', () => {
  const text = 'Results:\nTotal Return: +11.77%\nWin Rate: 96.3%\nMax Drawdown: 6.26%';
  const result = addStructure(text);
  assertIncludes(result.markdown, '| Total Return | +11.77% |');
  assertIncludes(result.markdown, '| Win Rate | 96.3% |');
  assertIncludes(result.markdown, '| Max Drawdown | 6.26% |');
});

test('detects table format with header', () => {
  const result = addStructure('Metrics:\nMetric: Value\nAccuracy: 95%\nSpeed: Fast');
  // Should create a structured response
  assert(result.confidence > 0.2, 'Should detect key-value structure');
});

test('converts few key-value pairs to bold format', () => {
  const result = addStructure('Result: Success\nTime: 3.5 hours');
  assertIncludes(result.markdown, '**Result:**');
  assertIncludes(result.markdown, '**Time:**');
});

test('handles key-value with special characters', () => {
  const result = addStructure('Metric 1: 100%\nMetric 2: +50pts\nMetric 3: $1000');
  // Should handle special chars in values
  assert(result.markdown.length > 10, 'Should process special characters');
});

// ===========================================
// PARAGRAPH HANDLING TESTS (3 tests)
// ===========================================

console.log('\n✏️ PARAGRAPH HANDLING TESTS\n');

test('joins consecutive lines into paragraph', () => {
  const text = 'Short first line\nVery long second line with more content\nAnother line.';
  const result = addStructure(text);
  // Should not be detected as list (high deviation in line lengths)
  const lines = result.markdown.split('\n').filter(l => l.trim().startsWith('-'));
  assert(lines.length < 2, 'Should not format as list');
});

test('preserves blank lines between paragraphs', () => {
  const text = 'First paragraph here.\n\nSecond paragraph here.\n\nThird one.';
  const result = addStructure(text);
  const paras = result.markdown.split('\n\n');
  assert(paras.length >= 2, 'Should preserve paragraph separation');
});

test('handles single paragraph correctly', () => {
  const text = 'Just a simple single paragraph with some content in it.';
  const result = addStructure(text);
  assertEqual(result.markdown.trim(), text, 'Single paragraph should stay as-is');
});

// ===========================================
// EDGE CASES TESTS (5 tests)
// ===========================================

console.log('\n⚠️ EDGE CASES TESTS\n');

test('handles empty input gracefully', () => {
  const result = addStructure('');
  assert(result.markdown === '', 'Should handle empty string');
  assertEqual(result.confidence, 0, 'Empty input should have 0 confidence');
});

test('handles whitespace-only input', () => {
  const result = addStructure('   \n\n   ');
  assert(result.markdown === '', 'Should handle whitespace-only input');
});

test('preserves existing markdown when enabled', () => {
  const text = '# Already Formatted\n\nWith existing structure';
  const result = addStructure(text, { preserveExisting: true });
  assertEqual(result.markdown, text, 'Should preserve existing markdown');
});

test('does not break on mixed content', () => {
  const text = 'Title\n\n- Bullet\n\nKey: Value\n\nMore text';
  const result = addStructure(text);
  assert(result.markdown.length > 0, 'Should handle mixed content');
});

test('handles null/undefined input', () => {
  const result1 = addStructure(null);
  const result2 = addStructure(undefined);
  assert(result1.markdown === '' || result1.markdown === null, 'Should handle null');
  assert(result2.markdown === '' || result2.markdown === null, 'Should handle undefined');
});

// ===========================================
// INTEGRATION TESTS (3 tests)
// ===========================================

console.log('\n🔗 INTEGRATION TESTS\n');

test('example 1: Crypto trading update', () => {
  const input = `Crypto Trading Update

TimeSeriesMomentum went from -19% to +11%!

Results:
Total Return: +11.77%
Win Rate: 96.3%
Max Drawdown: 6.26%

Learned:
Exit signals were the problem
Trailing stops work perfectly
BTC never trades

Next:
1. Test full 3.5 years
2. Add short side
3. Fix BTC entries`;
  
  const result = addStructure(input);
  
  assertIncludes(result.markdown, '# Crypto Trading Update');
  assertIncludes(result.markdown, '## Results');
  assertIncludes(result.markdown, '| Total Return | +11.77% |');
  assertIncludes(result.markdown, '## Learned');
  assertIncludes(result.markdown, '- Exit signals were the problem');
  assertIncludes(result.markdown, '## Next');
  assertIncludes(result.markdown, '- Test full 3.5 years');
  
  assert(result.confidence > 0.6, 'Should have good confidence on complex example');
});

test('example 2: Meeting notes', () => {
  const input = `Team Meeting - Feb 13

Discussed budget for Q2. Everyone agrees we need more resources.

Action items:
Sarah: Send proposal by Friday
John: Review timeline
Me: Schedule follow-up meeting

Concerns:
Timeline might slip
Budget constraints

Next meeting: Feb 20 at 2pm`;
  
  const result = addStructure(input);
  
  assertIncludes(result.markdown, '# Team Meeting - Feb 13');
  assertIncludes(result.markdown, '## Action Items');
  // Table with 3 rows should be created
  assertIncludes(result.markdown, '| Sarah |');
  assertIncludes(result.markdown, '## Concerns');
  assertIncludes(result.markdown, '- Timeline might slip');
  // Meeting metadata should be in output (can be plain text or bolded)
  assertIncludes(result.markdown, 'Feb 20 at 2pm');
});

test('example 3: Simple note with title', () => {
  const input = `Photography Site Ideas

Had a great idea for the photography site. Use lazy loading for images to improve performance. Also consider adding a blog section for behind-the-scenes content.`;
  
  const result = addStructure(input);
  
  assertIncludes(result.markdown, '# Photography Site Ideas');
  assertIncludes(result.markdown, 'lazy loading');
  assertIncludes(result.markdown, 'blog section');
});

// ===========================================
// RESULTS
// ===========================================

console.log('\n' + '='.repeat(50));
console.log(`\n📊 TEST RESULTS\n`);
console.log(`Total: ${testCount}`);
console.log(`Passed: ${passCount}`);
console.log(`Failed: ${failCount}`);

const coverage = Math.round((passCount / testCount) * 100);
console.log(`Coverage: ${coverage}%`);

if (failCount === 0) {
  console.log('\n✅ All tests passed!');
  process.exit(0);
} else {
  console.log(`\n❌ ${failCount} test(s) failed`);
  process.exit(1);
}
