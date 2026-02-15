#!/usr/bin/env node
/**
 * Create initial vault folder structure
 */

const VaultClient = require('./vault-client');
const path = require('path');

// Load credentials from config.json
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')).couchdb;

const vault = new VaultClient(config);

const folders = [
  {
    path: 'Projects/__README.md',
    content: `---
created: 2026-02-10T18:20:00.000Z
path: Projects/__README.md
---

# Projects

Active, goal-oriented work with defined outcomes and deadlines.

When a project completes, move it to [[Archives/__README|Archives]].

## Examples
- Photography shoots with delivery dates
- Software builds
- Courses being taken

Create subfolders for active projects.`,
    tags: ['meta', 'PARA']
  },
  {
    path: 'Areas/__README.md',
    content: `---
created: 2026-02-10T18:20:00.000Z
path: Areas/__README.md
---

# Areas

Ongoing domains of responsibility without deadlines.

These are maintained continuously, never "complete".

## Current Areas
- [[Equestrian Photography]]
- [[Software Development]]
- [[Personal Finances]]
- [[Health]]

Add notes here for ongoing commitments and domains.`,
    tags: ['meta', 'PARA']
  },
  {
    path: 'Resources/__README.md',
    content: `---
created: 2026-02-10T18:20:00.000Z
path: Resources/__README.md
---

# Resources

Reference materials, templates, and knowledge.

Organize when used, archive when obsolete.

## Categories
- Photography Techniques
- Code Snippets
- Life Admin Templates
- Reading List

Add reference materials here.`,
    tags: ['meta', 'PARA']
  },
  {
    path: 'Archives/__README.md',
    content: `---
created: 2026-02-10T18:20:00.000Z
path: Archives/__README.md
---

# Archives

Completed projects and inactive resources.

When something is no longer active, it comes here. Review annually.

## Contents
- Completed projects (from [[Projects/__README| Projects]])
- Outdated resources (from [[Resources/__README| Resources]])

Delete what stays unused after review.`,
    tags: ['meta', 'PARA']
  },
  {
    path: 'Slipbox/__README.md',
    content: `---
created: 2026-02-10T18:20:00.000Z
path: Slipbox/__README.md
---

# Slipbox

Zettelkasten atomic notes - one idea per note.

Each note should:
- Contain one atomic idea
- Link to related notes using [[backlinks]]
- Have a unique ID (timestamp-based)

Example: [[202602101200 - Note about horse photography|]]

The magic emerges from the connections between ideas, not the folders.`,
    tags: ['meta', 'Zettelkasten']
  },
  {
    path: 'Atlas/__README.md',
    content: `---
created: 2026-02-10T18:20:00.000Z
path: Atlas/__README.md
---

# Atlas

Maps of Content (MOCs) and navigation entry points.

Think of these as table of contents for topics that span multiple notes.

- [[Index]] - Master navigation
- [[Projects MOC]] - Active projects overview
- [[Photography MOC]] - Equestrian photography hub

Create MOCs to navigate complex topics without rigid categories.`,
    tags: ['meta', 'MOC']
  },
  {
    path: 'Index.md',
    content: `---
created: 2026-02-10T18:20:00.000Z
path: Index.md
---

# Index

Entry point to the vault.

## Navigation
- [[Inbox]] - Captured notes (process me!)
- [[Projects/__README|Projects]] - Active work
- [[Areas/__README|Areas]] - Ongoing domains
- [[Resources/__README|Resources]] - Reference
- [[Slipbox/__README|Slipbox]] - Atomic ideas
- [[Archives/__README|Archives]] - Completed/inactive
- [[Atlas/__README|Atlas]] - Maps & entry points

## Recent Notes
_(Last 5 notes added)_`,
    tags: ['meta', 'index']
  }
];

async function createFolders() {
  console.log('Creating vault folder structure...\n');
  const results = [];

  for (const folder of folders) {
    try {
      // Check if exists
      const existing = await vault.readNote(folder.path);
      if (existing) {
        console.log(`  ↻ Exists: ${folder.path}`);
        results.push({ path: folder.path, status: 'exists' });
        continue;
      }

      // Create with frontmatter
      const content = folder.content;
      const result = await vault.writeNote(folder.path, content);
      console.log(`  ✓ Created: ${folder.path}`);
      results.push({ path: folder.path, status: 'created', id: result.id });

    } catch (err) {
      console.error(`  ✗ Failed: ${folder.path} - ${err.message}`);
      results.push({ path: folder.path, status: 'error', error: err.message });
    }
  }

  console.log('\nDone! Sync Obsidian to see the folders.');
  console.log(`\nSummary: ${results.filter(r => r.status === 'created').length} created, ${results.filter(r => r.status === 'exists').length} already existed`);

  return results;
}

createFolders().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
