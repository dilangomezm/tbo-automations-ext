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

    // Stake defaults
    const DEFAULT_MAX_STAKE_LIMIT = "70";
    const DEFAULT_TOTAL_STAKE_LIMIT = "50000";

    // Event Timing default
    const DEFAULT_EVENT_TIMING_SAME_AS_START = false;

    // Show on Homepage default
    const DEFAULT_SHOW_ON_HOMEPAGE = false;

    // Target Margin goals
    const DESIRED_BOOST_PCT = 15; // 1.15x
    const MIN_ACCEPTABLE_BOOST_PCT = 10; // 1.10x
    const TARGET_MARGIN_MIN = 0.01;

    // Cancel reason
    const CANCEL_REASON_FULL =
      "The actual result was not offered as an outcome. - NO_RESULT_ASSIGNABLE";
    const CANCEL_REASON_KEY = "NO_RESULT_ASSIGNABLE";

    const EXISTS_TEXT = "Prebuild Bet already exists for";
    const EMPTY_TEXT_EXACT = "No bets. Try to change filtering criteria.";

    // Auto-wait config (Dynamic Delay)
    const AUTO_WAIT_TIMEOUT_MS = 60000; // Máximo a esperar antes de abortar por cuelgue del servidor
    const AFTER_DECREASE_EXTRA_WAIT_MS = 1000; // Gracia de 1s para dejar que el DOM se asiente tras desaparecer el betslip

    // =========================
    // Helpers
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

    // =========================
    // DYNAMIC WAIT HELPERS
    // =========================
    const getDisplayedRowsTextEl = () =>
      document.querySelector(".MuiTablePagination-displayedRows") ||
      Array.from(document.querySelectorAll("p")).find((p) =>
        p.className?.includes("MuiTablePagination-displayedRows")
      ) || null;

    const getTotalBetslipsFromToolbar = () => {
      const el = getDisplayedRowsTextEl();
      if (!el) return null;
      const t = (el.textContent || "").trim();
      const m = t.match(/of\s+(\d+)/i);
      if (!m) return null;
      const n = Number(m[1]);
      return Number.isFinite(n) ? n : null;
    };

    const waitForTotalToDropBy1 = async (startTotal) => {
      const start = Date.now();
      while (Date.now() - start < AUTO_WAIT_TIMEOUT_MS) {
        // 1. Validar desde el paginador de la interfaz
        const cur = getTotalBetslipsFromToolbar();
        if (typeof cur === "number" && cur < startTotal) {
          await sleep(AFTER_DECREASE_EXTRA_WAIT_MS);
          return true;
        }

        // 2. Manejo clave para el último betslip (1 -> 0) donde la barra desaparece
        const emptyEl = document.querySelector('[data-testid="empty-data-text"]');
        if (emptyEl && (emptyEl.textContent || "").trim() === EMPTY_TEXT_EXACT) {
          console.log("[CreatorBoost] Lista vacía detectada de forma dinámica.");
          await sleep(500); // Pequeño margen para evitar cierres abruptos
          return true;
        }

        // 3. Respaldo por si el total visual era 1 y simplemente no hay filas abiertas en el DOM
        if (startTotal === 1) {
            const openRows = getOpenBetRows();
            if (openRows.length === 0) {
                await sleep(AFTER_DECREASE_EXTRA_WAIT_MS);
                return true;
            }
        }

        await sleep(250); // Revisión contínua sin congelar la app
      }
      console.warn(`[CreatorBoost] Timeout esperando a que bajara el contador desde ${startTotal}.`);
      return false;
    };

    // =========================
    // SAVE CLICK GUARD (avoid duplicate boosts)
    // =========================
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
      if (!clicked) return true; // already clicked recently; treat as ok

      const outcome = await waitFor(
        () => {
          if (!dialog.isConnected || dialog.offsetParent === null) return "closed";
          const text = dialog.textContent || "";

          if (text.includes(EXISTS_TEXT)) return "exists";

          const errEl = dialog.querySelector('[data-testid="formErrorMessage"]');
          const errTxt = (errEl?.textContent || "").trim();
          const hasUpdateError = errTxt === "Betslip update error.";
          const hasCloseEditText = text.includes("Close and edit betslip again.");

          if (hasUpdateError || hasCloseEditText) return "update_error";

          return null;
        },
        { timeout: 12000, interval: 150 }
      );

      if (outcome === "update_error") {
        console.warn("[CreatorBoost] Betslip update error detected after Save. Closing dialog...");
        const closeLink =
          Array.from(dialog.querySelectorAll("a"))
            .filter((a) => (a.textContent || "").trim() === "Close")
            .find((a) => isVisible(a)) || null;

        const clickCloseRobust = async (a) => {
          try { a.scrollIntoView?.({ block: "center", inline: "center" }); } catch {}
          await sleep(80);

          try { clickEl(a); } catch {}
          await sleep(180);

          if (dialog.isConnected && dialog.offsetParent !== null) {
            try {
              const r = a.getBoundingClientRect();
              const x = Math.floor(r.left + r.width / 2);
              const y = Math.floor(r.top + r.height / 2);
              clickByPoint(x, y);
            } catch {}
            await sleep(220);
          }
        };

        if (closeLink) {
          await clickCloseRobust(closeLink);
          await sleep(250);

          if (dialog.isConnected && dialog.offsetParent !== null) {
            const xBtn = dialog.querySelector('[data-testid="dialog-popup-title-close-button"]');
            if (xBtn) {
              clickEl(xBtn);
              await sleep(250);
            }
          }

          await waitFor(
            () => (!dialog.isConnected || dialog.offsetParent === null ? true : null),
            { timeout: 700, interval: 120 }
          );
          return true;
        } else {
          const xBtn = dialog.querySelector('[data-testid="dialog-popup-title-close-button"]');
          if (xBtn) {
            clickEl(xBtn);
            await sleep(250);
          }
        }

        const closed = await waitFor(
          () => (!dialog.isConnected || dialog.offsetParent === null ? true : null),
          { timeout: 12000, interval: 200 }
        );
        return !!closed ? false : false;
      }

      return outcome === "closed" || outcome === "exists";
    };

    const trunc2 = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return NaN;
      return Math.trunc(x * 100) / 100;
    };

    // =========================
    // Results collector + Results modal
    // =========================
    const __results = {
      successCount: 0,
      skipped: [], 
    };

    const buildBetslipUrl = (uuid) =>
      `https://leo-prod-trading-bo.k8s.goldrush.llc/bets/search/list?betslipUuid=${encodeURIComponent(
        uuid || ""
      )}`;

    const showResultsModal = (results) => {
      try {
        document.getElementById("creatorboost-results-overlay")?.remove();
        document.getElementById("creatorboost-results-style")?.remove();
      } catch {}

      const style = document.createElement("style");
      style.id = "creatorboost-results-style";
      style.textContent = `
        #creatorboost-results-overlay{position:fixed; inset:0; z-index:2147483647;
          background:rgba(11,13,16,0.72); display:flex; align-items:center; justify-content:center; padding:18px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;}
        .cbr-panel{width:820px; max-width:96vw; background:#13161D; color:#E6E8EE;
          border:1px solid rgba(255,255,255,0.10); border-radius:14px; box-shadow:0 10px 30px rgba(0,0,0,0.45);
          padding:14px;}
        .cbr-head{display:flex; align-items:center; justify-content:space-between; gap:10px;
          margin-bottom:10px;}
        .cbr-title{font-size:13px; font-weight:650;}
        .cbr-btn{border-radius:12px; padding:10px 12px;
          font-size:12px; font-weight:600;
          border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03); color:#E6E8EE; cursor:pointer;}
        .cbr-msg{font-size:12px; color:rgba(230,232,238,0.75);
          margin:8px 0;}
        .cbr-strong{color:#E6E8EE; font-weight:650;}
        .cbr-table{width:100%; border-collapse:separate;
          border-spacing:0; overflow:hidden;
          border:1px solid rgba(255,255,255,0.10); border-radius:12px; margin-top:10px;}
        .cbr-table th,.cbr-table td{padding:10px; font-size:12px;
          border-bottom:1px solid rgba(255,255,255,0.08);}
        .cbr-table th{color:rgba(230,232,238,0.8); text-align:left;
          background:rgba(255,255,255,0.02);}
        .cbr-table tr:last-child td{border-bottom:none;}
        .cbr-linkbtn{display:inline-flex; align-items:center;
          justify-content:center; padding:8px 10px;
          border-radius:10px; border:1px solid rgba(255,255,255,0.10); background:rgba(255,255,255,0.03);
          color:#E6E8EE; text-decoration:none; font-weight:600; font-size:12px;}
        .cbr-linkbtn:hover{border-color:rgba(255,255,255,0.14);
          background:rgba(255,255,255,0.05);}
      `;
      document.head.appendChild(style);

      const overlay = document.createElement("div");
      overlay.id = "creatorboost-results-overlay";

      const panel = document.createElement("div");
      panel.className = "cbr-panel";

      const success = results.successCount || 0;
      const skipped = Array.isArray(results.skipped) ? results.skipped : [];
      const z = skipped.length;

      panel.innerHTML = `
        <div class="cbr-head">
          <div class="cbr-title">CreatorBoost - Results</div>
          <button class="cbr-btn" id="cbr-close" type="button">Close</button>
        </div>

        <div class="cbr-msg"><span class="cbr-strong">Success:</span> ${success} boosts created successfully.</div>
        <div class="cbr-msg"><span class="cbr-strong">Needs replacement:</span> ${z} boosts did not reach the required margin.
          Please replace them with a new boost.</div>

        ${z ? `<div class="cbr-msg cbr-strong">The boosts not created are:</div>` : ""}

        ${
          z
            ? `<table class="cbr-table">
                <thead>
                  <tr>
                    <th style="width:70%;">Event</th>
                    <th style="width:15%;">Margin</th>
                    <th style="width:15%;">Betslip</th>
                  </tr>
                </thead>
                <tbody>
                  ${skipped
                    .map((r) => {
                      const ev = (r.eventName || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;");
                      const mg = typeof r.marginPct === "number" ? r.marginPct : Number(r.marginPct);
                      const mgTxt = Number.isFinite(mg) ? `${mg.toFixed(2)}%` : "-";
                      const url = buildBetslipUrl(r.betslipUuid || "");
                      return `
                        <tr>
                          <td>${ev}</td>
                          <td>${mgTxt}</td>
                          <td><a class="cbr-linkbtn" target="_blank" rel="noopener noreferrer" href="${url}">View Betslip</a></td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>`
            : ""
        }
      `;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      overlay.querySelector("#cbr-close").onclick = () => overlay.remove();
    };

    // =========================
    // UI Prompt (overlay)
    // =========================
    const getUserConfig = async () => {
      document.getElementById("creatorboost-config-overlay")?.remove();
      document.getElementById("creatorboost-style-tag")?.remove();

      const styleTag = document.createElement("style");
      styleTag.id = "creatorboost-style-tag";
      styleTag.textContent = `
        #creatorboost-config-overlay { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        #creatorboost-config-overlay * { box-sizing: border-box; }

        .cboverlay {
          position: fixed; inset: 0; z-index: 999999; background: rgba(11,13,16,0.72);
          display: flex; align-items: center; justify-content: center; padding: 18px;
        }

        .cbpanel {
          width: 620px; max-width: 94vw; background: #13161D; color: #E6E8EE;
          border: 1px solid rgba(255,255,255,0.10); border-radius: 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.45); padding: 14px;
        }

        .cbhead { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom: 10px; }
        .cbtitle { font-size: 13px; font-weight: 650; letter-spacing: 0.2px; }

        .cbcard { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; padding: 10px; margin-bottom: 10px; }
        .cbsectiontitle { font-size: 12px; font-weight: 650; margin-bottom: 8px; }
        .cbsectiontitleRow{ display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px; }
        .cbboosticon{ width:18px; height:18px; display:block; }

        .cbgrid2 { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .cblabel { font-size: 11px; color: rgba(230,232,238,0.65); margin-bottom: 6px; }

        .cbinput, .cbselect { width: 100%; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.10); color: #E6E8EE; border-radius: 8px; padding: 10px; outline: none; font-size: 12px; }
        .cbselect option { background: #13161D; color: #E6E8EE; }
        .cbinput:focus, .cbselect:focus { border-color: rgba(240,166,74,0.55); box-shadow: 0 0 0 3px rgba(240,166,74,0.12); }

        .cbrowgrid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .cbrow { display:flex; align-items:center; gap: 10px; padding: 8px 10px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); cursor: pointer; user-select: none; transition: border-color 120ms ease, background 120ms ease; }
        .cbrow:hover { border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.03); }
        .cbchk { width: 14px; height: 14px; accent-color: #F0A64A; }

        .cbswitchrow { display:flex; align-items:center; justify-content:space-between; gap:10px; border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; padding: 10px; background: rgba(255,255,255,0.02); }
        .cbswitch { appearance: none; width: 38px; height: 22px; border-radius: 999px; background: rgba(255,255,255,0.18); position: relative; cursor: pointer; transition: background 120ms ease; border: 1px solid rgba(255,255,255,0.10); }
        .cbswitch::after { content: ""; position: absolute; top: 1px; left: 1px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 120ms ease; }
        .cbswitch:checked { background: rgba(240,166,74,0.85); }
        .cbswitch:checked::after { transform: translateX(16px); }

        .cbbtnrow { display:flex; gap:10px; margin-top: 10px; }
        .cbbtn { border-radius: 12px; padding: 10px 12px; font-size: 12px; font-weight: 600; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.03); color: #E6E8EE; cursor: pointer; transition: transform 80ms ease, border-color 120ms ease, background 120ms ease; user-select: none; }
        .cbbtn:hover { border-color: rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); }
        .cbbtn:active { transform: translateY(1px); }
        .cbbtnprimary { flex: 1; color: #111; background: linear-gradient(180deg, rgba(240,166,74,0.95) 0%, rgba(200,133,51,0.95) 100%); }
        .cbbtnsecondary { width: 110px; }
        .cberr { color: #ff8181; font-size: 11px; min-height: 14px; margin-top: 2px; }

        .cbaccbtn { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 0; background: transparent; padding: 0; cursor: pointer; color: #E6E8EE; }
        .cbaccicon { width: 18px; height: 18px; opacity: 0.9; transition: transform 120ms ease; color: #E6E8EE; }
        .cbaccbtn[aria-expanded="true"] .cbaccicon { transform: rotate(180deg); }
        .cbaccdetails { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.10); display: none; }
        .cbaccbtn[aria-expanded="true"] + .cbaccdetails { display: block; }

        .cbtimingrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
        .cbtiminglabel { font-size: 11px; color: rgba(230,232,238,0.65); }
        .cbtiminginputs { display: flex; gap: 8px; align-items: center; }
        .cbhhmm { width: 78px; display: flex; align-items: center; gap: 6px; }
        .cbhhmm .cbinput { padding: 8px 10px; }
        .cbhhmmspan { font-size: 11px; color: rgba(230,232,238,0.65); }
      `;
      document.head.appendChild(styleTag);

      const overlay = document.createElement("div");
      overlay.id = "creatorboost-config-overlay";
      overlay.className = "cboverlay";
      const panel = document.createElement("div");
      panel.className = "cbpanel";

      panel.innerHTML = `
        <div class="cbhead">
          <div class="cbtitle">CreatorBoost - Configuration</div>
          <button id="creatorboost-close" class="cbbtn cbbtnsecondary" type="button">Cancel</button>
        </div>

        <div class="cbcard">
          <div class="cbsectiontitle">Brands</div>
          <div id="creatorboost-brands" class="cbrowgrid">
            ${DEFAULT_BRANDS
              .map(
                (b) => `
              <label class="cbrow">
                <input class="cbchk" type="checkbox" data-brand="${b}" />
                <span style="font-size:12px; font-weight:600; color:#E6E8EE;">${b}</span>
              </label>
            `
              )
              .join("")}
          </div>
        </div>

        <div class="cbgrid2">
          <div class="cbcard" style="margin-bottom:0;">
            <div class="cblabel">Min odds</div>
            <input id="creatorboost-min" class="cbinput" value="${DEFAULT_MIN_ODDS}" />
          </div>
          <div class="cbcard" style="margin-bottom:0;">
            <div class="cblabel">Max odds</div>
            <input id="creatorboost-max" class="cbinput" value="${DEFAULT_MAX_ODDS}" />
          </div>
        </div>

        <div class="cbcard">
          <div class="cbsectiontitleRow">
            <div style="display:flex; align-items:center; gap:8px;">
              <img alt="lighting icon" data-testid="lighting-icon" src="/39c1bcabd331ff1837b6.svg" class="cbboosticon" />
              <div class="cbsectiontitle" style="margin:0;">Boost</div>
            </div>
          </div>

          <div style="margin-bottom:10px;">
            <select id="creatorboost-boost-type" class="cbselect">
              <option value="None" selected>None</option>
              <option value="Odds">Odds</option>
              <option value="Target Margin">Target Margin</option>
              <option value="Boost Factor">Boost Factor</option>
            </select>
          </div>

          <div id="creatorboost-boost-fields" style="display:none;">
            <div id="creatorboost-boost-main-row" style="margin-bottom:10px; display:none;">
              <div class="cblabel" id="creatorboost-boost-main-label"></div>
              <input id="creatorboost-boost-main-input" class="cbinput" value="" />
            </div>

            <div class="cbgrid2" style="margin-bottom:0;">
              <div>
                <div class="cblabel">Max stake limit</div>
                <input id="creatorboost-max-stake" class="cbinput" value="${DEFAULT_MAX_STAKE_LIMIT}" />
              </div>
              <div>
                <div class="cblabel">Total stake limit</div>
                <input id="creatorboost-total-stake" class="cbinput" value="${DEFAULT_TOTAL_STAKE_LIMIT}" />
              </div>
            </div>
          </div>
        </div>

        <div class="cbcard" id="creatorboost-eventtiming-card">
          <button id="creatorboost-eventtiming-acc" class="cbaccbtn" type="button" aria-expanded="false">
            <div class="cbsectiontitle" style="margin:0;">Event Timing</div>
            <svg class="cbaccicon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M7 10l5 5 5-5z"></path>
            </svg>
          </button>

          <div class="cbaccdetails">
            <div class="cbtimingrow">
              <div class="cbtiminglabel">Countdown to start</div>
              <div class="cbtiminginputs">
                <div class="cbhhmm">
                  <input id="creatorboost-hoursBeforeStart" class="cbinput" inputmode="numeric" placeholder="hh" />
                  <span class="cbhhmmspan">hh</span>
                </div>
                <div class="cbhhmm">
                  <input id="creatorboost-minutesBeforeStart" class="cbinput" inputmode="numeric" placeholder="mm" />
                  <span class="cbhhmmspan">mm</span>
                </div>
              </div>
            </div>

            <div class="cbswitchrow" style="margin-bottom:10px;">
              <div style="font-size:12px;">Same as event start</div>
              <input id="creatorboost-eventtiming-same" type="checkbox" class="cbswitch" ${
                DEFAULT_EVENT_TIMING_SAME_AS_START ? "checked" : ""
              } />
            </div>

            <div class="cbtimingrow" style="margin-bottom:0;">
              <div class="cbtiminglabel">Custom</div>
              <input id="creatorboost-customDate" class="cbinput" placeholder="YYYY-MM-DD hh:mm" />
            </div>
          </div>
        </div>

        <div class="cbcard">
          <div class="cbsectiontitle">Show on Homepage</div>
          <div class="cbswitchrow">
            <div style="font-size:12px;"></div>
            <input id="creatorboost-homepage" type="checkbox" class="cbswitch" ${
              DEFAULT_SHOW_ON_HOMEPAGE ? "checked" : ""
            } />
          </div>
        </div>

        <div id="creatorboost-error" class="cberr"></div>

        <div class="cbbtnrow">
          <button id="creatorboost-run" class="cbbtn cbbtnprimary" type="button">Run CreatorBoost</button>
        </div>
      `;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      // Accordion behavior
      {
        const accBtn = overlay.querySelector("#creatorboost-eventtiming-acc");
        if (accBtn) {
          accBtn.addEventListener("click", () => {
            const cur = accBtn.getAttribute("aria-expanded") === "true";
            accBtn.setAttribute("aria-expanded", cur ? "false" : "true");
          });
        }
      }

      // Boost dynamic fields
      {
        const boostType = overlay.querySelector("#creatorboost-boost-type");
        const fields = overlay.querySelector("#creatorboost-boost-fields");
        const mainRow = overlay.querySelector("#creatorboost-boost-main-row");
        const mainLabel = overlay.querySelector("#creatorboost-boost-main-label");
        const mainInput = overlay.querySelector("#creatorboost-boost-main-input");
        const applyBoostUI = () => {
          const v = (boostType?.value || "None").trim();
          if (v === "None") {
            if (fields) fields.style.display = "none";
            if (mainRow) mainRow.style.display = "none";
            if (mainLabel) mainLabel.textContent = "";
            if (mainInput) mainInput.value = "";
            return;
          }

          if (fields) fields.style.display = "block";
          if (v === "Target Margin") {
            if (mainRow) mainRow.style.display = "none";
            if (mainLabel) mainLabel.textContent = "";
            if (mainInput) mainInput.value = "";
            return;
          }

          if (mainRow && mainLabel) {
            mainRow.style.display = "block";
            if (v === "Odds") mainLabel.textContent = "Boosted Odds";
            else if (v === "Boost Factor") mainLabel.textContent = "Multiplier";
            else mainLabel.textContent = "";
          }
        };
        if (boostType) {
          boostType.addEventListener("change", applyBoostUI);
          applyBoostUI();
        }
      }

      {
        const same = overlay.querySelector("#creatorboost-eventtiming-same");
        const custom = overlay.querySelector("#creatorboost-customDate");
        const apply = () => {
          const on = !!same?.checked;
          if (custom) custom.disabled = on;
          if (custom) custom.style.opacity = on ? "0.55" : "1";
        };
        if (same) {
          same.addEventListener("change", apply);
          apply();
        }
      }

      const close = () => overlay.remove();
      return await new Promise((resolve) => {
        overlay.querySelector("#creatorboost-close").onclick = () => {
          close();
          resolve(null);
        };

        overlay.querySelector("#creatorboost-run").onclick = () => {
          const checkedBrands = Array.from(
            overlay.querySelectorAll('input[type="checkbox"][data-brand]')
          )
            .filter((cb) => cb.checked)
            .map((cb) => cb.getAttribute("data-brand"));

          const min = overlay.querySelector("#creatorboost-min").value?.trim();
          const max = overlay.querySelector("#creatorboost-max").value?.trim();

          const boostType = overlay.querySelector("#creatorboost-boost-type")?.value?.trim() || "None";
          const maxStake = overlay.querySelector("#creatorboost-max-stake")?.value?.trim() || "";
          const totalStake = overlay.querySelector("#creatorboost-total-stake")?.value?.trim() || "";
          const boostMainValue = overlay.querySelector("#creatorboost-boost-main-input")?.value?.trim() || "";

          const eventTimingSameAsStart = !!overlay.querySelector("#creatorboost-eventtiming-same")?.checked;
          const showOnHomepage = !!overlay.querySelector("#creatorboost-homepage")?.checked;

          const err = overlay.querySelector("#creatorboost-error");

          if (!checkedBrands.length) { err.textContent = "You must select at least 1 brand."; return; }
          if (!min || isNaN(Number(min))) { err.textContent = "Min odds must be a valid number."; return; }
          if (!max || isNaN(Number(max))) { err.textContent = "Max odds must be a valid number."; return; }
          if (Number(max) < Number(min)) { err.textContent = "Max odds must be greater than or equal to Min odds."; return; }

          const allowed = ["None", "Odds", "Target Margin", "Boost Factor"];
          if (!allowed.includes(boostType)) { err.textContent = "Invalid Boost type."; return; }

          if (boostType !== "None") {
            if (!maxStake || isNaN(Number(maxStake))) { err.textContent = "Max stake limit must be a valid number."; return; }
            if (!totalStake || isNaN(Number(totalStake))) { err.textContent = "Total stake limit must be a valid number."; return; }
          }
          if (boostType === "Odds" && (!boostMainValue || isNaN(Number(boostMainValue)))) {
              err.textContent = "Boosted Odds must be a valid number."; return;
          }
          if (boostType === "Boost Factor" && (!boostMainValue || isNaN(Number(boostMainValue)))) {
              err.textContent = "Multiplier must be a valid number."; return;
          }

          close();
          resolve({
            brands: checkedBrands,
            minOdds: String(min),
            maxOdds: String(max),
            boostType,
            boostMainValue: String(boostMainValue),
            maxStakeLimit: String(maxStake),
            totalStakeLimit: String(totalStake),
            eventTimingSameAsStart,
            showOnHomepage,
          });
        };
      });
    };

    // =========================
    // Detect betslips OPEN
    // =========================
    const isRowOpen = (row) => {
      const statusSpan = row.querySelector("td:nth-child(2) span");
      if (statusSpan && norm(statusSpan.textContent) === "open") return true;
      return Array.from(row.querySelectorAll("span")).some((s) => norm(s.textContent) === "open");
    };
    const getOpenBetRows = () => {
      const rows = Array.from(document.querySelectorAll('tr[data-testid="bet-row"]'));
      return rows.filter(isRowOpen);
    };

    // =========================
    // Row / Menu helpers
    // =========================
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
      const item =
        Array.from(document.querySelectorAll('li[role="menuitem"]')).find(
          (li) => norm(li.textContent) === "edit"
        ) || null;
      if (!item) return false;
      clickEl(item);
      return true;
    };

    const clickMenuItemDetails = async () => {
      const item =
        Array.from(document.querySelectorAll('li[role="menuitem"]')).find(
          (li) => norm(li.textContent) === "details"
        ) || null;
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

    const getVisibleListboxes = () =>
      Array.from(document.querySelectorAll('ul[role="listbox"]')).filter(isVisible);

    // =========================
    // Brands selection
    // =========================
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
      const minInput =
        dialog.querySelector("#input-minimumOdds") ||
        dialog.querySelector('input[id*="minimumOdds"]');
      if (!minInput) return false;

      await clickInputHuman(minInput);

      if (isAnyListboxOpen()) {
        await sendEscape();
        await clickInputHuman(minInput);
      }
      return true;
    };

    // =========================
    // Boost dropdown
    // =========================
    const selectBoostOption = async (dialog, optionNeedle) => {
      const boostWrapper = dialog.querySelector('[data-testid="prebuild-bet-create-popup-boost-select"]');
      if (!boostWrapper) {
        console.warn("[CreatorBoost] Boost wrapper not found.");
        return false;
      }

      const combo =
        boostWrapper.querySelector('[role="combobox"]') ||
        boostWrapper.querySelector(".MuiSelect-select") ||
        boostWrapper.querySelector('[aria-haspopup="listbox"]');

      if (!combo) return false;

      const raw = (optionNeedle || "None").trim();
      const map = {
        None: "None", Odds: "Odds",
        "Target Margin": "Target margin", "Target margin": "Target margin",
        "Boost Factor": "Boost factor", "Boost factor": "Boost factor",
      };
      const desiredLabel = map[raw] || raw;
      const needle = norm(desiredLabel);

      if (norm(combo.textContent).includes(needle)) return true;

      for (let i = 0; i < 3; i++) {
        if (!isAnyListboxOpen()) break;
        await sendEscape();
        await sleep(180);
      }

      const tryOpen = async () => {
        try {
          const r = combo.getBoundingClientRect();
          clickByPoint(Math.floor(r.left + r.width / 2), Math.floor(r.top + r.height / 2));
        } catch {}
        await sleep(200);

        if (!isAnyListboxOpen()) { try { clickEl(combo); } catch {} await sleep(200); }
        if (!isAnyListboxOpen()) { try { clickEl(boostWrapper); } catch {} await sleep(200); }
        if (!isAnyListboxOpen()) {
          const icon = boostWrapper.querySelector(".MuiSelect-icon, svg");
          if (icon) { try { clickEl(icon); } catch {} await sleep(200); }
        }
      };

      for (let attempt = 1; attempt <= 4; attempt++) {
        await tryOpen();
        const lb = await waitFor(
          () => {
            const lbs = getVisibleListboxes();
            for (const x of lbs) {
              const opts = Array.from(x.querySelectorAll('li[role="option"], li')).filter(isVisible);
              if (opts.some((o) => norm(o.textContent).includes(needle))) return x;
            }
            return null;
          },
          { timeout: 2500, interval: 120 }
        );

        if (!lb) { await sendEscape(); await sleep(160); continue; }

        const opts = Array.from(lb.querySelectorAll('li[role="option"], li')).filter(isVisible);
        const targetOpt =
          opts.find((o) => norm(o.textContent) === needle) ||
          opts.find((o) => norm(o.textContent).includes(needle)) ||
          null;

        if (!targetOpt) { await sendEscape(); await sleep(160); continue; }

        clickEl(targetOpt);
        await sleep(250);

        const changed = await waitFor(
          () => (norm(combo.textContent).includes(needle) ? true : null),
          { timeout: 2500, interval: 120 }
        );

        if (changed) return true;

        await sendEscape();
        await sleep(160);
      }
      return false;
    };

    // =========================
    // Show on Homepage & Event Timing
    // =========================
    const applyShowOnHomepage = async (dialog, desired) => {
      const homepageInput =
        dialog.querySelector('[data-testid="prebuild-bet-create-popup-homepage-toggle"] input[type="checkbox"]') ||
        dialog.querySelector('[data-testid="prebuild-bet-create-popup-homepage"] input[type="checkbox"]') ||
        null;
      const homepageToggleBase = dialog.querySelector('[data-testid="prebuild-bet-create-popup-homepage-toggle"]') || null;
      if (!homepageInput) return true;

      const current = !!homepageInput.checked;
      if (current === !!desired) return true;

      try { homepageInput.focus?.(); homepageInput.click(); } catch {}
      await sleep(180);

      if (!!homepageInput.checked !== !!desired && homepageToggleBase) {
        clickEl(homepageToggleBase);
        await sleep(180);
      }
      return true;
    };

    const applyEventTimingSameAsStart = async (dialog, desired) => {
      const btn =
        Array.from(dialog.querySelectorAll('button.MuiAccordionSummary-root, button[aria-expanded]')).find(
          (b) => (b.textContent || "").toLowerCase().includes("event timing")
        ) || null;
      if (!btn) return true;

      const isExpanded = () => btn.getAttribute("aria-expanded") === "true";
      if (!isExpanded()) { try { clickEl(btn); } catch {} await sleep(200); }
      if (!isExpanded()) return true;

      const sameInput = dialog.querySelector('input[type="checkbox"][name="sameAsEventStart"]');
      if (!sameInput) return true;

      const cur = !!sameInput.checked;
      if (cur === !!desired) return true;

      try { sameInput.focus?.(); sameInput.click(); } catch {}
      await sleep(180);
      return true;
    };

    // =========================
    // Details modal -> JSON payloads
    // =========================
    const openBetslipDetailsDialog = async (row) => {
      if (!(await openRowMenu(row))) return null;
      if (!(await clickMenuItemDetails())) return null;
      const dialog = await waitFor(
        () => {
          const d = getActiveDialog();
          if (!d) return null;
          if (norm(d.textContent).includes("betslip details")) return d;
          return null;
        },
        { timeout: 8000, interval: 150 }
      );
      return dialog || null;
    };

    const clickTechnicalDetailsTab = async (detailsDialog) => {
      const tab = await waitFor(
        () => Array.from(detailsDialog.querySelectorAll('[role="tab"], button')).find((el) => norm(el.textContent).includes("technical details")) || null,
        { timeout: 6000, interval: 120 }
      );
      if (!tab) return false; clickEl(tab); await sleep(350); return true;
    };

    const clickTheoreticalMarginDetailsTab = async (detailsDialog) => {
      const tab = await waitFor(
        () => Array.from(detailsDialog.querySelectorAll('[role="tab"], button')).find((el) => norm(el.textContent).includes("theoretical margin details")) || null,
        { timeout: 6000, interval: 120 }
      );
      if (!tab) return false; clickEl(tab); await sleep(350); return true;
    };

    const readDataDetailsTextBox = async (detailsDialog) => {
      let box = await waitFor(
        () => detailsDialog.querySelector('[data-testid="data-details-field-text-content-box"]') || null,
        { timeout: 6000, interval: 150 }
      );
      if (!box) {
        box = Array.from(detailsDialog.querySelectorAll("div, pre")).find((el) => {
            if (!isVisible(el)) return false;
            const t = (el.textContent || "").trim();
            return (t.startsWith("{") && t.includes('"messages"')) || (t.startsWith("[") && t.includes('"tmcCalculationConditions"'));
          }) || null;
      }
      return box ? (box.textContent || "").trim() : null;
    };

    const safeJsonParse = (txt) => {
      try { return JSON.parse(txt); } catch {
        try { return JSON.parse(txt.replace(/\u00A0/g, " ").replace(/\u200B/g, "").trim()); } catch { return null; }
      }
    };

    const extractEventNameFromTechnicalPayload = (payload) => {
      if (!payload || typeof payload !== "object") return null;
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const firstMsg = messages[0] || null;
      const name = firstMsg?.betslip?.events?.[0]?.name;
      return typeof name === "string" && name.trim() ? name.trim() : null;
    };

    const extractBetslipUuidFromTechnicalPayload = (payload) => {
      if (!payload || typeof payload !== "object") return null;
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const uuid = messages[0]?.betslip?.uuid;
      return typeof uuid === "string" && uuid.trim() ? uuid.trim() : null;
    };

    const extractProbabilityAndOddsFromTheoreticalPayload = (payload) => {
      const root = Array.isArray(payload) ? payload[0] : payload;
      if (!root || typeof root !== "object") return null;

      const tmc = root.tmcCalculationConditions || {};
      const comboItems = root.combinationInfo?.items || [];
      
      const syncOdds = Number(tmc.productCombinationSyncOdds) || Number(comboItems[0]?.syncOdds) || null;
      
      // Obtenemos la probabilidad multiplicando todos los elementos del array
      let probability = null;
      if (comboItems.length > 0) {
        probability = comboItems.reduce((acc, item) => {
          const p = Number(item.probability);
          return acc * (Number.isFinite(p) ? p : 1);
        }, 1);
      }

      // Fallback por si la info viene en tmc.outcomeData en lugar de combinationInfo
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

    const readDetailsPack = async (row) => {
      const detailsDialog = await openBetslipDetailsDialog(row);
      if (!detailsDialog) return null;

      try {
        let eventName = null;
        let betslipUuid = null;

        if (await clickTechnicalDetailsTab(detailsDialog)) {
          const techTxt = await readDataDetailsTextBox(detailsDialog);
          const techPayload = techTxt ? safeJsonParse(techTxt) : null;
          eventName = extractEventNameFromTechnicalPayload(techPayload);
          betslipUuid = extractBetslipUuidFromTechnicalPayload(techPayload);
        }

        if (!(await clickTheoreticalMarginDetailsTab(detailsDialog))) {
            return { eventName, betslipUuid, syncOdds: null, probability: null };
        }

        const theoTxt = await readDataDetailsTextBox(detailsDialog);
        const theoPayload = theoTxt ? safeJsonParse(theoTxt) : null;
        const extracted = theoPayload ? extractProbabilityAndOddsFromTheoreticalPayload(theoPayload) : null;

        return {
          eventName, betslipUuid,
          syncOdds: extracted?.syncOdds ?? null,
          probability: extracted?.probability ?? null,
        };
      } finally {
        await closeDialogWithX(detailsDialog);
        await sleep(220);
      }
    };

    const getExistsErrorLines = (dialog) => {
      if (!dialog) return [];
      const nodes = Array.from(dialog.querySelectorAll("div, p, span, li"))
        .filter(isVisible).map((el) => el.textContent?.trim()).filter(Boolean);
      const hits = nodes.filter((t) => t.includes(EXISTS_TEXT));
      if (!hits.length && dialog.textContent?.includes(EXISTS_TEXT)) {
        return dialog.textContent.split("\n").map((s) => s.trim()).filter(Boolean).filter((t) => t.includes(EXISTS_TEXT));
      }
      return hits;
    };

    const clickClosePrebuiltDialog = async (dialog) => {
      const closeBtn =
        dialog.querySelector('[data-testid="prebuild-bet-create-cancel-button"]') ||
        Array.from(dialog.querySelectorAll('[role="button"], button, span[role="button"]')).find((el) => norm(el.textContent) === "close");
      if (!closeBtn) return false;
      clickEl(closeBtn);
      const closed = await waitFor(() => !dialog.isConnected || dialog.offsetParent === null, { timeout: 15000, interval: 250 });
      return !!closed;
    };

    // =========================
    // Create Boost Flow
    // =========================
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
        
        tmUsedForBoost = tmRaw15 < TARGET_MARGIN_MIN ? TARGET_MARGIN_MIN : trunc2(tmRaw15);

        const oddFinalByTM = trunc2((1 - tmUsedForBoost / 100) / probabilityForTM);

        if (tmUsedForBoost === TARGET_MARGIN_MIN && oddFinalByTM < minAccept10) {
          __results.skipped.push({
            eventName: eventNameFromTech,
            betslipUuid: betslipUuidFromTech,
            marginPct: ((oddFinalByTM / baseSyncOddForTM) - 1) * 100,
          });
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

      await clickInputHuman(inputMin);
      setReactInputValue(inputMin, cfg.minOdds);
      await sleep(180);

      await clickInputHuman(inputMax);
      setReactInputValue(inputMax, cfg.maxOdds);
      await sleep(220);

      const boostType = (cfg.boostType || "None").trim();
      const boostSelected = await selectBoostOption(dialog, boostType);
      if (!boostSelected) return false;
      await sleep(250);

      const findInputByLabelText = (root, labelText) => {
        const lbl = Array.from(root.querySelectorAll("label")).find((l) => norm(l.textContent).includes(norm(labelText)));
        if (!lbl) return null;
        const container = lbl.closest('[data-testid], .MuiBox-root, .MuiGrid-root, .MuiFormControl-root, div') || lbl.parentElement;
        return container ? container.querySelector("input") || container.parentElement?.querySelector("input") || null : null;
      };

      if (boostType !== "None") {
        const maxStakeInput = dialog.querySelector("#maximumWager") || findInputByLabelText(dialog, "Max stake limit");
        const totalStakeInput = dialog.querySelector("#globalWagerLimit") || findInputByLabelText(dialog, "Total stake limit");
        if (!maxStakeInput || !totalStakeInput) return false;

        await clickInputHuman(maxStakeInput); setReactInputValue(maxStakeInput, cfg.maxStakeLimit); await sleep(160);
        await clickInputHuman(totalStakeInput); setReactInputValue(totalStakeInput, cfg.totalStakeLimit); await sleep(160);
      }

      if (boostType === "Target Margin") {
        const targetMarginInput = dialog.querySelector("#targetMargin") || findInputByLabelText(dialog, "Target margin");
        if (!targetMarginInput) return false;
        await clickInputHuman(targetMarginInput); setReactInputValue(targetMarginInput, String(tmUsedForBoost)); await sleep(180);
      } else if (boostType === "Odds") {
        const boostedOddsInput = findInputByLabelText(dialog, "Boosted Odds") || findInputByLabelText(dialog, "Boosted odds");
        if (!boostedOddsInput) return false;
        await clickInputHuman(boostedOddsInput); setReactInputValue(boostedOddsInput, String(cfg.boostMainValue || "")); await sleep(180);
      } else if (boostType === "Boost Factor") {
        const multiplierInput = findInputByLabelText(dialog, "Multiplier");
        if (!multiplierInput) return false;
        await clickInputHuman(multiplierInput); setReactInputValue(multiplierInput, String(cfg.boostMainValue || "")); await sleep(180);
      }

      try { await applyEventTimingSameAsStart(dialog, !!cfg.eventTimingSameAsStart); } catch {}
      try { await applyShowOnHomepage(dialog, !!cfg.showOnHomepage); } catch {}

      await clickInputHuman(inputMin);
      await sleep(150);

      const saveBtn = await waitFor(() => dialog.querySelector('[data-testid="prebuild-bet-create-save-button"]'), { timeout: 8000, interval: 150 });
      if (!saveBtn) return false;

      const enabled = await waitFor(() => (!saveBtn.disabled && saveBtn.getAttribute("disabled") === null ? true : null), { timeout: 12000, interval: 200 });
      if (!enabled) return false;

      try { saveBtn.style.pointerEvents = "none"; } catch {}

      const saveClickedOk = await clickSaveOnce(dialog, saveBtn);
      if (!saveClickedOk) return false;

      await sleep(220);

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

      __results.successCount += 1;
      return true;
    };

    // =========================
    // Cancel Bet Flow
    // =========================
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
            try {
              const r = cancelSwitchBase.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) clickByPoint(Math.floor(r.left + r.width / 2), Math.floor(r.top + r.height / 2));
            } catch {}
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

      try {
        const r = reasonCombo.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) clickByPoint(Math.floor(r.left + r.width / 2), Math.floor(r.top + r.height / 2));
      } catch {}
      await sleep(220);

      if (!isAnyListboxOpen()) { try { clickEl(reasonCombo); } catch {} await sleep(220); }
      if (!isAnyListboxOpen()) {
        const icon = reasonWrapper.querySelector(".MuiSelect-icon, svg");
        if (icon) { try { clickEl(icon); } catch {} await sleep(220); }
      }

      const reasonOption = await waitFor(
        () => {
          const opts = Array.from(document.querySelectorAll('[role="option"], li, .MuiMenuItem-root')).filter(isVisible);
          return opts.find((el) => norm(el.textContent) === norm(CANCEL_REASON_FULL)) || opts.find((el) => norm(el.textContent).includes(norm(CANCEL_REASON_KEY)));
        },
        { timeout: 6000, interval: 120 }
      );

      if (!reasonOption) return false;

      clickEl(reasonOption);
      await sleep(250);

      const saveBtn = await waitFor(
        () => dialog.querySelector('[data-testid="bet-edit-save-button"]') || Array.from(dialog.querySelectorAll("button")).find((b) => norm(b.textContent) === "save") || null,
        { timeout: 6000, interval: 120 }
      );
      if (!saveBtn) return false;

      const enabled = await waitFor(() => (!saveBtn.disabled && saveBtn.getAttribute("disabled") === null ? true : null), { timeout: 6000, interval: 150 });
      if (!enabled) return false;

      clickEl(saveBtn);
      
      const errorOutcome = await waitFor(
        () => {
          if (!dialog.isConnected || dialog.offsetParent === null) return "closed";
          const errEl = dialog.querySelector('[data-testid="formErrorMessage"]');
          const errTxt = errEl ? errEl.textContent.trim() : "";
          const closeA = Array.from(dialog.querySelectorAll("a")).find((a) => (a.textContent || "").trim() === "Close");
          if (errTxt.includes("Betslip update error") || closeA) return "error";
          return null;
        },
        { timeout: 1000, interval: 100 }
      );

      if (errorOutcome === "error") {
        const closeLink = Array.from(dialog.querySelectorAll("a")).find((a) => (a.textContent || "").trim() === "Close");
        if (closeLink) {
          try { closeLink.scrollIntoView({ block: "center" }); } catch {}
          await sleep(50);
          try { closeLink.click(); } catch {}
          clickEl(closeLink);
          await sleep(250);
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
    // RUN (MAIN LOOP)
    // =========================
    try {
      const cfg = await getUserConfig();
      if (!cfg) return { ok: false, error: "Cancelled by user." };

      for (;;) {
        // Validación inmediata si la tabla dice explícitamente "No bets."
        const emptyTextEl0 = document.querySelector('[data-testid="empty-data-text"]');
        const emptyText0 = (emptyTextEl0?.textContent || "").trim();
        if (emptyTextEl0 && emptyText0 === EMPTY_TEXT_EXACT) {
          showResultsModal(__results);
          return { ok: true };
        }

        const rows = getOpenBetRows();
        if (!rows.length) {
          showResultsModal(__results);
          return { ok: true };
        }

        // Antes de procesar, leer el total de la barra (ej: 1-10 of 34)
        let currentTotal = getTotalBetslipsFromToolbar();
        // Si no hay barra visible, caemos en el número de filas contadas en el DOM
        if (typeof currentTotal !== "number") {
           currentTotal = rows.length; 
        }

        const row = rows[0];

        const boostOk = await doCreateBoost(row, cfg);
        console.log("[CreatorBoost] Create Boost:", boostOk ? "OK" : "FAIL");

        const cancelOk = await doCancelBet(row);
        console.log("[CreatorBoost] Cancel bet:", cancelOk ? "OK" : "FAIL");

        // ======= DYNAMIC WAIT =======
        // En lugar de sleep fijo, se monitorea a que caiga el contador de betslips o aparezca "No bets"
        console.log(`[CreatorBoost] Esperando dinámicamente que el total (${currentTotal}) disminuya...`);
        await waitForTotalToDropBy1(currentTotal);
      }
    } catch (err) {
      console.error("[creator_boost] Error:", err);
      try {
        if (!document.getElementById("creatorboost-results-overlay")) {
          showResultsModal(__results);
        }
      } catch {}
      return { ok: false, error: err?.message ? String(err.message) : String(err) };
    }
  });
})();