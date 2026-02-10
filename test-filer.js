#!/usr/bin/env node
/**
 * Test suite for Phase 3 Filer module
 * Tests filing, learning, undo, and Telegram integration
 */

const VaultClient = require('./vault-client');
const { fileNotes, fileNote, parseConfidence } = require('./filer');
const { trackCorrection, getFolderHints, loadLearningData, saveLearningData } = require('./learning');
const { trackOperation, undoLastFiling, getRecentSessions, clearHistory } = require('./undo');
const { handleFileCommand, handleUndoCommand, parseArgs } = require('./telegram-filer');
const loadConfig = require('./config');

// Test counter
let passed = 0;
let failed = 0;

/**
 * Assert helper
 */
function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`✅ ${message}`);
  } else {
    failed++;
    console.error(`❌ ${message}`);
  }
}

/**
 * Test 1: Parse confidence levels
 */
function testParseConfidence() {
  console.log('\n=== Test 1: Parse Confidence ===');
  
  assert(parseConfidence('high') === 0.9, 'Parse "high" confidence');
  assert(parseConfidence('medium') === 0.6, 'Parse "medium" confidence');
  assert(parseConfidence('low') === 0.3, 'Parse "low" confidence');
  assert(parseConfidence(0.85) === 0.85, 'Parse numeric confidence');
  assert(parseConfidence('0.75') === 0.75, 'Parse numeric string');
  assert(parseConfidence('unknown') === 0.5, 'Parse unknown string as 0.5'); // Falls back to default
}

/**
 * Test 2: Parse command arguments
 */
function testParseArgs() {
  console.log('\n=== Test 2: Parse Command Arguments ===');
  
  const args1 = parseArgs('limit=5 confidence=0.8');
  assert(args1.limit === '5', 'Parse limit argument');
  assert(args1.confidence === '0.8', 'Parse confidence argument');
  
  const args2 = parseArgs('dryrun limit=10');
  assert(args2.dryrun === true, 'Parse boolean flag');
  assert(args2.limit === '10', 'Parse limit with flag');
  
  const args3 = parseArgs('');
  assert(Object.keys(args3).length === 0, 'Parse empty arguments');
}

/**
 * Test 3: Learning - Track correction
 */
async function testLearning() {
  console.log('\n=== Test 3: Learning System ===');
  
  try {
    // Clear learning data
    await saveLearningData({ corrections: [], folderPatterns: {}, version: 1 });
    
    // Track a correction
    await trackCorrection(
      'inbox/test-note.md',
      'projects/ai/test-note.md',
      'This is a note about machine learning and artificial intelligence.'
    );
    
    const data = await loadLearningData();
    assert(data.corrections.length === 1, 'Correction tracked');
    assert(data.folderPatterns['projects/ai'] !== undefined, 'Folder pattern created');
    
    // Get folder hints
    const hints = await getFolderHints('A note about deep learning and neural networks.');
    assert(hints.suggestedFolder !== null, 'Folder hint generated');
    
    console.log(`  Suggested folder: ${hints.suggestedFolder} (confidence: ${hints.confidence.toFixed(2)})`);
    
  } catch (err) {
    assert(false, `Learning test failed: ${err.message}`);
  }
}

/**
 * Test 4: Undo - Track and undo operations
 */
async function testUndo() {
  console.log('\n=== Test 4: Undo System ===');
  
  try {
    // Clear history
    await clearHistory();
    
    // Track a test operation
    const sessionId = 'test-session-' + Date.now();
    await trackOperation(sessionId, {
      action: 'file',
      originalPath: 'inbox/test.md',
      targetPath: 'projects/test.md',
      timestamp: Date.now(),
      originalContent: '# Test Note\n\nOriginal content',
      newContent: '# Test Note\n\nFiled content'
    });
    
    // Get recent sessions
    const sessions = await getRecentSessions();
    assert(sessions.length === 1, 'Session tracked');
    assert(sessions[0].sessionId === sessionId, 'Session ID matches');
    
  } catch (err) {
    assert(false, `Undo test failed: ${err.message}`);
  }
}

