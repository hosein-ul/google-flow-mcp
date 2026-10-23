import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { getPage } from '../browser/connect.js';
import {
  ensureInsideProject,
  switchToVideoMode,
  findPromptInput,
  clickGenerateAndApprove
} from '../navigation/flow-navigator.js';
import { getDownloadsDirectory, generateFileName } from '../utils/file-helper.js';

export async function handleImageToVideo(args) {
  const page = getPage();
  const imagePath = args.image_path;
  const prompt = args.prompt || 'Animate this image smoothly';
  const ratio = args.ratio || '16:9';
  const duration = args.duration || '4s';
  const model = args.model || 'Veo 2';
  const outputFolder = args.output_folder || getDownloadsDirectory('videos');

  if (!imagePath) {
    throw new Error('image_path is required for image-to-video generation.');
  }

  if (!fs.existsSync(imagePath)) {
    throw new Error(`Reference image not found at: ${imagePath}`);
  }

  logger.info('Starting image-to-video generation with Veo', { imagePath, prompt, duration });

  // 1. Ensure inside project
  await ensureInsideProject(page, args.project_name);

  // 2. Switch to Video mode
  await switchToVideoMode(page);

  // 3. Upload reference image / ingredient
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.isVisible().catch(() => false)) {
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(2000);
  } else {
    // Try finding upload / add ingredient button
    const addImgBtn = page.locator('button:has-text("Add image"), button:has-text("Ingredient"), [aria-label*="image" i]').first();
    if (await addImgBtn.isVisible().catch(() => false)) {
      await addImgBtn.click();
      await page.waitForTimeout(1000);
      const input = page.locator('input[type="file"]').first();
      if (await input.count() > 0) {
        await input.setInputFiles(imagePath);
        await page.waitForTimeout(2000);
      }
    }
  }

  // 4. Fill Prompt
  const promptInput = await findPromptInput(page);
  if (promptInput) {
    await promptInput.click();
    await promptInput.fill('');
    await page.waitForTimeout(200);
    await promptInput.type(prompt, { delay: 10 });
    await page.waitForTimeout(500);
  }

  // 5. Click Generate
  await clickGenerateAndApprove(page);

  // 6. Wait for Video Rendering (up to 240 seconds)
  logger.info('Waiting for Veo image-to-video animation to complete...');
  const timeoutMs = 240000;
  const start = Date.now();
  let completed = false;

  while (Date.now() - start < timeoutMs) {
    await page.waitForTimeout(5000);
    const downloadBtn = page.locator('button:has-text("Download"), button:has-text("Télécharger")').first();
    if (await downloadBtn.isVisible().catch(() => false)) {
      completed = true;
      break;
    }
  }

  // 7. Download
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const savedFiles = [];
  try {
    const downloadBtn = page.locator('button:has-text("Download"), button:has-text("Télécharger")').first();
    if (await downloadBtn.isVisible().catch(() => false)) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        downloadBtn.click()
      ]);
      const fileName = generateFileName('flow_i2v', 'mp4');
      const filePath = path.join(outputFolder, fileName);
      await download.saveAs(filePath);
      savedFiles.push(filePath);
    }
  } catch (err) {
    logger.warn('Download error in image-to-video', { error: err.message });
  }

  return {
    success: true,
    message: savedFiles.length > 0
      ? `Animated video successfully generated and downloaded`
      : 'Video rendering queued in Google Flow.',
    files: savedFiles,
    source_image: imagePath,
    prompt,
    duration,
    output_folder: outputFolder
  };
}
