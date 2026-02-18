#!/usr/bin/env node
/**
 * Telegram Task Handler
 *
 * Handles task-related commands for the Telegram bridge.
 * Same pattern as other telegram-*.js handlers in this directory.
 *
 * Commands:
 *   /task <natural language>   — capture a new task
 *   /t <natural language>      — shorthand for /task
 *   /tasks                     — list open tasks grouped by due date
 *   /tasks done [search]       — mark a task as complete
 *   /tasks project:X           — filter tasks by project
 *   /tasks priority:high       — filter tasks by priority
 *   /done [search]             — shorthand for /tasks done
 *
 * Usage:
 *   node telegram-tasks.js task "remind me to chase the farrier next Tuesday"
 *   node telegram-tasks.js tasks
 *   node telegram-tasks.js done "farrier"
 */

const { parseTask } = require('./task-parser');
const TaskStore = require('./task-store');
const { format, differenceInDays } = require('date-fns');

// ─── Formatting Helpers ───────────────────────────────────────────────────────

/**
 * Today as YYYY-MM-DD.
 * @returns {string}
 */
function today() {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Tomorrow as YYYY-MM-DD.
 * @returns {string}
 */
function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return format(d, 'yyyy-MM-dd');
}

/**
 * Format a due date string for display.
 * @param {string|null} due
 * @returns {string}
 */
function formatDue(due) {
  if (!due) return 'no date';
  const t = today();
  const tmrw = tomorrow();
  if (due < t) {
    const days = differenceInDays(new Date(t), new Date(due));
    return days === 1 ? '1 day overdue' : `${days} days overdue`;
  }
  if (due === t) return 'today';
  if (due === tmrw) return 'tomorrow';
  // Otherwise format as "Fri 24 Feb"
  const d = new Date(due + 'T00:00:00');
  return format(d, 'EEE d MMM');
}

/**
 * Priority emoji for display.
 * @param {string} priority
 * @returns {string}
 */
function priorityIcon(priority) {
  return priority === 'high' ? '⚡' : priority === 'low' ? '🔵' : '';
}

/**
 * Project tag for display.
 * @param {string|null} project
 * @returns {string}
 */
function projectTag(project) {
  return project ? ` [${project}]` : '';
}

/**
 * Format a single task line for Telegram.
 * @param {Object} task
 * @returns {string}
 */
function formatTaskLine(task) {
  const icon = priorityIcon(task.priority);
  const proj = projectTag(task.project);
  const due = formatDue(task.due);
  const prefix = icon ? `${icon} ` : '';
  return `${prefix}*${task.title}*${proj} — _${due}_`;
}

/**
 * Group tasks by due date category.
 * @param {Array<Object>} tasks
 * @returns {Object} { overdue, today, thisWeek, later, noDate }
 */
function groupTasksByDue(tasks) {
  const t = today();
  const tmrw = tomorrow();
  // End of this week (Sunday)
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  const endOfWeekStr = format(endOfWeek, 'yyyy-MM-dd');

  const groups = { overdue: [], today: [], thisWeek: [], later: [], noDate: [] };

  for (const task of tasks) {
    if (!task.due) {
      groups.noDate.push(task);
    } else if (task.due < t) {
      groups.overdue.push(task);
    } else if (task.due === t) {
      groups.today.push(task);
    } else if (task.due <= endOfWeekStr) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }

  return groups;
}

// ─── Command Handlers ─────────────────────────────────────────────────────────

/**
 * Handle /task or /t command — capture a new task.
 * @param {string} text - Natural language task text
 * @param {TaskStore} [store] - Optional store override (for testing)
 * @returns {Promise<string>} Response message
 */
async function handleTaskCommand(text, store = null) {
  const taskStore = store || new TaskStore();

  if (!text || !text.trim()) {
    return '❌ Usage: `/task <description>`\n\nExamples:\n• `/task remind me to chase the farrier next Tuesday`\n• `/task URGENT: renew horse insurance before March 1st`';
  }

  try {
    const parsed = parseTask(text.trim());
    const created = await taskStore.createTask(parsed);

    const dueStr = created.due ? `📅 Due: ${formatDue(created.due)}` : '📅 No due date';
    const projStr = created.project ? `🗂 Project: ${created.project}` : '';
    const prioStr = created.priority === 'high' ? '⚡ Priority: High' :
                    created.priority === 'low' ? '🔵 Priority: Low' : '';

    const lines = [`✅ Task captured: *${created.title}*`, dueStr];
    if (projStr) lines.push(projStr);
    if (prioStr) lines.push(prioStr);

    return lines.join('\n');
  } catch (err) {
    return `❌ Failed to create task: ${err.message}`;
  }
}

/**
 * Handle /tasks command — list tasks with optional filters.
 * @param {string} argsString - Command arguments
 * @param {TaskStore} [store] - Optional store override (for testing)
 * @returns {Promise<string>} Response message
 */
