# Smart Structure Detection - Specification

**Goal:** Convert plain text Telegram messages into well-structured markdown notes automatically.

---

## Problem Statement

When capturing notes via `/capture`, users type plain text without markdown formatting:
- No heading markers (`#`, `##`)
- No list markers (`-`)
- No proper table formatting
- Inconsistent spacing

**Current formatter** only polishes existing markdown. We need **structure detection** that adds markdown where it doesn't exist.

---

## Detection Patterns

### 1. Title Detection

**Pattern:** First line that looks like a title

**Rules:**
- First non-empty line of note
- OR: Line that's short (<60 chars), ends without punctuation
- OR: Line followed by blank line and then content
- OR: Line with date pattern (e.g., "Project Update - Feb 12")
- OR: Line with ALL CAPS or Title Case

**Examples:**
```
Input:
Crypto Trading Results - Feb 12

Some content here...

Output:
# Crypto Trading Results - Feb 12

Some content here...
```

```
Input:
PROJECT UPDATE

Details below...

Output:
# Project Update

Details below...
```

### 2. Section Headers

**Pattern:** Lines that introduce new sections

**Rules:**
- Short line (<50 chars) followed by content
- Often followed by blank line
- Common patterns:
  - "What we learned:"
  - "Key results:"
  - "Next steps:"
  - "Summary:"
  - "Background:"
  - Question format: "Why did this happen?"
- Sentence case or Title Case
- May end with `:` (strip it)

**Examples:**
```
Input:
Key Results:
Total return was great

Output:
## Key Results

Total return was great
```

```
Input:
What we learned:
Exit signals were bad

Output:
## What We Learned

Exit signals were bad
```

### 3. Bulleted Lists

**Pattern:** Lines that look like list items

**Rules:**
- Lines starting with numbers: `1.`, `2.`, etc.
- Lines starting with bullet chars: `-`, `*`, `+`, `•`
- Lines without markers but parallel structure:
  ```
  Exit signals were the problem
  Trailing stops work perfectly
  BTC never trades
  ```
  (Multiple consecutive short lines, similar grammar)

**Examples:**
```
Input:
Next steps:
1. Test full dataset
2. Add short capability
3. Fix BTC logic

Output:
## Next Steps

- Test full dataset
- Add short capability
- Fix BTC logic
```

```
Input:
What learned:
Exit signals bad
Stops work great
BTC broken

Output:
## What Learned

- Exit signals bad
- Stops work great
- BTC broken
```

### 4. Key-Value Data

**Pattern:** Data that looks like key: value pairs or tabular

**Rules:**
- Multiple lines with `:` separator
  ```
  Total Return: +11.77%
  Win Rate: 96.3%
  Max Drawdown: 6.26%
  ```
- Should become markdown table OR definition list
- If 3+ similar lines → table
- If 1-2 lines → keep as bold key

**Examples:**
```
Input:
Key metrics:
Total Return: +11.77%
Win Rate: 96.3%
Sharpe: +0.59

Output:
## Key Metrics

| Metric | Value |
| --- | --- |
| Total Return | +11.77% |
| Win Rate | 96.3% |
| Sharpe | +0.59 |
```

```
Input:
Result: Success
Time: 3.5 hours

Output:
**Result:** Success  
**Time:** 3.5 hours
```

### 5. Paragraphs

**Pattern:** Regular text blocks

**Rules:**
- Separate paragraphs with blank line
- Consecutive lines without list/heading markers → single paragraph
- Join lines that aren't separated by blank line

**Examples:**
```
Input:
This is the first
paragraph text.
It has multiple lines.

This is second paragraph.

Output:
This is the first paragraph text. It has multiple lines.

This is second paragraph.
```

### 6. Emphasis & Inline Formatting

**Pattern:** Text that should be bold/italic

