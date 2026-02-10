#!/usr/bin/env node
/**
 * Test suite for processor functionality
 * Tests vault client, AI client, and processor
 */

const VaultClient = require('./vault-client');
const { sanitizeUnicode } = require('./vault-client');
const { analyzeNote, buildPrompt } = require('./ai-client');
const { processInbox, refreshVaultStructure } = require('./processor');
const loadConfig = require('./config');

// Test counter
let tests = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests++;
  process.stdout.write(`Test ${tests}: ${name}... `);
  try {
    fn();
    passed++;
    console.log('✅ PASS');
  } catch (err) {
    failed++;
    console.log('❌ FAIL');
    console.error('  Error:', err.message);
  }
}

async function asyncTest(name, fn) {
  tests++;
  process.stdout.write(`Test ${tests}: ${name}... `);
  try {
    await fn();
    passed++;
    console.log('✅ PASS');
  } catch (err) {
    failed++;
    console.log('❌ FAIL');
    console.error('  Error:', err.message);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Values not equal'}: expected ${expected}, got ${actual}`);
  }
}

// ===== Unit Tests =====

console.log('🧪 Running Vault Curator Processor Tests\n');

// Test 1: Config loading
test('Config loads with defaults', () => {
  const config = loadConfig();
  assert(config.couchdb, 'Config should have couchdb section');
  assert(config.processor, 'Config should have processor section');
  assertEqual(config.couchdb.host, '127.0.0.1', 'Default host should be localhost');
  assertEqual(config.couchdb.database, 'obsidian', 'Default database should be obsidian');
});

// Test 2: Unicode sanitization
test('Unicode sanitization removes emojis', () => {
  const input = 'Hello ✅ World 🔥 Test';
  const output = sanitizeUnicode(input);
  assertEqual(output, 'Hello [DONE] World [HOT] Test', 'Emojis should be replaced');
  assert(!output.match(/[\u{1F300}-\u{1F9FF}]/gu), 'Should not contain emoji ranges');
});

test('Unicode sanitization handles multiple emojis', () => {
  const input = '📝 Note 💡 Idea 🎯 Target';
  const output = sanitizeUnicode(input);
  assertEqual(output, '[NOTE] Note [IDEA] Idea [TARGET] Target', 'All emojis should be replaced');
});

// Test 3: Frontmatter parsing
test('Parse frontmatter with simple values', () => {
  const vaultClient = new VaultClient({ host: 'dummy', port: 0, database: 'dummy', username: '', password: '' });
  const content = `---
created: 2026-02-10T09:00:00Z
source: telegram
processed: false
---

This is the body`;
  
  const { frontmatter, body } = vaultClient.parseFrontmatter(content);
  assertEqual(frontmatter.created, '2026-02-10T09:00:00Z', 'Created should be parsed');
  assertEqual(frontmatter.source, 'telegram', 'Source should be parsed');
  assertEqual(frontmatter.processed, false, 'Boolean should be parsed');
  assert(body.includes('This is the body'), 'Body should be extracted');
});

test('Parse frontmatter with arrays', () => {
  const vaultClient = new VaultClient({ host: 'dummy', port: 0, database: 'dummy', username: '', password: '' });
  const content = `---
tags: [work, personal, urgent]
---

Body content`;
  
  const { frontmatter } = vaultClient.parseFrontmatter(content);
  assert(Array.isArray(frontmatter.tags), 'Tags should be an array');
  assertEqual(frontmatter.tags.length, 3, 'Should have 3 tags');
  assertEqual(frontmatter.tags[0], 'work', 'First tag should be work');
});

test('Parse content without frontmatter', () => {
  const vaultClient = new VaultClient({ host: 'dummy', port: 0, database: 'dummy', username: '', password: '' });
  const content = 'Just plain content without frontmatter';
  
  const { frontmatter, body } = vaultClient.parseFrontmatter(content);
  assertEqual(Object.keys(frontmatter).length, 0, 'Frontmatter should be empty');
  assertEqual(body, content, 'Body should be original content');
});

