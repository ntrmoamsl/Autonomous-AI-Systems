import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFacebookConfig } from '@/lib/config';
import { addTextOverlayToBase64, addTextOverlayFromUrl } from '@/lib/text-overlay';
import { publishToFacebook, isMediaReady, type PublishPost } from '@/lib/facebook-publish';

/**
 * GET /api/publish/auto
 *
 * Auto-publish scheduled posts whose time has arrived.
 * Called periodically by:
 * - Frontend polling (every 30 seconds) — requires businessId
 * - Background cron job (every 60 seconds) — uses checkAll=true
 *
 * Flow:
 * 1. Find all scheduled posts where scheduledAt <= now
 * 2. Check that media is ready (imageData/imageUrl for images, videoUrl for videos)
 * 3. Publish each to Facebook
 * 4. Return count of published posts
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const checkAll = searchParams.get('checkAll') === 'true';

    // Either businessId or checkAll is required
    if (!businessId && !checkAll) {
      return NextResponse.json({ error: 'businessId or checkAll=true required' }, { status: 400 });
    }

    const now = new Date();

    // Build the where clause
    const whereClause: any = {
      status: 'scheduled',
      scheduledAt: { lte: now },
    };

    if (businessId) {
      whereClause.businessId = businessId;
    }

    // Find all scheduled posts that are due for publishing
    const duePosts = await db.contentPost.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'asc' },
      include: checkAll ? {
        business: {
          select: { companyName: true },
        },
      } : undefined,
    });

    if (duePosts.length === 0) {
      return NextResponse.json({
        checked: true,
        publishedCount: 0,
        message: 'لا توجد منشورات مستحقة للنشر',
      });
    }

    // Separate ready posts from those waiting for media
    const readyPosts = duePosts.filter(post => isMediaReady({
      mediaType: post.mediaType || 'image',
      videoUrl: post.videoUrl,
      imageData: post.imageData,
      imageUrl: post.imageUrl,
    } as PublishPost));

    const waitingForMedia = duePosts.filter(post => !isMediaReady({
      mediaType: post.mediaType || 'image',
      videoUrl: post.videoUrl,
      imageData: post.imageData,
      imageUrl: post.imageUrl,
    } as PublishPost));

    if (readyPosts.length === 0) {
      return NextResponse.json({
        checked: true,
        publishedCount: 0,
        waitingForMedia: waitingForMedia.length,
        message: `${duePosts.length} منشور مستحق لكن الوسائط لم تكتمل بعد`,
      });
    }

    const config = getFacebookConfig();
    let publishedCount = 0;
    let failedCount = 0;
    const publishedIds: string[] = [];

    for (const post of readyPosts) {
      try {
        // Apply text overlay if needed (image posts)
        if (post.mediaType === 'image' && post.textOverlay && post.imageData) {
          try {
            const overlayBase64 = await addTextOverlayToBase64(post.imageData, {
              text: post.textOverlay,
              fontSize: 42,
              position: 'bottom',
              backgroundColor: 'rgba(0,0,0,0.65)',
            });
            await db.contentPost.update({
              where: { id: post.id },
              data: { imageData: overlayBase64 },
            });
            post.imageData = overlayBase64;
          } catch {
            // Continue without overlay
          }
        } else if (post.mediaType === 'image' && post.textOverlay && post.imageUrl && !post.imageData) {
          try {
            const overlayBase64 = await addTextOverlayFromUrl(post.imageUrl, {
              text: post.textOverlay,
              fontSize: 42,
              position: 'bottom',
              backgroundColor: 'rgba(0,0,0,0.65)',
            });
            await db.contentPost.update({
              where: { id: post.id },
              data: { imageData: overlayBase64 },
            });
            post.imageData = overlayBase64;
          } catch {
            // Continue without overlay
          }
        }

        // Publish to Facebook (or locally if no credentials)
        if (!config.accessToken || !config.pageId) {
          // No Facebook config — mark as published locally
          await db.contentPost.update({
            where: { id: post.id },
            data: {
              status: 'published',
              publishedAt: new Date(),
              publishResult: JSON.stringify({ local: true, reason: 'No Facebook credentials' }),
            },
          });
          publishedIds.push(post.id);
          publishedCount++;
          continue;
        }

        // Use shared publishing utility
        const result = await publishToFacebook(
          {
            id: post.id,
            content: post.content,
            hashtags: post.hashtags,
            cta: post.cta,
            imageUrl: post.imageUrl,
            imageData: post.imageData,
            videoUrl: post.videoUrl,
            mediaType: post.mediaType || 'image',
            textOverlay: post.textOverlay,
          },
          config
        );

        if (!result.success) {
          await db.contentPost.update({
            where: { id: post.id },
            data: {
              status: 'failed',
              publishResult: JSON.stringify(result.error || result.fbResponse?.error),
              retryCount: post.retryCount + 1,
            },
          });
          failedCount++;
        } else {
          await db.contentPost.update({
            where: { id: post.id },
            data: {
              status: 'published',
              publishedAt: new Date(),
              publishResult: JSON.stringify(result.fbResponse),
            },
          });
          publishedIds.push(post.id);
          publishedCount++;
        }
      } catch (postError) {
        console.error(`Error auto-publishing post ${post.id}:`, postError);
        failedCount++;
      }
    }

    // Log to agent log for each business
    if (publishedCount > 0 || failedCount > 0) {
      try {
        // Get unique business IDs from the published posts
        const businessIds = [...new Set(readyPosts.map(p => p.businessId))];
        for (const bizId of businessIds) {
          const bizPosts = readyPosts.filter(p => p.businessId === bizId);
          const bizPublished = bizPosts.filter(p => publishedIds.includes(p.id)).length;
          const bizFailed = bizPosts.filter(p => p.status === 'failed').length;

          await db.agentLog.create({
            data: {
              businessId: bizId,
              action: 'auto_publish',
              decision: `نشر تلقائي: ${bizPublished} نجح، ${bizFailed} فشل`,
              isAutonomous: true,
            },
          });
        }
      } catch {
        // Log failure shouldn't block the flow
      }
    }

    return NextResponse.json({
      checked: true,
      publishedCount,
      failedCount,
      waitingForMedia: waitingForMedia.length,
      publishedIds,
      totalDue: duePosts.length,
      message: publishedCount > 0
        ? `تم النشر التلقائي لـ ${publishedCount} منشور${failedCount > 0 ? `، ${failedCount} فشل` : ''}${waitingForMedia.length > 0 ? `، ${waitingForMedia.length} ينتظر وسائط` : ''}`
        : `لا توجد منشورات جاهزة للنشر (${waitingForMedia.length} ينتظر وسائط)`,
    });
  } catch (error) {
    console.error('Error in auto-publish:', error);
    return NextResponse.json(
      { error: 'Auto-publish check failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
