import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/settings?businessId=xxx — Load settings
export async function GET(req: NextRequest) {
  try {
    const businessId = req.nextUrl.searchParams.get('businessId');

    let settings = await db.agentSettings.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    // If businessId provided, try to find settings for that business first
    if (businessId) {
      const businessSettings = await db.agentSettings.findFirst({
        where: { businessId },
        orderBy: { updatedAt: 'desc' },
      });
      if (businessSettings) settings = businessSettings;
    }

    if (!settings) {
      // Return defaults
      return NextResponse.json({
        settings: {
          id: null,
          autoInterval: 240,
          selectedTimes: '9ص,6م',
          autoPublish: false,
          autoGenerate: false,
          scheduleFreq: 'daily',
          imageAspectRatio: 'auto',
          autoReplyEnabled: false,
          genContentType: 'varied',
          genCount: 3,
          customIntervalUnit: 'minutes',
        },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error loading settings:', error);
    return NextResponse.json(
      { error: 'Failed to load settings', settings: null },
      { status: 500 }
    );
  }
}

// PUT /api/settings — Save settings
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      businessId,
      autoInterval,
      selectedTimes,
      autoPublish,
      autoGenerate,
      scheduleFreq,
      imageAspectRatio,
      autoReplyEnabled,
      genContentType,
      genCount,
      customIntervalUnit,
    } = body;

    const data: Record<string, unknown> = {};
    if (autoInterval !== undefined) data.autoInterval = autoInterval;
    if (selectedTimes !== undefined) data.selectedTimes = selectedTimes;
    if (autoPublish !== undefined) data.autoPublish = autoPublish;
    if (autoGenerate !== undefined) data.autoGenerate = autoGenerate;
    if (scheduleFreq !== undefined) data.scheduleFreq = scheduleFreq;
    if (imageAspectRatio !== undefined) data.imageAspectRatio = imageAspectRatio;
    if (autoReplyEnabled !== undefined) data.autoReplyEnabled = autoReplyEnabled;
    if (genContentType !== undefined) data.genContentType = genContentType;
    if (genCount !== undefined) data.genCount = genCount;
    if (customIntervalUnit !== undefined) data.customIntervalUnit = customIntervalUnit;
    if (businessId !== undefined) data.businessId = businessId;

    let settings;
    if (id) {
      settings = await db.agentSettings.update({
        where: { id },
        data,
      });
    } else {
      settings = await db.agentSettings.create({
        data: data as any,
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
