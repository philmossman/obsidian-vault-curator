#!/usr/bin/env node
/**
 * Telegram handler for /audit structure command
 * 
 * Analyzes vault organization and provides recommendations
 */

const VaultClient = require('./vault-client');
const { StructureAuditor } = require('./structure-auditor');
const loadConfig = require('./config');

async function handleAuditCommand(message) {
  const config = loadConfig();
  const client = new VaultClient(config.couchdb);
  const auditor = new StructureAuditor(client);
  
  try {
    const report = await auditor.analyze();
    return formatReport(report);
  } catch (err) {
    return `❌ Audit failed: ${err.message}`;
  }
}

function formatReport(report) {
  const { summary, issues, recommendations, structure } = report;
  
  let output = [];
  
  // Header
  output.push('📊 **Vault Structure Audit Report**\n');
  
  // Summary
  output.push('**📈 Summary**');
  output.push(`• Total notes: ${summary.totalNotes}`);
  output.push(`• Total folders: ${summary.totalFolders}`);
  
  if (summary.detectedMethodology) {
    const method = summary.detectedMethodology;
    const emoji = method.confidence === 'high' ? '✅' :
                 method.confidence === 'medium' ? '⚠️' : '❓';
    output.push(`• Methodology: ${emoji} ${method.method.name}`);
    output.push(`  (${method.matches}/${method.total} folders, ${method.confidence} confidence)`);
  } else {
    output.push('• Methodology: ❌ None detected');
  }
  
  output.push(`• Issues found: ${summary.issuesCount}`);
  output.push(`• Recommendations: ${summary.recommendationsCount}\n`);
  
  // Top-level structure
  output.push('**📁 Top-Level Folders**');
  structure.topLevel.slice(0, 8).forEach(f => {
    // Show total if different from direct count
    if (f.total !== f.count) {
      output.push(`• ${f.folder}: ${f.total} notes (${f.count} direct, ${f.total - f.count} nested) — ${f.percentage}%`);
    } else {
      output.push(`• ${f.folder}: ${f.count} notes (${f.percentage}%)`);
    }
  });
  if (structure.topLevel.length > 8) {
    output.push(`• ... and ${structure.topLevel.length - 8} more`);
  }
  output.push('');
  
  // Issues (if any)
  if (issues.length > 0) {
    output.push('**⚠️ Issues Detected**\n');
    
    const high = issues.filter(i => i.severity === 'high');
    const medium = issues.filter(i => i.severity === 'medium');
    const low = issues.filter(i => i.severity === 'low');
    
    if (high.length > 0) {
      output.push('**🔴 High Priority:**');
      high.forEach(issue => {
        output.push(`• ${issue.issue}`);
        output.push(`  ${issue.detail}`);
        output.push(`  💡 ${issue.recommendation}\n`);
      });
    }
    
    if (medium.length > 0) {
      output.push('**🟡 Medium Priority:**');
      medium.forEach(issue => {
        output.push(`• ${issue.issue}`);
        output.push(`  ${issue.detail}`);
        output.push(`  💡 ${issue.recommendation}\n`);
      });
    }
    
    if (low.length > 0) {
      output.push('**🟢 Low Priority:**');
      low.forEach(issue => {
        output.push(`• ${issue.issue}`);
        output.push(`  ${issue.detail}`);
        output.push(`  💡 ${issue.recommendation}\n`);
      });
    }
  } else {
    output.push('**✅ No Issues Detected**\n');
  }
  
  // Recommendations
  if (recommendations.length > 0) {
    output.push('**💡 Recommendations**\n');
    
    recommendations.forEach(rec => {
      const emoji = rec.priority === 'high' ? '🔴' :
                   rec.priority === 'medium' ? '🟡' : '🟢';
      output.push(`${emoji} **${rec.title}**`);
      output.push(`${rec.detail}`);
      output.push(`**Action:** ${rec.action}\n`);
    });
  }
  
  // Next steps
  output.push('**🎯 Next Steps**');
  if (issues.filter(i => i.severity === 'high').length > 0) {
    output.push('1. Address high-priority issues first');
    output.push('2. Review and implement recommendations');
    output.push('3. Re-run audit after changes: /audit structure');
  } else {
    output.push('1. Review recommendations');
    output.push('2. Implement changes gradually');
    output.push('3. Re-audit periodically to maintain structure');
  }
  
  return output.join('\n');
}

// CLI usage (for testing)
if (require.main === module) {
  const args = process.argv.slice(2);
  const message = args.join(' ');
  
  handleAuditCommand(message)
    .then(response => {
      console.log(response);
    })
    .catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
}

module.exports = { handleAuditCommand };