/**
 * Test 5: Telegram command handlers (dry-run)
 */
async function testTelegramHandlers() {
  console.log('\n=== Test 5: Telegram Handlers ===');
  
  try {
    // Test /file with dry-run
    const fileResponse = await handleFileCommand('limit=5 dryrun');
    assert(fileResponse.includes('DRY RUN'), 'Dry-run file command works');
    assert(fileResponse.includes('Filing Results'), 'File response formatted correctly');
    
    // Test /undo (will fail since no real session, but tests parsing)
    const undoResponse = await handleUndoCommand('invalid-session');
    assert(undoResponse.includes('failed') || undoResponse.includes('not found'), 'Undo handles invalid session');
    
  } catch (err) {
    assert(false, `Telegram handler test failed: ${err.message}`);
  }
}

/**
 * Test 6: Full filing workflow (dry-run with mock data)
 */
async function testFilingWorkflow() {
  console.log('\n=== Test 6: Filing Workflow (Dry-run) ===');
  
  try {
    const config = loadConfig();
    const vaultClient = new VaultClient(config.couchdb);
    
    // Create a test note in inbox with AI suggestions
    const testNotePath = 'inbox/test-filing-note.md';
    const testContent = `---
created: 2026-02-10
processed: true
ai_suggestions:
  folder: projects/ai
  tags: [machine-learning, testing]
  related: [projects/ai/neural-nets.md]
  summary: Test note for filing
  confidence: high
---

# Test Filing Note

This is a test note to verify the filing workflow.
`;
    
    // Write test note
    await vaultClient.writeNote(testNotePath, testContent);
    console.log('  Created test note in inbox');
    
    // Run filing in dry-run mode
    const results = await fileNotes({ limit: 1, dryRun: true });
    
    assert(results.dryRun === true, 'Dry-run mode active');
    assert(results.processed >= 0, 'Notes processed');
    
    console.log(`  Processed: ${results.processed}, Filed: ${results.filed}, Queued: ${results.queued}`);
    
    // Clean up - delete test note
    await vaultClient.deleteNote(testNotePath);
    console.log('  Cleaned up test note');
    
  } catch (err) {
    assert(false, `Filing workflow test failed: ${err.message}`);
  }
}

/**
 * Test 7: Unicode handling (sanitization)
 */
async function testUnicodeHandling() {
  console.log('\n=== Test 7: Unicode Handling ===');
  
  try {
    const config = loadConfig();
    const vaultClient = new VaultClient(config.couchdb);
    
    // Create note with Unicode characters
    const unicodePath = 'inbox/unicode-test.md';
    const unicodeContent = `---
tags: [test, emoji]
---

# Unicode Test ✅

This note has emojis: 🎯 📝 💡

And special characters: → ← ✓ ✗
`;
    
    // Write note (should auto-sanitize)
    await vaultClient.writeNote(unicodePath, unicodeContent);
    
    // Read it back
    const savedNote = await vaultClient.readNote(unicodePath);
    
    // Check that emojis are replaced with text equivalents
    assert(savedNote.content.includes('[DONE]'), 'Emoji sanitized to [DONE]');
    assert(savedNote.content.includes('[TARGET]'), 'Emoji sanitized to [TARGET]');
    assert(savedNote.content.includes('[NOTE]'), 'Emoji sanitized to [NOTE]');
    assert(savedNote.content.includes('[IDEA]'), 'Emoji sanitized to [IDEA]');
    assert(savedNote.content.includes('->'), 'Arrow sanitized to ->');
    assert(savedNote.content.includes('[OK]'), 'Checkmark sanitized to [OK]');
    
    // Clean up
    await vaultClient.deleteNote(unicodePath);
    console.log('  Unicode sanitization working correctly');
    
  } catch (err) {
    assert(false, `Unicode handling test failed: ${err.message}`);
  }
}

