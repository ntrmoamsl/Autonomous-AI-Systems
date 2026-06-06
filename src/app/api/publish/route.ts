import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFacebookConfig } from '@/lib/config';
import { addTextOverlayToBase64, addTextOverlayFromUrl } from '@/lib/text-overlay';

// POST - Publish a post to Facebook (with text overlay on images)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId } = body;

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    const post = await db.contentPost.findUnique({ where: { id: postId } });
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const { accessToken, pageId, apiVersion } = getFacebookConfig();

    // Apply text overlay on image if not already done and text overlay exists
    if (post.mediaType === 'image' && post.textOverlay && post.imageData) {
      try {
        const overlayBase64 = await addTextOverlayToBase64(post.imageData, {
          text: post.textOverlay,
          fontSize: 42,
          position: 'bottom',
          backgroundColor: 'rgba(0,0,0,0.65)',
        });
        await db.contentPost.update({
          where: { id: postId },
          data: { imageData: overlayBase64 },
        });
        // Update the post reference
        post.imageData = overlayBase64;
      } catch (overlayError) {
        console.error('Error applying text overlay:', overlayError);
        // Continue publishing without overlay
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
          where: { id: postId },
          data: { imageData: overlayBase64 },
        });
        post.imageData = overlayBase64;
      } catch (overlayError) {
        console.error('Error applying text overlay from URL:', overlayError);
      }
    }

    if (!accessToken || !pageId) {
      return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 500 });
    }

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
        // Try alternative method - publish text only
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
      // Publish text only
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
      // Update post as failed
      await db.contentPost.update({
        where: { id: postId },
        data: {
          status: 'failed',
          publishResult: JSON.stringify(fbResponse.error),
          retryCount: post.retryCount + 1,
        },
      });

      return NextResponse.json({ error: fbResponse.error }, { status: 400 });
    }

    // Update post as published
    await db.contentPost.update({
      where: { id: postId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishResult: JSON.stringify(fbResponse),
      },
    });

    return NextResponse.json({
      success: true,
      fbResponse,
      mediaType: post.mediaType || 'image',
    });
  } catch (error) {
    console.error('Error publishing post:', error);
    return NextResponse.json(
      { error: 'Failed to publish post', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
