import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get business profile
export async function GET() {
  try {
    const profiles = await db.businessProfile.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
  }
}

// POST - Create business profile
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      companyName,
      description,
      products,
      targetAudience,
      toneOfVoice,
      marketingGoals,
      offers,
      faqs,
      brandColors,
      additionalInfo,
    } = body;

    // Deactivate other profiles
    await db.businessProfile.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const profile = await db.businessProfile.create({
      data: {
        companyName,
        description,
        products: typeof products === 'string' ? products : JSON.stringify(products),
        targetAudience,
        toneOfVoice,
        marketingGoals: typeof marketingGoals === 'string' ? marketingGoals : JSON.stringify(marketingGoals),
        offers: offers ? (typeof offers === 'string' ? offers : JSON.stringify(offers)) : null,
        faqs: faqs ? (typeof faqs === 'string' ? faqs : JSON.stringify(faqs)) : null,
        brandColors: brandColors || null,
        additionalInfo: additionalInfo || null,
        isActive: true,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error creating profile:', error);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}

// PUT - Update business profile
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    const profile = await db.businessProfile.update({
      where: { id },
      data: {
        ...data,
        products: data.products && typeof data.products !== 'string' ? JSON.stringify(data.products) : data.products,
        marketingGoals: data.marketingGoals && typeof data.marketingGoals !== 'string' ? JSON.stringify(data.marketingGoals) : data.marketingGoals,
        offers: data.offers ? (typeof data.offers === 'string' ? data.offers : JSON.stringify(data.offers)) : null,
        faqs: data.faqs ? (typeof data.faqs === 'string' ? data.faqs : JSON.stringify(data.faqs)) : null,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
