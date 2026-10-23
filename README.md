# Google Flow MCP Server 🎨 🎬

> Production-grade Model Context Protocol (MCP) server & dedicated Chrome extension enabling AI coding agents (Antigravity, Cursor, Claude Code) to generate high-resolution images and cinematic videos using **Google Flow** (`flow.google.com`) directly from their authenticated personal Google Account.

---

## ✨ Features

- **🍌 Nano Banana 2.1 & Pro Image Generation:** 0 credits consumed (unlimited free tier). Supports `16:9`, `1:1`, `9:16`, `4:3`, `3:4` aspect ratios and batch quantities (`x1`..`x4`).
- **🎬 Omni 1.1 Flash Video Generation:** High-fidelity video generation using Google Flow's flagship Omni model with configurable durations (`4s`, `6s`, `8s`, `10s`) and resolutions (`720p`, `360p`).
- **🚀 100% Dedicated & Self-Contained:** Includes its own dedicated Chrome extension (`extension/`) and internal bridge. Zero dependency on external tools or macro clicking.
- **⚡ Native CDP Execution:** Injects text and submits generations with Chrome DevTools Protocol in milliseconds.
- **💾 Automatic Asset Download:** Downloads generated PNG images and MP4 videos directly into your workspace.
- **🖥️ Dual Interface:** Full MCP Server toolset + standalone CLI (`bin/flow-cli.js`).

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│ AI Coding Agent (Cursor / AGY) │
└────────────────┬────────────────┘
                 │ stdio (MCP Protocol)
                 ▼
┌─────────────────────────────────┐
│       google-flow-mcp           │
│  WebSocket Server (:9333)       │
└────────────────┬────────────────┘
                 │ ws://127.0.0.1:9333
                 ▼
┌─────────────────────────────────┐
│   Google Flow MCP Extension     │
│   (extension/manifest.json)     │
└────────────────┬────────────────┘
                 │ Chrome DevTools Protocol
                 ▼
┌─────────────────────────────────┐
│   User's Real Google Chrome     │
│   (https://flow.google.com)     │
│   - Google Session & Cookies    │
│   - reCAPTCHA Enterprise VM     │
│   - Free Nano Banana Generations│
└─────────────────────────────────┘
```

---

## 🚀 Quickstart

### 1. Load the Dedicated Chrome Extension

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `extension/` folder inside this repository:
   ```
   google-flow-mcp/extension
   ```
4. Pin the extension. When the MCP server or CLI is running, the extension badge will show a green **ON**.

### 2. Open Google Flow

Open a tab in Chrome and go to [https://flow.google.com/](https://flow.google.com/) with your logged-in Google Account.

### 3. Install Dependencies

```bash
npm install
```

---

## 🛠️ MCP Configuration

Add `google-flow-mcp` to your MCP configuration file (e.g., `mcp_config.json` in Antigravity, Claude Code, or Cursor):

```json
{
  "mcpServers": {
    "google-flow": {
      "command": "node",
      "args": [
        "/path/to/google-flow-mcp/src/index.js"
      ]
    }
  }
}
```

---

## 🧰 Available MCP Tools

### `flow_generate_image`
Generates high-resolution images using Nano Banana models (0 credits):
- `prompt` *(string, required)*: Description of the image.
- `model` *(string)*: `"Nano Banana 2.1"` (default) or `"Nano Banana Pro"`.
- `ratio` *(string)*: `"16:9"` (default), `"1:1"`, `"9:16"`, `"4:3"`, `"3:4"`.
- `quantity` *(string)*: `"x1"` (default), `"x2"`, `"x3"`, `"x4"`.
- `output_folder` *(string)*: Directory where images will be saved.

### `flow_generate_video`
Generates cinematic videos using Omni 1.1 Flash:
- `prompt` *(string, required)*: Description of motion, camera action, and scene.
- `model` *(string)*: `"Omni 1.1 Flash"` (default).
- `duration` *(string)*: `"4s"` (default), `"6s"`, `"8s"`, `"10s"`.
- `resolution` *(string)*: `"720p"` (default) or `"360p"`.
- `ratio` *(string)*: `"16:9"` (default) or `"9:16"`.
- `quantity` *(string)*: `"x1"` (default).
- `output_folder` *(string)*: Directory where MP4 files will be saved.

### `flow_get_status`
Returns active project name, current Google Account email, and credit status.

### `flow_list_canvas_assets`
Lists all generated images and videos on the canvas with direct signed CDN URLs.

---

## 💻 CLI Usage

You can also run generations directly from your terminal:

```bash
# Check status
node bin/flow-cli.js status

# Generate image (0 credits)
node bin/flow-cli.js image "a cybernetic golden eagle soaring over neon clouds, 8k"

# Generate video
node bin/flow-cli.js video "cinematic drone flight through a futuristic glass metropolis at dusk"

# List canvas assets
node bin/flow-cli.js assets
```

---

## 📄 License

MIT
