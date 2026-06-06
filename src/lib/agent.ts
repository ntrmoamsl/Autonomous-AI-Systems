/**
 * Autonomous AI Marketing Agent Engine
 * 
 * This is the core brain of the fully autonomous marketing system.
 * It uses Claude Opus 4.8 with function calling to make independent
 * marketing decisions: what to post, when, why, and how.
 * 
 * Key feature: Every post MUST have media (image or video).
 * The agent decides which media type based on content strategy.
 * Text overlay is written ON the image/video.
 */

import { db } from '@/lib/db';
import { callClaudeOpus, createImageTask, createVideoTask, getKieTaskDetail } from '@/lib/ai';
import { getFacebookConfig } from '@/lib/config';
import { addTextOverlay, createVideoPromptWithText } from '@/lib/text-overlay';

// ============================================================
// Types
// ============================================================

export type AgentAction = 
  | 'generate_content'
  | 'generate_image'
  | 'generate_video'
  | 'publish_post'
  | 'analyze_performance'
  | 'reply_comments'
  | 'schedule_post'
  | 'check_pending_tasks'
  | 'idle';

export interface AgentDecision {
  action: AgentAction;
  reasoning: string;
  parameters: Record<string, unknown>;
}

export interface AgentStatus {
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  mode: 'manual' | 'semi-auto' | 'fully-autonomous';
  totalDecisions: number;
  recentActions: number;
  pendingTasks: number;
}

export interface AgentRunResult {
  decisions: AgentDecision[];
  results: Array<{
    action: AgentAction;
    success: boolean;
    details: string;
    postId?: string;
    executionTime?: number;
  }>;
  summary: string;
}

// ============================================================
// Agent Context Builder - Builds the full context for the AI brain
// ============================================================

