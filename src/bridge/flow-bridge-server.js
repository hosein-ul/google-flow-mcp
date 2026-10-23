import { WebSocketServer } from 'ws';

const PORT = 9333;

export class FlowBridgeServer {
  constructor() {
    this.wss = null;
    this.activeWs = null;
    this.pendingRequests = new Map();
    this._initServer();
  }

  _initServer() {
    try {
      this.wss = new WebSocketServer({ port: PORT });
      console.error(`[google-flow-mcp] Bridge WebSocket listening on ws://127.0.0.1:${PORT}`);

      this.wss.on('connection', (ws) => {
        console.error('[google-flow-mcp] Chrome extension connected!');
        this.activeWs = ws;

        ws.on('message', (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'handshake') {
              console.error(`[google-flow-mcp] Extension handshake v${msg.version}`);
              return;
            }

            if (msg.id && this.pendingRequests.has(msg.id)) {
              const { resolve, reject } = this.pendingRequests.get(msg.id);
              this.pendingRequests.delete(msg.id);
              if (msg.success === false) {
                reject(new Error(msg.error || 'Extension action failed'));
              } else {
                resolve(msg.data);
              }
            }
          } catch (e) {
            console.error('[google-flow-mcp] Error handling extension message:', e);
          }
        });

        ws.on('close', () => {
          console.error('[google-flow-mcp] Chrome extension disconnected.');
          if (this.activeWs === ws) {
            this.activeWs = null;
          }
        });

        ws.on('error', (err) => {
          console.error('[google-flow-mcp] WebSocket error:', err.message);
        });
      });

      this.wss.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.error(`[google-flow-mcp] Port ${PORT} already in use, assuming active bridge server.`);
        } else {
          console.error('[google-flow-mcp] WSS error:', err);
        }
      });
    } catch (e) {
      console.error('[google-flow-mcp] Server init error:', e.message);
    }
  }

  isConnected() {
    return this.activeWs !== null && this.activeWs.readyState === 1; // 1 = OPEN
  }

  async waitForConnection(timeoutMs = 5000) {
    if (this.isConnected()) return true;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.isConnected()) return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }

  async send(action, params = {}, timeoutMs = 25000) {
    const connected = await this.waitForConnection(3000);
    if (!connected) {
      throw new Error(
        'Google Flow MCP Bridge extension is not connected.\n' +
        'Please open Google Chrome and make sure the "Google Flow MCP Bridge" extension is enabled.'
      );
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout waiting for extension response to action: ${action}`));
        }
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (data) => {
          clearTimeout(timer);
          resolve(data);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        }
      });

      this.activeWs.send(JSON.stringify({ id, action, params }));
    });
  }

  async evaluate(code) {
    return this.send('eval', { code });
  }

  async cdp(method, commandParams = {}) {
    return this.send('cdp', { method, commandParams });
  }

  async getTabs() {
    return this.send('tabs');
  }

  async ensureFlowTab() {
    const tabs = await this.getTabs().catch(() => []);
    const flowTab = tabs.find(t => t.url && t.url.includes('flow.google.com'));
    if (flowTab) return flowTab;

    await this.send('open', { url: 'https://flow.google.com/' });
    await new Promise(r => setTimeout(r, 2500));
    return true;
  }
}

// Global singleton instance
let instance = null;
export function getBridgeServer() {
  if (!instance) {
    instance = new FlowBridgeServer();
  }
  return instance;
}
