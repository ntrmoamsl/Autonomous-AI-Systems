import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callKieAI, getKieTaskDetail } from '@/lib/ai';

// POST - Generate video using Kie.ai API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, prompt, imageUrl, model = 'kling-video' } = body;

    if (!prompt && !imageUrl) {
      return NextResponse.json({ error: 'Video prompt or image URL is required' }, { status: 400 });
    }

    // Create video generation task via Kie.ai
    const taskInput: Record<string, unknown> = {
      prompt: prompt || '',
    };

    if (imageUrl) {
      taskInput.image_url = imageUrl;
    }

    const taskResult = await callKieAI('/api/v1/jobs/createTask', {
      model: model,
      input: taskInput,
    });

    const taskId = taskResult.data?.taskId || taskResult.data?.task_id;

    if (!taskId) {
      return NextResponse.json(
        { error: 'No task ID returned from Kie.ai', details: taskResult },
        { status: 500 }
      );
    }

    // Save the task ID to the post
    if (postId) {
      await db.contentPost.update({
        where: { id: postId },
        data: { videoTaskId: taskId },
      });
    }

    return NextResponse.json({
      taskId,
      status: 'processing',
      postId,
      message: 'Video generation task created. Use GET /api/media/video?taskId=xxx to check status.',
    });
  } catch (error) {
    console.error('Error creating video task:', error);
    return NextResponse.json(
      { error: 'Failed to create video task', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET - Check video generation task status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const postId = searchParams.get('postId');

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    // Query task status from Kie.ai
    const result = await getKieTaskDetail(taskId);

    const taskStatus = result.data?.taskStatus || result.data?.task_status || result.data?.status || 'unknown';

    if (taskStatus === 'SUCCESS' || taskStatus === 'completed' || taskStatus === 'succeeded') {
      const output = result.data?.output || result.data;
      const videoUrl = output?.video_url || output?.videoUrl || 
                       (Array.isArray(output?.videos) ? output.videos[0]?.url : null) ||
                       output?.url || output?.result;

      if (postId && videoUrl) {
        await db.contentPost.update({
          where: { id: postId },
          data: { 
            videoUrl: typeof videoUrl === 'string' ? videoUrl : '',
            videoTaskId: null,
          },
        });
      }

      return NextResponse.json({
        status: 'SUCCESS',
        videoUrl,
        postId,
      });
    }

    if (taskStatus === 'FAILED' || taskStatus === 'failed' || taskStatus === 'error') {
      if (postId) {
        await db.contentPost.update({
          where: { id: postId },
          data: { videoTaskId: null },
        });
      }

      return NextResponse.json({
        status: 'FAILED',
        error: result.data?.error || 'Video generation failed',
        postId,
      });
    }

    // Still processing
    return NextResponse.json({
      status: 'PROCESSING',
      taskStatus,
      postId,
    });
  } catch (error) {
    console.error('Error checking video task status:', error);
    return NextResponse.json(
      { error: 'Failed to check video task status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
