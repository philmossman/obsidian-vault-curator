#!/usr/bin/env node
/**
 * Telegram Capture Handler
 * Processes /capture commands and creates inbox notes
 * With smart structure detection and auto-formatting!
 */

const { captureNote } = require('./capture');
const { addStructure } = require('./structure-detector');
const { formatVaultNote } = require('./vault-formatter');

/**
 * Handle a Telegram message and check for /capture command
 * @param {string} messageText - The full message text
 * @returns {Promise<{captured: boolean, notePath?: string, message?: string}>}
 */
async function handleTelegramMessage(messageText) {
  // Check if message starts with /capture
  const captureRegex = /^\/capture\s+(.+)/i;
  const match = messageText.match(captureRegex);
  
  if (!match) {
    return { captured: false };
  }
  
  const noteText = match[1].trim();
  
  if (!noteText) {
    return {
      captured: true,
      message: '❌ No text provided. Usage: /capture <your note text>'
    };
  }
  
  try {
    // Step 1: Detect and add structure to plain text
    const structureResult = addStructure(noteText, { 
      aggressiveness: 'balanced',
      preserveExisting: true
    });
    
    // Use the structured version if changes were made
    const textToCapture = structureResult.changes.length > 0 ? structureResult.markdown : noteText;
    
    // Step 2: Capture the note with structured content
    const notePath = await captureNote(textToCapture, { 
      source: 'telegram',
      capturedAt: new Date().toISOString()
    });
    
    // Step 3: Auto-format the captured note
    const formatResult = await formatVaultNote(notePath, { dryRun: false });
    
    // Build response message
    let message = `✅ Note captured`;
    
    if (structureResult.changes.length > 0) {
      message += ` & structured`;
    }
    
    message += `!\n📝 ${notePath}`;
    
    const allChanges = [];
    if (structureResult.changes.length > 0) {
      allChanges.push(`Structured: ${structureResult.changes.join(', ')}`);
    }
    if (formatResult.changed && formatResult.details) {
      allChanges.push(`Formatted: ${formatResult.details.join(', ')}`);
    }
    
    if (allChanges.length > 0) {
      message += `\n\n✨ ${allChanges.join('\n✨ ')}`;
    }
    
    return {
      captured: true,
      notePath,
      structured: structureResult.changes.length > 0,
      formatted: formatResult.changed,
      message
    };
  } catch (err) {
    return {
      captured: true,
      message: `❌ Error capturing note: ${err.message}`
    };
  }
}

module.exports = { handleTelegramMessage };

// CLI usage: node telegram-capture.js "message text"
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node telegram-capture.js "/capture your note text"');
    process.exit(1);
  }
  
  handleTelegramMessage(args.join(' ')).then(result => {
    if (result.message) {
      console.log(result.message);
    } else {
      console.log('No capture command found');
    }
  }).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
