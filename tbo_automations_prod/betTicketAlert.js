// betTicketAlert.js
registerAutomation("betticket_alert", { name: "BetTicket Filters" }, function () {
  const ui = window.TBO_UI;
  if (!ui) return;

  /************************************
   * 💠 LISTA DE CUSTOMERS
   ************************************/
  const customerOptions = [
    "default", "Test", "A3", "A2", "A1", "B3", "B2", "B1",
    "Monitoring 2", "F", "KAMBI - VIP", "KAMBI - NORMAL",
    "KAMBI - Arber", "KAMBI - Wiseguy", "Monitoring 1", "SBL",
    "D", "Turnover Focus", "C4", "C3", "C1", "C2", "A4", "B4",
    "default BR", "KAMBI - VIP BR", "KAMBI - NORMAL High BR",
    "KAMBI - NORMAL Low BR", "KAMBI - Wiseguy BR", "KAMBI - Arber BR",
    "F Spam", "A0", "B0", "Cp1", "Cp2", "Cp3", "Cp4", 
    "default CA", "KAMBI - VIP CA", "KAMBI - NORMAL CA", 
    "KAMBI - Wiseguy CA", "KAMBI - Arber CA",
    "default SE", "KAMBI - VIP SE", "KAMBI - NORMAL SE", 
    "KAMBI - Wiseguy SE", "KAMBI - Arber SE", "default SE GoGo", 
    "A4 SE", "A3 SE", "A2 SE", "A1 SE", "A0 SE", 
    "B4 SE", "B3 SE", "B2 SE", "B1 SE", "B0 SE", 
    "Cp4 SE", "Cp3 SE", "Cp2 SE", "Cp1 SE", 
    "C4 SE", "C3 SE", "C2 SE", "C1 SE", "D SE", "F SE", 
    "Turnover Focus SE"
  ];

  /************************************
   * 💠 PANEL FLOTANTE (Width: 460px)
   ************************************/
  const panelApi = ui.createFloatingPanel({
    id: "tbo_betticket_filters",
    title: "BetTicket Filters",
    width: 460, 
    top: 20,
    right: 20
  });

  const $ = (sel) => panelApi.body.querySelector(sel);
  const escapeHtml = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const TEXT = ui.THEME?.text || "#e6e8ee";
  const MUTED = ui.THEME?.muted || "rgba(230,232,238,0.65)";
  const BORDER = ui.THEME?.border || "rgba(255,255,255,0.10)";
  const CARD = ui.THEME?.card || ui.THEME?.panel || "#13161d";
  const BG_HI = "rgba(240,166,74,0.10)";
  const FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

  /************************************
   * 💠 HEADER STYLE — CREATOR QUICKSB B
   ************************************/
  function applyCreatorQuicksHeaderStyle() {
    const panel =
      document.getElementById("tbo_betticket_filters") ||
      panelApi.panel ||
      panelApi.root ||
      panelApi.el ||
      panelApi.element ||
      null;

    if (!panel) return;

    panel.style.background = CARD;
    panel.style.color = TEXT;
    panel.style.fontFamily = FONT;

    const header =
      panelApi.header ||
      panel.querySelector("[data-tbo-panel-header]") ||
      panel.querySelector(".tbo-panel-header") ||
      panel.querySelector(".tbo-header") ||
      panel.querySelector("[class*='header' i]") ||
      panel.firstElementChild;

    if (!header) return;

    header.style.height = "36px";
    header.style.minHeight = "36px";
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.padding = "0 10px";
    header.style.cursor = "grab";
    header.style.userSelect = "none";
    header.style.background = "linear-gradient(90deg, rgba(240,166,74,0.18), rgba(240,166,74,0.04))";
    header.style.borderBottom = `1px solid ${BORDER}`;
    header.style.boxSizing = "border-box";
    header.style.fontFamily = FONT;
    header.style.color = TEXT;

    header.addEventListener("mousedown", (e) => {
      const target = e.target;
      if (target && target.closest && target.closest("button")) return;
      header.style.cursor = "grabbing";
    });

    window.addEventListener("mouseup", () => {
      header.style.cursor = "grab";
    });

    const titleNode =
      Array.from(header.querySelectorAll("div, span"))
        .find((el) => (el.textContent || "").trim() === "BetTicket Filters") ||
      Array.from(header.querySelectorAll("div, span"))
        .find((el) => (el.textContent || "").includes("BetTicket Filters")) ||
      Array.from(header.children)
        .find((el) => !el.querySelector?.("button"));

    if (titleNode) {
      titleNode.style.fontFamily = FONT;
      titleNode.style.fontWeight = "650";
      titleNode.style.fontSize = "12px";
      titleNode.style.letterSpacing = ".2px";
      titleNode.style.color = TEXT;
      titleNode.style.lineHeight = "1";
    }

    let actions =
      Array.from(header.children)
        .find((el) => el.querySelector && el.querySelector("button")) ||
      header.querySelector(".tbo-actions") ||
      header.querySelector(".tbo-panel-actions");

    if (!actions) {
      actions = document.createElement("div");
      header.appendChild(actions);
    }

    actions.style.display = "flex";
    actions.style.gap = "6px";
    actions.style.alignItems = "center";

    const buttons = Array.from(header.querySelectorAll("button"));

    let minBtn =
      buttons.find((btn) => {
        const txt = (btn.textContent || "").trim();
        const title = (btn.getAttribute("title") || "").toLowerCase();
        return txt === "−" || txt === "-" || title.includes("min");
      }) || null;

    let closeBtn =
      buttons.find((btn) => {
        const txt = (btn.textContent || "").trim().toLowerCase();
        const title = (btn.getAttribute("title") || "").toLowerCase();
        return txt === "✕" || txt === "x" || txt === "×" || title.includes("close") || title.includes("cerrar");
      }) || null;

    if (!minBtn) {
      minBtn = document.createElement("button");
      minBtn.title = "Minimize";
      minBtn.textContent = "−";
      actions.insertBefore(minBtn, actions.firstChild);
    }

    if (!closeBtn) {
      closeBtn = document.createElement("button");
      closeBtn.title = "Close";
      closeBtn.textContent = "✕";
      actions.appendChild(closeBtn);
    }

    [minBtn, closeBtn].forEach((btn) => {
      btn.style.width = "26px";
      btn.style.height = "22px";
      btn.style.borderRadius = "8px";
      btn.style.border = `1px solid ${BORDER}`;
      btn.style.background = "rgba(255,255,255,0.02)";
      btn.style.color = TEXT;
      btn.style.fontWeight = "650";
      btn.style.cursor = "pointer";
      btn.style.padding = "0";
      btn.style.lineHeight = "20px";
      btn.style.fontSize = "12px";
      btn.style.fontFamily = FONT;
      btn.style.boxSizing = "border-box";
    });

    minBtn.textContent = "−";
    closeBtn.textContent = "✕";

    if (!minBtn.__tboHeaderStandardBound) {
      minBtn.__tboHeaderStandardBound = true;
      let minimized = false;

      minBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        minimized = !minimized;
        panelApi.body.style.display = minimized ? "none" : "block";
        minBtn.textContent = "−";
      });
    }

    if (!closeBtn.__tboHeaderStandardBound) {
      closeBtn.__tboHeaderStandardBound = true;

      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        panel.remove();
      });
    }
  }

  requestAnimationFrame(applyCreatorQuicksHeaderStyle);

  panelApi.setHTML(`
    <div class="tbo-col" style="gap:12px;">
      <div class="tbo-row" style="gap:10px; align-items:center; justify-content:space-between;">
        <div style="font-size:10px; color:${MUTED}; font-weight:600;">Filters</div>
        <button id="bsrToggle" class="tbo-btn" style="padding:6px 10px; border:1px solid ${BORDER}; background: rgba(255,255,255,0.03); color:${TEXT}; border-radius:10px; font-weight:650;">BSR</button>
      </div>
      
      <div>
        <div class="tbo-label">Total Stake (€) From</div>
        <input class="tbo-input" id="stakeFrom" type="number" step="0.01" placeholder="Min" style="margin-top:6px;" />
      </div>
      
      <div>
        <div class="tbo-label">Theoretical Margin (%) Max</div>
        <input class="tbo-input" id="tmMax" type="number" step="0.1" placeholder="Max" style="margin-top:6px;" />
      </div>
      
      <div>
        <div class="tbo-label" id="customerToggle" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between;">
          <span>Customer</span><span style="opacity:0.8;">▼</span>
        </div>
        <div id="customerOptionsContainer" style="display:none; margin-top:8px; border:1px solid ${BORDER}; border-radius:12px; padding:8px; max-height:180px; overflow:auto; background: rgba(255,255,255,0.02);">
          ${customerOptions.map((opt) => `<div data-value="${escapeHtml(opt)}" class="customer-opt" style="padding:7px 8px; border-radius:10px; cursor:pointer; font-size:12px; font-weight:450; border:1px solid transparent;">${escapeHtml(opt)}</div>`).join("")}
        </div>
      </div>

      <div style="height:1px; background:${BORDER}; margin:4px 0;"></div>

      <div>
        <div id="templateToggle" style="cursor:pointer; display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
          <div style="font-size:10px; color:${MUTED}; font-weight:600;">Templates</div>
          <span style="opacity:0.8; font-size:12px;">▼</span>
        </div>
        
        <div id="templatesContent" style="display:none; margin-top:8px;">
          <div class="tbo-row" style="gap:8px; margin-bottom:10px;">
            <button id="saveTemplate" class="tbo-btn tbo-btn-primary" style="flex:1; padding:8px 0; font-weight:600;">Save Template</button>
            <button id="importTemplate" class="tbo-btn" style="flex:1; padding:8px 0; border:1px solid ${BORDER}; background:rgba(255,255,255,0.05);">Import Template</button>
          </div>
          <div id="templatesList" style="display:flex; flex-direction:column; gap:6px; max-height:180px; overflow:auto;">
            </div>
        </div>
      </div>
    </div>
  `);

  requestAnimationFrame(applyCreatorQuicksHeaderStyle);

  let selectedCustomers = [];
  let bsrEnabled = false;

  const stakeFromInput = $("#stakeFrom");
  const tmMaxInput = $("#tmMax");
  const customerContainer = $("#customerOptionsContainer");
  const bsrButton = $("#bsrToggle");
  const templatesContent = $("#templatesContent");
  const templatesList = $("#templatesList");

  /************************************
   * 💾 LÓGICA DE TEMPLATES
   ************************************/
  const STORAGE_KEY = "tbo_betticket_templates";

  function getTemplates() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }

  function renderTemplates() {
    const templates = getTemplates();
    if (templates.length === 0) {
      templatesList.innerHTML = `<div style="font-size:11px; color:${MUTED}; font-style:italic; text-align:center;">No templates saved</div>`;
      return;
    }
    templatesList.innerHTML = templates.map((t, index) => `
      <div class="tbo-row" style="justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:8px; border:1px solid ${BORDER};">
        <span style="font-size:12px; color:${TEXT}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${escapeHtml(t.name)}</span>
        <div class="tbo-row" style="gap:4px;">
          <button class="load-template tbo-btn" data-index="${index}" style="padding:4px 8px; font-size:10px; background:rgba(125,206,160,0.15); color:#7dcea0;">Load</button>
          <button class="share-template tbo-btn" data-index="${index}" style="padding:4px 8px; font-size:10px; background:rgba(52,152,219,0.15); color:#3498db;">Share</button>
          <button class="delete-template tbo-btn" data-index="${index}" style="padding:4px 8px; font-size:10px; background:rgba(231,76,60,0.15); color:#e74c3c;">✕</button>
        </div>
      </div>
    `).join("");

    templatesList.querySelectorAll(".load-template").forEach(btn => btn.onclick = () => loadTemplate(btn.getAttribute("data-index")));
    templatesList.querySelectorAll(".share-template").forEach(btn => btn.onclick = () => shareTemplate(btn.getAttribute("data-index")));
    templatesList.querySelectorAll(".delete-template").forEach(btn => btn.onclick = () => deleteTemplate(btn.getAttribute("data-index")));
  }

  function saveTemplate() {
    const name = prompt("Enter a name for this template:");
    if (!name?.trim()) return;
    const templates = getTemplates();
    templates.push({
      name: name.trim(),
      stakeFrom: stakeFromInput.value,
      tmMax: tmMaxInput.value,
      selectedCustomers: [...selectedCustomers],
      bsrEnabled: bsrEnabled
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    renderTemplates();
  }

  function shareTemplate(index) {
    const t = getTemplates()[index];
    if (!t) return;
    const code = btoa(JSON.stringify(t));
    navigator.clipboard.writeText(code).then(() => alert("Template code copied!"));
  }

  function importTemplate() {
    const code = prompt("Paste template code:");
    if (!code?.trim()) return;
    try {
      const imported = JSON.parse(atob(code.trim()));
      const templates = getTemplates();
      templates.push(imported);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
      renderTemplates();
      alert(`Imported: ${imported.name}`);
    } catch (e) { alert("Invalid code"); }
  }

  function loadTemplate(index) {
    const t = getTemplates()[index];
    if (!t) return;
    stakeFromInput.value = t.stakeFrom;
    tmMaxInput.value = t.tmMax;
    bsrEnabled = t.bsrEnabled;
    selectedCustomers = [...t.selectedCustomers];
    paintBsrBtn();
    customerContainer.querySelectorAll(".customer-opt").forEach(div => highlightOption(div, selectedCustomers.includes(div.getAttribute("data-value"))));
    applyFilterToTable();
  }

  function deleteTemplate(index) {
    if(!confirm("Delete?")) return;
    const templates = getTemplates();
    templates.splice(index, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    renderTemplates();
  }

  /************************************
   * 💠 EVENTOS Y FILTRO
   ************************************/
  $("#templateToggle").onclick = () => {
    const cur = templatesContent.style.display;
    templatesContent.style.display = (cur === "none" || !cur) ? "block" : "none";
  };

  $("#saveTemplate").onclick = saveTemplate;
  $("#importTemplate").onclick = importTemplate;
  stakeFromInput.oninput = () => applyFilterToTable();
  tmMaxInput.oninput = () => applyFilterToTable();

  $("#customerToggle").onclick = () => {
    const cur = customerContainer.style.display;
    customerContainer.style.display = (cur === "none" || !cur) ? "block" : "none";
  };

  const highlightOption = (node, on) => {
    node.style.background = on ? BG_HI : "transparent";
    node.style.border = on ? `1px solid rgba(240,166,74,0.20)` : "1px solid transparent";
  };

  customerContainer.querySelectorAll(".customer-opt").forEach((div) => {
    div.addEventListener("click", () => {
      const val = div.getAttribute("data-value");
      selectedCustomers = selectedCustomers.includes(val) ? selectedCustomers.filter(x => x !== val) : [...selectedCustomers, val];
      highlightOption(div, selectedCustomers.includes(val));
      applyFilterToTable();
    });
  });

  function paintBsrBtn() {
    bsrButton.style.background = bsrEnabled ? "rgba(125,206,160,0.25)" : "rgba(255,255,255,0.03)";
    bsrButton.style.border = bsrEnabled ? "1px solid rgba(125,206,160,0.35)" : `1px solid ${BORDER}`;
  }

  bsrButton.onclick = () => { bsrEnabled = !bsrEnabled; paintBsrBtn(); applyFilterToTable(); };

  const highlightElement = (el, apply) => {
    if (!el) return;
    if (apply) {
      el.style.backgroundColor = "rgba(240, 166, 74, 0.35)"; 
      el.style.boxShadow = "0 0 6px rgba(240, 166, 74, 0.3)";
      el.style.borderRadius = "6px"; el.style.padding = "2px 8px";
      el.style.display = "inline-block"; el.style.verticalAlign = "middle";
    } else {
      el.style.backgroundColor = ""; el.style.boxShadow = ""; el.style.borderRadius = ""; el.style.padding = ""; el.style.display = ""; el.style.verticalAlign = "";
    }
  };

  function applyFilterToTable() {
    const stakeFrom = parseFloat(stakeFromInput.value);
    const tmMax = parseFloat(tmMaxInput.value);

    document.querySelectorAll("tr[data-testid='bets-monitoring-table-row']").forEach((row) => {
      row.style.background = ""; row.style.outline = "";
      row.querySelectorAll('*').forEach(el => { if (el.style.backgroundColor.includes("240, 166, 74")) highlightElement(el, false); });

      let matchesNormal = false; let matchesBSR = false;

      const stakeCell = row.querySelector('[data-testid="bets-monitoring-table-row-total-stake-cell"]');
      if (stakeCell && !Number.isNaN(stakeFrom)) {
        const v = parseFloat((stakeCell.innerText || "").replace(/[^0-9.]/g, ""));
        if (!Number.isNaN(v) && v >= stakeFrom) { matchesNormal = true; highlightElement(stakeCell.firstElementChild || stakeCell, true); }
      }

      const tmCell = row.querySelector('[data-testid="theoretical-margin-value"]');
      if (tmCell && !Number.isNaN(tmMax)) {
        const v = parseFloat((tmCell.innerText || "").replace("%", "").trim());
        if (!Number.isNaN(v) && v <= tmMax) { matchesNormal = true; highlightElement(tmCell, true); }
      }

      const custCell = row.querySelector('[data-testid="bets-monitoring-table-row-customer-classification"]');
      if (custCell) {
        const v = (custCell.innerText || "").trim();
        if (selectedCustomers.includes(v)) { matchesNormal = true; highlightElement(custCell.querySelector('span') || custCell, true); }
      }

      const bsrCell = row.querySelector('[data-testid="bets-monitoring-table-row-bet-request"]');
      if (bsrEnabled && bsrCell && (bsrCell.innerText || "").trim() === "BSR") matchesBSR = true;

      if (matchesBSR) {
        row.style.background = "rgba(52,152,219,0.18)"; row.style.outline = "2px solid rgba(52,152,219,0.55)";
      } else if (matchesNormal) {
        row.style.background = "rgba(240,166,74,0.12)"; row.style.outline = "2px solid rgba(240,166,74,0.45)";
      }
    });
  }

  paintBsrBtn();
  renderTemplates();

  const table = document.querySelector("table");
  if (table) {
    const obs = new MutationObserver(() => { applyFilterToTable(); });
    obs.observe(table, { childList: true, subtree: true });
  }
});
