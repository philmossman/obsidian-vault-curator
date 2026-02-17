#!/usr/bin/env node

/**
 * Telegram handler for /distill command
 * 
 * Usage:
 *   /distill              - Distill last 7 days (default)
 *   /distill weekly       - Same as default
 *   /distill all          - Distill all memory files
 *   /distill 14           - Distill last 14 days
 *   /distill dryrun       - Preview what would happen
 */

const distiller = require('./distiller');

async function handleDistill(args = []) {
  // Parse arguments
  let days = 7;
  let dryRun = false;

  for (const arg of args) {
    const lower = arg.toLowerCase();
    
    if (lower === 'weekly') {
      days = 7;
    } else if (lower === 'all') {
      days = 365; // Effectively all files
    } else if (lower === 'dryrun' || lower === 'dry-run') {
      dryRun = true;
    } else if (/^\d+$/.test(arg)) {
      days = parseInt(arg);
    }
  }

  console.log(`Starting distillation: ${days} days, dry-run: ${dryRun}`);

  try {
    // Run distillation
    const report = await distiller.distill({ days, dryRun });

    // Format report
    const message = distiller.formatReport(report);

    return {
      success: true,
      message,
      report
    };
  } catch (error) {
    console.error('Distillation failed:', error);
    return {
      success: false,
      message: `❌ Distillation failed: ${error.message}`,
      error: error.message
    };
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  handleDistill(args)
    .then(result => {
      console.log(result.message);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Handler failed:', error);
      process.exit(1);
    });
}

module.exports = { handleDistill };
