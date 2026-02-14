// creatorBoost.js
// Automation: Creator of Boost (batch + single)

registerAutomation("creator_boost", { name: "Creator of Boost" }, function () {
  const LOG = "[TBO EXT][creator_boost]";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = (step, msg, extra) =>
    console.log(`${LOG}[${step}]`, msg, extra !== undefined ? extra : "");

  const norm = (s) =>
    (s || "").toString().replace(/\s+/g, " ").trim().toLowerCase();

  const clickEl = (el) => {
    if (!el) return false;
    try {
      el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      el.click();
      return true;
    } catch {
      return false;
    }
  };

  // Último diálogo visible (Create Prebuilt Bet, Details, etc.)
  const getActiveDialogRoot = () => {
    const dialogs = Array.from(
      document.querySelectorAll('[role="dialog"], .MuiDialog-root')
    ).filter((d) => d.offsetParent !== null); // visibles
    return dialogs[dialogs.length - 1] || document;
  };

  const findByTextExact = (text, root = document) => {
    const t = norm(text);
    if (!t) return null;
    const els = Array.from(root.querySelectorAll("*"));
    return els.find((el) => norm(el.textContent) === t) || null;
  };

  const findByTextIncludes = (text, root = document) => {
    const t = norm(text);
    if (!t) return null;
    const els = Array.from(root.querySelectorAll("*"));
    return els.find((el) => norm(el.textContent).includes(t)) || null;
  };

  const findLabel = (labelText, root = document) => {
    const t = norm(labelText);
    if (!t) return null;
    const labels = Array.from(root.querySelectorAll("label"));
    return (
      labels.find((el) => norm(el.textContent) === t) ||
      labels.find((el) => norm(el.textContent).includes(t)) ||
      null
    );
  };

  const findInputNearLabel = (labelEl, root = document) => {
    if (!labelEl) return null;
    const forId = labelEl.getAttribute("for");
    if (forId) {
      const direct = root.querySelector("#" + CSS.escape(forId));
      if (direct && direct.tagName === "INPUT") return direct;
    }
    const fcRoot =
      labelEl.closest(".MuiFormControl-root") ||
      labelEl.closest(".MuiFormGroup-root") ||
      labelEl.parentElement;
    if (!fcRoot) return null;

    return (
      fcRoot.querySelector("input[type='number']") ||
      fcRoot.querySelector("input:not([type])") ||
      fcRoot.querySelector("input")
    );
  };

  const setInputValue = (input, value) => {
    if (!input) return false;
    try {
      const desc = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      );
      const setter = desc && desc.set;
      if (setter) setter.call(input, value);
      else input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  };

  const retry = async (fn, { tries = 6, delay = 250, step = "RETRY" } = {}) => {
    let last = null;
    for (let i = 1; i <= tries; i++) {
      try {
        const res = await fn(i);
        if (res) return res;
        last = res;
      } catch (e) {
        last = e;
      }
      await sleep(delay);
      log(step, `Attempt ${i}/${tries} failed`);
    }
    return last;
  };

  // -------------------------------------------------
  // STEPS: PREBUILT FORM (Location/Brand, Name, Boost, Timing, Save)
  // -------------------------------------------------

  // NUEVO: versión basada en tu bookmarklet
  const stepLocationBrand = async () => {
    log("LB", "Selecting Location/Brand");

    const wrapper = document.querySelector(
      '[data-testid="location-brand-select"]'
    );
    if (!wrapper) {
      log("LB", "No wrapper [data-testid=location-brand-select]");
      return false;
    }

    const combo = wrapper.querySelector('[role="combobox"]');
    if (!combo) {
      log("LB", "No combobox inside wrapper");
      return false;
    }

    clickEl(combo);
    log("LB", "Opened Location/Brand dropdown");
    await sleep(300);

    const listboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
    const lb = listboxes[listboxes.length - 1];
    if (!lb) {
      log("LB", "No listbox");
      return false;
    }

    const options = Array.from(lb.querySelectorAll('[role="option"], li'));
    const targets = ["denmark/expekt", "denmark/leovegas"];

    options.forEach((opt) => {
      const txt = (opt.textContent || "").toLowerCase().replace(/\s+/g, " ").trim();
      const checkbox =
        opt.querySelector('input[type="checkbox"]') ||
        opt.querySelector("button") ||
        opt;
      const selected = opt.getAttribute("aria-selected") === "true";

      if (txt.includes("finland/expekt") && selected) {
        clickEl(checkbox);
        log("LB", "Deselected Finland/Expekt");
      }

      if (targets.some((tg) => txt.includes(tg))) {
        if (!selected) {
          clickEl(checkbox);
          log("LB", "Selected: " + txt);
        } else {
          log("LB", "Already selected: " + txt);
        }
      }
    });

    await sleep(300);

    try {
      const evEsc = new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true
      });
      (document.activeElement || combo).dispatchEvent(evEsc);
      combo.dispatchEvent(evEsc);
      log("LB", "Escape to close");
      await sleep(250);

      const expanded = combo.getAttribute("aria-expanded");
      log("LB", "aria-expanded=" + expanded);
      if (expanded === "true") {
        clickEl(combo);
        log("LB", "Extra click to close");
      }
    } catch {}

    await sleep(400);
    log("LB", "Done");
    return true;
  };

  // NUEVO: no tocar el nombre (dejarlo vacío)
  const stepPrebuiltName = async (root) => {
    log("NAME", "Skipping Prebuilt name (left empty)");
    return true;
  };

  const stepBoostType = async (root) => {
    log("BOOST", "Selecting Boost type");
    const boostLabel = findLabel("boost", root);
    if (!boostLabel) {
      log("BOOST", "Boost label not found");
      return false;
    }

    const fcRoot =
      boostLabel.closest(".MuiFormControl-root") || boostLabel.parentElement;

    const combo =
      fcRoot?.querySelector('[role="combobox"]') ||
      fcRoot?.querySelector('[role="button"][aria-haspopup="listbox"]');

    if (!combo) {
      log("BOOST", "Boost combobox not found");
      return false;
    }

    clickEl(combo);
    await sleep(250);

    const listboxes = Array.from(document.querySelectorAll('[role="listbox"]'));
    const lb = listboxes[listboxes.length - 1];
    if (!lb) {
      log("BOOST", "Listbox not found");
      return false;
    }

    const options = Array.from(lb.querySelectorAll('[role="option"], li'));
    const targetOpt = options.find((o) =>
      norm(o.textContent).includes("target margin")
    );
    if (!targetOpt) {
      log("BOOST", "Target margin option not found");
      return false;
    }

    clickEl(targetOpt);
    await sleep(200);
    log("BOOST", "Done");
    return true;
  };

  const stepFields = async (root, targetMarginPercentStr = "5") => {
    log("FIELDS", "Setting numeric fields");
    const fields = [
      { label: "min odds", value: "1.5" },
      { label: "max odds", value: "15" },
      { label: "target margin", value: targetMarginPercentStr },
      { label: "max stake limit", value: "70" },
      { label: "total stake limit", value: "50000" }
    ];

    for (const f of fields) {
      await retry(
        async () => {
          const lab = findLabel(f.label, root);
          if (!lab) return false;
          const input = findInputNearLabel(lab, root);
          if (!input) return false;
          setInputValue(input, f.value);
          log("FIELDS", `${f.label} = ${f.value}`);
          return true;
        },
        { tries: 8, delay: 220, step: `FIELDS:${f.label}` }
      );
    }

    return true;
  };

  // NUEVO: lógica de switches basada en tu bookmarklet
  const stepEventTiming = async (root) => {
    log("TIMING", "Handling Event Timing");

    const timingTrigger =
      findByTextExact("event timing", root) ||
      findByTextIncludes("event timing", root);

    if (timingTrigger) {
      clickEl(timingTrigger);
      await sleep(200);
      log("TIMING", "Opened Event Timing");
    } else {
      log("TIMING", "Event Timing trigger not found (maybe open)");
    }

    const toggleByLabel = async (labelText) => {
      const labelLower = labelText.toLowerCase();
      const labels = Array.from(
        root.querySelectorAll("label, span, div, p, strong")
      );
      const lab = labels.find(
        (el) => (el.textContent || "").trim().toLowerCase() === labelLower
      );
      if (!lab) {
        log("TIMING", `No texto ${labelText}`);
        return false;
      }

      const container = lab.closest("div");
      if (!container) {
        log("TIMING", `No contenedor ${labelText}`);
        return false;
      }

      const sw =
        container.querySelector('button[role="switch"]') ||
        container.querySelector('input[type="checkbox"]') ||
        container.querySelector("button");

      if (!sw) {
        log("TIMING", `No switch ${labelText}`);
        return false;
      }

      clickEl(sw);
      await sleep(120);
      log("TIMING", `Toggled: ${labelText}`);
      return true;
    };

    await toggleByLabel("Same as event start");
    await toggleByLabel("Show on Homepage");

    return true;
  };

  const stepSave = async (root) => {
    log("SAVE", "Searching Save button");
    const btns = Array.from(root.querySelectorAll("button,[role='button']"));
    const save =
      btns.find((b) => !b.disabled && norm(b.textContent) === "save") ||
      btns.find(
        (b) => !b.disabled && norm(b.textContent).includes("save")
      );

    if (!save) {
      log("SAVE", "Save button not found or disabled");
      return false;
    }

    clickEl(save);
    await sleep(700);

    const stillOpen = root.isConnected && root.offsetParent !== null;
    if (stillOpen) {
      log("SAVE", "Dialog still open after Save (maybe validation failed)");
      return false;
    }

    log("SAVE", "Clicked Save and dialog closed");
    return true;
  };

  const runSingleBoostFlow = async (targetMarginPercentStr = "5") => {
    const root = getActiveDialogRoot();
    await stepLocationBrand(root);
    await stepPrebuiltName(root); // ahora no escribe nada
    await stepBoostType(root);
    await stepFields(root, targetMarginPercentStr);
    await stepEventTiming(root);
    await stepSave(root);
  };

  // -------------------------------------------------
  // BATCH DESDE LISTA DE BETS
  // -------------------------------------------------

  const BOOST_TARGET = 0.15;
  const BOOST_MIN_OK = 0.14;
  const MIN_TM_DEC = 0.001;

  // Parser robusto para el JSON del tab "Theoretical margin details"
  const parseJsonFromElement = (el) => {
    if (!el) return null;

    let raw = el.textContent || el.value || "";
    raw = raw.trim();
    if (!raw) return null;

    const cleanedLines = raw
      .split(/\r?\n/)
      .filter((line) => {
        const t = line.trim();
        if (!t) return false;
        if (t.startsWith("[%]")) return false;
        if (t.startsWith("--")) return false;
        return true;
      });

    let cleaned = cleanedLines.join("\n");
    cleaned = cleaned.replace(/\[\%][^\n]*/g, "");

    const findFirstJsonSpan = (text) => {
      const firstBrace = text.indexOf("{");
      const firstBracket = text.indexOf("[");
      if (firstBrace === -1 && firstBracket === -1) return null;

      let start, openChar, closeChar;
      if (
        firstBracket !== -1 &&
        (firstBracket < firstBrace || firstBrace === -1)
      ) {
        start = firstBracket;
        openChar = "[";
        closeChar = "]";
      } else {
        start = firstBrace;
        openChar = "{";
        closeChar = "}";
      }

      let depth = 0;
      let end = -1;

      for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (ch === openChar) depth++;
        else if (ch === closeChar) {
          depth--;
          if (depth === 0) {
            end = i + 1;
            break;
          }
        }
      }

      if (end === -1) return null;
      return text.slice(start, end);
    };

    const span = findFirstJsonSpan(cleaned);
    if (!span) {
      log("JSON", "Could not find balanced JSON span");
      return null;
    }

    cleaned = span;

    log("JSON", `Raw length ${raw.length}, span length ${cleaned.length}`);

    try {
      const parsed = JSON.parse(cleaned);
      log("JSON", "Parsed OK, typeof:", typeof parsed);
      return parsed;
    } catch (e) {
      console.warn(LOG, "[JSON] parse error after cleaning", e);
      return null;
    }
  };

  const extractTmc = (parsed) => {
    let found = null;
    const visit = (node) => {
      if (!node || typeof node !== "object" || found) return;
      if (
        node.tmcCalculationConditions &&
        typeof node.tmcCalculationConditions === "object"
      ) {
        found = node.tmcCalculationConditions;
        return;
      }
      Object.values(node).forEach((v) => {
        if (typeof v === "object") visit(v);
      });
    };
    visit(parsed);
    log("JSON", "TMC found?", !!found);
    return found;
  };

  const computeTargetMarginPercentFromTmc = (tmc) => {
    if (!tmc) return { ok: false, reason: "No TMC data" };
    const O0 = Number(tmc.productCombinationSyncOdds);
    const impliedMargin = Number(tmc.impliedMargin);
    log("CALC", "O0 / impliedMargin", { O0, impliedMargin });

    if (!isFinite(O0) || O0 <= 1 || !isFinite(impliedMargin)) {
      return { ok: false, reason: "Invalid odds or implied margin" };
    }

    let refOdds = Number(tmc.productCombinationRefOdds);
    if (!isFinite(refOdds) || refOdds <= 0) {
      const od = tmc.outcomeData && Object.values(tmc.outcomeData)[0];
      if (od && od.refOdds) refOdds = Number(od.refOdds);
    }
    if (!isFinite(refOdds) || refOdds <= 0) refOdds = O0 * (1 + impliedMargin);
    log("CALC", "refOdds", refOdds);

    const O_target = O0 * (1 + BOOST_TARGET);
    let mIdeal = refOdds / O_target - 1;
    log("CALC", "O_target / mIdeal", { O_target, mIdeal });
    if (!isFinite(mIdeal)) {
      return { ok: false, reason: "Failed to compute ideal margin" };
    }

    const mCandidate = Math.max(mIdeal, MIN_TM_DEC);
    const O_final = refOdds / (1 + mCandidate);
    const boostReal = O_final / O0 - 1;
    log("CALC", "mCandidate / O_final / boostReal", {
      mCandidate,
      O_final,
      boostReal
    });
    if (!isFinite(boostReal)) {
      return { ok: false, reason: "Invalid boost result" };
    }

    if (boostReal < BOOST_MIN_OK) {
      return {
        ok: false,
        reason: `Boost below ${BOOST_MIN_OK * 100}% (got ${(boostReal *
          100).toFixed(2)}%)`
      };
    }

    const tmPercent = mCandidate * 100;
    const tmStr = Number(tmPercent.toFixed(3)).toString();
    return {
      ok: true,
      targetMarginPercentStr: tmStr,
      boostReal,
      refOdds,
      oddsOriginal: O0
    };
  };

  const findOpenBetRows = () => {
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    const result = [];
    rows.forEach((row) => {
      const statusCell = row.cells && row.cells[0];
      if (!statusCell) return;
      if (norm(statusCell.textContent) !== "open") return;

      let menuBtn =
        row.querySelector("button[aria-haspopup='menu']") ||
        row.querySelector("button[aria-label*='More']") ||
        row.querySelector("button[aria-label*='more']");

      if (!menuBtn) {
        const btns = Array.from(row.querySelectorAll("button,[role='button']"));
        if (btns.length) menuBtn = btns[btns.length - 1];
      }
      if (!menuBtn) return;

      result.push({ row, statusCell, menuBtn, index: result.length });
    });
    log("BATCH", `Rows with OPEN found: ${result.length}`);
    return result;
  };

  const getDynamicTargetMarginFromDetails = async (entry, idx) => {
    log("BATCH", `Opening Details for bet #${idx + 1}`);

    clickEl(entry.menuBtn);
    await sleep(250);

    const detailsItem = await retry(
      () => {
        const items = Array.from(
          document.querySelectorAll("li,[role='menuitem'],button")
        );
        return items.find((el) => norm(el.textContent) === "details") || false;
      },
      { tries: 8, delay: 200, step: `BATCH:detailsMenu:${idx + 1}` }
    );
    if (!detailsItem || detailsItem === true) {
      log("BATCH", "Details menu item not found");
      return { ok: false, reason: "No Details menu" };
    }

    clickEl(detailsItem);
    await sleep(400);

    const dialog = await retry(
      () =>
        document.querySelector('[role="dialog"]') ||
        document.querySelector(".MuiDialog-root") ||
        false,
      { tries: 10, delay: 200, step: `BATCH:dialog:${idx + 1}` }
    );
    if (!dialog || dialog === true) {
      log("BATCH", "Dialog not found");
      return { ok: false, reason: "No dialog" };
    }

    const tmTab =
      findByTextExact("Theoretical margin details", dialog) ||
      findByTextIncludes("Theoretical margin details", dialog);
    if (tmTab) {
      clickEl(tmTab);
      await sleep(300);
    } else {
      log("BATCH", "TM tab not found (maybe already selected)");
    }

    const jsonEl = await retry(
      () => {
        const preCandidates = Array.from(
          dialog.querySelectorAll("pre,textarea,code,div")
        );
        let best = null;
        let bestLen = 0;
        preCandidates.forEach((el) => {
          const txt = (el.textContent || el.value || "").toString();
          const len = txt.length;
          if (
            len > bestLen &&
            (txt.includes("tmcCalculationConditions") ||
              txt.includes("productCombinationSyncOdds"))
          ) {
            best = el;
            bestLen = len;
          }
        });
        if (best)
          log("JSON", "Found JSON element tag/len", {
            tag: best.tagName,
            len: bestLen
          });
        return best || false;
      },
      { tries: 10, delay: 250, step: `BATCH:json:${idx + 1}` }
    );
    if (!jsonEl || jsonEl === true) {
      log("BATCH", "JSON block not found");
      const closeBtn =
        dialog.querySelector("button[aria-label='Close']") ||
        dialog.querySelector("button[aria-label='close']");
      if (closeBtn) clickEl(closeBtn);
      return { ok: false, reason: "No JSON block" };
    }

    const parsed = parseJsonFromElement(jsonEl);
    if (!parsed) {
      log("BATCH", "Parsed JSON is null");
      const closeBtn =
        dialog.querySelector("button[aria-label='Close']") ||
        dialog.querySelector("button[aria-label='close']");
      if (closeBtn) clickEl(closeBtn);
      return { ok: false, reason: "JSON parse failed" };
    }

    const tmc = extractTmc(parsed);
    const res = computeTargetMarginPercentFromTmc(tmc);

    const closeBtn =
      dialog.querySelector("button[aria-label='Close']") ||
      dialog.querySelector("button[aria-label='close']");
    if (closeBtn) clickEl(closeBtn);
    await sleep(300);

    if (!res.ok) {
      log("BATCH", `Bet #${idx + 1} not boostable: ${res.reason}`);
      return { ok: false, reason: res.reason };
    }

    log(
      "BATCH",
      `Bet #${idx + 1}: TM=${res.targetMarginPercentStr}% → boost ≈ ${(res
        .boostReal * 100).toFixed(2)}%`
    );
    return {
      ok: true,
      targetMarginPercentStr: res.targetMarginPercentStr,
      boostReal: res.boostReal
    };
  };

  const createPrebuiltAndBoost = async (entry, idx, targetMarginPercentStr) => {
    log(
      "BATCH",
      `Creating Prebuilt for #${idx + 1} (TM=${targetMarginPercentStr}%)`
    );

    clickEl(entry.menuBtn);
    await sleep(250);

    const prebuiltItem = await retry(
      () => {
        const items = Array.from(
          document.querySelectorAll("li,[role='menuitem'],button")
        );
        return (
          items.find(
            (el) => norm(el.textContent) === "create prebuilt bet"
          ) || false
        );
      },
      { tries: 8, delay: 200, step: `BATCH:prebuiltMenu:${idx + 1}` }
    );
    if (!prebuiltItem || prebuiltItem === true) {
      log("BATCH", "Create Prebuilt Bet menu not found");
      return false;
    }

    clickEl(prebuiltItem);
    await sleep(600);

    await runSingleBoostFlow(targetMarginPercentStr);
    await sleep(600);

    return true;
  };

  // -------------------------------------------------
  // ORQUESTADOR
  // -------------------------------------------------

  const run = async () => {
    try {
      const root = getActiveDialogRoot();
      const inPrebuiltForm =
        !!(findLabel("boost", root) && findLabel("target margin", root));

      if (inPrebuiltForm && root !== document) {
        log("MODE", "Prebuilt form detected → single flow");
        await runSingleBoostFlow();
        log("DONE", "Single boost flow finished");
        return;
      }

      const openRows = findOpenBetRows();
      if (!openRows.length) {
        log("BATCH", "No OPEN bets with menu found");
        return;
      }

      log("BATCH", `Found ${openRows.length} OPEN bets`);

      let success = 0;
      let failed = 0;
      const failedInfo = [];

      for (let i = 0; i < openRows.length; i++) {
        const entry = openRows[i];

        const tmRes = await getDynamicTargetMarginFromDetails(entry, i);
        if (!tmRes.ok) {
          failed++;
          failedInfo.push({ index: i + 1, reason: tmRes.reason });
          continue;
        }

        const ok = await createPrebuiltAndBoost(
          entry,
          i,
          tmRes.targetMarginPercentStr
        );
        if (ok) success++;
        else {
          failed++;
          failedInfo.push({ index: i + 1, reason: "Failed in Prebuilt flow" });
        }
      }

      log("BATCH", `Finished. Success: ${success}, Failures: ${failed}`);
      if (failedInfo.length)
        console.log(LOG, "[BATCH] Failed detail:", failedInfo);
    } catch (e) {
      console.error(LOG, "Unhandled error:", e);
      throw e;
    }
  };

  return run();
});
