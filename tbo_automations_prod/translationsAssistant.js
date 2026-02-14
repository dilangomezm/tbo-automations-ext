// translationsAssistant.js
(() => {
  if (!window.registerAutomation) return;

  window.registerAutomation(
    "translationsAssistant",
    { name: "Translations Assistant" },
    async () => {
      try {
        // =========================
        // CONFIG
        // =========================
        const LANGS = ["Danish", "Finnish", "Portuguese", "Swedish"];

        // =========================
        // THEME (same as other tools)
        // =========================
        const BG = "#0b0d10";
        const CARD = "#13161d";
        const BORDER = "rgba(255,255,255,0.10)";
        const BORDER2 = "rgba(255,255,255,0.14)";
        const TEXT = "#e6e8ee";
        const MUTED = "rgba(230,232,238,0.65)";
        const ACCENT = "#f0a64a";
        const ACCENT2 = "#c88533";
        const RADIUS = 14;

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        // =========================
        // UI: Floating panel with custom file picker (draggable / minimize / close)
        // =========================
        function openWorkPanel() {
          return new Promise((resolve) => {
            // prevent duplicates
            document.getElementById("tbo_translations_assistant_panel")?.remove();

            const panel = document.createElement("div");
            panel.id = "tbo_translations_assistant_panel";
            panel.style.position = "fixed";
            panel.style.top = "110px";
            panel.style.right = "24px";
            panel.style.width = "380px";
            panel.style.maxWidth = "92vw";
            panel.style.background = CARD;
            panel.style.border = `1px solid ${BORDER}`;
            panel.style.borderRadius = `${RADIUS}px`;
            panel.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
            panel.style.zIndex = "999999";
            panel.style.fontFamily =
              "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
            panel.style.color = TEXT;
            panel.style.overflow = "hidden";

            // Header (draggable)
            const header = document.createElement("div");
            header.style.height = "36px";
            header.style.display = "flex";
            header.style.alignItems = "center";
            header.style.justifyContent = "space-between";
            header.style.padding = "0 10px";
            header.style.cursor = "grab";
            header.style.userSelect = "none";
            header.style.background =
              "linear-gradient(90deg, rgba(240,166,74,0.18), rgba(240,166,74,0.04))";
            header.style.borderBottom = `1px solid ${BORDER}`;

            const title = document.createElement("div");
            title.textContent = "Translations Assistant";
            title.style.fontWeight = "650";
            title.style.fontSize = "12px";
            title.style.letterSpacing = ".2px";

            const btns = document.createElement("div");
            btns.style.display = "flex";
            btns.style.gap = "6px";

            const minBtn = document.createElement("button");
            minBtn.title = "Minimize";
            minBtn.textContent = "−";
            minBtn.style.width = "26px";
            minBtn.style.height = "22px";
            minBtn.style.borderRadius = "8px";
            minBtn.style.border = `1px solid ${BORDER}`;
            minBtn.style.background = "rgba(255,255,255,0.02)";
            minBtn.style.color = TEXT;
            minBtn.style.fontWeight = "650";
            minBtn.style.cursor = "pointer";

            const closeBtn = document.createElement("button");
            closeBtn.title = "Close";
            closeBtn.textContent = "✕";
            closeBtn.style.width = "26px";
            closeBtn.style.height = "22px";
            closeBtn.style.borderRadius = "8px";
            closeBtn.style.border = `1px solid ${BORDER}`;
            closeBtn.style.background = "rgba(255,255,255,0.02)";
            closeBtn.style.color = TEXT;
            closeBtn.style.fontWeight = "650";
            closeBtn.style.cursor = "pointer";

            btns.appendChild(minBtn);
            btns.appendChild(closeBtn);

            header.appendChild(title);
            header.appendChild(btns);

            // Body
            const body = document.createElement("div");
            body.style.padding = "10px";

            // Card
            const card = document.createElement("div");
            card.style.background = "rgba(255,255,255,0.02)";
            card.style.border = `1px solid ${BORDER}`;
            card.style.borderRadius = `${RADIUS}px`;
            card.style.padding = "10px";
            card.style.display = "flex";
            card.style.flexDirection = "column";
            card.style.gap = "8px";
            card.addEventListener("mouseenter", () => {
              card.style.border = `1px solid ${BORDER2}`;
              card.style.background = "rgba(255,255,255,0.03)";
            });
            card.addEventListener("mouseleave", () => {
              card.style.border = `1px solid ${BORDER}`;
              card.style.background = "rgba(255,255,255,0.02)";
            });

            const label = document.createElement("div");
            label.textContent = "CSV file";
            label.style.fontSize = "11px";
            label.style.color = MUTED;
            label.style.fontWeight = "600";

            // Hidden file input
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".csv";
            fileInput.style.position = "absolute";
            fileInput.style.left = "-99999px";
            fileInput.style.opacity = "0";

            // Custom picker row
            const pickerRow = document.createElement("div");
            pickerRow.style.display = "grid";
            pickerRow.style.gridTemplateColumns = "120px 1fr";
            pickerRow.style.gap = "10px";
            pickerRow.style.alignItems = "center";

            const chooseBtn = document.createElement("button");
            chooseBtn.type = "button";
            chooseBtn.textContent = "Choose file";
            chooseBtn.style.cursor = "pointer";
            chooseBtn.style.border = `1px solid ${BORDER}`;
            chooseBtn.style.background = "rgba(255,255,255,0.03)";
            chooseBtn.style.color = TEXT;
            chooseBtn.style.borderRadius = "12px";
            chooseBtn.style.padding = "9px 10px";
            chooseBtn.style.fontWeight = "650";
            chooseBtn.style.fontSize = "12px";
            chooseBtn.addEventListener("mouseenter", () => {
              chooseBtn.style.border = `1px solid ${BORDER2}`;
              chooseBtn.style.background = "rgba(255,255,255,0.05)";
            });
            chooseBtn.addEventListener("mouseleave", () => {
              chooseBtn.style.border = `1px solid ${BORDER}`;
              chooseBtn.style.background = "rgba(255,255,255,0.03)";
            });

            const fileName = document.createElement("div");
            fileName.textContent = "No file selected";
            fileName.style.fontSize = "11px";
            fileName.style.color = MUTED;
            fileName.style.padding = "9px 10px";
            fileName.style.borderRadius = "12px";
            fileName.style.border = `1px solid ${BORDER}`;
            fileName.style.background = "rgba(255,255,255,0.02)";
            fileName.style.whiteSpace = "nowrap";
            fileName.style.overflow = "hidden";
            fileName.style.textOverflow = "ellipsis";

            chooseBtn.onclick = () => fileInput.click();
            fileInput.addEventListener("change", () => {
              const f = fileInput.files && fileInput.files[0];
              fileName.textContent = f ? f.name : "No file selected";
              fileName.style.color = f ? TEXT : MUTED;
            });

            pickerRow.appendChild(chooseBtn);
            pickerRow.appendChild(fileName);

            // Error
            const error = document.createElement("div");
            error.style.marginTop = "8px";
            error.style.fontSize = "11px";
            error.style.color = "#ff8181";
            error.style.display = "none";

            const setError = (msg) => {
              error.textContent = msg || "";
              error.style.display = msg ? "block" : "none";
            };

            // Run button (full width)
            const runBtn = document.createElement("button");
            runBtn.type = "button";
            runBtn.textContent = "Run";
            runBtn.style.marginTop = "10px";
            runBtn.style.width = "100%";
            runBtn.style.cursor = "pointer";
            runBtn.style.border = "none";
            runBtn.style.color = "#111";
            runBtn.style.borderRadius = "12px";
            runBtn.style.padding = "10px 12px";
            runBtn.style.fontWeight = "650";
            runBtn.style.fontSize = "12px";
            runBtn.style.background = `linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95))`;
            runBtn.addEventListener("mouseenter", () => {
              runBtn.style.background = `linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,1))`;
            });
            runBtn.addEventListener("mouseleave", () => {
              runBtn.style.background = `linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95))`;
            });

            const cleanup = () => {
              document.removeEventListener("keydown", onKeyDown);
              panel.remove();
            };

            const disableControls = () => {
              runBtn.disabled = true;
              runBtn.style.opacity = "0.85";
              runBtn.style.cursor = "default";
              chooseBtn.disabled = true;
              chooseBtn.style.opacity = "0.65";
              chooseBtn.style.cursor = "default";
              minBtn.disabled = true;
              closeBtn.disabled = true;
            };

            runBtn.onclick = () => {
              setError("");
              const file = fileInput.files && fileInput.files[0];
              if (!file) {
                setError("Please choose a CSV file.");
                return;
              }
              disableControls();
              cleanup();
              resolve({ ok: true, file });
            };

            // Close / cancel
            closeBtn.onclick = () => {
              cleanup();
              resolve({ ok: false, cancelled: true });
            };

            // Minimize
            let minimized = false;
            minBtn.onclick = () => {
              minimized = !minimized;
              body.style.display = minimized ? "none" : "block";
              minBtn.textContent = minimized ? "+" : "−";
            };

            // ESC closes
            function onKeyDown(e) {
              if (e.key === "Escape") {
                cleanup();
                resolve({ ok: false, cancelled: true });
              }
            }
            document.addEventListener("keydown", onKeyDown);

            // Drag
            let dragging = false,
              offsetX = 0,
              offsetY = 0;

            header.addEventListener("mousedown", (e) => {
              dragging = true;
              header.style.cursor = "grabbing";
              const rect = panel.getBoundingClientRect();
              offsetX = e.clientX - rect.left;
              offsetY = e.clientY - rect.top;
              e.preventDefault();
            });

            window.addEventListener(
              "mousemove",
              (e) => {
                if (!dragging) return;
                const x = Math.max(
                  0,
                  Math.min(window.innerWidth - panel.offsetWidth, e.clientX - offsetX)
                );
                const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY));
                panel.style.left = `${x}px`;
                panel.style.top = `${y}px`;
                panel.style.right = "auto";
              },
              { passive: true }
            );

            window.addEventListener(
              "mouseup",
              () => {
                if (!dragging) return;
                dragging = false;
                header.style.cursor = "grab";
              },
              { passive: true }
            );

            // Compose
            card.appendChild(label);
            card.appendChild(fileInput);
            card.appendChild(pickerRow);

            body.appendChild(card);
            body.appendChild(error);
            body.appendChild(runBtn);

            panel.appendChild(header);
            panel.appendChild(body);
            document.body.appendChild(panel);
          });
        }

        function showBlockingMessage(message) {
          const overlay = document.createElement("div");
          overlay.style.position = "fixed";
          overlay.style.inset = "0";
          overlay.style.background = "rgba(0,0,0,0.55)";
          overlay.style.zIndex = "999999";
          overlay.style.display = "flex";
          overlay.style.alignItems = "center";
          overlay.style.justifyContent = "center";

          const modal = document.createElement("div");
          modal.style.width = "540px";
          modal.style.maxWidth = "92vw";
          modal.style.background = CARD;
          modal.style.borderRadius = `${RADIUS}px`;
          modal.style.boxShadow = "0 10px 30px rgba(0,0,0,0.45)";
          modal.style.border = `1px solid ${BORDER}`;
          modal.style.fontFamily =
            "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
          modal.style.color = TEXT;
          modal.style.padding = "12px";

          const title = document.createElement("div");
          title.textContent = "Action required";
          title.style.fontSize = "13px";
          title.style.fontWeight = "650";
          title.style.marginBottom = "8px";

          const cardRow = document.createElement("div");
          cardRow.style.background = "rgba(255,255,255,0.02)";
          cardRow.style.border = `1px solid ${BORDER}`;
          cardRow.style.borderRadius = `${RADIUS}px`;
          cardRow.style.padding = "10px";
          cardRow.style.marginBottom = "12px";

          const body = document.createElement("div");
          body.textContent = message;
          body.style.fontSize = "11px";
          body.style.color = MUTED;
          body.style.whiteSpace = "pre-wrap";

          const closeBtn = document.createElement("button");
          closeBtn.textContent = "Close";
          closeBtn.style.width = "100%";
          closeBtn.style.background = `linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95))`;
          closeBtn.style.color = "#111";
          closeBtn.style.border = "none";
          closeBtn.style.borderRadius = "12px";
          closeBtn.style.padding = "9px 10px";
          closeBtn.style.fontSize = "12px";
          closeBtn.style.fontWeight = "650";
          closeBtn.style.cursor = "pointer";

          closeBtn.addEventListener("mouseenter", () => {
            closeBtn.style.background = `linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,1))`;
          });
          closeBtn.addEventListener("mouseleave", () => {
            closeBtn.style.background = `linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95))`;
          });

          closeBtn.addEventListener("click", () => overlay.remove());

          modal.appendChild(title);
          cardRow.appendChild(body);
          modal.appendChild(cardRow);
          modal.appendChild(closeBtn);
          overlay.appendChild(modal);
          document.body.appendChild(overlay);
        }

        // =========================
        // Start: CSV selection
        // =========================
        const modalResult = await openWorkPanel();
        if (!modalResult || !modalResult.ok || !modalResult.file) {
          return { ok: false, error: "Cancelled by user." };
        }

        const csvText = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsText(modalResult.file);
        });

        if (!csvText) {
          console.error("CSV file could not be read. Aborting.");
          return { ok: false, error: "CSV file could not be read." };
        }

        // =========================
        // Core logic (UNCHANGED)
        // =========================
        function parseCSV(str) {
          const lines = str.trim().split("\n");
          const headers = lines[0].split(",");
          const rows = lines.slice(1).map((l) => l.split(","));
          const res = {};
          for (const row of rows) {
            const obj = {};
            headers.forEach(
              (h, i) => (obj[h.trim()] = row[i] !== undefined ? row[i].trim() : "")
            );
            res[obj["Suffix_EN"]] = obj;
          }
          return res;
        }

        const translations = parseCSV(csvText);

        function extractSuffix(fullName) {
          const parts = fullName.split(" - ");
          if (parts.length === 2) return parts[1].trim();
          if (parts.length === 3) return parts.slice(1).join(" - ").trim();
          if (parts.length >= 4) {
            const maybeVs = parts[parts.length - 1];
            const middle = parts.slice(1, parts.length - 1).join(" - ").trim();
            return maybeVs.includes(" vs ") ? middle : parts.slice(1).join(" - ").trim();
          }
          return null;
        }

        function extractTournament(fullName, suffix) {
          const idx = typeof suffix === "string" ? fullName.indexOf(suffix) : -1;
          if (idx <= 0) {
            return { tournament: fullName, tail: "" };
          }
          const tournament = fullName.slice(0, idx).trim().replace(/-$/, "").trim();
          const after = fullName.slice(idx + suffix.length).trim();
          const tail = after ? " " + after : "";
          return { tournament, tail };
        }

        async function writeInput(inputElem, value) {
          const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          ).set;
          setter.call(inputElem, "");
          inputElem.dispatchEvent(new Event("input", { bubbles: true }));
          await sleep(100);
          setter.call(inputElem, value);
          inputElem.dispatchEvent(new Event("input", { bubbles: true }));
        }

        async function ensureMarketsOther() {
          const marketsTab = document.querySelector('a[aria-controls][href*="detail=markets"]');
          if (marketsTab && !marketsTab.getAttribute("aria-selected")) {
            marketsTab.click();
            await sleep(1000);
          }
          const otherTab = Array.from(document.querySelectorAll('a[role="tab"]')).find((a) =>
            (a.textContent || "").trim().toLowerCase().startsWith("other")
          );
          if (otherTab && !otherTab.getAttribute("aria-selected")) {
            otherTab.click();
            await sleep(1000);
          }
        }

        function getOtherCount() {
          const otherTab = Array.from(document.querySelectorAll('a[role="tab"]')).find((a) =>
            (a.textContent || "").trim().toLowerCase().startsWith("other")
          );
          if (!otherTab) return null;

          const txt = (otherTab.textContent || "").trim();
          const m = txt.match(/\((\d+)\)/);
          if (!m) return null;

          const n = Number(m[1]);
          return Number.isFinite(n) ? n : null;
        }

        async function waitForOtherDecrement(prevCount) {
          if (prevCount === null || prevCount === undefined) return null;

          const target = prevCount - 1;
          if (target < 0) return prevCount;

          const start = Date.now();
          const timeoutMs = 120000;
          while (Date.now() - start < timeoutMs) {
            const current = getOtherCount();
            if (current !== null && current <= target) {
              await sleep(1000);
              return current;
            }
            await sleep(200);
          }
          return getOtherCount();
        }

        function getLangRow(labelText) {
          const target = (labelText || "").trim().toLowerCase();
          return Array.from(
            document.querySelectorAll('[data-testid="multilanguage-translations-popup-from-row"]')
          ).find((div) => {
            const lbl = div
              .querySelector('[data-testid="multilanguage-translations-popup-from-row-label"]')
              ?.textContent;
            return (lbl || "").trim().toLowerCase() === target;
          });
        }

        await ensureMarketsOther();

        const initialMarkets = document.querySelectorAll(
          '[data-testid="event-markets-odds-item"]'
        ).length;
        console.log(`Markets detected: ${initialMarkets}`);

        let lastOtherCount = getOtherCount();
        console.log("Other count at start:", lastOtherCount);

        let processed = 0;

        while (true) {
          const items = Array.from(
            document.querySelectorAll('[data-testid="event-markets-odds-item"]')
          );

          if (items.length === 0) {
            console.log("No markets left. Done.");
            break;
          }

          const item = items[0];
          const nameElem = item.querySelector('[data-testid="simple-market-name"] h6');
          if (!nameElem) {
            console.warn("Name not found. Skipping...");
            await sleep(500);
            continue;
          }

          const fullName = nameElem.textContent.trim();
          const suffix = extractSuffix(fullName);

          const fullParts = fullName.split(" - ");
          const marketNameWithoutTournament =
            fullParts.length >= 2 ? fullParts.slice(1).join(" - ").trim() : fullName;

          let isMakeTheCut = false;
          let makeTheCutPlayer = "";

          let is72HoleMatchBet = false;
          let holeMatchVs = "";

          let tr = translations[suffix];
          let { tail } = extractTournament(fullName, suffix);

          if (typeof suffix === "string" && suffix.toLowerCase().includes("to make the cut")) {
            isMakeTheCut = true;
            const afterFirstDash = fullParts.slice(1).join(" - ").trim();
            makeTheCutPlayer = afterFirstDash.replace(/to make the cut/gi, "").trim();
            tr = translations["to make the cut"];
            tail = "";
          }

          if (fullParts.length >= 3) {
            const middle = (fullParts[1] || "").trim();
            if (middle.toLowerCase() === "72 hole match bet".toLowerCase()) {
              is72HoleMatchBet = true;
              holeMatchVs = fullParts.slice(2).join(" - ").trim();
              tr = translations["72 Hole Match Bet"];
              tail = "";
            }
          }

          if (!tr) {
            const msg =
              `A new market was found that is not included in the CSV.\n\n` +
              `Market (English):\n${marketNameWithoutTournament}\n\n` +
              `Please add it to the CSV (Suffix_EN) and run again, or process it manually before continuing.`;
            console.error("Missing CSV mapping for:", suffix, fullName);
            showBlockingMessage(msg);
            return { ok: false, error: "missing_csv_market" };
          }

          const desiredNames = {};
          for (const lang of LANGS) {
            const langVal = tr[lang];
            if (!langVal) continue;

            if (isMakeTheCut) desiredNames[lang] = `${makeTheCutPlayer} ${langVal}${tail}`;
            else if (is72HoleMatchBet) desiredNames[lang] = `${langVal}${tail} - ${holeMatchVs}`;
            else desiredNames[lang] = `${langVal}${tail}`;
          }

          const beforeCount = getOtherCount();
          if (beforeCount !== null) lastOtherCount = beforeCount;

          const dotsBtn = item.querySelector(
            '[data-testid="more-button"] [role="button"][tabindex="0"]'
          );
          if (dotsBtn) {
            dotsBtn.click();
            await sleep(400);

            const menuItem = await new Promise((resolve) => {
              const interval = setInterval(() => {
                const el = document.querySelector('[data-testid="more-menu-change-translation"]');
                if (el) {
                  clearInterval(interval);
                  resolve(el);
                }
              }, 100);
              setTimeout(() => {
                clearInterval(interval);
                resolve(null);
              }, 2000);
            });

            if (menuItem) {
              menuItem.click();

              await sleep(1000);
              await sleep(400);

              let popupOk = false;
              for (let j = 0; j < 20; j++) {
                const title = document.querySelector('[data-testid="dialog-popup-title"] span')
                  ?.textContent;
                if (title && title.includes(fullName)) {
                  popupOk = true;
                  break;
                }
                await sleep(100);
              }

              if (popupOk) {
                let changed = false;

                for (const [lang, newVal] of Object.entries(desiredNames)) {
                  const row = getLangRow(lang);
                  if (row) {
                    const input = row.querySelector("input");
                    if (input && input.value !== newVal) {
                      await writeInput(input, newVal);
                      changed = true;
                    }
                  }
                }

                const desiredEnglish = isMakeTheCut
                  ? `${makeTheCutPlayer} to make the cut`
                  : is72HoleMatchBet
                    ? `72 Hole Match Bet - ${holeMatchVs}`
                    : marketNameWithoutTournament;

                const englishRow = getLangRow("English");
                if (englishRow) {
                  const enInput = englishRow.querySelector("input");
                  if (enInput && enInput.value !== desiredEnglish) {
                    await writeInput(enInput, desiredEnglish);
                    changed = true;
                  }
                }

                await sleep(300);

                const saveBtn = document.querySelector(
                  '[data-testid="multilanguage-translations-popup-save-button"]'
                );
                const cancelBtn = document.querySelector(
                  '[data-testid="multilanguage-translations-popup-cancel-button"]'
                );

                if (changed && saveBtn && !saveBtn.disabled) saveBtn.click();
                else cancelBtn?.click();

                for (let k = 0; k < 20; k++) {
                  if (!document.querySelector('[data-testid="dialog-popup-title"]')) break;
                  await sleep(100);
                }
              }
            }
          }

          // ==== Subtype: To Make The Cut ====
          if (typeof fullName === "string" && fullName.toLowerCase().includes("to make the cut")) {
            const subtypeValue = "To Make The Cut";
            const dotsBtn2 = item.querySelector(
              '[data-testid="more-button"] [role="button"][tabindex="0"]'
            );
            if (dotsBtn2) {
              dotsBtn2.click();
              await sleep(400);

              const adaptOpt = await new Promise((resolve) => {
                const itv = setInterval(() => {
                  const el = document.querySelector('[data-testid="more-menu-adapt-subtype"]');
                  if (el) {
                    clearInterval(itv);
                    resolve(el);
                  }
                }, 100);
                setTimeout(() => {
                  clearInterval(itv);
                  resolve(null);
                }, 2000);
              });

              if (adaptOpt) {
                adaptOpt.click();
                await sleep(600);

                let dialog;
                for (let j = 0; j < 20; j++) {
                  dialog = document.querySelector('[role="dialog"]');
                  const title = dialog
                    ?.querySelector('[data-testid="dialog-popup-title"] span')
                    ?.textContent;
                  if (dialog && title && title.toLowerCase().includes("edit subtype")) break;
                  await sleep(100);
                }

                if (dialog) {
                  const combo = dialog.querySelector('div[role="combobox"]');
                  if (combo) {
                    combo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                    combo.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                    combo.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                    await sleep(300);

                    const listbox = await new Promise((resolve) => {
                      const it = setInterval(() => {
                        const lb = document.querySelector('ul[role="listbox"], div[role="listbox"]');
                        if (lb) {
                          clearInterval(it);
                          resolve(lb);
                        }
                      }, 100);
                      setTimeout(() => {
                        clearInterval(it);
                        resolve(null);
                      }, 2000);
                    });

                    if (listbox) {
                      const option = Array.from(listbox.querySelectorAll('[role="option"]')).find(
                        (el) =>
                          el.textContent.trim().toLowerCase() === subtypeValue.trim().toLowerCase()
                      );

                      if (option) {
                        option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                        option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                        option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                        await sleep(200);

                        const saveSubtype = dialog.querySelector(
                          '[data-testid="editWithAcceptSaveBtn"]'
                        );
                        if (saveSubtype && !saveSubtype.disabled) saveSubtype.click();
                        else dialog.querySelector('[data-testid="editWithAcceptCancelBtn"]')?.click();
                      } else {
                        dialog.querySelector('[data-testid="editWithAcceptCancelBtn"]')?.click();
                      }
                    }
                  }
                }
              }
            }
          }

          // ==== Subtype: 72 Hole Match Bet => Match Bet ====
          {
            const middle = (fullParts[1] || "").trim();
            if (middle && middle.toLowerCase() === "72 hole match bet".toLowerCase()) {
              const subtypeValue = "Match Bet";

              const dotsBtn2 = item.querySelector(
                '[data-testid="more-button"] [role="button"][tabindex="0"]'
              );
              if (dotsBtn2) {
                dotsBtn2.click();
                await sleep(400);

                const adaptOpt = await new Promise((resolve) => {
                  const itv = setInterval(() => {
                    const el = document.querySelector('[data-testid="more-menu-adapt-subtype"]');
                    if (el) {
                      clearInterval(itv);
                      resolve(el);
                    }
                  }, 100);
                  setTimeout(() => {
                    clearInterval(itv);
                    resolve(null);
                  }, 2000);
                });

                if (adaptOpt) {
                  adaptOpt.click();
                  await sleep(600);

                  let dialog;
                  for (let j = 0; j < 20; j++) {
                    dialog = document.querySelector('[role="dialog"]');
                    const title = dialog
                      ?.querySelector('[data-testid="dialog-popup-title"] span')
                      ?.textContent;
                    if (dialog && title && title.toLowerCase().includes("edit subtype")) break;
                    await sleep(100);
                  }

                  if (dialog) {
                    const combo = dialog.querySelector('div[role="combobox"]');
                    if (combo) {
                      combo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                      combo.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                      combo.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                      await sleep(300);

                      const listbox = await new Promise((resolve) => {
                        const it = setInterval(() => {
                          const lb = document.querySelector(
                            'ul[role="listbox"], div[role="listbox"]'
                          );
                          if (lb) {
                            clearInterval(it);
                            resolve(lb);
                          }
                        }, 100);
                        setTimeout(() => {
                          clearInterval(it);
                          resolve(null);
                        }, 2000);
                      });

                      if (listbox) {
                        const option = Array.from(listbox.querySelectorAll('[role="option"]')).find(
                          (el) =>
                            el.textContent.trim().toLowerCase() === subtypeValue.trim().toLowerCase()
                        );

                        if (option) {
                          option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                          option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                          option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                          await sleep(200);

                          const saveSubtype = dialog.querySelector(
                            '[data-testid="editWithAcceptSaveBtn"]'
                          );
                          if (saveSubtype && !saveSubtype.disabled) saveSubtype.click();
                          else
                            dialog
                              .querySelector('[data-testid="editWithAcceptCancelBtn"]')
                              ?.click();
                        } else {
                          dialog.querySelector('[data-testid="editWithAcceptCancelBtn"]')?.click();
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // ==== Subtype: CSV-driven ====
          if (tr && tr.Subtype) {
            const subtypeValue = tr.Subtype;
            const dotsBtn2 = item.querySelector(
              '[data-testid="more-button"] [role="button"][tabindex="0"]'
            );
            if (dotsBtn2) {
              dotsBtn2.click();
              await sleep(400);

              const adaptOpt = await new Promise((resolve) => {
                const itv = setInterval(() => {
                  const el = document.querySelector('[data-testid="more-menu-adapt-subtype"]');
                  if (el) {
                    clearInterval(itv);
                    resolve(el);
                  }
                }, 100);
                setTimeout(() => {
                  clearInterval(itv);
                  resolve(null);
                }, 2000);
              });

              if (adaptOpt) {
                adaptOpt.click();
                await sleep(600);

                let dialog;
                for (let j = 0; j < 20; j++) {
                  dialog = document.querySelector('[role="dialog"]');
                  const title = dialog
                    ?.querySelector('[data-testid="dialog-popup-title"] span')
                    ?.textContent;
                  if (dialog && title && title.toLowerCase().includes("edit subtype")) break;
                  await sleep(100);
                }

                if (dialog) {
                  const combo = dialog.querySelector('div[role="combobox"]');
                  if (combo) {
                    combo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                    combo.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                    combo.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                    await sleep(300);

                    const listbox = await new Promise((resolve) => {
                      const it = setInterval(() => {
                        const lb = document.querySelector(
                          'ul[role="listbox"], div[role="listbox"]'
                        );
                        if (lb) {
                          clearInterval(it);
                          resolve(lb);
                        }
                      }, 100);
                      setTimeout(() => {
                        clearInterval(it);
                        resolve(null);
                      }, 2000);
                    });

                    if (listbox) {
                      const option = Array.from(listbox.querySelectorAll('[role="option"]')).find(
                        (el) => el.textContent.trim() === subtypeValue
                      );

                      if (option) {
                        option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
                        option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
                        option.dispatchEvent(new MouseEvent("click", { bubbles: true }));
                        await sleep(200);

                        const saveSubtype = dialog.querySelector(
                          '[data-testid="editWithAcceptSaveBtn"]'
                        );
                        if (saveSubtype && !saveSubtype.disabled) saveSubtype.click();
                        else dialog.querySelector('[data-testid="editWithAcceptCancelBtn"]')?.click();
                      } else {
                        dialog.querySelector('[data-testid="editWithAcceptCancelBtn"]')?.click();
                      }
                    }
                  }
                }
              }
            }
          }

          processed += 1;
          console.log(`Market processed #${processed}`);

          if (lastOtherCount !== null) {
            const newCount = await waitForOtherDecrement(lastOtherCount);
            if (typeof newCount === "number") lastOtherCount = newCount;
          } else {
            await sleep(1000);
          }
        }

        console.log("DONE. TOTAL PROCESSED:", processed);
        return { ok: true };
      } catch (err) {
        console.error("[TranslationsAssistant] Error:", err);
        return { ok: false, error: err?.message ? String(err.message) : String(err) };
      }
    }
  );
})();


