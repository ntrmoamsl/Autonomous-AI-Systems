import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callClaudeOpus } from '@/lib/ai';

// POST - Generate smart reply using Claude Opus 4.8
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, message, postId, commentId } = body;

    if (!businessId || !message) {
      return NextResponse.json({ error: 'Business ID and message are required' }, { status: 400 });
    }

    // Get business profile for context
    const business = await db.businessProfile.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business profile not found' }, { status: 404 });
    }

    const products = (() => {
      try { return JSON.parse(business.products); } catch { return business.products; }
    })();
    const offers = business.offers ? (() => {
      try { return JSON.parse(business.offers); } catch { return business.offers; }
    })() : null;
    const faqs = business.faqs ? (() => {
      try { return JSON.parse(business.faqs); } catch { return business.faqs; }
    })() : null;

    const systemPrompt = `أنت مسخدم خدمة عملاء ذكي لشركة "${business.companyName}".
وصف الشركة: ${business.description}
المنتجات: ${typeof products === 'string' ? products : JSON.stringify(products)}
${offers ? `العروض: ${typeof offers === 'string' ? offers : JSON.stringify(offers)}` : ''}
${faqs ? `الأسئلة الشائعة: ${typeof faqs === 'string' ? faqs : JSON.stringify(faqs)}` : ''}
أسلوب الرد: ${business.toneOfVoice}

قواعد:
1. ارد بطبيعية تشبه البشر - لا تستخدم ردود ثابتة أو آلية
2. افهم نية المستخدم (سؤال، رغبة في الشراء، شكوى، تفاعل)
3. استخدم معلومات المنتج للرد بدقة
4. كن ودودًا ومحترفًا
5. أجب باللغة العربية
6. أجب بصيغة JSON فقط: {"reply": "الرد هنا", "intentType": "question|purchase|complaint|engagement"}`;

    // Use Claude Opus 4.8 as the Executive Brain via Kie.ai
    const responseText = await callClaudeOpus(
      [{ role: 'user', content: `رسالة المستخدم: "${message}"` }],
      { systemPrompt, maxTokens: 2048 }
    );

    let replyData;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      replyData = jsonMatch ? JSON.parse(jsonMatch[0]) : { reply: responseText, intentType: 'engagement' };
    } catch {
      replyData = { reply: responseText, intentType: 'engagement' };
    }

    // Save the reply
    const saved = await db.smartReply.create({
      data: {
        businessId,
        postId: postId || null,
        commentId: commentId || null,
        originalMsg: message,
        replyText: replyData.reply,
        intentType: replyData.intentType || null,
      },
    });

    return NextResponse.json({
      reply: replyData.reply,
      intentType: replyData.intentType,
      id: saved.id,
    });
  } catch (error) {
    console.error('Error generating reply:', error);
    return NextResponse.json(
      { error: 'Failed to generate reply', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET - Get reply history
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 });
    }

    const replies = await db.smartReply.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ replies });
  } catch (error) {
    console.error('Error fetching replies:', error);
    return NextResponse.json({ error: 'Failed to fetch replies' }, { status: 500 });
  }
}
