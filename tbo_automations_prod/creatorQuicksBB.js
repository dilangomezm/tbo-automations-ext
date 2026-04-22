// creatorQuicksBB.js
(() => {
  // Safety check
  if (!window.registerAutomation) return;

  window.registerAutomation("creator_quicksbb", { name: "Creator QuicksBB" }, async () => {
    try {
      /*****************************************************************
       * CONFIG (defaults)
       *****************************************************************/
      const DEFAULT_BRANDS = [
        "Sweden/BetMGM",
        "Sweden/GoGo",
        "Sweden/Expekt",
        "Sweden/LeoVegas",
        "Brazil/BetMGM",
        "Denmark/Expekt",
        "Denmark/LeoVegas",
        "Canada/LeoVegas",
        "Finland/Expekt",
      ];

      const DEFAULT_MIN_ODDS = "1.5";
      const DEFAULT_MAX_ODDS = "15";

      const CANCEL_STATUS = "Cancel";
      const CANCEL_REASON_FULL =
        "The actual result was not offered as an outcome. - NO_RESULT_ASSIGNABLE";
      const CANCEL_REASON_KEY = "NO_RESULT_ASSIGNABLE";
      const EXISTS_TEXT = "Prebuild Bet already exists for";

      // Auto-wait (internal only — no UI text)
      const AUTO_WAIT_TIMEOUT_MS = 60000;
      const AFTER_DECREASE_EXTRA_WAIT_MS = 1000;

      // Panel position persistence
      const POS_KEY = "tbo_creator_quicksbb_pos_v1";

      /*****************************************************************
       * THEME (same as extension)
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

      /*****************************************************************
       * Helpers
       *****************************************************************/
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
        try {
          el.scrollIntoView?.({ block: "center", inline: "center" });
        } catch {}
        const evInit = { bubbles: true, cancelable: true, view: window };
        ["pointerdown", "mousedown", "mouseup", "click"].forEach((t) => {
          try {
            el.dispatchEvent(new MouseEvent(t, evInit));
          } catch {}
        });
        try {
          el.click();
        } catch {}
        return true;
      };

      const clickByPoint = (x, y) => {
        const target = document.elementFromPoint(x, y);
        if (!target) return false;
        const evInit = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
        try {
          target.dispatchEvent(
            new PointerEvent("pointerdown", { ...evInit, pointerId: 1, pointerType: "mouse" })
          );
        } catch {}
        try {
          target.dispatchEvent(new MouseEvent("mousedown", evInit));
        } catch {}
        try {
          target.dispatchEvent(new MouseEvent("mouseup", evInit));
        } catch {}
        try {
          target.dispatchEvent(new MouseEvent("click", evInit));
        } catch {}
        try {
          target.focus?.();
        } catch {}
        return true;
      };

      const clickInputHuman = async (input) => {
        if (!input) return false;
        const r = input.getBoundingClientRect();
        const x = Math.floor(r.left + Math.min(10, r.width / 2));
        const y = Math.floor(r.top + r.height / 2);
        clickByPoint(x, y);
        await sleep(120);
        clickByPoint(x, y);
        await sleep(180);
        return true;
      };

      const sendEscape = async () => {
        const ev = new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          keyCode: 27,
          which: 27,
          bubbles: true,
        });
        document.dispatchEvent(ev);
        await sleep(120);
      };

      const isAnyListboxOpen = () =>
        Array.from(document.querySelectorAll('ul[role="listbox"]')).some(isVisible);

      const setReactInputValue = (input, value) => {
        if (!input) return false;
        input.focus();

        const proto =
          input instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;

        const desc = Object.getOwnPropertyDescriptor(proto, "value");
        const nativeSetter = desc && desc.set;
        if (nativeSetter) nativeSetter.call(input, String(value));
        else input.value = String(value);

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));

        input.blur();
        return true;
      };

      // safe single click for save
      const __clickedGuard = new WeakMap();
      const clickOnceWithGuard = (el, guardMs = 3000) => {
        if (!el) return false;
        const now = Date.now();
        const last = __clickedGuard.get(el) || 0;
        if (now - last < guardMs) return false;
        __clickedGuard.set(el, now);
        try {
          el.scrollIntoView?.({ block: "center", inline: "center" });
        } catch {}
        try {
          el.click();
        } catch {}
        return true;
      };

      const clickSaveOnce = async (dialog, saveBtn) => {
        if (!dialog || !saveBtn) return false;

        const didClick = clickOnceWithGuard(saveBtn, 3000);
        if (!didClick) return false;

        const changed = await waitFor(
          () => {
            if (!dialog.isConnected || dialog.offsetParent === null) return "closed";
            if (dialog.textContent && dialog.textContent.includes(EXISTS_TEXT)) return "exists";
            return null;
          },
          { timeout: 8000, interval: 150 }
        );

        return !!changed;
      };

      /*****************************************************************
       * Pagination "of N" detector
       *****************************************************************/
      const getDisplayedRowsTextEl = () =>
        document.querySelector(".MuiTablePagination-displayedRows") ||
        Array.from(document.querySelectorAll("p")).find((p) =>
          p.className?.includes("MuiTablePagination-displayedRows")
        ) ||
        null;

      const getTotalBetslipsFromToolbar = () => {
        const el = getDisplayedRowsTextEl();
        if (!el) return null;
        const t = (el.textContent || "").trim(); // "1–10 of 34"
        const m = t.match(/of\s+(\d+)/i);
        if (!m) return null;
        const n = Number(m[1]);
        return Number.isFinite(n) ? n : null;
      };

      const waitForTotalToDrop = async (startTotal) => {
        const start = Date.now();
        while (Date.now() - start < AUTO_WAIT_TIMEOUT_MS) {
          const cur = getTotalBetslipsFromToolbar();
          if (typeof cur === "number" && cur < startTotal) {
            await sleep(AFTER_DECREASE_EXTRA_WAIT_MS);
            return true;
          }
          await sleep(250);
        }
        return false;
      };

      /*****************************************************************
       * UI: Floating draggable config panel (minimize/close)
       *****************************************************************/
      const PANEL_ID = "tbo_creator_quicksbb_panel_v1";

      const removeExistingPanel = () => {
        document.getElementById(PANEL_ID)?.remove();
      };

      const restorePosition = (panel) => {
        try {
          const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
          if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
            panel.style.left = `${saved.x}px`;
            panel.style.top = `${saved.y}px`;
            panel.style.right = "auto";
          }
        } catch {}
      };

      const persistPosition = (panel) => {
        try {
          const rect = panel.getBoundingClientRect();
          localStorage.setItem(POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
        } catch {}
      };

      const getUserConfig = async () => {
        removeExistingPanel();

        const panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.style.position = "fixed";
        panel.style.top = "90px";
        panel.style.right = "24px";
        panel.style.width = "420px";
        panel.style.maxWidth = "92vw";
        panel.style.background = THEME.CARD;
        panel.style.border = `1px solid ${THEME.BORDER}`;
        panel.style.borderRadius = `${THEME.RADIUS}px`;
        panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
        panel.style.zIndex = "999999";
        panel.style.fontFamily =
          "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
        panel.style.color = THEME.TEXT;
        panel.style.overflow = "hidden";

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

        // ✅ removed "Configuration"
        header.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="font-weight:650; font-size:12px; letter-spacing:.2px;">Creator QuicksBB</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button id="qbbMin" title="Minimize" style="
              width:26px;height:22px;border-radius:8px;
              border:1px solid ${THEME.BORDER};
              background:rgba(255,255,255,0.02);
              color:${THEME.TEXT}; font-weight:650; cursor:pointer;">−</button>
            <button id="qbbClose" title="Close" style="
              width:26px;height:22px;border-radius:8px;
              border:1px solid ${THEME.BORDER};
              background:rgba(255,255,255,0.02);
              color:${THEME.TEXT}; font-weight:650; cursor:pointer;">✕</button>
          </div>
        `;

        const body = document.createElement("div");
        body.style.padding = "10px";

        // ✅ Ninguna marca seleccionada por defecto
        const brandChecks = DEFAULT_BRANDS.map((b) => {
          return `
            <label style="
              display:flex; align-items:center; gap:10px;
              padding:8px 10px; border-radius:12px;
              border:1px solid ${THEME.BORDER};
              background:rgba(255,255,255,0.02);
              cursor:pointer; user-select:none;">
              <input type="checkbox" data-brand="${b}" style="accent-color:${THEME.ACCENT};" />
              <span style="font-size:12px; font-weight:600; color:${THEME.TEXT};">${b}</span>
            </label>
          `;
        }).join("");

        // ✅ removed instruction block entirely
        body.innerHTML = `
          <div style="
            border:1px solid ${THEME.BORDER};
            background:rgba(255,255,255,0.02);
            border-radius:${THEME.RADIUS}px;
            padding:10px;
            margin-bottom:10px;">
            <div style="font-size:12px; font-weight:650; margin-bottom:8px;">Brands</div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              ${brandChecks}
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
            <div style="
              border:1px solid ${THEME.BORDER};
              background:rgba(255,255,255,0.02);
              border-radius:${THEME.RADIUS}px;
              padding:10px;">
              <div style="font-size:11px; color:${THEME.MUTED}; margin-bottom:6px;">Min odds</div>
              <input id="qbbMinOdds" value="${DEFAULT_MIN_ODDS}" style="
                width:100%; padding:10px; border-radius:10px;
                border:1px solid ${THEME.BORDER};
                background:rgba(255,255,255,0.02);
                color:${THEME.TEXT};
                outline:none; font-size:12px;" />
            </div>

            <div style="
              border:1px solid ${THEME.BORDER};
              background:rgba(255,255,255,0.02);
              border-radius:${THEME.RADIUS}px;
              padding:10px;">
              <div style="font-size:11px; color:${THEME.MUTED}; margin-bottom:6px;">Max odds</div>
              <input id="qbbMaxOdds" value="${DEFAULT_MAX_ODDS}" style="
                width:100%; padding:10px; border-radius:10px;
                border:1px solid ${THEME.BORDER};
                background:rgba(255,255,255,0.02);
                color:${THEME.TEXT};
                outline:none; font-size:12px;" />
            </div>
          </div>

          <div id="qbbErr" style="min-height:14px; font-size:11px; color:#ff8181; margin-bottom:8px;"></div>

          <button id="qbbRun" style="
            width:100%;
            border:none;
            background:linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95));
            color:#111;
            border-radius:12px;
            padding:10px 12px;
            font-weight:650;
            font-size:12px;
            cursor:pointer;">
            Run
          </button>
        `;

        panel.appendChild(header);
        panel.appendChild(body);
        document.body.appendChild(panel);
        restorePosition(panel);

        // Drag
        let dragging = false,
          offsetX = 0,
          offsetY = 0;

        header.addEventListener("mousedown", (e) => {
          const target = e.target;
          if (target && target.closest && target.closest("button")) return;

          dragging = true;
          header.style.cursor = "grabbing";
          const rect = panel.getBoundingClientRect();
          offsetX = e.clientX - rect.left;
          offsetY = e.clientY - rect.top;
          e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
          if (!dragging) return;
          const x = Math.max(
            0,
            Math.min(window.innerWidth - panel.offsetWidth, e.clientX - offsetX)
          );
          const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY));
          panel.style.left = `${x}px`;
          panel.style.top = `${y}px`;
          panel.style.right = "auto";
        });

        window.addEventListener("mouseup", () => {
          if (!dragging) return;
          dragging = false;
          header.style.cursor = "grab";
          persistPosition(panel);
        });

        // Minimize / Close
        let minimized = false;
        const minBtn = panel.querySelector("#qbbMin");
        const closeBtn = panel.querySelector("#qbbClose");

        minBtn.onclick = () => {
          minimized = !minimized;
          body.style.display = minimized ? "none" : "block";
          minBtn.textContent = minimized ? "+" : "−";
          persistPosition(panel);
        };

        closeBtn.onclick = () => {
          panel.remove();
        };

        return await new Promise((resolve) => {
          panel.querySelector("#qbbRun").onclick = () => {
            const checked = Array.from(panel.querySelectorAll('input[type="checkbox"][data-brand]'))
              .filter((cb) => cb.checked)
              .map((cb) => cb.getAttribute("data-brand"));

            const min = panel.querySelector("#qbbMinOdds").value?.trim();
            const max = panel.querySelector("#qbbMaxOdds").value?.trim();

            const err = panel.querySelector("#qbbErr");
            err.textContent = "";

            if (!checked.length) {
              err.textContent = "You must select at least 1 brand.";
              return;
            }
            if (!min || Number.isNaN(Number(min))) {
              err.textContent = "Min odds must be a valid number (e.g., 1.5).";
              return;
            }
            if (!max || Number.isNaN(Number(max))) {
              err.textContent = "Max odds must be a valid number (e.g., 15).";
              return;
            }
            if (Number(max) < Number(min)) {
              err.textContent = "Max odds must be greater than or equal to Min odds.";
              return;
            }

            persistPosition(panel);
            panel.remove();
            resolve({ brands: checked, minOdds: String(min), maxOdds: String(max) });
          };

          closeBtn.addEventListener("click", () => resolve(null), { once: true });
        });
      };

      /*****************************************************************
       * Detect OPEN betslips (new UI)
       *****************************************************************/
      const isRowOpen = (row) => {
        const statusSpan = row.querySelector("td:nth-child(2) span");
        if (statusSpan && norm(statusSpan.textContent) === "open") return true;
        return Array.from(row.querySelectorAll("span")).some((s) => norm(s.textContent) === "open");
      };

      const getOpenBetRows = () => {
        const rows = Array.from(document.querySelectorAll('tr[data-testid="bet-row"]'));
        return rows.filter(isRowOpen);
      };

      /*****************************************************************
       * Row / Menu helpers
       *****************************************************************/
      const getRowMenuButton = (row) => {
        const cell = row?.querySelector('td[data-testid="bets-row-menu-cell"]') || null;
        if (!cell) return null;
        return cell.querySelector('[role="button"]') || cell.querySelector("button") || null;
      };

      const openRowMenu = async (row) => {
        const btn = getRowMenuButton(row);
        if (!btn) return false;
        clickEl(btn);
        const menu = await waitFor(
          () => document.querySelector('ul[role="menu"], .MuiMenu-list, [role="menu"]'),
          { timeout: 4000, interval: 100 }
        );
        return !!menu;
      };

      const clickMenuItemCreatePrebuilt = async () => {
        const item =
          document.querySelector('li[data-testid^="createPrebuildBet"]') ||
          Array.from(document.querySelectorAll('li[role="menuitem"]')).find((li) =>
            norm(li.textContent).includes("create prebuilt bet")
          );
        if (!item) return false;
        clickEl(item);
        return true;
      };

      const clickMenuItemEdit = async () => {
        const targetSpan = Array.from(document.querySelectorAll("span")).find(
          (s) => norm(s.textContent) === "edit"
        );
        const item =
          targetSpan?.closest('li[role="menuitem"]') ||
          Array.from(document.querySelectorAll('li[role="menuitem"]')).find(
            (li) => norm(li.textContent) === "edit"
          );
        if (!item) return false;
        clickEl(item);
        return true;
      };

      const getActiveDialog = () =>
        Array.from(document.querySelectorAll('[role="dialog"], .MuiDialog-root')).find(
          (d) => d && d.offsetParent !== null
        ) || null;

      const closeDialogWithX = async (dialog) => {
        if (!dialog) return false;
        const xBtn = dialog.querySelector('[data-testid="dialog-popup-title-close-button"]');
        if (!xBtn) return false;
        clickEl(xBtn);
        const closed = await waitFor(() => !dialog.isConnected || dialog.offsetParent === null, {
          timeout: 15000,
          interval: 250,
        });
        return !!closed;
      };

      /*****************************************************************
       * Listbox selection
       *****************************************************************/
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
        const needleKey = norm(CANCEL_REASON_KEY);

        while (Date.now() - start < timeout) {
          const listboxes = getVisibleListboxes();
          for (const lb of listboxes) {
            let opt = findOptionInListbox(lb, needleFull) || findOptionInListbox(lb, needleKey);
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

              opt = findOptionInListbox(lb, needleFull) || findOptionInListbox(lb, needleKey);
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

      const openSelect = async (triggerEl) => {
        clickEl(triggerEl);
        const ok = await waitFor(() => (getVisibleListboxes().length ? true : null), {
          timeout: 5000,
          interval: 120,
        });
        return !!ok;
      };

      const selectDropdownValue = async (triggerEl, optionText) => {
        const opened = await openSelect(triggerEl);
        if (!opened) return false;
        return await pickFromAnyListbox(optionText, { timeout: 7000 });
      };

      /*****************************************************************
       * Brands selection
       *****************************************************************/
      const openLocationBrandListbox = async (dialog) => {
        const wrapper = dialog.querySelector('[data-testid="location-brand-select"]');
        if (!wrapper) return null;

        const combo =
          wrapper.querySelector('[role="combobox"]') ||
          wrapper.querySelector('[aria-haspopup="listbox"]') ||
          wrapper.querySelector("button");

        if (!combo) return null;

        clickEl(combo);
        return await waitFor(() => getVisibleListboxes().slice(-1)[0] || null, {
          timeout: 5000,
          interval: 150,
        });
      };

      const selectBrandsByVisibleText = async (dialog, brands) => {
        const lb = await openLocationBrandListbox(dialog);
        if (!lb) return false;

        const findOptionForBrand = (brand) => {
          const opts = Array.from(lb.querySelectorAll('li[role="option"], li')).filter(isVisible);
          return opts.find((o) => norm(o.textContent).includes(norm(brand))) || null;
        };

        for (const b of brands) {
          const opt = await waitFor(() => findOptionForBrand(b), { timeout: 2500, interval: 120 });
          if (!opt) continue;

          const clickTarget =
            opt.querySelector('input[type="checkbox"]')?.closest("span,button,div") ||
            opt.querySelector(".MuiCheckbox-root") ||
            opt;

          clickEl(clickTarget);
          await sleep(220);
        }
        return true;
      };

      const closeBrandsByClickingMinOdds = async (dialog) => {
        const minInput = dialog.querySelector("#input-minimumOdds");
        if (!minInput) return false;

        await clickInputHuman(minInput);

        if (isAnyListboxOpen()) {
          await sendEscape();
          await clickInputHuman(minInput);
        }
        return true;
      };

      /*****************************************************************
       * Prebuilt error detection
       *****************************************************************/
      const getExistsErrorLines = (dialog) => {
        if (!dialog) return [];
        const nodes = Array.from(dialog.querySelectorAll("div, p, span, li"))
          .filter(isVisible)
          .map((el) => el.textContent?.trim())
          .filter(Boolean);

        const hits = nodes.filter((t) => t.includes(EXISTS_TEXT));
        if (!hits.length && dialog.textContent?.includes(EXISTS_TEXT)) {
          const split = dialog.textContent
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          return split.filter((t) => t.includes(EXISTS_TEXT));
        }
        return hits;
      };

      const clickClosePrebuiltDialog = async (dialog) => {
        const closeBtn =
          dialog.querySelector('[data-testid="prebuild-bet-create-cancel-button"]') ||
          Array.from(dialog.querySelectorAll('[role="button"], button, span[role="button"]')).find(
            (el) => norm(el.textContent) === "close"
          );

        if (!closeBtn) return false;
        clickEl(closeBtn);

        const closed = await waitFor(() => !dialog.isConnected || dialog.offsetParent === null, {
          timeout: 15000,
          interval: 250,
        });
        return !!closed;
      };

      /*****************************************************************
       * Prebuilt flow
       *****************************************************************/
      const doCreatePrebuilt = async (row, cfg) => {
        if (!(await openRowMenu(row))) return false;
        if (!(await clickMenuItemCreatePrebuilt())) return false;

        const dialog = await waitFor(getActiveDialog, { timeout: 8000, interval: 150 });
        if (!dialog) return false;

        const okBrands = await selectBrandsByVisibleText(dialog, cfg.brands);
        if (!okBrands) return false;

        await closeBrandsByClickingMinOdds(dialog);

        const inputMin = dialog.querySelector("#input-minimumOdds");
        const inputMax = dialog.querySelector("#input-maximumOdds");
        if (!inputMin || !inputMax) return false;

        await clickInputHuman(inputMin);
        setReactInputValue(inputMin, cfg.minOdds);
        await sleep(200);

        await clickInputHuman(inputMax);
        setReactInputValue(inputMax, cfg.maxOdds);
        await sleep(350);

        await clickInputHuman(inputMin);
        await sleep(150);

        const saveBtn = await waitFor(
          () => dialog.querySelector('[data-testid="prebuild-bet-create-save-button"]'),
          { timeout: 8000, interval: 150 }
        );
        if (!saveBtn) return false;

        const enabled = await waitFor(
          () => {
            const disabled = saveBtn.disabled || saveBtn.getAttribute("disabled") !== null;
            return !disabled ? true : null;
          },
          { timeout: 12000, interval: 200 }
        );
        if (!enabled) return false;

        await clickSaveOnce(dialog, saveBtn);

        const outcome = await waitFor(
          () => {
            if (!dialog.isConnected || dialog.offsetParent === null) return { type: "closed" };
            const lines = getExistsErrorLines(dialog);
            if (lines.length) return { type: "exists_error", lines };
            return null;
          },
          { timeout: 8000, interval: 200 }
        );

        if (!outcome) return false;

        if (outcome.type === "exists_error") {
          return await clickClosePrebuiltDialog(dialog);
        }

        return true;
      };

      /*****************************************************************
       * Cancel flow (SGP)
       *****************************************************************/
      const doCancelBet = async (row) => {
        if (!(await openRowMenu(row))) return false;
        if (!(await clickMenuItemEdit())) return false;

        const dialog = await waitFor(getActiveDialog, { timeout: 8000, interval: 150 });
        if (!dialog) return false;

        const sgpLi = await waitFor(
          () => {
            const icon = dialog.querySelector('img[data-testid="same-game-parlay-icon"]');
            if (!icon || !isVisible(icon)) return null;
            const li = icon.closest('li[data-testid="betslip-edit-outcome"], li') || null;
            return li && isVisible(li) ? li : null;
          },
          { timeout: 8000, interval: 150 }
        );
        if (!sgpLi) return false;

        const sgpOpenLabel = await waitFor(
          () => {
            const labels = Array.from(sgpLi.querySelectorAll('[data-testid="commonEditAcceptLabel"]'))
              .filter(isVisible)
              .filter((el) => norm(el.textContent) === "open");
            return labels[0] || null;
          },
          { timeout: 6000, interval: 150 }
        );
        if (!sgpOpenLabel) return false;

        const wrapper =
          sgpOpenLabel.closest('[data-testid="commonEditAcceptWrapper"]') ||
          sgpOpenLabel.closest("#input-area") ||
          sgpLi;

        clickEl(sgpOpenLabel);
        await sleep(350);

        const statusCombo = await waitFor(
          () => {
            const scope = wrapper || sgpLi || dialog;
            const cands = Array.from(
              scope.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]')
            ).filter(isVisible);

            const byText = cands.find((el) => norm(el.textContent) === "status");
            if (byText) return byText;

            const near = Array.from(
              sgpLi.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]')
            )
              .filter(isVisible)
              .find((el) => norm(el.textContent) === "status");

            return near || null;
          },
          { timeout: 6000, interval: 150 }
        );
        if (!statusCombo) return false;

        if (!(await selectDropdownValue(statusCombo, CANCEL_STATUS))) return false;

        const reasonCombo = await waitFor(
          () => {
            const el =
              dialog.querySelector("#reasonSelectProp") ||
              dialog.querySelector('[aria-labelledby="reasonSelectProp"]');
            return isVisible(el) ? el : null;
          },
          { timeout: 8000, interval: 150 }
        );
        if (!reasonCombo) return false;

        if (!(await selectDropdownValue(reasonCombo, CANCEL_REASON_FULL))) return false;

        const saveBtn = await waitFor(
          () => dialog.querySelector('[data-testid="bet-edit-save-button"]'),
          { timeout: 8000, interval: 150 }
        );
        if (!saveBtn) return false;

        const enabled = await waitFor(
          () => {
            const d = saveBtn.disabled || saveBtn.getAttribute("disabled") !== null;
            return !d ? true : null;
          },
          { timeout: 8000, interval: 200 }
        );
        if (!enabled) return false;

        clickEl(saveBtn);
        await sleep(700);

        await closeDialogWithX(dialog);
        return true;
      };

      /*****************************************************************
       * RUN
       *****************************************************************/
      const cfg = await getUserConfig();
      if (!cfg) return { ok: false, error: "Cancelled by user." };

      const initialTotal = await waitFor(() => getTotalBetslipsFromToolbar(), {
        timeout: 8000,
        interval: 200,
      });

      const fallbackCycles = getOpenBetRows().length;
      const totalCycles = typeof initialTotal === "number" ? initialTotal : fallbackCycles;

      let expectedTotal = typeof initialTotal === "number" ? initialTotal : null;

      for (let cycle = 1; cycle <= totalCycles; cycle++) {
        const rows = getOpenBetRows();
        if (!rows.length) break;

        const currentToolbarTotal = getTotalBetslipsFromToolbar();
        if (typeof currentToolbarTotal === "number") expectedTotal = currentToolbarTotal;

        const row = rows[0];

        const prebuiltOk = await doCreatePrebuilt(row, cfg);
        if (prebuiltOk) {
          await doCancelBet(row);
        }

        // Auto wait
        if (typeof expectedTotal === "number") {
          const after = getTotalBetslipsFromToolbar();
          if (typeof after === "number" && after < expectedTotal) {
            await sleep(AFTER_DECREASE_EXTRA_WAIT_MS);
          } else {
            await waitForTotalToDrop(expectedTotal);
          }
        } else {
          await sleep(1500);
        }
      }

      return { ok: true };
    } catch (err) {
      console.error("[creator_quicksbb] Error:", err);
      return { ok: false, error: err?.message ? String(err.message) : String(err) };
    }
  });
})();
