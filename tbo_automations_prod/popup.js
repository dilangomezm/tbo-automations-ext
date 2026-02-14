// popup.js
const $ = (sel) => document.querySelector(sel);

const listEl = $("#automationList");
const statusEl = $("#status");
const refreshBtn = $("#refreshBtn");

// Storage key for user-defined order (by automation id)
const ORDER_KEY = "tbo_automations_order_v1";

function setStatus(msg, cls = "") {
  statusEl.className = `status ${cls}`.trim();
  statusEl.textContent = msg || "";
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ping(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: "TBO_PING" });
    return !!(res && res.ok);
  } catch {
    return false;
  }
}

async function listAutomations() {
  const tab = await getActiveTab();
  if (!tab || !tab.id) throw new Error("No active tab");
  const ok = await ping(tab.id);
  if (!ok) throw new Error("TBO page not ready (reload the TBO tab)");

  const res = await chrome.tabs.sendMessage(tab.id, { type: "TBO_LIST_AUTOMATIONS" });
  if (!res || !res.ok) throw new Error(res?.error || "Could not list automations");
  return res.automations || [];
}

async function runAutomation(id) {
  const tab = await getActiveTab();
  if (!tab || !tab.id) throw new Error("No active tab");
  const res = await chrome.tabs.sendMessage(tab.id, { type: "TBO_RUN_AUTOMATION", id });
  if (!res || !res.ok) throw new Error(res?.error || "Automation failed");
}

// -------- Order persistence --------
async function loadOrder() {
  try {
    const data = await chrome.storage.local.get(ORDER_KEY);
    const arr = data?.[ORDER_KEY];
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function saveOrder(orderIds) {
  try {
    await chrome.storage.local.set({ [ORDER_KEY]: Array.isArray(orderIds) ? orderIds : [] });
  } catch {}
}

function orderAutomations(autos, orderIds) {
  const byId = new Map(autos.map((a) => [a.id, a]));
  const ordered = [];

  // 1) Add those in saved order if still exist
  for (const id of orderIds || []) {
    const a = byId.get(id);
    if (a) {
      ordered.push(a);
      byId.delete(id);
    }
  }

  // 2) Append the rest (new automations) in current received order
  for (const a of autos) {
    if (byId.has(a.id)) ordered.push(a);
  }

  return ordered;
}

function getDomOrderIds() {
  return Array.from(listEl.querySelectorAll(".item[data-auto-id]"))
    .map((el) => el.getAttribute("data-auto-id"))
    .filter(Boolean);
}

// -------- Drag & drop --------
let draggedEl = null;

function attachDnD(row) {
  row.setAttribute("draggable", "true");

  row.addEventListener("dragstart", (e) => {
    draggedEl = row;
    row.classList.add("dragging");
    // Needed for Firefox-like behavior
    e.dataTransfer?.setData("text/plain", row.getAttribute("data-auto-id") || "");
    e.dataTransfer && (e.dataTransfer.effectAllowed = "move");
  });

  row.addEventListener("dragend", async () => {
    row.classList.remove("dragging");
    draggedEl = null;
    await saveOrder(getDomOrderIds());
  });

  row.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (!draggedEl || draggedEl === row) return;
    e.dataTransfer && (e.dataTransfer.dropEffect = "move");

    const rect = row.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;

    if (before) {
      if (listEl.firstChild !== draggedEl && row.previousSibling !== draggedEl) {
        listEl.insertBefore(draggedEl, row);
      } else {
        listEl.insertBefore(draggedEl, row);
      }
    } else {
      // insert after row
      const next = row.nextSibling;
      if (next !== draggedEl) listEl.insertBefore(draggedEl, next);
    }
  });

  row.addEventListener("drop", (e) => {
    e.preventDefault();
  });
}

function renderAutomationRow(a) {
  const row = document.createElement("div");
  row.className = "item";
  row.setAttribute("data-auto-id", a.id);

  const left = document.createElement("div");
  left.className = "item-left";
  left.innerHTML = `
    <div class="item-name">${a.name}</div>
  `;

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Run";
  btn.onclick = async () => {
    setStatus("", "");
    btn.disabled = true;
    btn.textContent = "…";
    try {
      await runAutomation(a.id);
    } catch (e) {
      setStatus(String(e.message || e), "err");
    } finally {
      btn.disabled = false;
      btn.textContent = "Run";
    }
  };

  row.appendChild(left);
  row.appendChild(btn);

  // Make row draggable
  attachDnD(row);

  return row;
}

async function refresh() {
  setStatus("", "");
  listEl.innerHTML = "";

  try {
    const autos = await listAutomations();
    if (!autos.length) {
      setStatus("No automations found.", "");
      return;
    }

    const savedOrder = await loadOrder();
    const ordered = orderAutomations(autos, savedOrder);

    ordered.forEach((a) => listEl.appendChild(renderAutomationRow(a)));

    // If we got new automations, update stored order to include them (without moving user order)
    const currentIds = ordered.map((a) => a.id);
    const normalizedSaved = orderAutomations(
      ordered, // already ordered
      savedOrder
    ).map((a) => a.id);

    // If mismatch, save the current visible order (this will append new ones at end)
    const same =
      normalizedSaved.length === currentIds.length &&
      normalizedSaved.every((id, i) => id === currentIds[i]);

    if (!same) {
      await saveOrder(currentIds);
    }
  } catch (e) {
    setStatus(String(e.message || e), "err");
  }
}

refreshBtn.onclick = refresh;
refresh();