async function buildAgentContext(businessId: string): Promise<string> {
  const business = await db.businessProfile.findUnique({
    where: { id: businessId },
    include: {
      posts: { orderBy: { createdAt: 'desc' }, take: 20 },
      ideas: { where: { used: true }, orderBy: { usedAt: 'desc' }, take: 30 },
      schedules: { where: { isActive: true }, take: 1 },
      agentLogs: { orderBy: { createdAt: 'desc' }, take: 15 },
      analytics: { orderBy: { date: 'desc' }, take: 5 },
    },
  });

  if (!business) throw new Error('Business profile not found');

  const now = new Date();
  const today = now.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const currentTime = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  // Parse business data
  const products = safeParse(business.products);
  const goals = safeParse(business.marketingGoals);
  const offers = business.offers ? safeParse(business.offers) : null;
  const faqs = business.faqs ? safeParse(business.faqs) : null;

  // Analyze recent posts
  const recentPosts = business.posts.slice(0, 10);
  const publishedPosts = business.posts.filter(p => p.status === 'published');
  const draftPosts = business.posts.filter(p => p.status === 'draft');
  const scheduledPosts = business.posts.filter(p => p.status === 'scheduled');
  const failedPosts = business.posts.filter(p => p.status === 'failed');

  // Content type distribution
  const typeDistribution: Record<string, number> = {};
  publishedPosts.forEach(p => {
    typeDistribution[p.contentType] = (typeDistribution[p.contentType] || 0) + 1;
  });

  // Media type distribution (image vs video)
  const mediaDistribution: Record<string, number> = { image: 0, video: 0 };
  publishedPosts.forEach(p => {
    const mt = p.mediaType || 'image';
    mediaDistribution[mt] = (mediaDistribution[mt] || 0) + 1;
  });

  // Performance analysis
  const bestPerformingType = Object.entries(typeDistribution)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'marketing';

  // Recent content ideas used
  const usedIdeas = business.ideas.map(i => `- ${i.idea} (${i.category})`).join('\n');

  // Schedule info
  const schedule = business.schedules[0];
  const scheduleInfo = schedule
    ? `التكرار: ${schedule.frequency} | الأوقات المفضلة: ${schedule.preferredTimes || 'غير محدد'} | النشر التلقائي: ${schedule.autoPublish ? 'نعم' : 'لا'} | التوليد التلقائي: ${schedule.autoGenerate ? 'نعم' : 'لا'}`
    : 'لم يتم إعداد جدول';

  // Recent agent decisions
  const recentDecisions = business.agentLogs
    .map(log => `- [${log.action}] ${log.decision} → ${log.status} (${log.reasoning?.substring(0, 80) || ''}...)`)
    .join('\n');

  // Analytics summary
  const analyticsSummary = business.analytics.length > 0
    ? business.analytics.map(a => 
        `التاريخ: ${a.date.toLocaleDateString('ar-SA')} | المنشورات: ${a.totalPosts} | الوصول: ${a.totalReach} | التفاعل: ${a.avgEngagement.toFixed(2)} | أفضل نوع: ${a.bestContentType || 'غير محدد'}`
      ).join('\n')
    : 'لا توجد بيانات تحليلية بعد';

  // Time since last post
  const lastPost = recentPosts[0];
  const hoursSinceLastPost = lastPost
    ? Math.round((now.getTime() - new Date(lastPost.createdAt).getTime()) / (1000 * 60 * 60))
    : 999;

  // Time since last published post
  const lastPublished = publishedPosts[0];
  const hoursSinceLastPublish = lastPublished
    ? Math.round((now.getTime() - new Date(lastPublished.publishedAt || lastPublished.createdAt).getTime()) / (1000 * 60 * 60))
    : 999;

  const context = `
أنت وكيل تسويق ذكي ومستقل بالكامل (Autonomous AI Marketing Agent).
أنت تعمل كموظف تسويق رقمي بدوام كامل لشركة "${business.companyName}".
أنت لا تنتظر تعليمات بشرية - أنت تتخذ جميع القرارات التسويقية بنفسك.

=== الوقت الحالي ===
التاريخ: ${today}
الوقت: ${currentTime}
ساعات منذ آخر منشور: ${hoursSinceLastPost} ساعة
ساعات منذ آخر نشر: ${hoursSinceLastPublish} ساعة

=== بيانات الشركة (الذاكرة الدائمة) ===
الاسم: ${business.companyName}
الوصف: ${business.description}
المنتجات والخدمات: ${typeof products === 'string' ? products : JSON.stringify(products, null, 2)}
الجمهور المستهدف: ${business.targetAudience}
أسلوب العلامة التجارية: ${business.toneOfVoice}
أهداف التسويق: ${typeof goals === 'string' ? goals : JSON.stringify(goals, null, 2)}
${offers ? `العروض: ${typeof offers === 'string' ? offers : JSON.stringify(offers, null, 2)}` : ''}
${faqs ? `الأسئلة الشائعة: ${typeof faqs === 'string' ? faqs : JSON.stringify(faqs, null, 2)}` : ''}
${business.additionalInfo ? `معلومات إضافية: ${business.additionalInfo}` : ''}

=== حالة المحتوى الحالية ===
إجمالي المنشورات: ${business.posts.length}
منشورات منشورة: ${publishedPosts.length}
مسودات متاحة: ${draftPosts.length}
مجدولة: ${scheduledPosts.length}
فاشلة: ${failedPosts.length}
أفضل نوع محتوى أداءً: ${bestPerformingType}
توزيع أنواع المحتوى: ${JSON.stringify(typeDistribution)}
توزيع الوسائط (صور/فيديو): صور=${mediaDistribution.image} فيديو=${mediaDistribution.video}

=== الجدول ===
${scheduleInfo}

=== الأفكار المستخدمة سابقًا (لا تكررها!) ===
${usedIdeas || 'لا توجد أفكار مستخدمة بعد'}

=== المنشورات الأخيرة (لا تكررها أو تقترب منها!) ===
${recentPosts.map(p => `[${p.mediaType || 'image'}][${p.contentType}] ${p.title || p.content.substring(0, 100)}... → ${p.status}`).join('\n')}

=== بيانات التحليلات ===
${analyticsSummary}

=== قرارات الوكيل الأخيرة ===
${recentDecisions || 'لا توجد قرارات سابقة'}

=== قواعد صارمة ===
1. أنت تتخذ القرارات بشكل مستقل - لا تنتظر موافقة بشرية
2. نوّع المحتوى بشكل صارم - لا تكرر نفس الفكرة أو الأسلوب أو الزاوية التسويقية
3. كل منشور يجب أن يكون له هدف واضح (لماذا نشر هذا الآن؟ ما الهدف؟)
4. استخدم بيانات الأداء لتحسين القرارات - ركز على أنواع المحتوى الأفضل أداءً
5. التزم بأسلوب العلامة التجارية في كل شيء
6. أضف هاشتاجات مناسبة وفعالة
7. أضف Call To Action مناسب
8. **كل منشور يجب أن يحتوي على وسائط (صورة أو فيديو) - لا تنشر نص فقط أبداً**
9. **أنت تقرر لكل منشور: صورة أم فيديو** - نوّع بينهم بناءً على نوع المحتوى والاستراتيجية
10. **أضف نص قصير وجذاب (textOverlay) ليُكتب على الصورة أو الفيديو** - يكون ملخص أو عنوان أو جملة جذابة
11. أنشئ وصفًا بالإنجليزية لصورة/فيديو مناسب لكل منشور
12. المحتوى باللغة العربية دائمًا
13. إذا مرت أكثر من 24 ساعة بدون نشر، يجب إنشاء ونشر محتوى جديد
14. إذا كانت هناك مسودات متاحة، انشرها قبل إنشاء محتوى جديد
15. تحقق من المهام المعلقة (صور/فيديو قيد المعالجة) قبل إنشاء وسائط جديدة
16. نوّع بين الصور والفيديو - لا تعتمد على نوع واحد فقط

أجب بصيغة JSON فقط:
{
  "decisions": [
    {
      "action": "generate_content|generate_image|generate_video|publish_post|analyze_performance|reply_comments|schedule_post|check_pending_tasks|idle",
      "reasoning": "لماذا اتخذت هذا القرار",
      "parameters": {
        // معلمات الإجراء المطلوب
      }
    }
  ]
}`;

  return context;
}

// ============================================================
// Agent Actions - The actual execution of decisions
// ============================================================

