(() => {
  if (!window.registerAutomation) return;

  window.registerAutomation("OddsConverter", { name: "OddsConverter" }, async () => {
    try {
      // Evita que la ventana se cree dentro de iframes cuando la extensión corre con all_frames:true
      if (window.top !== window.self) {
        return { ok: true };
      }

      (function() {
          // --- 1. CONFIGURACIÓN DE PATRONES ---
          const AMERICAN_REGEX = /^[+\-−–]\d{3,5}$/; // Detecta cuotas americanas
          const FRACTIONAL_REGEX = /^\d{1,3}\/\d{1,3}$/; // Detecta cuotas UK (ej: 5/2, 10/1)
          const PANEL_ID = 'odds-converter-pro';
          const STATE_KEY = '__OddsConverterState__';
          const POS_KEY = 'tbo_oddsconverter_pos_v1';

          /*****************************************************************
           * THEME (same as Creator QuicksBB)
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

          // Si ya existe una instancia activa, no crear otra ventana ni otro observer/interval
          if (window[STATE_KEY]?.active && document.getElementById(PANEL_ID)) {
              return;
          }

          // Si quedó una instancia anterior incompleta, limpiarla antes de iniciar
          if (window[STATE_KEY]) {
              try {
                  if (window[STATE_KEY].observer) window[STATE_KEY].observer.disconnect();
                  if (window[STATE_KEY].interval) clearInterval(window[STATE_KEY].interval);
              } catch (e) {}
          }

          window[STATE_KEY] = {
              active: true,
              observer: null,
              interval: null
          };
          
          let mode = 'original'; // 'original', 'american', 'fractional'
          let mainObserver = null;
          let mainInterval = null;

          // --- 2. LÓGICA DE CONVERSIÓN ---
          const toDecimal = (val, type) => {
              if (type === 'american') {
                  let clean = val.trim().replace(/[−–]/g, '-').replace(/[^0-9+\-]/g, ''); 
                  let num = parseFloat(clean);
                  if (isNaN(num) || num === 0) return null;
                  return num >= 100 ? (num / 100 + 1).toFixed(2) : (100 / Math.abs(num) + 1).toFixed(2);
              } 
              if (type === 'fractional') {
                  let parts = val.split('/');
                  let a = parseFloat(parts[0]);
                  let b = parseFloat(parts[1]);
                  if (isNaN(a) || isNaN(b) || b === 0) return null;
                  return (a / b + 1).toFixed(2);
              }
              return null;
          };

          // --- 3. PROCESAMIENTO DINÁMICO ---
          const applyLogic = () => {
              const elements = document.querySelectorAll('span, div, button, b');
              elements.forEach(el => {
                  if (el.id === PANEL_ID || el.closest(`#${PANEL_ID}`)) return;
                  if (el.children.length > 0 && el.querySelector('span')) return; 
                  const text = el.innerText.trim();

                  if (mode !== 'original') {
                      // Solo convertir si coincide con el modo seleccionado
                      const isMatch = (mode === 'american' && AMERICAN_REGEX.test(text)) || 
                                      (mode === 'fractional' && FRACTIONAL_REGEX.test(text));

                      if (isMatch) {
                          if (!el.hasAttribute('data-origin')) el.setAttribute('data-origin', text);
                          const converted = toDecimal(text, mode);
                          if (converted && el.innerText !== converted) {
                              el.innerText = converted;
                              el.style.color = '#f0a64a';
                              el.style.fontWeight = 'bold';
                          }
                      }
                  } else {
                      // Revertir todo si volvemos a original
                      const original = el.getAttribute('data-origin');
                      if (original) {
                          el.innerText = original;
                          el.style.color = '';
                          el.style.fontWeight = '';
                          el.removeAttribute('data-origin');
                      }
                  }
              });
          };

          // --- 4. INTERFAZ (UI) ---
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

          const closeTool = () => {
              mode = 'original';
              applyLogic();

              if (mainObserver) mainObserver.disconnect();
              if (mainInterval) clearInterval(mainInterval);

              const panel = document.getElementById(PANEL_ID);
              if (panel) panel.remove();

              window[STATE_KEY] = {
                  active: false,
                  observer: null,
                  interval: null
              };
          };

          const drawUI = () => {
              if (document.getElementById(PANEL_ID)) return;

              const panel = document.createElement('div');
              panel.id = PANEL_ID;
              panel.style.position = "fixed";
              panel.style.top = "90px";
              panel.style.right = "24px";
              panel.style.width = "200px";
              panel.style.maxWidth = "92vw";
              panel.style.background = THEME.CARD;
              panel.style.border = `1px solid ${THEME.BORDER}`;
              panel.style.borderRadius = `${THEME.RADIUS}px`;
              panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
              panel.style.zIndex = "999999";
              panel.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
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

              header.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="font-weight:650; font-size:12px; letter-spacing:.2px; color:${THEME.TEXT};">OddsConverter</div>
                </div>
                <div style="display:flex; gap:6px;">
                  <button id="oddsMin" title="Minimize" style="
                    width:26px;height:22px;border-radius:8px;
                    border:1px solid ${THEME.BORDER};
                    background:rgba(255,255,255,0.02);
                    color:${THEME.TEXT}; font-weight:650; font-size:12px; cursor:pointer;
                    display:flex; align-items:center; justify-content:center; padding:0;">−</button>
                  <button id="closeProTool" title="Close" style="
                    width:26px;height:22px;border-radius:8px;
                    border:1px solid ${THEME.BORDER};
                    background:rgba(255,255,255,0.02);
                    color:${THEME.TEXT}; font-weight:650; font-size:12px; cursor:pointer;
                    display:flex; align-items:center; justify-content:center; padding:0;">✕</button>
                </div>
              `;

              const body = document.createElement("div");
              body.style.padding = "10px";

              body.innerHTML = `
                <div style="
                  border:1px solid ${THEME.BORDER};
                  background:rgba(255,255,255,0.02);
                  border-radius:${THEME.RADIUS}px;
                  padding:10px;
                  display:flex;
                  flex-direction:column;
                  gap:8px;">
                  
                  <button id="btnAm" style="
                    width:100%;
                    border:none;
                    background:linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95));
                    color:#111;
                    border-radius:12px;
                    padding:10px 12px;
                    font-weight:650;
                    font-size:12px;
                    cursor:pointer;">
                    Convert American
                  </button>

                  <button id="btnFr" style="
                    width:100%;
                    border:none;
                    background:linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95));
                    color:#111;
                    border-radius:12px;
                    padding:10px 12px;
                    font-weight:650;
                    font-size:12px;
                    cursor:pointer;">
                    Convert Fractional
                  </button>
                </div>
              `;

              panel.appendChild(header);
              panel.appendChild(body);
              document.body.appendChild(panel);
              restorePosition(panel);

              const btnAm = panel.querySelector('#btnAm');
              const btnFr = panel.querySelector('#btnFr');
              const minBtn = panel.querySelector('#oddsMin');
              const closeBtn = panel.querySelector('#closeProTool');

              const primaryButtonStyle = `
                width:100%;
                border:none;
                background:linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95));
                color:#111;
                border-radius:12px;
                padding:10px 12px;
                font-weight:650;
                font-size:12px;
                cursor:pointer;
              `;

              const secondaryButtonStyle = `
                width:100%;
                border:1px solid ${THEME.BORDER};
                background:rgba(255,255,255,0.02);
                color:${THEME.TEXT};
                border-radius:12px;
                padding:10px 12px;
                font-weight:650;
                font-size:12px;
                cursor:pointer;
              `;

              const updateButtons = () => {
                  btnAm.style.cssText = mode === 'american' ? primaryButtonStyle : secondaryButtonStyle;
                  btnFr.style.cssText = mode === 'fractional' ? primaryButtonStyle : secondaryButtonStyle;
              };

              btnAm.onmouseenter = () => {
                  btnAm.style.opacity = "0.9";
              };
              btnAm.onmouseleave = () => {
                  btnAm.style.opacity = "1";
              };

              btnFr.onmouseenter = () => {
                  btnFr.style.opacity = "0.9";
              };
              btnFr.onmouseleave = () => {
                  btnFr.style.opacity = "1";
              };

              minBtn.onmouseenter = () => {
                  minBtn.style.background = "rgba(255,255,255,0.05)";
              };
              minBtn.onmouseleave = () => {
                  minBtn.style.background = "rgba(255,255,255,0.02)";
              };

              closeBtn.onmouseenter = () => {
                  closeBtn.style.background = "rgba(255,255,255,0.05)";
              };
              closeBtn.onmouseleave = () => {
                  closeBtn.style.background = "rgba(255,255,255,0.02)";
              };

              // Drag
              let dragging = false;
              let offsetX = 0;
              let offsetY = 0;

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

              minBtn.onclick = () => {
                  minimized = !minimized;
                  body.style.display = minimized ? "none" : "block";
                  persistPosition(panel);
              };

              closeBtn.onclick = closeTool;

              btnAm.onclick = () => {
                  mode = mode === 'american' ? 'original' : 'american';
                  updateButtons();
                  applyLogic();
              };

              btnFr.onclick = () => {
                  mode = mode === 'fractional' ? 'original' : 'fractional';
                  updateButtons();
                  applyLogic();
              };

              updateButtons();
          };

          drawUI();

          mainObserver = new MutationObserver(applyLogic);
          mainObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

          mainInterval = setInterval(applyLogic, 1000);

          window[STATE_KEY].observer = mainObserver;
          window[STATE_KEY].interval = mainInterval;
      })();

      return { ok: true };
    } catch (err) {
      console.error("[OddsConverter] Error:", err);
      return { ok: false, error: String(err?.message || err) };
    }
  });
})();
