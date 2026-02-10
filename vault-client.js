/**
 * Vault Client - CouchDB interaction utilities
 * Enhanced with frontmatter parsing for Phase 2
 */

const nano = require('nano');
const crypto = require('crypto');

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
    .replace(/🎯/g, '[TARGET]')
    .replace(/🔥/g, '[HOT]')
    .replace(/⭐/g, '[STAR]')
    // Remove all other emojis (range covers most emoji blocks)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    // Remove other multibyte UTF-8 characters (keep basic Latin + common punctuation)
    .replace(/[^\x00-\x7F]/g, '');
}

class VaultClient {
  constructor(config) {
    const auth = `${config.username}:${config.password}`;
    const couchUrl = `http://${auth}@${config.host}:${config.port}`;
    this.nano = nano(couchUrl);
    this.db = this.nano.db.use(config.database);
  }

  /**
   * Read a note by path
   * @param {string} path - Note path (e.g., "inbox/note.md")
   * @returns {Promise<Object|null>} Note object with path, content, metadata
   */
  async readNote(path) {
    try {
      const docId = this._pathToId(path);
      const metadata = await this.db.get(docId);
      
      // Check if encrypted
      if (metadata.e_) {
        throw new Error('Note is encrypted - E2EE must be disabled');
      }

      // Reconstruct content from chunks
      const chunks = await Promise.all(
        metadata.children.map(chunkId => this.db.get(chunkId))
      );

      const content = chunks
        .map(chunk => chunk.data || '')
        .join('');

      return {
        path: metadata.path,
        content,
        ctime: metadata.ctime,
        mtime: metadata.mtime,
        metadata
      };
    } catch (err) {
      if (err.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Write or update a note (with Unicode sanitization)
   * @param {string} path - Note path
   * @param {string} content - Note content (will be sanitized)
   * @param {object} options - Additional options
   * @returns {Promise<Object>} Result with ok, id, rev
   */
  async writeNote(path, content, options = {}) {
    // CRITICAL: Sanitize Unicode to prevent CouchDB corruption
    const safeContent = sanitizeUnicode(content);
    
    const docId = this._pathToId(path);
    const now = Date.now();
    
    // Check if note exists (for updates)
    let existingDoc = null;
    try {
      existingDoc = await this.db.get(docId);
    } catch (err) {
      if (err.statusCode !== 404) throw err;
    }

    // Split content into chunks (LiveSync uses ~50KB chunks)
    const chunks = this._createChunks(safeContent);
    
    // Create chunk documents
    const chunkIds = [];
    for (const chunkData of chunks) {
      const chunkId = this._createChunkId(chunkData);
      chunkIds.push(chunkId);
      
      // Only write chunk if it doesn't exist (content-addressable)
      try {
        await this.db.get(chunkId);
      } catch (err) {
        if (err.statusCode === 404) {
          await this.db.insert({
            _id: chunkId,
            type: 'leaf',
            data: chunkData
          });
        }
      }
    }

    // Create or update metadata document
    const metadata = {
      _id: docId,
      ...(existingDoc && { _rev: existingDoc._rev }),
      children: chunkIds,
      path: path,
      ctime: existingDoc ? existingDoc.ctime : now,
      mtime: now,
      size: safeContent.length,
      type: options.type || 'plain',
      eden: {}
    };

    const result = await this.db.insert(metadata);
    return { ok: true, id: result.id, rev: result.rev };
  }

  /**
   * List all notes (excluding chunks and system docs)
   * @returns {Promise<Array>} Array of note objects with path, id, mtime, size
   */
  async listNotes() {
    const result = await this.db.list({ include_docs: true });
    return result.rows
      .filter(row => !row.id.startsWith('h:') && !row.id.startsWith('_'))
      .filter(row => row.id !== 'obsydian_livesync_version')
      .map(row => ({
        path: row.doc.path,
        id: row.id,
        mtime: row.doc.mtime,
        size: row.doc.size
      }));
  }

  /**
   * Parse YAML frontmatter from note content
   * Handles nested objects and arrays properly
   * @param {string} content - Note content with optional frontmatter
   * @returns {Object} { frontmatter: Object, body: string }
   */
  parseFrontmatter(content) {
    const lines = content.split('\n');
    
    // Check if starts with frontmatter delimiter
    if (lines[0] !== '---') {
      return { frontmatter: {}, body: content };
    }

    // Find closing delimiter
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---' && lines[i].match(/^(---\s*)$/)) {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      // No closing delimiter, treat as regular content
      return { frontmatter: {}, body: content };
    }

    // Parse frontmatter (recursive parser for nested objects)
    const yamlLines = lines.slice(1, endIndex);
    const frontmatter = this._parseYamlBlock(yamlLines, 0).result;

    // Body is everything after the closing delimiter
    const body = lines.slice(endIndex + 1).join('\n');

    return { frontmatter, body };
  }

  /**
   * Recursively parse a YAML block
   * @param {Array} lines - Array of YAML lines
   * @param {number} startIndex - Starting index
   * @param {number} baseIndent - Base indentation level
   * @returns {Object} { result: Object, index: number }
   */
  _parseYamlBlock(lines, startIndex, baseIndent = 0) {
    const result = {};
    let i = startIndex;

    while (i < lines.length) {
      const line = lines[i];
      const indent = this._getIndentLevel(line);

      // If we've gone back to base level or below, we're done with this block
      if (indent < baseIndent && line.trim() !== '') {
        break;
      }

      // Skip empty lines and comments at this level
      if (line.trim() === '' || line.trim().startsWith('#')) {
        i++;
        continue;
      }

      // Match key: value patterns
      // Handle both:
      //   key: value (top level)
      //   key:       (object start, next line is indented)
      const match = line.match(/^(\s*)([\w_-]+):\s*(.*)$/);
      if (!match) {
        i++;
        continue;
      }

      const [, , key, value] = match;
      const currentIndent = this._getIndentLevel(line);

      // Look ahead to determine if this is an object or value
      const nextLine = lines[i + 1];
      const nextIndent = nextLine ? this._getIndentLevel(nextLine) : -1;

      if (value === '' && nextIndent > currentIndent) {
        // This is a nested object
        const nested = this._parseYamlBlock(lines, i + 1, nextIndent);
        result[key] = nested.result;
        i = nested.index;
      } else {
        // This is a simple value
        result[key] = this._parseYamlValue(value);
        i++;
      }
    }

    return { result, index: i };
  }

  /**
   * Get indentation level (number of leading spaces)
   * @param {string} line - Line to check
   * @returns {number} Number of leading spaces
   */
  _getIndentLevel(line) {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Parse a YAML value into appropriate JS type
   * @param {string} value - String value from YAML
   * @returns {*} Parsed value
   */
  _parseYamlValue(value) {
    // Trim whitespace
    value = value.trim();

    // Empty string
    if (value === '') {
      return '';
    }

    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    if (value.match(/^-?\d+$/)) {
      return parseInt(value, 10);
    }
    if (value.match(/^-?\d+\.\d+$/)) {
      return parseFloat(value);
    }

    // Array (inline format: [item1, item2])
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      if (inner.trim() === '') return [];
      
      return inner.split(',').map(item => {
        item = item.trim();
        // Remove quotes if present
        if ((item.startsWith('"') && item.endsWith('"')) ||
            (item.startsWith("'") && item.endsWith("'"))) {
          item = item.slice(1, -1);
        }
        return item;
      });
    }

    // String (remove surrounding quotes if present)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && item.endsWith("'"))) {
      return value.slice(1, -1);
    }

    return value;
  }

  /**
   * Build note content from frontmatter and body
   * @param {Object} frontmatter - Frontmatter object
   * @param {string} body - Note body
   * @returns {string} Complete note content with YAML frontmatter
   */
  buildNote(frontmatter, body) {
    if (!frontmatter || Object.keys(frontmatter).length === 0) {
      return body;
    }

    const yamlLines = ['---'];
    
    for (const [key, value] of Object.entries(frontmatter)) {
      this._addYamlField(yamlLines, key, value, 0);
    }
    
    yamlLines.push('---');
    
    return yamlLines.join('\n') + '\n' + body;
  }

  /**
   * Add a YAML field with proper formatting (handles nested objects)
   * @param {Array} lines - Array of YAML lines
   * @param {string} key - Field key
   * @param {*} value - Field value
   * @param {number} indent - Indentation level
   */
  _addYamlField(lines, key, value, indent = 0) {
    const indentStr = '  '.repeat(indent);
    
    if (Array.isArray(value)) {
      // Simple array on one line
      lines.push(`${indentStr}${key}: [${value.join(', ')}]`);
    } else if (typeof value === 'object' && value !== null) {
      // Nested object
      lines.push(`${indentStr}${key}:`);
      for (const [subKey, subValue] of Object.entries(value)) {
        this._addYamlField(lines, subKey, subValue, indent + 1);
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${indentStr}${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${indentStr}${key}: ${value}`);
    } else {
      // String values
      lines.push(`${indentStr}${key}: ${value}`);
    }
  }

  /**
   * Delete a note
   * @param {string} path - Note path
   * @returns {Promise<Object>} Result with ok
   */
  async deleteNote(path) {
    const docId = this._pathToId(path);
    const doc = await this.db.get(docId);
    
    // LiveSync soft delete: set deleted flag and clear content
    // Do NOT use db.destroy() - that's a CouchDB hard delete which
    // LiveSync doesn't recognise as a proper deletion.
    // LiveSync expects the document to remain with deleted: true
    doc.deleted = true;
    doc.data = '';
    doc.children = [];
    doc.mtime = Date.now();
    
    await this.db.insert(doc);
    return { ok: true };
  }

  // ===== Private Helper Methods =====

  _pathToId(path) {
    // LiveSync stores paths as lowercase IDs (case-insensitive filesystems)
    // and prepends "/" if it starts with "_"
    let id = path.toLowerCase();
    if (id.startsWith('_')) {
      id = '/' + id;
    }
    return id;
  }

  _createChunks(content, chunkSize = 50000) {
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }
    return chunks.length > 0 ? chunks : [''];
  }

  _createChunkId(data) {
    // LiveSync uses a simple hash for chunk IDs
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    // Use a shorter hash similar to LiveSync format
    const shortHash = hash.substring(0, 12);
    return `h:${shortHash}`;
  }
}

module.exports = VaultClient;
module.exports.sanitizeUnicode = sanitizeUnicode;
