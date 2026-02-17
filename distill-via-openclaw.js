#!/usr/bin/env node

/**
 * Distillation via OpenClaw Session
 * 
 * This script is called by OpenClaw agent sessions to perform distillation
 * using the agent's AI capabilities rather than direct Anthropic API calls.
 * 
 * Usage from OpenClaw agent:
 *   const result = await exec('node vault-curator/distill-via-openclaw.js 7')
 *   // Reads prompt from stdin, returns insights as JSON
 */

const distiller = require('./distiller');
const fs = require('fs').promises;

/**
 * AI extraction function that outputs prompt for OpenClaw agent to process
 * Returns a promise that will be resolved when insights are provided
 */
function createExtractionFunction() {
  return async (prompt, content) => {
    // Write extraction request to a temp file for the agent to read
    const requestFile = '/tmp/distill-request.json';
    const responseFile = '/tmp/distill-response.json';
    
    await fs.writeFile(requestFile, JSON.stringify({
      prompt,
      content,
      timestamp: Date.now()
    }));

    // Output instruction for agent
    console.log('EXTRACTION_NEEDED');
    console.log(`Request written to: ${requestFile}`);
    console.log(`Awaiting response at: ${responseFile}`);

    // Wait for response file (timeout after 120s)
    const startTime = Date.now();
    while (Date.now() - startTime < 120000) {
      try {
        const response = await fs.readFile(responseFile, 'utf-8');
        await fs.unlink(responseFile); // Clean up
        await fs.unlink(requestFile);
        return JSON.parse(response);
      } catch (err) {
        // File not ready yet, wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    throw new Error('Extraction timeout - no response from OpenClaw agent');
  };
}

async function main() {
  const args = process.argv.slice(2);
  const days = parseInt(args[0]) || 7;
  const dryRun = args.includes('--dry-run');

  console.log(`Starting OpenClaw-powered distillation (${days} days, dry-run: ${dryRun})`);

  try {
    const report = await distiller.distill({
      days,
      dryRun,
      extractionFn: createExtractionFunction()
    });

    console.log('\n' + distiller.formatReport(report));
    
    // Output as JSON for programmatic use
    console.log('\n---JSON-REPORT---');
    console.log(JSON.stringify(report, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Distillation failed:', error);
    process.exit(1);
  }
}

main();
