/**
 * structure-classifier.js — Pure detection functions for markdown structure
 *
 * Classifies text blocks as: title, section, list, table, paragraph, empty.
 * No transformation logic here — see structure-detector.js for formatting.
 *
 * All functions are pure (no I/O, no side effects).
 */

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
 * Check if text already has markdown structure.
 * @param {string} text
 * @returns {boolean}
 */
function hasExistingMarkdown(text) {
  if (/^#+\s+/m.test(text)) return true;   // heading markers
  if (/^[\-\*\+]\s+/m.test(text)) return true; // list markers
  if (/\|.*\|/m.test(text)) return true;    // tables
  return false;
}

/**
 * Split text into blocks separated by blank lines.
 * @param {string} text
 * @returns {string[]}
 */
function splitIntoBlocks(text) {
  return text
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(block => block.length > 0);
}

/**
 * Classify a text block by its structural type.
 * @param {string} block
 * @param {Object} context - { isFirst, nextBlock, prevBlock, config }
 * @returns {{ type: string, confidence: number }}
 */
function classifyBlock(block, context) {
  const { isFirst, nextBlock, config } = context;

  if (!block || block.trim().length === 0) {
    return { type: 'empty', confidence: 1 };
  }

  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length === 0) {
    return { type: 'empty', confidence: 1 };
  }

  if (config.tableDetection) {
    const kvResult = detectKeyValue(block);
    if (kvResult.isKeyValue) return { type: 'table', confidence: kvResult.confidence };
  }

  if (config.listDetection) {
    const listResult = detectList(block);
    if (listResult.isList) return { type: 'list', confidence: listResult.confidence };
  }

  if (config.sectionDetection && !isFirst) {
    const headerResult = isSectionHeader(block, nextBlock);
    if (headerResult.isHeader) return { type: 'section', confidence: headerResult.confidence };
  }

  if (isFirst && config.titleDetection) {
    const titleResult = detectTitle(lines[0]);
    if (titleResult.isTitle && titleResult.confidence >= 0.4) {
      return { type: 'title', confidence: titleResult.confidence };
    }
  }

  return { type: 'paragraph', confidence: 0 };
}

/**
 * Detect if the first line of a block looks like a document title.
 * @param {string} firstBlock
 * @returns {{ isTitle: boolean, confidence: number }}
 */
function detectTitle(firstBlock) {
  if (!firstBlock) return { isTitle: false, confidence: 0 };

  const text = firstBlock.trim();
  const length = text.length;

  if (length > 80 || length < 3) return { isTitle: false, confidence: 0 };

  let confidence = 0;

  if (/\d{1,2}[\/-]\d{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(text)) confidence += 0.4;
  if (text === text.toUpperCase() && text.length > 3) confidence += 0.5;
  if (text.includes('-') && text.length > 10) confidence += 0.3;

  const wordCount = text.split(/\s+/).length;
  if (wordCount > 1) confidence += 0.2;
  if (!/[.!?;,]$/.test(text)) confidence += 0.1;
  if (wordCount > 1 && isTitleCase(text)) confidence += 0.2;

  return { isTitle: confidence >= 0.5, confidence: Math.min(1, confidence) };
}

/**
 * Detect if a block is a section header.
 * @param {string} block
 * @param {string|null} nextBlock
 * @returns {{ isHeader: boolean, confidence: number }}
 */
function isSectionHeader(block, nextBlock) {
  if (!block) return { isHeader: false, confidence: 0 };

  const text = block.trim();
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length === 0) return { isHeader: false, confidence: 0 };

  const firstLine = lines[0];
  if (firstLine.length > 60) return { isHeader: false, confidence: 0 };

  const hasContentAfter = (nextBlock && nextBlock.trim().length > 0) || lines.length > 1;
  if (!hasContentAfter) return { isHeader: false, confidence: 0 };

  let confidence = 0;
  const lowerText = firstLine.toLowerCase().replace(/[^a-z\s]/g, '');
  if (SECTION_PATTERNS.some(pattern => lowerText.includes(pattern))) confidence += 0.7;
  if (firstLine.endsWith(':')) confidence += 0.4;
  if (firstLine.endsWith('?')) confidence += 0.4;
  if (isTitleCase(firstLine) || firstLine.charAt(0) === firstLine.charAt(0).toUpperCase()) confidence += 0.1;

  return { isHeader: confidence >= 0.5, confidence: Math.min(1, confidence) };
}

