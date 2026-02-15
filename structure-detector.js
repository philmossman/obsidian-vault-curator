#!/usr/bin/env node
/**
 * Smart Structure Detector
 * Detects and adds markdown structure to plain text
 * Converts titles, headers, lists, and key-value data into proper markdown
 */

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  aggressiveness: 'balanced',  // conservative | balanced | aggressive
  titleDetection: true,
  sectionDetection: true,
  listDetection: true,
  tableDetection: true,
  minListItems: 2,
  minTableRows: 3,
  preserveExisting: true,
  addEmojis: false
};

/**
 * Common section header patterns
 */
const SECTION_PATTERNS = [
  'key results',
  'what we learned',
  'what learned',
  'next steps',
  'next',
  'action items',
  'action',
  'summary',
  'background',
  'discussed',
  'concerns',
  'goals',
  'objectives',
  'outcomes',
  'lessons',
  'findings',
  'recommendations',
  'notes'
];

/**
 * Main function: Detect and add markdown structure to plain text
 * @param {string} plainText - Unformatted text
 * @param {Object} options - Detection options (merged with defaults)
 * @returns {Object} - { markdown, confidence, changes }
 */
function addStructure(plainText, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  
  if (!plainText || typeof plainText !== 'string') {
    return {
      markdown: plainText || '',
      confidence: 0,
      changes: []
    };
  }
  
  // Check if already has markdown
  if (config.preserveExisting && hasExistingMarkdown(plainText)) {
    return {
      markdown: plainText,
      confidence: 0.5,
      changes: ['Existing markdown detected, preserving']
    };
  }
  
  // Split into blocks (separated by blank lines)
  const blocks = splitIntoBlocks(plainText);
  
  if (blocks.length === 0) {
    return {
      markdown: '',  // Empty input/whitespace should return empty
      confidence: 0,
      changes: []
    };
  }
  
  // Classify and transform blocks
  const transformedBlocks = [];
  let confidence = 0;
  const changes = [];
  
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const nextBlock = i + 1 < blocks.length ? blocks[i + 1] : null;
    const prevBlock = i > 0 ? blocks[i - 1] : null;
    
    const classification = classifyBlock(block, {
      isFirst: i === 0,
      nextBlock,
      prevBlock,
      config
    });
    
    let transformed = block;
    
    // Apply transformations based on classification
    if (config.titleDetection && classification.type === 'title') {
      transformed = `# ${block.trim()}`;
      changes.push(`Added title: "${block.trim().substring(0, 40)}..."`);
      confidence += 0.9;
    } else if (config.sectionDetection && classification.type === 'section') {
      // Section header might have content in the same block
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      const firstLine = lines[0].replace(/:\s*$/, '');
      const headerText = formatSectionTitle(firstLine);
      
      if (lines.length > 1) {
        // Has content in same block - format as header + content
        const contentLines = lines.slice(1);
        const contentText = contentLines.join(' ');
        transformed = `## ${headerText}\n\n${contentText}`;
      } else {
        // Just header
        transformed = `## ${headerText}`;
      }
      
      changes.push(`Added section: "${firstLine.substring(0, 40)}..."`);
      confidence += 0.85;
    } else if (config.listDetection && classification.type === 'list') {
      const listResult = detectAndFormatList(block, config);
      transformed = listResult.markdown;
      confidence += listResult.confidence;
      if (listResult.changed) {
        changes.push(`Formatted list (${listResult.itemCount} items)`);
      }
    } else if (config.tableDetection && classification.type === 'table') {
      const tableResult = detectAndFormatTable(block, config);
      transformed = tableResult.markdown;
      confidence += tableResult.confidence;
      if (tableResult.changed) {
        changes.push(`Created table (${tableResult.rowCount} rows)`);
      }
    } else if (classification.type === 'paragraph') {
      // Just join consecutive lines
      transformed = block
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .join(' ');
    }
    
    transformedBlocks.push(transformed);
  }
  
  // Reassemble with proper spacing
  const markdown = transformedBlocks
    .filter(block => block.trim())
    .join('\n\n');
  
  // Normalize confidence to 0-1
  const avgConfidence = blocks.length > 0 ? Math.min(1, confidence / blocks.length) : 0;
  
  return {
    markdown,
    confidence: parseFloat(avgConfidence.toFixed(2)),
    changes
  };
}

