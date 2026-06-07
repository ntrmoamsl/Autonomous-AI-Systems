import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFacebookConfig } from '@/lib/config';
import { addTextOverlayToBase64, addTextOverlayFromUrl } from '@/lib/text-overlay';

/**
 * GET /api/publish/auto
 * 
 * Auto-publish scheduled posts whose time has arrived.
 * Called periodically by the frontend (every 30 seconds).
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

    if (!businessId) {
      return NextResponse.json({ error: 'businessId required' }, { status: 400 });
    }

    const now = new Date();

    // Find all scheduled posts that are due for publishing
    // scheduledAt <= now means the publish time has arrived or passed
    const duePosts = await db.contentPost.findMany({
      where: {
        businessId,
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (duePosts.length === 0) {
      return NextResponse.json({
        checked: true,
        publishedCount: 0,
        message: 'لا توجد منشورات مستحقة للنشر',
      });
    }

    // Filter posts that have media ready
    const readyPosts = duePosts.filter(post => {
      if (post.mediaType === 'video') {
        return !!post.videoUrl;
      }
      // Image or default
      return !!post.imageData || !!post.imageUrl;
    });

    // Also include posts still waiting for media (skip them but report)
    const waitingForMedia = duePosts.filter(post => {
      if (post.mediaType === 'video') {
        return !post.videoUrl;
      }
      return !post.imageData && !post.imageUrl;
    });

    if (readyPosts.length === 0) {
      return NextResponse.json({
        checked: true,
        publishedCount: 0,
        waitingForMedia: waitingForMedia.length,
        message: `${duePosts.length} منشور مستحق لكن الوسائط لم تكتمل بعد`,
      });
    }

    const { accessToken, pageId, apiVersion } = getFacebookConfig();
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
        if (!accessToken || !pageId) {
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

        const fbBaseUrl = `https://graph.facebook.com/${apiVersion}/${pageId}`;
        const message = `${post.content}\n\n${post.hashtags ? post.hashtags.split(',').map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ') : ''}${post.cta ? '\n\n' + post.cta : ''}`;

        let fbResponse;

        if (post.mediaType === 'video' && post.videoUrl) {
          // Publish video
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
        } else if (post.imageUrl || post.imageData) {
          // Publish image
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
            // Fallback to text-only post
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
          // Text only
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
            where: { id: post.id },
            data: {
              status: 'failed',
              publishResult: JSON.stringify(fbResponse.error),
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
              publishResult: JSON.stringify(fbResponse),
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

    // Log to agent log
    if (publishedCount > 0 || failedCount > 0) {
      try {
        await db.agentLog.create({
          data: {
            businessId,
            action: 'auto_publish',
            decision: `نشر تلقائي: ${publishedCount} نجح، ${failedCount} فشل، ${waitingForMedia.length} ينتظر وسائط`,
            isAutonomous: true,
          },
        });
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
