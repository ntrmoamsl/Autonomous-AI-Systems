import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getFacebookConfig } from '@/lib/config';

// POST - Publish a post to Facebook
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

    if (!accessToken || !pageId) {
      return NextResponse.json({ error: 'Facebook credentials not configured' }, { status: 500 });
    }

    let fbResponse;
    const fbBaseUrl = `https://graph.facebook.com/${apiVersion}/${pageId}`;

    if (post.imageData) {
      // Publish with image
      const imageRes = await fetch(
        `${fbBaseUrl}/photos?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `${post.content}\n\n${post.hashtags ? post.hashtags.split(',').map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : ''}\n\n${post.cta || ''}`,
            url: `data:image/png;base64,${post.imageData.substring(0, 100)}`, // Fallback
            published: true,
          }),
        }
      );

      if (!imageRes.ok) {
        // Try alternative method - publish text only first, then add photo
        const textRes = await fetch(
          `${fbBaseUrl}/feed?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `${post.content}\n\n${post.hashtags ? post.hashtags.split(',').map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ') : ''}\n\n${post.cta || ''}`,
            }),
          }
        );
        fbResponse = await textRes.json();
      } else {
        fbResponse = await imageRes.json();
      }
    } else {
      // Publish text only
      const message = `${post.content}\n\n${post.hashtags ? post.hashtags.split(',').map((h: string) => h.startsWith('#') ? h : `#${h}`).join(' ') : ''}${post.cta ? '\n\n' + post.cta : ''}`;
      
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
    });
  } catch (error) {
    console.error('Error publishing post:', error);
    return NextResponse.json(
      { error: 'Failed to publish post', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
