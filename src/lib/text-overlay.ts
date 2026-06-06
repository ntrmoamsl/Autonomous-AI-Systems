/**
 * Text Overlay Utility
 * 
 * Adds text (Arabic/English) onto generated images before publishing.
 * Uses Sharp for image processing.
 * 
 * For videos, the text is embedded in the video generation prompt instead.
 */

import sharp from 'sharp';

export interface TextOverlayOptions {
  text: string;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  position?: 'top' | 'center' | 'bottom';
  padding?: number;
  maxWidthRatio?: number; // Max width as ratio of image width (0-1)
}

/**
 * Add text overlay to an image buffer
 * Returns the modified image buffer with text overlaid
 */
export async function addTextOverlay(
  imageBuffer: Buffer,
  options: TextOverlayOptions
): Promise<Buffer> {
  const {
    text,
    fontSize = 36,
    fontColor = '#FFFFFF',
    backgroundColor = 'rgba(0,0,0,0.6)',
    position = 'bottom',
    padding = 20,
    maxWidthRatio = 0.85,
  } = options;

  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1080;
  const height = metadata.height || 1080;

  // Calculate text dimensions and wrap text
  const maxTextWidth = Math.floor(width * maxWidthRatio);
  const lines = wrapText(text, maxTextWidth, fontSize);
  const lineHeight = Math.floor(fontSize * 1.4);
  const totalTextHeight = lines.length * lineHeight + padding * 2;
  const barWidth = width;

  // Calculate Y position for the text bar
  let barY: number;
  switch (position) {
    case 'top':
      barY = 0;
      break;
    case 'center':
      barY = Math.floor((height - totalTextHeight) / 2);
      break;
    case 'bottom':
    default:
      barY = height - totalTextHeight;
      break;
  }

  // Create the text overlay SVG
  let svgText = '';
  lines.forEach((line, index) => {
    const textY = barY + padding + (index + 1) * lineHeight - Math.floor(lineHeight * 0.25);
    // Escape special characters for SVG
    const escapedLine = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    
    svgText += `<text x="${Math.floor(width / 2)}" y="${textY}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="${fontColor}" text-anchor="middle" font-weight="bold" direction="rtl">${escapedLine}</text>`;
  });

  const overlaySvg = `
    <svg width="${barWidth}" height="${height}">
      <rect x="0" y="${barY}" width="${barWidth}" height="${totalTextHeight}" fill="${backgroundColor}" rx="0" />
      ${svgText}
    </svg>
  `;

  // Composite the text overlay onto the original image
  const result = await sharp(imageBuffer)
    .composite([{
      input: Buffer.from(overlaySvg),
      top: 0,
      left: 0,
    }])
    .jpeg({ quality: 90 })
    .toBuffer();

  return result;
}

/**
 * Add text overlay to an image from base64
 * Returns the modified image as base64
 */
export async function addTextOverlayToBase64(
  base64Image: string,
  options: TextOverlayOptions
): Promise<string> {
  const imageBuffer = Buffer.from(base64Image, 'base64');
  const resultBuffer = await addTextOverlay(imageBuffer, options);
  return resultBuffer.toString('base64');
}

/**
 * Add text overlay to an image from URL
 * Returns the modified image as base64
 */
export async function addTextOverlayFromUrl(
  imageUrl: string,
  options: TextOverlayOptions
): Promise<string> {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  const resultBuffer = await addTextOverlay(imageBuffer, options);
  return resultBuffer.toString('base64');
}

/**
 * Wrap text to fit within a maximum width
 * Uses approximate character width calculation
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  // Approximate character width (Arabic chars tend to be wider)
  const avgCharWidth = fontSize * 0.55;
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

  if (text.length <= maxCharsPerLine) {
    return [text];
  }

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxCharsPerLine) {
      lines.push(remaining);
      break;
    }

    // Find a good break point (space or after maxCharsPerLine)
    let breakPoint = remaining.lastIndexOf(' ', maxCharsPerLine);
    if (breakPoint <= 0) {
      breakPoint = maxCharsPerLine;
    }

    lines.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return lines;
}

/**
 * Generate a video prompt that includes text overlay instructions
 * Since we can't easily overlay text on video server-side,
 * we embed the text instructions in the video generation prompt
 */
export function createVideoPromptWithText(basePrompt: string, textOverlay: string): string {
  return `${basePrompt}. The video should have the text "${textOverlay}" prominently displayed as a text overlay/title card in an elegant, professional way with good readability against the background.`;
}
