/**
 * Logger for google-flow-mcp
 * Writes to stderr to preserve stdout for JSON-RPC protocol messages.
 */
export const logger = {
  info: (msg, data = {}) => {
    const extra = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    console.error(`[${new Date().toISOString()}] [INFO] ${msg}${extra}`);
  },
  warn: (msg, data = {}) => {
    const extra = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    console.error(`[${new Date().toISOString()}] [WARN] ${msg}${extra}`);
  },
  error: (msg, err = {}) => {
    const errDetails = err instanceof Error ? { message: err.message, stack: err.stack } : err;
    console.error(`[${new Date().toISOString()}] [ERROR] ${msg} ${JSON.stringify(errDetails)}`);
  },
  debug: (msg, data = {}) => {
    if (process.env.DEBUG) {
      const extra = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
      console.error(`[${new Date().toISOString()}] [DEBUG] ${msg}${extra}`);
    }
  }
};
