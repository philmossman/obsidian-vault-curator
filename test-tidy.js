#!/usr/bin/env node
/**
 * test-tidy.js — Unit tests for Phase 4.3 tidy scanner logic
 *
 * Tests the rule-based detection functions without hitting CouchDB.
 * Focus: duplicate detection, structure violations, dead note detection.
 *
 * Run: node test-tidy.js
 */

const {
  detectDuplicates,
  detectStructureViolations,
  detectDeadNotes,
  deduplicateByPath,
  isSystemPath,
  isAtRoot,
  isRootException,
  isInCanonicalFolder,
  isTestFilename,
  isIndexOrReadme,
  DEFAULT_CANONICAL_FOLDERS,
  TINY_NOTE_THRESHOLD
} = require('./tidy-scanner');

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

// ─── Helper path helpers ───────────────────────────────────────────────────

section('Path helpers');
assert(isSystemPath('logs/debug.md'), 'logs/ is system path');
assert(isSystemPath('ix:iphone/prefs.md'), 'ix:iphone/ is system path');
assert(isSystemPath('ix:macbook/prefs.md'), 'ix:macbook/ is system path');
assert(!isSystemPath('Projects/foo.md'), 'Projects/ is not system path');
assert(!isSystemPath('inbox/note.md'), 'inbox/ is not system path');

assert(isAtRoot('note.md'), 'note.md is at root');
assert(!isAtRoot('Projects/note.md'), 'Projects/note.md is not at root');

assert(isRootException('index.md'), 'index.md is root exception');
assert(isRootException('welcome.md'), 'welcome.md is root exception');
assert(!isRootException('random.md'), 'random.md is not root exception');

assert(isInCanonicalFolder('Projects/foo.md', DEFAULT_CANONICAL_FOLDERS), 'Projects/foo.md is canonical');
assert(isInCanonicalFolder('inbox/bar.md', DEFAULT_CANONICAL_FOLDERS), 'inbox/bar.md is canonical');
assert(!isInCanonicalFolder('RandomFolder/foo.md', DEFAULT_CANONICAL_FOLDERS), 'RandomFolder/ is not canonical');

assert(isTestFilename('test.md'), 'test.md is test filename');
assert(isTestFilename('test-note.md'), 'test-note.md is test filename');
assert(isTestFilename('untitled.md'), 'untitled.md is test filename');
assert(!isTestFilename('my-research.md'), 'my-research.md is not a test filename');

assert(isIndexOrReadme('README.md'), 'README.md is index/readme');
assert(isIndexOrReadme('index.md'), 'index.md is index/readme');
assert(!isIndexOrReadme('my-note.md'), 'my-note.md is not index/readme');

// ─── Duplicate detection ───────────────────────────────────────────────────

section('Duplicate detection');

const canonicalFolders = DEFAULT_CANONICAL_FOLDERS;

// Exact duplicate: same filename, same size
const exactDupeNotes = [
  { path: 'Projects/foo/my-note.md', size: 500 },
  { path: 'inbox/my-note.md', size: 500 }
];
const exactDupes = detectDuplicates(exactDupeNotes, canonicalFolders);
assert(exactDupes.length === 1, 'Exact duplicate detected (1 issue)');
assert(exactDupes[0].subtype === 'exact', 'Issue subtype is exact');
assert(exactDupes[0].path === 'inbox/my-note.md', 'Inbox copy flagged (Projects preferred)');
// inbox/ is canonical, so confidence is 0.72 (canonical dupe) not 0.92 (non-canonical)
assert(exactDupes[0].confidence >= 0.7, 'Adequate confidence for canonical-folder dupe (0.72)');

// No duplicate: same filename, different folders, different sizes
const divergedNotes = [
  { path: 'Projects/alpha/README.md', size: 400 },
  { path: 'Projects/beta/README.md', size: 600 }
];
const diverged = detectDuplicates(divergedNotes, canonicalFolders);
assert(diverged.length === 0, 'README.md in separate projects not flagged (intentional)');

// Diverged duplicate: same filename, one misplaced
const divergedMisplaced = [
  { path: 'Projects/foo/guide.md', size: 400 },
  { path: 'guide.md', size: 600 } // at root — misplaced
];
const divergedResult = detectDuplicates(divergedMisplaced, canonicalFolders);
assert(divergedResult.length === 1, 'Root-level diverged copy flagged');
assert(divergedResult[0].subtype === 'diverged', 'Subtype is diverged');
assert(divergedResult[0].path === 'guide.md', 'Root copy is the flagged one');

