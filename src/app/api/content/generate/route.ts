import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callClaudeOpus } from '@/lib/ai';

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
    // KEY BEHAVIOR: Never save as draft! Schedule to nearest preferred time.
    // Get the nearest scheduled time from the active schedule config
    let nearestScheduledTime: Date | null = null;
    const schedule = await db.scheduleConfig.findFirst({
      where: { businessId, isActive: true },
    });
    
    if (schedule?.preferredTimes) {
      // Parse preferred times (supports Arabic 12h format like "9ص, 6م" or 24h like "09:00, 18:00")
      let preferredTimesRaw = schedule.preferredTimes || '';
      try {
        const parsed = JSON.parse(preferredTimesRaw);
        if (Array.isArray(parsed)) {
          preferredTimesRaw = parsed.join(', ');
        } else if (typeof parsed === 'string') {
          preferredTimesRaw = parsed;
        }
      } catch {
        // Not JSON, use as-is
      }
      const preferredTimes = preferredTimesRaw.split(',').map(t => t.trim()).filter(Boolean);
      
      const now = new Date();
      const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Parse all preferred times into minutes from midnight
      const preferredMinutes: number[] = [];
      for (const timeStr of preferredTimes) {
        const arabicMatch = timeStr.match(/^(\d{1,2})(ص|م)$/);
        if (arabicMatch) {
          let hour = parseInt(arabicMatch[1]);
          if (arabicMatch[2] === 'ص') {
            if (hour === 12) hour = 0;
          } else {
            if (hour !== 12) hour += 12;
          }
          preferredMinutes.push(hour * 60);
        } else {
          const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
          if (timeMatch) {
            preferredMinutes.push(parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]));
          }
        }
      }
      
      preferredMinutes.sort((a, b) => a - b);
      
      // Find the nearest future time
      for (const mins of preferredMinutes) {
        if (mins > currentTotalMinutes) {
          nearestScheduledTime = new Date(now);
          nearestScheduledTime.setHours(Math.floor(mins / 60), mins % 60, 0, 0);
          break;
        }
      }
      
      // If no future time today, use the first preferred time tomorrow
      if (!nearestScheduledTime && preferredMinutes.length > 0) {
        nearestScheduledTime = new Date(now);
        nearestScheduledTime.setDate(nearestScheduledTime.getDate() + 1);
        nearestScheduledTime.setHours(Math.floor(preferredMinutes[0] / 60), preferredMinutes[0] % 60, 0, 0);
      }
    }
    
    const postStatus = nearestScheduledTime ? 'scheduled' : 'draft';

    const savedPosts = [];
    for (const post of generatedPosts.posts) {
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
          scheduledAt: nearestScheduledTime,
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

    const scheduleNote = nearestScheduledTime
      ? ` — مجدول للنشر في ${nearestScheduledTime.toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`
      : '';

    return NextResponse.json({
      posts: savedPosts,
      rawResponse: responseText,
      scheduledAt: nearestScheduledTime?.toISOString() || null,
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
