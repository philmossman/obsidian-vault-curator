#!/usr/bin/env node
/**
 * Telegram Capture Handler
 * Processes /capture commands and creates inbox notes
 * Now with auto-formatting!
 */

const { captureNote } = require('./capture');
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
    // Step 1: Capture the note
    const notePath = await captureNote(noteText, { 
      source: 'telegram',
      capturedAt: new Date().toISOString()
    });
    
    // Step 2: Auto-format the captured note
    const formatResult = await formatVaultNote(notePath, { dryRun: false });
    
    // Build response message
    let message = `✅ Note captured & formatted!\n📝 ${notePath}`;
    
    if (formatResult.changed) {
      message += `\n\n✨ Formatted: ${formatResult.details.join(', ')}`;
    }
    
    return {
      captured: true,
      notePath,
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
