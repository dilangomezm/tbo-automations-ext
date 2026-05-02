// combinedAssistant.js
registerAutomation("alerts_assistant", { name: "Alerts Assistant" }, function () {
  // Remover paneles anteriores para evitar duplicados
  const oldPanel1 = document.getElementById("alertToolPanel");
  if (oldPanel1) oldPanel1.remove();
  const oldPanel2 = document.getElementById("cancellationToolPanel");
  if (oldPanel2) oldPanel2.remove();

  /*****************************************************************
   * THEME (Standardized)
   *****************************************************************/
  const THEME = {
    CARD: "#13161d",
    BORDER: "rgba(255,255,255,0.10)",
    TEXT: "#e6e8ee",
    MUTED: "rgba(230,232,238,0.65)",
    ACCENT: "#f0a64a",
    ACCENT2: "#c88533",
    RADIUS: 14,
  };

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
  panel.style.top = "90px";
  panel.style.right = "24px";
  panel.style.width = "300px"; // Ancho ajustado a 300px
  panel.style.maxWidth = "92vw";
  panel.style.background = THEME.CARD;
  panel.style.border = `1px solid ${THEME.BORDER}`;
  panel.style.borderRadius = `${THEME.RADIUS}px`;
  panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
  panel.style.zIndex = "999999";
  panel.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  panel.style.color = THEME.TEXT;
  panel.style.overflow = "hidden";
  document.body.appendChild(panel);

  const header = document.createElement("div");
  header.style.height = "36px";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "0 10px";
  header.style.cursor = "grab";
  header.style.userSelect = "none";
  header.style.background = `linear-gradient(90deg, rgba(240,166,74,0.18), rgba(240,166,74,0.04))`;
  header.style.borderBottom = `1px solid ${THEME.BORDER}`;
  panel.appendChild(header);

  const titleContainer = document.createElement("div");
  titleContainer.style.display = "flex";
  titleContainer.style.alignItems = "center";
  titleContainer.style.gap = "10px";

  const title = document.createElement("div");
  title.innerText = "Alerts Assistant";
  title.style.fontWeight = "650";
  title.style.fontSize = "12px";
  title.style.letterSpacing = ".2px";
  title.style.color = THEME.TEXT;
  titleContainer.appendChild(title);
  header.appendChild(titleContainer);

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
  header.appendChild(controls);

  const minBtn = document.createElement("button");
  minBtn.title = "Minimize";
  minBtn.innerText = "−";
  minBtn.style.cssText = `
    width:26px; height:22px; border-radius:8px;
    border:1px solid ${THEME.BORDER};
    background:rgba(255,255,255,0.02);
    color:${THEME.TEXT}; font-weight:650; font-size:12px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; padding:0;
  `;
  minBtn.onmouseenter = () => minBtn.style.background = "rgba(255,255,255,0.05)";
  minBtn.onmouseleave = () => minBtn.style.background = "rgba(255,255,255,0.02)";
  controls.appendChild(minBtn);

  // BOTÓN "X"
  const closeBtnTop = document.createElement("button");
  closeBtnTop.title = "Close";
  closeBtnTop.innerText = "✕";
  closeBtnTop.style.cssText = `
    width:26px; height:22px; border-radius:8px;
    border:1px solid ${THEME.BORDER};
    background:rgba(255,255,255,0.02);
    color:${THEME.TEXT}; font-weight:650; font-size:12px; cursor:pointer;
    display:flex; align-items:center; justify-content:center; padding:0;
  `;
  closeBtnTop.onmouseenter = () => closeBtnTop.style.background = "rgba(255,255,255,0.05)";
  closeBtnTop.onmouseleave = () => closeBtnTop.style.background = "rgba(255,255,255,0.02)";
  closeBtnTop.onclick = () => panel.remove();
  controls.appendChild(closeBtnTop);

  const inner = document.createElement("div");
  inner.style.padding = "10px";
  panel.appendChild(inner);

  function setPanelHTML(html) {
    inner.innerHTML = html;
  }

  let minimized = false;
  minBtn.onclick = () => {
    minimized = !minimized;
    inner.style.display = minimized ? "none" : "block";
  };

  // Drag logic
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;
  header.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    isDragging = true;
    header.style.cursor = "grabbing";
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, e.clientX - offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY));
    panel.style.left = `${x}px`;
    panel.style.top = `${y}px`;
    panel.style.right = "auto";
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
    header.style.cursor = "grab";
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
    return `<button id="${id}" style="width:100%; margin-bottom:8px; padding:10px 12px; border-radius:12px; border:none; background:linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95)); color:#111; font-weight:650; cursor:pointer; font-size:12px;">${text}</button>`;
  }
  function btnSecondary(id, text) {
    return `<button id="${id}" style="width:100%; margin-bottom:8px; padding:10px 12px; border-radius:12px; border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); color:${THEME.TEXT}; font-weight:650; cursor:pointer; font-size:12px;">${text}</button>`;
  }
  function btnDanger(id, text) {
    return `<button id="${id}" style="width:100%; margin-top:8px; padding:10px 12px; border-radius:12px; border:none; background:linear-gradient(180deg, #d32f2f, #b71c1c); color:#ffffff; font-weight:650; cursor:pointer; font-size:12px;">${text}</button>`;
  }

  function showMainMenu() {
    const isAlerts = currentMode === "alerts";
    title.innerText = isAlerts ? "Alerts Assistant" : "Cancellations Assistant";
    
    let htmlContent = `
      <div style="border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); border-radius:${THEME.RADIUS}px; padding:10px; display:flex; flex-direction:column; gap:2px;">
        ${btnSecondary("assignBtn", isAlerts ? "Assign alerts by keyword" : "Assign Cancellations by keyword")}
        ${btnSecondary("closeBtn", isAlerts ? "Close alerts by keyword" : "Close Cancellations by keyword")}
        ${btnSecondary("closeAssignedBtn", isAlerts ? "Close assigned alerts" : "Close Assigned Cancellations")}
      </div>
    `;

    if (secretUnlocked) {
      htmlContent += btnDanger("secretSwitchBtn", isAlerts ? "Switch to Cancellations" : "Switch to Alerts");
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
      <div style="border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); border-radius:${THEME.RADIUS}px; padding:10px; display:flex; flex-direction:column; gap:2px;">
        <div style="font-weight:650; font-size:12px; margin-bottom:8px; color:${THEME.TEXT};">${isAlerts ? "Assign alerts" : "Assign Cancellations"}</div>
        <input id="assignKeyword" type="text" placeholder="Keyword" style="width:100%; padding:10px; border-radius:10px; border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); color:${THEME.TEXT}; font-size:12px; outline:none; box-sizing:border-box; margin-bottom:10px;">
        ${btnPrimary("confirmAssign", "Assign")}
        ${btnSecondary("backAssign", "← Back")}
      </div>
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
      <div style="border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); border-radius:${THEME.RADIUS}px; padding:10px; display:flex; flex-direction:column; gap:2px;">
        <div style="font-weight:650; font-size:12px; margin-bottom:8px; color:${THEME.TEXT};">${isAlerts ? "Close alerts" : "Close Cancellations"}</div>
        <input id="closeKeyword" type="text" placeholder="Keyword" style="width:100%; padding:10px; border-radius:10px; border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); color:${THEME.TEXT}; font-size:12px; outline:none; box-sizing:border-box; margin-bottom:10px;">
        ${btnPrimary("confirmClose", "Close")}
        ${btnSecondary("backClose", "← Back")}
      </div>
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
    const label = document.createElement("div"); label.innerText = "Rows per page"; label.style.cssText = "margin-bottom:6px; font-size:11px; font-weight:600; color:"+THEME.MUTED; container.appendChild(label);
    const rowContainer = document.createElement("div"); rowContainer.style.cssText = "display:flex; justify-content:space-between; gap:6px;";
    
    [50, 100, 300].forEach(val => {
      const btn = document.createElement("button"); btn.innerText = val; btn.style.cssText = "flex:1; padding:8px 0; border-radius:10px; border:1px solid "+THEME.BORDER+"; background:rgba(255,255,255,0.02); cursor:pointer; font-size:11px; font-weight:600; color:"+THEME.TEXT;
      btn.onmouseenter = () => btn.style.background = "rgba(255,255,255,0.06)";
      btn.onmouseleave = () => btn.style.background = "rgba(255,255,255,0.02)";
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
