import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createImageTask, getKieTaskDetail } from '@/lib/ai';
import { addTextOverlay } from '@/lib/text-overlay';

// POST - Generate image using GPT Image 2 via Kie.ai API
// GPT Image 2 is the ONLY model used for image generation.
// Grok Imagine is used for VIDEO generation only.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { postId, prompt, aspectRatio, resolution, textOverlay } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Image prompt is required' }, { status: 400 });
    }

    // Always use GPT Image 2 for image generation
    const taskResult = await createImageTask({
      prompt,
      aspectRatio: aspectRatio || 'auto',
      resolution: resolution || undefined,
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
          aiModel: 'gpt-image-2',
          mediaType: 'image',
          ...(textOverlay ? { textOverlay } : {}),
        },
      });
    }

    return NextResponse.json({
      taskId,
      postId,
      model: 'gpt-image-2',
      status: 'processing',
      message: 'Image generation task created using GPT Image 2. Use GET /api/media/image?taskId=xxx to check status.',
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

    const taskState = result.data?.state || 'unknown';

    if (taskState === 'success') {
      // Extract image URL from resultJson (it's a JSON string)
      let imageUrl: string | null = null;
      const resultJsonStr = result.data?.resultJson;
      if (resultJsonStr && typeof resultJsonStr === 'string') {
        try {
          const resultJson = JSON.parse(resultJsonStr);
          // resultUrls is an array of URLs
          if (Array.isArray(resultJson.resultUrls) && resultJson.resultUrls.length > 0) {
            imageUrl = resultJson.resultUrls[0];
          } else if (resultJson.url) {
            imageUrl = resultJson.url;
          }
        } catch {
          // resultJson might not be valid JSON
        }
      }
      // Fallback: try other formats
      if (!imageUrl) {
        const output = result.data?.output || result.data;
        imageUrl = output?.image_url || output?.imageUrl || 
                       (Array.isArray(output?.images) ? output.images[0]?.url : null) ||
                       (Array.isArray(output?.image_urls) ? output.image_urls[0] : null) ||
                       (Array.isArray(output?.results) ? output.results[0]?.url : null) ||
                       output?.url || output?.result;
      }

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
              // Apply text overlay on the image
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

    if (taskState === 'failed') {
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
      taskState,
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
