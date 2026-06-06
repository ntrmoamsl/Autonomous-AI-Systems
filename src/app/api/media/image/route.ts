import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createImageTask, getKieTaskDetail } from '@/lib/ai';
import { addTextOverlayToBase64, addTextOverlay } from '@/lib/text-overlay';

// POST - Generate image using GPT Image-2 or Grok Imagine via Kie.ai API
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, prompt, aspectRatio, resolution, model = 'gpt-image-2', textOverlay } = body;

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

    // Save the task ID and text overlay to the post
    if (postId) {
      await db.contentPost.update({
        where: { id: postId },
        data: { 
          videoTaskId: taskId, // Reuse this field for image task ID too
          aiModel: validModel === 'gpt-image-2' ? 'gpt-image-2' : 'grok-imagine',
          mediaType: 'image',
          ...(textOverlay ? { textOverlay } : {}),
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
// Applies text overlay when image is ready
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

        // Download image and apply text overlay
        try {
          const imageResponse = await fetch(imageUrl);
          if (imageResponse.ok) {
            const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
            
            // Get the post to check for text overlay
            const post = await db.contentPost.findUnique({ where: { id: postId } });
            
            let finalBase64: string;
            if (post?.textOverlay) {
              // Apply text overlay
              const overlayBuffer = await addTextOverlay(imageBuffer, {
                text: post.textOverlay,
                fontSize: 42,
                position: 'bottom',
                backgroundColor: 'rgba(0,0,0,0.65)',
              });
              finalBase64 = overlayBuffer.toString('base64');
            } else {
              finalBase64 = imageBuffer.toString('base64');
            }
            
            await db.contentPost.update({
              where: { id: postId },
              data: { imageData: finalBase64 },
            });
          }
        } catch (downloadError) {
          console.error('Error downloading image for base64/overlay conversion:', downloadError);
          // URL is still stored, just no base64/overlay
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
