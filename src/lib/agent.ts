/**
 * Autonomous AI Marketing Agent Engine
 * 
 * This is the core brain of the fully autonomous marketing system.
 * It uses Claude Opus 4.8 with function calling to make independent
 * marketing decisions: what to post, when, why, and how.
 * 
 * After initial training, it operates without human intervention.
 */

import { db } from '@/lib/db';
import { callClaudeOpus, createImageTask, getKieTaskDetail } from '@/lib/ai';
import { getFacebookConfig } from '@/lib/config';

// ============================================================
// Types
// ============================================================

export type AgentAction = 
  | 'generate_content'
  | 'generate_image'
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

=== الجدول ===
${scheduleInfo}

=== الأفكار المستخدمة سابقًا (لا تكررها!) ===
${usedIdeas || 'لا توجد أفكار مستخدمة بعد'}

=== المنشورات الأخيرة (لا تكررها أو تقترب منها!) ===
${recentPosts.map(p => `[${p.contentType}] ${p.title || p.content.substring(0, 100)}... → ${p.status}`).join('\n')}

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
8. أنشئ وصفًا بالإنجليزية لصورة مناسبة لكل منشور
9. المحتوى باللغة العربية دائمًا
10. إذا مرت أكثر من 24 ساعة بدون نشر، يجب إنشاء ونشر محتوى جديد
11. إذا كانت هناك مسودات متاحة، انشرها قبل إنشاء محتوى جديد
12. تحقق من المهام المعلقة (صور قيد المعالجة) قبل إنشاء صور جديدة

أجب بصيغة JSON فقط:
{
  "decisions": [
    {
      "action": "generate_content|generate_image|publish_post|analyze_performance|reply_comments|schedule_post|check_pending_tasks|idle",
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

قواعد صارمة:
1. لا تكرر نفس الفكرة أو الأسلوب بشكل قريب من المنشورات السابقة
2. نوّع بين أنواع المحتوى: تعليمي، تسويقي، قصصي، تفاعلي، ترويجي
3. التزم بأسلوب العلامة التجارية المحدد
4. أضف هاشتاجات مناسبة وفعالة
5. أضف Call To Action مناسب لكل منشور
6. المحتوى يجب أن يكون احترافيًا وجذابًا للجمهور المستهدف
7. أجب دائمًا باللغة العربية
8. كل منشور يجب أن يكون له هدف واضح وزاوية تسويقية مختلفة`;

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
      "imagePrompt": "وصف بالإنجليزية لصورة مناسبة للمنشور - كن محددًا وواقعيًا",
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
        imagePrompt: 'Professional social media post design',
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
        imagePrompt: post.imagePrompt || null,
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
  const model = (parameters.imageModel as 'gpt-image-2' | 'grok-imagine') || 'gpt-image-2';
  const aspectRatio = (parameters.aspectRatio as string) || (model === 'gpt-image-2' ? 'auto' : '1:1');

  if (!postId || !imagePrompt) {
    return { success: false, details: 'Post ID and image prompt are required' };
  }

  try {
    const taskResult = await createImageTask(model, {
      prompt: imagePrompt,
      aspectRatio,
      resolution: model === 'gpt-image-2' ? '1K' : undefined,
    });

    const taskId = taskResult.data?.taskId || taskResult.data?.task_id;

    if (!taskId) {
      return { success: false, details: 'Failed to create image task - no task ID returned' };
    }

    await db.contentPost.update({
      where: { id: postId },
      data: {
        videoTaskId: taskId,
        aiModel: model === 'gpt-image-2' ? 'gpt-image-2' : 'grok-imagine',
        imagePrompt,
      },
    });

    return { success: true, details: `Image generation task created (${model}), task ID: ${taskId}`, postId };
  } catch (error) {
    return { success: false, details: `Image generation failed: ${error instanceof Error ? error.message : String(error)}` };
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

    if (post.imageData) {
      const imageRes = await fetch(
        `${fbBaseUrl}/photos?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, url: post.imageUrl || '', published: true }),
        }
      );
      fbResponse = await imageRes.json();
    } else {
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

    return { success: true, details: 'Post published to Facebook successfully', postId };
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

  return { success: true, details: `Analytics snapshot created. Best type: ${bestContentType}, Best hour: ${bestHour}:00` };
}

async function executeCheckPendingTasks(businessId: string): Promise<{ success: boolean; details: string }> {
  const pendingPosts = await db.contentPost.findMany({
    where: { businessId, videoTaskId: { not: null } },
    take: 5,
  });

  if (pendingPosts.length === 0) {
    return { success: true, details: 'No pending image tasks' };
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
        const imageUrl = output?.image_url || output?.imageUrl ||
          (Array.isArray(output?.images) ? output.images[0]?.url : null) ||
          (Array.isArray(output?.image_urls) ? output.image_urls[0] : null) ||
          output?.url || output?.result;

        if (imageUrl) {
          await db.contentPost.update({
            where: { id: post.id },
            data: { imageUrl: typeof imageUrl === 'string' ? imageUrl : '', videoTaskId: null },
          });

          // Try to download base64
          try {
            const imageResponse = await fetch(imageUrl);
            if (imageResponse.ok) {
              const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
              const base64 = imageBuffer.toString('base64');
              await db.contentPost.update({
                where: { id: post.id },
                data: { imageData: base64 },
              });
            }
          } catch {
            // URL stored, base64 failed - that's OK
          }

          completed++;
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
    // Step 1: Check for pending image tasks first
    const pendingCheck = await executeCheckPendingTasks(businessId);

    // Step 2: Build context for Claude
    const context = await buildAgentContext(businessId);

    // Step 3: Ask Claude what to do
    const agentPrompt = `بناءً على كل المعلومات أعلاه، ما الذي يجب أن تفعله الآن كوكيل تسويق مستقل؟

تحليل سريع:
- هل حان وقت نشر محتوى جديد؟
- هل هناك مسودات يجب نشرها؟
- هل هناك صور معلقة يجب فحصها؟
- هل يجب تحليل الأداء؟
- ما نوع المحتوى الأنسب للوقت الحالي؟
- ما الزاوية التسويقية الأفضل؟

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
            // After generating content, also generate image for the first post
            if (result.success && result.postId) {
              const post = await db.contentPost.findUnique({ where: { id: result.postId } });
              if (post?.imagePrompt) {
                const business = await db.businessProfile.findUnique({ where: { id: businessId } });
                const imageModel = (business?.imageModel as 'gpt-image-2' | 'grok-imagine') || 'gpt-image-2';
                const imgResult = await executeGenerateImage(businessId, {
                  postId: result.postId,
                  imagePrompt: post.imagePrompt,
                  imageModel,
                  aspectRatio: imageModel === 'gpt-image-2' ? 'auto' : '1:1',
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
            break;
          case 'generate_image':
            result = await executeGenerateImage(businessId, decision.parameters);
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
    nextRunAt: null, // Calculated by frontend based on schedule
    mode: (business.agentMode as AgentStatus['mode']) || 'manual',
    totalDecisions,
    recentActions,
    pendingTasks,
  };
}

// ============================================================
// Utility
// ============================================================

function safeParse(str: string): unknown {
  try { return JSON.parse(str); } catch { return str; }
}
