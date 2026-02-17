#!/usr/bin/env node

/**
 * Telegram /distill Command Handler
 * 
 * Called by OpenClaw when user sends /distill command.
 * This script orchestrates the distillation process and returns results.
 * 
 * Usage: node telegram-distill-handler.js [days] [--dry-run]
 * Examples:
 *   node telegram-distill-handler.js          # Last 7 days
 *   node telegram-distill-handler.js 14       # Last 14 days
 *   node telegram-distill-handler.js --dry-run # Preview only
 */

const orchestrator = require('./distill-orchestrator');
const fs = require('fs').promises;

async function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let days = 7;
  let dryRun = false;
  
  for (const arg of args) {
    if (arg === '--dry-run' || arg === 'dryrun') {
      dryRun = true;
    } else if (arg === 'weekly') {
      days = 7;
    } else if (arg === 'all') {
      days = 365;
    } else if (/^\d+$/.test(arg)) {
      days = parseInt(arg);
    }
  }

  console.log(`🔍 Starting distillation: last ${days} days${dryRun ? ' (DRY RUN)' : ''}\n`);

  try {
    // Step 1: Get memory content
    const memoryFiles = await orchestrator.getMemoryContent(days);
    
    if (memoryFiles.length === 0) {
      console.log('📭 No memory files found for the specified period.');
      console.log('\nMESSAGE_FOR_USER:No memory files to distill.');
      return;
    }

    console.log(`📁 Found ${memoryFiles.length} memory files: ${memoryFiles.map(f => f.date).join(', ')}\n`);

    // Step 2: Prepare extraction prompt and content
    const prompt = orchestrator.buildExtractionPrompt(memoryFiles);
    const content = orchestrator.prepareMemoryForExtraction(memoryFiles);

    // Step 3: Write extraction request for OpenClaw agent
    const requestFile = '/tmp/distill-extraction-request.json';
    await fs.writeFile(requestFile, JSON.stringify({
      prompt,
      content,
      memoryFiles: memoryFiles.map(f => ({ date: f.date, path: f.path })),
      timestamp: Date.now()
    }));

    console.log('💡 Extraction request prepared.');
    console.log('📝 Waiting for AI to extract insights...\n');
    console.log(`REQUEST_FILE:${requestFile}`);
    console.log('EXTRACTION_NEEDED');

    // Step 4: Wait for insights file (created by OpenClaw agent)
    const insightsFile = '/tmp/distill-insights.json';
    const maxWait = 180000; // 3 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      try {
        const insightsData = await fs.readFile(insightsFile, 'utf-8');
        const parsed = JSON.parse(insightsData);
        
        // Clean up temp files
        await fs.unlink(insightsFile).catch(() => {});
        await fs.unlink(requestFile).catch(() => {});

        const insights = parsed.insights || [];
        console.log(`\n✅ Extracted ${insights.length} insights\n`);

        if (insights.length === 0) {
          console.log('MESSAGE_FOR_USER:No significant insights found in memory files.');
          return;
        }

        // Step 5: Apply insights to vault
        console.log('📝 Filing insights to vault...\n');
        const actions = await orchestrator.applyInsights(insights, dryRun);

        // Step 6: Generate report
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

        console.log('\n' + message);
        console.log(`\nMESSAGE_FOR_USER:${message}`);
        
        return;

      } catch (err) {
        // File not ready yet
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Extraction timeout - AI did not provide insights within 3 minutes');

  } catch (error) {
    console.error('❌ Distillation failed:', error.message);
    console.log(`\nMESSAGE_FOR_USER:❌ Distillation failed: ${error.message}`);
    process.exit(1);
  }
}

main();
