#!/usr/bin/env node
/**
 * Phase 3 Demo - Showcase filing, learning, and undo
 */

const VaultClient = require('./vault-client');
const { fileNotes } = require('./filer');
const { trackCorrection, getFolderHints, getStats } = require('./learning');
const { undoLastFiling, getRecentSessions } = require('./undo');
const loadConfig = require('./config');

async function demo() {
  console.log('🎯 Vault Curator Phase 3 Demo\n');
  console.log('='.repeat(60));
  
  const config = loadConfig();
  const vaultClient = new VaultClient(config.couchdb);
  
  // ===== Demo 1: Create test notes =====
  console.log('\n📝 Step 1: Creating test notes in inbox...\n');
  
  const testNotes = [
    {
      path: 'inbox/machine-learning-basics.md',
      content: `---
created: 2026-02-10
processed: true
ai_suggestions:
  folder: projects/ai
  tags: [machine-learning, ai, basics]
  related: [projects/ai/neural-networks.md]
  summary: Introduction to ML concepts
  confidence: high
---

# Machine Learning Basics

This note covers fundamental concepts in machine learning including supervised learning, unsupervised learning, and reinforcement learning.
`
    },
    {
      path: 'inbox/crypto-trading-strategy.md',
      content: `---
created: 2026-02-10
processed: true
ai_suggestions:
  folder: finance/crypto
  tags: [crypto, trading, strategy]
  related: [finance/crypto/bitcoin.md]
  summary: Crypto trading strategies
  confidence: medium
---

# Crypto Trading Strategy

Notes on various cryptocurrency trading strategies and risk management techniques.
`
    },
    {
      path: 'inbox/random-thoughts.md',
      content: `---
created: 2026-02-10
processed: true
ai_suggestions:
  folder: misc
  tags: [random]
  summary: Random thoughts
  confidence: low
---

# Random Thoughts

Just some random ideas I had today.
`
    }
  ];
  
  for (const note of testNotes) {
    await vaultClient.writeNote(note.path, note.content);
    console.log(`  ✅ Created: ${note.path}`);
  }
  
  // ===== Demo 2: File notes with dry-run =====
  console.log('\n\n🔍 Step 2: Preview filing (dry-run)...\n');
  
  const dryRunResults = await fileNotes({
    limit: 10,
    minConfidence: 0.7,
    dryRun: true
  });
  
  console.log(`  📊 Processed: ${dryRunResults.processed}`);
  console.log(`  ✅ Would file: ${dryRunResults.filed}`);
  console.log(`  📋 Would queue: ${dryRunResults.queued}`);
  console.log(`  ⏭️ Would skip: ${dryRunResults.skipped}`);
  
  if (dryRunResults.details.length > 0) {
    console.log('\n  Details:');
    for (const detail of dryRunResults.details) {
      if (detail.action === 'filed') {
        console.log(`    ✅ ${detail.path} → ${detail.targetPath}`);
      } else if (detail.action === 'queued') {
        console.log(`    📋 ${detail.path} → review queue (${detail.reason})`);
      }
    }
  }
  
  // ===== Demo 3: Actually file notes =====
  console.log('\n\n📂 Step 3: Filing notes for real...\n');
  
  const filingResults = await fileNotes({
    limit: 10,
    minConfidence: 0.7,
    dryRun: false
  });
  
  console.log(`  📊 Processed: ${filingResults.processed}`);
  console.log(`  ✅ Filed: ${filingResults.filed}`);
  console.log(`  📋 Queued: ${filingResults.queued}`);
  console.log(`  Session ID: ${filingResults.sessionId}`);
  
  if (filingResults.details.length > 0) {
    console.log('\n  Details:');
    for (const detail of filingResults.details) {
      if (detail.action === 'filed') {
        console.log(`    ✅ ${detail.path} → ${detail.targetPath}`);
        console.log(`       Tags: [${detail.tags.join(', ')}]`);
        console.log(`       Confidence: ${detail.confidence}`);
      } else if (detail.action === 'queued') {
        console.log(`    📋 ${detail.path} → review queue`);
        console.log(`       Reason: ${detail.reason}`);
        console.log(`       Confidence: ${detail.confidence}`);
      }
    }
  }
  
  const sessionId = filingResults.sessionId;
  
  // ===== Demo 4: Learning system =====
  console.log('\n\n🧠 Step 4: Demonstrating learning system...\n');
  
  // Simulate user corrections
  console.log('  Simulating user corrections...');
  
  await trackCorrection(
    'inbox/ml-note1.md',
    'projects/ai/ml-note1.md',
    'Machine learning and deep learning concepts'
  );
  console.log('    ✅ Tracked correction: inbox → projects/ai');
  
  await trackCorrection(
    'inbox/ml-note2.md',
    'projects/ai/ml-note2.md',
    'Neural networks and artificial intelligence research'
  );
  console.log('    ✅ Tracked correction: inbox → projects/ai');
  
  await trackCorrection(
    'inbox/crypto-note.md',
    'finance/crypto/crypto-note.md',
    'Bitcoin and blockchain technology'
  );
  console.log('    ✅ Tracked correction: inbox → finance/crypto');
  
  // Get folder hints based on content
  console.log('\n  Getting folder hints based on learned patterns...');
  
  const hint1 = await getFolderHints('A note about deep learning and machine learning algorithms');
  console.log(`    💡 "deep learning..." → ${hint1.suggestedFolder} (confidence: ${hint1.confidence.toFixed(2)})`);
  
  const hint2 = await getFolderHints('Cryptocurrency trading and Bitcoin investment strategies');
  console.log(`    💡 "cryptocurrency..." → ${hint2.suggestedFolder} (confidence: ${hint2.confidence.toFixed(2)})`);
  
  // Learning stats
  const stats = await getStats();
  console.log('\n  📊 Learning Stats:');
  console.log(`    Total corrections: ${stats.totalCorrections}`);
  console.log(`    Folders learned: ${stats.foldersLearned}`);
  
  // ===== Demo 5: Undo =====
  console.log('\n\n↩️ Step 5: Demonstrating undo...\n');
  
  const sessions = await getRecentSessions(3);
  console.log(`  Found ${sessions.length} recent session(s)`);
  
  if (sessions.length > 0) {
    console.log(`\n  Most recent session: ${sessions[0].sessionId}`);
    console.log(`    Operations: ${sessions[0].operationCount}`);
    console.log(`    Actions: [${sessions[0].actions.join(', ')}]`);
  }
  
  console.log(`\n  Undoing session: ${sessionId}...\n`);
  
  try {
    const undoResults = await undoLastFiling(sessionId);
    console.log(`  ✅ Undone: ${undoResults.undone}`);
    console.log(`  ❌ Failed: ${undoResults.failed}`);
  
    if (undoResults.details.length > 0) {
      console.log('\n  Details:');
      for (const detail of undoResults.details) {
        if (detail.status === 'undone') {
          console.log(`    ✅ Restored: ${detail.path}`);
        } else {
          console.log(`    ❌ Failed: ${detail.path} (${detail.error})`);
        }
      }
    }
  } catch (err) {
    console.log(`  ⚠️ No operations to undo (session had 0 operations)`);
  }
  
  // ===== Cleanup =====
  console.log('\n\n🧹 Step 6: Cleaning up test notes...\n');
  
  for (const note of testNotes) {
    try {
      await vaultClient.deleteNote(note.path);
      console.log(`  ✅ Deleted: ${note.path}`);
    } catch (err) {
      console.log(`  ⚠️ Already deleted: ${note.path}`);
    }
  }
  
  // Try to clean up filed notes
  const filedPaths = [
    'projects/ai/machine-learning-basics.md',
    'finance/crypto/crypto-trading-strategy.md',
    'inbox/review-queue/random-thoughts.md'
  ];
  
  for (const notePath of filedPaths) {
    try {
      await vaultClient.deleteNote(notePath);
      console.log(`  ✅ Deleted: ${notePath}`);
    } catch (err) {
      // Already deleted or doesn't exist
    }
  }
  
  // ===== Summary =====
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Phase 3 Demo Complete!\n');
  console.log('Key Features Demonstrated:');
  console.log('  1. ✅ Auto-filing with confidence filtering');
  console.log('  2. 📋 Queue low-confidence notes for review');
  console.log('  3. 🧠 Learning from user corrections');
  console.log('  4. 💡 Smart folder suggestions based on patterns');
  console.log('  5. ↩️ Complete undo functionality');
  console.log('  6. 🔍 Dry-run preview mode');
  console.log('  7. 🏷️ Automatic tag and backlink application');
  console.log('\n' + '='.repeat(60));
}

// Run demo
demo().catch(err => {
  console.error('❌ Demo failed:', err);
  process.exit(1);
});
