import { getBridgeServer } from './flow-bridge-server.js';
import fs from 'fs';
import path from 'path';

export class FlowController {
  constructor() {
    this.bridge = getBridgeServer();
  }

  async ensureFlowReady() {
    await this.bridge.ensureFlowTab();
    await new Promise(r => setTimeout(r, 1000));

    // Check if on home or inside a project
    const url = await this.bridge.evaluate('window.location.href');
    if (url && url.includes('/project/')) {
      return true;
    }

    // If on home page, click "New project" or select first project
    const navigated = await this.bridge.evaluate(`
      (() => {
        const newProjBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.innerText?.includes('New project') || b.getAttribute('aria-label')?.includes('New project')
        );
        if (newProjBtn) {
          newProjBtn.click();
          return true;
        }
        const firstProj = document.querySelector('a[href*=\"/project/\"]');
        if (firstProj) {
          firstProj.click();
          return true;
        }
        return false;
      })()
    `);

    if (navigated) {
      await new Promise(r => setTimeout(r, 2500));
    }
    return true;
  }

  async openSettings() {
    const isOpen = await this.bridge.evaluate(`
      (() => {
        const overlay = document.querySelector('.cdk-overlay-container');
        return overlay && overlay.innerText.includes('Generating will use');
      })()
    `);
    if (isOpen) return;

    await this.bridge.evaluate(`
      (() => {
        const btn = document.querySelector('button[aria-label=\"Settings trigger\"]');
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 600));
  }

  async setMode(mode = 'Image') {
    await this.openSettings();
    await this.bridge.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.cdk-overlay-container button')).find(b => 
          b.innerText?.trim().toLowerCase().includes('${mode.toLowerCase()}')
        );
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 400));
  }

  async setQuantity(qty = 'x1') {
    await this.openSettings();
    const qtyStr = qty.startsWith('x') ? qty : `x${qty}`;
    await this.bridge.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.cdk-overlay-container button')).find(b => 
          b.innerText?.trim() === '${qtyStr}'
        );
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 300));
  }

  async setRatio(ratio = '16:9') {
    await this.openSettings();
    await this.bridge.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.cdk-overlay-container button')).find(b => 
          b.innerText?.includes('${ratio}')
        );
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 300));
  }

  async selectModel(modelName) {
    await this.openSettings();
    await this.bridge.evaluate(`
      (() => {
        const btn = document.querySelector('button[aria-label=\"Select model family\"]');
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 500));

    const selected = await this.bridge.evaluate(`
      (() => {
        const menuPanes = Array.from(document.querySelectorAll('.cdk-overlay-pane'));
        const lastPane = menuPanes[menuPanes.length - 1];
        if (!lastPane) return false;
        
        const targetModel = '${modelName.toLowerCase()}';
        const items = Array.from(lastPane.querySelectorAll('button, [role=\"menuitem\"], .mdc-list-item, div'));
        const match = items.find(el => el.innerText?.toLowerCase().includes(targetModel));
        if (match) {
          match.click();
          return true;
        }
        return false;
      })()
    `);
    await new Promise(r => setTimeout(r, 400));
    return selected;
  }

  async setResolution(resolution = '720p') {
    await this.openSettings();
    await this.bridge.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.cdk-overlay-container button')).find(b => 
          b.innerText?.trim() === '${resolution}'
        );
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 300));
  }

  async setDuration(duration = '4s') {
    await this.openSettings();
    const durStr = duration.endsWith('s') ? duration : `${duration}s`;
    await this.bridge.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('.cdk-overlay-container button')).find(b => 
          b.innerText?.trim() === '${durStr}'
        );
        if (btn) btn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 300));
  }

  async closeSettings() {
    await this.bridge.evaluate(`
      (() => {
        const backdrop = document.querySelector('.cdk-overlay-backdrop');
        if (backdrop) backdrop.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 300));
  }

  async typePromptAndSubmit(prompt) {
    await this.bridge.evaluate(`
      (() => {
        const editor = document.querySelector('div.ProseMirror[contenteditable=\"true\"]');
        if (!editor) throw new Error('Google Flow prompt editor not found');
        editor.focus();
        document.execCommand('selectAll', false, null);
      })()
    `);

    await this.bridge.cdp('Input.insertText', { text: prompt });
    await new Promise(r => setTimeout(r, 400));
    await this.closeSettings();

    await this.bridge.evaluate(`
      (() => {
        const editor = document.querySelector('div.ProseMirror');
        if (editor) editor.focus();
      })()
    `);

    await this.bridge.cdp('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      windowsVirtualKeyCode: 13,
      key: 'Enter',
      code: 'Enter',
      text: '\r'
    });
    await this.bridge.cdp('Input.dispatchKeyEvent', {
      type: 'keyUp',
      windowsVirtualKeyCode: 13,
      key: 'Enter',
      code: 'Enter'
    });

    await new Promise(r => setTimeout(r, 1000));
  }

  async generateImage({
    prompt,
    model = 'Nano Banana 2.1',
    ratio = '16:9',
    quantity = 'x1',
    timeoutSeconds = 90,
    outputFolder = null
  }) {
    await this.ensureFlowReady();
    await this.setMode('Image');
    if (ratio) await this.setRatio(ratio);
    if (quantity) await this.setQuantity(quantity);
    if (model) await this.selectModel(model);

    const existingImages = await this.bridge.evaluate(`
      (() => {
        return Array.from(document.querySelectorAll('img'))
          .map(i => i.src)
          .filter(s => s.includes('flow-content.google'));
      })()
    `);

    console.error(`[google-flow-mcp] Submitting image prompt: "${prompt}"...`);
    await this.typePromptAndSubmit(prompt);

    const startTime = Date.now();
    const maxWaitMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.bridge.evaluate(`
        (() => {
          const text = document.body.innerText;
          const hasFailed = text.includes('failed to generate') || text.includes('Sorry, this image failed');
          const percent = (text.match(/\\b\\d{1,3}%/g) || [])[0] || null;

          const currentImages = Array.from(document.querySelectorAll('img'))
            .map(img => ({
              src: img.src,
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              alt: img.alt
            }))
            .filter(img => img.src.includes('flow-content.google'));

          return {
            hasFailed,
            percent,
            currentImages
          };
        })()
      `);

      if (status && status.hasFailed) {
        throw new Error('Google Flow reported: Sorry, this image failed to generate. Please retry.');
      }

      const newImages = status ? status.currentImages.filter(img => !existingImages.includes(img.src)) : [];
      if (newImages.length > 0) {
        const savedFiles = [];
        if (outputFolder) {
          if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
          }
          for (let i = 0; i < newImages.length; i++) {
            const img = newImages[i];
            const filename = `flow_${Date.now()}_${i + 1}.png`;
            const filePath = path.join(outputFolder, filename);
            const res = await fetch(img.src);
            const buffer = Buffer.from(await res.arrayBuffer());
            fs.writeFileSync(filePath, buffer);
            savedFiles.push({
              path: filePath,
              sizeBytes: buffer.length,
              url: img.src,
              dimensions: `${img.width}x${img.height}`
            });
          }
        }

        return {
          success: true,
          prompt,
          model,
          ratio,
          images: newImages,
          savedFiles
        };
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error(`Generation timed out after ${timeoutSeconds}s`);
  }

  async generateVideo({
    prompt,
    model = 'Omni 1.1 Flash',
    duration = '4s',
    resolution = '720p',
    ratio = '16:9',
    quantity = 'x1',
    timeoutSeconds = 180,
    outputFolder = null
  }) {
    await this.ensureFlowReady();
    await this.setMode('Video');
    if (ratio) await this.setRatio(ratio);
    if (quantity) await this.setQuantity(quantity);
    if (duration) await this.setDuration(duration);
    if (resolution) await this.setResolution(resolution);
    if (model) await this.selectModel(model);

    const existingVideos = await this.bridge.evaluate(`
      (() => {
        return Array.from(document.querySelectorAll('video'))
          .map(v => v.src || Array.from(v.querySelectorAll('source')).map(s => s.src).join(''))
          .filter(s => s.length > 0);
      })()
    `);

    console.error(`[google-flow-mcp] Submitting video prompt: "${prompt}"...`);
    await this.typePromptAndSubmit(prompt);

    const startTime = Date.now();
    const maxWaitMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.bridge.evaluate(`
        (() => {
          const text = document.body.innerText;
          const hasFailed = text.includes('failed to generate') || text.includes('Sorry, this video failed');
          const percent = (text.match(/\\b\\d{1,3}%/g) || [])[0] || null;

          const currentVideos = Array.from(document.querySelectorAll('video'))
            .map(v => ({
              src: v.src || Array.from(v.querySelectorAll('source')).map(s => s.src)[0],
              poster: v.poster,
              duration: v.duration
            }))
            .filter(v => v.src && v.src.includes('flow-content.google'));

          return {
            hasFailed,
            percent,
            currentVideos
          };
        })()
      `);

      if (status && status.hasFailed) {
        throw new Error('Google Flow reported: Sorry, this video failed to generate.');
      }

      const newVideos = status ? status.currentVideos.filter(v => !existingVideos.includes(v.src)) : [];
      if (newVideos.length > 0) {
        const savedFiles = [];
        if (outputFolder) {
          if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
          }
          for (let i = 0; i < newVideos.length; i++) {
            const vid = newVideos[i];
            const filename = `flow_video_${Date.now()}_${i + 1}.mp4`;
            const filePath = path.join(outputFolder, filename);
            const res = await fetch(vid.src);
            const buffer = Buffer.from(await res.arrayBuffer());
            fs.writeFileSync(filePath, buffer);
            savedFiles.push({
              path: filePath,
              sizeBytes: buffer.length,
              url: vid.src
            });
          }
        }

        return {
          success: true,
          prompt,
          model,
          duration,
          resolution,
          ratio,
          videos: newVideos,
          savedFiles
        };
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    throw new Error(`Video generation timed out after ${timeoutSeconds}s`);
  }

  async getStatus() {
    await this.ensureFlowReady();
    return this.bridge.evaluate(`
      (() => {
        const text = document.body.innerText;
        const projectTitle = document.querySelector('input.editable-text-input')?.value || document.title;
        const accountBtn = document.querySelector('[aria-label*=\"Google Account\"]');
        const account = accountBtn?.getAttribute('aria-label') || 'Logged in';
        const settingsText = document.querySelector('.settings-trigger-button')?.innerText || '';
        const hasPro = text.includes('PRO');

        return {
          url: window.location.href,
          title: projectTitle,
          account,
          hasPro,
          settingsSummary: settingsText
        };
      })()
    `);
  }

  async getCanvasAssets() {
    await this.ensureFlowReady();
    return this.bridge.evaluate(`
      (() => {
        const imgs = Array.from(document.querySelectorAll('img'))
          .filter(i => i.src.includes('flow-content.google'))
          .map(i => ({
            type: 'image',
            src: i.src,
            alt: i.alt,
            width: i.naturalWidth,
            height: i.naturalHeight
          }));

        const videos = Array.from(document.querySelectorAll('video'))
          .filter(v => v.src?.includes('flow-content.google') || v.querySelector('source[src*=\"flow-content.google\"]'))
          .map(v => ({
            type: 'video',
            src: v.src || v.querySelector('source')?.src,
            poster: v.poster,
            duration: v.duration
          }));

        return {
          imagesCount: imgs.length,
          videosCount: videos.length,
          images: imgs,
          videos
        };
      })()
    `);
  }
}
