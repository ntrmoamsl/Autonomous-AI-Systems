import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callClaudeOpus } from '@/lib/ai';
import { parsePreferredTimes, getNextPreferredTimes } from '@/lib/schedule-utils';

// POST - Generate content using Claude Opus 4.8 (Executive Brain)
// Every post MUST have media (image or video) with text overlay
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, contentType, customPrompt, count = 1 } = body;

    // Get business profile (the "permanent memory")
    const business = await db.businessProfile.findUnique({
      where: { id: businessId },
      include: {
        posts: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        ideas: {
          where: { used: true },
          orderBy: { usedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!business) {
      return NextResponse.json({ error: 'Business profile not found' }, { status: 404 });
    }

    // Build the AI prompt with business context
    const recentContent = business.posts.map(p => p.content).join('\n---\n');
    const usedIdeas = business.ideas.map(i => i.idea).join('\n');
    const products = (() => {
      try { return JSON.parse(business.products); } catch { return business.products; }
    })();
    const goals = (() => {
      try { return JSON.parse(business.marketingGoals); } catch { return business.marketingGoals; }
    })();
    const offers = business.offers ? (() => {
      try { return JSON.parse(business.offers); } catch { return business.offers; }
    })() : null;
    const faqs = business.faqs ? (() => {
      try { return JSON.parse(business.faqs); } catch { return business.faqs; }
    })() : null;

    // Count recent media types for variety
    const recentMediaTypes = business.posts.slice(0, 10).map(p => p.mediaType || 'image');
    const recentVideoCount = recentMediaTypes.filter(m => m === 'video').length;
    const recentImageCount = recentMediaTypes.filter(m => m === 'image').length;

    const systemPrompt = `أنت وكيل تسويق ذكي ومستقل يعمل كموظف تسويق رقمي لشركة "${business.companyName}".

معلومات الشركة:
- الوصف: ${business.description}
- المنتجات والخدمات: ${typeof products === 'string' ? products : JSON.stringify(products, null, 2)}
- الجمهور المستهدف: ${business.targetAudience}
- أسلوب العلامة التجارية: ${business.toneOfVoice}
- أهداف التسويق: ${typeof goals === 'string' ? goals : JSON.stringify(goals, null, 2)}
${offers ? `- العروض والأسعار: ${typeof offers === 'string' ? offers : JSON.stringify(offers, null, 2)}` : ''}
${faqs ? `- الأسئلة الشائعة: ${typeof faqs === 'string' ? faqs : JSON.stringify(faqs, null, 2)}` : ''}
${business.additionalInfo ? `- معلومات إضافية: ${business.additionalInfo}` : ''}

${recentContent ? `المنشورات السابقة (لا تكررها أو تقترب منها):
${recentContent}` : ''}

${usedIdeas ? `الأفكار المستخدمة سابقًا (لا تكررها):
${usedIdeas}` : ''}

آخر 10 منشورات: صور=${recentImageCount} فيديو=${recentVideoCount}

قواعد صارمة:
1. لا تكرر نفس الفكرة أو الأسلوب بشكل قريب من المنشورات السابقة
2. نوّع بين أنواع المحتوى: تعليمي، تسويقي، قصصي، تفاعلي، ترويجي
3. التزم بأسلوب العلامة التجارية المحدد
4. أضف هاشتاجات مناسبة وفعالة
5. أضف Call To Action مناسب لكل منشور
6. المحتوى يجب أن يكون احترافيًا وجذابًا للجمهور المستهدف
7. أجب دائمًا باللغة العربية
8. **كل منشور يجب أن يحتوي على وسائط (صورة أو فيديو) - حدد mediaType لكل منشور**
9. **نوّع بين الصور والفيديو** - إذا كان أغلب المنشورات الأخيرة صور، اجعل هذا فيديو والعكس
10. **أضف textOverlay لكل منشور** - نص قصير جذاب يُكتب على الصورة/الفيديو (3-8 كلمات)
11. **أضف videoPrompt لكل منشور فيديو** - وصف بالإنجليزية للفيديو المطلوب إنشاؤه
12. المحتوى الترويجي والعروض يفضل أن يكون بالفيديو
13. المحتوى التعليمي والقصصي يمكن أن يكون صورة أو فيديو`;

    const userPrompt = customPrompt
      ? customPrompt
      : `قم بتوليد ${count} منشور ${contentType ? `من نوع "${contentType}"` : 'بأنواع متنوعة'} لمنصات التواصل الاجتماعي.

أجب بصيغة JSON فقط بالشكل التالي:
{
  "posts": [
    {
      "title": "عنوان المنشور",
      "content": "نص المنشور الكامل",
      "contentType": "educational|marketing|storytelling|interactive|promotional",
      "hashtags": ["هاشتاغ1", "هاشتاغ2"],
      "cta": "نداء الإجراء",
      "mediaType": "image|video",
      "textOverlay": "نص قصير جذاب يكتب على الصورة/الفيديو",
      "imagePrompt": "وصف بالإنجليزية لصورة مناسبة للمنشور (فقط إذا mediaType=image)",
      "videoPrompt": "وصف بالإنجليزية لفيديو مناسب للمنشور (فقط إذا mediaType=video)",
      "marketingAngle": "الزاوية التسويقية",
      "objective": "الهدف من المنشور"
    }
  ]
}`;

    // Use Claude Opus 4.8 as the Executive Brain via Kie.ai
    const responseText = await callClaudeOpus(
      [{ role: 'user', content: userPrompt }],
      { systemPrompt, maxTokens: 8192 }
    );

    // Parse the JSON response
    let generatedPosts;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        generatedPosts = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch {
      // If parsing fails, create a single post from the text
      generatedPosts = {
        posts: [{
          title: 'منشور جديد',
          content: responseText,
          contentType: contentType || 'marketing',
          hashtags: [],
          cta: 'تابعونا للمزيد',
          mediaType: 'image',
          textOverlay: 'عرض مميز',
          imagePrompt: 'Professional social media post design with text overlay',
          videoPrompt: null,
        }],
      };
    }

    // Save the generated content to database
    // KEY BEHAVIOR: Never save as draft! Schedule to nearest preferred times.
    // Each post gets its own scheduled time, distributed across the user's
    // preferred publishing times.
    // Example: 2 AM + preferred [3ص, 4ص, 5ص] + 3 posts → 3AM, 4AM, 5AM
    let scheduledTimes: Date[] = [];
    const schedule = await db.scheduleConfig.findFirst({
      where: { businessId, isActive: true },
    });
    
    if (schedule?.preferredTimes) {
      const preferredSlots = parsePreferredTimes(schedule.preferredTimes);
      if (preferredSlots.length > 0) {
        const now = new Date();
        scheduledTimes = getNextPreferredTimes(
          preferredSlots,
          now,
          generatedPosts.posts.length
        );
      }
    }
    
    const postStatus = scheduledTimes.length > 0 ? 'scheduled' : 'draft';

    const savedPosts = [];
    for (let i = 0; i < generatedPosts.posts.length; i++) {
      const post = generatedPosts.posts[i];
      const scheduledAt = scheduledTimes[i] || null;
      // Save content idea to prevent repetition
      await db.contentIdea.create({
        data: {
          businessId,
          idea: post.title || post.content.substring(0, 100),
          category: post.contentType || contentType || 'marketing',
          used: true,
          usedAt: new Date(),
        },
      });

      const mediaType = post.mediaType || 'image';

      const saved = await db.contentPost.create({
        data: {
          businessId,
          title: post.title || null,
          content: post.content,
          contentType: post.contentType || contentType || 'marketing',
          hashtags: Array.isArray(post.hashtags) ? post.hashtags.join(',') : (post.hashtags || ''),
          cta: post.cta || null,
          status: postStatus,
          scheduledAt,
          aiModel: 'claude-opus-4-8',
          generationPrompt: userPrompt,
          imagePrompt: mediaType === 'image' ? (post.imagePrompt || null) : null,
          videoPrompt: mediaType === 'video' ? (post.videoPrompt || null) : null,
          mediaType,
          textOverlay: post.textOverlay || null,
        },
      });

      savedPosts.push({
        ...saved,
        imagePrompt: post.imagePrompt || '',
        videoPrompt: post.videoPrompt || '',
        mediaType,
        textOverlay: post.textOverlay || '',
      });
    }

    const scheduleNote = scheduledTimes.length > 0
      ? ` — مجدول للنشر: ${scheduledTimes.map((t, i) => `المنشور ${i + 1} في ${t.toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`).join('، ')}`
      : '';

    return NextResponse.json({
      posts: savedPosts,
      rawResponse: responseText,
      scheduledAt: scheduledTimes[0]?.toISOString() || null,
      scheduledTimes: scheduledTimes.map(t => t.toISOString()),
      message: `تم إنشاء ${savedPosts.length} منشورات${scheduleNote}`,
    });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
