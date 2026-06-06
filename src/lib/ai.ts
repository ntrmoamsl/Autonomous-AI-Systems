import ZAI from 'z-ai-web-dev-sdk';

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

export async function getAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// Direct kie.ai API call (for models not available in Z.ai)
export async function callKieAI(endpoint: string, body: Record<string, unknown>) {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new Error('KIE_API_KEY not configured');
  
  const response = await fetch(`https://api.kie.ai${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kie.ai API error (${response.status}): ${errorText}`);
  }
  
  return response.json();
}