async function executeGenerateContent(businessId: string, parameters: Record<string, unknown>): Promise<{ success: boolean; details: string; postId?: string }> {
  const contentType = (parameters.contentType as string) || undefined;
  const customPrompt = parameters.customPrompt as string | undefined;
  const count = (parameters.count as number) || 1;

  // Get business profile
  const business = await db.businessProfile.findUnique({
    where: { id: businessId },
    include: {
      posts: { orderBy: { createdAt: 'desc' }, take: 10 },
      ideas: { where: { used: true }, orderBy: { usedAt: 'desc' }, take: 20 },
    },
  });

  if (!business) return { success: false, details: 'Business profile not found' };

  const recentContent = business.posts.map(p => p.content).join('\n---\n');
  const usedIdeas = business.ideas.map(i => i.idea).join('\n');
  const products = safeParse(business.products);
  const goals = safeParse(business.marketingGoals);

  // Count recent image vs video posts for variety
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
${business.offers ? `- العروض: ${business.offers}` : ''}
${business.faqs ? `- الأسئلة الشائعة: ${business.faqs}` : ''}
${business.additionalInfo ? `- معلومات إضافية: ${business.additionalInfo}` : ''}

${recentContent ? `المنشورات السابقة (لا تكررها أو تقترب منها):\n${recentContent}` : ''}

${usedIdeas ? `الأفكار المستخدمة سابقًا (لا تكررها):\n${usedIdeas}` : ''}

آخر 10 منشورات: صور=${recentImageCount} فيديو=${recentVideoCount}

قواعد صارمة:
1. لا تكرر نفس الفكرة أو الأسلوب بشكل قريب من المنشورات السابقة
2. نوّع بين أنواع المحتوى: تعليمي، تسويقي، قصصي، تفاعلي، ترويجي
3. التزم بأسلوب العلامة التجارية المحدد
4. أضف هاشتاجات مناسبة وفعالة
5. أضف Call To Action مناسب لكل منشور
6. المحتوى يجب أن يكون احترافيًا وجذابًا للجمهور المستهدف
7. أجب دائمًا باللغة العربية
8. كل منشور يجب أن يكون له هدف واضح وزاوية تسويقية مختلفة
9. **كل منشور يجب أن يحتوي على وسائط (صورة أو فيديو) - حدد mediaType لكل منشور**
10. **نوّع بين الصور والفيديو** - إذا كان أغلب المنشورات الأخيرة صور، اجعل هذا فيديو والعكس
11. **أضف textOverlay لكل منشور** - نص قصير جذاب يُكتب على الصورة/الفيديو (3-8 كلمات)
12. **أضف videoPrompt لكل منشور فيديو** - وصف بالإنجليزية للفيديو المطلوب إنشاؤه
13. المحتوى الترويجي والعروض يفضل أن يكون بالفيديو
14. المحتوى التعليمي والقصصي يمكن أن يكون صورة أو فيديو`;

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
      "marketingAngle": "الزاوية التسويقية المستخدمة",
      "objective": "الهدف من هذا المنشور"
    }
  ]
}`;

  const responseText = await callClaudeOpus(
    [{ role: 'user', content: userPrompt }],
    { systemPrompt, maxTokens: 8192 }
  );

  let generatedPosts;
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      generatedPosts = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON found');
    }
  } catch {
    generatedPosts = {
      posts: [{
        title: 'منشور جديد',
        content: responseText,
        contentType: contentType || 'marketing',
        hashtags: [],
        cta: 'تابعونا للمزيد',
        mediaType: 'image',
        textOverlay: 'عرض خاص',
        imagePrompt: 'Professional social media post design with text overlay',
        videoPrompt: null,
        marketingAngle: 'عام',
        objective: 'زيادة التفاعل',
      }],
    };
  }

  let lastPostId: string | undefined;
  for (const post of generatedPosts.posts) {
    await db.contentIdea.create({
      data: {
        businessId,
        idea: post.title || post.content.substring(0, 100),
        category: post.contentType || contentType || 'marketing',
        angle: post.marketingAngle || null,
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
        status: 'draft',
        aiModel: 'claude-opus-4-8',
        generationPrompt: userPrompt,
        imagePrompt: mediaType === 'image' ? (post.imagePrompt || null) : null,
        videoPrompt: mediaType === 'video' ? (post.videoPrompt || null) : null,
        mediaType,
        textOverlay: post.textOverlay || null,
        decisionReason: post.objective || 'قرار وكيل مستقل',
        isAutonomous: true,
      },
    });

    lastPostId = saved.id;
  }

  return { 
    success: true, 
    details: `تم إنشاء ${generatedPosts.posts.length} منشورات بشكل مستقل`,
    postId: lastPostId,
  };
}

