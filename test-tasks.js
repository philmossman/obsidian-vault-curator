#!/usr/bin/env node
/**
 * Task System Tests
 *
 * Comprehensive tests for task-parser, task-store, and task-briefing.
 * Uses mock vault-client (no CouchDB required).
 *
 * Run: node test-tasks.js
 */

const { parseTask, extractDate, extractPriority, detectProject } = require('./task-parser');
const TaskStore = require('./task-store');
const { generateTaskBrief } = require('./task-briefing');

// ─── Test Framework ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`  ✅ ${name}\n`);
    passed++;
  } catch (err) {
    process.stdout.write(`  ❌ ${name}\n     ${err.message}\n`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function assertEqual(actual, expected, msg = '') {
  const aStr = JSON.stringify(actual);
  const eStr = JSON.stringify(expected);
  if (aStr !== eStr) {
    throw new Error(`${msg ? msg + ': ' : ''}Expected ${eStr}, got ${aStr}`);
  }
}

function assertContains(str, substr, msg = '') {
  if (typeof str !== 'string' || !str.includes(substr)) {
    throw new Error(`${msg ? msg + ': ' : ''}"${str}" does not contain "${substr}"`);
  }
}

function assertNull(val, msg = '') {
  if (val !== null) {
    throw new Error(`${msg ? msg + ': ' : ''}Expected null, got ${JSON.stringify(val)}`);
  }
}

function assertNotNull(val, msg = '') {
  if (val === null || val === undefined) {
    throw new Error(`${msg ? msg + ': ' : ''}Expected non-null, got ${JSON.stringify(val)}`);
  }
}

function section(name) {
  console.log(`\n── ${name} ${'─'.repeat(Math.max(0, 60 - name.length))}`);
}

// ─── Reference date for deterministic tests ───────────────────────────────────
// Monday 2026-02-17 (today in the session context)
const REF = new Date('2026-02-17T10:00:00.000Z');

// ─── task-parser.js Tests ─────────────────────────────────────────────────────

section('task-parser: Priority Detection');

test('detects high priority from "URGENT:" prefix', () => {
  const result = parseTask('URGENT: renew horse insurance before March 1st', REF);
  assertEqual(result.priority, 'high');
});

test('detects high priority from "urgent:" (lowercase)', () => {
  const result = parseTask('urgent: call the vet', REF);
  assertEqual(result.priority, 'high');
});

test('detects high priority from inline "urgent"', () => {
  const result = parseTask('renew car insurance urgently', REF);
  assertEqual(result.priority, 'high');
});

test('detects high priority from "asap"', () => {
  const result = parseTask('fix the fence asap', REF);
  assertEqual(result.priority, 'high');
});

test('detects high priority from "important"', () => {
  const result = parseTask('important: review the contract', REF);
  assertEqual(result.priority, 'high');
});

test('detects normal priority by default', () => {
  const result = parseTask('remind me to chase the farrier next Tuesday', REF);
  assertEqual(result.priority, 'normal');
});

test('detects low priority from "no rush"', () => {
  const result = parseTask('reorganise the stable no rush', REF);
  assertEqual(result.priority, 'low');
});

// ─────────────────────────────────────────────────────────────────────────────

section('task-parser: Project Detection');

test('detects Photography project', () => {
  const result = parseTask('review the photography PRs by Friday', REF);
  assertEqual(result.project, 'Photography');
});

test('detects Photography from "photos"', () => {
  const result = parseTask('back up photos from the shoot', REF);
  assertEqual(result.project, 'Photography');
});

test('detects Crypto project', () => {
  const result = parseTask('check bitcoin wallet balance', REF);
  assertEqual(result.project, 'Crypto');
});

test('detects Equestrian from "farrier"', () => {
  const result = parseTask('chase the farrier next Tuesday', REF);
  assertEqual(result.project, 'Equestrian');
});

test('detects Equestrian from "horse"', () => {
  const result = parseTask('URGENT: renew horse insurance before March 1st', REF);
  assertEqual(result.project, 'Equestrian');
});

test('detects Work project', () => {
  const result = parseTask('send invoice to client by end of month', REF);
  assertEqual(result.project, 'Work');
});

test('returns null for no project', () => {
  const result = parseTask('buy milk tomorrow', REF);
  assertNull(result.project);
});

// ─────────────────────────────────────────────────────────────────────────────

section('task-parser: Date Parsing');

test('"tomorrow" → next day', () => {
  const result = parseTask('buy milk tomorrow', REF);
  assertEqual(result.due, '2026-02-18');
});

test('"today" → today', () => {
  const result = parseTask('call the vet today', REF);
  assertEqual(result.due, '2026-02-17');
});

test('"next Tuesday" (REF=Mon) → following Tuesday', () => {
  // REF is Monday 2026-02-17. "next Tuesday" = Tuesday of next week = 2026-02-24
  const result = parseTask('chase the farrier next Tuesday', REF);
  assertEqual(result.due, '2026-02-24');
});

test('"by Friday" (REF=Mon) → this Friday', () => {
  // REF is Monday 2026-02-17. Next Friday = 2026-02-20
  const result = parseTask('review photography PRs by Friday', REF);
  assertEqual(result.due, '2026-02-20');
});

test('"before March 1st" → 2026-03-01', () => {
  const result = parseTask('renew horse insurance before March 1st', REF);
  assertEqual(result.due, '2026-03-01');
});

test('"before March 1" (no ordinal)', () => {
  const result = parseTask('renew horse insurance before March 1', REF);
  assertEqual(result.due, '2026-03-01');
});

test('"in 3 days" → addDays(REF, 3)', () => {
  const result = parseTask('call plumber in 3 days', REF);
  assertEqual(result.due, '2026-02-20');
});

test('"in 2 weeks"', () => {
  const result = parseTask('review budget in 2 weeks', REF);
  assertEqual(result.due, '2026-03-03');
});

test('"next week"', () => {
  const result = parseTask('plan the trip next week', REF);
  assertEqual(result.due, '2026-02-24');
});

test('"next month"', () => {
  const result = parseTask('renew subscription next month', REF);
  assertEqual(result.due, '2026-03-17');
});

test('"this weekend" → Saturday', () => {
  // REF is Monday 2026-02-17. Next Saturday = 2026-02-21
  const result = parseTask('clean the stable this weekend', REF);
  assertEqual(result.due, '2026-02-21');
});

test('"end of month" → last day of Feb 2026', () => {
  const result = parseTask('submit expenses end of month', REF);
  assertEqual(result.due, '2026-02-28');
});

test('no date → null', () => {
  const result = parseTask('organise tool shed', REF);
  assertNull(result.due);
});

test('explicit ISO date "2026-03-15"', () => {
  const result = parseTask('dentist appointment 2026-03-15', REF);
  assertEqual(result.due, '2026-03-15');
});

test('month day with ordinal "April 5th"', () => {
  const result = parseTask('tax return by April 5th', REF);
  assertEqual(result.due, '2026-04-05');
});

// ─────────────────────────────────────────────────────────────────────────────

section('task-parser: Title Extraction');

test('strips "remind me to"', () => {
  const result = parseTask('remind me to chase the farrier next Tuesday', REF);
  assertEqual(result.title, 'Chase the farrier');
});

test('strips "I need to"', () => {
  const result = parseTask('I need to review those photography PRs by Friday', REF);
  assertEqual(result.title, 'Review those photography PRs');
});

test('strips "URGENT:" prefix', () => {
  const result = parseTask('URGENT: renew horse insurance before March 1st', REF);
  assertEqual(result.title, 'Renew horse insurance');
});

test('strips "urgent:" (lowercase)', () => {
  const result = parseTask('urgent: call the vet tomorrow', REF);
  assertEqual(result.title, 'Call the vet');
});

test('strips "don\'t forget to"', () => {
  const result = parseTask("don't forget to pay the farrier by Friday", REF);
  assertEqual(result.title, 'Pay the farrier');
});

test('capitalises first letter', () => {
  const result = parseTask('buy new saddle pad', REF);
  assertEqual(result.title, 'Buy new saddle pad');
});

test('no opener phrase — passes through cleanly', () => {
  const result = parseTask('Book dentist appointment', REF);
  assertEqual(result.title, 'Book dentist appointment');
});

test('empty string → Untitled task', () => {
  const result = parseTask('', REF);
  assertEqual(result.title, 'Untitled task');
});

test('strips "by Friday" from title', () => {
  const result = parseTask('submit report by Friday', REF);
  assertEqual(result.title, 'Submit report');
});

// ─────────────────────────────────────────────────────────────────────────────

section('task-parser: Full Integration Examples');

test('example 1: chase the farrier', () => {
  const result = parseTask('remind me to chase the farrier next Tuesday', REF);
  assertEqual(result.title, 'Chase the farrier');
  assertEqual(result.due, '2026-02-24');
  assertEqual(result.project, 'Equestrian');
  assertEqual(result.priority, 'normal');
});

test('example 2: photography PRs', () => {
  const result = parseTask('I need to review those photography PRs by Friday', REF);
  assertEqual(result.title, 'Review those photography PRs');
  assertEqual(result.due, '2026-02-20');
  assertEqual(result.project, 'Photography');
  assertEqual(result.priority, 'normal');
});

test('example 3: horse insurance', () => {
  const result = parseTask('URGENT: renew horse insurance before March 1st', REF);
  assertEqual(result.title, 'Renew horse insurance');
  assertEqual(result.due, '2026-03-01');
  assertEqual(result.project, 'Equestrian');
  assertEqual(result.priority, 'high');
});

// ─────────────────────────────────────────────────────────────────────────────

section('task-store: CRUD with Mock Vault');

// ── Mock VaultClient ──────────────────────────────────────────────────────────

/**
 * In-memory mock vault for testing task-store without CouchDB.
 */
class MockVault {
  constructor() {
    this.notes = new Map(); // path → content
  }

  async writeNote(path, content) {
    this.notes.set(path, content);
    return { ok: true };
  }

  async readNote(path) {
    const content = this.notes.get(path);
    if (!content) return null;
    return { path, content };
  }

  async listNotes() {
    return Array.from(this.notes.keys()).map(path => ({ path }));
  }

  async deleteNote(path) {
    this.notes.delete(path);
    return { ok: true };
  }

  // Re-use VaultClient's real frontmatter methods (use valid fake URL to avoid nano crash)
  parseFrontmatter(content) {
    const VaultClient = require('./vault-client');
    const tmp = new VaultClient({ host: 'localhost', port: 5984, database: 'test', username: 'u', password: 'p' });
    return tmp.parseFrontmatter(content);
  }

  buildNote(frontmatter, body) {
    const VaultClient = require('./vault-client');
    const tmp = new VaultClient({ host: 'localhost', port: 5984, database: 'test', username: 'u', password: 'p' });
    return tmp.buildNote(frontmatter, body);
  }
}

// ── Store tests ───────────────────────────────────────────────────────────────

function makeStore() {
  const mock = new MockVault();
  const store = new TaskStore(mock);
  return { store, mock };
}

test('createTask stores a note', async () => {
  const { store, mock } = makeStore();
  const task = await store.createTask({ title: 'Test task', due: '2026-02-24', project: null, priority: 'normal' });
  assertEqual(task.title, 'Test task');
  assertEqual(task.due, '2026-02-24');
  assertEqual(mock.notes.size, 1);
});

test('createTask uses Tasks/ folder', async () => {
  const { store } = makeStore();
  const task = await store.createTask({ title: 'Folder check', due: null, project: null, priority: 'normal' });
  if (!task.path.startsWith('Tasks/')) throw new Error(`Path ${task.path} not in Tasks/`);
});

test('listTasks returns created tasks', async () => {
  const { store } = makeStore();
  await store.createTask({ title: 'Task A', due: '2026-02-20', project: null, priority: 'normal' });
  await store.createTask({ title: 'Task B', due: '2026-02-25', project: 'Photography', priority: 'high' });
  const tasks = await store.listTasks();
  assertEqual(tasks.length, 2);
});

test('listTasks filters by status', async () => {
  const { store } = makeStore();
  await store.createTask({ title: 'Open task', due: null, project: null, priority: 'normal' });
  const tasks = await store.listTasks({ status: 'open' });
  assertEqual(tasks.length, 1);
  const done = await store.listTasks({ status: 'done' });
  assertEqual(done.length, 0);
});

test('listTasks filters by project', async () => {
  const { store } = makeStore();
  await store.createTask({ title: 'Photo task', due: null, project: 'Photography', priority: 'normal' });
  await store.createTask({ title: 'Other task', due: null, project: null, priority: 'normal' });
  const tasks = await store.listTasks({ status: 'open', project: 'Photography' });
  assertEqual(tasks.length, 1);
  assertEqual(tasks[0].title, 'Photo task');
});

test('listTasks filters by priority', async () => {
  const { store } = makeStore();
  await store.createTask({ title: 'Urgent task', due: null, project: null, priority: 'high' });
  await store.createTask({ title: 'Normal task', due: null, project: null, priority: 'normal' });
  const high = await store.listTasks({ priority: 'high' });
  assertEqual(high.length, 1);
  assertEqual(high[0].title, 'Urgent task');
});

test('completeTask marks task as done', async () => {
  const { store } = makeStore();
  await store.createTask({ title: 'Chase the farrier', due: '2026-02-24', project: null, priority: 'normal' });
  const result = await store.completeTask('farrier');
  assertEqual(result.ok, true);
  assertEqual(result.task.status, 'done');
  const open = await store.listTasks({ status: 'open' });
  assertEqual(open.length, 0);
  const done = await store.listTasks({ status: 'done' });
  assertEqual(done.length, 1);
});

test('completeTask returns error for missing task', async () => {
  const { store } = makeStore();
  const result = await store.completeTask('nonexistent thing');
  assertEqual(result.ok, false);
  assertContains(result.message, 'No open task');
});

test('completeTask is case-insensitive', async () => {
  const { store } = makeStore();
  await store.createTask({ title: 'Chase the Farrier', due: null, project: null, priority: 'normal' });
  const result = await store.completeTask('FARRIER');
  assertEqual(result.ok, true);
});

test('getOverdue returns past-due tasks only', async () => {
  const { store } = makeStore();
  await store.createTask({ title: 'Past due', due: '2020-01-01', project: null, priority: 'normal' });
  await store.createTask({ title: 'Future', due: '2030-01-01', project: null, priority: 'normal' });
  await store.createTask({ title: 'No date', due: null, project: null, priority: 'normal' });
  const overdue = await store.getOverdue();
  assertEqual(overdue.length, 1);
  assertEqual(overdue[0].title, 'Past due');
});

test('getDueSoon returns tasks within 48h', async () => {
  const { store } = makeStore();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];
  await store.createTask({ title: 'Due tomorrow', due: tomorrowStr, project: null, priority: 'normal' });
  await store.createTask({ title: 'Due next week', due: nextWeekStr, project: null, priority: 'normal' });
  const soon = await store.getDueSoon();
  assertEqual(soon.length, 1);
  assertEqual(soon[0].title, 'Due tomorrow');
});

test('listTasks sorted by due date (ascending)', async () => {
  const { store } = makeStore();
  await store.createTask({ title: 'Later', due: '2026-03-01', project: null, priority: 'normal' });
  await store.createTask({ title: 'Sooner', due: '2026-02-20', project: null, priority: 'normal' });
  await store.createTask({ title: 'No date', due: null, project: null, priority: 'normal' });
  const tasks = await store.listTasks();
  assertEqual(tasks[0].title, 'Sooner');
  assertEqual(tasks[1].title, 'Later');
  assertEqual(tasks[2].title, 'No date');
});

// ─────────────────────────────────────────────────────────────────────────────

section('task-briefing: Summary Generation');

/**
 * Build a mock TaskStore from a list of task objects.
 * @param {Array<Object>} tasks
 * @returns {Object} Fake store compatible with generateTaskBrief
 */
function mockStore(tasks) {
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  return {
    async getOverdue() { return tasks.filter(t => t.due && t.due < todayStr && t.status === 'open'); },
    async getDueSoon() {
      const soon = new Date();
      soon.setHours(soon.getHours() + 48);
      const soonStr = soon.toISOString().split('T')[0];
      return tasks.filter(t => t.due && t.due >= todayStr && t.due <= soonStr && t.status === 'open');
    },
    async listTasks(f) {
      let result = [...tasks];
      if (f && f.status) result = result.filter(t => t.status === f.status);
      return result;
    }
  };
}

test('generates "inbox zero" message when no tasks', async () => {
  const brief = await generateTaskBrief(mockStore([]));
  assertContains(brief, 'inbox zero');
});

test('shows total open count', async () => {
  const tasks = [
    { title: 'A', due: '2030-01-01', priority: 'normal', status: 'open' },
    { title: 'B', due: '2030-01-02', priority: 'normal', status: 'open' },
    { title: 'C', due: null, priority: 'normal', status: 'open' }
  ];
  const brief = await generateTaskBrief(mockStore(tasks));
  assertContains(brief, '3 open');
});

test('shows overdue tasks', async () => {
  const tasks = [
    { title: 'Overdue task', due: '2020-01-01', priority: 'normal', status: 'open' }
  ];
  const brief = await generateTaskBrief(mockStore(tasks));
  assertContains(brief, 'Overdue task');
  assertContains(brief, 'overdue');
});

test('shows high priority flag ⚡', async () => {
  const tasks = [
    { title: 'Urgent thing', due: '2020-01-01', priority: 'high', status: 'open' }
  ];
  const brief = await generateTaskBrief(mockStore(tasks));
  assertContains(brief, '⚡');
});

test('does not show done tasks', async () => {
  const tasks = [
    { title: 'Done thing', due: '2030-01-01', priority: 'normal', status: 'done' }
  ];
  const brief = await generateTaskBrief(mockStore(tasks));
  // Should show inbox zero or no mention of "Done thing"
  if (brief.includes('Done thing')) throw new Error('Done task appeared in brief');
});

test('caps overdue at 3 items', async () => {
  const tasks = Array.from({ length: 6 }, (_, i) => ({
    title: `Overdue ${i + 1}`, due: '2020-01-01', priority: 'normal', status: 'open'
  }));
  const brief = await generateTaskBrief(mockStore(tasks));
  assertContains(brief, 'more overdue');
});

test('shows due soon section', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tasks = [
    { title: 'Due very soon', due: tomorrowStr, priority: 'normal', status: 'open' }
  ];
  const brief = await generateTaskBrief(mockStore(tasks));
  assertContains(brief, 'Due very soon');
  assertContains(brief, 'Due soon');
});

