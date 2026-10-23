import fs from 'fs';
import { logger } from '../utils/logger.js';
import { getPage } from '../browser/connect.js';
import { ensureInsideProject } from '../navigation/flow-navigator.js';

export async function handleAddCharacter(args) {
  const page = getPage();
  const name = args.name || 'Character';
  const description = args.description || '';
  const referenceImage = args.reference_image;

  logger.info('Adding character ingredient to Flow', { name, description });

  // 1. Ensure inside project
  await ensureInsideProject(page, args.project_name);

  // 2. Open Characters sidebar
  const charNav = page.locator(
    'button:has-text("Characters"), button:has-text("Personnages"), a:has-text("Characters")'
  ).first();

  if (await charNav.isVisible().catch(() => false)) {
    await charNav.click();
    await page.waitForTimeout(1500);
  }

  // 3. Click New Character button
  const newBtn = page.locator(
    'button:has-text("New Character"), button:has-text("Nouveau"), [aria-label*="character" i]'
  ).first();

  if (await newBtn.isVisible().catch(() => false)) {
    await newBtn.click();
    await page.waitForTimeout(1000);

    // Description / prompt
    if (description) {
      const descInput = page.locator('textarea, [contenteditable="true"]').first();
      if (await descInput.isVisible().catch(() => false)) {
        await descInput.fill(description);
      }
    }

    // Upload reference image if provided
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
    message: `Character ingredient "${name}" configured in project.`,
    name,
    description
  };
}
