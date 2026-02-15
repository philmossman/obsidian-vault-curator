#!/usr/bin/env node
/**
 * Telegram Structure Handler
 * Processes /structure commands to detect and add markdown structure
 */

const { addStructure, DEFAULT_CONFIG } = require('./structure-detector');
const VaultClient = require('../obsidian-curator/vault-client');
const { parseFrontmatter } = require('./formatter');
const config = require('../obsidian-curator/config.json');

const vaultClient = new VaultClient(config.couchdb);

/**
 * Handle a Telegram message for /structure command
 * @param {string} messageText - The full message text
 * @returns {Promise<{success: boolean, message: string, preview?: string}>}
 */
async function handleStructureCommand(messageText) {
  const structureRegex = /^\/structure\s+(.+)/i;
  const match = messageText.match(structureRegex);
  
  if (!match) {
    return { success: false };
  }
  
  const args = match[1].trim().split(/\s+/);
  let notePath = null;
  let dryRun = false;
  let showPreview = true;
  
  // Parse arguments
  for (const arg of args) {
    if (arg.toLowerCase() === 'dryrun' || arg.toLowerCase() === 'dry-run') {
      dryRun = true;
    } else if (arg.toLowerCase() === 'nopreview' || arg.toLowerCase() === 'no-preview') {
      showPreview = false;
    } else {
      notePath = arg;
    }
  }
  
  if (!notePath) {
    return {
      success: true,
      message: '❌ No note path provided.\n\nUsage: `/structure <path>`\n\nExample: `/structure inbox/my-note`'
    };
  }
  
  try {
    // Read note from vault
    let noteDoc;
    try {
      noteDoc = await vaultClient.readNote(notePath);
    } catch (err) {
      return {
        success: true,
        message: `❌ Could not read note: ${notePath}\n\nError: ${err.message}`
      };
    }
    
    const content = noteDoc.content;
    const { frontmatter, body, hasFrontmatter } = parseFrontmatter(content);
    
    // Apply structure detection
    const structureResult = addStructure(body);
    
    // Reconstruct with frontmatter
    let structured = body;
    if (structureResult.markdown !== body) {
      structured = structureResult.markdown;
    }
    
    let finalContent = structured;
    if (hasFrontmatter) {
      finalContent = `---\n${frontmatter}\n---\n${structured}`;
    }
    
    // Check if actually changed
    const changed = finalContent !== content;
    
    // Build response
    let response = '';
    
    if (!changed) {
      response = `ℹ️ **No Structure Changes Needed**\n\n📝 ${notePath}\n\nNote already has good structure or is too minimal to enhance.`;
    } else if (dryRun) {
      response = buildDryRunResponse(notePath, body, structured, structureResult, showPreview);
    } else {
      // Write back to vault
      try {
        await vaultClient.writeNote(notePath, finalContent);
        response = buildSuccessResponse(notePath, structureResult, showPreview, structured);
      } catch (err) {
        return {
          success: true,
          message: `❌ Failed to save changes: ${err.message}`
        };
      }
    }
    
    return {
      success: true,
      message: response,
      preview: showPreview ? structured : null,
      changed,
      confidence: structureResult.confidence
    };
    
  } catch (err) {
    console.error('Structure detection error:', err);
    return {
      success: true,
      message: `❌ Error: ${err.message}`
    };
  }
}

/**
 * Build response for dry-run mode
 */
function buildDryRunResponse(notePath, original, structured, result, showPreview) {
  const lines = [];
  lines.push('🔍 **Dry Run - Preview Only**\n');
  lines.push(`📝 ${notePath}`);
  lines.push(`\n⚙️ **Detection Results:**`);
  lines.push(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  
  if (result.changes.length > 0) {
    lines.push(`\n📋 **Changes Detected:**`);
    result.changes.forEach(change => {
      lines.push(`  ✓ ${change}`);
    });
  } else {
    lines.push(`\n📋 No structural changes detected`);
  }
  
  if (showPreview && result.changes.length > 0) {
    lines.push(`\n📖 **Preview:**`);
    lines.push('```markdown');
    const preview = truncatePreview(structured);
    lines.push(preview);
    lines.push('```');
    lines.push(`\n💡 To apply changes, run: \`/structure ${notePath}\``);
  }
  
  return lines.join('\n');
}

/**
 * Build success response
 */
function buildSuccessResponse(notePath, result, showPreview, structured) {
  const lines = [];
  lines.push('✅ **Structure Added Successfully**\n');
  lines.push(`📝 ${notePath}`);
  lines.push(`\n⚙️ **Detection Results:**`);
  lines.push(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  
  if (result.changes.length > 0) {
    lines.push(`\n📋 **Changes Made:**`);
    result.changes.forEach(change => {
      lines.push(`  ✓ ${change}`);
    });
  }
  
  if (showPreview && result.changes.length > 0) {
    lines.push(`\n📖 **Preview:**`);
    lines.push('```markdown');
    const preview = truncatePreview(structured);
    lines.push(preview);
    lines.push('```');
  }
  
  return lines.join('\n');
}

/**
 * Truncate preview to reasonable length for Telegram
 */
function truncatePreview(text, maxLines = 15, maxChars = 800) {
  const lines = text.split('\n');
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join('\n') + `\n\n... (${lines.length - maxLines} more lines)`;
  }
  
  if (text.length > maxChars) {
    return text.substring(0, maxChars) + `\n\n... (text truncated)`;
  }
  
  return text;
}

/**
 * Parse structure options from command arguments
 */
function parseStructureOptions(args) {
  const options = { ...DEFAULT_CONFIG };
  
  for (const arg of args) {
    if (arg.includes('=')) {
      const [key, value] = arg.split('=');
      const lowerKey = key.toLowerCase();
      
      if (lowerKey === 'aggressiveness') {
        if (['conservative', 'balanced', 'aggressive'].includes(value)) {
          options.aggressiveness = value;
        }
      } else if (lowerKey === 'minlistitems') {
        const num = parseInt(value);
        if (!isNaN(num)) options.minListItems = num;
      } else if (lowerKey === 'mintablerows') {
        const num = parseInt(value);
        if (!isNaN(num)) options.minTableRows = num;
      }
    } else if (arg.startsWith('no-')) {
      const key = arg.substring(3);
      if (key + 'Detection' in options) {
        options[key + 'Detection'] = false;
      }
    }
  }
  
  return options;
}

module.exports = {
  handleStructureCommand,
  parseStructureOptions
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node telegram-structure.js "/structure <path>"');
    console.log('       node telegram-structure.js "/structure <path> dryrun"');
    process.exit(1);
  }
  
  handleStructureCommand(args.join(' ')).then(result => {
    console.log(result.message);
    if (result.preview) {
      console.log('\n=== PREVIEW ===');
      console.log(result.preview);
    }
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
