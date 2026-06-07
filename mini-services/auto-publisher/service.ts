/**
 * Auto-Publisher Background Service
 *
 * This service runs independently of the Next.js frontend and
 * automatically publishes scheduled posts when their time arrives.
 *
 * It checks every 60 seconds for posts with:
 * - status = "scheduled"
 * - scheduledAt <= now
 * - Media is ready (image/video data available)
 *
 * This ensures posts are published even when no browser is open.
 *
 * Port: 3010 (for health checks)
 *
 * IMPORTANT: This file is loaded via dynamic import from index.ts
 * after .env variables are set. Do not import directly.
 */

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

// ============================================================
// Configuration
// ============================================================

const CHECK_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
const PORT = 3010;

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN || '';
const FB_PAGE_ID = process.env.FB_PAGE_ID || '';
const FB_API_VERSION = 'v21.0';

// ============================================================
// Facebook Publishing (standalone - no dependency on Next.js)
// ============================================================

function buildFacebookMessage(post: {
  content: string;
  hashtags?: string | null;
  cta?: string | null;
}): string {
  const hashtagStr = post.hashtags
    ? post.hashtags
        .split(',')
        .map((h: string) => (h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`))
        .join(' ')
    : '';
  const ctaStr = post.cta ? `\n\n${post.cta}` : '';
  return `${post.content}\n\n${hashtagStr}${ctaStr}`;
}

async function publishToFacebook(post: {
  content: string;
  hashtags?: string | null;
  cta?: string | null;
  imageUrl?: string | null;
  imageData?: string | null;
  videoUrl?: string | null;
  mediaType?: string;
}): Promise<{ success: boolean; fbResponse?: any; error?: any; method?: string }> {
  const fbBaseUrl = `https://graph.facebook.com/${FB_API_VERSION}/${FB_PAGE_ID}`;
  const message = buildFacebookMessage(post);

  try {
    // 1. Video post
    if (post.mediaType === 'video' && post.videoUrl) {
      const res = await fetch(`${fbBaseUrl}/videos?access_token=${FB_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: post.videoUrl,
          description: message,
        }),
      });
      const fbResponse = await res.json();
      if (fbResponse.error) {
        return { success: false, fbResponse, error: fbResponse.error, method: 'video' };
      }
      return { success: true, fbResponse, method: 'video' };
    }

    // 2. Image with public URL (no base64 data)
    if (post.imageUrl && !post.imageData) {
      const res = await fetch(`${fbBaseUrl}/photos?access_token=${FB_ACCESS_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          url: post.imageUrl,
          published: true,
        }),
      });

      if (res.ok) {
        const fbResponse = await res.json();
        if (!fbResponse.error) {
          return { success: true, fbResponse, method: 'image_url' };
        }
      }
      console.warn('[AutoPublisher] Image URL publish failed, trying other methods');
    }

    // 3. Image with base64 data (multipart upload)
    if (post.imageData) {
      try {
        const imageBuffer = Buffer.from(post.imageData, 'base64');
        const formData = new FormData();
        formData.append('message', message);
        formData.append('published', 'true');

        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        formData.append('source', blob, 'image.jpg');

        const res = await fetch(`${fbBaseUrl}/photos?access_token=${FB_ACCESS_TOKEN}`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const fbResponse = await res.json();
          if (!fbResponse.error) {
            return { success: true, fbResponse, method: 'image_base64' };
          }
        }

        // If base64 upload fails, try URL if available
        if (post.imageUrl) {
          console.warn('[AutoPublisher] Base64 upload failed, trying URL fallback');
          const urlRes = await fetch(`${fbBaseUrl}/photos?access_token=${FB_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message,
              url: post.imageUrl,
              published: true,
            }),
          });
          if (urlRes.ok) {
            const fbResponse = await urlRes.json();
            if (!fbResponse.error) {
              return { success: true, fbResponse, method: 'image_url_fallback' };
            }
          }
        }

        console.warn('[AutoPublisher] All image upload methods failed, falling back to text-only');
      } catch (base64Error) {
        console.error('[AutoPublisher] Base64 upload error:', base64Error);
        if (post.imageUrl) {
          const urlRes = await fetch(`${fbBaseUrl}/photos?access_token=${FB_ACCESS_TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message,
              url: post.imageUrl,
              published: true,
            }),
          });
          if (urlRes.ok) {
            const fbResponse = await urlRes.json();
            if (!fbResponse.error) {
              return { success: true, fbResponse, method: 'image_url_fallback' };
            }
          }
        }
      }
    }

    // 4. Text-only fallback
    const res = await fetch(`${fbBaseUrl}/feed?access_token=${FB_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const fbResponse = await res.json();
    if (fbResponse.error) {
      return { success: false, fbResponse, error: fbResponse.error, method: 'text_only' };
    }
    return { success: true, fbResponse, method: 'text_only' };
  } catch (error) {
    console.error('[AutoPublisher] Publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ============================================================
// Auto-Publish Check
// ============================================================

function isMediaReady(post: {
  mediaType?: string;
  videoUrl?: string | null;
  imageData?: string | null;
  imageUrl?: string | null;
}): boolean {
  if (post.mediaType === 'video') {
    return !!post.videoUrl;
  }
  return !!post.imageData || !!post.imageUrl;
}

async function checkAndPublishScheduledPosts(): Promise<void> {
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
      console.log(`[${timestamp}] ✓ لا توجد منشورات مستحقة للنشر`);
      return;
    }

    console.log(`[${timestamp}] 📋 تم العثور على ${duePosts.length} منشور مستحق للنشر`);

    // Separate ready vs waiting for media
    const readyPosts = duePosts.filter((p) => isMediaReady(p));
    const waitingPosts = duePosts.filter((p) => !isMediaReady(p));

    if (waitingPosts.length > 0) {
      console.log(`[${timestamp}] ⏳ ${waitingPosts.length} منشور ينتظر اكتمال الوسائط`);
    }

    if (readyPosts.length === 0) {
      console.log(`[${timestamp}] ⏳ لا توجد منشورات جاهزة الوسائط للنشر`);
      return;
    }

    console.log(`[${timestamp}] 🚀 جاري نشر ${readyPosts.length} منشور...`);

    for (const post of readyPosts) {
      try {
        const postTitle = post.title || post.content.substring(0, 50);
        console.log(`[${timestamp}] 📤 نشر المنشور "${postTitle}..." لـ ${post.business?.companyName || 'غير معروف'}`);

        // Check if Facebook credentials are available
        if (!FB_ACCESS_TOKEN || !FB_PAGE_ID) {
          console.log(`[${timestamp}] ⚠️ لا توجد بيانات Facebook — يتم التعليم كمنشور محلياً`);
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
        const result = await publishToFacebook({
          content: post.content,
          hashtags: post.hashtags,
          cta: post.cta,
          imageUrl: post.imageUrl,
          imageData: post.imageData,
          videoUrl: post.videoUrl,
          mediaType: post.mediaType || 'image',
        });

        if (!result.success) {
          console.error(`[${timestamp}] ❌ فشل نشر المنشور ${post.id}:`, JSON.stringify(result.error).substring(0, 200));
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
              decision: `فشل النشر التلقائي: ${(typeof result.error === 'object' ? result.error.message : JSON.stringify(result.error)).substring(0, 200)}`,
              isAutonomous: true,
              status: 'failed',
            },
          }).catch(() => {});
        } else {
          console.log(`[${timestamp}] ✅ تم نشر المنشور ${post.id} عبر ${result.method}`);
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
        console.error(`[${timestamp}] ❌ خطأ في نشر المنشور ${post.id}:`, postError);
      }
    }
  } catch (error) {
    console.error(`[${timestamp}] ❌ خطأ في فحص النشر التلقائي:`, error);
  }
}

// ============================================================
// Health Check HTTP Server
// ============================================================

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return Response.json({
        status: 'running',
        service: 'auto-publisher',
        interval: CHECK_INTERVAL_MS,
        facebook: {
          configured: !!(FB_ACCESS_TOKEN && FB_PAGE_ID),
          pageId: FB_PAGE_ID || 'not configured',
        },
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname === '/check') {
      // Manual trigger for testing
      checkAndPublishScheduledPosts();
      return Response.json({ triggered: true, message: 'Auto-publish check triggered manually' });
    }

    return Response.json({ error: 'Not found' }, { status: 404 });
  },
});

console.log(`🤖 Auto-Publisher Service running on port ${PORT}`);
console.log(`📅 Checking for due scheduled posts every ${CHECK_INTERVAL_MS / 1000} seconds`);
console.log(`📘 Facebook: ${FB_ACCESS_TOKEN && FB_PAGE_ID ? 'Configured ✅' : 'Not configured ❌'}`);

// ============================================================
// Main Loop
// ============================================================

// Initial check on startup
console.log('🔄 Running initial auto-publish check...');
checkAndPublishScheduledPosts();

// Periodic check every CHECK_INTERVAL_MS
setInterval(() => {
  checkAndPublishScheduledPosts();
}, CHECK_INTERVAL_MS);

console.log(`✅ Auto-Publisher Service started successfully`);
