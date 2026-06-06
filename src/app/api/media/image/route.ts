import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createImageTask, getKieTaskDetail } from '@/lib/ai';

// POST - Generate image using Grok Imagine or GPT Image-2 via Kie.ai API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, prompt, aspectRatio, resolution, model = 'gpt-image-2' } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Image prompt is required' }, { status: 400 });
    }

    // Validate model
    const validModel = model === 'grok-imagine' ? 'grok-imagine' : 'gpt-image-2';

    // Create async image generation task via Kie.ai
    const taskResult = await createImageTask(validModel, {
      prompt,
      aspectRatio: aspectRatio || (validModel === 'gpt-image-2' ? 'auto' : '1:1'),
      resolution: validModel === 'gpt-image-2' ? (resolution || undefined) : undefined,
    });

    if (taskResult.code !== 200 && taskResult.code !== undefined) {
      return NextResponse.json(
        { error: 'Failed to create image task', details: taskResult.msg },
        { status: 500 }
      );
    }

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
          videoTaskId: taskId, // Reuse this field for image task ID too
          aiModel: validModel === 'gpt-image-2' ? 'gpt-image-2' : 'grok-imagine',
        },
      });
    }

    return NextResponse.json({
      taskId,
      postId,
      model: validModel,
      status: 'processing',
      message: `Image generation task created using ${validModel === 'gpt-image-2' ? 'GPT Image-2' : 'Grok Imagine'}. Use GET /api/media/image?taskId=xxx to check status.`,
    });
  } catch (error) {
    console.error('Error creating image task:', error);
    return NextResponse.json(
      { error: 'Failed to create image task', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET - Check image generation task status and retrieve result
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
      // Extract image URL from result - handles both Grok and GPT Image-2 response formats
      const output = result.data?.output || result.data;
      const imageUrl = output?.image_url || output?.imageUrl || 
                       (Array.isArray(output?.images) ? output.images[0]?.url : null) ||
                       (Array.isArray(output?.image_urls) ? output.image_urls[0] : null) ||
                       (Array.isArray(output?.results) ? output.results[0]?.url : null) ||
                       output?.url || output?.result;

      if (postId && imageUrl) {
        // Store the image URL
        await db.contentPost.update({
          where: { id: postId },
          data: { 
            imageUrl: typeof imageUrl === 'string' ? imageUrl : '',
            videoTaskId: null, // Clear task ID
          },
        });

        // Try to download and convert to base64 for Facebook publishing
        try {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            const base64 = imageBuffer.toString('base64');
            
            await db.contentPost.update({
              where: { id: postId },
              data: { imageData: base64 },
            });
          }
        } catch (downloadError) {
          console.error('Error downloading image for base64 conversion:', downloadError);
          // URL is still stored, just no base64
        }
      }

      return NextResponse.json({
        status: 'SUCCESS',
        imageUrl,
        postId,
      });
    }

    if (taskStatus === 'FAILED' || taskStatus === 'failed' || taskStatus === 'error') {
      // Clear task ID from post
      if (postId) {
        await db.contentPost.update({
          where: { id: postId },
          data: { videoTaskId: null },
        });
      }

      return NextResponse.json({
        status: 'FAILED',
        error: result.data?.error || 'Image generation failed',
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
    console.error('Error checking image task status:', error);
    return NextResponse.json(
      { error: 'Failed to check image task status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
