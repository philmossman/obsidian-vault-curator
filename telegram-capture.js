#!/usr/bin/env node
/**
 * Telegram Capture Handler
 * Processes /capture commands and creates inbox notes
 */

const { captureNote } = require('./capture');

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
    const notePath = await captureNote(noteText, { 
      source: 'telegram',
      capturedAt: new Date().toISOString()
    });
    
    return {
      captured: true,
      notePath,
      message: `✅ Note captured!\n📝 ${notePath}`
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
