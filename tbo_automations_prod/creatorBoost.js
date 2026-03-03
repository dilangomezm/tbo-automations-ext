// creatorBoost.js
(() => {
  if (!window.registerAutomation) return;

  window.registerAutomation("creator_boost", { name: "CreatorBoost" }, async () => {
    // =========================
    // BASE CONFIG
    // =========================
    const DEFAULT_BRANDS = [
      "Denmark/Expekt",
      "Denmark/LeoVegas",
      "Finland/Expekt",
      "Brazil/BetMGM",
      "Sweden/GoGO",
    ];

    const DEFAULT_MIN_ODDS = "1.5";
    const DEFAULT_MAX_ODDS = "15";

    const DEFAULT_MAX_STAKE_LIMIT = "70";
    const DEFAULT_TOTAL_STAKE_LIMIT = "50000";
    const DEFAULT_EVENT_TIMING_SAME_AS_START = false;
    const DEFAULT_SHOW_ON_HOMEPAGE = false;

    // Target Margin goals
    const DESIRED_BOOST_PCT = 15; // 1.15x
    const MIN_ACCEPTABLE_BOOST_PCT = 10; // 1.10x
    const TARGET_MARGIN_MIN = 0.01; // Solo aplica para Multibrands

    const CANCEL_REASON_FULL = "The actual result was not offered as an outcome. - NO_RESULT_ASSIGNABLE";
    const CANCEL_REASON_KEY = "NO_RESULT_ASSIGNABLE";

    const EXISTS_TEXT = "Prebuild Bet already exists for";
    const EMPTY_TEXT_EXACT = "No bets. Try to change filtering criteria.";

    const AUTO_WAIT_TIMEOUT_MS = 60000;
    const AFTER_DECREASE_EXTRA_WAIT_MS = 1000;

    // =========================
    // Helpers Universales
    // =========================
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

    const clickByPoint = (x, y) => {
      const target = document.elementFromPoint(x, y);
      if (!target) return false;
      const evInit = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
      try { target.dispatchEvent(new PointerEvent("pointerdown", { ...evInit, pointerId: 1, pointerType: "mouse" })); } catch {}
      try { target.dispatchEvent(new MouseEvent("mousedown", evInit)); } catch {}
      try { target.dispatchEvent(new MouseEvent("mouseup", evInit)); } catch {}
      try { target.dispatchEvent(new MouseEvent("click", evInit)); } catch {}
      try { target.focus?.(); } catch {}
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
      const ev = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true });
      document.dispatchEvent(ev);
      await sleep(120);
    };

    const isAnyListboxOpen = () => Array.from(document.querySelectorAll('ul[role="listbox"]')).some(isVisible);

    const setReactInputValue = (input, value) => {
      if (!input) return false;
      input.focus();
      const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, "value");
      const nativeSetter = desc && desc.set;
      if (nativeSetter) nativeSetter.call(input, String(value));
      else input.value = String(value);

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
      return true;
    };

    const trunc2 = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return NaN;
      return Math.trunc(x * 100) / 100;
    };

    // =========================
    // DYNAMIC WAIT HELPERS
    // =========================
    const getDisplayedRowsTextEl = () =>
      document.querySelector(".MuiTablePagination-displayedRows") ||
      Array.from(document.querySelectorAll("p")).find((p) => p.className?.includes("MuiTablePagination-displayedRows")) || null;

    const getTotalBetslipsFromToolbar = () => {
      const el = getDisplayedRowsTextEl();
      if (!el) return null;
      const m = (el.textContent || "").trim().match(/of\s+(\d+)/i);
      if (!m) return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };

    const waitForTotalToDropBy1 = async (startTotal) => {
      const start = Date.now();
      while (Date.now() - start < AUTO_WAIT_TIMEOUT_MS) {
        const cur = getTotalBetslipsFromToolbar();
        if (typeof cur === "number" && cur < startTotal) {
          await sleep(AFTER_DECREASE_EXTRA_WAIT_MS);
          return true;
        }

        const emptyEl = document.querySelector('[data-testid="empty-data-text"]');
        if (emptyEl && (emptyEl.textContent || "").trim() === EMPTY_TEXT_EXACT) {
          await sleep(500);
          return true;
        }

        if (startTotal === 1) {
            const openRows = getOpenBetRows();
            if (openRows.length === 0) {
                await sleep(AFTER_DECREASE_EXTRA_WAIT_MS);
                return true;
            }
        }
        await sleep(250);
      }
      return false;
    };

    const __saveClickGuard = new WeakMap();
    const clickOnceWithGuard = (el, guardMs = 3000) => {
      if (!el) return false;
      const now = Date.now();
      const last = __saveClickGuard.get(el) || 0;
      if (now - last < guardMs) return false;
      __saveClickGuard.set(el, now);
      try { el.scrollIntoView?.({ block: "center", inline: "center" }); } catch {}
      try { el.click(); } catch {}
      return true;
    };

    const clickSaveOnce = async (dialog, saveBtn) => {
      if (!dialog || !saveBtn) return false;
      const clicked = clickOnceWithGuard(saveBtn, 3000);
      if (!clicked) return true; 

      const outcome = await waitFor(
        () => {
          if (!dialog.isConnected || dialog.offsetParent === null) return "closed";
          const text = dialog.textContent || "";
          if (text.includes(EXISTS_TEXT)) return "exists";
          const errEl = dialog.querySelector('[data-testid="formErrorMessage"]');
          const errTxt = (errEl?.textContent || "").trim();
          if (errTxt === "Betslip update error." || text.includes("Close and edit betslip again.")) return "update_error";
          return null;
        },
        { timeout: 12000, interval: 150 }
      );

      if (outcome === "update_error") {
        const closeLink = Array.from(dialog.querySelectorAll("a")).find((a) => (a.textContent || "").trim() === "Close" && isVisible(a));
        if (closeLink) {
          try { closeLink.scrollIntoView?.({ block: "center", inline: "center" }); } catch {}
          await sleep(80);
          try { clickEl(closeLink); } catch {}
          await sleep(180);
          if (dialog.isConnected && dialog.offsetParent !== null) {
            try {
              const r = closeLink.getBoundingClientRect();
              clickByPoint(Math.floor(r.left + r.width / 2), Math.floor(r.top + r.height / 2));
            } catch {}
            await sleep(220);
          }
        }
        const xBtn = dialog.querySelector('[data-testid="dialog-popup-title-close-button"]');
        if (xBtn) { clickEl(xBtn); await sleep(250); }
        await waitFor(() => (!dialog.isConnected || dialog.offsetParent === null ? true : null), { timeout: 12000, interval: 200 });
        return false;
      }

      return outcome === "closed" || outcome === "exists";
    };

    // =========================
    // UI System (Floating Panels)
    // =========================
    const IMG_LIGHTNING = `<img alt="lighting icon" data-testid="lighting-icon" src="/39c1bcabd331ff1837b6.svg" style="width:18px;height:18px;display:block;">`;
    const SVG_MINIMIZE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>`;
    const SVG_CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;

    const injectStyles = () => {
      if (document.getElementById("creatorboost-style-tag")) return;
      const styleTag = document.createElement("style");
      styleTag.id = "creatorboost-style-tag";
      styleTag.textContent = `
        .cb-layer { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; z-index: 999999; }
        .cb-layer * { box-sizing: border-box; }

        .cb-floating-panel {
          position: fixed; width: 620px; max-width: 94vw; 
          background: #13161D; color: #E6E8EE;
          border: 1px solid rgba(255,255,255,0.10); border-radius: 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.45);
          display: flex; flex-direction: column; overflow: hidden;
        }

        .cb-head { 
          display: flex; align-items: center; justify-content: space-between; 
          padding: 12px 14px; background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.08); cursor: grab; user-select: none;
        }
        .cb-head:active { cursor: grabbing; }
        
        .cb-title-wrap { display: flex; align-items: center; gap: 8px; }
        .cb-title { font-size: 13px; font-weight: 600; letter-spacing: 0.2px; }

        .cb-window-controls { display: flex; align-items: center; gap: 6px; }
        .cb-icon-btn { 
          display: flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; border-radius: 6px; border: none; 
          background: transparent; color: rgba(230,232,238,0.65); cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
        }
        .cb-icon-btn:hover { background: rgba(255,255,255,0.08); color: #E6E8EE; }
        .cb-icon-btn.close:hover { background: rgba(255,80,80,0.2); color: #ff8181; }

        .cb-body { padding: 14px; max-height: 80vh; overflow-y: auto; }

        .cb-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; padding: 10px; margin-bottom: 10px; }
        .cb-section-title { font-size: 12px; font-weight: 600; margin-bottom: 8px; }
        .cb-section-title-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        
        .cb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .cb-label { font-size: 11px; color: rgba(230,232,238,0.65); margin-bottom: 6px; }

        .cb-input, .cb-select { 
          width: 100%; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.10);
          color: #E6E8EE; border-radius: 8px; padding: 10px; outline: none; font-size: 12px; font-weight: 400;
        }
        .cb-select option { background: #13161D; color: #E6E8EE; }
        .cb-input:focus, .cb-select:focus { border-color: rgba(240,166,74,0.55); box-shadow: 0 0 0 3px rgba(240,166,74,0.12); }

        .cb-row-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .cb-row { 
          display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); 
          cursor: pointer; user-select: none; transition: border-color 120ms ease, background 120ms ease;
        }
        .cb-row:hover { border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.03); }
        .cb-chk { width: 14px; height: 14px; accent-color: #F0A64A; }

        .cb-switch-row { 
          display: flex; align-items: center; justify-content: space-between; gap: 10px; 
          border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; padding: 10px; background: rgba(255,255,255,0.02); 
        }
        .cb-switch { 
          appearance: none; width: 38px; height: 22px; border-radius: 999px; 
          background: rgba(255,255,255,0.18); position: relative; cursor: pointer; 
          transition: background 120ms ease; border: 1px solid rgba(255,255,255,0.10);
        }
        .cb-switch::after { 
          content: ""; position: absolute; top: 1px; left: 1px; width: 18px; height: 18px; 
          border-radius: 50%; background: #fff; transition: transform 120ms ease;
        }
        .cb-switch:checked { background: rgba(240,166,74,0.85); }
        .cb-switch:checked::after { transform: translateX(16px); }

        .cb-btn-row { display: flex; gap: 10px; margin-top: 10px; }
        .cb-btn { 
          border-radius: 12px; padding: 10px 12px; font-size: 12px; font-weight: 600;
          border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.03); 
          color: #E6E8EE; cursor: pointer; transition: transform 80ms ease, border-color 120ms ease, background 120ms ease; user-select: none; 
        }
        .cb-btn:hover { border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); }
        .cb-btn:active { transform: translateY(1px); }
        .cb-btn-primary { flex: 1; color: #111; background: linear-gradient(180deg, rgba(240,166,74,0.95) 0%, rgba(200,133,51,0.95) 100%); border: none; }
        .cb-err { color: #ff8181; font-size: 11px; min-height: 14px; margin-top: 2px; }

        .cb-acc-btn { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 0; background: transparent; padding: 0; cursor: pointer; color: #E6E8EE; }
        .cb-acc-icon { width: 18px; height: 18px; opacity: 0.9; transition: transform 120ms ease; color: #E6E8EE; }
        .cb-acc-btn[aria-expanded="true"] .cb-acc-icon { transform: rotate(180deg); }
        .cb-acc-details { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.10); display: none; }
        .cb-acc-btn[aria-expanded="true"] + .cb-acc-details { display: block; }
        
        .cb-timing-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .cb-timing-inputs { display: flex; gap: 8px; align-items: center; }
        .cb-hhmm { width: 78px; display: flex; align-items: center; gap: 6px; }
        .cb-hhmm .cb-input { padding: 8px 10px; }
      `;
      document.head.appendChild(styleTag);
    };

    const makeDraggable = (panel, handle) => {
      let isDragging = false, startX, startY, startLeft, startTop;
      handle.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return; 
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = startLeft + (e.clientX - startX) + 'px';
        panel.style.top = startTop + (e.clientY - startY) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.transform = 'none';
      });
      document.addEventListener('mouseup', () => { isDragging = false; });
    };

    // UI Orchestrator
    const getUserConfig = async () => {
      injectStyles();
      document.getElementById("cb-floating-root")?.remove();

      const container = document.createElement("div");
      container.id = "cb-floating-root";
      container.className = "cb-layer";

      const panel = document.createElement("div");
      panel.className = "cb-floating-panel";
      // Position center initially
      panel.style.left = `${window.innerWidth / 2 - 310}px`;
      panel.style.top = `100px`;

      panel.innerHTML = `
        <div class="cb-head" id="cb-drag-handle">
          <div class="cb-title-wrap">
            ${IMG_LIGHTNING}
            <div class="cb-title">Boost</div>
          </div>
          <div class="cb-window-controls">
            <button class="cb-icon-btn minimize" id="cb-win-min">${SVG_MINIMIZE}</button>
            <button class="cb-icon-btn close" id="cb-win-close">${SVG_CLOSE}</button>
          </div>
        </div>
        <div class="cb-body" id="cb-dynamic-body"></div>
      `;
      container.appendChild(panel);
      document.body.appendChild(container);

      makeDraggable(panel, panel.querySelector('#cb-drag-handle'));

      const bodyEl = panel.querySelector('#cb-dynamic-body');
      
      // Window Controls
      panel.querySelector('#cb-win-min').onclick = () => {
        bodyEl.style.display = bodyEl.style.display === 'none' ? 'block' : 'none';
      };

      return new Promise((resolve) => {
        const closePanel = () => { container.remove(); resolve(null); };
        panel.querySelector('#cb-win-close').onclick = closePanel;

        // STEP 1: Select Region
        const renderStep1 = () => {
          bodyEl.innerHTML = `
            <div style="font-size: 12px; margin-bottom: 12px; color: rgba(230,232,238,0.65); text-align: center;">
              Select the regulation for this boost session:
            </div>
            <div class="cb-btn-row" style="flex-direction: column; gap: 12px; margin-top: 5px;">
              <button id="cb-btn-multi" class="cb-btn cb-btn-primary">Boost Multibrands</button>
              <button id="cb-btn-brazil" class="cb-btn cb-btn-primary">Boost Brazil</button>
            </div>
          `;
          bodyEl.querySelector('#cb-btn-multi').onclick = () => renderStep2('multibrands');
          bodyEl.querySelector('#cb-btn-brazil').onclick = () => renderStep2('brazil');
        };

        // STEP 2: Main Config
        const renderStep2 = (region) => {
          // Filtrar marcas según selección
          const brandsToShow = region === 'brazil' ? ["Brazil/BetMGM"] : DEFAULT_BRANDS;

          bodyEl.innerHTML = `
            <div class="cb-card">
              <div class="cb-section-title">Brands</div>
              <div class="cb-row-grid">
                ${brandsToShow.map(b => `
                  <label class="cb-row">
                    <input class="cb-chk" type="checkbox" data-brand="${b}" />
                    <span style="font-size:11px; font-weight:600; color:#E6E8EE;">${b}</span>
                  </label>
                `).join("")}
              </div>
            </div>

            <div class="cb-grid-2">
              <div class="cb-card" style="margin-bottom:0;">
                <div class="cb-label">Min odds</div>
                <input id="cb-min" class="cb-input" value="${DEFAULT_MIN_ODDS}" />
              </div>
              <div class="cb-card" style="margin-bottom:0;">
                <div class="cb-label">Max odds</div>
                <input id="cb-max" class="cb-input" value="${DEFAULT_MAX_ODDS}" />
              </div>
            </div>

            <div class="cb-card">
              <div class="cb-section-title-row">
                ${IMG_LIGHTNING}
                <div class="cb-section-title" style="margin:0;">Boost</div>
              </div>
              
              <div style="margin-bottom:10px;">
                <select id="cb-boost-type" class="cb-select">
                  <option value="None" selected>None</option>
                  <option value="Odds">Odds</option>
                  <option value="Target Margin">Target Margin</option>
                  <option value="Boost Factor">Boost Factor</option>
                </select>
              </div>

              <div id="cb-boost-fields" style="display:none;">
                <div id="cb-boost-main-row" style="margin-bottom:10px; display:none;">
                  <div class="cb-label" id="cb-boost-main-label"></div>
                  <input id="cb-boost-main-input" class="cb-input" value="" />
                </div>
                <div class="cb-grid-2" style="margin-bottom:0;">
                  <div>
                    <div class="cb-label">Max stake limit</div>
                    <input id="cb-max-stake" class="cb-input" value="${DEFAULT_MAX_STAKE_LIMIT}" />
                  </div>
                  <div>
                    <div class="cb-label">Total stake limit</div>
                    <input id="cb-total-stake" class="cb-input" value="${DEFAULT_TOTAL_STAKE_LIMIT}" />
                  </div>
                </div>
              </div>
            </div>

            <div class="cb-card">
              <button id="cb-eventtiming-acc" class="cb-acc-btn" type="button" aria-expanded="false">
                <div class="cb-section-title" style="margin:0;">Event Timing</div>
                <svg class="cb-acc-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10l5 5 5-5z"></path></svg>
              </button>
              <div class="cb-acc-details">
                <div class="cb-timing-row">
                  <div class="cb-label">Countdown to start</div>
                  <div class="cb-timing-inputs">
                    <div class="cb-hhmm"><input class="cb-input" placeholder="hh" /><span class="cb-label" style="margin:0">hh</span></div>
                    <div class="cb-hhmm"><input class="cb-input" placeholder="mm" /><span class="cb-label" style="margin:0">mm</span></div>
                  </div>
                </div>
                <div class="cb-switch-row" style="margin-bottom:10px;">
                  <div style="font-size:11px;">Same as event start</div>
                  <input id="cb-eventtiming-same" type="checkbox" class="cb-switch" ${DEFAULT_EVENT_TIMING_SAME_AS_START ? "checked" : ""} />
                </div>
                <div class="cb-timing-row" style="margin-bottom:0;">
                  <div class="cb-label">Custom</div>
                  <input class="cb-input" placeholder="YYYY-MM-DD hh:mm" />
                </div>
              </div>
            </div>

            <div class="cb-card">
              <div class="cb-switch-row">
                <div style="font-size:11px; font-weight:600;">Show on Homepage</div>
                <input id="cb-homepage" type="checkbox" class="cb-switch" ${DEFAULT_SHOW_ON_HOMEPAGE ? "checked" : ""} />
              </div>
              <div id="cb-priority-container" style="display: ${DEFAULT_SHOW_ON_HOMEPAGE ? "block" : "none"}; margin-top: 10px;">
                <div class="cb-label">Priority</div>
                <input id="cb-priority" class="cb-input" value="" placeholder="" />
              </div>
            </div>

            <div id="cb-error" class="cb-err"></div>

            <div class="cb-btn-row">
              <button id="cb-run" class="cb-btn cb-btn-primary" type="button">Run CreatorBoost</button>
            </div>
          `;

          // Bind interactions for step 2
          const accBtn = bodyEl.querySelector("#cb-eventtiming-acc");
          accBtn.onclick = () => accBtn.setAttribute("aria-expanded", accBtn.getAttribute("aria-expanded") === "true" ? "false" : "true");

          const boostType = bodyEl.querySelector("#cb-boost-type");
          const fields = bodyEl.querySelector("#cb-boost-fields");
          const mainRow = bodyEl.querySelector("#cb-boost-main-row");
          const mainLabel = bodyEl.querySelector("#cb-boost-main-label");
          
          boostType.onchange = () => {
            const v = boostType.value;
            fields.style.display = v === "None" ? "none" : "block";
            mainRow.style.display = (v === "None" || v === "Target Margin") ? "none" : "block";
            if (v === "Odds") mainLabel.textContent = "Boosted Odds";
            else if (v === "Boost Factor") mainLabel.textContent = "Multiplier";
          };

          const homepageSwitch = bodyEl.querySelector("#cb-homepage");
          const priorityContainer = bodyEl.querySelector("#cb-priority-container");
          homepageSwitch.onchange = () => {
            priorityContainer.style.display = homepageSwitch.checked ? "block" : "none";
          };

          bodyEl.querySelector("#cb-run").onclick = () => {
            const checkedBrands = Array.from(bodyEl.querySelectorAll('input[type="checkbox"][data-brand]:checked')).map(cb => cb.getAttribute("data-brand"));
            const min = bodyEl.querySelector("#cb-min").value?.trim();
            const max = bodyEl.querySelector("#cb-max").value?.trim();
            const bType = boostType.value;
            const maxStake = bodyEl.querySelector("#cb-max-stake")?.value?.trim() || "";
            const totalStake = bodyEl.querySelector("#cb-total-stake")?.value?.trim() || "";
            const boostMainValue = bodyEl.querySelector("#cb-boost-main-input")?.value?.trim() || "";
            const sameStart = !!bodyEl.querySelector("#cb-eventtiming-same")?.checked;
            const showHome = !!homepageSwitch?.checked;
            const priorityVal = showHome ? (bodyEl.querySelector("#cb-priority")?.value?.trim() || "") : "";
            
            const err = bodyEl.querySelector("#cb-error");
            if (!checkedBrands.length) return err.textContent = "Select at least 1 brand.";
            if (!min || isNaN(Number(min))) return err.textContent = "Min odds invalid.";
            if (!max || isNaN(Number(max))) return err.textContent = "Max odds invalid.";
            if (Number(max) < Number(min)) return err.textContent = "Max >= Min required.";
            if (bType !== "None" && (!maxStake || isNaN(Number(maxStake)) || !totalStake || isNaN(Number(totalStake)))) return err.textContent = "Stake limits invalid.";
            if ((bType === "Odds" || bType === "Boost Factor") && (!boostMainValue || isNaN(Number(boostMainValue)))) return err.textContent = "Boost value invalid.";
            if (showHome && priorityVal && isNaN(Number(priorityVal))) return err.textContent = "Priority must be a valid number.";

            container.remove();
            resolve({
              region, // 'multibrands' o 'brazil'
              brands: checkedBrands,
              minOdds: String(min), maxOdds: String(max), boostType: bType,
              boostMainValue: String(boostMainValue), maxStakeLimit: String(maxStake), totalStakeLimit: String(totalStake),
              eventTimingSameAsStart: sameStart, showOnHomepage: showHome,
              priority: priorityVal
            });
          };
        };

        renderStep1(); // Init with step 1
      });
    };

    // =========================
    // Results collector & UI
    // =========================
    const __results = { successCount: 0, skipped: [] };
    const buildBetslipUrl = (uuid) => `https://leo-prod-trading-bo.k8s.goldrush.llc/bets/search/list?betslipUuid=${encodeURIComponent(uuid || "")}`;
    
    const showResultsModal = (results) => {
      document.getElementById("cb-floating-root")?.remove();
      const container = document.createElement("div");
      container.id = "cb-floating-root";
      container.className = "cb-layer";
      
      const panel = document.createElement("div");
      panel.className = "cb-floating-panel";
      panel.style.left = `${window.innerWidth / 2 - 400}px`;
      panel.style.top = `100px`;
      panel.style.width = '800px';

      const z = results.skipped?.length || 0;
      panel.innerHTML = `
        <div class="cb-head" id="cb-drag-handle">
          <div class="cb-title-wrap">${IMG_LIGHTNING}<div class="cb-title">CreatorBoost - Results</div></div>
          <div class="cb-window-controls">
             <button class="cb-icon-btn close" id="cb-win-close">${SVG_CLOSE}</button>
          </div>
        </div>
        <div class="cb-body">
          <div style="font-size:12px; margin-bottom:10px;"><strong style="color:#E6E8EE">Success:</strong> ${results.successCount} boosts created.</div>
          <div style="font-size:12px; margin-bottom:10px; color:rgba(230,232,238,0.75)"><strong style="color:#E6E8EE">Needs replacement:</strong> ${z} boosts did not reach the required margin.</div>
          ${z ? `
            <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:11px; border:1px solid rgba(255,255,255,0.1); border-radius:8px; overflow:hidden;">
              <thead style="background:rgba(255,255,255,0.02); text-align:left;">
                <tr><th style="padding:8px;">Event</th><th style="padding:8px;">Margin</th><th style="padding:8px;">Link</th></tr>
              </thead>
              <tbody>
                ${results.skipped.map(r => `
                  <tr style="border-top:1px solid rgba(255,255,255,0.08)">
                    <td style="padding:8px;">${r.eventName || "-"}</td>
                    <td style="padding:8px;">${Number.isFinite(Number(r.marginPct)) ? Number(r.marginPct).toFixed(2)+'%' : "-"}</td>
                    <td style="padding:8px;"><a href="${buildBetslipUrl(r.betslipUuid)}" target="_blank" style="color:#F0A64A; text-decoration:none;">View</a></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : ""}
        </div>
      `;
      container.appendChild(panel);
      document.body.appendChild(container);
      makeDraggable(panel, panel.querySelector('#cb-drag-handle'));
      panel.querySelector('#cb-win-close').onclick = () => container.remove();
    };

    // =========================
    // Extractor de Probabilidades Universal (.reduce)
    // =========================
    const extractProbabilityAndOddsFromTheoreticalPayload = (payload) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      if (!root || typeof root !== "object") return null;

      const tmc = root.tmcCalculationConditions || {};
      const comboItems = root.combinationInfo?.items || [];
      
      const syncOdds = Number(tmc.productCombinationSyncOdds) || Number(comboItems[0]?.syncOdds) || null;
      
      let probability = null;
      if (comboItems.length > 0) {
        probability = comboItems.reduce((acc, item) => {
          const p = Number(item.probability);
          return acc * (Number.isFinite(p) ? p : 1);
        }, 1);
      }

      if (!Number.isFinite(probability) || probability === 1) {
        const tmcOutcomeData = tmc.outcomeData && typeof tmc.outcomeData === "object" ? Object.values(tmc.outcomeData) : [];
        if (tmcOutcomeData.length > 0) {
          probability = tmcOutcomeData.reduce((acc, item) => {
            const p = Number(item.probability);
            return acc * (Number.isFinite(p) ? p : 1);
          }, 1);
        }
      }

      if (!Number.isFinite(syncOdds) || !Number.isFinite(probability) || probability <= 0) return null;
      return { syncOdds, probability };
    };

    // =========================
    // Core TBO Automation
    // =========================
    const isRowOpen = (row) => {
      const statusSpan = row.querySelector("td:nth-child(2) span");
      if (statusSpan && norm(statusSpan.textContent) === "open") return true;
      return Array.from(row.querySelectorAll("span")).some((s) => norm(s.textContent) === "open");
    };
    const getOpenBetRows = () => Array.from(document.querySelectorAll('tr[data-testid="bet-row"]')).filter(isRowOpen);

    const getRowMenuButton = (row) => {
      const cell = row?.querySelector('td[data-testid="bets-row-menu-cell"]');
      return cell ? (cell.querySelector('[role="button"]') || cell.querySelector("button")) : null;
    };
    const openRowMenu = async (row) => {
      const btn = getRowMenuButton(row);
      if (!btn) return false;
      clickEl(btn);
      return !!await waitFor(() => document.querySelector('ul[role="menu"], .MuiMenu-list, [role="menu"]'), { timeout: 4000, interval: 100 });
    };

    const clickMenuItemCreatePrebuilt = async () => {
      const item = document.querySelector('li[data-testid^="createPrebuildBet"]') || Array.from(document.querySelectorAll('li[role="menuitem"]')).find((li) => norm(li.textContent).includes("create prebuilt bet"));
      if (!item) return false; clickEl(item); return true;
    };
    const clickMenuItemEdit = async () => {
      const item = Array.from(document.querySelectorAll('li[role="menuitem"]')).find((li) => norm(li.textContent) === "edit");
      if (!item) return false; clickEl(item); return true;
    };
    const clickMenuItemDetails = async () => {
      const item = Array.from(document.querySelectorAll('li[role="menuitem"]')).find((li) => norm(li.textContent) === "details");
      if (!item) return false; clickEl(item); return true;
    };

    const getActiveDialog = () => Array.from(document.querySelectorAll('[role="dialog"], .MuiDialog-root')).find((d) => d && d.offsetParent !== null) || null;
    const closeDialogWithX = async (dialog) => {
      if (!dialog) return false;
      const xBtn = dialog.querySelector('[data-testid="dialog-popup-title-close-button"]');
      if (!xBtn) return false; clickEl(xBtn);
      return !!await waitFor(() => !dialog.isConnected || dialog.offsetParent === null, { timeout: 15000, interval: 250 });
    };

    const getVisibleListboxes = () => Array.from(document.querySelectorAll('ul[role="listbox"]')).filter(isVisible);

    const openLocationBrandListbox = async (dialog) => {
      const wrapper = dialog.querySelector('[data-testid="location-brand-select"]');
      if (!wrapper) return null;
      const combo = wrapper.querySelector('[role="combobox"]') || wrapper.querySelector('[aria-haspopup="listbox"]') || wrapper.querySelector("button");
      if (!combo) return null;
      clickEl(combo);
      return await waitFor(() => getVisibleListboxes().slice(-1)[0] || null, { timeout: 5000, interval: 150 });
    };

    const selectBrandsByVisibleText = async (dialog, brands) => {
      const lb = await openLocationBrandListbox(dialog);
      if (!lb) return false;
      for (const b of brands) {
        const opt = await waitFor(() => Array.from(lb.querySelectorAll('li[role="option"], li')).filter(isVisible).find(o => norm(o.textContent).includes(norm(b))), { timeout: 2500, interval: 120 });
        if (!opt) continue;
        clickEl(opt.querySelector('input[type="checkbox"]')?.closest("span,button,div") || opt.querySelector(".MuiCheckbox-root") || opt);
        await sleep(220);
      }
      return true;
    };
    const closeBrandsByClickingMinOdds = async (dialog) => {
      const minInput = dialog.querySelector("#input-minimumOdds") || dialog.querySelector('input[id*="minimumOdds"]');
      if (!minInput) return false;
      await clickInputHuman(minInput);
      if (isAnyListboxOpen()) { await sendEscape(); await clickInputHuman(minInput); }
      return true;
    };

    const selectBoostOption = async (dialog, optionNeedle) => {
      const boostWrapper = dialog.querySelector('[data-testid="prebuild-bet-create-popup-boost-select"]');
      if (!boostWrapper) return false;
      const combo = boostWrapper.querySelector('[role="combobox"]') || boostWrapper.querySelector(".MuiSelect-select") || boostWrapper.querySelector('[aria-haspopup="listbox"]');
      if (!combo) return false;

      const raw = (optionNeedle || "None").trim();
      const map = { None: "None", Odds: "Odds", "Target Margin": "Target margin", "Boost Factor": "Boost factor" };
      const needle = norm(map[raw] || raw);
      if (norm(combo.textContent).includes(needle)) return true;

      for (let i = 0; i < 3; i++) { if (!isAnyListboxOpen()) break; await sendEscape(); await sleep(180); }

      const tryOpen = async () => {
        try { const r = combo.getBoundingClientRect(); clickByPoint(Math.floor(r.left + r.width / 2), Math.floor(r.top + r.height / 2)); } catch {}
        await sleep(200);
        if (!isAnyListboxOpen()) { try { clickEl(combo); } catch {} await sleep(200); }
        if (!isAnyListboxOpen()) { try { clickEl(boostWrapper); } catch {} await sleep(200); }
      };

      for (let attempt = 1; attempt <= 4; attempt++) {
        await tryOpen();
        const lb = await waitFor(() => {
            const lbs = getVisibleListboxes();
            for (const x of lbs) {
              if (Array.from(x.querySelectorAll('li[role="option"], li')).filter(isVisible).some((o) => norm(o.textContent).includes(needle))) return x;
            }
            return null;
          }, { timeout: 2500, interval: 120 }
        );
        if (!lb) { await sendEscape(); await sleep(160); continue; }

        const targetOpt = Array.from(lb.querySelectorAll('li[role="option"], li')).filter(isVisible).find((o) => norm(o.textContent).includes(needle));
        if (!targetOpt) { await sendEscape(); await sleep(160); continue; }

        clickEl(targetOpt); await sleep(250);
        if (await waitFor(() => (norm(combo.textContent).includes(needle) ? true : null), { timeout: 2500, interval: 120 })) return true;
        await sendEscape(); await sleep(160);
      }
      return false;
    };

    const applyShowOnHomepage = async (dialog, desired) => {
      const homepageInput = dialog.querySelector('[data-testid="prebuild-bet-create-popup-homepage-toggle"] input[type="checkbox"]') || dialog.querySelector('[data-testid="prebuild-bet-create-popup-homepage"] input[type="checkbox"]');
      if (!homepageInput) return true;
      if (!!homepageInput.checked === !!desired) return true;
      try { homepageInput.focus?.(); homepageInput.click(); } catch {}
      await sleep(180);
      return true;
    };

    const applyEventTimingSameAsStart = async (dialog, desired) => {
      const btn = Array.from(dialog.querySelectorAll('button.MuiAccordionSummary-root, button[aria-expanded]')).find((b) => (b.textContent || "").toLowerCase().includes("event timing"));
      if (!btn) return true;
      if (btn.getAttribute("aria-expanded") !== "true") { try { clickEl(btn); } catch {} await sleep(200); }
      if (btn.getAttribute("aria-expanded") !== "true") return true;

      const sameInput = dialog.querySelector('input[type="checkbox"][name="sameAsEventStart"]');
      if (!sameInput) return true;
      if (!!sameInput.checked === !!desired) return true;
      try { sameInput.focus?.(); sameInput.click(); } catch {}
      await sleep(180);
      return true;
    };

    const openBetslipDetailsDialog = async (row) => {
      if (!(await openRowMenu(row))) return null;
      if (!(await clickMenuItemDetails())) return null;
      return await waitFor(() => getActiveDialog(), { timeout: 8000, interval: 150 });
    };
    const clickTechnicalDetailsTab = async (detailsDialog) => {
      const tab = await waitFor(() => Array.from(detailsDialog.querySelectorAll('[role="tab"], button')).find((el) => norm(el.textContent).includes("technical details")), { timeout: 6000, interval: 120 });
      if (!tab) return false; clickEl(tab); await sleep(350); return true;
    };
    const clickTheoreticalMarginDetailsTab = async (detailsDialog) => {
      const tab = await waitFor(() => Array.from(detailsDialog.querySelectorAll('[role="tab"], button')).find((el) => norm(el.textContent).includes("theoretical margin details")), { timeout: 6000, interval: 120 });
      if (!tab) return false; clickEl(tab); await sleep(350); return true;
    };
    const readDataDetailsTextBox = async (detailsDialog) => {
      let box = await waitFor(() => detailsDialog.querySelector('[data-testid="data-details-field-text-content-box"]'), { timeout: 6000, interval: 150 });
      if (!box) {
        box = Array.from(detailsDialog.querySelectorAll("div, pre")).find((el) => {
            if (!isVisible(el)) return false;
            const t = (el.textContent || "").trim();
            return (t.startsWith("{") && t.includes('"messages"')) || (t.startsWith("[") && t.includes('"tmcCalculationConditions"'));
          });
      }
      return box ? (box.textContent || "").trim() : null;
    };

    const safeJsonParse = (txt) => { try { return JSON.parse(txt); } catch { try { return JSON.parse(txt.replace(/\u00A0/g, " ").replace(/\u200B/g, "").trim()); } catch { return null; } } };
    const extractEventNameFromTechnicalPayload = (payload) => {
      const messages = Array.isArray(payload?.messages) ? payload.messages : [];
      const name = messages[0]?.betslip?.events?.[0]?.name;
      return typeof name === "string" && name.trim() ? name.trim() : null;
    };
    const extractBetslipUuidFromTechnicalPayload = (payload) => {
      const messages = Array.isArray(payload?.messages) ? payload.messages : [];
      const uuid = messages[0]?.betslip?.uuid;
      return typeof uuid === "string" && uuid.trim() ? uuid.trim() : null;
    };

    const readDetailsPack = async (row) => {
      const detailsDialog = await openBetslipDetailsDialog(row);
      if (!detailsDialog) return null;

      try {
        let eventName = null; let betslipUuid = null;
        if (await clickTechnicalDetailsTab(detailsDialog)) {
          const techTxt = await readDataDetailsTextBox(detailsDialog);
          const techPayload = techTxt ? safeJsonParse(techTxt) : null;
          eventName = extractEventNameFromTechnicalPayload(techPayload);
          betslipUuid = extractBetslipUuidFromTechnicalPayload(techPayload);
        }

        if (!(await clickTheoreticalMarginDetailsTab(detailsDialog))) return { eventName, betslipUuid, syncOdds: null, probability: null };

        const theoTxt = await readDataDetailsTextBox(detailsDialog);
        const theoPayload = theoTxt ? safeJsonParse(theoTxt) : null;
        const extracted = theoPayload ? extractProbabilityAndOddsFromTheoreticalPayload(theoPayload) : null;
        return { eventName, betslipUuid, syncOdds: extracted?.syncOdds ?? null, probability: extracted?.probability ?? null };
      } finally {
        await closeDialogWithX(detailsDialog); await sleep(220);
      }
    };

    const getExistsErrorLines = (dialog) => {
      if (!dialog) return [];
      const nodes = Array.from(dialog.querySelectorAll("div, p, span, li")).filter(isVisible).map((el) => el.textContent?.trim()).filter(Boolean);
      const hits = nodes.filter((t) => t.includes(EXISTS_TEXT));
      if (!hits.length && dialog.textContent?.includes(EXISTS_TEXT)) {
        return dialog.textContent.split("\n").map((s) => s.trim()).filter(Boolean).filter((t) => t.includes(EXISTS_TEXT));
      }
      return hits;
    };
    const clickClosePrebuiltDialog = async (dialog) => {
      const closeBtn = dialog.querySelector('[data-testid="prebuild-bet-create-cancel-button"]') || Array.from(dialog.querySelectorAll('[role="button"], button, span[role="button"]')).find((el) => norm(el.textContent) === "close");
      if (!closeBtn) return false; clickEl(closeBtn);
      return !!await waitFor(() => !dialog.isConnected || dialog.offsetParent === null, { timeout: 15000, interval: 250 });
    };

    const doCreateBoost = async (row, cfg) => {
      const pack = await readDetailsPack(row);
      const eventNameFromTech = pack?.eventName ?? null;
      const betslipUuidFromTech = pack?.betslipUuid ?? null;
      const baseSyncOddForTM = Number(pack?.syncOdds);
      const probabilityForTM = Number(pack?.probability);

      let tmUsedForBoost = null;
      if ((cfg.boostType || "None").trim() === "Target Margin") {
        if (!Number.isFinite(baseSyncOddForTM) || !Number.isFinite(probabilityForTM) || probabilityForTM <= 0) return false;
        
        const goal15 = baseSyncOddForTM * (1 + DESIRED_BOOST_PCT / 100);
        const minAccept10 = baseSyncOddForTM * (1 + MIN_ACCEPTABLE_BOOST_PCT / 100);
        const tmRaw15 = 100 * (1 - probabilityForTM * goal15);
        
        // APLICACIÓN DE LA NUEVA REGLA (Brasil vs Multibrands)
        if (cfg.region === 'brazil') {
            tmUsedForBoost = trunc2(tmRaw15); // Permite negativos
        } else {
            tmUsedForBoost = tmRaw15 < TARGET_MARGIN_MIN ? TARGET_MARGIN_MIN : trunc2(tmRaw15); // Capped at 0.01
        }

        const oddFinalByTM = trunc2((1 - tmUsedForBoost / 100) / probabilityForTM);
        
        if (cfg.region === 'multibrands' && tmUsedForBoost === TARGET_MARGIN_MIN && oddFinalByTM < minAccept10) {
          __results.skipped.push({ eventName: eventNameFromTech, betslipUuid: betslipUuidFromTech, marginPct: ((oddFinalByTM / baseSyncOddForTM) - 1) * 100 });
          return false;
        }
      }

      if (!(await openRowMenu(row))) return false;
      if (!(await clickMenuItemCreatePrebuilt())) return false;

      const dialog = await waitFor(() => getActiveDialog(), { timeout: 8000, interval: 150 });
      if (!dialog) return false;

      const okBrands = await selectBrandsByVisibleText(dialog, cfg.brands);
      if (!okBrands) return false;

      await closeBrandsByClickingMinOdds(dialog);
      const inputMin = dialog.querySelector("#input-minimumOdds") || dialog.querySelector('input[id*="minimumOdds"]');
      const inputMax = dialog.querySelector("#input-maximumOdds") || dialog.querySelector('input[id*="maximumOdds"]');
      if (!inputMin || !inputMax) return false;

      await clickInputHuman(inputMin); setReactInputValue(inputMin, cfg.minOdds); await sleep(180);
      await clickInputHuman(inputMax); setReactInputValue(inputMax, cfg.maxOdds); await sleep(220);

      const boostType = (cfg.boostType || "None").trim();
      const boostSelected = await selectBoostOption(dialog, boostType);
      if (!boostSelected) return false; await sleep(250);

      const findInputByLabelText = (root, labelText) => {
        const lbl = Array.from(root.querySelectorAll("label")).find((l) => norm(l.textContent).includes(norm(labelText)));
        if (!lbl) return null;
        const container = lbl.closest('[data-testid], .MuiBox-root, .MuiGrid-root, .MuiFormControl-root, div') || lbl.parentElement;
        return container ? container.querySelector("input") || container.parentElement?.querySelector("input") || null : null;
      };

      if (boostType !== "None") {
        const maxStakeInput = dialog.querySelector("#maximumWager") || findInputByLabelText(dialog, "Max stake limit");
        const totalStakeInput = dialog.querySelector("#globalWagerLimit") || findInputByLabelText(dialog, "Total stake limit");
        if (maxStakeInput && totalStakeInput) {
          await clickInputHuman(maxStakeInput); setReactInputValue(maxStakeInput, cfg.maxStakeLimit); await sleep(160);
          await clickInputHuman(totalStakeInput); setReactInputValue(totalStakeInput, cfg.totalStakeLimit); await sleep(160);
        }
      }

      if (boostType === "Target Margin") {
        const targetMarginInput = dialog.querySelector("#targetMargin") || findInputByLabelText(dialog, "Target margin");
        if (!targetMarginInput) return false;
        await clickInputHuman(targetMarginInput); setReactInputValue(targetMarginInput, String(tmUsedForBoost)); await sleep(180);
      } else if (boostType === "Odds") {
        const boostedOddsInput = findInputByLabelText(dialog, "Boosted Odds") || findInputByLabelText(dialog, "Boosted odds");
        if (boostedOddsInput) { await clickInputHuman(boostedOddsInput); setReactInputValue(boostedOddsInput, String(cfg.boostMainValue || "")); await sleep(180); }
      } else if (boostType === "Boost Factor") {
        const multiplierInput = findInputByLabelText(dialog, "Multiplier");
        if (multiplierInput) { await clickInputHuman(multiplierInput); setReactInputValue(multiplierInput, String(cfg.boostMainValue || "")); await sleep(180); }
      }

      try { await applyEventTimingSameAsStart(dialog, !!cfg.eventTimingSameAsStart); } catch {}
      
      try { 
        await applyShowOnHomepage(dialog, !!cfg.showOnHomepage);
        await sleep(250); // Darle tiempo a la UI del TBO para revelar "Priority"
        
        // Inyectar Priority si se solicitó mostrar en homepage y tiene valor
        if (cfg.showOnHomepage && cfg.priority) {
            const priorityInput = findInputByLabelText(dialog, "Priority") || dialog.querySelector('input[name="priority"], #priority');
            if (priorityInput) {
                await clickInputHuman(priorityInput); 
                setReactInputValue(priorityInput, String(cfg.priority)); 
                await sleep(180);
            }
        }
      } catch {}

      await clickInputHuman(inputMin); await sleep(150);
      const saveBtn = await waitFor(() => dialog.querySelector('[data-testid="prebuild-bet-create-save-button"]'), { timeout: 8000, interval: 150 });
      if (!saveBtn) return false;
      if (!await waitFor(() => (!saveBtn.disabled && saveBtn.getAttribute("disabled") === null ? true : null), { timeout: 12000, interval: 200 })) return false;

      try { saveBtn.style.pointerEvents = "none"; } catch {}

      if (!await clickSaveOnce(dialog, saveBtn)) return false;
      await sleep(220);

      const outcome = await waitFor(() => {
          if (!dialog.isConnected || dialog.offsetParent === null) return { type: "closed" };
          const lines = getExistsErrorLines(dialog);
          if (lines.length) return { type: "exists_error", lines };
          return null;
        }, { timeout: 8000, interval: 200 }
      );

      if (!outcome) return false;
      if (outcome.type === "exists_error") return await clickClosePrebuiltDialog(dialog);

      __results.successCount += 1;
      return true;
    };

    const doCancelBet = async (row) => {
      if (!(await openRowMenu(row))) return false;
      if (!(await clickMenuItemEdit())) return false;

      const dialog = await waitFor(() => getActiveDialog(), { timeout: 8000, interval: 150 });
      if (!dialog) return false;

      {
        const cancelLabel = Array.from(dialog.querySelectorAll("label.MuiFormControlLabel-root, label")).find((el) => (el.textContent || "").toLowerCase().includes("cancel bet"));
        const cancelSwitchBase = dialog.querySelector('[data-testid="cancelled-toggle"]') || null;
        const cancelInput = cancelSwitchBase?.querySelector('input[type="checkbox"]') || dialog.querySelector("#cancelled") || dialog.querySelector('input[name="cancelled"][type="checkbox"]') || null;
        if (!cancelLabel || !cancelSwitchBase || !cancelInput) return false;
        
        const isCancelOnVisual = () => cancelSwitchBase.classList.contains("Mui-checked");
        if (!isCancelOnVisual()) {
          try { clickEl(cancelLabel); } catch { try { cancelLabel.click(); } catch {} }
          await sleep(220);
          let turnedOnVisual = await waitFor(() => (isCancelOnVisual() ? true : null), { timeout: 1200, interval: 80 });
          if (!turnedOnVisual) {
            try { const r = cancelSwitchBase.getBoundingClientRect(); if (r.width > 0 && r.height > 0) clickByPoint(Math.floor(r.left + r.width / 2), Math.floor(r.top + r.height / 2)); } catch {}
            turnedOnVisual = await waitFor(() => (isCancelOnVisual() ? true : null), { timeout: 1200, interval: 80 });
          }
          if (!turnedOnVisual) return false;
        }
      }

      await sleep(220);
      const reasonWrapper = await waitFor(() => dialog.querySelector('[data-testid="cancellation-reason-select"]') || null, { timeout: 6000, interval: 120 });
      if (!reasonWrapper) return false;
      const reasonCombo = reasonWrapper.querySelector('[role="combobox"]') || reasonWrapper.querySelector("#reasonSelectProp") || reasonWrapper.querySelector(".MuiSelect-select") || reasonWrapper;

      if (isAnyListboxOpen()) { await sendEscape(); await sleep(150); }

      try { const r = reasonCombo.getBoundingClientRect(); if (r.width > 0 && r.height > 0) clickByPoint(Math.floor(r.left + r.width / 2), Math.floor(r.top + r.height / 2)); } catch {}
      await sleep(220);

      if (!isAnyListboxOpen()) { try { clickEl(reasonCombo); } catch {} await sleep(220); }
      if (!isAnyListboxOpen()) { const icon = reasonWrapper.querySelector(".MuiSelect-icon, svg"); if (icon) { try { clickEl(icon); } catch {} await sleep(220); } }

      const reasonOption = await waitFor(() => {
          const opts = Array.from(document.querySelectorAll('[role="option"], li, .MuiMenuItem-root')).filter(isVisible);
          return opts.find((el) => norm(el.textContent) === norm(CANCEL_REASON_FULL)) || opts.find((el) => norm(el.textContent).includes(norm(CANCEL_REASON_KEY)));
        }, { timeout: 6000, interval: 120 }
      );
      if (!reasonOption) return false;

      clickEl(reasonOption); await sleep(250);

      const saveBtn = await waitFor(() => dialog.querySelector('[data-testid="bet-edit-save-button"]') || Array.from(dialog.querySelectorAll("button")).find((b) => norm(b.textContent) === "save") || null, { timeout: 6000, interval: 120 });
      if (!saveBtn) return false;
      if (!await waitFor(() => (!saveBtn.disabled && saveBtn.getAttribute("disabled") === null ? true : null), { timeout: 6000, interval: 150 })) return false;

      clickEl(saveBtn);
      
      const errorOutcome = await waitFor(() => {
          if (!dialog.isConnected || dialog.offsetParent === null) return "closed";
          const errEl = dialog.querySelector('[data-testid="formErrorMessage"]');
          const errTxt = errEl ? errEl.textContent.trim() : "";
          const closeA = Array.from(dialog.querySelectorAll("a")).find((a) => (a.textContent || "").trim() === "Close");
          if (errTxt.includes("Betslip update error") || closeA) return "error";
          return null;
        }, { timeout: 1000, interval: 100 }
      );

      if (errorOutcome === "error") {
        const closeLink = Array.from(dialog.querySelectorAll("a")).find((a) => (a.textContent || "").trim() === "Close");
        if (closeLink) {
          try { closeLink.scrollIntoView({ block: "center" }); } catch {} await sleep(50);
          try { closeLink.click(); } catch {} clickEl(closeLink); await sleep(250);
        }
        if (dialog.isConnected && dialog.offsetParent !== null) {
          const xBtn = dialog.querySelector('[data-testid="dialog-popup-title-close-button"]');
          if (xBtn) { clickEl(xBtn); await sleep(200); }
        }
        return true;
      }

      if (errorOutcome === "closed") return true;
      await waitFor(() => (!dialog.isConnected || dialog.offsetParent === null ? true : null), { timeout: 7000, interval: 200 });
      return true;
    };

    // =========================
    // MAIN LOOP
    // =========================
    try {
      const cfg = await getUserConfig();
      if (!cfg) return { ok: false, error: "Cancelled by user." };

      for (;;) {
        const emptyTextEl0 = document.querySelector('[data-testid="empty-data-text"]');
        if (emptyTextEl0 && (emptyTextEl0.textContent || "").trim() === EMPTY_TEXT_EXACT) {
          showResultsModal(__results);
          return { ok: true };
        }

        const rows = getOpenBetRows();
        if (!rows.length) {
          showResultsModal(__results);
          return { ok: true };
        }

        let currentTotal = getTotalBetslipsFromToolbar();
        if (typeof currentTotal !== "number") currentTotal = rows.length;

        const row = rows[0];

        const boostOk = await doCreateBoost(row, cfg);
        console.log("[CreatorBoost] Create Boost:", boostOk ? "OK" : "FAIL");

        const cancelOk = await doCancelBet(row);
        console.log("[CreatorBoost] Cancel bet:", cancelOk ? "OK" : "FAIL");

        console.log(`[CreatorBoost] Esperando dinámicamente que el total (${currentTotal}) disminuya...`);
        await waitForTotalToDropBy1(currentTotal);
      }
    } catch (err) {
      console.error("[creator_boost] Error:", err);
      try { if (!document.getElementById("cb-floating-root")) showResultsModal(__results); } catch {}
      return { ok: false, error: err?.message ? String(err.message) : String(err) };
    }
  });
})();
