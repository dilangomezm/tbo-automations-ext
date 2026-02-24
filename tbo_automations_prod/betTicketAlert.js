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
    "KAMBI - NORMAL Low BR", "KAMBI - Wiseguy BR", "KAMBI - Arber BR"
  ];

  /************************************
   * 💠 PANEL FLOTANTE
   ************************************/
  const panelApi = ui.createFloatingPanel({
    id: "tbo_betticket_filters",
    title: "BetTicket Filters",
    width: 420,
    top: 20,
    right: 20
  });

  const $ = (sel) => panelApi.body.querySelector(sel);
  const escapeHtml = (s) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  const TEXT = ui.THEME?.text || "#e6e8ee";
  const MUTED = ui.THEME?.muted || "rgba(230,232,238,0.65)";
  const BORDER = ui.THEME?.border || "rgba(255,255,255,0.10)";
  const BG_HI = "rgba(240,166,74,0.10)";

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
          ${customerOptions.map((opt) => `<div data-value="${escapeHtml(opt)}" style="padding:7px 8px; border-radius:10px; cursor:pointer; font-size:12px; font-weight:450; border:1px solid transparent;">${escapeHtml(opt)}</div>`).join("")}
        </div>
      </div>
      <div class="tbo-row" style="gap:10px; margin-top:2px;">
        <button class="tbo-btn tbo-btn-primary" id="applyFilter">Apply</button>
        <button class="tbo-btn" id="clearFilter">Clear</button>
      </div>
    </div>
  `);

  let selectedCustomers = [];
  let bsrEnabled = false;

  const stakeFromInput = $("#stakeFrom");
  const tmMaxInput = $("#tmMax");
  const customerToggle = $("#customerToggle");
  const customerContainer = $("#customerOptionsContainer");
  const bsrButton = $("#bsrToggle");

  customerToggle.onclick = () => {
    const cur = customerContainer.style.display;
    customerContainer.style.display = cur === "none" || !cur ? "block" : "none";
  };

  const highlightOption = (node, on) => {
    node.style.background = on ? BG_HI : "transparent";
    node.style.border = on ? `1px solid rgba(240,166,74,0.20)` : "1px solid transparent";
  };

  customerContainer.querySelectorAll("[data-value]").forEach((div) => {
    div.addEventListener("click", () => {
      const val = div.getAttribute("data-value");
      if (selectedCustomers.includes(val)) {
        selectedCustomers = selectedCustomers.filter((x) => x !== val);
        highlightOption(div, false);
      } else {
        selectedCustomers.push(val);
        highlightOption(div, true);
      }
      applyFilterToTable();
    });
  });

  function paintBsrBtn() {
    bsrButton.style.background = bsrEnabled ? "rgba(125,206,160,0.25)" : "rgba(255,255,255,0.03)";
    bsrButton.style.border = bsrEnabled ? "1px solid rgba(125,206,160,0.35)" : `1px solid ${BORDER}`;
  }

  bsrButton.onclick = () => { bsrEnabled = !bsrEnabled; paintBsrBtn(); applyFilterToTable(); };
  paintBsrBtn();

  /************************************
   * 💠 AYUDA VISUAL (RECUADRO)
   ************************************/
  
  const applyItemHighlight = (el, apply) => {
    if (!el) return;
    if (apply) {
      // Estilo de recuadro basado en la imagen de referencia (TM)
      el.style.backgroundColor = "rgba(240, 166, 74, 0.35)"; // Tono más oscuro
      el.style.boxShadow = "0 0 8px rgba(240, 166, 74, 0.4)"; // Sombra suave
      el.style.borderRadius = "6px";
      el.style.padding = "2px 8px";
      el.style.display = "inline-block";
      el.style.verticalAlign = "middle"; // Mantener alineación original
      el.style.transition = "all 0.2s ease";
    } else {
      el.style.backgroundColor = "";
      el.style.boxShadow = "";
      el.style.borderRadius = "";
      el.style.padding = "";
      el.style.display = "";
      el.style.verticalAlign = "";
    }
  };

  function applyFilterToTable() {
    const stakeFrom = parseFloat(stakeFromInput.value);
    const tmMax = parseFloat(tmMaxInput.value);

    // Reset general
    document.querySelectorAll("tr[data-testid='bets-monitoring-table-row']").forEach((row) => {
      row.style.background = "";
      row.style.outline = "";
      // Limpiar recuadros previos
      row.querySelectorAll('*').forEach(el => applyItemHighlight(el, false));
    });

    document.querySelectorAll("tr[data-testid='bets-monitoring-table-row']").forEach((row) => {
      let matchesNormal = false;
      let matchesBSR = false;

      // Stake
      const stakeCell = row.querySelector('[data-testid="bets-monitoring-table-row-total-stake-cell"]');
      if (stakeCell && !Number.isNaN(stakeFrom)) {
        const v = parseFloat((stakeCell.innerText || "").replace(/[^0-9.]/g, ""));
        if (!Number.isNaN(v) && v >= stakeFrom) {
          matchesNormal = true;
          applyItemHighlight(stakeCell, true);
        }
      }

      // TM (Theoretical Margin)
      const tmCell = row.querySelector('[data-testid="theoretical-margin-value"]');
      if (tmCell && !Number.isNaN(tmMax)) {
        const v = parseFloat((tmCell.innerText || "").replace("%", "").trim());
        if (!Number.isNaN(v) && v <= tmMax) {
          matchesNormal = true;
          applyItemHighlight(tmCell, true);
        }
      }

      // Customer
      const custCell = row.querySelector('[data-testid="bets-monitoring-table-row-customer-classification"]');
      if (custCell) {
        const v = (custCell.innerText || "").trim();
        if (selectedCustomers.includes(v)) {
          matchesNormal = true;
          // Aplicar resalte al contenedor del texto del cliente
          applyItemHighlight(custCell, true);
        }
      }

      // BSR
      const bsrCell = row.querySelector('[data-testid="bets-monitoring-table-row-bet-request"]');
      if (bsrEnabled && bsrCell && (bsrCell.innerText || "").trim() === "BSR") {
        matchesBSR = true;
      }

      // Estilos de fila
      if (matchesBSR) {
        row.style.background = "rgba(52,152,219,0.18)";
        row.style.outline = "2px solid rgba(52,152,219,0.55)";
      } else if (matchesNormal) {
        row.style.background = "rgba(240,166,74,0.12)";
        row.style.outline = "2px solid rgba(240,166,74,0.45)";
      }
    });
  }

  $("#applyFilter").onclick = applyFilterToTable;

  $("#clearFilter").onclick = () => {
    selectedCustomers = [];
    bsrEnabled = false;
    paintBsrBtn();
    stakeFromInput.value = "";
    tmMaxInput.value = "";
    document.querySelectorAll("tr[data-testid='bets-monitoring-table-row']").forEach((row) => {
      row.style.background = "";
      row.style.outline = "";
      row.querySelectorAll('*').forEach(el => applyItemHighlight(el, false));
    });
    customerContainer.querySelectorAll("[data-value]").forEach((d) => highlightOption(d, false));
  };

  const table = document.querySelector("table");
  if (table) {
    const obs = new MutationObserver(() => { applyFilterToTable(); });
    obs.observe(table, { childList: true, subtree: true });
  }
});
