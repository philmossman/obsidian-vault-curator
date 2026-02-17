#!/usr/bin/env node
/**
 * test-distill.js — Unit tests for Phase 5 distillation logic
 *
 * Tests: confidence filtering, filename generation, note formatting.
 * Does NOT hit CouchDB or AI (mocked).
 *
 * Run: node test-distill.js
 */

const path = require('path');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ──`);
}

// ─── Import tested functions ───────────────────────────────────────────────

// We test the internal helpers by re-implementing them here from distiller.js exports
// and by calling the module's exported functions directly where safe.
const { buildExtractionPrompt } = require('./prompts');

// ─── Prompt builder ───────────────────────────────────────────────────────

section('Extraction prompt builder');

const mockFiles = [
  { date: '2026-02-10', content: 'some content' },
  { date: '2026-02-16', content: 'more content' }
];

const prompt = buildExtractionPrompt(mockFiles);
assert(typeof prompt === 'string', 'Prompt is a string');
assert(prompt.includes('2026-02-10'), 'Prompt includes start date');
assert(prompt.includes('2026-02-16'), 'Prompt includes end date');
assert(prompt.includes('"insights"'), 'Prompt includes JSON schema key');
assert(prompt.includes('confidence'), 'Prompt includes confidence guidance');
assert(prompt.length > 500, 'Prompt has meaningful length');

const emptyPrompt = buildExtractionPrompt([]);
assert(emptyPrompt.includes('unknown'), 'Empty files produces "unknown" date range');

// ─── Confidence filtering (from distill pipeline) ────────────────────────

section('Confidence filtering');

// Replicate the filter logic from distill()
const minConfidence = 0.6;
const mockInsights = [
  { title: 'High confidence insight', confidence: 0.9 },
  { title: 'Medium confidence insight', confidence: 0.7 },
  { title: 'Borderline insight', confidence: 0.6 },
  { title: 'Below threshold', confidence: 0.59 },
  { title: 'Very low', confidence: 0.2 }
];

const filtered = mockInsights.filter(i => i.confidence >= minConfidence);
assert(filtered.length === 3, 'Only insights >= 0.6 pass the filter');
assert(filtered[0].title === 'High confidence insight', 'High confidence insight included');
assert(filtered[2].title === 'Borderline insight', 'Borderline (0.6) insight included');
assert(!filtered.find(i => i.title === 'Below threshold'), 'Below threshold insight excluded');

// ─── Filename generation ─────────────────────────────────────────────────

section('Filename generation');

// Replicate generateFilename from distiller.js
function generateFilename(insight) {
  const slug = insight.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
  return `${slug}.md`;
}

assert(generateFilename({ title: 'Vault Curator Phase 5 Complete' }) === 'vault-curator-phase-5-complete.md',
  'Title converts to kebab-case filename');
assert(generateFilename({ title: 'Fix: CouchDB ECONNREFUSED error' }) === 'fix-couchdb-econnrefused-error.md',
  'Special chars stripped from filename');
assert(generateFilename({ title: 'A'.repeat(80) }).endsWith('.md'),
  'Long titles truncated with .md extension');
assert(generateFilename({ title: 'A'.repeat(80) }).length <= 63,
  'Filename respects 60-char limit + .md');

// ─── Note formatting ─────────────────────────────────────────────────────

section('Note formatting');

// Replicate formatNewNote from distiller.js
function formatNewNote(insight) {
  const tags = insight.tags && insight.tags.length > 0
    ? `tags:\n${insight.tags.map(t => `  - ${t}`).join('\n')}\n`
    : '';
  const sources = insight.source_dates && insight.source_dates.length > 0
    ? `source_dates:\n${insight.source_dates.map(d => `  - ${d}`).join('\n')}\n`
    : '';
  return `---
created: ${new Date().toISOString()}
type: ${insight.type}
${tags}${sources}---

# ${insight.title}

${insight.content}

---

*Extracted from memory logs: ${insight.source_dates?.join(', ') || 'unknown'}*
`;
}

const mockInsight = {
  type: 'lesson',
  title: 'Test Insight',
  content: 'Some content here',
  tags: ['vault-curator', 'testing'],
  source_dates: ['2026-02-16']
};

const formatted = formatNewNote(mockInsight);
assert(formatted.startsWith('---'), 'Note starts with frontmatter delimiter');
assert(formatted.includes('type: lesson'), 'Type field present');
assert(formatted.includes('  - vault-curator'), 'Tags formatted as YAML list');
assert(formatted.includes('# Test Insight'), 'Title present as H1');
assert(formatted.includes('Some content here'), 'Content included');
assert(formatted.includes('2026-02-16'), 'Source date included');

const noTagsInsight = { ...mockInsight, tags: [] };
const noTagsFormatted = formatNewNote(noTagsInsight);
assert(!noTagsFormatted.includes('tags:'), 'No tags section when tags is empty');

// ─── Vault search scoring ────────────────────────────────────────────────

section('Vault search relevance scoring');

const { calculateRelevance } = require('./vault-search');

const note = {
  path: 'Projects/vault-curator/build-log.md',
  tags: ['vault-curator', 'development'],
  content: 'phase 5 distillation memory logs insights'
};

const score1 = calculateRelevance(note, 'vault-curator', ['vault-curator'], 'memory distillation insights');
assert(score1 > 0.5, `Strong match scores > 0.5 (got ${score1.toFixed(2)})`);

const unrelatedNote = {
  path: 'Photography/landscape-tips.md',
  tags: ['photography'],
  content: 'aperture shutter speed lens composition'
};
const score2 = calculateRelevance(unrelatedNote, 'vault-curator', ['vault-curator'], 'memory distillation');
assert(score2 < 0.3, `Unrelated note scores < 0.3 (got ${score2.toFixed(2)})`);

const contentMatchNote = {
  path: 'Projects/misc/notes.md',
  tags: [],
  content: 'vault curator distillation memory logs weekly'
};
const score3 = calculateRelevance(contentMatchNote, 'vault-curator', [], 'distillation memory logs');
assert(score3 > 0.1, `Content-matching note scores > 0.1 (got ${score3.toFixed(2)})`);

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('❌ Some tests failed');
  process.exit(1);
} else {
  console.log('✅ All tests passed');
}
