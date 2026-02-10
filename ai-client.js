/**
 * AI Client - Analysis functions for note processing
 * Supports Ollama (qwen2.5-coder) and Claude Sonnet fallback
 */

const { sanitizeUnicode } = require('./vault-client');

/**
 * Analyze a note with AI and provide suggestions
 * @param {Object} note - Note object with path, content, frontmatter
 * @param {Object} vaultStructure - Vault structure for context
 * @param {string} model - Model to use (default: qwen2.5-coder:7b)
 * @returns {Promise<Object>} Analysis results with suggestions
 */
async function analyzeNote(note, vaultStructure, model = 'qwen2.5-coder:7b') {
  const prompt = buildPrompt(note, vaultStructure);
  
  try {
    if (model.includes('anthropic') || model.includes('claude')) {
      return await analyzeWithClaude(prompt, model);
    } else {
      return await analyzeWithOllama(prompt, model);
    }
  } catch (err) {
    console.error(`AI analysis failed with ${model}:`, err.message);
    
    // Fallback to Claude if Ollama fails
    if (!model.includes('claude')) {
      console.log('Falling back to Claude Sonnet...');
      return await analyzeWithClaude(prompt, 'anthropic/claude-sonnet-4-5');
    }
    
    throw err;
  }
}

/**
 * Build analysis prompt with note and vault context
 * @param {Object} note - Note object
 * @param {Object} vaultStructure - Vault structure
 * @returns {string} Formatted prompt
 */
function buildPrompt(note, vaultStructure) {
  // Extract folder names and tag names for context
  const folders = vaultStructure.folders
    ? vaultStructure.folders.map(f => f.path).slice(0, 20).join(', ')
    : 'No folders';
  
  const tags = vaultStructure.tags
    ? Object.keys(vaultStructure.tags).slice(0, 30).join(', ')
    : 'No tags';
  
  return `You are analyzing a note from an Obsidian vault to suggest how it should be organized.

**Note Path:** ${note.path}

**Note Content:**
${note.body || note.content}

**Vault Context:**
- **Existing Folders:** ${folders}
- **Existing Tags:** ${tags}

**Task:**
Analyze this note and suggest:
1. **folder** - Best folder to file this note (from existing folders, or suggest new one)
2. **tags** - Relevant tags (mix of existing and new if needed)
3. **related** - Paths of related notes that might exist (educated guess based on content)
4. **summary** - One-line summary of the note
5. **confidence** - Your confidence level (high/medium/low)

**Output Format:**
Reply with ONLY valid JSON, no other text:
{
  "folder": "folder/path",
  "tags": ["tag1", "tag2"],
  "related": ["path/to/note1.md", "path/to/note2.md"],
  "summary": "Brief summary",
  "confidence": "high"
}

JSON output:`;
}

/**
 * Analyze note with Ollama
 * @param {string} prompt - Analysis prompt
 * @param {string} model - Ollama model name
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeWithOllama(prompt, model) {
  const config = require('./config')();
  const fetch = (await import('node-fetch')).default;
  
  const response = await fetch(`${config.processor.ollamaHost}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 500
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const text = data.response;
  
  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Ollama response');
  }
  
  const result = JSON.parse(jsonMatch[0]);
  
  // Sanitize all string fields to prevent Unicode issues
  return sanitizeAnalysisResult(result);
}

/**
 * Analyze note with Claude via OpenClaw message API
 * @param {string} prompt - Analysis prompt
 * @param {string} model - Claude model name
 * @returns {Promise<Object>} Analysis result
 */
async function analyzeWithClaude(prompt, model) {
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || require('os').homedir() + '/.config/openclaw/anthropic-key.txt'
  });
  
  const message = await anthropic.messages.create({
    model: model.replace('anthropic/', ''),
    max_tokens: 1024,
    temperature: 0.3,
    messages: [
      { role: 'user', content: prompt }
    ]
  });
  
  const text = message.content[0].text;
  
  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in Claude response');
  }
  
  const result = JSON.parse(jsonMatch[0]);
  
  // Sanitize all string fields
  return sanitizeAnalysisResult(result);
}

/**
 * Sanitize analysis result to remove problematic Unicode
 * @param {Object} result - Analysis result
 * @returns {Object} Sanitized result
 */
function sanitizeAnalysisResult(result) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeUnicode(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeUnicode(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

module.exports = {
  analyzeNote,
  buildPrompt,
  sanitizeUnicode
};