test('handles store error gracefully', async () => {
  const badStore = {
    async getOverdue() { throw new Error('CouchDB unavailable'); },
    async getDueSoon() { return []; },
    async listTasks() { return []; }
  };
  const brief = await generateTaskBrief(badStore);
  assertContains(brief, '⚠️');
  assertContains(brief, 'could not load');
});

// ─────────────────────────────────────────────────────────────────────────────

section('task-parser: Edge Cases');

test('handles null input gracefully', () => {
  const result = parseTask(null, REF);
  assertEqual(result.title, 'Untitled task');
  assertNull(result.due);
});

test('handles only whitespace', () => {
  const result = parseTask('   ', REF);
  assertEqual(result.title, 'Untitled task');
});

test('handles no recognisable content after cleanup', () => {
  // Something that strips entirely — at minimum returns "Untitled task"
  const result = parseTask('remind me to', REF);
  // Title should be non-empty
  if (!result.title || result.title.length === 0) throw new Error('Title is empty');
});

test('month name: "Feb" abbreviation', () => {
  const result = parseTask('dentist by Feb 28', REF);
  assertEqual(result.due, '2026-02-28');
});

test('"next Friday" (REF=Mon) → this Friday (next occurrence)', () => {
  // REF is Monday. "next Friday" should be next week's Friday = 2026-02-27
  const result = parseTask('submit by next Friday', REF);
  assertEqual(result.due, '2026-02-27');
});

