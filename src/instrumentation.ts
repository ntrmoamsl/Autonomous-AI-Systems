/**
 * Next.js Instrumentation - Auto-Publish Background Scheduler
 *
 * This file runs when the Next.js server starts and sets up a
 * background interval that checks for scheduled posts due for
 * publishing every 60 seconds.
 *
 * This ensures that scheduled posts are automatically published
 * to Facebook when their time arrives, even when no browser is open.
 *
 * The auto-publish scheduler:
 * 1. Finds all posts with status="scheduled" and scheduledAt <= now
 * 2. Checks that media is ready (image/video data available)
 * 3. Publishes each to Facebook using the Graph API
 * 4. Updates the post status to "published" or "failed"
 */

export async function register() {
  // Only run on the server (not on edge/client)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[AutoPublish] 🤖 Initializing auto-publish scheduler...');

    // Import the database and publishing utilities
    const { db } = await import('@/lib/db');
    const { getFacebookConfig } = await import('@/lib/config');
    const { publishToFacebook, isMediaReady } = await import('@/lib/facebook-publish');
    const { addTextOverlayToBase64, addTextOverlayFromUrl } = await import('@/lib/text-overlay');

    const CHECK_INTERVAL = 60 * 1000; // 60 seconds

    let isChecking = false;

    async function checkAndPublishScheduledPosts() {
      if (isChecking) {
        console.log('[AutoPublish] ⏳ Check already in progress, skipping...');
        return;
      }
      isChecking = true;

      const now = new Date();
      const timestamp = now.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' });

      try {
        // Find ALL scheduled posts across ALL businesses that are due
        const duePosts = await db.contentPost.findMany({
          where: {
            status: 'scheduled',
            scheduledAt: { lte: now },
          },
          orderBy: { scheduledAt: 'asc' },
          include: {
            business: {
              select: { companyName: true },
            },
          },
        });

        if (duePosts.length === 0) {
          // Only log every few checks to avoid spam
          return;
        }

        console.log(`[AutoPublish] 📋 [${timestamp}] Found ${duePosts.length} due scheduled post(s)`);

        // Separate ready vs waiting for media
        const readyPosts = duePosts.filter(p =>
          isMediaReady({
            mediaType: p.mediaType || 'image',
            videoUrl: p.videoUrl,
            imageData: p.imageData,
            imageUrl: p.imageUrl,
          } as any)
        );

        const waitingPosts = duePosts.filter(p =>
          !isMediaReady({
            mediaType: p.mediaType || 'image',
            videoUrl: p.videoUrl,
            imageData: p.imageData,
            imageUrl: p.imageUrl,
          } as any)
        );

        if (waitingPosts.length > 0) {
          console.log(`[AutoPublish] ⏳ [${timestamp}] ${waitingPosts.length} post(s) waiting for media`);
        }

        if (readyPosts.length === 0) {
          console.log(`[AutoPublish] ⏳ [${timestamp}] No posts with ready media to publish`);
          return;
        }

        console.log(`[AutoPublish] 🚀 [${timestamp}] Publishing ${readyPosts.length} post(s)...`);

        const config = getFacebookConfig();

        for (const post of readyPosts) {
          try {
            const postTitle = post.title || post.content.substring(0, 50);
            console.log(`[AutoPublish] 📤 [${timestamp}] Publishing "${postTitle}..." for ${post.business?.companyName || 'Unknown'}`);

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

            // Check if Facebook credentials are available
            if (!config.accessToken || !config.pageId) {
              console.log(`[AutoPublish] ⚠️ No Facebook credentials — marking as published locally`);
              await db.contentPost.update({
                where: { id: post.id },
                data: {
                  status: 'published',
                  publishedAt: new Date(),
                  publishResult: JSON.stringify({ local: true, reason: 'No Facebook credentials (auto-publisher)' }),
                },
              });
              continue;
            }

            // Publish to Facebook
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
              console.error(`[AutoPublish] ❌ [${timestamp}] Failed to publish post ${post.id}:`, JSON.stringify(result.error).substring(0, 200));
              await db.contentPost.update({
                where: { id: post.id },
                data: {
                  status: 'failed',
                  publishResult: JSON.stringify(result.error || result.fbResponse?.error),
                  retryCount: post.retryCount + 1,
                },
              });

              // Log failure
              await db.agentLog.create({
                data: {
                  businessId: post.businessId,
                  action: 'auto_publish',
                  decision: `فشل النشر التلقائي: ${JSON.stringify(result.error).substring(0, 200)}`,
                  isAutonomous: true,
                  status: 'failed',
                },
              }).catch(() => {});
            } else {
              console.log(`[AutoPublish] ✅ [${timestamp}] Published post ${post.id} via ${result.method}`);
              await db.contentPost.update({
                where: { id: post.id },
                data: {
                  status: 'published',
                  publishedAt: new Date(),
                  publishResult: JSON.stringify(result.fbResponse),
                },
              });

              // Log success
              await db.agentLog.create({
                data: {
                  businessId: post.businessId,
                  action: 'auto_publish',
                  decision: `نشر تلقائي ناجح (${result.method}): ${post.title || post.content.substring(0, 80)}`,
                  isAutonomous: true,
                  status: 'completed',
                },
              }).catch(() => {});
            }
          } catch (postError) {
            console.error(`[AutoPublish] ❌ [${timestamp}] Error publishing post ${post.id}:`, postError);
          }
        }
      } catch (error) {
        console.error(`[AutoPublish] ❌ [${timestamp}] Error in auto-publish check:`, error);
      } finally {
        isChecking = false;
      }
    }

    // Initial check after 10 seconds (give server time to fully start)
    setTimeout(() => {
      console.log('[AutoPublish] 🔄 Running initial auto-publish check...');
      checkAndPublishScheduledPosts();
    }, 10000);

    // Set up periodic check
    setInterval(() => {
      checkAndPublishScheduledPosts();
    }, CHECK_INTERVAL);

    console.log(`[AutoPublish] ✅ Auto-publish scheduler started (every ${CHECK_INTERVAL / 1000}s)`);
    console.log(`[AutoPublish] 📘 Facebook: ${getFacebookConfig().accessToken ? 'Configured ✅' : 'Not configured ❌'}`);
  }
}
