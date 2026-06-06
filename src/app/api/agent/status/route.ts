import { NextRequest, NextResponse } from 'next/server';
import { getAgentStatus } from '@/lib/agent';

// GET - Get current agent status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    const status = await getAgentStatus(businessId);

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting agent status:', error);
    return NextResponse.json(
      { error: 'Failed to get agent status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
