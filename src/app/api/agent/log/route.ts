import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get agent decision logs
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    const where: Record<string, unknown> = { businessId };
    if (action) where.action = action;

    const logs = await db.agentLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get summary stats
    const totalLogs = await db.agentLog.count({ where: { businessId } });
    const completedLogs = await db.agentLog.count({ where: { businessId, status: 'completed' } });
    const failedLogs = await db.agentLog.count({ where: { businessId, status: 'failed' } });

    // Action distribution
    const actionCounts: Record<string, number> = {};
    const allLogs = await db.agentLog.findMany({
      where: { businessId },
      select: { action: true },
    });
    allLogs.forEach(log => {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });

    return NextResponse.json({
      logs,
      summary: {
        total: totalLogs,
        completed: completedLogs,
        failed: failedLogs,
        actionCounts,
      },
    });
  } catch (error) {
    console.error('Error getting agent logs:', error);
    return NextResponse.json(
      { error: 'Failed to get agent logs', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