/**
 * Check if text already has markdown structure
 */
function hasExistingMarkdown(text) {
  // Check for heading markers (strong indicator of existing structure)
  if (/^#+\s+/m.test(text)) return true;
  // Check for dash/asterisk list markers (strong indicator)
  if (/^[\-\*\+]\s+/m.test(text)) return true;
  // Check for tables (strong indicator)
  if (/\|.*\|/m.test(text)) return true;
  // Note: numbered lists (1., 2.) are not considered "existing markdown"
  // because they can benefit from added structure (titles, sections, etc.)
  return false;
}

/**
 * Split text into blocks (separated by blank lines)
 */
function splitIntoBlocks(text) {
  return text
    .split(/\n\s*\n+/)  // Split on blank lines (1 or more)
    .map(block => block.trim())
    .filter(block => block.length > 0);
}

/**
 * Classify a text block by its type
 */
function classifyBlock(block, context) {
  const { isFirst, nextBlock, config } = context;
  
  // Empty block
  if (!block || block.trim().length === 0) {
    return { type: 'empty', confidence: 1 };
  }
  
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  
  if (lines.length === 0) {
    return { type: 'empty', confidence: 1 };
  }
  
  // Key-value / table detection (check first as it's very specific)
  if (config.tableDetection) {
    const kvResult = detectKeyValue(block);
    if (kvResult.isKeyValue) {
      return { type: 'table', confidence: kvResult.confidence };
    }
  }
  
  // List detection (check before title/section)
  if (config.listDetection) {
    const listResult = detectList(block);
    if (listResult.isList) {
      return { type: 'list', confidence: listResult.confidence };
    }
  }
  
  // Section header detection (short line, often ends with :, but NOT at the start)
  if (config.sectionDetection && !isFirst) {
    const headerResult = isSectionHeader(block, nextBlock);
    if (headerResult.isHeader) {
      return { type: 'section', confidence: headerResult.confidence };
    }
  }
  
  // Title detection (must be first block)
  if (isFirst && config.titleDetection) {
    const titleResult = detectTitle(lines[0]);
    if (titleResult.isTitle && titleResult.confidence >= 0.4) {
      return { type: 'title', confidence: titleResult.confidence };
    }
  }
  
  // Default: paragraph
  return { type: 'paragraph', confidence: 0 };
}

/**
 * Detect if first block looks like a title
 */
function detectTitle(firstBlock) {
  if (!firstBlock) {
    return { isTitle: false, confidence: 0 };
  }
  
  const text = firstBlock.trim();
  const length = text.length;
  
  // Too long for a title
  if (length > 80) {
    return { isTitle: false, confidence: 0 };
  }
  
  // Too short (likely not a title)
  if (length < 3) {
    return { isTitle: false, confidence: 0 };
  }
  
  let confidence = 0;
  
  // Contains date - strong indicator
  if (/\d{1,2}[\/-]\d{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(text)) {
    confidence += 0.4;
  }
  
  // ALL CAPS - strong indicator
  if (text === text.toUpperCase() && text.length > 3) {
    confidence += 0.5;
  }
  
  // Contains dash/hyphen (like "Project - Feb 12")
  if (text.includes('-') && text.length > 10) {
    confidence += 0.3;
  }
  
  // Multiple words (not a single word)
  const wordCount = text.split(/\s+/).length;
  if (wordCount > 1) {
    confidence += 0.2;
  }
  
  // Ends without punctuation (. ! ?)
  if (!/[.!?;,]$/.test(text)) {
    confidence += 0.1;
  }
  
  // Title case (but only if multiple words)
  if (wordCount > 1 && isTitleCase(text)) {
    confidence += 0.2;
  }
  
  return {
    isTitle: confidence >= 0.5,
    confidence: Math.min(1, confidence)
  };
}

/**
 * Detect if block is a section header
 */
function isSectionHeader(block, nextBlock) {
  if (!block) {
    return { isHeader: false, confidence: 0 };
  }
  
  const text = block.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  if (lines.length === 0) {
    return { isHeader: false, confidence: 0 };
  }
  
  // Check only the first line for header pattern
  const firstLine = lines[0];
  
  // Too long for a header
  if (firstLine.length > 60) {
    return { isHeader: false, confidence: 0 };
  }
  
  // If there's a nextBlock, use it. Otherwise, if there are more lines in this block, that's the content
  const hasContentAfter = nextBlock && nextBlock.trim().length > 0 || lines.length > 1;
  if (!hasContentAfter) {
    return { isHeader: false, confidence: 0 };
  }
  
  let confidence = 0;
  
  // Matches common section patterns (check first, highest priority)
  const lowerText = firstLine.toLowerCase().replace(/[^a-z\s]/g, '');
  if (SECTION_PATTERNS.some(pattern => lowerText.includes(pattern))) {
    confidence += 0.7;
  }
  
  // Ends with colon
  if (firstLine.endsWith(':')) {
    confidence += 0.4;
  }
  
  // Is a question
  if (firstLine.endsWith('?')) {
    confidence += 0.4;
  }
  
  // Title case or capitalized
  if (isTitleCase(firstLine) || firstLine.charAt(0) === firstLine.charAt(0).toUpperCase()) {
    confidence += 0.1;
  }
  
  return {
    isHeader: confidence >= 0.5,
    confidence: Math.min(1, confidence)
  };
}

/**
 * Detect if block is a list
 */
function detectList(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  
  if (lines.length < 2) {
    return { isList: false, confidence: 0 };
  }
  
  // Separate header (if ends with :) from potential list items
  let hasHeader = false;
  let itemLines = lines;
  if (lines[0].endsWith(':')) {
    hasHeader = true;
    itemLines = lines.slice(1);
  }
  
  if (itemLines.length < 2) {
    return { isList: false, confidence: 0 };
  }
  
  // Check for explicit list markers
  const markedLines = itemLines.filter(line => 
    /^[\-\*\+•]|\d+\.\s/.test(line)
  );
  
  if (markedLines.length >= Math.ceil(itemLines.length * 0.5)) {
    return {
      isList: true,
      confidence: 0.95,
      itemCount: markedLines.length
    };
  }
  
  // Check for implicit list (parallel structure)
  // More lenient if we have a header
  const listResult = detectImplicitList(itemLines, hasHeader);
  if (listResult.isList) {
    return {
      isList: true,
      confidence: listResult.confidence,
      itemCount: itemLines.length
    };
  }
  
  return { isList: false, confidence: 0 };
}

/**
 * Detect implicit lists (parallel structure without markers)
 */
function detectImplicitList(lines, hasHeader = false) {
  if (lines.length < 2) {
    return { isList: false, confidence: 0 };
  }
  
  // Require at least 3 lines for implicit list without header
  // But allow 2+ lines if we have a header
  if (!hasHeader && lines.length < 3) {
    return { isList: false, confidence: 0 };
  }
  
  // Check for similar line lengths and structure
  const lengths = lines.map(l => l.length);
  const avgLength = lengths.reduce((a, b) => a + b) / lengths.length;
  const deviation = Math.sqrt(
    lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length
  );
  
  // Low deviation = parallel structure
  if (deviation < avgLength * 0.3) {
    // Also check starting patterns
    const startsWithVerb = lines.filter(l => /^[A-Z][a-z]+\s+/.test(l)).length;
    const startsWithNoun = lines.filter(l => /^[A-Z][a-z]+/.test(l)).length;
    
    if (startsWithVerb > lines.length * 0.5 || startsWithNoun > lines.length * 0.5) {
      return { isList: true, confidence: 0.6 };
    }
  }
  
  return { isList: false, confidence: 0 };
}

/**
 * Detect key-value pairs (for tables)
 */
function detectKeyValue(block) {
  let lines = block.split('\n').map(l => l.trim()).filter(l => l);
  
  if (lines.length < 2) {
    return { isKeyValue: false, confidence: 0 };
  }
  
  // Skip header line if present (ends with :)
  let headerLine = null;
  if (lines[0].endsWith(':')) {
    headerLine = lines[0];
    lines = lines.slice(1);
  }
  
  if (lines.length < 2) {
    return { isKeyValue: false, confidence: 0 };
  }
  
  // Check how many lines have : separator
  const kvLines = lines.filter(line => 
    /^[^:]+:\s*[^:]*$/.test(line)
  );
  
  // Need at least 2 key:value pairs
  if (kvLines.length >= 2 && kvLines.length >= lines.length * 0.6) {
    return {
      isKeyValue: true,
      confidence: 0.9,
      pairs: kvLines,
      headerLine
    };
  }
  
  return { isKeyValue: false, confidence: 0 };
}

/**
 * Detect and format a list from block text
 */
function detectAndFormatList(block, config) {
  let lines = block.split('\n').map(l => l.trim()).filter(l => l);
  
  // Separate header (if ends with :) from list items
  let headerLine = null;
  if (lines.length > 0 && lines[0].endsWith(':')) {
    headerLine = lines[0].replace(/:\s*$/, '');
    lines = lines.slice(1);
  }
  
  // Extract list items (remove existing markers)
  const items = lines.map(line => {
    // Remove existing markers
    return line
      .replace(/^[\-\*\+•]\s*/, '')
      .replace(/^\d+\.\s+/, '')
      .trim();
  });
  
  // Format as markdown list
  const listPart = items
    .map(item => `- ${item}`)
    .join('\n');
  
  // Include header if present
  const markdown = headerLine 
    ? `## ${formatSectionTitle(headerLine)}\n\n${listPart}`
    : listPart;
  
  return {
    markdown,
    changed: true,
    confidence: 0.85,
    itemCount: items.length
  };
}

/**
 * Detect and format a table from key-value block
 */
function detectAndFormatTable(block, config) {
  let lines = block.split('\n').map(l => l.trim()).filter(l => l);
  
  // Skip header line if present
  let headerLine = null;
  if (lines.length > 0 && lines[0].endsWith(':')) {
    headerLine = lines[0].replace(/:\s*$/, '');
    lines = lines.slice(1);
  }
  
  // Extract key-value pairs
  const pairs = lines
    .filter(line => /^[^:]+:\s*[^:]*$/.test(line))
    .map(line => {
      const [key, value] = line.split(':').map(s => s.trim());
      return { key, value };
    });
  
  if (pairs.length < config.minTableRows) {
    // Not enough for table, use bold keys
    const boldPart = pairs
      .map(({ key, value }) => `**${key}:** ${value}`)
      .join('\n');
    
    const markdown = headerLine
      ? `## ${formatSectionTitle(headerLine)}\n\n${boldPart}`
      : boldPart;
    
    return {
      markdown,
      changed: true,
      confidence: 0.7,
      rowCount: pairs.length
    };
  }
  
  // Create markdown table
  const tablePart = keyValueToTable(pairs);
  const markdown = headerLine
    ? `## ${formatSectionTitle(headerLine)}\n\n${tablePart}`
    : tablePart;
  
  return {
    markdown,
    changed: true,
    confidence: 0.9,
    rowCount: pairs.length
  };
}

/**
 * Convert key-value pairs to markdown table
 */
function keyValueToTable(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return '';
  }
  
  // Create header
  const lines = [
    '| Key | Value |',
    '| --- | --- |'
  ];
  
  // Add rows
  pairs.forEach(({ key, value }) => {
    lines.push(`| ${key} | ${value} |`);
  });
  
  return lines.join('\n');
}

/**
 * Check if text is title case
 */
function isTitleCase(text) {
  // Most words should start with capital
  const words = text.split(/\s+/);
  const capitalWords = words.filter(w => /^[A-Z]/.test(w)).length;
  return capitalWords >= words.length * 0.5;
}

/**
 * Format section title properly (title case, remove punctuation)
 */
function formatSectionTitle(text) {
  return text
    .replace(/:\s*$/, '')  // Remove trailing colon
    .split(' ')
    .map(word => {
      // Preserve acronyms, capitalize first letter of other words
      if (word.length > 1 && word === word.toUpperCase()) {
        return word;  // All caps acronym
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

module.exports = {
  addStructure,
  detectTitle,
  isSectionHeader,
  detectList,
  detectKeyValue,
  keyValueToTable,
  classifyBlock,
  DEFAULT_CONFIG
};

// CLI usage
if (require.main === module) {
  const text = process.argv.slice(2).join(' ');
  if (!text) {
    console.log('Usage: node structure-detector.js "plain text note"');
    process.exit(1);
  }
  
  const result = addStructure(text);
  console.log('=== INPUT ===');
  console.log(text);
  console.log('\n=== OUTPUT ===');
  console.log(result.markdown);
  console.log('\n=== METADATA ===');
  console.log(`Confidence: ${result.confidence}`);
  console.log(`Changes: ${result.changes.join(', ') || 'none'}`);
}
