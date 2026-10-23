// Google Flow MCP Bridge - Dedicated Background Service Worker (Manifest V3)
// Connects to local MCP WebSocket server at ws://127.0.0.1:9333
// Zero UI intrusion, zero cursor simulation, high-speed native CDP execution.

const MCP_WS_URL = "ws://127.0.0.1:9333";
const VERSION = "1.0.0";

let socket = null;
let reconnectTimer = null;
const attachedDebuggers = new Set();

function log(...args) {
  console.log("[FlowMCP:BG]", ...args);
}

function updateBadge(connected) {
  try {
    if (connected) {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#10b981" }); // Emerald
    } else {
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#64748b" }); // Slate
    }
  } catch (e) {}
}

async function getFlowTab() {
  const tabs = await chrome.tabs.query({});
  const flowTab = tabs.find(t => t.url && t.url.includes("flow.google.com"));
  if (flowTab) return flowTab;
  
  // Return current active tab if safe
  const activeTabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return activeTabs[0] || tabs[0] || null;
}

async function attachDebugger(tabId) {
  if (attachedDebuggers.has(tabId)) return true;
  try {
    await chrome.debugger.attach({ tabId }, "1.3");
    attachedDebuggers.add(tabId);
    return true;
  } catch (err) {
    if (err.message && err.message.includes("Already attached")) {
      attachedDebuggers.add(tabId);
      return true;
    }
    log(`CDP attach error on tab ${tabId}:`, err.message);
    return false;
  }
}

if (chrome.debugger) {
  chrome.debugger.onDetach.addListener((source) => {
    attachedDebuggers.delete(source.tabId);
  });
}

function connectToMcp() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  log(`Connecting to local Flow MCP server at ${MCP_WS_URL}...`);
  try {
    socket = new WebSocket(MCP_WS_URL);
  } catch (err) {
    scheduleReconnect();
    return;
  }

  socket.onopen = async () => {
    log("Connected to local Flow MCP server!");
    updateBadge(true);
    const tab = await getFlowTab();
    send({
      type: "handshake",
      version: VERSION,
      flowTab: tab ? { id: tab.id, title: tab.title, url: tab.url } : null
    });
  };

  socket.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleMessage(msg);
    } catch (err) {
      log("Error parsing message from MCP server:", err);
    }
  };

  socket.onclose = () => {
    updateBadge(false);
    scheduleReconnect();
  };

  socket.onerror = () => {
    if (socket) socket.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    connectToMcp();
  }, 2000);
}

function send(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

async function handleMessage(msg) {
  const { id, action, params = {} } = msg;

  if (action === "ping") {
    send({ id, success: true, data: "pong", version: VERSION });
    return;
  }

  if (action === "tabs") {
    const tabs = await chrome.tabs.query({});
    send({
      id,
      success: true,
      data: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, active: t.active }))
    });
    return;
  }

  if (action === "switch_tab") {
    try {
      const tabId = parseInt(params.tabId, 10);
      await chrome.tabs.update(tabId, { active: true });
      send({ id, success: true, data: { tabId } });
    } catch (err) {
      send({ id, success: false, error: err.message });
    }
    return;
  }

  if (action === "open") {
    try {
      const tab = await chrome.tabs.create({ url: params.url || "https://flow.google.com/", active: true });
      send({ id, success: true, data: { id: tab.id, url: tab.url } });
    } catch (err) {
      send({ id, success: false, error: err.message });
    }
    return;
  }

  if (action === "eval") {
    try {
      const tab = await getFlowTab();
      if (!tab) {
        send({ id, success: false, error: "No open Google Flow tab found." });
        return;
      }
      const attached = await attachDebugger(tab.id);
      if (!attached) {
        send({ id, success: false, error: `Could not attach debugger to tab ${tab.id}` });
        return;
      }
      chrome.debugger.sendCommand(
        { tabId: tab.id },
        "Runtime.evaluate",
        {
          expression: params.code || params.expression,
          returnByValue: true,
          awaitPromise: true
        },
        (result) => {
          if (chrome.runtime.lastError) {
            send({ id, success: false, error: chrome.runtime.lastError.message });
          } else if (result && result.exceptionDetails) {
            send({ id, success: false, error: result.exceptionDetails.exception?.description || result.exceptionDetails.text });
          } else {
            send({ id, success: true, data: result?.result?.value });
          }
        }
      );
    } catch (err) {
      send({ id, success: false, error: err.message });
    }
    return;
  }

  if (action === "cdp") {
    try {
      const tab = await getFlowTab();
      if (!tab) {
        send({ id, success: false, error: "No open Google Flow tab found." });
        return;
      }
      const attached = await attachDebugger(tab.id);
      if (!attached) {
        send({ id, success: false, error: `Could not attach debugger to tab ${tab.id}` });
        return;
      }
      chrome.debugger.sendCommand(
        { tabId: tab.id },
        params.method,
        params.commandParams || {},
        (result) => {
          if (chrome.runtime.lastError) {
            send({ id, success: false, error: chrome.runtime.lastError.message });
          } else {
            send({ id, success: true, data: result });
          }
        }
      );
    } catch (err) {
      send({ id, success: false, error: err.message });
    }
    return;
  }

  send({ id, success: false, error: `Unknown action: ${action}` });
}

// Keep Service Worker alive
if (chrome.alarms) {
  chrome.alarms.create("mcpKeepAlive", { periodInMinutes: 0.2 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "mcpKeepAlive") {
      chrome.runtime.getPlatformInfo(() => {});
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        connectToMcp();
      }
    }
  });
}

connectToMcp();
