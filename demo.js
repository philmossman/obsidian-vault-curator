#!/usr/bin/env node
/**
 * Interactive demo of Vault Curator Phase 2
 * Shows all features with live examples
 */

const VaultClient = require('./vault-client');
const { processInbox } = require('./processor');
const loadConfig = require('./config');

async function demo() {
  console.log('🎬 Vault Curator Phase 2 - Interactive Demo\n');
  console.log('='.repeat(60));
  
  const config = loadConfig();
  const vaultClient = new VaultClient(config.couchdb);
  
  try {
    // Demo 1: Show vault stats
    console.log('\n📊 Demo 1: Vault Statistics');
    console.log('-'.repeat(60));
    const allNotes = await vaultClient.listNotes();
    const inboxNotes = allNotes.filter(n => n.path.startsWith('inbox/'));
    
    console.log(`Total notes in vault: ${allNotes.length}`);
    console.log(`Notes in inbox: ${inboxNotes.length}`);
    
    // Show folder distribution
    const folders = {};
    allNotes.forEach(note => {
      const folder = note.path.includes('/') 
        ? note.path.split('/')[0] 
        : 'root';
      folders[folder] = (folders[folder] || 0) + 1;
    });
    
    console.log('\nFolder distribution:');
    Object.entries(folders)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([folder, count]) => {
        console.log(`  ${folder}: ${count} notes`);
      });
    
    // Demo 2: Show unprocessed notes
    console.log('\n\n📝 Demo 2: Unprocessed Notes in Inbox');
    console.log('-'.repeat(60));
    
    let unprocessed = 0;
    for (const noteInfo of inboxNotes.slice(0, 5)) {
      const note = await vaultClient.readNote(noteInfo.path);
      if (!note) continue;
      
      const { frontmatter } = vaultClient.parseFrontmatter(note.content);
      if (!frontmatter.processed) {
        unprocessed++;
        console.log(`\n${unprocessed}. ${noteInfo.path}`);
        console.log(`   Created: ${frontmatter.created || 'unknown'}`);
        console.log(`   Source: ${frontmatter.source || 'unknown'}`);
        console.log(`   Preview: ${note.content.slice(0, 100)}...`);
      }
    }
    
    if (unprocessed === 0) {
      console.log('No unprocessed notes found (try /process force to reprocess)');
    }
    
    // Demo 3: Unicode sanitization
    console.log('\n\n🔤 Demo 3: Unicode Sanitization');
    console.log('-'.repeat(60));
    
    const { sanitizeUnicode } = require('./vault-client');
    const testStrings = [
      '✅ Task complete',
      '🔥 Hot topic',
      '📝 Note taking',
      '💡 Great idea!',
      'Regular text without emojis'
    ];
    
    testStrings.forEach(str => {
      const sanitized = sanitizeUnicode(str);
      console.log(`Original:  ${str}`);
      console.log(`Sanitized: ${sanitized}\n`);
    });
    
    // Demo 4: Frontmatter parsing
    console.log('\n📋 Demo 4: Frontmatter Parsing');
    console.log('-'.repeat(60));
    
    const sampleNote = `---
created: 2026-02-10T09:00:00Z
source: telegram
tags: [work, urgent, photography]
priority: 5
completed: false
---

This is the note body.`;

    const { frontmatter, body } = vaultClient.parseFrontmatter(sampleNote);
    console.log('Parsed frontmatter:');
    console.log(JSON.stringify(frontmatter, null, 2));
    console.log('\nBody:');
    console.log(body);
    
    // Demo 5: Offer to run processor
    console.log('\n\n🤖 Demo 5: AI Processing');
    console.log('-'.repeat(60));
    console.log('Ready to process notes with AI!');
    console.log('\nTo process inbox:');
    console.log('  node telegram-processor.js /process limit=2 dryrun');
    console.log('\nOr programmatically:');
    console.log('  const results = await processInbox({ limit: 2, dryRun: true });');
    
    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('✅ Demo Complete!');
    console.log('='.repeat(60));
    console.log('\nWhat you learned:');
    console.log('  ✅ Vault statistics and folder distribution');
    console.log('  ✅ Finding unprocessed notes');
    console.log('  ✅ Unicode sanitization (emoji handling)');
    console.log('  ✅ Frontmatter parsing');
    console.log('  ✅ How to run the processor');
    console.log('\nNext steps:');
    console.log('  📖 Read QUICKSTART.md for usage guide');
    console.log('  🧪 Run npm test to see all tests');
    console.log('  🚀 Process your inbox with /process');
    console.log('');
    
  } catch (err) {
    console.error('\n❌ Demo failed:', err.message);
    console.error('\nMake sure:');
    console.error('  • CouchDB is running (http://localhost:5984)');
    console.error('  • Config is correct (check config.json)');
    console.error('  • LiveSync E2EE is disabled');
    process.exit(1);
  }
}

// Run demo
demo();
