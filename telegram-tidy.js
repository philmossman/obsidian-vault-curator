#!/usr/bin/env node
/**
 * Telegram Tidy - Handle /tidy command
 * Phase 4.3: Vault housekeeping
 *
 * Usage: /tidy [dupes|structure|stubs|all] [dryrun]
 */

const { runTidy } = require('./tidy-executor');

// ────────────────────────────────────────────────────────────────────────────
// Command handler
// ────────────────────────────────────────────────────────────────────────────

/**
 * Handle /tidy command from Telegram.
 *
 * @param {string} argsString - Raw argument string from the command
 * @returns {Promise<string>} Formatted response message
 */
async function handleTidyCommand(argsString = '') {
  try {
    const { checks, dryRun } = parseArgs(argsString);

    console.log(`[tidy] Running: checks=${checks.join(',')} dryRun=${dryRun}`);
    const results = await runTidy({ checks, dryRun });

    return formatTidyResults(results);
  } catch (err) {
    return `❌ Tidy failed: ${err.message}\n\nUsage: /tidy [dupes|structure|stubs|all] [dryrun]`;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Argument parsing
// ────────────────────────────────────────────────────────────────────────────

/**
 * Parse /tidy arguments.
 *
 * Valid positional args: dupes, structure, stubs, all
 * Flags: dryrun / dry / dry-run
 *
 * Examples:
 *   ""             → { checks: ['all'], dryRun: false }
 *   "dryrun"       → { checks: ['all'], dryRun: true }
 *   "dupes dryrun" → { checks: ['dupes'], dryRun: true }
 *   "stubs structure" → { checks: ['stubs','structure'], dryRun: false }
 */
function parseArgs(argsString) {
  const parts = (argsString || '').trim().toLowerCase().split(/\s+/).filter(Boolean);

  const VALID_CHECKS = ['dupes', 'structure', 'stubs', 'all'];
  const DRY_FLAGS = ['dryrun', 'dry', 'dry-run'];

  const checks = parts.filter(p => VALID_CHECKS.includes(p));
  const dryRun = parts.some(p => DRY_FLAGS.includes(p));

  if (checks.length === 0) checks.push('all');

  return { checks, dryRun };
}

// ────────────────────────────────────────────────────────────────────────────
// Report formatter
// ────────────────────────────────────────────────────────────────────────────

/**
 * Format tidy results for Telegram output.
 * Matches the spec's report format.
 *
 * @param {Object} results - Results from runTidy()
 * @returns {string} Formatted message
 */
function formatTidyResults(results) {
  const lines = [];
  const date = new Date().toISOString().slice(0, 10);

  lines.push(`🧹 TIDY REPORT — ${date}`);
  if (results.dryRun) {
    lines.push('🔍 DRY RUN — no changes made');
  }
  lines.push('');

  // ── Auto-fixed (high-confidence rule hits) ─────────────────────────────────
  const autoActionable = results.autoFixed.filter(r => r.action !== 'keep');
  if (autoActionable.length > 0) {
    lines.push(`✅ AUTO-FIXED (confidence ≥ 0.8):`);
    for (const item of autoActionable.slice(0, 25)) {
      lines.push(formatActionLine(item));
    }
    if (autoActionable.length > 25) {
      lines.push(`  ... and ${autoActionable.length - 25} more`);
    }
    lines.push('');
  }

  // ── AI-resolved ────────────────────────────────────────────────────────────
  const aiActionable = results.aiFixed.filter(r => r.action !== 'keep' && r.action !== 'flag');
  if (aiActionable.length > 0) {
    lines.push(`🤖 AI-RESOLVED:`);
    for (const item of aiActionable.slice(0, 15)) {
      lines.push(formatActionLine(item));
      if (item.aiReasoning) {
        lines.push(`           ${item.aiReasoning}`);
      }
    }
    if (aiActionable.length > 15) {
      lines.push(`  ... and ${aiActionable.length - 15} more`);
    }
    lines.push('');
  }

  // ── AI kept (decided to leave alone) ──────────────────────────────────────
  const aiKept = results.aiFixed.filter(r => r.action === 'keep');
  if (aiKept.length > 0) {
    lines.push(`✔️  AI KEPT (no action):`);
    for (const item of aiKept.slice(0, 5)) {
      lines.push(`  [kept]    ${item.path}`);
      if (item.aiReasoning) lines.push(`           ${item.aiReasoning}`);
    }
    if (aiKept.length > 5) lines.push(`  ... and ${aiKept.length - 5} more`);
    lines.push('');
  }

  // ── Flagged for review ─────────────────────────────────────────────────────
  if (results.flagged.length > 0) {
    lines.push(`⚠️  FLAGGED FOR REVIEW:`);
    for (const item of results.flagged.slice(0, 10)) {
      const detail = item.flagReason || item.reason || '';
      lines.push(`  [review]  ${item.path}`);
      if (detail) lines.push(`            ${detail}`);
    }
    if (results.flagged.length > 10) {
      lines.push(`  ... and ${results.flagged.length - 10} more flagged`);
    }
    lines.push('');
  }

  // ── Failures ───────────────────────────────────────────────────────────────
  if (results.failed.length > 0) {
    lines.push(`❌ FAILED:`);
    for (const item of results.failed.slice(0, 5)) {
      lines.push(`  ${item.path}: ${item.error}`);
    }
    if (results.failed.length > 5) lines.push(`  ... and ${results.failed.length - 5} more`);
    lines.push('');
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const allFixed = [...results.autoFixed, ...results.aiFixed];
  const deleted  = allFixed.filter(r => r.action === 'delete').length;
  const moved    = allFixed.filter(r => r.action === 'move').length;
  const kept     = allFixed.filter(r => r.action === 'keep').length;

  lines.push(`📊 SUMMARY:`);
  lines.push(`  Scanned: ${results.totalNotes} notes`);
  lines.push(`  Issues found: ${results.totalIssues}`);
  lines.push(`  Deleted: ${deleted}`);
  lines.push(`  Moved: ${moved}`);
  if (kept > 0) lines.push(`  Kept (no action): ${kept}`);
  lines.push(`  Flagged: ${results.flagged.length}`);
  if (results.failed.length > 0) lines.push(`  Failed: ${results.failed.length}`);

  if (!results.dryRun && (deleted + moved) > 0) {
    lines.push('');
    lines.push(`Run /undo ${results.sessionId} to reverse all auto-fixes.`);
  }

  return lines.join('\n');
}

/** Format a single action line for the report. */
function formatActionLine(item) {
  if (item.action === 'delete') {
    return `  [deleted]  ${item.path}${item.reason ? `  (${item.reason})` : ''}`;
  }
  if (item.action === 'move' && item.targetPath) {
    return `  [moved]    ${item.path} → ${item.targetPath}`;
  }
  return `  [${item.action}]    ${item.path}`;
}

// ────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1).join(' ');

  let response;

  if (command === 'tidy') {
    response = await handleTidyCommand(commandArgs);
  } else {
    response = [
      '❌ Unknown command: ' + command,
      '',
      'Available:',
      '  /tidy [dupes|structure|stubs|all] [dryrun]',
      '  /tidy dupes dryrun',
      '  /tidy structure',
      '  /tidy stubs'
    ].join('\n');
  }

  console.log(response);
}

if (require.main === module) {
  main().catch(err => {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  handleTidyCommand,
  parseArgs,
  formatTidyResults
};
