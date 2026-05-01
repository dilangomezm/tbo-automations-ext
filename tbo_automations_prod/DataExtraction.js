// DataExtraction.js
(() => {
  if (!window.registerAutomation) return;

  const INTERNAL_AUTOMATIONS = {};

  INTERNAL_AUTOMATIONS.br_extraction = async () => {
    try {
      const CONTAINER_ID = "extractorbr-container";
      const STYLES_ID = "extractorbr-styles";

      document.getElementById(CONTAINER_ID)?.remove();
      document.getElementById(STYLES_ID)?.remove();

      const styles = document.createElement("style");
      styles.id = STYLES_ID;
      styles.textContent = `
        :root {
          --bg-base:#0B0D10;
          --bg-panel:#13161D;
          --border-color:rgba(255,255,255,0.10);
          --border-hover:rgba(255,255,255,0.14);
          --text-main:#E6E8EE;
          --text-muted:rgba(230,232,238,0.65);
          --accent-primary:rgba(240,166,74,0.95);
          --accent-secondary:rgba(200,133,51,0.95);
          --shadow:0 10px 30px rgba(0,0,0,0.45);
          --font-stack:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
        }

        #${CONTAINER_ID}{
          position:fixed;
          top:20px;
          right:20px;
          width:380px;
          background:var(--bg-base);
          border:1px solid var(--border-color);
          border-radius:14px;
          box-shadow:var(--shadow);
          font-family:var(--font-stack);
          color:var(--text-main);
          z-index:999999;
          overflow:hidden;
        }

        #${CONTAINER_ID} *{
          box-sizing:border-box;
        }

        .ebr-header{
          background:var(--bg-panel);
          padding:10px 14px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          border-bottom:1px solid var(--border-color);
          cursor:grab;
          user-select:none;
        }

        .ebr-title{
          font-size:13px;
          font-weight:650;
          letter-spacing:.3px;
        }

        .ebr-controls{
          display:flex;
          gap:6px;
        }

        .ebr-control-btn{
          background:transparent;
          border:none;
          color:var(--text-muted);
          cursor:pointer;
          font-size:12px;
          width:24px;
          height:24px;
          border-radius:6px;
        }

        .ebr-control-btn:hover{
          background:rgba(255,255,255,.05);
          color:var(--text-main);
        }

        .ebr-body{
          padding:14px;
          display:flex;
          flex-direction:column;
          gap:12px;
        }

        .ebr-minimized .ebr-body{
          display:none;
        }

        .ebr-card{
          background:rgba(255,255,255,.02);
          border:1px solid var(--border-color);
          border-radius:12px;
          padding:10px;
          display:flex;
          flex-direction:column;
          gap:8px;
        }

        .ebr-label{
          font-size:11px;
          color:var(--text-muted);
          font-weight:500;
        }

        .ebr-textarea{
          width:100%;
          background:var(--bg-panel);
          border:1px solid var(--border-color);
          color:var(--text-main);
          border-radius:8px;
          padding:8px 10px;
          font-size:11px;
          font-family:monospace;
          line-height:1.4;
          white-space:pre;
          height:250px;
          resize:vertical;
          outline:none;
        }

        .ebr-textarea:focus{
          border-color:var(--border-hover);
        }

        .ebr-btn-primary{
          background:linear-gradient(180deg,var(--accent-primary) 0%,var(--accent-secondary) 100%);
          color:#111;
          border:none;
          border-radius:12px;
          padding:10px;
          font-size:12px;
          font-weight:650;
          cursor:pointer;
          width:100%;
        }

        .ebr-btn-primary:hover{
          opacity:.9;
        }
      `;
      document.head.appendChild(styles);

      const modal = document.createElement("div");
      modal.id = CONTAINER_ID;

      modal.innerHTML = `
        <div class="ebr-header" id="ebr-header">
          <span class="ebr-title">BR Extraction</span>

          <div class="ebr-controls">
            <button class="ebr-control-btn" id="ebr-minimize" title="Minimize">_</button>
            <button class="ebr-control-btn" id="ebr-close" title="Close">✕</button>
          </div>
        </div>

        <div class="ebr-body">
          <div class="ebr-card">
            <button class="ebr-btn-primary" id="ebr-run">
              Run Extraction
            </button>
          </div>

          <div class="ebr-card">
            <label class="ebr-label">Results</label>

            <textarea
              class="ebr-textarea"
              id="ebr-output"
              readonly
            ></textarea>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const header = modal.querySelector("#ebr-header");
      const btnClose = modal.querySelector("#ebr-close");
      const btnMinimize = modal.querySelector("#ebr-minimize");
      const btnRun = modal.querySelector("#ebr-run");
      const output = modal.querySelector("#ebr-output");

      let isDragging = false;
      let currentX = 0;
      let currentY = 0;
      let initialX = 0;
      let initialY = 0;
      let xOffset = 0;
      let yOffset = 0;

      header.addEventListener("mousedown", (e) => {
        if (e.target.closest(".ebr-controls")) return;

        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
      });

      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        e.preventDefault();

        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        modal.style.transform =
          `translate3d(${currentX}px, ${currentY}px, 0)`;
      });

      document.addEventListener("mouseup", () => {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
      });

      btnClose.onclick = () => {
        modal.remove();
        styles.remove();
      };

      btnMinimize.onclick = () => {
        modal.classList.toggle("ebr-minimized");
      };

      const normalize = (txt) =>
        String(txt || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const formatOdd = (value) => {
        if (value === null || value === undefined || value === "") {
          return "-";
        }

        const num = Number(value);

        if (!Number.isFinite(num)) {
          return String(value);
        }

        return Number.isInteger(num)
          ? String(num)
          : String(num);
      };

      const formatName = (text) => {
        const lower = String(text || "")
          .trim()
          .toLowerCase();

        return lower.replace(
          /(^|[\s,-])([a-záéíóúàèìòùäëïöüâêîôûãõñç])/g,
          (match, separator, letter) =>
            separator + letter.toUpperCase()
        );
      };

      const copyToClipboard = async (text) => {
        if (!text) return false;

        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
          }

          output.focus();
          output.select();

          return document.execCommand("copy");
        } catch {
          return false;
        }
      };

      const getEventIdFromUrl = () => {
        const match = window.location.href.match(
          /\/competitions\/([^/?#]+)/i
        );

        return match
          ? decodeURIComponent(match[1])
          : "";
      };

      const getMarketUrnFromUrl = () => {
        const match = window.location.href.match(
          /\/markets\/([^/?#]+)/i
        );

        return match
          ? decodeURIComponent(match[1])
          : "";
      };

      const fetchJson = async (endpoint, eventId) => {
        const url =
          `/betradar-portal-outrights/api/odds/${endpoint}/${eventId}?`;

        const res = await fetch(url, {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });

        if (!res.ok) {
          throw new Error(
            `${endpoint} fetch failed: ${res.status} ${res.statusText}`
          );
        }

        return await res.json();
      };

      const getMarketFromOddsJson = (
        json,
        marketUrn
      ) => {
        const marketOdds =
          json?.marketOdds || {};

        const markets =
          Object.values(marketOdds);

        if (!markets.length) return null;

        if (marketUrn) {
          const byUrn = markets.find(
            (m) =>
              m?.marketUrn === marketUrn ||
              m?.odds?.marketUrn === marketUrn
          );

          if (byUrn) return byUrn;
        }

        if (markets.length === 1) {
          return markets[0];
        }

        return null;
      };

      const getAvailableMarkets = (json) => {
        return Object.values(
          json?.marketOdds || {}
        )
          .map(
            (m) =>
              `${m.marketUrn || "-"} | ${m.marketName || "-"}`
          )
          .join("\n");
      };

      const ensureRow = (
        rowsMap,
        outcome
      ) => {
        const id =
          outcome?.outcomeUrn ||
          outcome?.outcomeName;

        if (!id || !outcome?.outcomeName) {
          return null;
        }

        if (!rowsMap.has(id)) {
          rowsMap.set(id, {
            id,
            starters: formatName(outcome.outcomeName),
            own: "-",
            br: "-",
            kambi2: "-",
            betsson: "-"
          });
        }

        return rowsMap.get(id);
      };

      const addSimpleOdds = (
        rowsMap,
        market,
        columnKey
      ) => {
        const outcomes =
          market?.odds?.outcomes || {};

        for (const outcome of Object.values(outcomes)) {
          const row =
            ensureRow(rowsMap, outcome);

          if (!row) continue;

          row[columnKey] =
            formatOdd(outcome.outcomeValue);
        }
      };

      const addOtherOdds = (
        rowsMap,
        market
      ) => {
        const bookmakerOdds =
          market?.bookmakerOdds || {};

        for (const book of Object.values(bookmakerOdds)) {
          const bookmakerName =
            normalize(book?.bookmakerName);

          let columnKey = null;

          if (bookmakerName.includes("kambi")) {
            columnKey = "kambi2";
          }

          if (bookmakerName.includes("betsson")) {
            columnKey = "betsson";
          }

          if (!columnKey) continue;

          for (const outcome of Object.values(book?.outcomes || {})) {
            const row =
              ensureRow(rowsMap, outcome);

            if (!row) continue;

            row[columnKey] =
              formatOdd(outcome.outcomeValue);
          }
        }
      };

      const buildTsv = (rowsMap) => {
        const rows =
          Array.from(rowsMap.values())
            .sort((a, b) => {
              const ownA =
                Number(a.own);

              const ownB =
                Number(b.own);

              if (
                Number.isFinite(ownA) &&
                Number.isFinite(ownB)
              ) {
                return ownA - ownB;
              }

              return a.starters.localeCompare(
                b.starters
              );
            });

        const lines = [];

        lines.push(
          "Starters\tOwn\tBR\tKambi2\tBetsson"
        );

        for (const row of rows) {
          lines.push([
            row.starters || "-",
            row.own || "-",
            row.br || "-",
            row.kambi2 || "-",
            row.betsson || "-"
          ].join("\t"));
        }

        return lines.join("\n");
      };

      btnRun.onclick = async () => {
        const eventId =
          getEventIdFromUrl();

        const marketUrn =
          getMarketUrnFromUrl();

        if (!eventId) {
          output.value =
            "Error: Event ID could not be detected from URL.\n\n" +
            "Expected URL pattern:\n" +
            "/competitions/ID/markets/MARKET";

          return;
        }

        if (!marketUrn) {
          output.value =
            "Error: Market ID could not be detected from URL.\n\n" +
            "Expected URL pattern:\n" +
            "/competitions/ID/markets/MARKET";

          return;
        }

        output.value =
          "Fetching data...\n\n" +
          `Detected Event ID: ${eventId}\n` +
          `Detected Market ID: ${marketUrn}\n\n` +
          "ownOdds: pending\n" +
          "brOdds: pending\n" +
          "otherOdds: pending";

        try {
          const [
            ownJson,
            brJson,
            otherJson
          ] = await Promise.all([
            fetchJson(
              "ownOdds",
              eventId
            ),
            fetchJson(
              "brOdds",
              eventId
            ),
            fetchJson(
              "otherOdds",
              eventId
            )
          ]);

          const ownMarket =
            getMarketFromOddsJson(
              ownJson,
              marketUrn
            );

          const brMarket =
            getMarketFromOddsJson(
              brJson,
              marketUrn
            );

          const otherMarket =
            getMarketFromOddsJson(
              otherJson,
              marketUrn
            );

          if (!ownMarket) {
            output.value =
              "Error: Market not found in ownOdds.\n\n" +
              "Available markets:\n" +
              getAvailableMarkets(
                ownJson
              );

            return;
          }

          if (!brMarket) {
            output.value =
              "Error: Market not found in brOdds.\n\n" +
              "Available markets:\n" +
              getAvailableMarkets(
                brJson
              );

            return;
          }

          if (!otherMarket) {
            output.value =
              "Error: Market not found in otherOdds.\n\n" +
              "Available markets:\n" +
              getAvailableMarkets(
                otherJson
              );

            return;
          }

          const rowsMap =
            new Map();

          addSimpleOdds(
            rowsMap,
            ownMarket,
            "own"
          );

          addSimpleOdds(
            rowsMap,
            brMarket,
            "br"
          );

          addOtherOdds(
            rowsMap,
            otherMarket
          );

          if (!rowsMap.size) {
            output.value =
              "Error: No outcomes found.";

            return;
          }

          const finalText =
            buildTsv(rowsMap);

          output.value =
            finalText;

          const copied =
            await copyToClipboard(
              finalText
            );

          if (!copied) {
            output.value =
              finalText +
              "\n\n[Warning: Auto-copy failed. Please copy manually.]";
          }

        } catch (err) {
          output.value =
            `Error: ${String(
              err?.message || err
            )}`;
        }
      };

      return { ok: true };

    } catch (err) {
      console.error(
        "[BR Extraction] Error:",
        err
      );

      return {
        ok: false,
        error: String(
          err?.message || err
        )
      };
    }
  };

  INTERNAL_AUTOMATIONS.AsianMonitorExtraction = async () => {
    try {
      const normalizeMarketName = (value) => {
        return String(value || "")
          .replace(/\u00a0/g, " ")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " ");
      };

      const cleanText = (value) => {
        return String(value || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim();
      };

      const uniqueMarketsByNameAndKey = (markets) => {
        const seen = new Set();
        const result = [];

        markets.forEach((market) => {
          const key = `${normalizeMarketName(market.name)}|${market.rowKey || ""}`;
          if (!normalizeMarketName(market.name) || seen.has(key)) return;
          seen.add(key);
          result.push(market);
        });

        return result;
      };

      const cssEscapeSafe = (value) => {
        if (window.CSS && typeof window.CSS.escape === "function") {
          return window.CSS.escape(value);
        }

        return String(value || "").replace(/["\\]/g, "\\$&");
      };

      const removeExistingAsianMonitorUI = () => {
        const existingModal = document.getElementById("asian-monitor-extractor-container");
        if (existingModal) existingModal.remove();

        const existingStyles = document.getElementById("asian-monitor-extractor-styles");
        if (existingStyles) existingStyles.remove();
      };

      const injectAsianMonitorStyles = () => {
        const existingStyles = document.getElementById("asian-monitor-extractor-styles");
        if (existingStyles) existingStyles.remove();

        const styles = document.createElement("style");
        styles.id = "asian-monitor-extractor-styles";
        styles.innerHTML = `
          :root {
              --am-bg-base: #0B0D10;
              --am-bg-panel: #13161D;
              --am-border-color: rgba(255, 255, 255, 0.10);
              --am-border-hover: rgba(255, 255, 255, 0.14);
              --am-text-main: #E6E8EE;
              --am-text-muted: rgba(230, 232, 238, 0.65);
              --am-accent-primary: rgba(240, 166, 74, 0.95);
              --am-accent-secondary: rgba(200, 133, 51, 0.95);
              --am-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
              --am-font-stack: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
          }

          #asian-monitor-extractor-container {
              position: fixed;
              top: 20px;
              right: 20px;
              width: 420px;
              max-height: 82vh;
              background-color: var(--am-bg-base);
              border: 1px solid var(--am-border-color);
              border-radius: 14px;
              box-shadow: var(--am-shadow);
              font-family: var(--am-font-stack);
              color: var(--am-text-main);
              z-index: 999999;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              transition: height 0.2s ease;
          }

          #asian-monitor-extractor-container * {
              box-sizing: border-box;
          }

          .am-header {
              background-color: var(--am-bg-panel);
              padding: 10px 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid var(--am-border-color);
              cursor: grab;
              user-select: none;
              flex-shrink: 0;
          }

          .am-header:active { cursor: grabbing; }

          .am-title {
              font-size: 13px;
              font-weight: 650;
              color: var(--am-text-main);
              letter-spacing: 0.3px;
          }

          .am-window-controls {
              display: flex;
              gap: 6px;
          }

          .am-control-btn {
              background: transparent;
              border: none;
              color: var(--am-text-muted);
              cursor: pointer;
              font-size: 12px;
              width: 24px;
              height: 24px;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s;
          }

          .am-control-btn:hover {
              background-color: rgba(255,255,255,0.05);
              color: var(--am-text-main);
          }

          .am-body {
              padding: 14px;
              display: flex;
              flex-direction: column;
              gap: 12px;
              overflow-y: auto;
          }

          .am-minimized .am-body {
              display: none;
          }

          .am-card-row {
              background-color: rgba(255, 255, 255, 0.02);
              border: 1px solid var(--am-border-color);
              border-radius: 12px;
              padding: 10px;
              display: flex;
              flex-direction: column;
              gap: 8px;
          }

          .am-label {
              font-size: 11px;
              color: var(--am-text-muted);
              font-weight: 500;
          }

          .am-textarea {
              width: 100%;
              background-color: var(--am-bg-panel);
              border: 1px solid var(--am-border-color);
              color: var(--am-text-main);
              border-radius: 8px;
              padding: 8px 10px;
              font-size: 12px;
              font-family: monospace;
              outline: none;
              transition: border-color 0.2s;
              height: 150px;
              resize: vertical;
              line-height: 1.4;
              white-space: pre;
          }

          .am-textarea:focus {
              border-color: var(--am-border-hover);
          }

          .am-btn-primary {
              background: linear-gradient(180deg, var(--am-accent-primary) 0%, var(--am-accent-secondary) 100%);
              color: #111;
              border: none;
              border-radius: 12px;
              padding: 10px;
              font-size: 12px;
              font-weight: 650;
              cursor: pointer;
              transition: opacity 0.2s;
              width: 100%;
          }

          .am-btn-primary:hover { opacity: 0.9; }

          .am-btn-secondary {
              background-color: rgba(255, 255, 255, 0.03);
              border: 1px solid var(--am-border-color);
              color: var(--am-text-main);
              border-radius: 12px;
              padding: 8px;
              font-size: 11px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              width: 100%;
          }

          .am-btn-secondary:hover {
              background-color: rgba(255, 255, 255, 0.06);
              border-color: var(--am-border-hover);
          }

          .am-btn-group {
              display: flex;
              flex-direction: column;
              gap: 10px;
          }

          .am-market-list {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              max-height: 220px;
              overflow-y: auto;
              padding: 2px;
          }

          .am-market-option {
              display: flex;
              align-items: flex-start;
              gap: 7px;
              background-color: rgba(255, 255, 255, 0.025);
              border: 1px solid var(--am-border-color);
              border-radius: 9px;
              padding: 7px;
              cursor: pointer;
              min-height: 34px;
              transition: all 0.15s;
          }

          .am-market-option:hover {
              border-color: var(--am-border-hover);
              background-color: rgba(255, 255, 255, 0.045);
          }

          .am-market-option input {
              margin: 2px 0 0 0;
              accent-color: var(--am-accent-primary);
              cursor: pointer;
              flex-shrink: 0;
          }

          .am-market-option span {
              font-size: 11px;
              line-height: 1.3;
              color: var(--am-text-main);
              word-break: break-word;
          }

          .am-market-empty {
              grid-column: 1 / -1;
              font-size: 11px;
              color: var(--am-text-muted);
              padding: 8px;
              border: 1px dashed var(--am-border-color);
              border-radius: 9px;
              text-align: center;
          }
        `;
        document.head.appendChild(styles);
        return styles;
      };

      const makeDraggable = (modal, header) => {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener("mousedown", dragStart);
        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", dragEnd);

        function dragStart(e) {
          if (e.target.closest(".am-window-controls")) return;
          initialX = e.clientX - xOffset;
          initialY = e.clientY - yOffset;
          isDragging = true;
        }

        function drag(e) {
          if (!isDragging) return;
          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
          xOffset = currentX;
          yOffset = currentY;
          modal.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }

        function dragEnd() {
          initialX = currentX;
          initialY = currentY;
          isDragging = false;
        }
      };

      const setupWindowControls = (modal, styles) => {
        const header = document.getElementById("am-header");
        const btnMinimize = document.getElementById("am-btn-minimize");
        const btnClose = document.getElementById("am-btn-close");

        makeDraggable(modal, header);

        btnClose.onclick = () => {
          modal.remove();
          styles.remove();
        };

        btnMinimize.onclick = () => {
          modal.classList.toggle("am-minimized");
        };
      };

      const copyTextToClipboard = async (text, outputArea) => {
        if (!text || text.startsWith("Error:") || text.startsWith("Extracting")) return false;

        const originalValue = outputArea.value;

        const setCopiedFeedback = () => {
          outputArea.value = `${originalValue}\n\nCopied to clipboard.`;
          setTimeout(() => {
            if (outputArea && outputArea.value.endsWith("\n\nCopied to clipboard.")) {
              outputArea.value = originalValue;
            }
          }, 1800);
        };

        const fallbackCopy = () => {
          try {
            outputArea.focus();
            outputArea.select();
            const ok = document.execCommand("copy");
            if (ok) setCopiedFeedback();
            return ok;
          } catch (err) {
            alert("Auto-copy failed. Please press Ctrl+C to copy.");
            return false;
          }
        };

        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(text);
            setCopiedFeedback();
            return true;
          } catch (err) {
            return fallbackCopy();
          }
        }

        return fallbackCopy();
      };

      const renderMarketCheckboxes = (container, markets, selectedState) => {
        selectedState.market = null;
        container.innerHTML = "";

        if (!markets || markets.length === 0) {
          container.innerHTML = `<div class="am-market-empty">No markets detected.</div>`;
          return;
        }

        markets.forEach((market, index) => {
          const id = `am-market-check-${index}-${Math.random().toString(16).slice(2)}`;

          const label = document.createElement("label");
          label.className = "am-market-option";
          label.setAttribute("for", id);

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = id;

          const text = document.createElement("span");
          text.textContent = market.name;

          checkbox.addEventListener("change", () => {
            const allChecks = container.querySelectorAll("input[type='checkbox']");
            allChecks.forEach((check) => {
              if (check !== checkbox) check.checked = false;
            });

            selectedState.market = checkbox.checked ? market : null;
          });

          label.appendChild(checkbox);
          label.appendChild(text);
          container.appendChild(label);
        });
      };

      const extractToggleNameFromMarketRow = (row) => {
        const onclickValue = row.getAttribute("onclick") || "";

        let match = onclickValue.match(/toggByName\(['"]([^'"]+)['"]\)/i);
        if (match && match[1]) return match[1];

        match = onclickValue.match(/['"]([^'"]+)['"]/);
        if (match && match[1]) return match[1];

        return "";
      };

      const getMarketNameFromMarketRow = (row) => {
        const nameCell = row.querySelector("td.bt");
        if (!nameCell) return "";

        const clone = nameCell.cloneNode(true);
        clone.querySelectorAll("span, script, style").forEach((el) => el.remove());

        return cleanText(clone.textContent);
      };

      const collectAsianMonitorTableHeaders = (table) => {
        const headers = [];
        const headerRow = table ? table.querySelector("tr.trbook") : null;

        if (!headerRow) {
          return ["Expekt", "Average"];
        }

        const ths = Array.from(headerRow.querySelectorAll("th"));
        ths.forEach((th) => {
          const isExpektColumn = th.classList.contains("cl");
          const isAverageColumn = cleanText(th.textContent).toLowerCase() === "average";
          const isBookColumn = th.classList.contains("heabook");

          if (!isExpektColumn && !isAverageColumn && !isBookColumn) return;

          let header = "";

          if (isBookColumn) {
            header = cleanText(th.textContent).replace(/·+/g, "").trim();
          } else {
            header = cleanText(th.textContent);
          }

          if (header) headers.push(header);
        });

        return headers.length ? headers : ["Expekt", "Average"];
      };

      const getRowsForMarketByKey = (rowKey, marketRow) => {
        if (!rowKey) return [];

        const selector = `tr[name="${cssEscapeSafe(rowKey)}"]`;
        let rows = Array.from(document.querySelectorAll(selector));

        rows = rows.filter((row) => row.querySelector("td.player"));

        if (rows.length > 0) return rows;

        const fallbackRows = [];
        let current = marketRow ? marketRow.nextElementSibling : null;

        while (current && !current.classList.contains("trplay") && !current.classList.contains("trevent")) {
          if (current.querySelector && current.querySelector("td.player")) {
            fallbackRows.push(current);
          }
          current = current.nextElementSibling;
        }

        return fallbackRows;
      };

      const collectAvailablePlayerPropsMarkets = () => {
        const markets = [];
        const marketRows = document.querySelectorAll("tr.trplay");

        marketRows.forEach((row) => {
          const name = getMarketNameFromMarketRow(row);
          const rowKey = extractToggleNameFromMarketRow(row);

          if (!name || !rowKey) return;
          if (normalizeMarketName(name).includes("outrights:")) return;

          const relatedRows = getRowsForMarketByKey(rowKey, row);
          const hasPlayerRows = relatedRows.some((relatedRow) => relatedRow.querySelector("td.player"));

          if (!hasPlayerRows) return;

          markets.push({
            name,
            row,
            rowKey
          });
        });

        return uniqueMarketsByNameAndKey(markets);
      };

      const collectAvailableOutrightsMarkets = () => {
        const markets = [];
        const marketRows = document.querySelectorAll("tr.trplay");

        marketRows.forEach((row) => {
          const name = getMarketNameFromMarketRow(row);
          const rowKey = extractToggleNameFromMarketRow(row);

          if (!name || !rowKey) return;
          if (!normalizeMarketName(name).includes("outrights:")) return;

          const relatedRows = getRowsForMarketByKey(rowKey, row);
          const hasPlayerRows = relatedRows.some((relatedRow) => relatedRow.querySelector("td.player"));

          if (!hasPlayerRows) return;

          markets.push({
            name,
            row,
            rowKey
          });
        });

        return uniqueMarketsByNameAndKey(markets);
      };

      const getRowsForMarket = (market) => {
        if (!market || !market.rowKey) return [];
        return getRowsForMarketByKey(market.rowKey, market.row);
      };

      const extractOddsFromMarketRow = (row) => {
        const values = [];

        const expektCell = row.querySelector("td.datc");
        const averageCell = row.querySelector("td.data");
        const bookCells = Array.from(row.querySelectorAll("td.datb"));

        values.push(cleanText(expektCell ? expektCell.textContent : "") || "-");
        values.push(cleanText(averageCell ? averageCell.textContent : "") || "-");

        bookCells.forEach((cell) => {
          const quota = cell.querySelector(".quota");
          const value = quota ? cleanText(quota.textContent) : cleanText(cell.textContent);
          values.push(value || "-");
        });

        return values;
      };

      const extractGenericPlayerLikeMarket = (market, firstColumnHeader) => {
        const marketRows = getRowsForMarket(market);

        if (!marketRows || marketRows.length === 0) {
          return {
            ok: false,
            error: "Error: No participants or odds found.\nThe selected market might be closed, collapsed incorrectly, or unavailable."
          };
        }

        const table = market.row ? market.row.closest("table") : document.querySelector("table.tevent");
        const headers = collectAsianMonitorTableHeaders(table);

        const rows = [];

        marketRows.forEach((row) => {
          const participantCell = row.querySelector("td.player");
          const participant = cleanText(participantCell ? participantCell.textContent : "");

          if (!participant) return;

          const odds = extractOddsFromMarketRow(row);

          rows.push({
            participant,
            odds
          });
        });

        if (rows.length === 0) {
          return {
            ok: false,
            error: "Error: No valid participant rows found."
          };
        }

        let maxOddsLength = 0;
        rows.forEach((row) => {
          if (row.odds.length > maxOddsLength) maxOddsLength = row.odds.length;
        });

        const finalHeaders = headers.slice();

        while (finalHeaders.length < maxOddsLength) {
          finalHeaders.push(`Book ${finalHeaders.length - 1}`);
        }

        let output = firstColumnHeader;
        finalHeaders.forEach((header) => {
          output += `\t${header}`;
        });
        output += "\n";

        rows.forEach((row) => {
          output += `${row.participant}`;

          for (let i = 0; i < finalHeaders.length; i++) {
            const odd = row.odds[i] !== undefined && row.odds[i] !== "" ? row.odds[i] : "-";
            output += `\t${odd}`;
          }

          output += "\n";
        });

        return {
          ok: true,
          output
        };
      };

      const extractPlayerPropsMarket = (market) => {
        return extractGenericPlayerLikeMarket(market, "Player");
      };

      const extractOutrightsMarket = (market) => {
        return extractGenericPlayerLikeMarket(market, "Outcome");
      };

      const createMarketTypeSelectorUI = () => {
        removeExistingAsianMonitorUI();
        const styles = injectAsianMonitorStyles();

        const modal = document.createElement("div");
        modal.id = "asian-monitor-extractor-container";

        modal.innerHTML = `
          <div class="am-header" id="am-header">
              <span class="am-title">Asian Monitor Extractor</span>
              <div class="am-window-controls">
                  <button class="am-control-btn" id="am-btn-minimize" title="Minimize">_</button>
                  <button class="am-control-btn" id="am-btn-close" title="Close">✕</button>
              </div>
          </div>
          <div class="am-body" id="am-body">
              <div class="am-card-row">
                  <label class="am-label">What type of markets are we going to extract?</label>
                  <div class="am-btn-group">
                      <button class="am-btn-primary" id="am-btn-player-props">Player Props</button>
                      <button class="am-btn-primary" id="am-btn-outrights">Outrights</button>
                  </div>
              </div>
          </div>
        `;

        document.body.appendChild(modal);
        setupWindowControls(modal, styles);

        document.getElementById("am-btn-player-props").onclick = () => {
          createPlayerPropsExtractorUI();
        };

        document.getElementById("am-btn-outrights").onclick = () => {
          createOutrightsExtractorUI();
        };
      };

      const createPlayerPropsExtractorUI = () => {
        removeExistingAsianMonitorUI();
        const styles = injectAsianMonitorStyles();

        const modal = document.createElement("div");
        modal.id = "asian-monitor-extractor-container";

        modal.innerHTML = `
          <div class="am-header" id="am-header">
              <span class="am-title">Asian Monitor Player Props Extractor</span>
              <div class="am-window-controls">
                  <button class="am-control-btn" id="am-btn-minimize" title="Minimize">_</button>
                  <button class="am-control-btn" id="am-btn-close" title="Close">✕</button>
              </div>
          </div>
          <div class="am-body" id="am-body">
              <div class="am-card-row">
                  <button class="am-btn-primary" id="am-btn-detect-player-markets">Detect Markets</button>
                  <div class="am-market-list" id="am-player-market-list">
                      <div class="am-market-empty">Click Detect Markets to load available markets.</div>
                  </div>
                  <button class="am-btn-primary" id="am-btn-run">Run Extraction</button>
              </div>

              <div class="am-card-row">
                  <label class="am-label">Results</label>
                  <textarea class="am-textarea" id="am-output" readonly placeholder="Extracted data will appear here..."></textarea>
              </div>
          </div>
        `;

        document.body.appendChild(modal);
        setupWindowControls(modal, styles);

        const btnDetect = document.getElementById("am-btn-detect-player-markets");
        const marketList = document.getElementById("am-player-market-list");
        const btnRun = document.getElementById("am-btn-run");
        const outputArea = document.getElementById("am-output");
        const selectedState = { market: null };

        btnDetect.onclick = () => {
          const markets = collectAvailablePlayerPropsMarkets();
          renderMarketCheckboxes(marketList, markets, selectedState);
          outputArea.value = markets.length
            ? `${markets.length} markets detected. Select one market and run extraction.`
            : "Error: No player props markets detected.";
        };

        btnRun.onclick = async () => {
          if (!selectedState.market) {
            outputArea.value = "Error: Please select one market.";
            return;
          }

          outputArea.value = "Extracting data.";

          const result = extractPlayerPropsMarket(selectedState.market);

          if (!result || !result.ok) {
            outputArea.value = result && result.error ? result.error : "Error: Extraction failed.";
            return;
          }

          outputArea.value = result.output;
          await copyTextToClipboard(result.output, outputArea);
        };
      };

      const createOutrightsExtractorUI = () => {
        removeExistingAsianMonitorUI();
        const styles = injectAsianMonitorStyles();

        const modal = document.createElement("div");
        modal.id = "asian-monitor-extractor-container";

        modal.innerHTML = `
          <div class="am-header" id="am-header">
              <span class="am-title">Asian Monitor Outrights Extractor</span>
              <div class="am-window-controls">
                  <button class="am-control-btn" id="am-btn-minimize" title="Minimize">_</button>
                  <button class="am-control-btn" id="am-btn-close" title="Close">✕</button>
              </div>
          </div>
          <div class="am-body" id="am-body">
              <div class="am-card-row">
                  <button class="am-btn-primary" id="am-btn-detect-outrights-markets">Detect Markets</button>
                  <div class="am-market-list" id="am-outrights-market-list">
                      <div class="am-market-empty">Click Detect Markets to load available outright markets.</div>
                  </div>
                  <button class="am-btn-primary" id="am-btn-run">Run Extraction</button>
              </div>

              <div class="am-card-row">
                  <label class="am-label">Results</label>
                  <textarea class="am-textarea" id="am-output" readonly placeholder="Extracted data will appear here..."></textarea>
              </div>
          </div>
        `;

        document.body.appendChild(modal);
        setupWindowControls(modal, styles);

        const btnDetect = document.getElementById("am-btn-detect-outrights-markets");
        const marketList = document.getElementById("am-outrights-market-list");
        const btnRun = document.getElementById("am-btn-run");
        const outputArea = document.getElementById("am-output");
        const selectedState = { market: null };

        btnDetect.onclick = () => {
          const markets = collectAvailableOutrightsMarkets();
          renderMarketCheckboxes(marketList, markets, selectedState);
          outputArea.value = markets.length
            ? `${markets.length} outright markets detected. Select one market and run extraction.`
            : "Error: No outright markets detected.";
        };

        btnRun.onclick = async () => {
          if (!selectedState.market) {
            outputArea.value = "Error: Please select one market.";
            return;
          }

          outputArea.value = "Extracting data.";

          const result = extractOutrightsMarket(selectedState.market);

          if (!result || !result.ok) {
            outputArea.value = result && result.error ? result.error : "Error: Extraction failed.";
            return;
          }

          outputArea.value = result.output;
          await copyTextToClipboard(result.output, outputArea);
        };
      };

      createMarketTypeSelectorUI();

      return { ok: true };
    } catch (err) {
      console.error("[AsianMonitorExtraction] Error:", err);
      return { ok: false, error: String(err?.message || err) };
    }
  };

  INTERNAL_AUTOMATIONS.ExtraccionBet365 = async () => {
    try {
      const normalizeMarketName = (value) => {
        return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
      };

      const uniqueMarketsByName = (markets) => {
        const seen = new Set();
        const result = [];

        markets.forEach((market) => {
          const key = normalizeMarketName(market.name);
          if (!key || seen.has(key)) return;
          seen.add(key);
          result.push(market);
        });

        return result;
      };

      const removeExistingBet365UI = () => {
        const existingModal = document.getElementById("b365-extractor-container");
        if (existingModal) existingModal.remove();

        const existingStyles = document.getElementById("b365-extractor-styles");
        if (existingStyles) existingStyles.remove();
      };

      const injectBet365Styles = () => {
        const existingStyles = document.getElementById("b365-extractor-styles");
        if (existingStyles) existingStyles.remove();

        const styles = document.createElement("style");
        styles.id = "b365-extractor-styles";
        styles.innerHTML = `
          :root {
              --bg-base: #0B0D10;
              --bg-panel: #13161D;
              --border-color: rgba(255, 255, 255, 0.10);
              --border-hover: rgba(255, 255, 255, 0.14);
              --text-main: #E6E8EE;
              --text-muted: rgba(230, 232, 238, 0.65);
              --accent-primary: rgba(240, 166, 74, 0.95);
              --accent-secondary: rgba(200, 133, 51, 0.95);
              --shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
              --font-stack: system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
          }

          #b365-extractor-container {
              position: fixed;
              top: 20px;
              right: 20px;
              width: 420px;
              max-height: 82vh;
              background-color: var(--bg-base);
              border: 1px solid var(--border-color);
              border-radius: 14px;
              box-shadow: var(--shadow);
              font-family: var(--font-stack);
              color: var(--text-main);
              z-index: 999999;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              transition: height 0.2s ease;
          }

          #b365-extractor-container * {
              box-sizing: border-box;
          }

          .b365-header {
              background-color: var(--bg-panel);
              padding: 10px 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid var(--border-color);
              cursor: grab;
              user-select: none;
              flex-shrink: 0;
          }

          .b365-header:active { cursor: grabbing; }

          .b365-title {
              font-size: 13px;
              font-weight: 650;
              color: var(--text-main);
              letter-spacing: 0.3px;
          }

          .b365-window-controls {
              display: flex;
              gap: 6px;
          }

          .b365-control-btn {
              background: transparent;
              border: none;
              color: var(--text-muted);
              cursor: pointer;
              font-size: 12px;
              width: 24px;
              height: 24px;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s;
          }

          .b365-control-btn:hover {
              background-color: rgba(255,255,255,0.05);
              color: var(--text-main);
          }

          .b365-body {
              padding: 14px;
              display: flex;
              flex-direction: column;
              gap: 12px;
              overflow-y: auto;
          }

          .b365-minimized .b365-body {
              display: none;
          }

          .b365-card-row {
              background-color: rgba(255, 255, 255, 0.02);
              border: 1px solid var(--border-color);
              border-radius: 12px;
              padding: 10px;
              display: flex;
              flex-direction: column;
              gap: 8px;
          }

          .b365-label {
              font-size: 11px;
              color: var(--text-muted);
              font-weight: 500;
          }

          .b365-textarea {
              width: 100%;
              background-color: var(--bg-panel);
              border: 1px solid var(--border-color);
              color: var(--text-main);
              border-radius: 8px;
              padding: 8px 10px;
              font-size: 12px;
              font-family: monospace;
              outline: none;
              transition: border-color 0.2s;
              height: 150px;
              resize: vertical;
              line-height: 1.4;
              white-space: pre;
          }

          .b365-textarea:focus {
              border-color: var(--border-hover);
          }

          .b365-btn-primary {
              background: linear-gradient(180deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
              color: #111;
              border: none;
              border-radius: 12px;
              padding: 10px;
              font-size: 12px;
              font-weight: 650;
              cursor: pointer;
              transition: opacity 0.2s;
              width: 100%;
          }

          .b365-btn-primary:hover { opacity: 0.9; }

          .b365-btn-secondary {
              background-color: rgba(255, 255, 255, 0.03);
              border: 1px solid var(--border-color);
              color: var(--text-main);
              border-radius: 12px;
              padding: 8px;
              font-size: 11px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
              width: 100%;
          }

          .b365-btn-secondary:hover {
              background-color: rgba(255, 255, 255, 0.06);
              border-color: var(--border-hover);
          }

          .b365-btn-group {
              display: flex;
              flex-direction: column;
              gap: 10px;
          }

          .b365-market-list {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              max-height: 220px;
              overflow-y: auto;
              padding: 2px;
          }

          .b365-market-option {
              display: flex;
              align-items: flex-start;
              gap: 7px;
              background-color: rgba(255, 255, 255, 0.025);
              border: 1px solid var(--border-color);
              border-radius: 9px;
              padding: 7px;
              cursor: pointer;
              min-height: 34px;
              transition: all 0.15s;
          }

          .b365-market-option:hover {
              border-color: var(--border-hover);
              background-color: rgba(255, 255, 255, 0.045);
          }

          .b365-market-option input {
              margin: 2px 0 0 0;
              accent-color: var(--accent-primary);
              cursor: pointer;
              flex-shrink: 0;
          }

          .b365-market-option span {
              font-size: 11px;
              line-height: 1.3;
              color: var(--text-main);
              word-break: break-word;
          }

          .b365-market-empty {
              grid-column: 1 / -1;
              font-size: 11px;
              color: var(--text-muted);
              padding: 8px;
              border: 1px dashed var(--border-color);
              border-radius: 9px;
              text-align: center;
          }
        `;
        document.head.appendChild(styles);
        return styles;
      };

      const makeDraggable = (modal, header) => {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener("mousedown", dragStart);
        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", dragEnd);

        function dragStart(e) {
          if (e.target.closest(".b365-window-controls")) return;
          initialX = e.clientX - xOffset;
          initialY = e.clientY - yOffset;
          isDragging = true;
        }

        function drag(e) {
          if (!isDragging) return;
          e.preventDefault();
          currentX = e.clientX - initialX;
          currentY = e.clientY - initialY;
          xOffset = currentX;
          yOffset = currentY;
          modal.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }

        function dragEnd() {
          initialX = currentX;
          initialY = currentY;
          isDragging = false;
        }
      };

      const setupWindowControls = (modal, styles) => {
        const header = document.getElementById("b365-header");
        const btnMinimize = document.getElementById("b365-btn-minimize");
        const btnClose = document.getElementById("b365-btn-close");

        makeDraggable(modal, header);

        btnClose.onclick = () => {
          modal.remove();
          styles.remove();
        };

        btnMinimize.onclick = () => {
          modal.classList.toggle("b365-minimized");
        };
      };

      const copyTextToClipboard = async (text, outputArea) => {
        if (!text || text.startsWith("Error:") || text.startsWith("Extracting")) return false;

        const originalValue = outputArea.value;

        const setCopiedFeedback = () => {
          outputArea.value = `${originalValue}\n\nCopied to clipboard.`;
          setTimeout(() => {
            if (outputArea && outputArea.value.endsWith("\n\nCopied to clipboard.")) {
              outputArea.value = originalValue;
            }
          }, 1800);
        };

        const fallbackCopy = () => {
          try {
            outputArea.focus();
            outputArea.select();
            const ok = document.execCommand("copy");
            if (ok) setCopiedFeedback();
            return ok;
          } catch (err) {
            alert("Auto-copy failed. Please press Ctrl+C to copy.");
            return false;
          }
        };

        if (navigator.clipboard && window.isSecureContext) {
          try {
            await navigator.clipboard.writeText(text);
            setCopiedFeedback();
            return true;
          } catch (err) {
            return fallbackCopy();
          }
        }

        return fallbackCopy();
      };

      const renderMarketCheckboxes = (container, markets, selectedState) => {
        selectedState.market = null;
        container.innerHTML = "";

        if (!markets || markets.length === 0) {
          container.innerHTML = `<div class="b365-market-empty">No markets detected.</div>`;
          return;
        }

        markets.forEach((market, index) => {
          const id = `b365-market-check-${index}-${Math.random().toString(16).slice(2)}`;

          const label = document.createElement("label");
          label.className = "b365-market-option";
          label.setAttribute("for", id);

          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.id = id;

          const text = document.createElement("span");
          text.textContent = market.name;

          checkbox.addEventListener("change", () => {
            const allChecks = container.querySelectorAll("input[type='checkbox']");
            allChecks.forEach((check) => {
              if (check !== checkbox) check.checked = false;
            });

            selectedState.market = checkbox.checked ? market : null;
          });

          label.appendChild(checkbox);
          label.appendChild(text);
          container.appendChild(label);
        });
      };

      const collectAvailablePlayerPropsMarkets = () => {
        const markets = [];
        const marketGroups = document.querySelectorAll(".gl-MarketGroup");

        marketGroups.forEach((group) => {
          const headerText = group.querySelector(".cm-MarketGroupWithIconsButton_Text");
          const name = headerText ? headerText.textContent.trim() : "";

          if (name) {
            markets.push({
              name,
              group
            });
          }
        });

        return uniqueMarketsByName(markets);
      };

      const extractPlayerPropsMarket = (market) => {
        const targetGroup = market && market.group ? market.group : null;

        if (!targetGroup) {
          return null;
        }

        let players = [];
        let columns = [];
        const scrollContainer = targetGroup.querySelector(".srb-HScrollOddsMarket_Container");

        if (scrollContainer) {
          const playerLabelContainer = targetGroup.querySelector(".srb-HScrollParticipantMarket");
          if (playerLabelContainer) {
            const names = playerLabelContainer.querySelectorAll(".srb-ParticipantLabelWithTeam_Name");
            names.forEach((el) => players.push(el.textContent.trim()));
          }

          const oddsColumns = scrollContainer.querySelectorAll(".srb-HScrollPlaceColumnMarket");
          oddsColumns.forEach((col) => {
            const headerEl = col.querySelector(".srb-HScrollPlaceHeader");
            const headerTxt = headerEl ? headerEl.textContent.trim() : "Odds";

            const oddsList = [];
            const oddsEls = col.querySelectorAll(".gl-ParticipantOddsOnly");

            oddsEls.forEach((oddContainer) => {
              const oddSpan = oddContainer.querySelector(".gl-ParticipantOddsOnly_Odds");
              oddsList.push(oddSpan ? oddSpan.textContent.trim() : "-");
            });

            columns.push({ header: headerTxt, odds: oddsList });
          });
        } else {
          const marketColumns = targetGroup.querySelectorAll(".gl-Market_General-columnheader");

          marketColumns.forEach((col) => {
            if (col.querySelector(".srb-ParticipantLabelWithTeam_Name")) {
              const names = col.querySelectorAll(".srb-ParticipantLabelWithTeam_Name");
              names.forEach((el) => players.push(el.textContent.trim()));
            } else if (col.querySelector(".gl-ParticipantOddsOnly")) {
              const headerEl = col.querySelector(".gl-MarketColumnHeader");
              const headerTxt = headerEl ? headerEl.textContent.trim() : "Odds";

              const oddsList = [];
              const oddsEls = col.querySelectorAll(".gl-ParticipantOddsOnly");

              oddsEls.forEach((oddContainer) => {
                const oddSpan = oddContainer.querySelector(".gl-ParticipantOddsOnly_Odds");
                oddsList.push(oddSpan ? oddSpan.textContent.trim() : "-");
              });

              columns.push({ header: headerTxt, odds: oddsList });
            }
          });
        }

        if (players.length === 0) {
          return {
            ok: false,
            error: "Error: No players or odds found.\nThe market might be suspended or closed."
          };
        }

        let output = "Player";
        columns.forEach((col) => {
          output += `\t${col.header}`;
        });
        output += "\n";

        for (let i = 0; i < players.length; i++) {
          output += `${players[i]}`;
          columns.forEach((col) => {
            const odd = col.odds[i] !== undefined && col.odds[i] !== "" ? col.odds[i] : "-";
            output += `\t${odd}`;
          });
          output += "\n";
        }

        return {
          ok: true,
          output
        };
      };

      const extractOutcomesFromContainer = (container) => {
        const rows = [];
        const participants = container.querySelectorAll(".gl-ParticipantBorderless");

        participants.forEach((participant) => {
          const nameEl = participant.querySelector(".gl-ParticipantBorderless_Name");
          const oddsEl = participant.querySelector(".gl-ParticipantBorderless_Odds");

          const name = nameEl ? nameEl.textContent.trim() : "";
          const odds = oddsEl ? oddsEl.textContent.trim() : "";

          if (name && odds) {
            rows.push({ outcome: name, odds });
          }
        });

        return rows;
      };

      const formatOutrightsOutput = (rows) => {
        let output = "Outcome\tOdds\n";

        rows.forEach((row) => {
          output += `${row.outcome}\t${row.odds}\n`;
        });

        return output;
      };

      const getClosestOutrightsContainerWithRows = (titleEl) => {
        const containerSelectors = [
          ".gl-MarketGroupPod.src-FixtureSubGroupWithShowMore",
          ".src-MarketGroup",
          ".gl-MarketGroup",
          ".gl-MarketGroupPod",
          ".cm-CouponMarketGrid",
          ".gl-MarketGrid"
        ];

        for (const selector of containerSelectors) {
          const container = titleEl.closest(selector);
          if (!container) continue;

          const rows = extractOutcomesFromContainer(container);
          if (rows.length > 0) {
            return { container, rows };
          }
        }

        return null;
      };

      const collectAvailableOutrightsMarketsByTitle = () => {
        const markets = [];
        const titleSelectors = [
          ".src-FixtureSubGroupButton_Text",
          ".rcl-MarketGroupButton_MarketTitle",
          ".cm-MarketGroupWithIconsButton_Text",
          ".cm-MarketGroupButton_Text",
          ".src-MarketGroupButton_Text",
          ".gl-MarketGroupButton_Text",
          ".rcl-MarketGroupButton_Text",
          "[class*='MarketGroupButton'][class*='Text']",
          "[class*='MarketTitle']"
        ];

        const titleElements = document.querySelectorAll(titleSelectors.join(","));

        titleElements.forEach((titleEl) => {
          const name = titleEl.textContent.trim();
          if (!name) return;

          const found = getClosestOutrightsContainerWithRows(titleEl);
          if (!found || !found.rows || found.rows.length === 0) return;

          markets.push({
            name,
            rows: found.rows
          });
        });

        return markets;
      };

      const collectAvailableOutrightsMarketsBySelectedButton = () => {
        const markets = [];
        const selectedSelectors = [
          ".srb-MarketSelectionButton-selected .srb-MarketSelectionButton_Label",
          ".sph-MarketGroupNavBarButton_Selected .sph-MarketGroupNavBarButton_Content",
          ".sph-MarketGroupNavBarButton_Selected [data-content]"
        ];

        const selectedElements = document.querySelectorAll(selectedSelectors.join(","));

        selectedElements.forEach((selectedEl) => {
          const name = (selectedEl.textContent || selectedEl.getAttribute("data-content") || "").trim();
          if (!name) return;

          const containers = [
            ...document.querySelectorAll(".srb-OutrightsMarketGroup"),
            ...document.querySelectorAll(".cm-CouponMarketGrid"),
            ...document.querySelectorAll(".gl-MarketGrid")
          ];

          for (const container of containers) {
            const rows = extractOutcomesFromContainer(container);
            if (rows.length > 0) {
              markets.push({
                name,
                rows
              });
              break;
            }
          }
        });

        return markets;
      };

      const collectAvailableOutrightsMarkets = () => {
        const byTitle = collectAvailableOutrightsMarketsByTitle();
        const bySelected = collectAvailableOutrightsMarketsBySelectedButton();
        return uniqueMarketsByName([...byTitle, ...bySelected]);
      };

      const extractOutrightsMarket = (market) => {
        if (!market || !market.rows || market.rows.length === 0) {
          return {
            ok: false,
            error: "Error: No outcomes or odds found.\nThe market might be suspended, closed, or not fully loaded."
          };
        }

        return {
          ok: true,
          output: formatOutrightsOutput(market.rows)
        };
      };

      const createMarketTypeSelectorUI = () => {
        removeExistingBet365UI();
        const styles = injectBet365Styles();

        const modal = document.createElement("div");
        modal.id = "b365-extractor-container";

        modal.innerHTML = `
          <div class="b365-header" id="b365-header">
              <span class="b365-title">Data Extractor</span>
              <div class="b365-window-controls">
                  <button class="b365-control-btn" id="b365-btn-minimize" title="Minimize">_</button>
                  <button class="b365-control-btn" id="b365-btn-close" title="Close">✕</button>
              </div>
          </div>
          <div class="b365-body" id="b365-body">
              <div class="b365-card-row">
                  <label class="b365-label">What type of markets are we going to extract?</label>
                  <div class="b365-btn-group">
                      <button class="b365-btn-primary" id="b365-btn-player-props">Player Props</button>
                      <button class="b365-btn-primary" id="b365-btn-outrights">Outrights</button>
                  </div>
              </div>
          </div>
        `;

        document.body.appendChild(modal);
        setupWindowControls(modal, styles);

        document.getElementById("b365-btn-player-props").onclick = () => {
          createPlayerPropsExtractorUI();
        };

        document.getElementById("b365-btn-outrights").onclick = () => {
          createOutrightsExtractorUI();
        };
      };

      const createPlayerPropsExtractorUI = () => {
        removeExistingBet365UI();
        const styles = injectBet365Styles();

        const modal = document.createElement("div");
        modal.id = "b365-extractor-container";

        modal.innerHTML = `
          <div class="b365-header" id="b365-header">
              <span class="b365-title">Player Props Extractor</span>
              <div class="b365-window-controls">
                  <button class="b365-control-btn" id="b365-btn-minimize" title="Minimize">_</button>
                  <button class="b365-control-btn" id="b365-btn-close" title="Close">✕</button>
              </div>
          </div>
          <div class="b365-body" id="b365-body">
              <div class="b365-card-row">
                  <button class="b365-btn-primary" id="b365-btn-detect-player-markets">Detect Markets</button>
                  <div class="b365-market-list" id="b365-player-market-list">
                      <div class="b365-market-empty">Click Detect Markets to load available markets.</div>
                  </div>
                  <button class="b365-btn-primary" id="b365-btn-run">Run Extraction</button>
              </div>

              <div class="b365-card-row">
                  <label class="b365-label">Results</label>
                  <textarea class="b365-textarea" id="b365-output" readonly placeholder="Extracted data will appear here..."></textarea>
              </div>
          </div>
        `;

        document.body.appendChild(modal);
        setupWindowControls(modal, styles);

        const btnDetect = document.getElementById("b365-btn-detect-player-markets");
        const marketList = document.getElementById("b365-player-market-list");
        const btnRun = document.getElementById("b365-btn-run");
        const outputArea = document.getElementById("b365-output");
        const selectedState = { market: null };

        btnDetect.onclick = () => {
          const markets = collectAvailablePlayerPropsMarkets();
          renderMarketCheckboxes(marketList, markets, selectedState);
          outputArea.value = markets.length
            ? `${markets.length} markets detected. Select one market and run extraction.`
            : "Error: No markets detected.";
        };

        btnRun.onclick = async () => {
          if (!selectedState.market) {
            outputArea.value = "Error: Please select one market.";
            return;
          }

          outputArea.value = "Extracting data.";

          const result = extractPlayerPropsMarket(selectedState.market);

          if (!result || !result.ok) {
            outputArea.value = result && result.error ? result.error : "Error: Extraction failed.";
            return;
          }

          outputArea.value = result.output;
          await copyTextToClipboard(result.output, outputArea);
        };
      };

      const createOutrightsExtractorUI = () => {
        removeExistingBet365UI();
        const styles = injectBet365Styles();

        const modal = document.createElement("div");
        modal.id = "b365-extractor-container";

        modal.innerHTML = `
          <div class="b365-header" id="b365-header">
              <span class="b365-title">Outrights Extractor</span>
              <div class="b365-window-controls">
                  <button class="b365-control-btn" id="b365-btn-minimize" title="Minimize">_</button>
                  <button class="b365-control-btn" id="b365-btn-close" title="Close">✕</button>
              </div>
          </div>
          <div class="b365-body" id="b365-body">
              <div class="b365-card-row">
                  <button class="b365-btn-primary" id="b365-btn-detect-outrights-markets">Detect Markets</button>
                  <div class="b365-market-list" id="b365-outrights-market-list">
                      <div class="b365-market-empty">Click Detect Markets to load available markets.</div>
                  </div>
                  <button class="b365-btn-primary" id="b365-btn-outrights-run">Run Extraction</button>
              </div>

              <div class="b365-card-row">
                  <label class="b365-label">Results</label>
                  <textarea class="b365-textarea" id="b365-outrights-output" readonly placeholder="Outrights data will appear here..."></textarea>
              </div>
          </div>
        `;

        document.body.appendChild(modal);
        setupWindowControls(modal, styles);

        const btnDetect = document.getElementById("b365-btn-detect-outrights-markets");
        const marketList = document.getElementById("b365-outrights-market-list");
        const btnRun = document.getElementById("b365-btn-outrights-run");
        const outputArea = document.getElementById("b365-outrights-output");
        const selectedState = { market: null };

        btnDetect.onclick = () => {
          const markets = collectAvailableOutrightsMarkets();
          renderMarketCheckboxes(marketList, markets, selectedState);
          outputArea.value = markets.length
            ? `${markets.length} markets detected. Select one market and run extraction.`
            : "Error: No markets detected.";
        };

        btnRun.onclick = async () => {
          if (!selectedState.market) {
            outputArea.value = "Error: Please select one market.";
            return;
          }

          outputArea.value = "Extracting data.";

          const result = extractOutrightsMarket(selectedState.market);

          if (!result || !result.ok) {
            outputArea.value = result && result.error ? result.error : "Error: Extraction failed.";
            return;
          }

          outputArea.value = result.output;
          await copyTextToClipboard(result.output, outputArea);
        };
      };

      createMarketTypeSelectorUI();

      return { ok: true };
    } catch (err) {
      console.error("[ExtraccionBet365] Error:", err);
      return { ok: false, error: String(err?.message || err) };
    }
  };

  window.registerAutomation("data_extraction", { name: "Data extraction" }, async () => {
    try {
      const CONTAINER_ID = "data-extraction-container";
      const STYLES_ID = "data-extraction-styles";

      document.getElementById(CONTAINER_ID)?.remove();
      document.getElementById(STYLES_ID)?.remove();

      const styles = document.createElement("style");
      styles.id = STYLES_ID;
      styles.textContent = `
        :root {
          --de-bg-base:#0B0D10;
          --de-bg-panel:#13161D;
          --de-border-color:rgba(255,255,255,0.10);
          --de-border-hover:rgba(255,255,255,0.14);
          --de-text-main:#E6E8EE;
          --de-text-muted:rgba(230,232,238,0.65);
          --de-accent-primary:rgba(240,166,74,0.95);
          --de-accent-secondary:rgba(200,133,51,0.95);
          --de-shadow:0 10px 30px rgba(0,0,0,0.45);
          --de-font-stack:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;
        }

        #${CONTAINER_ID}{
          position:fixed;
          top:20px;
          right:20px;
          width:380px;
          background:var(--de-bg-base);
          border:1px solid var(--de-border-color);
          border-radius:14px;
          box-shadow:var(--de-shadow);
          font-family:var(--de-font-stack);
          color:var(--de-text-main);
          z-index:999999;
          overflow:hidden;
        }

        #${CONTAINER_ID} *{
          box-sizing:border-box;
        }

        .de-header{
          background:var(--de-bg-panel);
          padding:10px 14px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          border-bottom:1px solid var(--de-border-color);
          cursor:grab;
          user-select:none;
        }

        .de-header:active{
          cursor:grabbing;
        }

        .de-title{
          font-size:13px;
          font-weight:650;
          color:var(--de-text-main);
          letter-spacing:.3px;
        }

        .de-window-controls{
          display:flex;
          gap:6px;
        }

        .de-control-btn{
          background:transparent;
          border:none;
          color:var(--de-text-muted);
          cursor:pointer;
          font-size:12px;
          width:24px;
          height:24px;
          border-radius:6px;
          display:flex;
          align-items:center;
          justify-content:center;
          transition:all .2s;
        }

        .de-control-btn:hover{
          background:rgba(255,255,255,.05);
          color:var(--de-text-main);
        }

        .de-body{
          padding:14px;
          display:flex;
          flex-direction:column;
          gap:12px;
        }

        .de-minimized .de-body{
          display:none;
        }

        .de-card-row{
          background:rgba(255,255,255,.02);
          border:1px solid var(--de-border-color);
          border-radius:12px;
          padding:10px;
          display:flex;
          flex-direction:column;
          gap:10px;
        }

        .de-label{
          font-size:11px;
          color:var(--de-text-muted);
          font-weight:500;
        }

        .de-btn-group{
          display:flex;
          flex-direction:column;
          gap:10px;
        }

        .de-btn-primary{
          background:linear-gradient(180deg,var(--de-accent-primary) 0%,var(--de-accent-secondary) 100%);
          color:#111;
          border:none;
          border-radius:12px;
          padding:10px;
          font-size:12px;
          font-weight:650;
          cursor:pointer;
          transition:opacity .2s;
          width:100%;
        }

        .de-btn-primary:hover{
          opacity:.9;
        }

        .de-message{
          font-size:11px;
          color:var(--de-text-muted);
          line-height:1.4;
          min-height:16px;
          white-space:pre-wrap;
        }
      `;

      document.head.appendChild(styles);

      const modal = document.createElement("div");
      modal.id = CONTAINER_ID;

      modal.innerHTML = `
        <div class="de-header" id="de-header">
          <span class="de-title">Data extraction</span>

          <div class="de-window-controls">
            <button class="de-control-btn" id="de-btn-minimize" title="Minimize">_</button>
            <button class="de-control-btn" id="de-btn-close" title="Close">✕</button>
          </div>
        </div>

        <div class="de-body">
          <div class="de-card-row">
            <label class="de-label">What site do you want to extract data from?</label>

            <div class="de-btn-group">
              <button class="de-btn-primary" id="de-btn-asian-monitor">AsianMonitor</button>
              <button class="de-btn-primary" id="de-btn-bet365">Bet365</button>
              <button class="de-btn-primary" id="de-btn-betradar">BetRadar</button>
            </div>

            <div class="de-message" id="de-message"></div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const header = modal.querySelector("#de-header");
      const btnClose = modal.querySelector("#de-btn-close");
      const btnMinimize = modal.querySelector("#de-btn-minimize");
      const btnAsianMonitor = modal.querySelector("#de-btn-asian-monitor");
      const btnBet365 = modal.querySelector("#de-btn-bet365");
      const btnBetRadar = modal.querySelector("#de-btn-betradar");
      const message = modal.querySelector("#de-message");

      let isDragging = false;
      let currentX = 0;
      let currentY = 0;
      let initialX = 0;
      let initialY = 0;
      let xOffset = 0;
      let yOffset = 0;

      header.addEventListener("mousedown", (e) => {
        if (e.target.closest(".de-window-controls")) return;

        initialX = e.clientX - xOffset;
        initialY = e.clientY - yOffset;
        isDragging = true;
      });

      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;

        e.preventDefault();

        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        xOffset = currentX;
        yOffset = currentY;

        modal.style.transform =
          `translate3d(${currentX}px, ${currentY}px, 0)`;
      });

      document.addEventListener("mouseup", () => {
        initialX = currentX;
        initialY = currentY;
        isDragging = false;
      });

      btnClose.onclick = () => {
        modal.remove();
        styles.remove();
      };

      btnMinimize.onclick = () => {
        modal.classList.toggle("de-minimized");
      };

      const runInternalAutomation = async (automationId) => {
        if (!INTERNAL_AUTOMATIONS[automationId]) {
          throw new Error(`Internal automation not found: ${automationId}.`);
        }

        return await INTERNAL_AUTOMATIONS[automationId]();
      };

      const launchAutomation = async (automationId) => {
        try {
          message.textContent = "Opening selected extractor...";

          modal.remove();
          styles.remove();

          const result = await runInternalAutomation(automationId);

          if (result && result.ok === false) {
            console.error("[Data extraction] Selected automation failed:", result);
          }
        } catch (err) {
          document.getElementById(CONTAINER_ID)?.remove();
          document.getElementById(STYLES_ID)?.remove();

          const errorStyles = document.createElement("style");
          errorStyles.id = STYLES_ID;
          errorStyles.textContent = styles.textContent;
          document.head.appendChild(errorStyles);

          const errorModal = document.createElement("div");
          errorModal.id = CONTAINER_ID;

          errorModal.innerHTML = `
            <div class="de-header" id="de-header">
              <span class="de-title">Data extraction</span>

              <div class="de-window-controls">
                <button class="de-control-btn" id="de-btn-close" title="Close">✕</button>
              </div>
            </div>

            <div class="de-body">
              <div class="de-card-row">
                <label class="de-label">Error</label>
                <div class="de-message">${String(err?.message || err)}</div>
              </div>
            </div>
          `;

          document.body.appendChild(errorModal);

          errorModal.querySelector("#de-btn-close").onclick = () => {
            errorModal.remove();
            errorStyles.remove();
          };

          console.error("[Data extraction] Error:", err);
        }
      };

      btnAsianMonitor.onclick = () => {
        launchAutomation("AsianMonitorExtraction");
      };

      btnBet365.onclick = () => {
        launchAutomation("ExtraccionBet365");
      };

      btnBetRadar.onclick = () => {
        launchAutomation("br_extraction");
      };

      return { ok: true };

    } catch (err) {
      console.error("[Data extraction] Error:", err);

      return {
        ok: false,
        error: String(err?.message || err)
      };
    }
  });
})();