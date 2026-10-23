import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import { get } from '../utils/config.js';

let browser = null;
let context = null;
let page = null;

function findChromeBinary() {
  const custom = get('chromePath');
  if (custom && fs.existsSync(custom)) return custom;

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

export function isConnected() {
  return browser !== null && browser.isConnected() && page !== null;
}

export function getBrowser() {
  return browser;
}

export function getContext() {
  return context;
}

export function getPage() {
  if (!page || page.isClosed()) {
    throw new Error('No active page connected. Please call flow_connect first.');
  }
  return page;
}

/**
 * Connect to an already running Chrome or launch a new instance with persistent profile.
 */
export async function connectToBrowser(options = {}) {
  const cdpPort = options.cdpPort || get('cdpPort', 9224);
  const cdpUrl = `http://127.0.0.1:${cdpPort}`;
  const userDataDir = options.userDataDir || get('chromeUserDataDir');
  const flowUrl = get('flowUrl', 'https://labs.google/fx/tools/flow');

  if (isConnected()) {
    logger.info('Reusing active browser connection');
    return { browser, context, page };
  }

  // Step 1: Try connecting to existing Chrome process over CDP
  try {
    const versionCheck = await fetch(`${cdpUrl}/json/version`, { signal: AbortSignal.timeout(1500) });
    if (versionCheck.ok) {
      logger.info('Found existing Chrome instance on CDP port', { cdpPort });
      browser = await chromium.connectOverCDP(cdpUrl);
      const contexts = browser.contexts();
      context = contexts.length > 0 ? contexts[0] : await browser.newContext();
      
      const pages = context.pages();
      const existingFlowPage = pages.find(p => p.url().includes('labs.google'));
      page = existingFlowPage || (pages.length > 0 ? pages[0] : await context.newPage());
      
      return { browser, context, page };
    }
  } catch {
    logger.info('No running Chrome on CDP port, launching new instance...');
  }

  // Step 2: Launch real Chrome directly with anti-detection flags
  const chromePath = findChromeBinary();
  if (!fs.existsSync(chromePath)) {
    throw new Error(`Google Chrome executable not found at: ${chromePath}. Please specify 'chromePath' in config.`);
  }

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const args = [
    `--remote-debugging-port=${cdpPort}`,
    '--remote-allow-origins=*',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1920,1080',
    flowUrl
  ];

  logger.info('Spawning Chrome with dedicated user data directory', { chromePath, cdpPort, userDataDir });

  const proc = spawn(chromePath, args, { detached: true, stdio: 'ignore' });
  proc.unref();

  // Poll until CDP is responsive
  let attempts = 0;
  const maxAttempts = 25;
  while (attempts < maxAttempts) {
    try {
      const resp = await fetch(`${cdpUrl}/json/version`);
      if (resp.ok) break;
    } catch { }
    await new Promise(r => setTimeout(r, 1000));
    attempts++;
  }

  if (attempts >= maxAttempts) {
    throw new Error(`Chrome failed to open CDP port ${cdpPort} within ${maxAttempts} seconds.`);
  }

  browser = await chromium.connectOverCDP(cdpUrl);
  const contexts = browser.contexts();
  context = contexts.length > 0 ? contexts[0] : await browser.newContext();
  
  const pages = context.pages();
  const existingFlowPage = pages.find(p => p.url().includes('labs.google'));
  page = existingFlowPage || (pages.length > 0 ? pages[0] : await context.newPage());

  logger.info('Connected to Chrome via CDP successfully');
  return { browser, context, page };
}

export async function disconnectBrowser() {
  if (browser) {
    try {
      await browser.close();
    } catch (err) {
      logger.warn('Error while closing browser', { error: err.message });
    }
  }
  browser = null;
  context = null;
  page = null;
  logger.info('Disconnected from browser');
}
