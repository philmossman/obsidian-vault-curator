#!/usr/bin/env node

/**
 * Memory Distiller - Phase 5
 * 
 * Transforms daily memory logs into permanent vault notes.
 * Extracts insights, makes smart filing decisions, applies changes.
 */

const fs = require('fs').promises;
const path = require('path');
const aiClient = require('./ai-client');
const VaultClient = require('./vault-client');
const vaultSearch = require('./vault-search');
const { buildExtractionPrompt } = require('./prompts');

const MEMORY_DIR = path.join(__dirname, '../memory');

/**
 * Get vault client instance
 */
function getVaultClient() {
  const config = require('./config')();
  return new VaultClient(config.couchdb);
}

/**
 * Main distillation function
 * @param {Object} options - { days: 7, dryRun: false, minConfidence: 0.6, extractionFn: null }
 * @returns {Promise<Object>} Distillation report
 */
async function distill(options = {}) {
  const {
    days = 7,
    dryRun = false,
    minConfidence = 0.6,
    extractionFn = null
  } = options;

  console.log(`🔍 Starting distillation: last ${days} days (dry-run: ${dryRun})`);

  // 1. Scan memory files
  const memoryFiles = await scanMemoryFiles(days);
  console.log(`📁 Found ${memoryFiles.length} memory files`);

  if (memoryFiles.length === 0) {
    return {
      dateRange: [],
      filesScanned: 0,
      insightsExtracted: 0,
      notesUpdated: 0,
      notesCreated: 0,
      skipped: 0,
      actions: []
    };
  }

  // 2. Extract insights from memory files
  const insights = await extractInsights(memoryFiles, extractionFn);
  console.log(`💡 Extracted ${insights.length} insights`);

  // 3. Filter by confidence
  const filteredInsights = insights.filter(i => i.confidence >= minConfidence);
  console.log(`✅ ${filteredInsights.length} insights meet confidence threshold (≥${minConfidence})`);

  // 4. Make filing decisions
  const decisions = [];
  for (const insight of filteredInsights) {
    const decision = await makeFilingDecision(insight);
    decisions.push(decision);
  }

  // 5. Apply changes (unless dry-run)
  const actions = [];
  if (!dryRun) {
    for (const decision of decisions) {
      try {
        const result = await applyDecision(decision);
        actions.push(result);
        console.log(`${result.type === 'update' ? '📝' : '✨'} ${result.type}: ${result.note}`);
      } catch (error) {
        console.error(`❌ Failed to apply decision for ${decision.insight.title}:`, error.message);
        actions.push({
          type: 'error',
          note: decision.target,
          insight: decision.insight.title,
          error: error.message
        });
      }
    }
  } else {
    // Dry-run: just report what would happen
    for (const decision of decisions) {
      actions.push({
        type: decision.action,
        note: decision.target,
        insight: decision.insight.title,
        dryRun: true
      });
      console.log(`[DRY-RUN] ${decision.action}: ${decision.target} - ${decision.insight.title}`);
    }
  }

  // 6. Generate report
  const report = {
    dateRange: [
      memoryFiles[memoryFiles.length - 1].date,
      memoryFiles[0].date
    ],
    filesScanned: memoryFiles.length,
    insightsExtracted: insights.length,
    insightsFiltered: filteredInsights.length,
    notesUpdated: actions.filter(a => a.type === 'update').length,
    notesCreated: actions.filter(a => a.type === 'create').length,
    errors: actions.filter(a => a.type === 'error').length,
    skipped: insights.length - filteredInsights.length,
    dryRun,
    actions
  };

  return report;
}

/**
 * Scan memory directory for files within date range
 */
async function scanMemoryFiles(days) {
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

  // Sort by date descending (newest first)
  memoryFiles.sort((a, b) => b.date.localeCompare(a.date));

  return memoryFiles;
}

/**
 * Extract insights from memory files using AI
 * Can be called with custom extraction function for OpenClaw integration
 */
async function extractInsights(memoryFiles, extractionFn = null) {
  const combined = memoryFiles.map(f => 
    `# ${f.date}\n\n${f.content}`
  ).join('\n\n---\n\n');

  const prompt = buildExtractionPrompt(memoryFiles);

  // If custom extraction function provided (e.g., from OpenClaw session), use it
  if (extractionFn) {
    try {
      const result = await extractionFn(prompt, combined);
      return result.insights || [];
    } catch (error) {
      console.error('Custom extraction failed:', error.message);
      return [];
    }
  }

  // Otherwise try direct AI client (for standalone usage)
  try {
    const response = await aiClient.chat(prompt, combined, {
      model: 'sonnet', // Use Sonnet for quality
      format: 'json'
    });

    const parsed = JSON.parse(response);
    return parsed.insights || [];
  } catch (error) {
    console.error('AI extraction failed:', error.message);
    return [];
  }
}