// Test 4: Build note from frontmatter
test('Build note with frontmatter', () => {
  const vaultClient = new VaultClient({ host: 'dummy', port: 0, database: 'dummy', username: '', password: '' });
  const frontmatter = {
    created: '2026-02-10T09:00:00Z',
    source: 'telegram',
    processed: true,
    tags: ['work', 'urgent']
  };
  const body = 'This is the body';
  
  const content = vaultClient.buildNote(frontmatter, body);
  assert(content.startsWith('---'), 'Should start with frontmatter delimiter');
  assert(content.includes('created: 2026-02-10T09:00:00Z'), 'Should include created field');
  assert(content.includes('tags: [work, urgent]'), 'Should include tags array');
  assert(content.includes('This is the body'), 'Should include body');
});

test('Build note without frontmatter', () => {
  const vaultClient = new VaultClient({ host: 'dummy', port: 0, database: 'dummy', username: '', password: '' });
  const body = 'Just the body';
  
  const content = vaultClient.buildNote({}, body);
  assertEqual(content, body, 'Should return just the body');
});

// Test 5: Prompt building
test('Build analysis prompt', () => {
  const note = {
    path: 'inbox/test.md',
    body: 'This is a test note about project management'
  };
  const vaultStructure = {
    folders: [
      { path: 'Projects', count: 10 },
      { path: 'Reference', count: 5 }
    ],
    tags: { work: 20, personal: 15 }
  };
  
  const prompt = buildPrompt(note, vaultStructure);
  assert(prompt.includes('inbox/test.md'), 'Should include note path');
  assert(prompt.includes('project management'), 'Should include note content');
  assert(prompt.includes('Projects'), 'Should include folder names');
  assert(prompt.includes('work'), 'Should include tag names');
  assert(prompt.includes('JSON'), 'Should request JSON output');
});

// ===== Integration Tests =====

console.log('\n🔗 Integration Tests (require CouchDB)\n');

asyncTest('Connect to CouchDB and list notes', async () => {
  const config = loadConfig();
  const vaultClient = new VaultClient(config.couchdb);
  
  const notes = await vaultClient.listNotes();
  assert(Array.isArray(notes), 'Should return an array');
  console.log(`  Found ${notes.length} notes in vault`);
});

asyncTest('Read a note from vault', async () => {
  const config = loadConfig();
  const vaultClient = new VaultClient(config.couchdb);
  
  const notes = await vaultClient.listNotes();
  if (notes.length === 0) {
    console.log('  ⚠️  No notes to test with, skipping');
    return;
  }
  
  const firstNote = notes[0];
  const note = await vaultClient.readNote(firstNote.path);
  
  assert(note, 'Should return a note object');
  assert(note.content, 'Note should have content');
  assert(note.path === firstNote.path, 'Path should match');
  console.log(`  Read note: ${note.path} (${note.content.length} bytes)`);
});

asyncTest('Test Unicode sanitization in real note', async () => {
  const config = loadConfig();
  const vaultClient = new VaultClient(config.couchdb);
  
  // Create a test note with emojis
  const testPath = 'inbox/test-unicode.md';
  const testContent = `---
created: ${new Date().toISOString()}
source: test
---

Test note with emojis ✅ 🔥 📝`;
  
  try {
    // Write with sanitization
    await vaultClient.writeNote(testPath, testContent);
    console.log('  ✅ Created test note with Unicode');
    
    // Read it back
    const note = await vaultClient.readNote(testPath);
    assert(note, 'Should be able to read note back');
    assert(note.content.includes('[DONE]'), 'Emojis should be sanitized');
    console.log('  ✅ Unicode was properly sanitized');
    
    // Clean up
    await vaultClient.deleteNote(testPath);
    console.log('  🧹 Cleaned up test note');
  } catch (err) {
    // Clean up on error
    try {
      await vaultClient.deleteNote(testPath);
    } catch (e) {
      // Ignore cleanup errors
    }
    throw err;
  }
});

// ===== Run Tests =====

(async () => {
  // Wait for async tests
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Test Results:');
  console.log(`   Total: ${tests}`);
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('='.repeat(50));
  
  if (failed > 0) {
    process.exit(1);
  }
})();
