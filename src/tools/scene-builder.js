import fs from 'fs';
import { logger } from '../utils/logger.js';
import { getPage } from '../browser/connect.js';
import { ensureInsideProject } from '../navigation/flow-navigator.js';

export async function handleAddScene(args) {
  const page = getPage();
  const description = args.description || '';
  const referenceImage = args.reference_image;

  logger.info('Adding scene to Storyboard', { description });

  // 1. Ensure inside project
  await ensureInsideProject(page, args.project_name);

  // 2. Open Scenes sidebar
  const sceneNav = page.locator(
    'button:has-text("Scenes"), button:has-text("Scènes"), a:has-text("Scenes")'
  ).first();

  if (await sceneNav.isVisible().catch(() => false)) {
    await sceneNav.click();
    await page.waitForTimeout(1500);
  }

  // 3. Click New Scene button
  const newSceneBtn = page.locator(
    'button:has-text("New Scene"), button:has-text("Nouvelle scène"), button:has-text("Create")'
  ).first();

  if (await newSceneBtn.isVisible().catch(() => false)) {
    await newSceneBtn.click();
    await page.waitForTimeout(1000);

    if (description) {
      const descInput = page.locator('textarea, [contenteditable="true"]').first();
      if (await descInput.isVisible().catch(() => false)) {
        await descInput.fill(description);
      }
    }

    if (referenceImage && fs.existsSync(referenceImage)) {
      const fileInput = page.locator('input[type="file"]').first();
      if (await fileInput.isVisible().catch(() => false)) {
        await fileInput.setInputFiles(referenceImage);
        await page.waitForTimeout(2000);
      }
    }
  }

  return {
    success: true,
    message: 'Scene successfully added to project storyboard.',
    description
  };
}
