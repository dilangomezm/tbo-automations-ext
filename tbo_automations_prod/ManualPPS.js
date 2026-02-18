// ManualPPS.js
(() => {
  // Verificación de seguridad (obligatoria)
  if (!window.registerAutomation) return;

  window.registerAutomation("manual_pps", { name: "Manual PPS" }, async () => {
    try {
      // =========================
      // SCRIPT ORIGINAL (ENCAPSULADO)
      // =========================
      (function () {
        // --- 1. PREVENT DUPLICATES ---
        const popupId = "tbo-dark-popup-v2";
        const existingPopup = document.getElementById(popupId);
        if (existingPopup) existingPopup.remove();

        // --- 2. INJECT CSS STYLES (Strict adherence to your prompt) ---
        const style = document.createElement("style");
        style.innerHTML = `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

        #${popupId} * {
            box-sizing: border-box;
        }

        #${popupId} {
            position: fixed;
            top: 20px;
            right: 20px;
            width: 320px;
            background-color: #0B0D10; /* Base background */
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 14px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.45);
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            z-index: 2147483647; /* Max z-index */
            color: #E6E8EE;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: border-color 0.2s;
        }

        #${popupId}:hover {
            border-color: rgba(255,255,255,0.14);
        }

        /* --- Header --- */
        .tbo-header {
            background-color: #13161D;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            cursor: grab;
            user-select: none;
        }
        .tbo-header:active {
            cursor: grabbing;
        }

        .tbo-title {
            font-size: 13px;
            font-weight: 600;
            color: #E6E8EE;
            letter-spacing: 0.3px;
        }

        .tbo-controls {
            display: flex;
            gap: 8px;
        }

        .tbo-ctrl-btn {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.1);
            color: rgba(230,232,238,0.65);
            width: 24px;
            height: 24px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 12px;
            transition: all 0.2s;
            padding: 0;
            line-height: 1;
        }

        .tbo-ctrl-btn:hover {
            background: rgba(255,255,255,0.08);
            color: #FFF;
        }

        /* --- Body --- */
        .tbo-body {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background-color: #0B0D10;
        }

        .tbo-hidden {
            display: none !important;
        }

        .tbo-label {
            font-size: 11px;
            color: rgba(230,232,238,0.65); /* Muted */
            margin-bottom: 6px;
            display: block;
            font-weight: 500;
        }

        .tbo-textarea {
            width: 100%;
            height: 100px;
            background-color: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px;
            padding: 10px;
            color: #E6E8EE;
            font-family: 'Inter', sans-serif; /* Clean font even for inputs */
            font-size: 11px;
            resize: none;
            outline: none;
            transition: border-color 0.2s;
        }

        .tbo-textarea:focus {
            border-color: rgba(255,255,255,0.25);
            background-color: rgba(255,255,255,0.04);
        }

        .tbo-textarea::placeholder {
            color: rgba(230,232,238,0.25);
        }

        /* --- Primary Button --- */
        .tbo-btn-primary {
            background: linear-gradient(180deg, rgba(240,166,74,0.95) 0%, rgba(200,133,51,0.95) 100%);
            border: none;
            border-radius: 8px; /* Compact radius */
            padding: 10px;
            width: 100%;
            color: #111;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            transition: opacity 0.2s, transform 0.1s;
        }

        .tbo-btn-primary:hover {
            opacity: 0.92;
        }

        .tbo-btn-primary:active {
            transform: translateY(1px);
        }

        /* --- Status --- */
        .tbo-status {
            font-size: 10px;
            color: rgba(230,232,238,0.4);
            text-align: center;
            min-height: 12px;
            margin-top: 2px;
        }
    `;
        document.head.appendChild(style);

        // --- 3. CREATE HTML STRUCTURE ---
        const popup = document.createElement("div");
        popup.id = popupId;

        popup.innerHTML = `
        <div class="tbo-header" id="tbo-header-drag">
            <span class="tbo-title">Batch Outcome Filler</span>
            <div class="tbo-controls">
                <button class="tbo-ctrl-btn" id="tbo-btn-min" title="Minimize">－</button>
                <button class="tbo-ctrl-btn" id="tbo-btn-close" title="Close">✕</button>
            </div>
        </div>
        <div class="tbo-body" id="tbo-body-content">
            <div>
                <span class="tbo-label">Paste Excel Data (Player & Odd)</span>
                <textarea class="tbo-textarea" id="tbo-input-data" placeholder="Example:\nLionel Messi\t1.50\nNeymar Jr\t2.10"></textarea>
            </div>
            <button class="tbo-btn-primary" id="tbo-btn-run">Run</button>
            <div class="tbo-status" id="tbo-status-msg">Ready to start</div>
        </div>
    `;

        document.body.appendChild(popup);

        // --- 4. CORE LOGIC: REACT STATE HACK ---
        // This allows writing to inputs without React clearing them on re-render
        const setReactValue = (input, value) => {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value"
          ).set;
          nativeInputValueSetter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new Event("blur", { bubbles: true }));
        };

        // --- 5. ACTION: FILL FORM ---
        const runBtn = document.getElementById("tbo-btn-run");
        const inputData = document.getElementById("tbo-input-data");
        const statusMsg = document.getElementById("tbo-status-msg");

        runBtn.addEventListener("click", () => {
          const rawText = inputData.value;
          if (!rawText.trim()) {
            statusMsg.textContent = "Data is empty. Please paste first.";
            statusMsg.style.color = "#F0A64A";
            return;
          }

          // Split by lines
          const lines = rawText.split("\n").filter((l) => l.trim() !== "");

          // Find DOM rows
          const domRows = document.querySelectorAll(
            '[data-testid="event-details-markets-draft-market-outcome-row"]'
          );

          let count = 0;

          lines.forEach((line, index) => {
            if (index < domRows.length) {
              // Determine separator: Excel uses Tabs (\t), otherwise Comma
              const separator = line.includes("\t") ? "\t" : ",";
              const parts = line.split(separator);

              const player = parts[0]?.trim();
              const odd = parts[1]?.trim();

              const row = domRows[index];

              // Select inputs (Name and Odds)
              const nameInput = row.querySelector('input[name*=".name"]');
              const oddInput = row.querySelector('input[name*=".odds"]');

              if (nameInput && player) setReactValue(nameInput, player);
              if (oddInput && odd) setReactValue(oddInput, odd);

              count++;
            }
          });

          statusMsg.style.color = "#E6E8EE";
          statusMsg.textContent = `Success: Filled ${count} outcome(s).`;
        });

        // --- 6. WINDOW BEHAVIOR (Drag, Minimize, Close) ---

        // Minimize
        const minBtn = document.getElementById("tbo-btn-min");
        const bodyContent = document.getElementById("tbo-body-content");
        minBtn.addEventListener("click", () => {
          bodyContent.classList.toggle("tbo-hidden");
        });

        // Close
        const closeBtn = document.getElementById("tbo-btn-close");
        closeBtn.addEventListener("click", () => {
          popup.remove();
        });

        // Dragging Logic
        const header = document.getElementById("tbo-header-drag");
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener("mousedown", (e) => {
          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          const rect = popup.getBoundingClientRect();
          initialLeft = rect.left;
          initialTop = rect.top;

          // Unset 'right' so 'left' takes precedence during drag
          popup.style.right = "auto";
          popup.style.left = `${initialLeft}px`;
          popup.style.top = `${initialTop}px`;
        });

        document.addEventListener("mousemove", (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          popup.style.left = `${initialLeft + dx}px`;
          popup.style.top = `${initialTop + dy}px`;
        });

        document.addEventListener("mouseup", () => {
          isDragging = false;
        });
      })();

      return { ok: true };
    } catch (err) {
      console.error("[manual_pps] Error:", err);
      return { ok: false, error: String(err?.message || err) };
    }
  });
})();
