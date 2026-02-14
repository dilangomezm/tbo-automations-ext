// alertsAssistant.js
registerAutomation("alerts_assistant", { name: "Alerts Assistant" }, function () {
  const ui = window.TBO_UI;
  if (!ui) return;

  const panelApi = ui.createFloatingPanel({
    id: "tbo_alerts_panel",
    title: "Alerts Assistant",
    width: 300,
    top: 120,
    right: 40
  });

  const $ = (sel) => panelApi.body.querySelector(sel);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function assignAlerts(keyword) {
    let assigned = 0;
    const rows = document.querySelectorAll("table tbody tr");
    rows.forEach((row) => {
      const text = (row.innerText || "").toLowerCase();
      if (!text.includes(keyword)) return;
      const btn = row.querySelector('button[data-testid="assign-to-me-button"]');
      if (btn) {
        btn.click();
        assigned++;
      }
    });
    alert(`✔ ${assigned} alerts assigned.`);
  }

  async function closeAlerts(keyword) {
    let closed = 0;
    const rows = document.querySelectorAll("table tbody tr");
    for (const row of rows) {
      const text = (row.innerText || "").toLowerCase();
      if (!text.includes(keyword)) continue;
      const menuBtn = row.querySelector('.MuiIconButton-root');
      if (!menuBtn) continue;
      menuBtn.click();
      await sleep(150);
      const closeOption = [...document.querySelectorAll(".MuiTypography-root")].find(
        (el) => (el.innerText || "").trim().toLowerCase() === "close"
      );
      if (closeOption) {
        closeOption.click();
        closed++;
      }
      await sleep(200);
    }
    alert(`✔ ${closed} alerts closed.`);
  }

  async function closeAssignedAlerts() {
    let closed = 0;
    const rows = document.querySelectorAll("table tbody tr");
    for (const row of rows) {
      const hasAssignBtn = row.querySelector('button[data-testid="assign-to-me-button"]');
      if (hasAssignBtn) continue;
      const menuBtn = row.querySelector('.MuiIconButton-root');
      if (!menuBtn) continue;
      menuBtn.click();
      await sleep(150);
      const closeOption = [...document.querySelectorAll(".MuiTypography-root")].find(
        (el) => (el.innerText || "").trim().toLowerCase() === "close"
      );
      if (closeOption) {
        closeOption.click();
        closed++;
      }
      await sleep(200);
    }
    alert(`✔ ${closed} assigned alerts closed.`);
  }

  const ROW_VALUES = [50, 100, 500, 1000];
  function renderRowsPerPage() {
    const chips = ROW_VALUES.map(
      (v) => `<button class="tbo-chip-btn" data-rows="${v}">${v}</button>`
    ).join("");

    return `
      <div class="tbo-divider"></div>
      <div class="tbo-label" style="margin-bottom:6px;">Rows per page</div>
      <div class="tbo-chip-row">${chips}</div>
    `;
  }

  function showMain() {
    panelApi.setHTML(`
      <div class="tbo-col" style="gap:10px;">
        <button class="tbo-btn tbo-card" id="assignBtn">Assign alerts by keyword</button>
        <button class="tbo-btn tbo-card" id="closeBtn">Close alerts by keyword</button>
        <button class="tbo-btn tbo-card" id="closeAssignedBtn">Close assigned alerts</button>
        ${renderRowsPerPage()}
      </div>
    `);

    $("#assignBtn").onclick = showAssign;
    $("#closeBtn").onclick = showClose;
    $("#closeAssignedBtn").onclick = async () => {
      await closeAssignedAlerts();
      showMain();
    };

    panelApi.body.querySelectorAll("[data-rows]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-rows");
        const select = document.querySelector('select[aria-label="rows per page"]');
        if (!select) return alert("Rows-per-page selector not found.");

        let option = [...select.options].find((o) => o.value == val || o.text == String(val));
        if (!option) {
          option = document.createElement("option");
          option.value = String(val);
          option.text = String(val);
          select.appendChild(option);
        }
        select.value = String(val);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function showAssign() {
    panelApi.setHTML(`
      <div class="tbo-col" style="gap:10px;">
        <div class="tbo-title" style="font-weight:600;">Assign alerts</div>
        <input class="tbo-input" id="kw" type="text" placeholder="Keyword" />
        <div class="tbo-row">
          <button class="tbo-btn tbo-btn-primary" id="go">Assign</button>
          <button class="tbo-btn" id="back">Back</button>
        </div>
        ${renderRowsPerPage()}
      </div>
    `);

    $("#back").onclick = showMain;
    $("#go").onclick = () => {
      const kw = ( $("#kw").value || "" ).trim().toLowerCase();
      if (!kw) return alert("Enter a keyword.");
      assignAlerts(kw);
      showMain();
    };

    panelApi.body.querySelectorAll("[data-rows]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-rows");
        const select = document.querySelector('select[aria-label="rows per page"]');
        if (!select) return alert("Rows-per-page selector not found.");
        let option = [...select.options].find((o) => o.value == val || o.text == String(val));
        if (!option) {
          option = document.createElement("option");
          option.value = String(val);
          option.text = String(val);
          select.appendChild(option);
        }
        select.value = String(val);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  function showClose() {
    panelApi.setHTML(`
      <div class="tbo-col" style="gap:10px;">
        <div class="tbo-title" style="font-weight:600;">Close alerts</div>
        <input class="tbo-input" id="kw" type="text" placeholder="Keyword" />
        <div class="tbo-row">
          <button class="tbo-btn tbo-btn-primary" id="go">Close</button>
          <button class="tbo-btn" id="back">Back</button>
        </div>
        ${renderRowsPerPage()}
      </div>
    `);

    $("#back").onclick = showMain;
    $("#go").onclick = async () => {
      const kw = ( $("#kw").value || "" ).trim().toLowerCase();
      if (!kw) return alert("Enter a keyword.");
      await closeAlerts(kw);
      showMain();
    };

    panelApi.body.querySelectorAll("[data-rows]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-rows");
        const select = document.querySelector('select[aria-label="rows per page"]');
        if (!select) return alert("Rows-per-page selector not found.");
        let option = [...select.options].find((o) => o.value == val || o.text == String(val));
        if (!option) {
          option = document.createElement("option");
          option.value = String(val);
          option.text = String(val);
          select.appendChild(option);
        }
        select.value = String(val);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  }

  showMain();
});
