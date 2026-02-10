const VaultClient = require('../obsidian-curator/vault-client');
const config = require('../obsidian-curator/config.json');
const vaultClient = new VaultClient(config.couchdb);

/**
 * Sanitize Unicode characters to prevent LiveSync corruption
 * LiveSync counts byte length vs string length differently for multibyte UTF-8
 * @param {string} text - Text to sanitize
 * @returns {string} - ASCII-safe text
 */
function sanitizeUnicode(text) {
  return text
    // Replace common emojis with text equivalents
    .replace(/✅/g, '[DONE]')
    .replace(/❌/g, '[FAIL]')
    .replace(/⚠️/g, '[WARN]')
    .replace(/→/g, '->')
    .replace(/✓/g, '[OK]')
    .replace(/✗/g, '[X]')
    .replace(/📝/g, '[NOTE]')
    .replace(/🔍/g, '[SEARCH]')
    .replace(/💡/g, '[IDEA]')
    // Remove all other emojis (range covers most emoji blocks)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    // Remove other multibyte UTF-8 characters (keep basic Latin + common punctuation)
    .replace(/[^\x00-\x7F]/g, '');
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
