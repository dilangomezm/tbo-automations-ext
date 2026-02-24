// betTicketAlert.js
registerAutomation("betticket_alert", { name: "BetTicket Filters" }, function () {
  const ui = window.TBO_UI;
  if (!ui) return;

  /************************************
   * 💠 LISTA NUEVA DE CUSTOMERS
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
   * 💠 PANEL FLOTANTE (EXTENSION)
   ************************************/
  const panelApi = ui.createFloatingPanel({
    id: "tbo_betticket_filters",
    title: "BetTicket Filters",
    width: 420,
    top: 20,
    right: 20
  });

  // Helpers
  const $ = (sel) => panelApi.body.querySelector(sel);
  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  // Theme fallbacks
  const ACCENT = ui.THEME?.accent || "#f0a64a";
  const TEXT = ui.THEME?.text || "#e6e8ee";
  const MUTED = ui.THEME?.muted || "rgba(230,232,238,0.65)";
  const BORDER = ui.THEME?.border || "rgba(255,255,255,0.10)";
  const BG_HI = "rgba(240,166,74,0.10)";
  const BR_HI = "2px solid rgba(240,166,74,0.40)";

  /************************************
   * 💠 UI
   ************************************/
  panelApi.setHTML(`
    <div class="tbo-col" style="gap:12px;">
      <div class="tbo-row" style="gap:10px; align-items:center; justify-content:space-between;">
        <div style="font-size:10px; color:${MUTED}; font-weight:600;">
          Filters
        </div>

        <button id="bsrToggle" class="tbo-btn"
          style="
            padding:6px 10px;
            border:1px solid ${BORDER};
            background: rgba(255,255,255,0.03);
            color:${TEXT};
            border-radius:10px;
            font-weight:650;
          ">BSR</button>
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
        <div class="tbo-label" id="customerToggle"
          style="cursor:pointer; display:flex; align-items:center; justify-content:space-between;">
          <span>Customer</span>
          <span style="opacity:0.8;">▼</span>
        </div>

        <div id="customerOptionsContainer"
          style="
            display:none;
            margin-top:8px;
            border:1px solid ${BORDER};
            border-radius:12px;
            padding:8px;
            max-height:180px;
            overflow:auto;
            background: rgba(255,255,255,0.02);
          ">
          ${customerOptions
            .map((opt) => `
              <div data-value="${escapeHtml(opt)}"
                style="
                  padding:7px 8px;
                  border-radius:10px;
                  cursor:pointer;
                  font-size:12px;
                  font-weight:450;
                  border:1px solid transparent;
                "
              >${escapeHtml(opt)}</div>
            `)
            .join("")}
        </div>
      </div>

      <div class="tbo-row" style="gap:10px; margin-top:2px;">
        <button class="tbo-btn tbo-btn-primary" id="applyFilter">Apply</button>
        <button class="tbo-btn" id="clearFilter">Clear</button>
      </div>
    </div>
  `);

  /************************************
   * 💠 STATE
   ************************************/
  let selectedCustomers = [];
  let bsrEnabled = false;

  const stakeFromInput = $("#stakeFrom");
  const tmMaxInput = $("#tmMax");
  const customerToggle = $("#customerToggle");
  const customerContainer = $("#customerOptionsContainer");
  const bsrButton = $("#bsrToggle");

  /************************************
   * 💠 CUSTOMER TOGGLE + SELECT
   ************************************/
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
      if (!val) return;

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

  /************************************
   * 💠 BSR TOGGLE
   ************************************/
  function paintBsrBtn() {
    bsrButton.style.background = bsrEnabled ? "rgba(125,206,160,0.25)" : "rgba(255,255,255,0.03)";
    bsrButton.style.border = bsrEnabled ? "1px solid rgba(125,206,160,0.35)" : `1px solid ${BORDER}`;
    bsrButton.style.color = TEXT;
  }

  bsrButton.onclick = () => {
    bsrEnabled = !bsrEnabled;
    paintBsrBtn();
    applyFilterToTable();
  };
  paintBsrBtn();

  /************************************
   * 💠 APPLY FILTERS (EDITADO CON SOMBRA SUAVE)
   ************************************/

  // Helper para aplicar/quitar la sombra suave a una celda
  const highlightElement = (el, apply) => {
    if (!el) return;
    if (apply) {
        // Sombra naranja suave y difuminada, sin afectar el contenido interno
        el.style.boxShadow = "0 0 15px rgba(240, 166, 74, 0.8)";
        el.style.borderRadius = "8px"; // Redondeo ligero para que la sombra se vea mejor
        el.style.transition = "box-shadow 0.2s ease";
    } else {
        el.style.boxShadow = "";
        el.style.borderRadius = "";
        el.style.transition = "";
    }
  };

  function applyFilterToTable() {
    const stakeFrom = parseFloat(stakeFromInput.value);
    const tmMax = parseFloat(tmMaxInput.value);

    // 1. Resetear estilos de fila y limpiar sombras de celdas internas
    document
      .querySelectorAll("tr[data-testid='bets-monitoring-table-row']")
      .forEach((row) => {
        row.style.background = "";
        row.style.outline = "";
        // Busca cualquier elemento interno que hayamos resaltado antes y le quita la sombra
        row.querySelectorAll('*').forEach(el => highlightElement(el, false));
      });

    document
      .querySelectorAll("tr[data-testid='bets-monitoring-table-row']")
      .forEach((row) => {
        let matchesNormal = false;
        let matchesBSR = false;

        // Total Stake >= stakeFrom
        const stakeCell = row.querySelector('[data-testid="bets-monitoring-table-row-total-stake-cell"]');
        if (stakeCell && !Number.isNaN(stakeFrom)) {
          const v = parseFloat((stakeCell.innerText || "").replace(/[^0-9.]/g, ""));
          if (!Number.isNaN(v) && v >= stakeFrom) {
            matchesNormal = true;
            highlightElement(stakeCell, true); // Aplica sombra a la celda de Stake
          }
        }

        // TM <= tmMax
        const tmCell = row.querySelector('[data-testid="theoretical-margin-value"]');
        if (tmCell && !Number.isNaN(tmMax)) {
          const v = parseFloat((tmCell.innerText || "").replace("%", "").trim());
          if (!Number.isNaN(v) && v <= tmMax) {
            matchesNormal = true;
            // Resaltamos el padre del valor numérico para que la sombra envuelva la zona del margen
            highlightElement(tmCell.parentElement, true);
          }
        }

        // Customer
        const custCell = row.querySelector('[data-testid="bets-monitoring-table-row-customer-classification"]');
        if (custCell) {
          const v = (custCell.innerText || "").trim();
          if (selectedCustomers.includes(v)) {
            matchesNormal = true;
            highlightElement(custCell, true); // Aplica sombra a la celda del Cliente
          }
        }

        // BSR
        const bsrCell = row.querySelector('[data-testid="bets-monitoring-table-row-bet-request"]');
        if (bsrEnabled && bsrCell && (bsrCell.innerText || "").trim() === "BSR") {
          matchesBSR = true;
        }

        // PRIORIDAD VISUAL (Estilo de fila completa - se mantiene igual)
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

    // Limpieza completa al dar click en Clear
    document.querySelectorAll("tr[data-testid='bets-monitoring-table-row']").forEach((row) => {
      row.style.background = "";
      row.style.outline = "";
      row.querySelectorAll('*').forEach(el => highlightElement(el, false));
    });

    customerContainer.querySelectorAll("[data-value]").forEach((d) => {
      highlightOption(d, false);
    });
  };

  /************************************
   * 💠 OBSERVER (re-aplica al cambiar tabla)
   ************************************/
  const table = document.querySelector("table");
  if (table) {
    const obs = new MutationObserver(() => {
      // Evitar re-aplicar demasiado agresivo si hay muchas mutaciones
      applyFilterToTable();
    });
    obs.observe(table, { childList: true, subtree: true });
  }
});
