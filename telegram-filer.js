#!/usr/bin/env node
/**
 * Telegram Filer - Handle /file and /undo commands
 * Integrates with openclaw-telegram-bridge
 */

const { fileNotes } = require('./filer');
const { undoLastFiling, getRecentSessions } = require('./undo');

/**
 * Handle /file command
 * @param {string} argsString - Command arguments
 * @returns {Promise<string>} Response message
 */
async function handleFileCommand(argsString = '') {
  try {
    const args = parseArgs(argsString);
    
    // Extract options
    const options = {
      limit: parseInt(args.limit) || 10,
      minConfidence: args.confidence ? parseFloat(args.confidence) : 0.7,
      dryRun: args.dryrun === true || args.dryrun === 'true'
    };
    
    // Validate options
    if (options.limit < 1 || options.limit > 100) {
      return '❌ Invalid limit. Must be between 1 and 100.';
    }
    
    if (options.minConfidence < 0 || options.minConfidence > 1) {
      return '❌ Invalid confidence. Must be between 0.0 and 1.0.';
    }
    
    // Execute filing
    const results = await fileNotes(options);
    
    // Format response
    return formatFilingResults(results);
    
  } catch (err) {
    return `❌ Filing failed: ${err.message}`;
  }
}

/**
 * Handle /undo command
 * @param {string} argsString - Command arguments (optional session ID)
 * @returns {Promise<string>} Response message
 */
async function handleUndoCommand(argsString = '') {
  try {
    let sessionId = argsString.trim();
    
    // If no session ID provided, get the most recent
    if (!sessionId) {
      const recentSessions = await getRecentSessions(1);
      
      if (recentSessions.length === 0) {
        return '❌ No filing sessions found to undo.';
      }
      
      sessionId = recentSessions[0].sessionId;
    }
    
    // Execute undo
    const results = await undoLastFiling(sessionId);
    
    // Format response
    return formatUndoResults(results);
    
  } catch (err) {
    return `❌ Undo failed: ${err.message}`;
  }
}

/**
 * Parse command arguments
 * Supports: limit=10 confidence=0.8 dryrun
 * @param {string} argsString - Arguments string
 * @returns {Object} Parsed arguments
 */
function parseArgs(argsString) {
  const args = {};
  const parts = argsString.trim().split(/\s+/);
  
  for (const part of parts) {
    if (!part) continue;
    
    // Check for key=value format
    if (part.includes('=')) {
      const [key, value] = part.split('=', 2);
      args[key.toLowerCase()] = value;
    } else {
      // Boolean flag
      args[part.toLowerCase()] = true;
    }
  }
  
  return args;
}

/**
 * Format filing results for Telegram
 * @param {Object} results - Filing results
 * @returns {string} Formatted message
 */
function formatFilingResults(results) {
  const lines = [];
  
  if (results.dryRun) {
    lines.push('🔍 **DRY RUN - Preview Mode**\n');
  }
  
  lines.push('📊 **Filing Results**');
  lines.push(`Session: \`${results.sessionId}\``);
  lines.push('');
  lines.push(`✅ Filed: ${results.filed}`);
  lines.push(`📋 Queued: ${results.queued}`);
  lines.push(`⏭️ Skipped: ${results.skipped}`);
  lines.push(`❌ Failed: ${results.failed}`);
  
  if (results.details && results.details.length > 0) {
    lines.push('\n**Details:**');
    
    for (const detail of results.details.slice(0, 10)) {
      if (detail.action === 'filed') {
        lines.push(`✅ ${detail.path} → ${detail.targetPath}`);
      } else if (detail.action === 'queued') {
        lines.push(`📋 ${detail.path} → review queue (${detail.reason})`);
      } else if (detail.action === 'skipped') {
        lines.push(`⏭️ ${detail.path} (${detail.reason || 'no changes'})`);
      } else if (detail.action === 'failed') {
        lines.push(`❌ ${detail.path}: ${detail.error}`);
      }
    }
    
    if (results.details.length > 10) {
      lines.push(`... and ${results.details.length - 10} more`);
    }
  }
  
  if (!results.dryRun && results.filed > 0) {
    lines.push(`\n💡 To undo: \`/undo ${results.sessionId}\``);
  }
  
  return lines.join('\n');
}

/**
 * Format undo results for Telegram
 * @param {Object} results - Undo results
 * @returns {string} Formatted message
 */
function formatUndoResults(results) {
  const lines = [];
  
  lines.push('↩️ **Undo Results**');
  lines.push(`Session: \`${results.sessionId}\``);
  lines.push('');
  lines.push(`✅ Undone: ${results.undone}`);
  lines.push(`❌ Failed: ${results.failed}`);
  
  if (results.details && results.details.length > 0) {
    lines.push('\n**Details:**');
    
    for (const detail of results.details.slice(0, 10)) {
      if (detail.status === 'undone') {
        lines.push(`✅ Restored: ${detail.path}`);
      } else if (detail.status === 'failed') {
        lines.push(`❌ ${detail.path}: ${detail.error}`);
      }
    }
    
    if (results.details.length > 10) {
      lines.push(`... and ${results.details.length - 10} more`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Main entry point for telegram-bridge integration
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1).join(' ');
  
  let response;
  
  if (command === 'file') {
    response = await handleFileCommand(commandArgs);
  } else if (command === 'undo') {
    response = await handleUndoCommand(commandArgs);
  } else {
    response = `❌ Unknown command: ${command}\n\nAvailable commands:\n- /file [limit=N] [confidence=0.0-1.0] [dryrun]\n- /undo [sessionId]`;
  }
  
  console.log(response);
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  handleFileCommand,
  handleUndoCommand,
  parseArgs,
  formatFilingResults,
  formatUndoResults
};
