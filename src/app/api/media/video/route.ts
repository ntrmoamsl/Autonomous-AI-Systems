import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createVideoTask, getKieTaskDetail } from '@/lib/ai';
import { createVideoPromptWithText } from '@/lib/text-overlay';

// POST - Generate video using Grok Imagine Text-to-Video via Kie.ai API
// Text overlay is embedded in the video generation prompt
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, prompt, textOverlay, aspectRatio, duration, mode, resolution } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Video prompt is required' }, { status: 400 });
    }

    // If there's text overlay, embed it in the video prompt
    const enhancedPrompt = textOverlay 
      ? createVideoPromptWithText(prompt, textOverlay)
      : prompt;

    // Create video generation task via Grok Imagine Text-to-Video
    const taskResult = await createVideoTask({
      prompt: enhancedPrompt,
      aspectRatio: aspectRatio || '16:9',
      mode: mode || 'normal',
      duration: duration || 6,
      resolution: resolution || '480p',
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
        data: { 
          videoTaskId: taskId,
          mediaType: 'video',
          aiModel: 'grok-imagine-text-to-video',
          ...(textOverlay ? { textOverlay } : {}),
        },
      });
    }

    return NextResponse.json({
      taskId,
      status: 'processing',
      postId,
      model: 'grok-imagine/text-to-video',
      message: 'Video generation task created using Grok Imagine. Use GET /api/media/video?taskId=xxx to check status.',
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

    const taskState = result.data?.state || 'unknown';

    if (taskState === 'success') {
      // Extract video URL from resultJson (it's a JSON string)
      let videoUrl: string | null = null;
      const resultJsonStr = result.data?.resultJson;
      if (resultJsonStr && typeof resultJsonStr === 'string') {
        try {
          const resultJson = JSON.parse(resultJsonStr);
          // resultUrls is an array of URLs
          if (Array.isArray(resultJson.resultUrls) && resultJson.resultUrls.length > 0) {
            videoUrl = resultJson.resultUrls[0];
          } else if (resultJson.url) {
            videoUrl = resultJson.url;
          }
        } catch {
          // resultJson might not be valid JSON
        }
      }
      // Fallback: try other formats
      if (!videoUrl) {
        const output = result.data?.output || result.data;
        videoUrl = output?.video_url || output?.videoUrl || 
                       (Array.isArray(output?.videos) ? output.videos[0]?.url : null) ||
                       output?.url || output?.result;
      }

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

    if (taskState === 'failed') {
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
      taskState,
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
