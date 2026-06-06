import { NextRequest, NextResponse } from 'next/server';
import { runAgentCycle } from '@/lib/agent';

// POST - Run an agent cycle (trigger autonomous decisions)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    const result = await runAgentCycle(businessId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error running agent cycle:', error);
    return NextResponse.json(
      { error: 'Failed to run agent cycle', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
