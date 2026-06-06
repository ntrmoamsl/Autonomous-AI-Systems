import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all content posts
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: Record<string, unknown> = {};
    if (businessId) where.businessId = businessId;
    if (status) where.status = status;

    const posts = await db.contentPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        businessId: true,
        title: true,
        content: true,
        contentType: true,
        hashtags: true,
        cta: true,
        imageUrl: true,
        imageData: true,
        videoUrl: true,
        videoTaskId: true,
        platform: true,
        status: true,
        scheduledAt: true,
        publishedAt: true,
        retryCount: true,
        aiModel: true,
        generationPrompt: true,
        engagementScore: true,
        reachCount: true,
        likeCount: true,
        commentCount: true,
        shareCount: true,
        imagePrompt: true,
        mediaType: true,
        textOverlay: true,
        videoPrompt: true,
        decisionReason: true,
        isAutonomous: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Truncate large imageData to prevent memory issues in list view
    const safePosts = posts.map(p => ({
      ...p,
      imageData: p.imageData ? '(stored)' : null,
    }));

    return NextResponse.json({ posts: safePosts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// PUT - Update a post
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    const post = await db.contentPost.update({
      where: { id },
      data,
    });

    return NextResponse.json({ post });
  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}

// DELETE - Delete a post
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    await db.contentPost.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }
}
