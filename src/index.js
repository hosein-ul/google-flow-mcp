#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

import { FlowController } from './bridge/flow-controller.js';
import path from 'path';
import os from 'os';

const server = new Server(
  {
    name: 'google-flow-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const controller = new FlowController();
const DEFAULT_OUTPUT_DIR = path.join(os.homedir(), '.gemini', 'antigravity', 'scratch', 'flow_output');

const TOOLS = [
  {
    name: 'flow_generate_image',
    description: 'Generate high-resolution images using Google Flow (Nano Banana 2.1 / Nano Banana Pro) on your authenticated Google account (0 credits consumed). Downloads generated images directly to your workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed description of the image to generate.'
        },
        model: {
          type: 'string',
          enum: ['Nano Banana 2.1', 'Nano Banana Pro'],
          description: 'Image model family. Default is "Nano Banana 2.1".',
          default: 'Nano Banana 2.1'
        },
        ratio: {
          type: 'string',
          enum: ['16:9', '1:1', '9:16', '4:3', '3:4'],
          description: 'Aspect ratio. Default is "16:9".',
          default: '16:9'
        },
        quantity: {
          type: 'string',
          enum: ['x1', 'x2', 'x3', 'x4'],
          description: 'Number of variations to generate simultaneously (0 credits). Default is "x1".',
          default: 'x1'
        },
        output_folder: {
          type: 'string',
          description: 'Directory where images should be saved. Defaults to scratch/flow_output.',
          default: DEFAULT_OUTPUT_DIR
        },
        timeout_seconds: {
          type: 'number',
          description: 'Maximum seconds to wait for generation. Default 90.',
          default: 90
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'flow_generate_video',
    description: 'Generate cinematic videos using Google Flow with the Omni 1.1 Flash model from your authenticated Google account. Downloads MP4 video directly to disk.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed prompt describing the scene, motion, lighting, and camera action.'
        },
        model: {
          type: 'string',
          enum: ['Omni 1.1 Flash'],
          description: 'Video model. Default is "Omni 1.1 Flash".',
          default: 'Omni 1.1 Flash'
        },
        duration: {
          type: 'string',
          enum: ['4s', '6s', '8s', '10s'],
          description: 'Duration of the generated video. Default is "4s".',
          default: '4s'
        },
        resolution: {
          type: 'string',
          enum: ['720p', '360p'],
          description: 'Video resolution. Default is "720p".',
          default: '720p'
        },
        ratio: {
          type: 'string',
          enum: ['16:9', '9:16'],
          description: 'Aspect ratio. Default is "16:9".',
          default: '16:9'
        },
        quantity: {
          type: 'string',
          enum: ['x1', 'x2', 'x3', 'x4'],
          description: 'Number of video variations. Default is "x1" (12 credits).',
          default: 'x1'
        },
        output_folder: {
          type: 'string',
          description: 'Directory where MP4 video will be saved.',
          default: DEFAULT_OUTPUT_DIR
        },
        timeout_seconds: {
          type: 'number',
          description: 'Maximum seconds to wait for video rendering. Default 180.',
          default: 180
        }
      },
      required: ['prompt']
    }
  },
  {
    name: 'flow_get_status',
    description: 'Check active Google Flow project title, current account email, and generation status.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'flow_list_canvas_assets',
    description: 'List all generated images and videos currently visible on the Google Flow canvas with their CDN URLs and dimensions.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'flow_generate_image': {
        const result = await controller.generateImage({
          prompt: args.prompt,
          model: args.model || 'Nano Banana 2.1',
          ratio: args.ratio || '16:9',
          quantity: args.quantity || 'x1',
          outputFolder: args.output_folder || DEFAULT_OUTPUT_DIR,
          timeoutSeconds: args.timeout_seconds || 90
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'flow_generate_video': {
        const result = await controller.generateVideo({
          prompt: args.prompt,
          model: args.model || 'Omni 1.1 Flash',
          duration: args.duration || '4s',
          resolution: args.resolution || '720p',
          ratio: args.ratio || '16:9',
          quantity: args.quantity || 'x1',
          outputFolder: args.output_folder || DEFAULT_OUTPUT_DIR,
          timeoutSeconds: args.timeout_seconds || 180
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'flow_get_status': {
        const result = await controller.getStatus();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'flow_list_canvas_assets': {
        const result = await controller.getCanvasAssets();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Google Flow error: ${error.message}`,
        },
      ],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[google-flow-mcp] Server running on stdio');
}

run().catch((error) => {
  console.error('[google-flow-mcp] Fatal error:', error);
  process.exit(1);
});
