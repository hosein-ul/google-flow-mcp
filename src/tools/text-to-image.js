import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { getPage } from '../browser/connect.js';
import {
  ensureInsideProject,
  switchToImageMode,
  findPromptInput,
  clickGenerateAndApprove
} from '../navigation/flow-navigator.js';
import { getDownloadsDirectory, generateFileName } from '../utils/file-helper.js';

export async function handleTextToImage(args) {
  const page = getPage();
  const prompt = args.prompt;
  const ratio = args.ratio || '16:9';
  const model = args.model || 'Nano Banana 2';
  const outputFolder = args.output_folder || getDownloadsDirectory('images');

  if (!prompt) {
    throw new Error('Prompt is required for image generation.');
  }

  logger.info('Starting text-to-image generation', { prompt, ratio, model });

  // 1. Ensure inside a project
  await ensureInsideProject(page, args.project_name);

  // 2. Switch to Image mode
  await switchToImageMode(page);

  // 3. Select Ratio if available
  try {
    const ratioBtn = page.locator(`button:has-text("${ratio}")`).first();
    if (await ratioBtn.isVisible().catch(() => false)) {
      await ratioBtn.click();
      await page.waitForTimeout(300);
    }
  } catch { /* Continue if ratio button not visible */ }

  // 4. Select Model if available
  try {
    const modelSelector = page.locator('button:has-text("Nano"), button:has-text("Imagen"), [class*="model"] button').first();
    if (await modelSelector.isVisible().catch(() => false)) {
      await modelSelector.click();
      await page.waitForTimeout(500);
      const modelOpt = page.locator(`[role="menuitem"]:has-text("${model}"), button:has-text("${model}"), text="${model}"`).first();
      if (await modelOpt.isVisible().catch(() => false)) {
        await modelOpt.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press('Escape');
      }
    }
  } catch { /* Continue with current model */ }

  // 5. Fill prompt
  const promptInput = await findPromptInput(page);
  if (!promptInput) {
    throw new Error('Could not find prompt input field in Flow project.');
  }

  await promptInput.click();
  await promptInput.fill('');
  await page.waitForTimeout(200);
  await promptInput.type(prompt, { delay: 10 });
  await page.waitForTimeout(500);

  // Record initial image URLs to detect newly generated ones
  const initialImages = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img')).map(i => i.src).filter(Boolean);
  });

  // 6. Click Generate
  await clickGenerateAndApprove(page);

  // 7. Wait for generation to complete (up to 90 seconds)
  logger.info('Waiting for image generation to complete...');
  const timeoutMs = 90000;
  const start = Date.now();
  let newImageUrls = [];

  while (Date.now() - start < timeoutMs) {
    await page.waitForTimeout(3000);

    const currentImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(i => i.src).filter(src => {
        return src && (src.includes('media.getMediaUrlRedirect') || src.includes('googleusercontent.com') || src.startsWith('blob:'));
      });
    });

    const diff = currentImages.filter(src => !initialImages.includes(src));
    if (diff.length > 0) {
      newImageUrls = [...new Set(diff)];
      logger.info('New generated images detected', { count: newImageUrls.length });
      break;
    }
  }

  if (newImageUrls.length === 0) {
    // Check if download button appeared as fallback
    const hasDownload = await page.locator('button:has-text("Download"), button:has-text("Télécharger")').first().isVisible().catch(() => false);
    if (!hasDownload) {
      throw new Error('Image generation timed out or no new images were detected.');
    }
  }

  // 8. Download generated images
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const savedFiles = [];
  for (let i = 0; i < newImageUrls.length; i++) {
    const imgUrl = newImageUrls[i];
    try {
      const response = await page.goto(imgUrl, { waitUntil: 'load', timeout: 15000 });
      if (response && response.ok()) {
        const buffer = await response.body();
        const fileName = generateFileName('flow_image', 'png');
        const filePath = path.join(outputFolder, fileName);
        fs.writeFileSync(filePath, buffer);
        savedFiles.push(filePath);
      }
    } catch (err) {
      logger.warn('Failed to download image URL directly, attempting screenshot extraction', { error: err.message });
    }
  }

  return {
    success: true,
    message: `Generated and downloaded ${savedFiles.length} image(s)`,
    files: savedFiles,
    output_folder: outputFolder,
    prompt,
    ratio,
    model
  };
}
