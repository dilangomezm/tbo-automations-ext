// uiKit.js - shared UI helpers for TBO Automations
(() => {
  if (window.TBO_UI) return;

  const THEME = {
    bg: "#0b0d10",
    panel: "rgba(19, 22, 29, 0.92)",
    panelSolid: "#13161d",
    border: "rgba(255,255,255,0.10)",
    borderStrong: "rgba(255,255,255,0.14)",
    text: "#e6e8ee",
    muted: "rgba(230,232,238,0.65)",
    accent: "#f0a64a", // softer orange
    accent2: "#c88533",
    danger: "#ff5c5c",
    ok: "#2ecc71",
    radius: 14
  };

  function ensureStyles() {
    if (document.getElementById("tbo-ui-kit-style")) return;
    const style = document.createElement("style");
    style.id = "tbo-ui-kit-style";
    style.textContent = `
      .tbo-panel{position:fixed; z-index:999999; width:360px; min-width:280px;
        color:${THEME.text}; font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
        background:${THEME.panel}; border:1px solid ${THEME.border}; border-radius:${THEME.radius}px;
        box-shadow:0 14px 45px rgba(0,0,0,0.62); backdrop-filter: blur(12px);
      }
      .tbo-header{display:flex; align-items:center; justify-content:space-between;
        padding:10px 10px; cursor:grab; user-select:none;
        background: linear-gradient(90deg, rgba(240,166,74,0.20), rgba(240,166,74,0.05));
        border-bottom:1px solid ${THEME.border};
        border-top-left-radius:${THEME.radius}px; border-top-right-radius:${THEME.radius}px;
      }
      .tbo-title{font-size:12px; font-weight:600; letter-spacing:0.2px;}
      .tbo-header-actions{display:flex; gap:6px;}
      .tbo-icon-btn{width:26px; height:22px; display:inline-flex; align-items:center; justify-content:center;
        border-radius:8px; border:1px solid ${THEME.border}; background:transparent; color:${THEME.text};
        cursor:pointer; font-size:12px; font-weight:600;
      }
      .tbo-icon-btn:hover{border-color:${THEME.borderStrong}; background:rgba(255,255,255,0.04)}
      .tbo-body{padding:12px;}
      .tbo-row{display:flex; gap:10px; align-items:center;}
      .tbo-col{display:flex; flex-direction:column; gap:8px;}
      .tbo-label{font-size:11px; font-weight:600; color:${THEME.muted};}
      .tbo-input{width:100%; box-sizing:border-box; padding:8px 10px;
        border-radius:10px; border:1px solid ${THEME.border};
        background: rgba(11,13,16,0.75); color:${THEME.text}; font-size:12px; outline:none;
      }
      .tbo-input:focus{border-color: rgba(240,166,74,0.45); box-shadow:0 0 0 3px rgba(240,166,74,0.10)}
      .tbo-btn{width:100%; box-sizing:border-box; padding:10px 12px; border-radius:12px;
        border:1px solid ${THEME.border}; background:rgba(255,255,255,0.03);
        color:${THEME.text}; cursor:pointer; font-size:12px; font-weight:600;
      }
      .tbo-btn:hover{background:rgba(255,255,255,0.06)}
      .tbo-btn-primary{border:none;
        background: linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95));
        color:#111;
      }
      .tbo-btn-primary:hover{filter: brightness(1.02)}
      .tbo-btn-muted{opacity:0.55; cursor:not-allowed;}
      .tbo-btn-muted:hover{background:rgba(255,255,255,0.03)}
      .tbo-btn-ghost{background:transparent;}
      .tbo-card{border:1px solid ${THEME.border}; background:rgba(255,255,255,0.02);
        border-radius:12px; padding:10px;
      }
      .tbo-divider{height:1px; background:${THEME.border}; margin:10px 0;}
      .tbo-status{font-size:11px; color:${THEME.muted}; line-height:1.3;}
      .tbo-status.ok{color:${THEME.ok};}
      .tbo-status.err{color:${THEME.danger};}
      .tbo-chip-row{display:flex; gap:8px; justify-content:space-between;}
      .tbo-chip-btn{flex:1; padding:7px 0; border-radius:10px; border:1px solid ${THEME.border};
        background:rgba(255,255,255,0.03); color:${THEME.text}; cursor:pointer; font-size:11px; font-weight:600;
      }
      .tbo-chip-btn:hover{background:rgba(240,166,74,0.10); border-color: rgba(240,166,74,0.22)}
      .tbo-checkbox{display:flex; align-items:center; gap:8px; font-size:12px; color:${THEME.text};}
      .tbo-checkbox input{accent-color:${THEME.accent};}
    `;
    document.documentElement.appendChild(style);
  }

  function removeExisting(id) {
    const old = document.getElementById(id);
    if (old) old.remove();
  }

  function clampToViewport(x, y, width = 360, height = 200) {
    const pad = 8;
    const maxX = Math.max(pad, window.innerWidth - width - pad);
    const maxY = Math.max(pad, window.innerHeight - height - pad);
    return {
      x: Math.min(Math.max(pad, x), maxX),
      y: Math.min(Math.max(pad, y), maxY)
    };
  }

  function createFloatingPanel({ id, title, width = 360, top = 120, right = 40, left = null } = {}) {
    ensureStyles();
    removeExisting(id);

    const panel = document.createElement("div");
    panel.id = id;
    panel.className = "tbo-panel";
    panel.style.width = `${width}px`;
    panel.style.top = `${top}px`;
    if (left !== null) {
      panel.style.left = `${left}px`;
      panel.style.right = "auto";
    } else {
      panel.style.right = `${right}px`;
    }

    const header = document.createElement("div");
    header.className = "tbo-header";

    const t = document.createElement("div");
    t.className = "tbo-title";
    t.textContent = title || "Panel";

    const actions = document.createElement("div");
    actions.className = "tbo-header-actions";

    const btnMin = document.createElement("button");
    btnMin.className = "tbo-icon-btn";
    btnMin.type = "button";
    btnMin.textContent = "−";

    const btnClose = document.createElement("button");
    btnClose.className = "tbo-icon-btn";
    btnClose.type = "button";
    btnClose.textContent = "✕";

    actions.appendChild(btnMin);
    actions.appendChild(btnClose);

    header.appendChild(t);
    header.appendChild(actions);

    const body = document.createElement("div");
    body.className = "tbo-body";

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);

    // Drag
    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("mousedown", (e) => {
      // don't start drag if clicking on action buttons
      if (e.target === btnMin || e.target === btnClose) return;
      dragging = true;
      header.style.cursor = "grabbing";
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const r = panel.getBoundingClientRect();
      const pos = clampToViewport(e.clientX - offsetX, e.clientY - offsetY, r.width, r.height);
      panel.style.left = `${pos.x}px`;
      panel.style.top = `${pos.y}px`;
      panel.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      dragging = false;
      header.style.cursor = "grab";
    });

    // Minimize
    let minimized = false;
    btnMin.addEventListener("click", () => {
      minimized = !minimized;
      body.style.display = minimized ? "none" : "block";
      btnMin.textContent = minimized ? "+" : "−";
    });

    // Close
    btnClose.addEventListener("click", () => {
      panel.remove();
    });

    return {
      panel,
      header,
      body,
      btnMin,
      btnClose,
      setTitle: (s) => (t.textContent = s),
      setHTML: (html) => (body.innerHTML = html),
      remove: () => panel.remove(),
      setMinimized: (v) => {
        minimized = !!v;
        body.style.display = minimized ? "none" : "block";
        btnMin.textContent = minimized ? "+" : "−";
      }
    };
  }

  window.TBO_UI = {
    THEME,
    createFloatingPanel
  };
})();
