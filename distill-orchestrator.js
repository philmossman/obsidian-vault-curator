#!/usr/bin/env node

/**
 * Distillation Orchestrator
 * 
 * Simple wrapper that exposes distiller functions for external orchestration.
 * Used by OpenClaw sessions to run distillation with AI provided by the agent.
 */

const distiller = require('./distiller');
const fs = require('fs').promises;
const path = require('path');
const { buildExtractionPrompt } = require('./prompts');

const MEMORY_DIR = path.join(__dirname, '../memory');

/**
 * Scan memory files and return content
 */
async function getMemoryContent(days = 7) {
  const files = await fs.readdir(MEMORY_DIR);
  const memoryFiles = [];

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);

  for (const file of files) {
    if (!file.match(/^\d{4}-\d{2}-\d{2}\.md$/)) continue;

    const dateStr = file.replace('.md', '');
    const fileDate = new Date(dateStr);

    if (fileDate >= cutoff && fileDate <= today) {
      const filePath = path.join(MEMORY_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');
      memoryFiles.push({
        date: dateStr,
        path: filePath,
        content
      });
    }
  }

  memoryFiles.sort((a, b) => b.date.localeCompare(a.date));
  return memoryFiles;
}

// buildExtractionPrompt is now in prompts.js — imported at top of file

/**
 * Prepare memory content for AI extraction
 */
function prepareMemoryForExtraction(memoryFiles) {
  return memoryFiles.map(f => 
    `# ${f.date}\n\n${f.content}`
  ).join('\n\n---\n\n');
}

/**
 * Apply insights to vault
 */
async function applyInsights(insights, dryRun = false) {
  const vaultSearch = require('./vault-search');
  const VaultClient = require('./vault-client');
  const loadConfig = require('./config');
  const config = loadConfig();
  const vault = new VaultClient(config.couchdb);

  const actions = [];

  for (const insight of insights) {
    // Search for related notes
    const searchResults = await vaultSearch.searchRelated(
      insight.topic,
      insight.tags,
      insight.content
    );

    const bestMatch = vaultSearch.findBestMatch(searchResults, 0.6);

    if (bestMatch) {
      // UPDATE existing note
      const heading = `## ${insight.title} (${insight.source_dates[0] || new Date().toISOString().split('T')[0]})`;
      
      if (!dryRun) {
        const existing = await vault.readNote(bestMatch.note);
        const updated = `${existing.content}\n\n${heading}\n\n${insight.content}`;
        await vault.writeNote(bestMatch.note, updated);
      }

      actions.push({
        type: 'update',
        note: bestMatch.note,
        insight: insight.title,
        score: bestMatch.score
      });
    } else {
      // CREATE new note
      const folder = await vaultSearch.suggestFolder(insight.topic, insight.tags);
      const filename = insight.title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_]+/g, '-')
        .substring(0, 60) + '.md';
      const target = `${folder}/${filename}`;

      const tags = insight.tags && insight.tags.length > 0
        ? `tags:\n${insight.tags.map(t => `  - ${t}`).join('\n')}\n`
        : '';

      const content = `---
created: ${new Date().toISOString()}
type: ${insight.type}
${tags}source_dates:
${insight.source_dates.map(d => `  - ${d}`).join('\n')}
---

# ${insight.title}

${insight.content}

---

*Extracted from memory logs: ${insight.source_dates.join(', ')}*
`;

      if (!dryRun) {
        await vault.writeNote(target, content);
      }

      actions.push({
        type: 'create',
        note: target,
        insight: insight.title
      });
    }
  }

  return actions;
}

module.exports = {
  getMemoryContent,
  buildExtractionPrompt,
  prepareMemoryForExtraction,
  applyInsights
};

// CLI helper for testing
if (require.main === module) {
  const command = process.argv[2];

  if (command === 'get-memory') {
    const days = parseInt(process.argv[3]) || 7;
    getMemoryContent(days).then(files => {
      console.log(JSON.stringify({
        count: files.length,
        dates: files.map(f => f.date)
      }, null, 2));
    });
  } else if (command === 'get-prompt') {
    const days = parseInt(process.argv[3]) || 7;
    getMemoryContent(days).then(files => {
      console.log(buildExtractionPrompt(files));
    });
  } else {
    console.log('Usage: distill-orchestrator.js <get-memory|get-prompt> [days]');
  }
}
