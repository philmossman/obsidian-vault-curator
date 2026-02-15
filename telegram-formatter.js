#!/usr/bin/env node
/**
 * Telegram Formatter Handler
 * Handles /format command from Telegram
 * Usage: /format, /format <path>, /format inbox, /format dryrun
 */

const path = require('path');
const fs = require('fs').promises;
const { formatNote, formatMultiple } = require('./formatter');

/**
 * Handle /format command from Telegram
 * @param {Object} message - Telegram message object
 * @returns {Promise<string>} Response message
 */
async function handleFormatCommand(message = {}) {
  const text = message.text || '';
  
  // Parse command options
  // Examples:
  //   /format
  //   /format <path>
  //   /format inbox
  //   /format dryrun
  
  const options = {
    dryRun: false,
    preserveOriginal: true,
    normalizeHeadings: true,
    standardizeLists: true,
    formatTables: true,
    addWhitespace: true
  };
  
  let targetPath = null;
  const args = text.split(/\s+/).slice(1); // Skip "/format"
  
  for (const arg of args) {
    if (arg.toLowerCase() === 'dryrun') {
      options.dryRun = true;
    } else if (arg.toLowerCase() === 'dry-run') {
      options.dryRun = true;
    } else if (arg.toLowerCase() === 'inbox') {
      targetPath = 'inbox/*.md';
    } else if (!arg.startsWith('-')) {
      // Assume it's a path
      targetPath = arg;
    }
  }
  
  try {
    let result;
    
    if (!targetPath) {
      // No path specified - format most recent inbox note
      result = await formatMostRecentInbox(options);
    } else if (targetPath.includes('*') || targetPath.includes('?')) {
      // Glob pattern - format multiple
      result = await formatMultiple(targetPath, { ...options, limit: 50 });
    } else {
      // Single path - format one
      result = await formatNote(targetPath, options);
    }
    
    // Format response
    const response = formatResults(result, options);
    return response;
    
  } catch (err) {
    console.error('❌ Format failed:', err);
    return `❌ Formatting failed: ${err.message}`;
  }
}

/**
 * Format the most recent inbox note
 * @param {Object} options - Formatting options
 * @returns {Promise<Object>} Single format result
 */
async function formatMostRecentInbox(options) {
  try {
    // List inbox files
    const inboxPath = 'inbox';
    const files = await fs.readdir(inboxPath);
    
    // Filter markdown files and sort by mtime (most recent first)
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    if (mdFiles.length === 0) {
      return {
        success: false,
        error: 'No notes found in inbox'
      };
    }
    
    // Get most recent file
    const stats = await Promise.all(
      mdFiles.map(async (f) => {
        const stat = await fs.stat(path.join(inboxPath, f));
        return { file: f, mtime: stat.mtime };
      })
    );
    
    const mostRecent = stats.sort((a, b) => b.mtime - a.mtime)[0].file;
    const notePath = path.join(inboxPath, mostRecent);
    
    return await formatNote(notePath, options);
    
  } catch (err) {
    return {
      success: false,
      error: `Failed to find inbox note: ${err.message}`
    };
  }
}

/**
 * Format results for Telegram response
 * @param {Object} result - Format result(s)
 * @param {Object} options - Formatting options
 * @returns {string} Formatted message
 */
function formatResults(result, options) {
  const lines = [];
  
  // Dry-run header
  if (options.dryRun) {
    lines.push('🔍 **DRY RUN** - No changes saved\n');
  }
  
  // Handle single note result
  if (result.path && !result.results) {
    if (!result.success) {
      lines.push(`❌ **Failed**`);
      lines.push(result.error);
    } else if (!result.changed) {
      lines.push(`✅ **No changes needed**`);
      lines.push(`Note: ${path.basename(result.path)}`);
      lines.push(`Status: Already well-formatted`);
    } else {
      lines.push(`✅ **Formatted successfully**`);
      lines.push(`\n📝 **Note:** ${path.basename(result.path)}`);
      
      if (result.details && result.details.length > 0) {
        lines.push(`\n**Changes made:**`);
        for (const detail of result.details) {
          lines.push(`  • ${detail}`);
        }
      }
      
      if (result.backup) {
        lines.push(`\n💾 **Backup:** ${path.basename(result.backup)}`);
      }
    }
    return lines.join('\n');
  }
  
  // Handle multiple notes result
  if (result.results) {
    lines.push(`📊 **Formatting Complete**\n`);
    
    const successful = result.results.filter(r => r.success && r.changed).length;
    const skipped = result.results.filter(r => r.success && !r.changed).length;
    const failed = result.results.filter(r => !r.success).length;
    const total = result.results.length;
    
    lines.push(`📈 **Summary:**`);
    lines.push(`✅ Formatted: ${successful}/${total}`);
    lines.push(`⏭️ Unchanged: ${skipped}/${total}`);
    
    if (failed > 0) {
      lines.push(`❌ Failed: ${failed}/${total}`);
    }
    
    // Show details for successful formats
    const successful_notes = result.results.filter(r => r.success && r.changed);
    if (successful_notes.length > 0) {
      lines.push(`\n**Formatted Notes:**`);
      
      for (const note of successful_notes.slice(0, 5)) {
        const filename = path.basename(note.path);
        lines.push(`\n📝 ${filename}`);
        
        if (note.details && note.details.length > 0) {
          for (const detail of note.details) {
            lines.push(`   • ${detail}`);
          }
        }
      }
      
      if (successful_notes.length > 5) {
        lines.push(`\n... and ${successful_notes.length - 5} more`);
      }
    }
    
    // Show failures
    const failed_notes = result.results.filter(r => !r.success);
    if (failed_notes.length > 0) {
      lines.push(`\n**Failed:**`);
      for (const note of failed_notes.slice(0, 5)) {
        lines.push(`❌ ${path.basename(note.path)}: ${note.error}`);
      }
      
      if (failed_notes.length > 5) {
        lines.push(`... and ${failed_notes.length - 5} more`);
      }
    }
    
    return lines.join('\n');
  }
  
  // Fallback for unexpected result format
  return `⚠️ **Unexpected result format**: ${JSON.stringify(result)}`;
}

/**
 * Main entry point when called directly
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args.join(' ');
  
  // Simulate message object
  const message = {
    text: command || '/format'
  };
  
  const response = await handleFormatCommand(message);
  console.log('\n' + '='.repeat(60));
  console.log('📤 Response:');
  console.log('='.repeat(60));
  console.log(response);
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { handleFormatCommand, formatResults };