async function handleTasksCommand(argsString = '', store = null) {
  const taskStore = store || new TaskStore();
  const args = argsString.trim().toLowerCase();

  // ── /tasks done [search] ──────────────────────────────────────────────────
  if (args.startsWith('done')) {
    const searchTerm = argsString.trim().slice(4).trim();
    return handleDoneCommand(searchTerm, taskStore);
  }

  // ── Parse filters ─────────────────────────────────────────────────────────
  const filters = { status: 'open' };

  // project:X filter
  const projMatch = args.match(/\bproject:(\w+)/i);
  if (projMatch) filters.project = projMatch[1];

  // priority:X filter
  const prioMatch = args.match(/\bpriority:(high|normal|low)/i);
  if (prioMatch) filters.priority = prioMatch[1].toLowerCase();

  try {
    const tasks = await taskStore.listTasks(filters);

    if (tasks.length === 0) {
      const filterDesc = [];
      if (filters.project) filterDesc.push(`project: ${filters.project}`);
      if (filters.priority) filterDesc.push(`priority: ${filters.priority}`);
      const filterStr = filterDesc.length > 0 ? ` (${filterDesc.join(', ')})` : '';
      return `✅ No open tasks${filterStr}. You're clear!`;
    }

    const groups = groupTasksByDue(tasks);
    const lines = [`📋 *Open Tasks* (${tasks.length})`];

    // Overdue
    if (groups.overdue.length > 0) {
      lines.push('\n🔴 *Overdue*');
      for (const t of groups.overdue) lines.push(`• ${formatTaskLine(t)}`);
    }

    // Today
    if (groups.today.length > 0) {
      lines.push('\n🟡 *Today*');
      for (const t of groups.today) lines.push(`• ${formatTaskLine(t)}`);
    }

    // This week
    if (groups.thisWeek.length > 0) {
      lines.push('\n📅 *This week*');
      for (const t of groups.thisWeek) lines.push(`• ${formatTaskLine(t)}`);
    }

    // Later
    if (groups.later.length > 0) {
      lines.push('\n🗓 *Later*');
      for (const t of groups.later) lines.push(`• ${formatTaskLine(t)}`);
    }

    // No date
    if (groups.noDate.length > 0) {
      lines.push('\n⬜ *Undated*');
      for (const t of groups.noDate) lines.push(`• ${formatTaskLine(t)}`);
    }

    lines.push('\n_Use `/done <search>` to complete a task_');

    return lines.join('\n');
  } catch (err) {
    return `❌ Failed to list tasks: ${err.message}`;
  }
}

/**
 * Handle /done command — mark a task as complete.
 * @param {string} searchTerm - Task search term
 * @param {TaskStore} [store] - Optional store override (for testing)
 * @returns {Promise<string>} Response message
 */
async function handleDoneCommand(searchTerm = '', store = null) {
  const taskStore = store || new TaskStore();

  if (!searchTerm || !searchTerm.trim()) {
    // List tasks and ask which to complete
    const tasks = await taskStore.listTasks({ status: 'open' });
    if (tasks.length === 0) return '✅ No open tasks to complete!';
    const taskList = tasks.slice(0, 10).map(t => `• ${t.title}`).join('\n');
    return `Which task? Use \`/done <search term>\`\n\nOpen tasks:\n${taskList}`;
  }

  try {
    const result = await taskStore.completeTask(searchTerm.trim());
    if (result.ok) {
      return `✅ *Done:* ${result.task.title}`;
    } else {
      return `❌ ${result.message}\n\nUse \`/tasks\` to see open tasks.`;
    }
  } catch (err) {
    return `❌ Failed to complete task: ${err.message}`;
  }
}

// ─── Main Message Router ──────────────────────────────────────────────────────

/**
 * Route a Telegram message to the appropriate handler.
 * @param {string} messageText - Full message text
 * @returns {Promise<{handled: boolean, message?: string}>}
 */
async function handleTelegramMessage(messageText) {
  if (!messageText || typeof messageText !== 'string') {
    return { handled: false };
  }

  const text = messageText.trim();

  // /task or /t
  const taskMatch = text.match(/^\/(?:task|t)\s*(.*)/is);
  if (taskMatch) {
    const msg = await handleTaskCommand(taskMatch[1]);
    return { handled: true, message: msg };
  }

  // /done
  const doneMatch = text.match(/^\/done\s*(.*)/i);
  if (doneMatch) {
    const msg = await handleDoneCommand(doneMatch[1]);
    return { handled: true, message: msg };
  }

  // /tasks
  const tasksMatch = text.match(/^\/tasks\s*(.*)/i);
  if (tasksMatch) {
    const msg = await handleTasksCommand(tasksMatch[1]);
    return { handled: true, message: msg };
  }

  return { handled: false };
}

module.exports = {
  handleTelegramMessage,
  handleTaskCommand,
  handleTasksCommand,
  handleDoneCommand,
  formatDue,
  groupTasksByDue
};

// ─── CLI Entry Point ──────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const rest = args.slice(1).join(' ');

  async function main() {
    let response;
    if (command === 'task' || command === 't') {
      response = await handleTaskCommand(rest);
    } else if (command === 'tasks') {
      response = await handleTasksCommand(rest);
    } else if (command === 'done') {
      response = await handleDoneCommand(rest);
    } else {
      response = [
        '❌ Unknown command.',
        '',
        'Available commands:',
        '  task <description>   — capture a new task',
        '  tasks [project:X]   — list open tasks',
        '  done <search>       — complete a task'
      ].join('\n');
    }
    console.log(response);
  }

  main().catch(err => {
    console.error(`❌ Error: ${err.message}`);
    process.exit(1);
  });
}
