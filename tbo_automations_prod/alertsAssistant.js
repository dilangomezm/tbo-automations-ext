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
  panel.style.width = "300px"; // Ancho inicial 300px
  panel.style.maxWidth = "92vw";
  panel.style.background = THEME.CARD;
  panel.style.border = `1px solid ${THEME.BORDER}`;
  panel.style.borderRadius = `${THEME.RADIUS}px`;
  panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
  panel.style.zIndex = "999999";
  panel.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  panel.style.color = THEME.TEXT;
  panel.style.overflow = "hidden";
  panel.style.transition = "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"; // Animación suave al cambiar tamaño
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

  // Contenedor para botones de control
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

  // Configuración predeterminada
  const defaultCancellationsConfig = {
      reason: "NO_RESULT_ASSIGNABLE",
      actions: { "cfg-confirm-all": true }
  };

  // --- LÓGICA DE CANCELACIONES ACTUALIZADA (Copia las opciones exactas) ---
  async function processHandleForNode(row, config = defaultCancellationsConfig) {
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
      
      // 1. Asignar Razón
      const reasonDropdown = dialog.querySelector('#reasonSelectProp');
      if (reasonDropdown && config.reason) {
        const success = await selectDropdownValue(reasonDropdown, config.reason);
        if (!success) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      }
      
      await sleep(600); // Esperar que la tabla UI se actualice post-razón

      // Función auxiliar robusta para hacer clic en Checkboxes de Material UI
      const checkMuiCb = (parentEl, testId) => {
          if (!parentEl) return;
          const wrapper = parentEl.querySelector(`[data-testid="${testId}"]`);
          if (wrapper) {
              const input = wrapper.querySelector('input');
              if (input) input.click(); // Hacer clic directo en el input oculto
              else wrapper.click();
          }
      };

      // 2. Marcar Select All o Filas Individuales
      if (config.actions['cfg-confirm-all']) {
          checkMuiCb(dialog, "confirm-all-checkbox");
      } else if (config.actions['cfg-reject-all']) {
          checkMuiCb(dialog, "reject-all-checkbox");
      } else {
          // Si no es Select All, ir fila por fila de la tabla del popup
          const rowsToCheck = ["row-SE", "row-SE-betmgm", "row-SE-gogo", "row-SE-expekt", "row-SE-leovegas", "row-BR", "row-BR-betmgm", "row-DK", "row-DK-expekt", "row-DK-leovegas", "row-CA", "row-CA-leovegas", "row-FI", "row-FI-expekt", "row-GB", "row-GB-leovegas", "row-GB-betmgm", "row-GB-betuk"];
          
          for (let rId of rowsToCheck) {
              const rowEl = dialog.querySelector(`tr[data-row="${rId}"]`);
              if (rowEl) {
                  if (config.actions[`cfg-${rId}-confirm`]) {
                      checkMuiCb(rowEl, "confirm-checkbox");
                  } else if (config.actions[`cfg-${rId}-reject`]) {
                      checkMuiCb(rowEl, "reject-checkbox");
                  }
              }
          }
      }

      await sleep(600); // Darle tiempo a la UI de registrar todos los checks

      // 3. Guardar y Cerrar Alertas
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
    panel.style.width = "300px"; // Retornar a 300px

    const isAlerts = currentMode === "alerts";
    title.innerText = isAlerts ? "Alerts Assistant" : "Cancellations Assistant";
    
    let htmlContent = `
      <div style="border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); border-radius:${THEME.RADIUS}px; padding:12px; display:flex; flex-direction:column; gap:4px;">
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
          const mainMenuBtn = document.querySelector('[data-testid="alerting-messages-actions-open-btn"]');
          if (mainMenuBtn) {
              clickEl(mainMenuBtn);
              await sleep(400); 
              const menuItems = Array.from(document.querySelectorAll('li[role="menuitem"]'));
              const closeAllBtn = menuItems.find(el => el.textContent.includes("Close all assigned to me"));
              if (closeAllBtn) {
                  clickEl(closeAllBtn);
                  alert("✔ 'Close all assigned to me' executed.");
              } else {
                  alert("Could not find the 'Close all assigned to me' option.");
                  document.body.click(); 
              }
          } else {
              alert("Could not find the main actions menu (3 dots).");
          }
      } else {
          // Despliega el menú de configuración y se expande a 420px
          showCancellationConfigMenu();
      }
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

  // --- MENÚ DE CONFIGURACIÓN CANCELLATIONS (EXPANDIDO) ---
  function showCancellationConfigMenu() {
    panel.style.width = "420px"; // Expandir a 420px para la tabla

    const tableRowsData = [
      { id: 'ALL', label: 'Select all', isMaster: true },
      { id: 'row-SE', label: 'Sweden' },
      { id: 'row-SE-betmgm', label: 'BetMGM' },
      { id: 'row-SE-gogo', label: 'GoGo' },
      { id: 'row-SE-expekt', label: 'Expekt' },
      { id: 'row-SE-leovegas', label: 'LeoVegas' },
      { id: 'row-BR', label: 'Brazil' },
      { id: 'row-BR-betmgm', label: 'BetMGM' },
      { id: 'row-DK', label: 'Denmark' },
      { id: 'row-DK-expekt', label: 'Expekt' },
      { id: 'row-DK-leovegas', label: 'LeoVegas' },
      { id: 'row-CA', label: 'Canada' },
      { id: 'row-CA-leovegas', label: 'LeoVegas' },
      { id: 'row-FI', label: 'Finland' },
      { id: 'row-FI-expekt', label: 'Expekt' },
      { id: 'row-GB', label: 'GB' },
      { id: 'row-GB-leovegas', label: 'LeoVegas' },
      { id: 'row-GB-betmgm', label: 'BetMGM' },
      { id: 'row-GB-betuk', label: 'BetUK' }
    ];

    let listHtml = tableRowsData.map(r => {
      const isSub = r.id !== 'ALL' && r.id.split('-').length > 2;
      const padding = isSub ? "20px" : "6px";
      const fw = r.isMaster ? "bold" : "normal";
      const confId = r.id === 'ALL' ? 'cfg-confirm-all' : `cfg-${r.id}-confirm`;
      const rejId = r.id === 'ALL' ? 'cfg-reject-all' : `cfg-${r.id}-reject`;

      return `
        <div style="display:flex; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
          <div style="padding-left:${padding}; font-size:12px; font-weight:${fw}; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${THEME.TEXT};" title="${r.label}">${r.label}</div>
          <div style="width:80px; text-align:center;">
            <input type="checkbox" id="${confId}" class="cfg-cb" data-type="confirm" data-row="${r.id}" style="cursor:pointer; width:16px; height:16px; accent-color:#f0a64a;">
          </div>
          <div style="width:80px; text-align:center;">
            <input type="checkbox" id="${rejId}" class="cfg-cb" data-type="reject" data-row="${r.id}" style="cursor:pointer; width:16px; height:16px; accent-color:#d32f2f;">
          </div>
        </div>
      `;
    }).join('');

    setPanelHTML(`
      <div style="border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); border-radius:${THEME.RADIUS}px; padding:14px; display:flex; flex-direction:column;">
        
        <label style="font-size:12px; font-weight:bold; color:${THEME.TEXT}; margin-bottom:6px;">Internal reason provided:</label>
        <select id="massCancelReason" style="width:100%; padding:10px; border-radius:8px; border:1px solid ${THEME.BORDER}; background:#1a1d24; color:${THEME.TEXT}; font-size:12px; outline:none; box-sizing:border-box; margin-bottom:14px;">
          <option value="GOODWILL">GOODWILL</option>
          <option value="CANCELLED_EVENT">CANCELLED_EVENT</option>
          <option value="DEAD_HEAT">DEAD_HEAT</option>
          <option value="EVENT_ABANDONED">EVENT_ABANDONED</option>
          <option value="INCORRECT_ODDS">INCORRECT_ODDS</option>
          <option value="INCORRECT_STATISTICS">INCORRECT_STATISTICS</option>
          <option value="MATCH_ENDED_IN_WALKOVER">MATCH_ENDED_IN_WALKOVER</option>
          <option value="INCORRECT_KICK_OFF_TIME">INCORRECT_KICK_OFF_TIME</option>
          <option value="EVENT_POSTPONED">EVENT_POSTPONED</option>
          <option value="NO_GOALSCORER">NO_GOALSCORER</option>
          <option value="FORMAT_CHANGE">FORMAT_CHANGE</option>
          <option value="RETIRED_OR_DEFAULTED">RETIRED_OR_DEFAULTED</option>
          <option value="RESULT_UNVERIFIABLE">RESULT_UNVERIFIABLE</option>
          <option value="STARTING_PITCHER_CHANGED">STARTING_PITCHER_CHANGED</option>
          <option value="SUBSTITUTION_GUARANTEE">SUBSTITUTION_GUARANTEE</option>
          <option value="NO_RESULT_ASSIGNABLE" selected>NO_RESULT_ASSIGNABLE</option>
        </select>

        <div style="display:flex; align-items:center; margin-bottom:8px; font-size:12px; font-weight:bold; color:${THEME.TEXT}; border-bottom:2px solid rgba(255,255,255,0.1); padding-bottom:6px;">
           <span style="flex:1;"></span>
           <span style="width:80px; text-align:center;">Confirmed</span>
           <span style="width:80px; text-align:center;">Rejected</span>
        </div>
        
        <div style="max-height: 220px; overflow-y: auto; background:rgba(0,0,0,0.2); border-radius:8px; padding:0 8px; margin-bottom:16px; border:1px solid ${THEME.BORDER};">
          ${listHtml}
        </div>

        ${btnPrimary("runMassCancel", "Execute")}
        ${btnSecondary("backMassCancel", "← Back")}
      </div>
    `);

    // Lógica para excluir mutuamente C y R + Comportamiento de "Select All"
    document.querySelectorAll('.cfg-cb').forEach(cb => {
       cb.addEventListener('change', (e) => {
           const type = e.target.dataset.type; 
           const row = e.target.dataset.row;
           const oppType = type === 'confirm' ? 'reject' : 'confirm';
           const oppId = row === 'ALL' ? `cfg-${oppType}-all` : `cfg-${row}-${oppType}`;
           
           if (e.target.checked) {
               const oppCb = document.getElementById(oppId);
               if(oppCb) oppCb.checked = false;
               
               if (row === 'ALL') {
                   document.querySelectorAll(`.cfg-cb[data-type="${type}"]`).forEach(c => c.checked = true);
                   document.querySelectorAll(`.cfg-cb[data-type="${oppType}"]`).forEach(c => c.checked = false);
               }
           } else {
               if (row === 'ALL') {
                   document.querySelectorAll(`.cfg-cb[data-type="${type}"]`).forEach(c => c.checked = false);
               } else {
                   const masterCb = document.getElementById(`cfg-${type}-all`);
                   if (masterCb) masterCb.checked = false;
               }
           }
       });
    });

    document.getElementById("backMassCancel").onclick = showMainMenu;
    document.getElementById("runMassCancel").onclick = async () => {
      const reason = document.getElementById("massCancelReason").value;
      const config = { reason: reason, actions: {} };
      
      document.querySelectorAll('.cfg-cb').forEach(cb => {
         if (cb.checked) config.actions[cb.id] = true;
      });
      
      let closed = 0;
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of rows) {
          if (row.querySelector('button[data-testid="assign-to-me-button"]')) continue;
          const success = await processHandleForNode(row, config);
          if (success) closed++;
      }
      alert(`✔ ${closed} assigned cancellations handled.`);
      showMainMenu();
    };
  }

  function showAssignMenu() {
    panel.style.width = "300px"; // Retornar a 300px
    const isAlerts = currentMode === "alerts";
    setPanelHTML(`
      <div style="border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); border-radius:${THEME.RADIUS}px; padding:12px; display:flex; flex-direction:column; gap:4px;">
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
    panel.style.width = "300px"; // Retornar a 300px
    const isAlerts = currentMode === "alerts";
    setPanelHTML(`
      <div style="border:1px solid ${THEME.BORDER}; background:rgba(255,255,255,0.02); border-radius:${THEME.RADIUS}px; padding:12px; display:flex; flex-direction:column; gap:4px;">
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
              const success = await processHandleForNode(row); // Usará config por defecto
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
    const rowContainer = document.createElement("div"); rowContainer.style.cssText = "display:flex; justify-content:space-between; gap:8px;";
    
    [50, 100, 300].forEach(val => {
      const btn = document.createElement("button"); btn.innerText = val; btn.style.cssText = "flex:1; padding:8px 0; border-radius:10px; border:1px solid "+THEME.BORDER+"; background:rgba(255,255,255,0.02); cursor:pointer; font-size:12px; font-weight:600; color:"+THEME.TEXT;
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
