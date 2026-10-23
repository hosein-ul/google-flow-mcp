import { logger } from '../utils/logger.js';
import { get } from '../utils/config.js';

export async function navigateToFlow(page) {
  const flowUrl = get('flowUrl', 'https://labs.google/fx/tools/flow');
  const currentUrl = page.url();

  if (!currentUrl.includes('labs.google/fx/tools/flow')) {
    logger.info('Navigating to Google Flow', { url: flowUrl });
    await page.goto(flowUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);
  }

  const finalUrl = page.url();
  if (finalUrl.includes('accounts.google.com')) {
    return {
      authenticated: false,
      url: finalUrl,
      message: 'Google Sign-in is required. Please sign in to your Google Account in the opened Chrome window.'
    };
  }

  return { authenticated: true, url: finalUrl };
}

export async function checkAuthStatus(page) {
  const url = page.url();
  if (url.includes('accounts.google.com')) {
    return {
      authenticated: false,
      message: 'User is on Google login screen. Please sign in in the visible Chrome window.'
    };
  }
  
  const inFlow = url.includes('labs.google');
  return {
    authenticated: inFlow,
    currentUrl: url,
    title: await page.title().catch(() => '')
  };
}

/**
 * Ensures the page is inside an active Flow project canvas.
 * If on the homepage, creates or opens a project.
 */
export async function ensureInsideProject(page, projectName = '') {
  const currentUrl = page.url();
  if (currentUrl.includes('/project/')) {
    logger.info('Already inside a project canvas', { url: currentUrl });
    return { projectUrl: currentUrl, created: false };
  }

  logger.info('Not inside a project canvas, finding or creating project...');
  
  // Try entering the first existing project card if available
  const existingCard = page.locator('a[href*="/project/"]').first();
  if (!projectName && await existingCard.isVisible().catch(() => false)) {
    logger.info('Entering existing project card...');
    await existingCard.click();
    await page.waitForTimeout(3000);
    return { projectUrl: page.url(), created: false };
  }

  // Otherwise, click "New project"
  const newBtn = page.locator(
    'button:has-text("New project"), button:has-text("Nouveau projet"), ' +
    'a:has-text("New project"), a:has-text("Nouveau projet"), [aria-label*="New project"]'
  ).first();

  if (await newBtn.isVisible().catch(() => false)) {
    logger.info('Clicking "New project" button...');
    await newBtn.click();
    await page.waitForTimeout(4000);

    // If modal asks for project name
    if (projectName) {
      const nameInput = page.locator('input[placeholder*="name" i], input[placeholder*="nom" i]').first();
      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill(projectName);
        const confirmBtn = page.locator('button:has-text("Create"), button:has-text("Créer"), button:has-text("OK")').first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    }
  }

  // If still not in /project/, click the newest project card
  if (!page.url().includes('/project/')) {
    const card = page.locator('a[href*="/project/"]').first();
    if (await card.isVisible().catch(() => false)) {
      await card.click();
      await page.waitForTimeout(3000);
    }
  }

  return { projectUrl: page.url(), created: true };
}

/**
 * Switches the generation mode to "Image"
 */
export async function switchToImageMode(page) {
  logger.info('Switching to Image mode...');
  
  // Try direct tab trigger
  const imageTab = page.locator(
    'button[role="tab"][id*="IMAGE"], button[role="tab"]:has-text("Image")'
  ).first();

  if (await imageTab.isVisible().catch(() => false)) {
    const selected = await imageTab.getAttribute('aria-selected').catch(() => null);
    if (selected === 'true') {
      logger.info('Already in Image mode');
      return true;
    }
    await imageTab.click();
    await page.waitForTimeout(1000);
    return true;
  }

  // Try dropdown selector if tabs are compact
  const modeDropdown = page.locator('button:has-text("Vidéo"), button:has-text("Video")').first();
  if (await modeDropdown.isVisible().catch(() => false)) {
    await modeDropdown.click();
    await page.waitForTimeout(500);
    const imgOpt = page.locator('[role="menuitem"]:has-text("Image"), [id*="IMAGE"]').first();
    if (await imgOpt.isVisible().catch(() => false)) {
      await imgOpt.click();
      await page.waitForTimeout(1000);
      return true;
    }
    await page.keyboard.press('Escape');
  }

  return false;
}

/**
 * Switches the generation mode to "Video"
 */
export async function switchToVideoMode(page) {
  logger.info('Switching to Video mode...');
  
  const videoTab = page.locator(
    'button[role="tab"][id*="VIDEO"], button[role="tab"]:has-text("Video"), button[role="tab"]:has-text("Vidéo")'
  ).first();

  if (await videoTab.isVisible().catch(() => false)) {
    const selected = await videoTab.getAttribute('aria-selected').catch(() => null);
    if (selected === 'true') {
      logger.info('Already in Video mode');
      return true;
    }
    await videoTab.click();
    await page.waitForTimeout(1000);
    return true;
  }

  // Try dropdown selector
  const modeDropdown = page.locator('button:has-text("Image")').first();
  if (await modeDropdown.isVisible().catch(() => false)) {
    await modeDropdown.click();
    await page.waitForTimeout(500);
    const vidOpt = page.locator('[role="menuitem"]:has-text("Video"), [role="menuitem"]:has-text("Vidéo"), [id*="VIDEO"]').first();
    if (await vidOpt.isVisible().catch(() => false)) {
      await vidOpt.click();
      await page.waitForTimeout(1000);
      return true;
    }
    await page.keyboard.press('Escape');
  }

  return false;
}

/**
 * Locates the prompt input field (contenteditable div or textarea)
 */
export async function findPromptInput(page) {
  const candidates = [
    page.locator('[contenteditable="true"]:visible').first(),
    page.locator('textarea:visible').first(),
    page.locator('[contenteditable="true"]').first(),
    page.locator('textarea').first()
  ];

  for (const c of candidates) {
    if (await c.isVisible().catch(() => false)) {
      return c;
    }
  }
  return null;
}

/**
 * Clicks the Generate button and approves any agent confirmation modal.
 */
export async function clickGenerateAndApprove(page) {
  const generateBtn = page.locator(
    'button:has-text("arrow_forward"), button:has-text("Generate"), button:has-text("Créer"), ' +
    '[aria-label*="Generate" i], [aria-label*="Créer" i]'
  ).first();

  if (!await generateBtn.isVisible().catch(() => false)) {
    throw new Error('Generate button not visible on the project toolbar.');
  }

  logger.info('Clicking Generate button...');
  await generateBtn.click();
  await page.waitForTimeout(1000);

  // Check if confirmation modal (e.g. Approve / Accepter) appears
  const modalStart = Date.now();
  while (Date.now() - modalStart < 4000) {
    const approveBtn = page.locator(
      'button:has-text("Approve"), button:has-text("Accepter"), button:has-text("Confirm")'
    ).first();
    if (await approveBtn.isVisible().catch(() => false)) {
      logger.info('Approving agent confirmation dialog...');
      await approveBtn.click();
      break;
    }
    await page.waitForTimeout(400);
  }
}
