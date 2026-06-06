import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get schedule config
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    const schedules = await db.scheduleConfig.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}

// POST - Create or update schedule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, frequency, preferredTimes, daysOfWeek, autoPublish, autoGenerate, isActive } = body;

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    // Deactivate existing schedules
    await db.scheduleConfig.updateMany({
      where: { businessId, isActive: true },
      data: { isActive: false },
    });

    const schedule = await db.scheduleConfig.create({
      data: {
        businessId,
        frequency: frequency || 'daily',
        preferredTimes: preferredTimes ? JSON.stringify(preferredTimes) : null,
        daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : null,
        autoPublish: autoPublish || false,
        autoGenerate: autoGenerate || false,
        isActive: isActive !== false,
      },
    });

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
  }
}

// PUT - Update schedule (e.g., for scheduling a specific post)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, scheduledAt } = body;

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    const post = await db.contentPost.update({
      where: { id: postId },
      data: {
        status: 'scheduled',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Error scheduling post:', error);
    return NextResponse.json({ error: 'Failed to schedule post' }, { status: 500 });
  }
}
