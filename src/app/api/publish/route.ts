import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFacebookConfig } from '@/lib/config';
import { addTextOverlayToBase64, addTextOverlayFromUrl } from '@/lib/text-overlay';
import { publishToFacebook, type PublishPost } from '@/lib/facebook-publish';

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

    const { accessToken, pageId } = getFacebookConfig();

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

    // Use the shared publishing utility
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
      getFacebookConfig()
    );

    if (!result.success) {
      // Update post as failed
      await db.contentPost.update({
        where: { id: postId },
        data: {
          status: 'failed',
          publishResult: JSON.stringify(result.error || result.fbResponse?.error),
          retryCount: post.retryCount + 1,
        },
      });

      return NextResponse.json(
        { error: result.error || result.fbResponse?.error || 'Facebook publish failed' },
        { status: 400 }
      );
    }

    // Update post as published
    await db.contentPost.update({
      where: { id: postId },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishResult: JSON.stringify(result.fbResponse),
      },
    });

    return NextResponse.json({
      success: true,
      fbResponse: result.fbResponse,
      method: result.method,
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