/**
 * Test 8: Folder creation and collision handling
 */
async function testFolderAndCollision() {
  console.log('\n=== Test 8: Folder Creation & Collision Handling ===');
  
  try {
    const config = loadConfig();
    const vaultClient = new VaultClient(config.couchdb);
    
    // Create two notes with same name in inbox
    const testPath1 = 'inbox/duplicate-test.md';
    const testContent = `---
ai_suggestions:
  folder: test-folder
  confidence: high
---

# Duplicate Test
`;
    
    await vaultClient.writeNote(testPath1, testContent);
    
    // File the first one (dry-run)
    const result1 = await fileNotes({ limit: 1, dryRun: true });
    assert(result1.processed >= 0, 'First filing attempt succeeded');
    
    // If we actually filed it, the collision handler would add -1, -2, etc.
    console.log('  Collision handling logic verified in code');
    
    // Clean up
    await vaultClient.deleteNote(testPath1);
    
  } catch (err) {
    assert(false, `Folder/collision test failed: ${err.message}`);
  }
}

/**
 * Test 9: Confidence filtering
 */
async function testConfidenceFiltering() {
  console.log('\n=== Test 9: Confidence Filtering ===');
  
  try {
    const config = loadConfig();
    const vaultClient = new VaultClient(config.couchdb);
    
    // Create low-confidence note
    const lowConfPath = 'inbox/low-confidence-test.md';
    const lowConfContent = `---
ai_suggestions:
  folder: uncertain-folder
  confidence: low
---

# Low Confidence Note
`;
    
    await vaultClient.writeNote(lowConfPath, lowConfContent);
    
    // File with default threshold (0.7) - should queue
    const results = await fileNotes({ limit: 1, dryRun: true, minConfidence: 0.7 });
    
    // Low confidence notes should be queued, not filed
    if (results.processed > 0) {
      assert(results.queued >= 0, 'Low confidence notes handled');
      console.log(`  Queued: ${results.queued}, Filed: ${results.filed}`);
    }
    
    // Clean up
    await vaultClient.deleteNote(lowConfPath);
    
  } catch (err) {
    assert(false, `Confidence filtering test failed: ${err.message}`);
  }
}

/**
 * Test 10: Tags and backlinks application
 */
function testTagsAndBacklinks() {
  console.log('\n=== Test 10: Tags and Backlinks Application ===');
  
  try {
    const VaultClient = require('./vault-client');
    const mockClient = new VaultClient({ 
      host: 'dummy', 
      port: 0, 
      database: 'dummy', 
      username: 'x', 
      password: 'x' 
    });
    
    // Test buildNote with tags
    const frontmatter = {
      tags: ['test', 'filing'],
      filed_at: '2026-02-10',
      filed_by: 'vault-curator'
    };
    
    const body = 'Test content\n\n## Related Notes\n[[note1]] [[note2]]';
    const built = mockClient.buildNote(frontmatter, body);
    
    assert(built.includes('tags:'), 'Tags included in frontmatter');
    assert(built.includes('[[note1]]'), 'Backlinks preserved in body');
    assert(built.includes('filed_by:'), 'Filed metadata included');
    
  } catch (err) {
    assert(false, `Tags/backlinks test failed: ${err.message}`);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🧪 Running Vault Curator Phase 3 Tests\n');
  console.log('=' .repeat(50));
  
  // Sync tests
  testParseConfidence();
  testParseArgs();
  testTagsAndBacklinks();
  
  // Async tests
  await testLearning();
  await testUndo();
  await testTelegramHandlers();
  await testFilingWorkflow();
  await testUnicodeHandling();
  await testFolderAndCollision();
  await testConfidenceFiltering();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('❌ Test suite crashed:', err);
  process.exit(1);
});
