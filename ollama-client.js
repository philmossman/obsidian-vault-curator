const OLLAMA_BASE_URL = 'http://localhost:11434/api';
const DEFAULT_MODEL = 'qwen2.5-coder:7b';
const DEFAULT_TIMEOUT = 60000; // 60 seconds in milliseconds

async function generate(model = DEFAULT_MODEL, prompt, options = {}) {
  if (!prompt) {
    throw new Error('Prompt is required');
  }

  const {
    temperature,
    num_predict,
    timeout = DEFAULT_TIMEOUT
  } = options;

  const requestBody = {
    model,
    prompt,
    stream: false,
    options: {}
  };

  if (temperature !== undefined) requestBody.options.temperature = temperature;
  if (num_predict !== undefined) requestBody.options.num_predict = num_predict;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw new Error(`Generate request failed: ${error.message}`);
  }
}

async function chat(model = DEFAULT_MODEL, messages, options = {}) {
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages array is required');
  }

  const {
    temperature,
    num_predict,
    timeout = DEFAULT_TIMEOUT
  } = options;

  const requestBody = {
    model,
    messages,
    stream: false,
    options: {}
  };

  if (temperature !== undefined) requestBody.options.temperature = temperature;
  if (num_predict !== undefined) requestBody.options.num_predict = num_predict;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    
    throw new Error(`Chat request failed: ${error.message}`);
  }
}

module.exports = { generate, chat };