async function executeGenerateImage(businessId: string, parameters: Record<string, unknown>): Promise<{ success: boolean; details: string; postId?: string }> {
  const postId = parameters.postId as string;
  const imagePrompt = parameters.imagePrompt as string;
  const aspectRatio = (parameters.aspectRatio as string) || 'auto';

  if (!postId || !imagePrompt) {
    return { success: false, details: 'Post ID and image prompt are required' };
  }

  try {
    // Always use GPT Image 2 for image generation
    const taskResult = await createImageTask({
      prompt: imagePrompt,
      aspectRatio,
    });

    const taskId = taskResult.data?.taskId || taskResult.data?.task_id;

    if (!taskId) {
      return { success: false, details: 'Failed to create image task - no task ID returned' };
    }

    await db.contentPost.update({
      where: { id: postId },
      data: {
        videoTaskId: taskId,
        aiModel: 'gpt-image-2',
        imagePrompt,
        mediaType: 'image',
      },
    });

    return { success: true, details: `Image generation task created (GPT Image 2), task ID: ${taskId}`, postId };
  } catch (error) {
    return { success: false, details: `Image generation failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function executeGenerateVideo(businessId: string, parameters: Record<string, unknown>): Promise<{ success: boolean; details: string; postId?: string }> {
  const postId = parameters.postId as string;
  const videoPrompt = parameters.videoPrompt as string;
  const textOverlay = parameters.textOverlay as string | undefined;

  if (!postId || !videoPrompt) {
    return { success: false, details: 'Post ID and video prompt are required' };
  }

  try {
    // If there's text overlay, embed it in the video prompt
    const enhancedPrompt = textOverlay 
      ? createVideoPromptWithText(videoPrompt, textOverlay)
      : videoPrompt;

    // Always use Grok Imagine Text-to-Video for video generation
    const taskResult = await createVideoTask({
      prompt: enhancedPrompt,
      aspectRatio: '16:9',
      mode: 'normal',
      duration: 6,
      resolution: '480p',
    });

    const taskId = taskResult.data?.taskId || taskResult.data?.task_id;

    if (!taskId) {
      return { success: false, details: `Video generation failed - no task ID. Response: ${JSON.stringify(taskResult).substring(0, 200)}` };
    }

    await db.contentPost.update({
      where: { id: postId },
      data: {
        videoTaskId: taskId,
        aiModel: 'grok-imagine-text-to-video',
        videoPrompt,
        mediaType: 'video',
      },
    });

    return { success: true, details: `Video generation task created (Grok Imagine), task ID: ${taskId}`, postId };
  } catch (error) {
    return { success: false, details: `Video generation failed: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function executePublishPost(businessId: string, parameters: Record<string, unknown>): Promise<{ success: boolean; details: string; postId?: string }> {
  const postId = parameters.postId as string;

  if (!postId) {
    // Try to find a draft post to publish
    const draftPost = await db.contentPost.findFirst({
      where: { businessId, status: 'draft' },
      orderBy: { createdAt: 'asc' },
    });

    if (!draftPost) {
      return { success: false, details: 'No draft posts available to publish' };
    }

    return executePublishPostById(draftPost.id);
  }

  return executePublishPostById(postId);
}

async function executePublishPostById(postId: string): Promise<{ success: boolean; details: string; postId?: string }> {
  const post = await db.contentPost.findUnique({ where: { id: postId } });
  if (!post) return { success: false, details: 'Post not found' };

  const { accessToken, pageId, apiVersion } = getFacebookConfig();

  if (!accessToken || !pageId) {
    // Mark as "published" locally if no Facebook config
    await db.contentPost.update({
      where: { id: postId },
      data: { status: 'published', publishedAt: new Date() },
    });
    return { success: true, details: 'Published locally (Facebook not configured)', postId };
  }

  try {
    let fbResponse;
    const fbBaseUrl = `https://graph.facebook.com/${apiVersion}/${pageId}`;
    const message = `${post.content}\n\n${post.hashtags ? post.hashtags.split(',').map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ') : ''}${post.cta ? '\n\n' + post.cta : ''}`;

    if (post.mediaType === 'video' && post.videoUrl) {
      // Publish video post
      const videoRes = await fetch(
        `${fbBaseUrl}/videos?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_url: post.videoUrl,
            description: message,
          }),
        }
      );
      fbResponse = await videoRes.json();
    } else if (post.imageData) {
      // Publish image post (with text overlay already applied)
      const imageRes = await fetch(
        `${fbBaseUrl}/photos?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            url: post.imageUrl || '',
            published: true,
          }),
        }
      );
      
      if (!imageRes.ok) {
        // Fallback: text-only post
        const textRes = await fetch(
          `${fbBaseUrl}/feed?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
          }
        );
        fbResponse = await textRes.json();
      } else {
        fbResponse = await imageRes.json();
      }
    } else {
      // Text-only post (shouldn't happen with the new rules, but fallback)
      const res = await fetch(
        `${fbBaseUrl}/feed?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        }
      );
      fbResponse = await res.json();
    }

    if (fbResponse.error) {
      await db.contentPost.update({
        where: { id: postId },
        data: {
          status: 'failed',
          publishResult: JSON.stringify(fbResponse.error),
          retryCount: post.retryCount + 1,
        },
      });
      return { success: false, details: `Facebook error: ${fbResponse.error.message || JSON.stringify(fbResponse.error)}`, postId };
    }

    await db.contentPost.update({
      where: { id: postId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishResult: JSON.stringify(fbResponse),
      },
    });

    return { success: true, details: `Post published to Facebook as ${post.mediaType || 'image'} post`, postId };
  } catch (error) {
    await db.contentPost.update({
      where: { id: postId },
      data: { status: 'failed', retryCount: post.retryCount + 1 },
    });
    return { success: false, details: `Publishing failed: ${error instanceof Error ? error.message : String(error)}`, postId };
  }
}

