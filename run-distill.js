#!/usr/bin/env node

/**
 * Run Memory Distillation
 * 
 * This is the main entry point called by OpenClaw agent sessions.
 * It orchestrates the full distillation workflow including AI extraction.
 * 
 * Usage from OpenClaw agent:
 *   const distill = require('./vault-curator/run-distill');
 *   const result = await distill.run({ days: 7, dryRun: false });
 * 
 * Or via exec:
 *   await exec('node vault-curator/run-distill.js 7');
 */

const orchestrator = require('./distill-orchestrator');
const fs = require('fs').promises;

/**
 * Main distillation function
 * Requires AI extraction function to be provided
 */
async function run(options = {}) {
  const {
    days = 7,
    dryRun = false,
    extractFn = null
  } = options;

  if (!extractFn) {
    throw new Error('extractFn is required - must be provided by OpenClaw agent session');
  }

  console.log(`🔍 Starting distillation: last ${days} days${dryRun ? ' (DRY RUN)' : ''}\n`);

  // Step 1: Get memory content
  const memoryFiles = await orchestrator.getMemoryContent(days);
  
  if (memoryFiles.length === 0) {
    return {
      success: true,
      message: '📭 No memory files found for the specified period.',
      filesScanned: 0,
      insightsExtracted: 0,
      notesUpdated: 0,
      notesCreated: 0
    };
  }

  console.log(`📁 Found ${memoryFiles.length} memory files: ${memoryFiles.map(f => f.date).join(', ')}\n`);

  // Step 2: Prepare extraction
  const prompt = orchestrator.buildExtractionPrompt(memoryFiles);
  const content = orchestrator.prepareMemoryForExtraction(memoryFiles);

  console.log('💡 Extracting insights with AI...\n');

  // Step 3: AI extraction (provided by agent session)
  const extractionResult = await extractFn(prompt, content);
  const insights = extractionResult.insights || [];

  console.log(`✅ Extracted ${insights.length} insights\n`);

  if (insights.length === 0) {
    return {
      success: true,
      message: '💭 No significant insights found in memory files.',
      filesScanned: memoryFiles.length,
      insightsExtracted: 0,
      notesUpdated: 0,
      notesCreated: 0
    };
  }

  // Step 4: Apply insights to vault
  console.log('📝 Filing insights to vault...\n');
  const actions = await orchestrator.applyInsights(insights, dryRun);

  // Step 5: Generate report
  const updates = actions.filter(a => a.type === 'update').length;
  const creates = actions.filter(a => a.type === 'create').length;

  let message = `📊 **Memory Distillation Complete**\n\n`;
  message += `📅 Period: ${memoryFiles[memoryFiles.length - 1].date} to ${memoryFiles[0].date}\n`;
  message += `📁 Files scanned: ${memoryFiles.length}\n`;
  message += `💡 Insights extracted: ${insights.length}\n`;
  message += `📝 Notes updated: ${updates}\n`;
  message += `✨ Notes created: ${creates}\n`;
  
  if (dryRun) {
    message += `\n⚠️ **DRY RUN** - no changes applied\n`;
  }

  if (actions.length > 0) {
    message += `\n**Actions:**\n`;
    for (const action of actions.slice(0, 8)) {
      const emoji = action.type === 'update' ? '📝' : '✨';
      message += `${emoji} ${action.type}: \`${action.note}\`\n`;
      message += `   └─ ${action.insight}\n`;
    }
    if (actions.length > 8) {
      message += `\n... and ${actions.length - 8} more\n`;
    }
  }

  console.log(message);

  return {
    success: true,
    message,
    filesScanned: memoryFiles.length,
    insightsExtracted: insights.length,
    notesUpdated: updates,
    notesCreated: creates,
    actions
  };
}

module.exports = { run };

// CLI mode
if (require.main === module) {
  console.log('❌ This script requires an AI extraction function.');
  console.log('   It must be called from an OpenClaw agent session.');
  console.log('');
  console.log('Usage from agent session:');
  console.log('  const distill = require("./vault-curator/run-distill");');
  console.log('  await distill.run({ days: 7, extractFn: myExtractFunction });');
  process.exit(1);
}
