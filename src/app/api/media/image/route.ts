import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAI } from '@/lib/ai';

// POST - Generate image for a post
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Image prompt is required' }, { status: 400 });
    }

    const zai = await getAI();
    const response = await zai.images.generations.create({
      prompt: prompt,
      size: '1344x768', // Good for social media
    });

    const imageBase64 = response.data[0]?.base64;

    if (!imageBase64) {
      return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
    }

    // Update the post with image data
    if (postId) {
      await db.contentPost.update({
        where: { id: postId },
        data: { imageData: imageBase64 },
      });
    }

    return NextResponse.json({
      imageBase64,
      postId,
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: 'Failed to generate image', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