async function executeAnalyzePerformance(businessId: string): Promise<{ success: boolean; details: string }> {
  const posts = await db.contentPost.findMany({
    where: { businessId, status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 20,
  });

  if (posts.length === 0) {
    return { success: false, details: 'No published posts to analyze' };
  }

  const contentTypeStats: Record<string, { count: number; totalLikes: number; totalComments: number; totalShares: number; totalReach: number }> = {};

  posts.forEach(p => {
    if (!contentTypeStats[p.contentType]) {
      contentTypeStats[p.contentType] = { count: 0, totalLikes: 0, totalComments: 0, totalShares: 0, totalReach: 0 };
    }
    contentTypeStats[p.contentType].count++;
    contentTypeStats[p.contentType].totalLikes += p.likeCount || 0;
    contentTypeStats[p.contentType].totalComments += p.commentCount || 0;
    contentTypeStats[p.contentType].totalShares += p.shareCount || 0;
    contentTypeStats[p.contentType].totalReach += p.reachCount || 0;
  });

  let bestContentType = 'marketing';
  let bestEngagement = 0;

  Object.entries(contentTypeStats).forEach(([type, stats]) => {
    const engagement = stats.count > 0 ? (stats.totalLikes + stats.totalComments + stats.totalShares) / stats.count : 0;
    if (engagement > bestEngagement) {
      bestEngagement = engagement;
      bestContentType = type;
    }
  });

  // Find best posting time from published posts
  const hourCounts: Record<number, number> = {};
  posts.forEach(p => {
    if (p.publishedAt) {
      const hour = new Date(p.publishedAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }
  });
  const bestHour = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || '12';

  const totalReach = posts.reduce((sum, p) => sum + (p.reachCount || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likeCount || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.commentCount || 0), 0);
  const totalShares = posts.reduce((sum, p) => sum + (p.shareCount || 0), 0);

  // Media type performance
  const imagePosts = posts.filter(p => p.mediaType === 'image');
  const videoPosts = posts.filter(p => p.mediaType === 'video');
  const imageEngagement = imagePosts.length > 0 
    ? (imagePosts.reduce((s, p) => s + (p.likeCount || 0) + (p.commentCount || 0) + (p.shareCount || 0), 0)) / imagePosts.length 
    : 0;
  const videoEngagement = videoPosts.length > 0 
    ? (videoPosts.reduce((s, p) => s + (p.likeCount || 0) + (p.commentCount || 0) + (p.shareCount || 0), 0)) / videoPosts.length 
    : 0;

  await db.analyticsSnapshot.create({
    data: {
      businessId,
      date: new Date(),
      totalPosts: posts.length,
      totalReach,
      totalLikes,
      totalComments,
      totalShares,
      avgEngagement: posts.length > 0 ? (totalLikes + totalComments + totalShares) / posts.length : 0,
      bestContentType,
      bestPostTime: `${bestHour}:00`,
    },
  });

  return { success: true, details: `Analytics: Best type=${bestContentType}, Best hour=${bestHour}:00, Image avg=${imageEngagement.toFixed(1)}, Video avg=${videoEngagement.toFixed(1)}` };
}

async function executeCheckPendingTasks(businessId: string): Promise<{ success: boolean; details: string }> {
  const pendingPosts = await db.contentPost.findMany({
    where: { businessId, videoTaskId: { not: null } },
    take: 5,
  });

  if (pendingPosts.length === 0) {
    return { success: true, details: 'No pending media tasks' };
  }

  let completed = 0;
  let failed = 0;

  for (const post of pendingPosts) {
    if (!post.videoTaskId) continue;

    try {
      const result = await getKieTaskDetail(post.videoTaskId);
      const taskStatus = result.data?.taskStatus || result.data?.task_status || result.data?.status || 'unknown';

      if (taskStatus === 'SUCCESS' || taskStatus === 'completed' || taskStatus === 'succeeded') {
        const output = result.data?.output || result.data;

        // Handle image result
        if (post.mediaType === 'image' || (!post.mediaType && !post.videoUrl)) {
          const imageUrl = output?.image_url || output?.imageUrl ||
            (Array.isArray(output?.images) ? output.images[0]?.url : null) ||
            (Array.isArray(output?.image_urls) ? output.image_urls[0] : null) ||
            output?.url || output?.result;

          if (imageUrl) {
            await db.contentPost.update({
              where: { id: post.id },
              data: { imageUrl: typeof imageUrl === 'string' ? imageUrl : '', videoTaskId: null },
            });

            // Download image and apply text overlay
            try {
              const imageResponse = await fetch(imageUrl);
              if (imageResponse.ok) {
                const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
                
                // Apply text overlay if defined
                let finalBase64: string;
                if (post.textOverlay) {
                  const overlayBuffer = await addTextOverlay(imageBuffer, {
                    text: post.textOverlay,
                    fontSize: 42,
                    position: 'bottom',
                    backgroundColor: 'rgba(0,0,0,0.65)',
                  });
                  finalBase64 = overlayBuffer.toString('base64');
                } else {
                  finalBase64 = imageBuffer.toString('base64');
                }

                await db.contentPost.update({
                  where: { id: post.id },
                  data: { imageData: finalBase64 },
                });
              }
            } catch {
              // URL stored, base64/overlay failed - that's OK
            }

            completed++;
          }
        }
        // Handle video result
        else if (post.mediaType === 'video') {
          const videoUrl = output?.video_url || output?.videoUrl || 
            (Array.isArray(output?.videos) ? output.videos[0]?.url : null) ||
            output?.url || output?.result;

          if (videoUrl) {
            await db.contentPost.update({
              where: { id: post.id },
              data: { 
                videoUrl: typeof videoUrl === 'string' ? videoUrl : '', 
                videoTaskId: null,
              },
            });
            completed++;
          }
        }
      } else if (taskStatus === 'FAILED' || taskStatus === 'failed') {
        await db.contentPost.update({
          where: { id: post.id },
          data: { videoTaskId: null },
        });
        failed++;
      }
    } catch (error) {
      console.error('Error checking pending task:', error);
    }
  }

  return { success: true, details: `Checked ${pendingPosts.length} pending tasks. Completed: ${completed}, Failed: ${failed}` };
}

async function executeSchedulePost(businessId: string, parameters: Record<string, unknown>): Promise<{ success: boolean; details: string; postId?: string }> {
  const postId = parameters.postId as string;
  const scheduledAt = parameters.scheduledAt as string;

  if (!postId) {
    const draftPost = await db.contentPost.findFirst({
      where: { businessId, status: 'draft' },
      orderBy: { createdAt: 'asc' },
    });
    if (!draftPost) return { success: false, details: 'No draft posts to schedule' };
    return executeSchedulePostById(draftPost.id, scheduledAt);
  }

  return executeSchedulePostById(postId, scheduledAt);
}

async function executeSchedulePostById(postId: string, scheduledAt?: string): Promise<{ success: boolean; details: string; postId?: string }> {
  await db.contentPost.update({
    where: { id: postId },
    data: {
      status: 'scheduled',
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    },
  });

  return { success: true, details: `Post scheduled for ${scheduledAt || 'next available time'}`, postId };
}

// ============================================================
// Main Agent Run - The autonomous decision-making loop
// ============================================================

export async function runAgentCycle(businessId: string): Promise<AgentRunResult> {
  const startTime = Date.now();
  const results: AgentRunResult['results'] = [];
  const decisions: AgentDecision[] = [];

  try {
    // ═══════════════════════════════════════════════════════════
    // PRIORITY CHECK: Is it a preferred publishing time?
    // This runs FIRST before any thinking, to ensure timely publishing.
    // If it's publish time + there are ready posts → publish immediately!
    // ═══════════════════════════════════════════════════════════
    const publishWindow = await checkPublishTimeWindow(businessId);
    
    if (publishWindow.isPublishTime) {
      // PRIORITY ACTION: Auto-publish all ready posts at preferred time
      const publishResults = await autoPublishAtPreferredTime(businessId);
      
      for (const pr of publishResults) {
        results.push({
          action: 'publish_post',
          success: pr.success,
          details: `[نشر تلقائي - وقت مفضل] ${pr.details}`,
          postId: pr.postId,
          executionTime: Date.now() - startTime,
        });
      }

      // Log the priority publish event
      if (publishResults.length > 0) {
        await db.agentLog.create({
          data: {
            businessId,
            action: 'publish_post',
            decision: JSON.stringify({ 
              autoPublish: true, 
              reason: 'preferred_time_priority',
              matchedTime: publishWindow.matchedTime,
              postsPublished: publishResults.length,
            }),
            reasoning: `⏰ حان وقت النشر المفضل (${publishWindow.matchedTime}) — تم نشر ${publishResults.length} منشورات بالأولوية القصوى قبل بدء التفكير`,
            status: 'completed',
            result: JSON.stringify(publishResults),
          },
        });
      }

      // Continue with thinking cycle AFTER publishing
      // This way, the agent can generate new content for the NEXT publish time
    }

    // Step 1: Check for pending media tasks first
    const pendingCheck = await executeCheckPendingTasks(businessId);

    // Step 2: Build context for Claude
    const context = await buildAgentContext(businessId);

    // Add publish-time awareness to the context
    const publishTimeNote = publishWindow.isPublishTime
      ? `\n\n⚠️ تنبيه مهم: الوقت الحالي هو وقت النشر المفضل (${publishWindow.matchedTime})! تم بالفعل نشر المنشورات الجاهزة تلقائياً. الآن يجب أن تولد محتوى جديد للوقت المفضل القادم.`
      : publishWindow.matchedTime && publishWindow.scheduledPostsReady === 0
        ? `\n\n💡 ملاحظة: الوقت الحالي قريب من وقت النشر المفضل (${publishWindow.matchedTime}) لكن لا توجد منشورات جاهزة. يجب توليد محتوى بالسرعة الممكنة.`
        : '';

    // Step 3: Ask Claude what to do
    const agentPrompt = `${publishTimeNote}

بناءً على كل المعلومات أعلاه، ما الذي يجب أن تفعله الآن كوكيل تسويق مستقل؟

تحليل سريع:
- هل حان وقت نشر محتوى جديد؟
- هل هناك مسودات يجب نشرها؟
- هل هناك وسائط (صور/فيديو) معلقة يجب فحصها؟
- هل يجب تحليل الأداء؟
- ما نوع المحتوى الأنسب للوقت الحالي؟
- ما الزاوية التسويقية الأفضل؟
- هل يجب إنشاء صورة أم فيديو للمنشور القادم؟

اتخذ قرارك وأجب بصيغة JSON فقط:
{
  "decisions": [
    {
      "action": "generate_content أو publish_post أو schedule_post أو analyze_performance أو check_pending_tasks أو idle",
      "reasoning": "شرح مفصل لماذا اتخذت هذا القرار",
      "parameters": {
        // بالنسبة لتوليد المحتوى: contentType, count, customPrompt
        // بالنسبة للنشر: postId (اختياري - سيختار أقرب مسودة)
        // بالنسبة للجدولة: postId, scheduledAt
        // بالنسبة للتحليل: لا توجد معلمات
      }
    }
  ]
}`;

    const responseText = await callClaudeOpus(
      [{ role: 'user', content: agentPrompt }],
      { systemPrompt: context, maxTokens: 4096 }
    );

    // Step 4: Parse decisions
    let parsedDecisions;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedDecisions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      parsedDecisions = { decisions: [] };
    }

    // Step 5: Execute each decision
    for (const decision of (parsedDecisions?.decisions || []) as AgentDecision[]) {
      const actionStart = Date.now();
      decisions.push(decision);

      // Log the decision
      const log = await db.agentLog.create({
        data: {
          businessId,
          action: decision.action,
          decision: JSON.stringify(decision.parameters),
          reasoning: decision.reasoning,
          status: 'executing',
        },
      });

      try {
        let result: { success: boolean; details: string; postId?: string };

        switch (decision.action) {
          case 'generate_content':
            result = await executeGenerateContent(businessId, decision.parameters);
            // After generating content, also generate media for the post
            if (result.success && result.postId) {
              const post = await db.contentPost.findUnique({ where: { id: result.postId } });
              if (post) {
                if (post.mediaType === 'video' && post.videoPrompt) {
                  // Generate video using Grok Imagine Text-to-Video
                  const vidResult = await executeGenerateVideo(businessId, {
                    postId: result.postId,
                    videoPrompt: post.videoPrompt,
                    textOverlay: post.textOverlay,
                  });
                  results.push({
                    action: 'generate_video',
                    success: vidResult.success,
                    details: vidResult.details,
                    postId: result.postId,
                    executionTime: Date.now() - actionStart,
                  });
                } else if (post.imagePrompt) {
                  // Generate image using GPT Image 2
                  const imgResult = await executeGenerateImage(businessId, {
                    postId: result.postId,
                    imagePrompt: post.imagePrompt,
                    aspectRatio: 'auto',
                  });
                  results.push({
                    action: 'generate_image',
                    success: imgResult.success,
                    details: imgResult.details,
                    postId: result.postId,
                    executionTime: Date.now() - actionStart,
                  });
                } else {
                  // No prompt provided - generate one based on content
                  const fallbackPrompt = `Professional marketing image for social media post about ${post.content.substring(0, 100)}`;
                  const imgResult = await executeGenerateImage(businessId, {
                    postId: result.postId,
                    imagePrompt: fallbackPrompt,
                    aspectRatio: 'auto',
                  });
                  results.push({
                    action: 'generate_image',
                    success: imgResult.success,
                    details: imgResult.details,
                    postId: result.postId,
                    executionTime: Date.now() - actionStart,
                  });
                }
              }
            }
            break;
          case 'generate_image':
            result = await executeGenerateImage(businessId, decision.parameters);
            break;
          case 'generate_video':
            result = await executeGenerateVideo(businessId, decision.parameters);
            break;
          case 'publish_post':
            result = await executePublishPost(businessId, decision.parameters);
            break;
          case 'analyze_performance':
            result = await executeAnalyzePerformance(businessId);
            break;
          case 'check_pending_tasks':
            result = pendingCheck;
            break;
          case 'schedule_post':
            result = await executeSchedulePost(businessId, decision.parameters);
            break;
          case 'idle':
            result = { success: true, details: 'Agent is idle - no action needed at this time' };
            break;
          default:
            result = { success: false, details: `Unknown action: ${decision.action}` };
        }

        // Update log with result
        await db.agentLog.update({
          where: { id: log.id },
          data: {
            status: result.success ? 'completed' : 'failed',
            result: JSON.stringify(result),
            executionTime: Date.now() - actionStart,
            relatedPostId: result.postId || null,
          },
        });

        results.push({
          action: decision.action,
          success: result.success,
          details: result.details,
          postId: result.postId,
          executionTime: Date.now() - actionStart,
        });
      } catch (error) {
        await db.agentLog.update({
          where: { id: log.id },
          data: {
            status: 'failed',
            result: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
            executionTime: Date.now() - actionStart,
          },
        });

        results.push({
          action: decision.action,
          success: false,
          details: `Error: ${error instanceof Error ? error.message : String(error)}`,
          executionTime: Date.now() - actionStart,
        });
      }
    }

    // If no decisions were made, log as idle
    if (decisions.length === 0) {
      await db.agentLog.create({
        data: {
          businessId,
          action: 'idle',
          decision: '{}',
          reasoning: 'No decisions returned from AI brain',
          status: 'completed',
        },
      });
    }

    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;

    return {
      decisions,
      results,
      summary: `Agent cycle completed in ${totalTime}ms. ${successCount}/${results.length} actions successful.`,
    };
  } catch (error) {
    return {
      decisions: [],
      results: [{
        action: 'idle',
        success: false,
        details: `Agent cycle failed: ${error instanceof Error ? error.message : String(error)}`,
        executionTime: Date.now() - startTime,
      }],
      summary: `Agent cycle failed after ${Date.now() - startTime}ms`,
    };
  }
}

// ============================================================
// Agent Status
// ============================================================

export async function getAgentStatus(businessId: string): Promise<AgentStatus> {
  const business = await db.businessProfile.findUnique({
    where: { id: businessId },
    include: {
      agentLogs: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  if (!business) {
    return {
      isRunning: false,
      lastRunAt: null,
      nextRunAt: null,
      mode: 'manual',
      totalDecisions: 0,
      recentActions: 0,
      pendingTasks: 0,
    };
  }

  const lastLog = business.agentLogs[0];
  const totalDecisions = await db.agentLog.count({ where: { businessId } });
  const recentActions = await db.agentLog.count({
    where: { businessId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const pendingTasks = await db.contentPost.count({
    where: { businessId, videoTaskId: { not: null } },
  });

  return {
    isRunning: lastLog?.status === 'executing',
    lastRunAt: lastLog?.createdAt?.toISOString() || null,
    nextRunAt: null,
    mode: (business.agentMode as AgentStatus['mode']) || 'manual',
    totalDecisions,
    recentActions,
    pendingTasks,
  };
}

// ============================================================
// Publish Time Checker - Smart scheduling awareness
// ============================================================

/**
 * Checks if the current time is within a preferred publishing time window.
 * Returns the matched time and how many minutes until the window closes.
 * 
 * Logic: If current time is within ±5 minutes of a preferred time,
 * it's considered "publish time" and publishing gets priority.
 */
async function checkPublishTimeWindow(businessId: string): Promise<{
  isPublishTime: boolean;
  matchedTime: string | null;
  minutesRemaining: number;
  scheduledPostsReady: number;
}> {
  const schedule = await db.scheduleConfig.findFirst({
    where: { businessId, isActive: true },
  });

  if (!schedule || !schedule.preferredTimes || !schedule.autoPublish) {
    return { isPublishTime: false, matchedTime: null, minutesRemaining: 0, scheduledPostsReady: 0 };
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Parse preferred times (supports formats: "9ص", "6م", "09:00", "18:00", or JSON array)
  let preferredTimesRaw = schedule.preferredTimes || '';
  // Handle JSON-stringified format: "\"9ص, 6م\"" or "[\"9ص\",\"6م\"]"
  try {
    const parsed = JSON.parse(preferredTimesRaw);
    if (Array.isArray(parsed)) {
      preferredTimesRaw = parsed.join(', ');
    } else if (typeof parsed === 'string') {
      preferredTimesRaw = parsed;
    }
  } catch {
    // Not JSON, use as-is (plain string like "9ص, 6م")
  }
  const preferredTimes = preferredTimesRaw.split(',').map(t => t.trim()).filter(Boolean);
  
  let matchedTime: string | null = null;
  let minutesRemaining = 0;

  for (const timeStr of preferredTimes) {
    const parsed = parseArabicTime(timeStr);
    if (!parsed) continue;

    const diffMinutes = (parsed.hour * 60 + parsed.minute) - (currentHour * 60 + currentMinute);
    
    // Within ±5 minutes of preferred time = publish window
    if (diffMinutes >= -5 && diffMinutes <= 5) {
      matchedTime = timeStr;
      minutesRemaining = 5 - diffMinutes; // How many minutes left in window
      break;
    }
  }

  // Count scheduled posts that are ready to publish
  const scheduledPostsReady = matchedTime
    ? await db.contentPost.count({
        where: {
          businessId,
          status: { in: ['scheduled', 'draft'] },
        },
      })
    : 0;

  return {
    isPublishTime: !!matchedTime && scheduledPostsReady > 0,
    matchedTime,
    minutesRemaining: Math.max(0, minutesRemaining),
    scheduledPostsReady,
  };
}

/**
 * Parses Arabic 12-hour time format to 24-hour format.
 * Supports: "9ص", "10م", "12ص", "1م", "09:00", "18:00"
 */
function parseArabicTime(timeStr: string): { hour: number; minute: number } | null {
  // Try Arabic format first (e.g., "9ص", "10م", "12ص", "1م")
  const arabicMatch = timeStr.match(/^(\d{1,2})(ص|م)$/);
  if (arabicMatch) {
    let hour = parseInt(arabicMatch[1]);
    const period = arabicMatch[2];
    
    if (period === 'ص') { // AM
      if (hour === 12) hour = 0; // 12ص = midnight
    } else { // PM
      if (hour !== 12) hour += 12; // 1م=13, 12م=12
    }
    
    return { hour, minute: 0 };
  }

  // Try 24-hour format (e.g., "09:00", "18:00")
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    return { hour: parseInt(timeMatch[1]), minute: parseInt(timeMatch[2]) };
  }

  return null;
}

/**
 * Auto-publishes all scheduled/draft posts when it's a preferred publishing time.
 * This runs BEFORE the agent's thinking cycle to ensure timely publishing.
 */
async function autoPublishAtPreferredTime(businessId: string): Promise<Array<{ success: boolean; details: string; postId?: string }>> {
  const results: Array<{ success: boolean; details: string; postId?: string }> = [];
  
  // Get all scheduled posts (ordered by creation time)
  const scheduledPosts = await db.contentPost.findMany({
    where: {
      businessId,
      status: { in: ['scheduled', 'draft'] },
    },
    orderBy: [
      { status: 'asc' }, // scheduled first, then draft
      { createdAt: 'asc' },
    ],
  });

  for (const post of scheduledPosts) {
    // Only publish posts that have media ready (image or video)
    const hasMedia = post.imageData || post.imageUrl || post.videoUrl;
    if (!hasMedia) {
      // Skip posts without media - they'll be picked up after media generation
      continue;
    }

    const result = await executePublishPostById(post.id);
    results.push(result);

    // Log the auto-publish action
    await db.agentLog.create({
      data: {
        businessId,
        action: 'publish_post',
        decision: JSON.stringify({ postId: post.id, autoPublish: true, reason: 'preferred_publish_time' }),
        reasoning: `نشر تلقائي في الوقت المفضل - المنشور جاهز ووقت النشر حان`,
        status: result.success ? 'completed' : 'failed',
        result: JSON.stringify(result),
        relatedPostId: post.id,
      },
    });
  }

  return results;
}

// ============================================================
// Utility
// ============================================================

function safeParse(str: string): unknown {
  try { return JSON.parse(str); } catch { return str; }
}
