import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - Get imageData for a single post (separate to avoid memory issues in list)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 });
    }

    const post = await db.contentPost.findUnique({
      where: { id: postId },
      select: { imageData: true, imageUrl: true },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      imageData: post.imageData,
      imageUrl: post.imageUrl,
    });
  } catch (error) {
    console.error('Error fetching post image:', error);
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