/**
 * Detect if a block is a list (explicit markers or implicit parallel structure).
 * @param {string} block
 * @returns {{ isList: boolean, confidence: number, itemCount?: number }}
 */
function detectList(block) {
  const lines = block.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return { isList: false, confidence: 0 };

  let hasHeader = false;
  let itemLines = lines;
  if (lines[0].endsWith(':')) {
    hasHeader = true;
    itemLines = lines.slice(1);
  }
  if (itemLines.length < 2) return { isList: false, confidence: 0 };

  const markedLines = itemLines.filter(line => /^[\-\*\+•]|\d+\.\s/.test(line));
  if (markedLines.length >= Math.ceil(itemLines.length * 0.5)) {
    return { isList: true, confidence: 0.95, itemCount: markedLines.length };
  }

  const listResult = detectImplicitList(itemLines, hasHeader);
  if (listResult.isList) {
    return { isList: true, confidence: listResult.confidence, itemCount: itemLines.length };
  }

  return { isList: false, confidence: 0 };
}

/**
 * Detect implicit lists (parallel structure, no markers).
 * @param {string[]} lines
 * @param {boolean} hasHeader
 * @returns {{ isList: boolean, confidence: number }}
 */
function detectImplicitList(lines, hasHeader = false) {
  if (lines.length < 2) return { isList: false, confidence: 0 };
  if (!hasHeader && lines.length < 3) return { isList: false, confidence: 0 };

  const lengths = lines.map(l => l.length);
  const avgLength = lengths.reduce((a, b) => a + b) / lengths.length;
  const deviation = Math.sqrt(
    lengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / lengths.length
  );

  if (deviation < avgLength * 0.3) {
    const startsWithVerb = lines.filter(l => /^[A-Z][a-z]+\s+/.test(l)).length;
    const startsWithNoun = lines.filter(l => /^[A-Z][a-z]+/.test(l)).length;
    if (startsWithVerb > lines.length * 0.5 || startsWithNoun > lines.length * 0.5) {
      return { isList: true, confidence: 0.6 };
    }
  }

  return { isList: false, confidence: 0 };
}

/**
 * Detect key-value pairs suitable for table formatting.
 * @param {string} block
 * @returns {{ isKeyValue: boolean, confidence: number, pairs?: string[], headerLine?: string }}
 */
function detectKeyValue(block) {
  let lines = block.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return { isKeyValue: false, confidence: 0 };

  let headerLine = null;
  if (lines[0].endsWith(':')) {
    headerLine = lines[0];
    lines = lines.slice(1);
  }
  if (lines.length < 2) return { isKeyValue: false, confidence: 0 };

  const kvLines = lines.filter(line => /^[^:]+:\s*[^:]*$/.test(line));
  if (kvLines.length >= 2 && kvLines.length >= lines.length * 0.6) {
    return { isKeyValue: true, confidence: 0.9, pairs: kvLines, headerLine };
  }

  return { isKeyValue: false, confidence: 0 };
}

/**
 * Check if text is title case (most words start with capital).
 * @param {string} text
 * @returns {boolean}
 */
function isTitleCase(text) {
  const words = text.split(/\s+/);
  const capitalWords = words.filter(w => /^[A-Z]/.test(w)).length;
  return capitalWords >= words.length * 0.5;
}

module.exports = {
  hasExistingMarkdown,
  splitIntoBlocks,
  classifyBlock,
  detectTitle,
  isSectionHeader,
  detectList,
  detectImplicitList,
  detectKeyValue,
  isTitleCase,
  SECTION_PATTERNS
};
