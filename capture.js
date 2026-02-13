const VaultClient = require('../obsidian-curator/vault-client');
const config = require('../obsidian-curator/config.json');
const vaultClient = new VaultClient(config.couchdb);

/**
 * Sanitize Unicode characters (DEPRECATED - emojis are now safe!)
 * This function is kept for backwards compatibility but no longer strips emojis.
 * The VaultClient bug (character count vs byte count) has been fixed.
 * @param {string} text - Text to process
 * @returns {string} - Text unchanged (emojis preserved)
 */
function sanitizeUnicode(text) {
  // Emojis are now safe! Just return text as-is.
  // The bug was in vault-client.js using content.length instead of Buffer.byteLength()
  return text;
}

/**
 * Capture a note to the inbox with YAML frontmatter
 * @param {string} text - The note content
 * @param {object} metadata - Metadata object (should include 'source')
 * @returns {Promise<string>} - The created note path
 */
async function captureNote(text, metadata = {}) {
  const now = new Date();
  
  // Format timestamp: YYYY-MM-DD-HHMMSS
  const timestamp = now.toISOString()
    .replace(/T/, '-')
    .replace(/:/g, '')
    .slice(0, 17); // YYYY-MM-DD-HHMMSS
  
  // Extract first few words for filename (max 5 words, 30 chars)
  const firstWords = text
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join('-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 30)
    .toLowerCase();
  
  // Build filename
  const filename = `inbox/${timestamp}-${firstWords}.md`;
  
  // Sanitize text to prevent LiveSync corruption from Unicode
  const safeText = sanitizeUnicode(text);
  
  // Create YAML frontmatter
  const frontmatter = [
    '---',
    `created: ${now.toISOString()}`,
    `source: ${metadata.source || 'unknown'}`,
    '---',
    '',
    safeText
  ].join('\n');
  
  // Create the note (content is already sanitized)
  await vaultClient.writeNote(filename, frontmatter);
  
  return filename;
}

module.exports = { captureNote, sanitizeUnicode };
