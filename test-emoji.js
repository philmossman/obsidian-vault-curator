#!/usr/bin/env node
/**
 * Test emoji sanitization end-to-end
 * Creates a note with emojis, processes it, verifies sanitization
 */

const VaultClient = require('./vault-client');
const { processInbox } = require('./processor');
const loadConfig = require('./config');

async function testEmojiSanitization() {
  console.log('🧪 Testing Emoji Sanitization End-to-End\n');
  
  const config = loadConfig();
  const vaultClient = new VaultClient(config.couchdb);
  
  const testPath = 'inbox/test-emoji-sanitization.md';
  
  try {
    // Step 1: Create a note with lots of emojis
    console.log('Step 1: Creating test note with emojis...');
    const noteContent = `---
created: ${new Date().toISOString()}
source: test
---

This note has lots of emojis! 🎯🔥✅

Here's what I need to do:
- ✅ Complete the project
- 📝 Write documentation  
- 💡 Come up with new ideas
- 🔍 Search for references
- ⚠️ Fix the bugs

Photography session notes 📸:
- Beautiful sunset 🌅
- Got some great shots ⭐
- Client was happy 😊
- Payment received 💰

Next steps 👉:
- Edit photos 🎨
- Send to client 📧
- Post on social media 📱
`;

    await vaultClient.writeNote(testPath, noteContent);
    console.log(`✅ Created test note: ${testPath}\n`);
    
    // Step 2: Read it back to verify it was sanitized on write
    console.log('Step 2: Reading note back from CouchDB...');
    const readNote = await vaultClient.readNote(testPath);
    console.log('Note content after write:');
    console.log('-'.repeat(60));
    console.log(readNote.content);
    console.log('-'.repeat(60));
    
    // Check for emoji sanitization
    const hasEmojis = /[\u{1F300}-\u{1F9FF}]/gu.test(readNote.content);
    console.log(`\n✅ Emojis removed: ${!hasEmojis ? 'YES' : 'NO (FAIL)'}`);
    console.log(`✅ Contains replacements: ${readNote.content.includes('[DONE]') ? 'YES' : 'NO'}\n`);
    
    // Step 3: Process with AI
    console.log('Step 3: Processing with AI...');
    const results = await processInbox({
      limit: 1,
      model: 'qwen2.5-coder:7b',
      dryRun: false,
      force: false
    });
    
    console.log(`\n✅ Processed: ${results.processed}`);
    
    // Step 4: Read final version
    console.log('\nStep 4: Reading final processed note...');
    const finalNote = await vaultClient.readNote(testPath);
    const { frontmatter, body } = vaultClient.parseFrontmatter(finalNote.content);
    
    console.log('\nFrontmatter:');
    console.log(JSON.stringify(frontmatter, null, 2));
    
    console.log('\nAI Suggestions:');
    if (frontmatter.ai_suggestions) {
      console.log(`  Folder: ${frontmatter.ai_suggestions.folder}`);
      console.log(`  Tags: ${frontmatter.ai_suggestions.tags}`);
      console.log(`  Summary: ${frontmatter.ai_suggestions.summary}`);
      console.log(`  Confidence: ${frontmatter.ai_suggestions.confidence}`);
    }
    
    // Step 5: Verify no emojis in final version
    const finalHasEmojis = /[\u{1F300}-\u{1F9FF}]/gu.test(finalNote.content);
    console.log(`\n✅ Final note emoji-free: ${!finalHasEmojis ? 'YES' : 'NO (FAIL)'}`);
    
    // Clean up
    console.log('\nStep 5: Cleaning up...');
    await vaultClient.deleteNote(testPath);
    console.log('✅ Test note deleted\n');
    
    console.log('='.repeat(60));
    console.log('🎉 Emoji Sanitization Test Complete!');
    console.log('='.repeat(60));
    
  } catch (err) {
    console.error('❌ Test failed:', err);
    
    // Clean up on error
    try {
      await vaultClient.deleteNote(testPath);
      console.log('🧹 Cleaned up test note');
    } catch (e) {
      // Ignore cleanup errors
    }
    
    process.exit(1);
  }
}

// Run test
testEmojiSanitization();
