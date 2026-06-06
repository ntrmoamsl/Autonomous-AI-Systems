import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

// Fallback: z-ai-web-dev-sdk for simple LLM calls
export async function getAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

const KIE_API_BASE = 'https://api.kie.ai';

function getKieApiKey() {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY not configured');
  return apiKey;
}

// Generic Kie.ai API call
export async function callKieAI(endpoint: string, body: Record<string, unknown>, method: string = 'POST') {
  const apiKey = getKieApiKey();
  
  const response = await fetch(`${KIE_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kie.ai API error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}

// ============================================================
// Claude Opus 4.8 - The Executive Brain (via Kie.ai API)
// ============================================================
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeResponse {
  id: string;
  model: string;
  role: string;
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    name?: string;
    input?: Record<string, unknown>;
    id?: string;
  }>;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Call Claude Opus 4.8 via Kie.ai API - the Executive Brain of the marketing agent.
 * 
 * This is the primary AI model for:
 * - Content generation (social media posts)
 * - Smart replies to customer messages
 * - Marketing strategy decisions
 * - Content analysis and recommendations
 */
export async function callClaudeOpus(
  messages: ClaudeMessage[],
  options: {
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    thinkingFlag?: boolean;
  } = {}
): Promise<string> {
  const apiKey = getKieApiKey();
  const { systemPrompt, maxTokens = 8192, thinkingFlag = true } = options;

  // Build the messages array with system prompt as the first assistant message
  const apiMessages: ClaudeMessage[] = [];
  
  if (systemPrompt) {
    apiMessages.push({ role: 'assistant', content: systemPrompt });
  }
  
  apiMessages.push(...messages);

  const response = await fetch(`${KIE_API_BASE}/claude/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Api-Key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      messages: apiMessages,
      max_tokens: maxTokens,
      stream: false,
      thinkingFlag,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude Opus 4.8 API error (${response.status}): ${errorText}`);
  }

  const data: ClaudeResponse = await response.json();

  // Extract text from the response content blocks
  const textContent = data.content
    .filter(block => block.type === 'text' && block.text)
    .map(block => block.text)
    .join('\n');

  return textContent;
}

// ============================================================
// GPT Image 2 - IMAGE generation (via Kie.ai API)
// ============================================================
export interface GptImage2Input {
  prompt: string;
  aspectRatio?: string; // auto, 1:1, 3:2, 2:3, 4:3, 3:4, 5:4, 4:5, 16:9, 9:16, 2:1, 1:2, 3:1, 1:3, 21:9, 9:21
  resolution?: string; // 1K, 2K, 4K
}

/**
 * Create an IMAGE generation task using GPT Image 2
 * This is the ONLY model used for image generation.
 */
export async function createGptImage2Task(input: GptImage2Input) {
  const taskInput: Record<string, unknown> = {
    prompt: input.prompt,
  };

  if (input.aspectRatio) {
    taskInput.aspect_ratio = input.aspectRatio;
  }
  
  if (input.resolution) {
    taskInput.resolution = input.resolution;
  }

  return callKieAI('/api/v1/jobs/createTask', {
    model: 'gpt-image-2-text-to-image',
    input: taskInput,
  });
}

/**
 * Unified IMAGE generation task creator.
 * Always uses GPT Image 2 (the only image generation model).
 */
export async function createImageTask(input: {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
}) {
  return createGptImage2Task({
    prompt: input.prompt,
    aspectRatio: input.aspectRatio || 'auto',
    resolution: input.resolution,
  });
}

// ============================================================
// Grok Imagine - VIDEO generation (via Kie.ai API)
// ============================================================
export interface GrokVideoInput {
  prompt: string;
  aspectRatio?: '2:3' | '3:2' | '1:1' | '16:9' | '9:16';
  mode?: 'fun' | 'normal' | 'spicy';
  duration?: number; // 6-30 seconds
  resolution?: '480p' | '720p';
  nsfwChecker?: boolean;
}

/**
 * Create a VIDEO generation task using Grok Imagine Text-to-Video
 * This is the ONLY model used for video generation.
 */
export async function createGrokVideoTask(input: GrokVideoInput) {
  const videoInput: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: input.aspectRatio || '16:9',
    mode: input.mode || 'normal',
  };

  if (input.duration) {
    videoInput.duration = input.duration;
  }

  if (input.resolution) {
    videoInput.resolution = input.resolution;
  }

  if (input.nsfwChecker !== undefined) {
    videoInput.nsfw_checker = input.nsfwChecker;
  }

  return callKieAI('/api/v1/jobs/createTask', {
    model: 'grok-imagine/text-to-video',
    input: videoInput,
  });
}

/**
 * Unified VIDEO generation task creator.
 * Always uses Grok Imagine Text-to-Video (the only video generation model).
 */
export async function createVideoTask(input: {
  prompt: string;
  aspectRatio?: string;
  mode?: 'fun' | 'normal' | 'spicy';
  duration?: number;
  resolution?: string;
}) {
  return createGrokVideoTask({
    prompt: input.prompt,
    aspectRatio: (input.aspectRatio as GrokVideoInput['aspectRatio']) || '16:9',
    mode: input.mode || 'normal',
    duration: input.duration || 6,
    resolution: (input.resolution as '480p' | '720p') || '480p',
  });
}

// ============================================================
// Task Status Query (unified for all Kie.ai async tasks)
// ============================================================

// Get Task Details (unified query endpoint for all Kie.ai async tasks)
// Uses GET /api/v1/jobs/recordInfo?taskId=xxx
export async function getKieTaskDetail(taskId: string) {
  const apiKey = getKieApiKey();
  
  const response = await fetch(`${KIE_API_BASE}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kie.ai API error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}

// Poll Kie.ai task until completion or timeout
export async function pollKieTask(
  taskId: string, 
  maxAttempts: number = 60, 
  intervalMs: number = 5000
): Promise<{ status: string; data?: Record<string, unknown> }> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await getKieTaskDetail(taskId);
    
    if (result.code === 200 && result.data) {
      const state = result.data.state;
      
      if (state === 'success') {
        return { status: 'SUCCESS', data: result.data };
      }
      
      if (state === 'failed') {
        return { status: 'FAILED', data: result.data };
      }
      
      // Still generating/processing - wait and retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      continue;
    }
    
    // Wait and retry for pending/processing tasks
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  return { status: 'TIMEOUT' };
}