test('project is case-insensitive detection', () => {
  const result = parseTask('PHOTOGRAPHY backup drive', REF);
  assertEqual(result.project, 'Photography');
});

// ─────────────────────────────────────────────────────────────────────────────

section('task-store: daysOverdue helper');

test('daysOverdue returns 0 for future tasks', () => {
  const { store } = makeStore();
  const task = { due: '2099-01-01', title: 'Future', status: 'open', priority: 'normal', project: null };
  assertEqual(store.daysOverdue(task), 0);
});

test('daysOverdue returns 0 for null due', () => {
  const { store } = makeStore();
  const task = { due: null, title: 'Undated', status: 'open', priority: 'normal', project: null };
  assertEqual(store.daysOverdue(task), 0);
});

test('daysOverdue returns positive for past tasks', () => {
  const { store } = makeStore();
  const task = { due: '2020-01-01', title: 'Old', status: 'open', priority: 'normal', project: null };
  const days = store.daysOverdue(task);
  if (days <= 0) throw new Error(`Expected positive days, got ${days}`);
});

// ─────────────────────────────────────────────────────────────────────────────

// ── Run async tests ───────────────────────────────────────────────────────────

async function runTests() {
  // Collect async test promises
  const asyncTests = [];

  // We need to re-run the async ones — collect them by wrapping
  // (The sync tests above already ran; the async store/briefing tests need awaiting)
  // Re-run async section tests programmatically:
  console.log('\n── Running async tests ─────────────────────────────────────────────────────');

  const asyncCases = [
    ['store: createTask stores a note', async () => {
      const { store, mock } = makeStore();
      const task = await store.createTask({ title: 'Test task', due: '2026-02-24', project: null, priority: 'normal' });
      assertEqual(task.title, 'Test task');
      assertEqual(mock.notes.size, 1);
    }],
    ['store: createTask uses Tasks/ folder', async () => {
      const { store } = makeStore();
      const task = await store.createTask({ title: 'Folder check', due: null, project: null, priority: 'normal' });
      if (!task.path.startsWith('Tasks/')) throw new Error(`Path ${task.path} not in Tasks/`);
    }],
    ['store: listTasks returns created tasks', async () => {
      const { store } = makeStore();
      await store.createTask({ title: 'Task A', due: '2026-02-20', project: null, priority: 'normal' });
      await store.createTask({ title: 'Task B', due: '2026-02-25', project: 'Photography', priority: 'high' });
      const tasks = await store.listTasks();
      assertEqual(tasks.length, 2);
    }],
    ['store: listTasks filters by status', async () => {
      const { store } = makeStore();
      await store.createTask({ title: 'Open task', due: null, project: null, priority: 'normal' });
      const open = await store.listTasks({ status: 'open' });
      assertEqual(open.length, 1);
      const done = await store.listTasks({ status: 'done' });
      assertEqual(done.length, 0);
    }],
    ['store: listTasks filters by project', async () => {
      const { store } = makeStore();
      await store.createTask({ title: 'Photo task', due: null, project: 'Photography', priority: 'normal' });
      await store.createTask({ title: 'Other task', due: null, project: null, priority: 'normal' });
      const tasks = await store.listTasks({ status: 'open', project: 'Photography' });
      assertEqual(tasks.length, 1);
      assertEqual(tasks[0].title, 'Photo task');
    }],
    ['store: listTasks filters by priority', async () => {
      const { store } = makeStore();
      await store.createTask({ title: 'Urgent task', due: null, project: null, priority: 'high' });
      await store.createTask({ title: 'Normal task', due: null, project: null, priority: 'normal' });
      const high = await store.listTasks({ priority: 'high' });
      assertEqual(high.length, 1);
    }],
    ['store: completeTask marks task as done', async () => {
      const { store } = makeStore();
      await store.createTask({ title: 'Chase the farrier', due: '2026-02-24', project: null, priority: 'normal' });
      const result = await store.completeTask('farrier');
      assertEqual(result.ok, true);
      const open = await store.listTasks({ status: 'open' });
      assertEqual(open.length, 0);
    }],
    ['store: completeTask returns error for missing task', async () => {
      const { store } = makeStore();
      const result = await store.completeTask('nonexistent thing');
      assertEqual(result.ok, false);
      assertContains(result.message, 'No open task');
    }],
    ['store: completeTask is case-insensitive', async () => {
      const { store } = makeStore();
      await store.createTask({ title: 'Chase the Farrier', due: null, project: null, priority: 'normal' });
      const result = await store.completeTask('FARRIER');
      assertEqual(result.ok, true);
    }],
    ['store: getOverdue returns past-due tasks only', async () => {
      const { store } = makeStore();
      await store.createTask({ title: 'Past due', due: '2020-01-01', project: null, priority: 'normal' });
      await store.createTask({ title: 'Future', due: '2030-01-01', project: null, priority: 'normal' });
      await store.createTask({ title: 'No date', due: null, project: null, priority: 'normal' });
      const overdue = await store.getOverdue();
      assertEqual(overdue.length, 1);
    }],
    ['store: getDueSoon returns tasks within 48h', async () => {
      const { store } = makeStore();
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      const tomorrowStr = tmrw.toISOString().split('T')[0];
      const nw = new Date();
      nw.setDate(nw.getDate() + 7);
      const nextWeekStr = nw.toISOString().split('T')[0];
      await store.createTask({ title: 'Due tomorrow', due: tomorrowStr, project: null, priority: 'normal' });
      await store.createTask({ title: 'Due next week', due: nextWeekStr, project: null, priority: 'normal' });
      const soon = await store.getDueSoon();
      assertEqual(soon.length, 1);
      assertEqual(soon[0].title, 'Due tomorrow');
    }],
    ['store: listTasks sorted by due date', async () => {
      const { store } = makeStore();
      await store.createTask({ title: 'Later', due: '2026-03-01', project: null, priority: 'normal' });
      await store.createTask({ title: 'Sooner', due: '2026-02-20', project: null, priority: 'normal' });
      await store.createTask({ title: 'No date', due: null, project: null, priority: 'normal' });
      const tasks = await store.listTasks();
      assertEqual(tasks[0].title, 'Sooner');
      assertEqual(tasks[1].title, 'Later');
      assertEqual(tasks[2].title, 'No date');
    }],
    // Briefing async tests
    ['briefing: inbox zero', async () => {
      const brief = await generateTaskBrief(mockStore([]));
      assertContains(brief, 'inbox zero');
    }],
    ['briefing: shows total open count', async () => {
      const tasks = [
        { title: 'A', due: '2030-01-01', priority: 'normal', status: 'open' },
        { title: 'B', due: '2030-01-02', priority: 'normal', status: 'open' },
        { title: 'C', due: null, priority: 'normal', status: 'open' }
      ];
      const brief = await generateTaskBrief(mockStore(tasks));
      assertContains(brief, '3 open');
    }],
    ['briefing: shows overdue tasks', async () => {
      const brief = await generateTaskBrief(mockStore([
        { title: 'Overdue task', due: '2020-01-01', priority: 'normal', status: 'open' }
      ]));
      assertContains(brief, 'Overdue task');
      assertContains(brief, 'overdue');
    }],
    ['briefing: high priority flag ⚡', async () => {
      const brief = await generateTaskBrief(mockStore([
        { title: 'Urgent thing', due: '2020-01-01', priority: 'high', status: 'open' }
      ]));
      assertContains(brief, '⚡');
    }],
    ['briefing: does not show done tasks', async () => {
      const brief = await generateTaskBrief(mockStore([
        { title: 'Done thing', due: '2030-01-01', priority: 'normal', status: 'done' }
      ]));
      if (brief.includes('Done thing')) throw new Error('Done task appeared in brief');
    }],
    ['briefing: caps overdue at 3 items', async () => {
      const tasks = Array.from({ length: 6 }, (_, i) => ({
        title: `Overdue ${i + 1}`, due: '2020-01-01', priority: 'normal', status: 'open'
      }));
      const brief = await generateTaskBrief(mockStore(tasks));
      assertContains(brief, 'more overdue');
    }],
    ['briefing: handles store error gracefully', async () => {
      const badStore = {
        async getOverdue() { throw new Error('CouchDB unavailable'); },
        async getDueSoon() { return []; },
        async listTasks() { return []; }
      };
      const brief = await generateTaskBrief(badStore);
      assertContains(brief, '⚠️');
    }],
  ];

  for (const [name, fn] of asyncCases) {
    try {
      await fn();
      process.stdout.write(`  ✅ ${name}\n`);
      passed++;
    } catch (err) {
      process.stdout.write(`  ❌ ${name}\n     ${err.message}\n`);
      failed++;
      failures.push({ name, error: err.message });
    }
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

runTests().then(() => {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  • ${f.name}: ${f.error}`);
    }
    process.exit(1);
  } else {
    console.log('All tests passed! 🎉');
  }
}).catch(err => {
  console.error('\nTest runner error:', err.message);
  process.exit(1);
});
