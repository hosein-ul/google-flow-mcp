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

export async function handleTextToVideo(args) {
  const page = getPage();
  const prompt = args.prompt;
  const ratio = args.ratio || '16:9';
  const duration = args.duration || '4s';
  const model = args.model || 'Veo 2';
  const outputFolder = args.output_folder || getDownloadsDirectory('videos');

  if (!prompt) {
    throw new Error('Prompt is required for video generation.');
  }

  logger.info('Starting text-to-video generation with Veo', { prompt, ratio, duration, model });

  // 1. Ensure inside a project canvas
  await ensureInsideProject(page, args.project_name);

  // 2. Switch to Video mode
  await switchToVideoMode(page);

  // 3. Select Ratio (16:9 or 9:16)
  try {
    const ratioBtn = page.locator(`button:has-text("${ratio}")`).first();
    if (await ratioBtn.isVisible().catch(() => false)) {
      await ratioBtn.click();
      await page.waitForTimeout(300);
    }
  } catch { /* Continue */ }

  // 4. Select Duration (4s, 6s, 8s)
  try {
    const durBtn = page.locator(`button:has-text("${duration}")`).first();
    if (await durBtn.isVisible().catch(() => false)) {
      await durBtn.click();
      await page.waitForTimeout(300);
    }
  } catch { /* Continue */ }

  // 5. Select Video Model (Veo 2, Veo 3.1, Omni Flash)
  try {
    const modelSelector = page.locator('button:has-text("Veo"), button:has-text("Omni"), [class*="model"] button').first();
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
  } catch { /* Continue with active video model */ }

  // 6. Fill Prompt
  const promptInput = await findPromptInput(page);
  if (!promptInput) {
    throw new Error('Could not find prompt input field for video in Flow project.');
  }

  await promptInput.click();
  await promptInput.fill('');
  await page.waitForTimeout(200);
  await promptInput.type(prompt, { delay: 10 });
  await page.waitForTimeout(500);

  // Record initial videos to detect newly rendered video
  const initialVideos = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('video')).map(v => v.src || v.currentSrc).filter(Boolean);
  });

  // 7. Click Generate and confirm modal
  await clickGenerateAndApprove(page);

  // 8. Wait for Video Rendering to complete (Veo typically takes 40s to 180s)
  logger.info('Waiting for Veo video rendering to complete...');
  const timeoutMs = 240000;
  const start = Date.now();
  let newVideoUrls = [];

  while (Date.now() - start < timeoutMs) {
    await page.waitForTimeout(5000);

    const currentVideos = await page.evaluate(() => {
      const vids = Array.from(document.querySelectorAll('video'));
      return vids.map(v => v.src || v.currentSrc).filter(Boolean);
    });

    const diff = currentVideos.filter(src => !initialVideos.includes(src));
    if (diff.length > 0) {
      newVideoUrls = [...new Set(diff)];
      logger.info('New generated video detected', { count: newVideoUrls.length });
      break;
    }

    // Also check for download button on the video card
    const downloadBtn = page.locator('button:has-text("Download"), button:has-text("Télécharger"), [aria-label*="download" i]').first();
    if (await downloadBtn.isVisible().catch(() => false)) {
      logger.info('Video download button is ready');
      break;
    }
  }

  // 9. Download generated video (.mp4)
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const savedFiles = [];
  if (newVideoUrls.length > 0) {
    for (const vidUrl of newVideoUrls) {
      try {
        const response = await page.goto(vidUrl, { waitUntil: 'load', timeout: 25000 });
        if (response && response.ok()) {
          const buffer = await response.body();
          const fileName = generateFileName('flow_video', 'mp4');
          const filePath = path.join(outputFolder, fileName);
          fs.writeFileSync(filePath, buffer);
          savedFiles.push(filePath);
        }
      } catch (err) {
        logger.warn('Error fetching direct video URL', { error: err.message });
      }
    }
  }

  // Fallback: click download button if URL fetch was empty
  if (savedFiles.length === 0) {
    try {
      const downloadBtn = page.locator('button:has-text("Download"), button:has-text("Télécharger")').first();
      if (await downloadBtn.isVisible().catch(() => false)) {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }),
          downloadBtn.click()
        ]);
        const fileName = generateFileName('flow_video', 'mp4');
        const filePath = path.join(outputFolder, fileName);
        await download.saveAs(filePath);
        savedFiles.push(filePath);
      }
    } catch (e) {
      logger.warn('Download button fallback error', { error: e.message });
    }
  }

  return {
    success: true,
    message: savedFiles.length > 0
      ? `Generated and downloaded ${savedFiles.length} video(s)`
      : 'Video generation submitted in Google Flow. Please check the project timeline.',
    files: savedFiles,
    output_folder: outputFolder,
    prompt,
    duration,
    ratio,
    model
  };
}