// No issue when only one note
const singleNote = [{ path: 'Projects/foo/my-note.md', size: 500 }];
assert(detectDuplicates(singleNote, canonicalFolders).length === 0, 'Single note: no duplicates');

// ─── Structure violation detection ────────────────────────────────────────

section('Structure violation detection');

const structNotes = [
  { path: 'Projects/valid-note.md', size: 500 },
  { path: 'RandomStuff/misplaced.md', size: 500 },
  { path: 'floating-note.md', size: 500 },
  { path: 'test.md', size: 100 },         // root test file
  { path: 'index.md', size: 200 }          // root exception
];

const structIssues = detectStructureViolations(structNotes, canonicalFolders);
const misplacedFolder = structIssues.find(i => i.path === 'RandomStuff/misplaced.md');
const floatingNote   = structIssues.find(i => i.path === 'floating-note.md');
const testFile       = structIssues.find(i => i.path === 'test.md');
const validNote      = structIssues.find(i => i.path === 'Projects/valid-note.md');
const indexFile      = structIssues.find(i => i.path === 'index.md');

assert(!!misplacedFolder, 'RandomStuff/ note flagged as non-canonical');
assert(misplacedFolder.subtype === 'non-canonical-folder', 'Subtype: non-canonical-folder');
assert(!!floatingNote, 'Root-level note flagged');
assert(floatingNote.subtype === 'root-misplaced', 'Subtype: root-misplaced');
assert(!!testFile, 'Root test.md flagged');
assert(testFile.subtype === 'root-stub', 'Subtype: root-stub');
assert(!validNote, 'Projects/ note NOT flagged');
assert(!indexFile, 'index.md (root exception) NOT flagged');

// ─── Dead note detection ──────────────────────────────────────────────────

section('Dead note detection');

const deadNotes = [
  { path: 'Projects/empty.md', size: 0 },
  { path: 'Projects/test-thing.md', size: 200 },
  { path: 'Projects/tiny-stub.md', size: 50 },
  { path: 'inbox/tiny-capture.md', size: 50 }, // inbox: skip
  { path: 'Projects/readme.md', size: 80 },    // README: skip
  { path: 'Projects/solid-note.md', size: 1000 }
];

const deadIssues = detectDeadNotes(deadNotes);
const emptyNote    = deadIssues.find(i => i.path === 'Projects/empty.md');
const testFilename = deadIssues.find(i => i.path === 'Projects/test-thing.md');
const tinyStub     = deadIssues.find(i => i.path === 'Projects/tiny-stub.md');
const inboxTiny    = deadIssues.find(i => i.path === 'inbox/tiny-capture.md');
const readmeSmall  = deadIssues.find(i => i.path === 'Projects/readme.md');
const solidNote    = deadIssues.find(i => i.path === 'Projects/solid-note.md');

assert(!!emptyNote, 'Empty note (0 bytes) flagged');
assert(emptyNote.confidence >= 0.9, 'Empty note: high confidence');
assert(emptyNote.suggestedAction === 'delete', 'Empty note: delete action');
assert(!!testFilename, 'Test filename note flagged');
assert(!!tinyStub, 'Tiny stub (<300 bytes) flagged');
assert(tinyStub.confidence < 0.5, 'Tiny stub: low confidence (needs AI triage)');
assert(!inboxTiny, 'Inbox tiny note NOT flagged (may be fresh capture)');
assert(!readmeSmall, 'Small README.md NOT flagged (intentionally short)');
assert(!solidNote, 'Solid note (1000 bytes) NOT flagged');

// ─── Deduplication ───────────────────────────────────────────────────────

section('Issue deduplication');

const overlapping = [
  { path: 'test.md', type: 'stub', confidence: 0.87 },
  { path: 'test.md', type: 'structure', confidence: 0.62 }
];
const deduped = deduplicateByPath(overlapping);
assert(deduped.length === 1, 'Overlapping issues for same path deduped to 1');
assert(deduped[0].confidence === 0.87, 'Highest confidence issue kept');

// ─── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('❌ Some tests failed');
  process.exit(1);
} else {
  console.log('✅ All tests passed');
}
