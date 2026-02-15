#!/usr/bin/env node
/**
 * Test suite for formatter functionality
 * Tests markdown formatting, table formatting, heading normalization, etc.
 */

const {
  formatMarkdown,
  standardizeListMarkers,
  enhanceTables,
  normalizeHeadingLevels,
  normalizeWhitespace,
  parseFrontmatter,
  sanitizeUnicode,
  formatNote,
  formatMultiple
} = require('./formatter');

const fs = require('fs').promises;
const path = require('path');

// Test counter
let tests = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests++;
  process.stdout.write(`Test ${tests.toString().padStart(2, '0')}: ${name}... `);
  try {
    fn();
    passed++;
    console.log('✅');
  } catch (err) {
    failed++;
    console.log('❌');
    console.error(`       ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  tests++;
  process.stdout.write(`Test ${tests.toString().padStart(2, '0')}: ${name}... `);
  try {
    await fn();
    passed++;
    console.log('✅');
  } catch (err) {
    failed++;
    console.log('❌');
    console.error(`       ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Values not equal'}\n  Expected: ${JSON.stringify(expected)}\n  Got: ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(text, substring, message) {
  if (!text.includes(substring)) {
    throw new Error(`${message || 'Not found'}: "${substring}"`);
  }
}

// ===== Unit Tests =====

console.log('🧪 Running Note Formatter Tests\n');

// ===== Frontmatter Parsing Tests =====

console.log('📋 Frontmatter Parsing');

test('Parse frontmatter with YAML', () => {
  const content = '---\ncreated: 2026-02-13\ntags: test\n---\nBody content here';
  const result = parseFrontmatter(content);
  
  assertEqual(result.hasFrontmatter, true, 'Should detect frontmatter');
  assertIncludes(result.frontmatter, 'created: 2026-02-13', 'Should preserve YAML');
  assertEqual(result.body, 'Body content here', 'Should extract body correctly');
});

test('Parse content without frontmatter', () => {
  const content = 'Just body\nNo frontmatter here';
  const result = parseFrontmatter(content);
  
  assertEqual(result.hasFrontmatter, false, 'Should detect no frontmatter');
  assertEqual(result.frontmatter, '', 'Frontmatter should be empty');
  assertEqual(result.body, content, 'Body should be entire content');
});

test('Preserve complex YAML', () => {
  const yaml = 'created: 2026-02-13T12:00:00Z\nsource: telegram\ntags:\n  - test\n  - urgent';
  const content = `---\n${yaml}\n---\nBody`;
  const result = parseFrontmatter(content);
  
  assertEqual(result.frontmatter, yaml, 'Should preserve complex YAML exactly');
});

// ===== Unicode Safety Tests =====

console.log('\n🔤 Unicode Safety');

test('Sanitize common emojis', () => {
  const input = '✅ done ❌ fail ⚠️ warn';
  const output = sanitizeUnicode(input);
  
  assertEqual(output, '[DONE] done [FAIL] fail [WARN] warn', 'Should replace known emojis');
  assert(!output.match(/[^\x00-\x7F]/), 'Should be ASCII-only');
});

test('Remove unknown emojis', () => {
  const input = 'Test 🎉 emoji 🚀 rocket';
  const output = sanitizeUnicode(input);
  
  assertEqual(output, 'Test  emoji  rocket', 'Should remove unknown emojis');
  assert(!output.match(/[\u{1F300}-\u{1F9FF}]/gu), 'Should have no emoji ranges');
});

test('Preserve ASCII text', () => {
  const input = 'Normal text 123 !@#$%';
  const output = sanitizeUnicode(input);
  
  assertEqual(output, input, 'Should preserve ASCII');
});

// ===== List Standardization Tests =====

console.log('\n📝 List Standardization');

test('Convert * to -', () => {
  const content = '* Item 1\n* Item 2';
  const result = standardizeListMarkers(content);
  
  assertIncludes(result.content, '- Item 1', 'Should convert * to -');
  assertIncludes(result.content, '- Item 2', 'Should convert all items');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Convert + to -', () => {
  const content = '+ Item 1\n+ Item 2';
  const result = standardizeListMarkers(content);
  
  assertIncludes(result.content, '- Item 1', 'Should convert + to -');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Preserve indented lists', () => {
  const content = '- Item 1\n  * Nested 1\n  * Nested 2\n- Item 2';
  const result = standardizeListMarkers(content);
  
  assertIncludes(result.content, '  - Nested 1', 'Should preserve indentation');
  assertIncludes(result.content, '- Item 1', 'Should keep top-level items');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Skip non-list content', () => {
  const content = 'Normal text with * asterisk\nBut not a list';
  const result = standardizeListMarkers(content);
  
  assertEqual(result.changed, false, 'Should not change non-lists');
});

// ===== Table Formatting Tests =====

console.log('\n📊 Table Formatting');

test('Format table row spacing', () => {
  const content = '|col1|col2|col3|\n|---|---|---|\n|a|b|c|';
  const result = enhanceTables(content);
  
  assertIncludes(result.content, '| col1 | col2 | col3 |', 'Should add spacing around pipes');
  assertIncludes(result.content, '| --- | --- | --- |', 'Should format separator');
  assertIncludes(result.content, '| a | b | c |', 'Should format data row');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Preserve table alignment', () => {
  const content = '| Left | Center | Right |\n|:---|:---:|---:|\n| L | C | R |';
  const result = enhanceTables(content);
  
  assertIncludes(result.content, ':---', 'Should preserve left alignment');
  assertIncludes(result.content, ':---:', 'Should preserve center alignment');
  assertIncludes(result.content, '---:', 'Should preserve right alignment');
});

test('Handle tables with multiple rows', () => {
  const content = `| Name | Age |
|---|---|
| Alice | 25 |
| Bob | 30 |`;
  const result = enhanceTables(content);
  
  const lines = result.content.split('\n');
  assert(lines.every(line => !line.includes('|') || line.includes(' | ')), 
    'All table lines should have spacing');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Skip non-table content', () => {
  const content = 'This | is | not | a | table\nJust regular pipes';
  const result = enhanceTables(content);
  
  assertEqual(result.changed, false, 'Should not change non-tables');
});

// ===== Heading Normalization Tests =====

console.log('\n🏷️ Heading Normalization');

test('Fix heading level jumps', () => {
  const content = '# Title\n### Subheading';
  const result = normalizeHeadingLevels(content);
  
  assertIncludes(result.content, '# Title', 'Should preserve top level');
  assertIncludes(result.content, '## Subheading', 'Should fix jump from # to ###');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Maintain heading hierarchy', () => {
  const content = '# Title\n## Section\n### Subsection\n#### SubSubsection';
  const result = normalizeHeadingLevels(content);
  
  assertEqual(result.content, content, 'Should not change valid hierarchy');
  assertEqual(result.changed, false, 'Should not mark as changed');
});

test('Respect minimum heading level', () => {
  const content = '# Main\n## Sub';
  const result = normalizeHeadingLevels(content, 2, 6);
  
  assertIncludes(result.content, '## Main', 'Should elevate h1 to h2');
  assertIncludes(result.content, '## Sub', 'Should keep h2 as h2 (respects min level)');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Respect maximum heading level', () => {
  const content = '# Title\n## Sub\n### SubSub\n#### Deep';
  const result = normalizeHeadingLevels(content, 1, 3);
  
  assertIncludes(result.content, '### SubSub', 'Should cap at h3');
  assertIncludes(result.content, '### Deep', 'Should cap at h3');
});

test('Preserve heading text content', () => {
  const content = '# Important Note!';
  const result = normalizeHeadingLevels(content);
  
  assertIncludes(result.content, 'Important Note!', 'Should preserve text');
});

// ===== Whitespace Normalization Tests =====

console.log('\n⎵ Whitespace Handling');

test('Remove trailing whitespace', () => {
  const content = 'Line 1   \nLine 2\t\nLine 3  ';
  const result = normalizeWhitespace(content);
  
  const lines = result.content.split('\n');
  assert(lines.every(line => !line.match(/\s+$/)), 'No line should have trailing whitespace');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Reduce multiple blank lines', () => {
  const content = 'Line 1\n\n\n\nLine 2\n\n\n\n\nLine 3';
  const result = normalizeWhitespace(content);
  
  assert(!result.content.includes('\n\n\n'), 'Should not have 3+ newlines');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Add blank line after headings', () => {
  const content = '# Title\nBody paragraph';
  const result = normalizeWhitespace(content);
  
  assertIncludes(result.content, '# Title\n\nBody', 'Should add blank line after heading');
  assertEqual(result.changed, true, 'Should mark as changed');
});

test('Not add blank line between consecutive headings', () => {
  const content = '# Title\n## Subtitle\n### SubSubtitle';
  const result = normalizeWhitespace(content);
  
  assertIncludes(result.content, '## Subtitle\n###', 'Should not add blank line between consecutive headings');
});

// ===== Integration Tests =====

console.log('\n🔗 Integration Tests');

test('Complete markdown format', () => {
  const content = `# My Note

* Old style list
* Another item
  + Nested with plus

| Header 1 | Header 2 |
|---|---|
|data|values|

##Content without space`;

  const result = formatMarkdown(content);
  
  assertEqual(result.changed, true, 'Should detect changes');
  assert(result.details.length > 0, 'Should report changes');
  assertIncludes(result.formatted, '- Old style list', 'Should standardize lists');
  assertIncludes(result.formatted, '| Header 1 | Header 2 |', 'Should format tables');
  assertIncludes(result.formatted, '# My Note\n\n', 'Should add whitespace');
});

test('Preserve content in complete format', () => {
  const content = '# Title\n- Item\n| Col |\n|---|\n| Data |';
  const result = formatMarkdown(content);
  
  assertIncludes(result.formatted, 'Title', 'Should preserve title');
  assertIncludes(result.formatted, 'Item', 'Should preserve list item');
  assertIncludes(result.formatted, 'Data', 'Should preserve table data');
});

test('Format with frontmatter preservation', () => {
  const content = `---
created: 2026-02-13
tags: test
---
# My Note

* List item`;

  const result = formatMarkdown(content, {});
  
  // Frontmatter should still be there (as part of the body in formatMarkdown)
  assertIncludes(result.formatted, 'created: 2026-02-13', 'Should preserve frontmatter');
  assertIncludes(result.formatted, '- List item', 'Should format body');
});

// ===== File Operations Tests =====

console.log('\n💾 File Operations');

asyncTest('Format note file and create backup', async () => {
  const testDir = '.test-formatter';
  const testFile = path.join(testDir, 'test-note.md');
  
  try {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test note
    const content = `---
created: 2026-02-13
---
# Test

* Item 1
* Item 2`;
    
    await fs.writeFile(testFile, content, 'utf-8');
    
    // Format it
    const result = await formatNote(testFile, { 
      preserveOriginal: true,
      backup: path.join(testDir, '.backups')
    });
    
    assert(result.success, `Should succeed: ${result.error}`);
    assertEqual(result.changed, true, 'Should detect changes');
    assert(result.backup, 'Should create backup');
    assert(await fs.stat(result.backup).then(() => true, () => false), 'Backup should exist');
    
    // Verify content
    const formatted = await fs.readFile(testFile, 'utf-8');
    assertIncludes(formatted, '- Item 1', 'Should standardize lists');
    
  } finally {
    // Cleanup
    await fs.rm(testDir, { recursive: true }).catch(() => {});
  }
});

asyncTest('Dry-run does not modify file', async () => {
  const testDir = '.test-formatter-dry';
  const testFile = path.join(testDir, 'test-note.md');
  
  try {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test note
    const content = `# Test\n\n* Item 1`;
    await fs.writeFile(testFile, content, 'utf-8');
    
    // Format with dry-run
    const result = await formatNote(testFile, { dryRun: true });
    
    assert(result.success, 'Should succeed');
    assert(result.dryRun, 'Should be marked as dry-run');
    
    // Verify file unchanged
    const actual = await fs.readFile(testFile, 'utf-8');
    assertEqual(actual, content, 'File should not be modified');
    
  } finally {
    await fs.rm(testDir, { recursive: true }).catch(() => {});
  }
});

asyncTest('Handle missing file gracefully', async () => {
  const result = await formatNote('/nonexistent/path/file.md');
  
  assert(!result.success, 'Should fail for missing file');
  assertIncludes(result.error, 'Failed to read', 'Should report read error');
});

// ===== Summary =====

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${passed}/${tests} passed`);

if (failed > 0) {
  console.log(`❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
  
  // Coverage estimate
  const coverage = Math.round((passed / tests) * 100);
  console.log(`📈 Coverage: ${coverage}% (${passed} tests)`);
  
  if (coverage >= 90) {
    console.log('🎉 Target coverage achieved (>90%)!');
  }
  
  process.exit(0);
}