// buildExtractionPrompt is now in prompts.js — imported at top of file

/**
 * Make filing decision for an insight
 */
async function makeFilingDecision(insight) {
  // Search for related notes
  const searchResults = await vaultSearch.searchRelated(
    insight.topic,
    insight.tags,
    insight.content
  );

  // Find best match
  const bestMatch = vaultSearch.findBestMatch(searchResults, 0.6);

  if (bestMatch) {
    // UPDATE existing note
    return {
      action: 'update',
      target: bestMatch.note,
      insight,
      searchScore: bestMatch.score,
      reasoning: `Update existing note (score: ${bestMatch.score.toFixed(2)}) - ${bestMatch.reasoning}`,
      integration: await planIntegration(insight, bestMatch.note)
    };
  } else {
    // CREATE new note
    const folder = await vaultSearch.suggestFolder(insight.topic, insight.tags);
    const filename = generateFilename(insight);
    const target = `${folder}/${filename}`;

    return {
      action: 'create',
      target,
      insight,
      reasoning: `No good match found (best: ${searchResults[0]?.score.toFixed(2) || 0}) - creating new note`,
      integration: {
        method: 'create',
        content: formatNewNote(insight)
      }
    };
  }
}

/**
 * Plan how to integrate insight into existing note
 */
async function planIntegration(insight, notePath) {
  // For now, simple append with date section
  // Future: use AI to decide best integration point

  const date = insight.source_dates[0] || new Date().toISOString().split('T')[0];
  const heading = `## ${insight.title} (${date})`;

  return {
    method: 'append_section',
    heading,
    content: insight.content
  };
}

/**
 * Generate filename from insight
 */
function generateFilename(insight) {
  const slug = insight.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);

  return `${slug}.md`;
}

/**
 * Format new note content
 */
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

/**
 * Apply filing decision to vault
 */
async function applyDecision(decision) {
  const vault = getVaultClient();

  if (decision.action === 'create') {
    await vault.writeNote(decision.target, decision.integration.content);
    return {
      type: 'create',
      note: decision.target,
      insight: decision.insight.title
    };
  } else if (decision.action === 'update') {
    // Read existing note
    const existing = await vault.readNote(decision.target);
    
    // Append new section
    const updated = `${existing.content}\n\n${decision.integration.heading}\n\n${decision.insight.content}`;
    
    // Update note
    await vault.writeNote(decision.target, updated);

    return {
      type: 'update',
      note: decision.target,
      insight: decision.insight.title
    };
  }

  throw new Error(`Unknown action: ${decision.action}`);
}

/**
 * Format distillation report for Telegram
 */
function formatReport(report) {
  const { dateRange, filesScanned, insightsExtracted, insightsFiltered, 
          notesUpdated, notesCreated, errors, skipped, dryRun } = report;

  let message = `📊 **Memory Distillation Report**\n\n`;
  message += `📅 Date range: ${dateRange[0]} to ${dateRange[1]}\n`;
  message += `📁 Files scanned: ${filesScanned}\n`;
  message += `💡 Insights extracted: ${insightsExtracted} (${insightsFiltered} after filtering)\n`;
  message += `📝 Notes updated: ${notesUpdated}\n`;
  message += `✨ Notes created: ${notesCreated}\n`;
  if (skipped > 0) {
    message += `⏭️ Skipped: ${skipped} (low confidence)\n`;
  }
  if (errors > 0) {
    message += `❌ Errors: ${errors}\n`;
  }
  if (dryRun) {
    message += `\n⚠️ DRY RUN - no changes applied\n`;
  }

  if (report.actions.length > 0) {
    message += `\n**Actions:**\n`;
    for (const action of report.actions.slice(0, 10)) { // Limit to 10
      const emoji = action.type === 'update' ? '📝' : action.type === 'create' ? '✨' : '❌';
      message += `${emoji} ${action.type}: \`${action.note}\`\n   └─ ${action.insight}\n`;
    }
    if (report.actions.length > 10) {
      message += `\n... and ${report.actions.length - 10} more\n`;
    }
  }

  return message;
}

module.exports = {
  distill,
  formatReport,
  extractInsights,
  makeFilingDecision
};

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const days = parseInt(args[0]) || 7;
  const dryRun = args.includes('--dry-run');

  distill({ days, dryRun })
    .then(report => {
      console.log('\n' + formatReport(report));
      process.exit(report.errors > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Distillation failed:', error);
      process.exit(1);
    });
}