**Rules:**
- ALL CAPS words → **bold** (unless it's an acronym <4 chars)
- Words in "quotes" → keep as-is or make italic (optional)
- Existing markdown preserved

**Examples:**
```
Input:
This is IMPORTANT text

Output:
This is **IMPORTANT** text
```

---

## Detection Algorithm

### Step 1: Split into blocks
- Split on blank lines (paragraph boundaries)
- Each block = potential structure unit

### Step 2: Classify each block
1. **Title block?** (first non-empty block, looks like title)
2. **Section header?** (short line ending with `:`, title case)
3. **List block?** (multiple lines with numbers/bullets/parallel structure)
4. **Key-value block?** (multiple `key: value` lines)
5. **Paragraph** (default)

### Step 3: Transform each block
- Title → `# Title`
- Section → `## Section`
- List → `- item\n- item`
- Key-value → table or bold keys
- Paragraph → join lines, add spacing

### Step 4: Reassemble
- Add blank lines between sections
- Ensure proper spacing after headings
- Join paragraphs properly

---

## Edge Cases & Rules

### Don't Over-Detect
- Not every short line is a heading
- Context matters (what comes after?)
- Preserve user intent when ambiguous

### Preserve Existing Markdown
- If note already has `#` headings → don't add more
- If lists already have `-` → just standardize
- Don't break existing formatting

### Handle Mixed Content
```
Input:
Meeting Notes - Feb 13

Discussed:
- Budget approval
- Timeline changes

Action items:
1. Send proposal by Friday
2. Schedule follow-up

Next meeting: Feb 20

Output:
# Meeting Notes - Feb 13

## Discussed

- Budget approval
- Timeline changes

## Action Items

- Send proposal by Friday
- Schedule follow-up

**Next meeting:** Feb 20
```

### Confidence Levels
- **High confidence:** Clear patterns (numbered lists, key:value with 3+ lines)
- **Medium confidence:** Ambiguous (short lines that might be headers)
- **Low confidence:** Don't transform (might break user intent)

When in doubt, be conservative. Better to under-format than over-format.

---

## Implementation Approach

### Module: `structure-detector.js`

**Functions:**
```javascript
/**
 * Detect and add markdown structure to plain text
 * @param {string} plainText - Unformatted text
 * @param {Object} options - Detection options
 *   - aggressiveness: 'conservative' | 'balanced' | 'aggressive'
 *   - preserveExisting: boolean (default: true)
 * @returns {Object} - { markdown, confidence, changes }
 */
function addStructure(plainText, options = {})

/**
 * Detect title from first block
 */
function detectTitle(firstBlock)

/**
 * Detect if block is a section header
 */
function isSectionHeader(block, nextBlock)

/**
 * Detect if block is a list
 */
function detectList(block)

/**
 * Detect key-value pairs
 */
function detectKeyValue(block)

/**
 * Convert key-value to table
 */
function keyValueToTable(pairs)

/**
 * Classify a text block
 */
function classifyBlock(block, context)
```

### Integration Points

1. **Capture** - Call `addStructure()` before formatting
   ```javascript
   const structured = addStructure(capturedText);
   const formatted = formatMarkdown(structured.markdown);
   ```

2. **Format command** - Add optional `--structure` flag
   ```
   /format --structure inbox/note.md
   ```

3. **Standalone command** - `/structure <note>` for testing
   ```
   /structure inbox/my-note.md
   ```

---

## Testing Strategy

### Test Cases

1. **Plain meeting notes** → structured with headings/lists
2. **Data dump** (key:value lines) → table
3. **Mixed content** → correct structure throughout
4. **Already formatted** → preserve existing markdown
5. **Edge cases** → don't break on weird input

### Test File: `test-structure-detector.js`

**Coverage:**
- Title detection (5 tests)
- Section header detection (5 tests)
- List detection (6 tests)
- Key-value detection (4 tests)
- Paragraph handling (3 tests)
- Edge cases (5 tests)
- Integration (3 tests)

**Target:** >90% coverage, all tests passing

---

## Success Criteria

✅ Plain Telegram messages become readable markdown  
✅ Titles, headers, lists detected correctly  
✅ Key-value data becomes tables  
✅ Existing markdown preserved  
✅ No false positives (over-detection)  
✅ Works on real captures from Phil  
✅ Test coverage >90%  

---

## Examples - Real World

### Example 1: Crypto Trading Update

**Input (plain text):**
```
Crypto Trading Update

TimeSeriesMomentum went from -19% to +11%!

Results:
Total Return: +11.77%
Win Rate: 96.3%
Max Drawdown: 6.26%

Learned:
Exit signals were the problem
Trailing stops work perfectly
BTC never trades

Next:
1. Test full 3.5 years
2. Add short side
3. Fix BTC entries
```

**Output (structured markdown):**
```
# Crypto Trading Update

TimeSeriesMomentum went from -19% to +11%!

## Results

| Metric | Value |
| --- | --- |
| Total Return | +11.77% |
| Win Rate | 96.3% |
| Max Drawdown | 6.26% |

## Learned

- Exit signals were the problem
- Trailing stops work perfectly
- BTC never trades

## Next

- Test full 3.5 years
- Add short side
- Fix BTC entries
```

### Example 2: Meeting Notes

**Input:**
```
Team Meeting - Feb 13

Discussed budget for Q2. Everyone agrees we need more resources.

Action items:
Sarah: Send proposal by Friday
John: Review timeline
Me: Schedule follow-up meeting

Concerns:
Timeline might slip
Budget constraints

Next meeting: Feb 20 at 2pm
```

**Output:**
```
# Team Meeting - Feb 13

Discussed budget for Q2. Everyone agrees we need more resources.

## Action Items

- **Sarah:** Send proposal by Friday
- **John:** Review timeline
- **Me:** Schedule follow-up meeting

## Concerns

- Timeline might slip
- Budget constraints

**Next meeting:** Feb 20 at 2pm
```

### Example 3: Simple Note

**Input:**
```
Had a great idea for the photography site. Use lazy loading for images to improve performance. Also consider adding a blog section for behind-the-scenes content.
```

**Output:**
```
# Photography Site Ideas

Had a great idea for the photography site. Use lazy loading for images to improve performance. Also consider adding a blog section for behind-the-scenes content.
```

---

## Configuration Options

Allow users to tune detection:

```javascript
{
  aggressiveness: 'balanced',  // conservative | balanced | aggressive
  
  titleDetection: true,
  sectionDetection: true,
  listDetection: true,
  tableDetection: true,
  
  minListItems: 2,  // Min consecutive items to detect list
  minTableRows: 3,  // Min rows to create table vs bold keys
  
  preserveExisting: true,  // Don't touch existing markdown
  addEmojis: false  // Optionally add emoji headers (📊, 🎯, etc.)
}
```

---

## Phase 4.2 Deliverables

1. **structure-detector.js** - Core detection logic
2. **telegram-structure.js** - CLI handler
3. **test-structure-detector.js** - Comprehensive tests
4. **Integration** - Add to capture.js workflow
5. **Documentation** - Update ROADMAP.md and README.md

---

**Ready for sub-agent implementation?** This spec should give them everything they need to build it right the first time.
