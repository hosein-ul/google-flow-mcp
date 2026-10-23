import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE = path.resolve(__dirname, '../../config/flow.config.json');

let cachedConfig = null;

export function getConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      cachedConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return cachedConfig;
    }
  } catch (err) {
    console.error('Failed to read flow.config.json, using defaults', err.message);
  }
  return {
    flowUrl: "https://labs.google/fx/tools/flow",
    cdpPort: 9224,
    chromeUserDataDir: path.join(process.env.USERPROFILE || 'C:\\Users\\Default', '.google-flow-profile'),
    downloadsDir: path.resolve(__dirname, '../../downloads'),
    timeouts: {
      connectionMs: 25000,
      imageGenMs: 90000,
      videoGenMs: 240000,
      actionDelayMs: 600
    }
  };
}

export function get(key, defaultValue = null) {
  const cfg = getConfig();
  return cfg[key] !== undefined ? cfg[key] : defaultValue;
}
