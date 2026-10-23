import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { getPage } from '../browser/connect.js';
import { getDownloadsDirectory, generateFileName } from '../utils/file-helper.js';

export async function handleDownloadAsset(args) {
  const page = getPage();
  const targetFolder = args.destination_folder || getDownloadsDirectory('exports');
  const customFileName = args.file_name;

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  logger.info('Attempting asset download from Flow canvas', { targetFolder });

  const downloadBtn = page.locator(
    'button:has-text("Download"), button:has-text("Télécharger"), [aria-label*="download" i]'
  ).first();

  if (!await downloadBtn.isVisible().catch(() => false)) {
    throw new Error('No visible download button found on the current Flow canvas.');
  }

  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    downloadBtn.click()
  ]);

  const originalName = download.suggestedFilename() || 'flow_asset';
  const ext = path.extname(originalName) || '.bin';
  const saveName = customFileName
    ? (customFileName.endsWith(ext) ? customFileName : `${customFileName}${ext}`)
    : (download.suggestedFilename() || generateFileName('flow_asset', ext.replace('.', '')));

  const finalPath = path.join(targetFolder, saveName);
  await download.saveAs(finalPath);
  logger.info('Asset downloaded and saved successfully', { path: finalPath });

  return {
    success: true,
    file_path: finalPath,
    file_name: saveName
  };
}
