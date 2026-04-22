// combinedAssistant.js
registerAutomation("alerts_assistant", { name: "Alerts Assistant" }, function () {
  // Remover paneles anteriores para evitar duplicados
  const oldPanel1 = document.getElementById("alertToolPanel");
  if (oldPanel1) oldPanel1.remove();
  const oldPanel2 = document.getElementById("cancellationToolPanel");
  if (oldPanel2) oldPanel2.remove();

  const ORANGE = "#ff7a00";
  const ORANGE_DARK = "#c55b00";
  const BG = "#0f141a";
  const CARD = "#151b22";
  const BORDER = "rgba(255,255,255,0.08)";
  const TEXT = "#e6edf3";
  const MUTED = "#9aa7b2";

  // Variables de estado
  let currentMode = "alerts"; // "alerts" o "cancellations"
  let secretClicks = 0;
  let secretTimer = null;
  let secretUnlocked = false;

  // --- Helpers de Material UI ---
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
  
  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };

  const waitFor = async (fn, { timeout = 8000, interval = 150 } = {}) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const v = typeof fn === "function" ? fn() : null;
      if (v) return v;
      await sleep(interval);
    }
    return null;
  };

  const clickEl = (el) => {
    if (!el) return false;
    try { el.scrollIntoView?.({ block: "center", inline: "center" }); } catch {}
    const evInit = { bubbles: true, cancelable: true, view: window };
    ["pointerdown", "mousedown", "mouseup", "click"].forEach((t) => {
      try { el.dispatchEvent(new MouseEvent(t, evInit)); } catch {}
    });
    try { el.click(); } catch {}
    return true;
  };

  const getVisibleListboxes = () =>
    Array.from(document.querySelectorAll('ul[role="listbox"]')).filter(isVisible);

  const findOptionInListbox = (lb, containsOrExact) => {
    const opts = Array.from(lb.querySelectorAll('li[role="option"], li')).filter(isVisible);
    const needle = norm(containsOrExact);
    let opt = opts.find((o) => norm(o.textContent) === needle);
    if (opt) return opt;
    opt = opts.find((o) => norm(o.textContent).includes(needle));
    return opt || null;
  };

  const pickFromAnyListbox = async (text, { timeout = 7000 } = {}) => {
    const start = Date.now();
    const needleFull = norm(text);
    while (Date.now() - start < timeout) {
      const listboxes = getVisibleListboxes();
      for (const lb of listboxes) {
        let opt = findOptionInListbox(lb, needleFull);
        if (opt) {
          clickEl(opt);
          await sleep(250);
          return true;
        }
        const maxScrolls = 12;
        let sc = 0;
        while (sc < maxScrolls && lb.scrollHeight > lb.clientHeight) {
          lb.scrollTop = Math.min(lb.scrollTop + lb.clientHeight, lb.scrollHeight);
          await sleep(120);
          opt = findOptionInListbox(lb, needleFull);
          if (opt) {
            clickEl(opt);
            await sleep(250);
            return true;
          }
          sc++;
        }
      }
      await sleep(150);
    }
    return false;
  };

  const selectDropdownValue = async (triggerEl, optionText) => {
    clickEl(triggerEl);
    const opened = await waitFor(() => (getVisibleListboxes().length ? true : null), {
      timeout: 5000,
      interval: 120,
    });
    if (!opened) return false;
    return await pickFromAnyListbox(optionText, { timeout: 7000 });
  };

  // --- UI Setup ---
  const panel = document.createElement("div");
  panel.id = "alertToolPanel";
  panel.style.position = "fixed";
  panel.style.top = "120px";
  panel.style.right = "40px";
  panel.style.width = "300px";
  panel.style.background = CARD;
  panel.style.border = `1px solid ${BORDER}`;
  panel.style.zIndex = "999999";
  panel.style.borderRadius = "12px";
  panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
  panel.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  panel.style.color = TEXT;
  document.body.appendChild(panel);

  const dragBar = document.createElement("div");
  dragBar.style.width = "100%";
  dragBar.style.height = "36px";
  dragBar.style.background = "linear-gradient(90deg, rgba(255,122,0,0.22), rgba(255,122,0,0.05))";
  dragBar.style.borderBottom = `1px solid ${BORDER}`;
  dragBar.style.display = "flex";
  dragBar.style.alignItems = "center";
  dragBar.style.justifyContent = "space-between";
  dragBar.style.cursor = "grab";
  dragBar.style.padding = "0 10px";
  dragBar.style.borderTopLeftRadius = "12px";
  dragBar.style.borderTopRightRadius = "12px";
  dragBar.style.boxSizing = "border-box";
  panel.appendChild(dragBar);

  const title = document.createElement("span");
  title.innerText = "Alerts Assistant";
  title.style.fontWeight = "700";
  title.style.fontSize = "12px";
  title.style.letterSpacing = "0.3px";
  title.style.userSelect = "none"; // Evita que se seleccione el texto al dar los 4 clics
  dragBar.appendChild(title);

  // Lógica del Botón Secreto (4 clics en el título)
  title.onclick = () => {
    secretClicks++;
    clearTimeout(secretTimer);
    if (secretClicks >= 4) {
      secretUnlocked = true;
      secretClicks = 0;
      if (inner.style.display !== "none") showMainMenu();
    }
    secretTimer = setTimeout(() => { secretClicks = 0; }, 1500);
  };

  // Contenedor para botones de control (Minimizar y Cerrar)
  const controls = document.createElement("div");
  controls.style.display = "flex";
  controls.style.gap = "6px";
  dragBar.appendChild(controls);

  const toggleBtn = document.createElement("button");
  toggleBtn.innerText = "—";
  toggleBtn.style.cursor = "pointer";
  toggleBtn.style.fontWeight = "700";
  toggleBtn.style.fontSize = "14px";
  toggleBtn.style.width = "26px";
  toggleBtn.style.height = "22px";
  toggleBtn.style.borderRadius = "6px";
  toggleBtn.style.border = `1px solid ${BORDER}`;
  toggleBtn.style.background = "transparent";
  toggleBtn.style.color = TEXT;
  controls.appendChild(toggleBtn);

  // BOTÓN "X"
  const closeBtnTop = document.createElement("button");
  closeBtnTop.id = "qbbClose";
  closeBtnTop.title = "Close";
  closeBtnTop.innerHTML = "✕";
  closeBtnTop.style.width = "26px";
  closeBtnTop.style.height = "22px";
  closeBtnTop.style.borderRadius = "8px";
  closeBtnTop.style.border = "1px solid rgba(255,255,255,0.10)";
  closeBtnTop.style.background = "rgba(255,255,255,0.02)";
  closeBtnTop.style.color = "#e6e8ee";
  closeBtnTop.style.fontWeight = "650";
  closeBtnTop.style.cursor = "pointer";
  closeBtnTop.onclick = () => panel.remove();
  controls.appendChild(closeBtnTop);

  const inner = document.createElement("div");
  inner.style.padding = "12px";
  panel.appendChild(inner);

  function setPanelHTML(html) {
    inner.innerHTML = html;
  }

  let minimized = false;
  toggleBtn.onclick = () => {
    minimized = !minimized;
    inner.style.display = minimized ? "none" : "block";
    toggleBtn.innerText = minimized ? "+" : "—";
  };

  // Drag logic
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  dragBar.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    isDragging = true;
    dragBar.style.cursor = "grabbing";
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panel.style.left = `${e.clientX - offsetX}px`;
    panel.style.top = `${e.clientY - offsetY}px`;
    panel.style.right = "auto";
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
    dragBar.style.cursor = "grab";
  });

  // --- Lógicas de Ejecución ---
  function assignAlerts(keyword) {
    let assigned = 0;
    const rows = document.querySelectorAll("table tbody tr");
    rows.forEach(row => {
      if (row.innerText.toLowerCase().includes(keyword)) {
        const btn = row.querySelector('button[data-testid="assign-to-me-button"]');
        if (btn) { btn.click(); assigned++; }
      }
    });
    alert(`✔ ${assigned} alerts assigned.`);
  }

  async function closeAlerts(keyword) {
    let closed = 0;
    const rows = document.querySelectorAll("table tbody tr");
    for (const row of rows) {
      if (!row.innerText.toLowerCase().includes(keyword)) continue;
      const menuBtn = row.querySelector('.MuiIconButton-root');
      if (!menuBtn) continue;
      menuBtn.click();
      await sleep(150);
      const closeOpt = [...document.querySelectorAll(".MuiTypography-root")].find(el => el.innerText.trim().toLowerCase() === "close");
      if (closeOpt) { closeOpt.click(); closed++; }
      await sleep(200);
    }
    alert(`✔ ${closed} alerts closed.`);
  }

  async function processHandleForNode(row) {
    const menuBtn = row.querySelector('.MuiIconButton-root');
    if (!menuBtn) return false;
    clickEl(menuBtn);
    await sleep(300);
    const handleOption = document.querySelector('[data-testid="cancellationsHandle"]');
    if (handleOption) {
      clickEl(handleOption);
      await waitFor(() => document.querySelector('.MuiDialog-container'), { timeout: 8000, interval: 150 }); 
      const dialog = document.querySelector('.MuiDialog-container');
      if (!dialog) { document.body.click(); return false; }
      const reasonDropdown = dialog.querySelector('#reasonSelectProp');
      if (reasonDropdown) {
        const success = await selectDropdownValue(reasonDropdown, "NO_RESULT_ASSIGNABLE");
        if (!success) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }
      const confirmAllBtn = dialog.querySelector('[data-testid="confirm-all-checkbox"]');
      if (confirmAllBtn) {
        const checkbox = confirmAllBtn.querySelector('input');
        if (checkbox) checkbox.click(); else confirmAllBtn.click();
        await sleep(500);
      }
      const saveBtn = dialog.querySelector('[data-testid="multistatePopupSave"]');
      if (saveBtn && !saveBtn.disabled) {
        saveBtn.click();
        await sleep(2000); 
        const closeAlertBtn = document.querySelector('[data-testid="multistatePopupCloseAlert"]');
        if (closeAlertBtn && !closeAlertBtn.disabled) { closeAlertBtn.click(); await sleep(2000); }
        else { const cX = document.querySelector('[data-testid="dialog-popup-title-close-button"]'); if (cX) cX.click(); await sleep(2000); }
      } else {
        const closeAlertBtn = dialog.querySelector('[data-testid="multistatePopupCloseAlert"]');
        if (closeAlertBtn && !closeAlertBtn.disabled) { closeAlertBtn.click(); await sleep(2000); }
        else { const cX = dialog.querySelector('[data-testid="dialog-popup-title-close-button"]'); if (cX) cX.click(); await sleep(2000); }
      }
      return true;
    }
    document.body.click(); return false;
  }

  // --- UI Y MENÚS ---
  function btnPrimary(id, text) {
    return `<button id="${id}" style="width:100%; margin-bottom:8px; padding:9px 10px; border-radius:9px; border:1px solid rgba(255,122,0,0.35); background:linear-gradient(90deg, rgba(255,122,0,0.22), rgba(255,122,0,0.08)); color:${TEXT}; font-weight:700; cursor:pointer; font-size:12px;">${text}</button>`;
  }
  function btnSecondary(id, text) {
    return `<button id="${id}" style="width:100%; margin-bottom:8px; padding:9px 10px; border-radius:9px; border:1px solid ${BORDER}; background:rgba(255,255,255,0.03); color:${TEXT}; cursor:pointer; font-size:12px;">${text}</button>`;
  }
  function btnDanger(id, text) {
    return `<button id="${id}" style="width:100%; margin-top:8px; padding:9px 10px; border-radius:9px; border:1px solid rgba(255,0,0,0.5); background:linear-gradient(90deg, #d32f2f, #b71c1c); color:#ffffff; font-weight:700; cursor:pointer; font-size:12px;">${text}</button>`;
  }

  function showMainMenu() {
    const isAlerts = currentMode === "alerts";
    title.innerText = isAlerts ? "Alerts Assistant" : "Cancellations Assistant";
    
    let htmlContent = `
      ${btnPrimary("assignBtn", isAlerts ? "Assign alerts by keyword" : "Assign Cancellations by keyword")}
      ${btnSecondary("closeBtn", isAlerts ? "Close alerts by keyword" : "Close Cancellations by keyword")}
      ${btnPrimary("closeAssignedBtn", isAlerts ? "Close assigned alerts" : "Close Assigned Cancellations")}
    `;

    if (secretUnlocked) {
      htmlContent += btnDanger("secretSwitchBtn", isAlerts ? "Cancellations Assistant" : "Alerts Assistant");
    }

    setPanelHTML(htmlContent);

    document.getElementById("assignBtn").onclick = showAssignMenu;
    document.getElementById("closeBtn").onclick = showCloseMenu;
    document.getElementById("closeAssignedBtn").onclick = async () => {
      if (isAlerts) {
          let closed = 0;
          const rows = document.querySelectorAll("table tbody tr");
          for (const row of rows) {
              if (row.querySelector('button[data-testid="assign-to-me-button"]')) continue;
              const menuBtn = row.querySelector('.MuiIconButton-root');
              if (!menuBtn) continue;
              menuBtn.click(); await sleep(150);
              const closeOpt = [...document.querySelectorAll(".MuiTypography-root")].find(el => el.innerText.trim().toLowerCase() === "close");
              if (closeOpt) { closeOpt.click(); closed++; }
              await sleep(200);
          }
          alert(`✔ ${closed} assigned alerts closed.`);
      } else {
          let closed = 0;
          const rows = document.querySelectorAll("table tbody tr");
          for (const row of rows) {
              if (row.querySelector('button[data-testid="assign-to-me-button"]')) continue;
              const success = await processHandleForNode(row);
              if (success) closed++;
          }
          alert(`✔ ${closed} assigned cancellations handled.`);
      }
      showMainMenu();
    };

    if (secretUnlocked) {
      document.getElementById("secretSwitchBtn").onclick = () => {
        currentMode = isAlerts ? "cancellations" : "alerts";
        secretUnlocked = false; 
        showMainMenu();
      };
    }
    createRowButtons(inner);
  }

  function showAssignMenu() {
    const isAlerts = currentMode === "alerts";
    setPanelHTML(`
      <div style="font-weight:700; font-size:12px; margin-bottom:8px;">${isAlerts ? "Assign alerts" : "Assign Cancellations"}</div>
      <input id="assignKeyword" type="text" placeholder="Keyword" style="width:100%; padding:8px; border-radius:8px; border:1px solid ${BORDER}; background:${BG}; color:${TEXT}; font-size:12px; box-sizing:border-box;"><br><br>
      ${btnPrimary("confirmAssign", "Assign")}
      ${btnSecondary("backAssign", "← Back")}
    `);
    document.getElementById("backAssign").onclick = showMainMenu;
    document.getElementById("confirmAssign").onclick = () => {
      const keyword = document.getElementById("assignKeyword").value.toLowerCase().trim();
      if (!keyword) return alert("Enter a keyword.");
      if (isAlerts) assignAlerts(keyword); else {
          let assigned = 0;
          const rows = document.querySelectorAll("table tbody tr");
          rows.forEach(row => { if (row.innerText.toLowerCase().includes(keyword)) {
              const btn = row.querySelector('button[data-testid="assign-to-me-button"]');
              if (btn) { btn.click(); assigned++; }
          }});
          alert(`✔ ${assigned} cancellations assigned.`);
      }
      showMainMenu();
    };
  }

  function showCloseMenu() {
    const isAlerts = currentMode === "alerts";
    setPanelHTML(`
      <div style="font-weight:700; font-size:12px; margin-bottom:8px;">${isAlerts ? "Close alerts" : "Close Cancellations"}</div>
      <input id="closeKeyword" type="text" placeholder="Keyword" style="width:100%; padding:8px; border-radius:8px; border:1px solid ${BORDER}; background:${BG}; color:${TEXT}; font-size:12px; box-sizing:border-box;"><br><br>
      ${btnPrimary("confirmClose", "Close")}
      ${btnSecondary("backClose", "← Back")}
    `);
    document.getElementById("backClose").onclick = showMainMenu;
    document.getElementById("confirmClose").onclick = async () => {
      const keyword = document.getElementById("closeKeyword").value.toLowerCase().trim();
      if (!keyword) return alert("Enter a keyword.");
      if (isAlerts) await closeAlerts(keyword); else {
          let closed = 0;
          const rows = document.querySelectorAll("table tbody tr");
          for (const row of rows) { if (row.innerText.toLowerCase().includes(keyword)) {
              const success = await processHandleForNode(row);
              if (success) closed++;
          }}
          alert(`✔ ${closed} cancellations handled.`);
      }
      showMainMenu();
    };
  }

  function createRowButtons(container) {
    const sep = document.createElement("div"); sep.style.height = "10px"; container.appendChild(sep);
    const label = document.createElement("div"); label.innerText = "Rows per page"; label.style.cssText = "margin-bottom:6px; font-size:11px; font-weight:600; color:"+MUTED; container.appendChild(label);
    const rowContainer = document.createElement("div"); rowContainer.style.cssText = "display:flex; justify-content:space-between; gap:6px;";
    
    // AQUÍ ESTÁ LA ACTUALIZACIÓN: [50, 100, 300]
    [50, 100, 300].forEach(val => {
      const btn = document.createElement("button"); btn.innerText = val; btn.style.cssText = "flex:1; padding:6px 0; border-radius:8px; border:1px solid "+BORDER+"; background:rgba(255,255,255,0.03); cursor:pointer; font-size:11px; color:"+TEXT;
      btn.onmouseenter = () => btn.style.background = "rgba(255,122,0,0.12)";
      btn.onmouseleave = () => btn.style.background = "rgba(255,255,255,0.03)";
      btn.onclick = () => {
        const select = document.querySelector('select[aria-label="rows per page"]');
        if (!select) return alert("Rows-per-page selector not found.");
        let opt = [...select.options].find(o => o.value == val || o.text == String(val));
        if (!opt) { opt = document.createElement("option"); opt.value = String(val); opt.text = String(val); select.appendChild(opt); }
        select.value = String(val); select.dispatchEvent(new Event("change", { bubbles: true }));
      };
      rowContainer.appendChild(btn);
    });
    
    container.appendChild(rowContainer);
  }

  showMainMenu();
});
