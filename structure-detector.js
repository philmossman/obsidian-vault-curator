#!/usr/bin/env node
/**
 * structure-detector.js — Orchestration and transformation layer
 *
 * Detects and adds markdown structure to plain text.
 * Pure detection / classification logic lives in structure-classifier.js.
 *
 * Public API (unchanged — all existing callers work without modification):
 *   addStructure(plainText, options)  — main entry point
 *   detectTitle, isSectionHeader, detectList, detectKeyValue, classifyBlock
 *   keyValueToTable, DEFAULT_CONFIG
 */

const {
  hasExistingMarkdown,
  splitIntoBlocks,
  classifyBlock,
  detectTitle,
  isSectionHeader,
  detectList,
  detectKeyValue,
  isTitleCase,
  SECTION_PATTERNS
} = require('./structure-classifier');

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

// ─── Main entry point ─────────────────────────────────────────────────────

/**
 * Detect and add markdown structure to plain text.
 * @param {string} plainText - Unformatted text
 * @param {Object} options - Detection options (merged with defaults)
 * @returns {{ markdown: string, confidence: number, changes: string[] }}
 */
function addStructure(plainText, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };

  if (!plainText || typeof plainText !== 'string') {
    return { markdown: plainText || '', confidence: 0, changes: [] };
  }

  if (config.preserveExisting && hasExistingMarkdown(plainText)) {
    return {
      markdown: plainText,
      confidence: 0.5,
      changes: ['Existing markdown detected, preserving']
    };
  }

  const blocks = splitIntoBlocks(plainText);
  if (blocks.length === 0) {
    return { markdown: '', confidence: 0, changes: [] };
  }

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

    if (config.titleDetection && classification.type === 'title') {
      transformed = `# ${block.trim()}`;
      changes.push(`Added title: "${block.trim().substring(0, 40)}..."`);
      confidence += 0.9;

    } else if (config.sectionDetection && classification.type === 'section') {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l);
      const firstLine = lines[0].replace(/:\s*$/, '');
      const headerText = formatSectionTitle(firstLine);

      if (lines.length > 1) {
        const contentText = lines.slice(1).join(' ');
        transformed = `## ${headerText}\n\n${contentText}`;
      } else {
        transformed = `## ${headerText}`;
      }

      changes.push(`Added section: "${firstLine.substring(0, 40)}..."`);
      confidence += 0.85;

    } else if (config.listDetection && classification.type === 'list') {
      const listResult = detectAndFormatList(block, config);
      transformed = listResult.markdown;
      confidence += listResult.confidence;
      if (listResult.changed) changes.push(`Formatted list (${listResult.itemCount} items)`);

    } else if (config.tableDetection && classification.type === 'table') {
      const tableResult = detectAndFormatTable(block, config);
      transformed = tableResult.markdown;
      confidence += tableResult.confidence;
      if (tableResult.changed) changes.push(`Created table (${tableResult.rowCount} rows)`);

    } else if (classification.type === 'paragraph') {
      transformed = block
        .split('\n')
        .map(line => line.trim())
        .filter(line => line)
        .join(' ');
    }

    transformedBlocks.push(transformed);
  }

  const markdown = transformedBlocks
    .filter(block => block.trim())
    .join('\n\n');

  const avgConfidence = blocks.length > 0 ? Math.min(1, confidence / blocks.length) : 0;

  return {
    markdown,
    confidence: parseFloat(avgConfidence.toFixed(2)),
    changes
  };
}

// ─── Formatting / transformation helpers ─────────────────────────────────

/**
 * Detect and format a list block into markdown.
 * @param {string} block
 * @param {Object} config
 * @returns {{ markdown: string, changed: boolean, confidence: number, itemCount: number }}
 */
function detectAndFormatList(block, config) {
  let lines = block.split('\n').map(l => l.trim()).filter(l => l);

  let headerLine = null;
  if (lines.length > 0 && lines[0].endsWith(':')) {
    headerLine = lines[0].replace(/:\s*$/, '');
    lines = lines.slice(1);
  }

  const items = lines.map(line =>
    line.replace(/^[\-\*\+•]\s*/, '').replace(/^\d+\.\s+/, '').trim()
  );

  const listPart = items.map(item => `- ${item}`).join('\n');
  const markdown = headerLine
    ? `## ${formatSectionTitle(headerLine)}\n\n${listPart}`
    : listPart;

  return { markdown, changed: true, confidence: 0.85, itemCount: items.length };
}

/**
 * Detect and format a key-value block into a markdown table (or bold-key list).
 * @param {string} block
 * @param {Object} config
 * @returns {{ markdown: string, changed: boolean, confidence: number, rowCount: number }}
 */
function detectAndFormatTable(block, config) {
  let lines = block.split('\n').map(l => l.trim()).filter(l => l);

  let headerLine = null;
  if (lines.length > 0 && lines[0].endsWith(':')) {
    headerLine = lines[0].replace(/:\s*$/, '');
    lines = lines.slice(1);
  }

  const pairs = lines
    .filter(line => /^[^:]+:\s*[^:]*$/.test(line))
    .map(line => {
      const colonIdx = line.indexOf(':');
      return {
        key: line.slice(0, colonIdx).trim(),
        value: line.slice(colonIdx + 1).trim()
      };
    });

  if (pairs.length < config.minTableRows) {
    const boldPart = pairs.map(({ key, value }) => `**${key}:** ${value}`).join('\n');
    const markdown = headerLine
      ? `## ${formatSectionTitle(headerLine)}\n\n${boldPart}`
      : boldPart;
    return { markdown, changed: true, confidence: 0.7, rowCount: pairs.length };
  }

  const tablePart = keyValueToTable(pairs);
  const markdown = headerLine
    ? `## ${formatSectionTitle(headerLine)}\n\n${tablePart}`
    : tablePart;
  return { markdown, changed: true, confidence: 0.9, rowCount: pairs.length };
}

/**
 * Convert key-value pairs array to a markdown table string.
 * @param {{ key: string, value: string }[]} pairs
 * @returns {string}
 */
function keyValueToTable(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0) return '';
  const lines = ['| Key | Value |', '| --- | --- |'];
  pairs.forEach(({ key, value }) => lines.push(`| ${key} | ${value} |`));
  return lines.join('\n');
}

/**
 * Format a section title: title case, strip trailing colon.
 * @param {string} text
 * @returns {string}
 */
function formatSectionTitle(text) {
  return text
    .replace(/:\s*$/, '')
    .split(' ')
    .map(word => {
      if (word.length > 1 && word === word.toUpperCase()) return word; // preserve acronyms
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// ─── Exports (public API — unchanged) ────────────────────────────────────

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

// ─── CLI ──────────────────────────────────────────────────────────────────

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
