/**
 * Shared Facebook Publishing Utility
 *
 * Handles publishing to Facebook Page with proper support for:
 * - Video posts (via file_url)
 * - Image posts from URL (via url parameter)
 * - Image posts from base64 data (via multipart/form-data upload)
 * - Text-only fallback
 *
 * Used by:
 * - /api/publish/route.ts (manual publish)
 * - /api/publish/auto/route.ts (auto-publish checker)
 * - agent.ts (autonomous agent publish)
 * - mini-services/auto-publisher/ (background auto-publisher)
 */

export interface FacebookConfig {
  accessToken: string;
  pageId: string;
  apiVersion: string;
}

export interface PublishPost {
  id: string;
  content: string;
  hashtags?: string | null;
  cta?: string | null;
  imageUrl?: string | null;
  imageData?: string | null;
  videoUrl?: string | null;
  mediaType?: string;
  textOverlay?: string | null;
}

export interface PublishResult {
  success: boolean;
  fbResponse?: any;
  error?: any;
  method?: string;
}

/**
 * Build the message string for a Facebook post
 */
export function buildFacebookMessage(post: PublishPost): string {
  const hashtagStr = post.hashtags
    ? post.hashtags
        .split(',')
        .map((h: string) => (h.trim().startsWith('#') ? h.trim() : `#${h.trim()}`))
        .join(' ')
    : '';
  const ctaStr = post.cta ? `\n\n${post.cta}` : '';
  return `${post.content}\n\n${hashtagStr}${ctaStr}`;
}

/**
 * Publish a post to Facebook.
 *
 * Priority:
 * 1. Video → /videos endpoint with file_url
 * 2. Image with URL → /photos endpoint with url parameter
 * 3. Image with base64 data → /photos endpoint with source (multipart upload)
 * 4. Text-only → /feed endpoint
 */
export async function publishToFacebook(
  post: PublishPost,
  config: FacebookConfig
): Promise<PublishResult> {
  const { accessToken, pageId, apiVersion } = config;
  const fbBaseUrl = `https://graph.facebook.com/${apiVersion}/${pageId}`;
  const message = buildFacebookMessage(post);

  try {
    // 1. Video post
    if (post.mediaType === 'video' && post.videoUrl) {
      const res = await fetch(`${fbBaseUrl}/videos?access_token=${accessToken}`, {
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

    // 2. Image post with public URL
    if (post.imageUrl && !post.imageData) {
      const res = await fetch(`${fbBaseUrl}/photos?access_token=${accessToken}`, {
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
      // Fallback to text-only if image URL fails
      console.warn('[FB] Image URL publish failed, falling back to text-only');
    }

    // 3. Image post with base64 data (multipart upload)
    if (post.imageData) {
      try {
        const imageBuffer = Buffer.from(post.imageData, 'base64');

        // Use Facebook's multipart upload via FormData
        const formData = new FormData();
        formData.append('message', message);
        formData.append('published', 'true');

        // Create a Blob from the buffer for the image file
        const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
        formData.append('source', blob, 'image.jpg');

        const res = await fetch(`${fbBaseUrl}/photos?access_token=${accessToken}`, {
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
          console.warn('[FB] Base64 upload failed, trying URL fallback');
          const urlRes = await fetch(`${fbBaseUrl}/photos?access_token=${accessToken}`, {
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

        console.warn('[FB] All image upload methods failed, falling back to text-only');
      } catch (base64Error) {
        console.error('[FB] Base64 upload error:', base64Error);
        // Try URL fallback
        if (post.imageUrl) {
          const urlRes = await fetch(`${fbBaseUrl}/photos?access_token=${accessToken}`, {
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
    const res = await fetch(`${fbBaseUrl}/feed?access_token=${accessToken}`, {
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
    console.error('[FB] Publish error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Check if a post's media is ready for publishing
 */
export function isMediaReady(post: PublishPost): boolean {
  if (post.mediaType === 'video') {
    return !!post.videoUrl;
  }
  // Image or default
  return !!post.imageData || !!post.imageUrl;
}
