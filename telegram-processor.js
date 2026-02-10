#!/usr/bin/env node
/**
 * Telegram Processor Handler
 * Handles /process command from Telegram
 * Usage: Called by OpenClaw when /process is received
 */

const { processInbox } = require('./processor');

/**
 * Handle /process command from Telegram
 * @param {Object} message - Telegram message object
 * @returns {Promise<string>} Response message
 */
async function handleProcessCommand(message = {}) {
  const text = message.text || '';
  
  // Parse options from command
  // Examples:
  //   /process
  //   /process limit=5
  //   /process model=claude
  //   /process dryrun
  
  const options = {
    limit: 10,
    model: 'qwen2.5-coder:7b',
    dryRun: false,
    force: false
  };
  
  // Parse arguments
  const args = text.split(/\s+/).slice(1); // Skip "/process"
  
  for (const arg of args) {
    if (arg.includes('=')) {
      const [key, value] = arg.split('=');
      if (key === 'limit') {
        options.limit = parseInt(value, 10);
      } else if (key === 'model') {
        options.model = value;
      }
    } else if (arg.toLowerCase() === 'dryrun') {
      options.dryRun = true;
    } else if (arg.toLowerCase() === 'force') {
      options.force = true;
    }
  }
  
  try {
    // Run processor
    console.log('🚀 Starting inbox processor...');
    console.log('Options:', options);
    
    const results = await processInbox(options);
    
    // Format response
    const response = formatResults(results, options);
    
    return response;
    
  } catch (err) {
    console.error('❌ Process failed:', err);
    return `❌ Processing failed: ${err.message}`;
  }
}

/**
 * Format processing results for Telegram
 * @param {Object} results - Processing results
 * @param {Object} options - Processing options
 * @returns {string} Formatted message
 */
function formatResults(results, options) {
  const lines = [];
  
  if (options.dryRun) {
    lines.push('🔍 **DRY RUN** - No changes made\n');
  }
  
  lines.push('📊 **Processing Complete**\n');
  lines.push(`✅ Processed: ${results.processed}`);
  lines.push(`⏭️ Skipped: ${results.skipped}`);
  lines.push(`❌ Failed: ${results.failed}\n`);
  
  // Show details for processed notes
  if (results.processed > 0) {
    lines.push('**Processed Notes:**');
    
    for (const note of results.notes) {
      if (note.status === 'success') {
        const filename = note.path.split('/').pop();
        const folder = note.analysis.folder;
        const tags = note.analysis.tags.slice(0, 3).join(', ');
        
        lines.push(`\n📝 ${filename}`);
        lines.push(`   📁 → ${folder}`);
        lines.push(`   🏷️ ${tags}`);
        lines.push(`   📊 ${note.analysis.confidence} confidence`);
      }
    }
  }
  
  // Show failures
  if (results.failed > 0) {
    lines.push('\n**Failed:**');
    for (const note of results.notes) {
      if (note.status === 'failed') {
        lines.push(`❌ ${note.path}: ${note.error}`);
      }
    }
  }
  
  // Add next steps if notes were processed
  if (results.processed > 0 && !options.dryRun) {
    lines.push('\n💡 **Next Steps:**');
    lines.push('Review the suggestions in each note\'s frontmatter');
    lines.push('Manually move notes to suggested folders');
    lines.push('Apply suggested tags');
  }
  
  return lines.join('\n');
}

/**
 * Main entry point when called directly
 */
async function main() {
  // Check for command-line arguments
  const args = process.argv.slice(2);
  const command = args.join(' ');
  
  // Simulate message object
  const message = {
    text: command || '/process'
  };
  
  const response = await handleProcessCommand(message);
  console.log('\n' + '='.repeat(50));
  console.log('📤 Response:');
  console.log('='.repeat(50));
  console.log(response);
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { handleProcessCommand, formatResults };
