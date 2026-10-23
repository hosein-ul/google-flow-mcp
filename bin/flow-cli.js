#!/usr/bin/env node
import { FlowController } from '../src/bridge/flow-controller.js';
import path from 'path';
import os from 'os';

const controller = new FlowController();
const args = process.argv.slice(2);
const command = args[0];

const DEFAULT_OUTPUT = path.join(os.homedir(), '.gemini', 'antigravity', 'scratch', 'flow_output');

async function main() {
  if (!command || command === 'help') {
    console.log(`
Google Flow CLI & MCP Integration
Usage:
  node bin/flow-cli.js image "<prompt>" [--model "Nano Banana 2.1"] [--ratio 16:9] [--qty x1] [--out path]
  node bin/flow-cli.js video "<prompt>" [--model "Omni 1.1 Flash"] [--duration 4s] [--res 720p] [--qty x1] [--out path]
  node bin/flow-cli.js status
  node bin/flow-cli.js assets
`);
    return;
  }

  if (command === 'status') {
    console.log('Connecting to Google Flow...');
    const status = await controller.getStatus();
    console.log('Google Flow Status:', JSON.stringify(status, null, 2));
    return;
  }

  if (command === 'assets') {
    console.log('Fetching canvas assets from Google Flow...');
    const assets = await controller.getCanvasAssets();
    console.log('Canvas Assets:', JSON.stringify(assets, null, 2));
    return;
  }

  if (command === 'image') {
    const prompt = args[1];
    if (!prompt) {
      console.error('Error: prompt required for image generation');
      process.exit(1);
    }
    console.log(`Starting Image Generation with Google Flow (0 credits)...`);
    const res = await controller.generateImage({
      prompt,
      model: 'Nano Banana 2.1',
      ratio: '16:9',
      quantity: 'x1',
      outputFolder: DEFAULT_OUTPUT
    });
    console.log('✅ Generation succeeded!');
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (command === 'video') {
    const prompt = args[1];
    if (!prompt) {
      console.error('Error: prompt required for video generation');
      process.exit(1);
    }
    console.log(`Starting Video Generation with Omni 1.1 Flash...`);
    const res = await controller.generateVideo({
      prompt,
      model: 'Omni 1.1 Flash',
      duration: '4s',
      resolution: '720p',
      ratio: '16:9',
      quantity: 'x1',
      outputFolder: DEFAULT_OUTPUT
    });
    console.log('✅ Video Generation succeeded!');
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  console.error(`Unknown command: ${command}`);
}

main().catch(err => {
  console.error('Flow CLI Error:', err.message);
  process.exit(1);
});
