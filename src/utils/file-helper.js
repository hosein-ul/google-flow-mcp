import fs from 'fs';
import path from 'path';
import { get } from './config.js';
import { logger } from './logger.js';

export function getDownloadsDirectory(subfolder = '') {
  const base = get('downloadsDir') || path.resolve(process.cwd(), 'downloads');
  const target = subfolder ? path.join(base, subfolder) : base;
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  return target;
}

export function saveBufferToDisk(buffer, targetPath) {
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(targetPath, buffer);
  logger.info('File saved to disk', { path: targetPath, bytes: buffer.length });
  return targetPath;
}

export function generateFileName(prefix, extension) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${timestamp}_${rand}.${extension}`;
}
