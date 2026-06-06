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
  // (Claude API supports system as first assistant message or as separate field)
  const apiMessages: ClaudeMessage[] = [];
  
  if (systemPrompt) {
    // Prepend system instructions as the first assistant message
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

// Image generation input types
export interface GrokImagineInput {
  prompt: string;
  aspectRatio?: string; // 2:3, 3:2, 1:1, 16:9, 9:16
  nsfwChecker?: boolean;
  enablePro?: boolean;
}

export interface GptImage2Input {
  prompt: string;
  aspectRatio?: string; // auto, 1:1, 3:2, 2:3, 4:3, 3:4, 5:4, 4:5, 16:9, 9:16, 2:1, 1:2, 3:1, 1:3, 21:9, 9:21
  resolution?: string; // 1K, 2K, 4K
}

// Grok Imagine - Text to Image (via Kie.ai)
export async function createGrokImageTask(input: GrokImagineInput) {
  return callKieAI('/api/v1/jobs/createTask', {
    model: 'grok-imagine/text-to-image',
    input: {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio || '1:1',
      nsfw_checker: input.nsfwChecker ?? false,
      ...(input.enablePro !== undefined ? { enable_pro: input.enablePro } : {}),
    },
  });
}

// GPT Image 2 - Text to Image (via Kie.ai)
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

// Unified image generation - selects model based on parameter
export async function createImageTask(
  model: 'grok-imagine' | 'gpt-image-2',
  input: { prompt: string; aspectRatio?: string; resolution?: string; }
) {
  if (model === 'gpt-image-2') {
    return createGptImage2Task({
      prompt: input.prompt,
      aspectRatio: input.aspectRatio || 'auto',
      resolution: input.resolution,
    });
  }
  
  return createGrokImageTask({
    prompt: input.prompt,
    aspectRatio: input.aspectRatio || '1:1',
  });
}

// Get Task Details (unified query endpoint for all Kie.ai async tasks)
export async function getKieTaskDetail(taskId: string) {
  return callKieAI(`/api/v1/jobs/getTaskDetail`, { taskId });
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
      const taskStatus = result.data.taskStatus || result.data.task_status || result.data.status;
      
      if (taskStatus === 'SUCCESS' || taskStatus === 'completed' || taskStatus === 'succeeded') {
        return { status: 'SUCCESS', data: result.data };
      }
      
      if (taskStatus === 'FAILED' || taskStatus === 'failed' || taskStatus === 'error') {
        return { status: 'FAILED', data: result.data };
      }
      
      // Still processing - wait and retry
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      continue;
    }
    
    // If the response itself indicates completion
    if (result.code === 200 && result.data?.output) {
      return { status: 'SUCCESS', data: result.data };
    }
    
    // Wait and retry for pending/processing tasks
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  return { status: 'TIMEOUT' };
}
