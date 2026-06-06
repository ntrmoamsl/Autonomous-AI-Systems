import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAI } from '@/lib/ai';

// POST - Generate video for a post
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, prompt, imageUrl } = body;

    if (!prompt && !imageUrl) {
      return NextResponse.json({ error: 'Video prompt or image URL is required' }, { status: 400 });
    }

    const zai = await getAI();

    const videoParams: Record<string, unknown> = {
      quality: 'speed',
      size: '1920x1080',
      fps: 30,
      duration: 5,
    };

    if (prompt) videoParams.prompt = prompt;
    if (imageUrl) videoParams.image_url = imageUrl;

    const task = await zai.video.generations.create(videoParams as Parameters<typeof zai.video.generations.create>[0]);

    // Save the task ID to the post
    if (postId) {
      await db.contentPost.update({
        where: { id: postId },
        data: { videoTaskId: task.id },
      });
    }

    return NextResponse.json({
      taskId: task.id,
      status: task.task_status,
      postId,
    });
  } catch (error) {
    console.error('Error generating video:', error);
    return NextResponse.json(
      { error: 'Failed to generate video', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET - Check video generation status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const postId = searchParams.get('postId');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    const zai = await getAI();
    const result = await zai.async.result.query(taskId);

    if (result.task_status === 'SUCCESS') {
      const videoUrl = result.video_result?.[0]?.url || result.video_url || result.url || result.video;

      if (postId && videoUrl) {
        await db.contentPost.update({
          where: { id: postId },
          data: { videoUrl: typeof videoUrl === 'string' ? videoUrl : '', videoTaskId: null },
        });
      }

      return NextResponse.json({
        status: 'SUCCESS',
        videoUrl,
      });
    }

    return NextResponse.json({
      status: result.task_status,
    });
  } catch (error) {
    console.error('Error checking video status:', error);
    return NextResponse.json(
      { error: 'Failed to check video status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
