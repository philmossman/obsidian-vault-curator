#!/usr/bin/env node

/**
 * Test distiller with mock insights (no AI needed)
 */

const vaultSearch = require('./vault-search');
const distiller = require('./distiller');

// Mock insights for testing
const mockInsights = [
  {
    type: 'milestone',
    topic: 'vault-curator',
    title: 'Phase 5 Distiller Implementation',
    content: `Successfully built Phase 5 memory distillation system with the following components:

## Components Built
- **vault-search.js** - Relevance scoring for finding related notes (0.0-1.0 scale)
- **distiller.js** - Core distillation engine with AI extraction and filing decisions
- **telegram-distill.js** - Telegram command handler for /distill

## Key Features
- Smart update vs create decisions based on vault search scores
- Confidence filtering (≥0.6 threshold)
- Dry-run mode for testing
- Comprehensive reporting

## Technical Approach
- Extract insights from memory/*.md files
- Score relevance to existing vault notes
- Update existing notes when score ≥0.6 (append new section)
- Create new notes when score <0.6 (suggest folder based on topic)`,
    source_dates: ['2026-02-16'],
    tags: ['vault-curator', 'phase-5', 'distillation', 'obsidian'],
    confidence: 0.95,
    related_notes: ['Projects/vault-curator/BUILD-LOG.md', 'Projects/vault-curator/ROADMAP.md']
  },
  {
    type: 'discovery',
    topic: 'vault-curator',
    title: 'VaultClient Class Pattern',
    content: `Discovered that vault-client.js exports a class, not a module of functions.

## Pattern
\`\`\`javascript
const VaultClient = require('./vault-client');
const config = require('./config.json');
const vault = new VaultClient(config.couchdb);
await vault.listNotes();
await vault.readNote(path);
await vault.writeNote(path, content);
\`\`\`

## Methods Available
- readNote(path)
- writeNote(path, content, options)
- listNotes()
- parseFrontmatter(content)
- buildNote(frontmatter, body)
- deleteNote(path)`,
    source_dates: ['2026-02-16'],
    tags: ['vault-curator', 'technical', 'couchdb'],
    confidence: 0.75,
    related_notes: ['Projects/vault-curator/ARCHITECTURE.md']
  },
  {
    type: 'lesson',
    topic: 'obsidian',
    title: 'Tag Formatting Rules',
    content: `Obsidian has strict rules for tag formatting that we discovered during vault cleanup.

## Rules
- ❌ No spaces (use hyphens or camelCase)
- ❌ No periods (use hyphens)
- ✅ Use kebab-case or camelCase
- ✅ Lowercase preferred for consistency

## Invalid Examples
- "Anthropic Pro" → should be "anthropic-pro"
- "Subscription Management" → should be "subscription-management"
- "Llama3.1B" → should be "llama3-1b"
- "Sonnet4.5" → should be "sonnet4-5"

## Fixed in vault-client.js
Changed _addYamlField() to output block-style arrays instead of inline:
\`\`\`yaml
tags:
  - tag1
  - tag2
\`\`\`
Instead of: \`tags: [tag1, tag2]\``,
    source_dates: ['2026-02-15'],
    tags: ['obsidian', 'best-practices', 'formatting'],
    confidence: 0.80,
    related_notes: []
  }
];

async function test() {
  console.log('Testing distiller with mock insights...\n');

  // Test vault search for each insight
  for (const insight of mockInsights) {
    console.log(`\n📝 Processing: ${insight.title}`);
    console.log(`   Topic: ${insight.topic}, Confidence: ${insight.confidence}`);

    const searchResults = await vaultSearch.searchRelated(
      insight.topic,
      insight.tags,
      insight.content
    );

    console.log(`   Found ${searchResults.length} related notes:`);
    for (const result of searchResults.slice(0, 3)) {
      console.log(`      ${result.score.toFixed(2)} - ${result.note} (${result.reasoning})`);
    }

    const bestMatch = vaultSearch.findBestMatch(searchResults, 0.6);
    
    if (bestMatch) {
      console.log(`   ✅ DECISION: UPDATE ${bestMatch.note} (score: ${bestMatch.score.toFixed(2)})`);
    } else {
      const folder = await vaultSearch.suggestFolder(insight.topic, insight.tags);
      console.log(`   ✨ DECISION: CREATE new note in ${folder}/ (no match ≥0.6)`);
    }
  }

  console.log('\n✅ Test complete');
}

test().catch(console.error);
