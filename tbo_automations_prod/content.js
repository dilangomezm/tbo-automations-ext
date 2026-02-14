// content.js
(() => {
  const LOG = "[TBO EXT]";

  if (window.__tboAutomationRegistry) {
    console.log(LOG, "content.js already initialized");
    return;
  }

  const registry = new Map();

  // Comparador robusto para textos UI
  function labelLocaleCompare(a, b) {
    a = (a || "").toString().trim().toLowerCase();
    b = (b || "").toString().trim().toLowerCase();
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  }

  function registerAutomation(id, meta, fn) {
    if (!id || typeof fn !== "function") return;
    const name = (meta && meta.name) ? meta.name : id;
    registry.set(id, { id, name, fn });
    console.log(LOG, "Registered automation:", id, name);
  }

  async function runAutomation(id) {
    const item = registry.get(id);
    if (!item) return { ok: false, error: `Automation not found: ${id}` };

    try {
      // ctx placeholder for future (popup can pass config later)
      const ctx = {};
      const res = item.fn(ctx);
      if (res && typeof res.then === "function") await res;
      return { ok: true };
    } catch (e) {
      console.error(LOG, "Automation error:", id, e);
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  function listAutomations() {
    return Array.from(registry.values())
      .map((a) => ({ id: a.id, name: a.name }))
      .sort((x, y) => labelLocaleCompare(x.name, y.name));
  }

  window.__tboAutomationRegistry = registry;
  window.registerAutomation = registerAutomation;
  window.labelLocaleCompare = labelLocaleCompare;
  window.__tboListAutomations = listAutomations;
  window.__tboRunAutomation = runAutomation;

  console.log(LOG, "content.js loaded");

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    try {
      if (!msg || !msg.type) return;

      if (msg.type === "TBO_LIST_AUTOMATIONS") {
        sendResponse({ ok: true, automations: listAutomations() });
        return;
      }

      if (msg.type === "TBO_RUN_AUTOMATION") {
        runAutomation(msg.id).then((result) => sendResponse(result));
        return true;
      }

      if (msg.type === "TBO_PING") {
        sendResponse({ ok: true, pong: true });
        return;
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  });
})();
