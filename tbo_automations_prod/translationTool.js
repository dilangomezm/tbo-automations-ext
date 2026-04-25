// translationTool.js
// Base-driven translations with Gemini fallback
// Final fix: case-insensitive template tokens + safe long-market template matching
(() => {
  const PANEL_ID = "tbo-translation-tool";
  const CACHE_KEY = "tbo_translations_cache_v10";
  const GEMINI_CACHE_KEY = "tbo_gemini_cache_v1";
  const GEMINI_COOLDOWN_MS = 1200;
  const GEMINI_MODEL = "gemini-2.5-flash";

  const SHEET_URL =
    "https://script.google.com/a/macros/leovegas.com/s/AKfycbwCS3E0zXO7XrHjPRUUotGSZchQgm3leZuROFg9irBFeePBtXj14WwTbL1PxsydmtBiXg/exec";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function stripAccents(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const norm = (s) => stripAccents(s || "").trim().toLowerCase();

  const LANGUAGE_ALIASES = {
    en_CA: ["canadian english", "canada english", "english canada", "english (canada)", "english - canada", "en-ca", "en_ca"],
    en: ["english", "ingles", "inglés"],
    da: ["danish", "dansk"],
    fi: ["finnish", "suomi"],
    fr: ["french", "francais", "français"],
    pt: ["portuguese", "portugues", "português", "portoguese"],
    sv: ["swedish", "svenska", "swdish"],
  };

  const SOURCE_LANG = "en";
  const GEMINI_LANGS = ["da", "fi", "pt", "sv", "fr"];
  let SHEET_LANG_KEYS = new Set(["da", "fi", "pt", "sv", "fr"]);

  function detectLanguageKey(labelText) {
    const text = norm(labelText);
    if (!text) return null;

    const orderedKeys = Object.keys(LANGUAGE_ALIASES).sort((a, b) => {
      const longestA = Math.max(...LANGUAGE_ALIASES[a].map((x) => norm(x).length));
      const longestB = Math.max(...LANGUAGE_ALIASES[b].map((x) => norm(x).length));
      return longestB - longestA;
    });

    for (const langKey of orderedKeys) {
      const aliases = LANGUAGE_ALIASES[langKey] || [];
      if (aliases.some((alias) => text.includes(norm(alias)))) return langKey;
    }

    return null;
  }

  function getTranslationLangKeys() {
    return Array.from(new Set([...SHEET_LANG_KEYS, ...GEMINI_LANGS])).filter((lang) => lang !== SOURCE_LANG);
  }

  let GEMINI_KEY = null;
  let lastGeminiAt = 0;

  function setNativeValue(el, value) {
    if (!el) return;
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function waitFor(selector, tries = 40, delay = 150) {
    for (let i = 0; i < tries; i++) {
      const el = document.querySelector(selector);
      if (el) return el;
      await sleep(delay);
    }
    return null;
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function detectLangFromRow(row) {
    const clone = row.cloneNode(true);
    clone.querySelectorAll("input, textarea").forEach((el) => el.remove());
    return detectLanguageKey(clone.textContent || "");
  }

  function getModalFields() {
    const rows = Array.from(
      document.querySelectorAll('[data-testid*="multilanguage-translations-popup"][data-testid*="row"]')
    );

    const map = {};

    for (const row of rows) {
      const lang = detectLangFromRow(row);
      const input = row.querySelector("input, textarea");
      if (lang && input) map[lang] = input;
    }

    return map;
  }

  let EXACT_MAP = new Map();
  let EXACT_KEYS_BY_LEN = [];
  let TEMPLATE_LIST = [];

  function normalizeText(s) {
    return String(s || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeDashSpacing(text) {
    return normalizeText(String(text || "").replace(/\s*[-–]\s*/g, " - "));
  }

  function getLookupKey(text) {
    return normalizeDashSpacing(String(text || "")).trim().toLowerCase();
  }

  function rebuildExactIndexFromObject(obj) {
    EXACT_MAP = new Map(Object.entries(obj || {}));
    EXACT_KEYS_BY_LEN = Array.from(EXACT_MAP.keys()).sort((a, b) => b.length - a.length);
  }

  const TOKEN_DEFS = [
    { token: "Tournament X", key: "tournament_x", pattern: ".+?" },
    { token: "Tournament Y", key: "tournament_y", pattern: ".+?" },
    { token: "Competition X", key: "competition_x", pattern: ".+?" },
    { token: "Competition Y", key: "competition_y", pattern: ".+?" },
    { token: "Player X", key: "player_x", pattern: ".+?" },
    { token: "Player Y", key: "player_y", pattern: ".+?" },
    { token: "Team X", key: "team_x", pattern: ".+?" },
    { token: "Team Y", key: "team_y", pattern: ".+?" },
    { token: "Stage X", key: "stage_x", pattern: "\\d+(?:st|nd|rd|th)?|.+?" },
    { token: "Round X", key: "round_x", pattern: "\\d+(?:st|nd|rd|th)?|.+?" },
    { token: "Quarter X", key: "quarter_x", pattern: "\\d+(?:st|nd|rd|th)?|.+?" },
    { token: "Set X", key: "set_x", pattern: "\\d+(?:st|nd|rd|th)?|.+?" },
    { token: "Map X", key: "map_x", pattern: "\\d+(?:st|nd|rd|th)?|.+?" },
    { token: "Selection X", key: "selection_x", pattern: ".+?" },
    { token: "Market X", key: "market_x", pattern: ".+?" },
    { token: "Number X", key: "number_x", pattern: "\\d+(?:\\.\\d+)?" },
    { token: "xth", key: "xth", pattern: "\\d+(?:st|nd|rd|th)?" },

    // Legacy fallback. Keep last. Avoid using this in new templates.
    { token: "X", key: "generic_x", pattern: ".+?", legacy: true },
  ].sort((a, b) => b.token.length - a.token.length);

  function hasTemplateToken(text) {
    const s = String(text || "").toLowerCase();
    return TOKEN_DEFS.some((t) => s.includes(String(t.token).toLowerCase()));
  }

  function findNextTokenOccurrence(text, fromIndex) {
    const lower = String(text || "").toLowerCase();
    let best = null;

    for (const def of TOKEN_DEFS) {
      const tokenLower = String(def.token).toLowerCase();
      const idx = lower.indexOf(tokenLower, fromIndex);
      if (idx < 0) continue;

      if (!best || idx < best.index || (idx === best.index && def.token.length > best.def.token.length)) {
        best = { index: idx, def };
      }
    }

    return best;
  }

  function compileTemplate(enTpl) {
    const raw = normalizeDashSpacing(enTpl);
    const seq = [];
    const counters = Object.create(null);

    let cursor = 0;
    let pattern = "";

    while (cursor < raw.length) {
      const found = findNextTokenOccurrence(raw, cursor);

      if (!found) {
        pattern += escapeRegExp(raw.slice(cursor));
        break;
      }

      if (found.index > cursor) {
        pattern += escapeRegExp(raw.slice(cursor, found.index));
      }

      const def = found.def;
      counters[def.key] = (counters[def.key] || 0) + 1;
      const groupName = `${def.key}_${counters[def.key]}`;

      pattern += `(?<${groupName}>${def.pattern})`;

      seq.push({
        token: def.token,
        key: def.key,
        groupName,
        pattern: def.pattern,
      });

      cursor = found.index + def.token.length;
    }

    pattern = pattern.replace(/\\ /g, "\\s+");
    pattern = pattern.replace(/\\-+/g, "[-–]");
    pattern = pattern.replace(/\\s\+[-–]\\s\+/g, "\\s*[-–]\\s*");

    return {
      re: new RegExp(`^${pattern}$`, "i"),
      seq,
    };
  }

  function fillTemplateString(langTpl, seq, groups) {
    let out = String(langTpl || "");

    for (const item of seq) {
      const val = groups?.[item.groupName];
      if (val == null) continue;

      // Replace Tournament X / tournament x / PLAYER X etc.
      const re = new RegExp(escapeRegExp(item.token), "gi");
      out = out.replace(re, String(val));
    }

    return out;
  }

  function rebuildTemplateIndex() {
    TEMPLATE_LIST = [];

    for (const [enKey, trObj] of EXACT_MAP.entries()) {
      const en = normalizeDashSpacing(enKey);
      if (!en || !hasTemplateToken(en)) continue;

      const compiled = compileTemplate(en);

      TEMPLATE_LIST.push({
        en,
        ...(trObj || {}),
        _re: compiled.re,
        _seq: compiled.seq,
      });
    }

    TEMPLATE_LIST.sort((a, b) => String(b.en || "").length - String(a.en || "").length);
  }

  function rebuildAllIndexesFromObject(obj) {
    rebuildExactIndexFromObject(obj);
    rebuildTemplateIndex();
  }

  function buildIndexFromSheet(rows) {
    const out = {};
    if (!rows || rows.length < 2) return;

    const header = rows[0] || [];
    const headerLangByIndex = {};

    for (let c = 0; c < header.length; c++) {
      const lang = detectLanguageKey(header[c]);
      if (lang) headerLangByIndex[c] = lang;
    }

    const sourceIndex = Object.entries(headerLangByIndex).find(([, lang]) => lang === SOURCE_LANG)?.[0];

    if (sourceIndex == null) {
      throw new Error("English column not found in Google Sheet.");
    }

    SHEET_LANG_KEYS = new Set(Object.values(headerLangByIndex).filter((lang) => lang && lang !== SOURCE_LANG));

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 2) continue;

      const en = r[Number(sourceIndex)];
      if (!en) continue;

      const translations = {};

      for (const [colIndex, lang] of Object.entries(headerLangByIndex)) {
        if (!lang || lang === SOURCE_LANG) continue;
        translations[lang] = r[Number(colIndex)] || "";
      }

      out[getLookupKey(en)] = translations;
    }

    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        _meta: {
          sheetLangKeys: Array.from(SHEET_LANG_KEYS),
          savedAt: Date.now(),
        },
        rows: out,
      })
    );

    rebuildAllIndexesFromObject(out);
  }

  function loadFromCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");

      if (cached?.rows && typeof cached.rows === "object") {
        SHEET_LANG_KEYS = new Set(cached?._meta?.sheetLangKeys || ["da", "fi", "pt", "sv", "fr"]);
        rebuildAllIndexesFromObject(cached.rows);
        return;
      }

      SHEET_LANG_KEYS = new Set(["da", "fi", "pt", "sv", "fr"]);
      rebuildAllIndexesFromObject(cached || {});
    } catch {
      rebuildAllIndexesFromObject({});
    }
  }

  loadFromCache();

  let LAST_TRANSLATION_CONTEXT = {
    rawSource: "",
    changedIndexes: [],
    storedValues: {
      en: "",
      en_CA: "",
      da: "",
      fi: "",
      pt: "",
      sv: "",
      fr: "",
    },
    result: null,
  };

  function splitMarketParts(text) {
    return normalizeDashSpacing(text)
      .split(/\s[-–]\s/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function sanitizeGeminiText(s) {
    return String(s || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function detectChangedIndexes(originalText, result) {
    const original = sanitizeGeminiText(originalText);
    if (!original) return [];

    const originalParts = splitMarketParts(original);
    if (!originalParts.length) return [];

    const langs = getTranslationLangKeys();
    const changedIndexes = [];

    for (let i = 0; i < originalParts.length; i++) {
      const srcPart = originalParts[i];
      let changed = false;

      for (const lang of langs) {
        const translatedText = sanitizeGeminiText(result?.[lang] || "");
        if (!translatedText) continue;

        const translatedParts = splitMarketParts(translatedText);
        const translatedPart = translatedParts[i];

        if (!translatedPart) continue;

        if (norm(translatedPart) !== norm(srcPart)) {
          changed = true;
          break;
        }
      }

      if (changed) changedIndexes.push(i);
    }

    return changedIndexes;
  }

  function pickPartsByIndexes(text, indexes) {
    const clean = sanitizeGeminiText(text);
    if (!clean) return "";

    const parts = splitMarketParts(clean);
    if (!parts.length) return clean;
    if (!indexes?.length) return clean;

    const picked = indexes.map((i) => parts[i]).filter(Boolean);
    return picked.length ? picked.join(" - ") : clean;
  }

  function buildStoredValues(originalText, result) {
    const changedIndexes = detectChangedIndexes(originalText, result);
    const storedValues = { en: pickPartsByIndexes(originalText, changedIndexes) };

    for (const lang of getTranslationLangKeys()) {
      storedValues[lang] = pickPartsByIndexes(result?.[lang] || "", changedIndexes);
    }

    return { changedIndexes, storedValues };
  }

  function getSwedishOrdinalWord(n) {
    const map = { 1: "Första", 2: "Andra", 3: "Tredje", 4: "Fjärde" };
    return map[n] || `${n}:e`;
  }

  function getFrenchQuarterOrdinal(n) {
    if (n === 1) return "1er";
    return `${n}ème`;
  }

  function splitMarketPartsForTranslation(text) {
    return normalizeDashSpacing(text)
      .split(/\s[-–]\s/)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  function renderNumberedLabel(kind, n, lang) {
    if (!Number.isFinite(n)) return null;

    const k = String(kind || "").toLowerCase();

    if (k === "quarter") {
      if (lang === "da") return `${n}. Fjerdedel`;
      if (lang === "fi") return `${n}. Neljännes`;
      if (lang === "pt") return `${n}º Quadrante`;
      if (lang === "sv") return `${getSwedishOrdinalWord(n)} kvarten`;
      if (lang === "fr") return `${getFrenchQuarterOrdinal(n)} Quart`;
    }

    if (k === "round") {
      if (lang === "da") return `${n}. runde`;
      if (lang === "fi") return `${n}. kierros`;
      if (lang === "pt") return `${n}ª Rodada`;
      if (lang === "sv") return `omgång ${n}`;
      if (lang === "fr") return `Tour ${n}`;
    }

    if (k === "stage") {
      if (lang === "da") return `${n}. etape`;
      if (lang === "fi") return `${n}. etapin`;
      if (lang === "pt") return `Etapa ${n}`;
      if (lang === "sv") return `Etapp ${n}`;
      if (lang === "fr") return `Étape ${n}`;
    }

    if (k === "set") {
      if (lang === "da") return `${n}. sæt`;
      if (lang === "fi") return `${n}. erä`;
      if (lang === "pt") return `${n}º Set`;
      if (lang === "sv") return `Set ${n}`;
      if (lang === "fr") return `${n}er Set`;
    }

    if (k === "map") {
      if (lang === "da") return `Map ${n}`;
      if (lang === "fi") return `Kartta ${n}`;
      if (lang === "pt") return `Mapa ${n}`;
      if (lang === "sv") return `Karta ${n}`;
      if (lang === "fr") return `Carte ${n}`;
    }

    if (k === "leg") {
      if (lang === "da") return `${n}. leg`;
      if (lang === "fi") return `${n}. leg`;
      if (lang === "pt") return `${n}ª Perna`;
      if (lang === "sv") return `Leg ${n}`;
      if (lang === "fr") return `Leg ${n}`;
    }

    if (k === "heat") {
      if (lang === "da") return `${n}. heat`;
      if (lang === "fi") return `${n}. erä`;
      if (lang === "pt") return `${n}ª Eliminatória`;
      if (lang === "sv") return `Heat ${n}`;
      if (lang === "fr") return `Série ${n}`;
    }

    return null;
  }

  function translateSingleNumberedLabel(segment, lang) {
    const s = normalizeDashSpacing(segment);

    const patterns = [
      { kind: "quarter", re1: /^Quarter\s*[-_]*\s*(\d+)$/i, re2: /^(\d+)(st|nd|rd|th)\s+Quarter$/i },
      { kind: "round", re1: /^Round\s*[-_]*\s*(\d+)$/i, re2: /^(\d+)(st|nd|rd|th)\s+Round$/i },
      { kind: "stage", re1: /^Stage\s*[-_]*\s*(\d+)$/i, re2: /^(\d+)(st|nd|rd|th)\s+Stage$/i },
      { kind: "set", re1: /^Set\s*[-_]*\s*(\d+)$/i, re2: /^(\d+)(st|nd|rd|th)\s+Set$/i },
      { kind: "map", re1: /^Map\s*[-_]*\s*(\d+)$/i, re2: /^(\d+)(st|nd|rd|th)\s+Map$/i },
      { kind: "leg", re1: /^Leg\s*[-_]*\s*(\d+)$/i, re2: /^(\d+)(st|nd|rd|th)\s+Leg$/i },
      { kind: "heat", re1: /^Heat\s*[-_]*\s*(\d+)$/i, re2: /^(\d+)(st|nd|rd|th)\s+Heat$/i },
    ];

    for (const p of patterns) {
      let m = s.match(p.re1);
      if (m) {
        const out = renderNumberedLabel(p.kind, Number(m[1]), lang);
        if (out) return out;
      }

      m = s.match(p.re2);
      if (m) {
        const out = renderNumberedLabel(p.kind, Number(m[1]), lang);
        if (out) return out;
      }
    }

    return null;
  }

  function translateNumberedLabelInsideText(text, lang) {
    let s = String(text || "");

    const patterns = [
      { kind: "quarter", re1: /\bQuarter\s*[-_]*\s*(\d+)\b/gi, re2: /\b(\d+)(st|nd|rd|th)\s+Quarter\b/gi },
      { kind: "round", re1: /\bRound\s*[-_]*\s*(\d+)\b/gi, re2: /\b(\d+)(st|nd|rd|th)\s+Round\b/gi },
      { kind: "stage", re1: /\bStage\s*[-_]*\s*(\d+)\b/gi, re2: /\b(\d+)(st|nd|rd|th)\s+Stage\b/gi },
      { kind: "set", re1: /\bSet\s*[-_]*\s*(\d+)\b/gi, re2: /\b(\d+)(st|nd|rd|th)\s+Set\b/gi },
      { kind: "map", re1: /\bMap\s*[-_]*\s*(\d+)\b/gi, re2: /\b(\d+)(st|nd|rd|th)\s+Map\b/gi },
      { kind: "leg", re1: /\bLeg\s*[-_]*\s*(\d+)\b/gi, re2: /\b(\d+)(st|nd|rd|th)\s+Leg\b/gi },
      { kind: "heat", re1: /\bHeat\s*[-_]*\s*(\d+)\b/gi, re2: /\b(\d+)(st|nd|rd|th)\s+Heat\b/gi },
    ];

    for (const p of patterns) {
      s = s.replace(p.re1, (_m, d) => renderNumberedLabel(p.kind, Number(d), lang) || _m);
      s = s.replace(p.re2, (_m, d) => renderNumberedLabel(p.kind, Number(d), lang) || _m);
    }

    return s;
  }

  function postProcessTranslatedText(text, lang) {
    return translateNumberedLabelInsideText(text, lang);
  }

  function translateTemplateSegment(segment, lang) {
    const s = normalizeDashSpacing(segment);

    for (const tpl of TEMPLATE_LIST) {
      const m = s.match(tpl._re);
      if (!m) continue;

      const langTpl = tpl?.[lang];
      if (!langTpl) return s;

      return fillTemplateString(langTpl, tpl._seq, m.groups || {});
    }

    return null;
  }

  function translateExactSegment(segment, lang) {
    const clean = normalizeDashSpacing(segment);
    const exact = EXACT_MAP.get(getLookupKey(clean));

    if (exact && exact[lang]) return exact[lang];

    let out = clean;

    for (const key of EXACT_KEYS_BY_LEN) {
      const row = EXACT_MAP.get(key);
      const tr = row?.[lang];
      if (!tr) continue;

      const src = normalizeDashSpacing(key);

      if (hasTemplateToken(src)) continue;

      const re = new RegExp(`(^|[\\s\\-–/:,()])(${escapeRegExp(src)})(?=$|[\\s\\-–/:,()])`, "gi");
      out = out.replace(re, (_m, p1) => `${p1}${tr}`);
    }

    return out;
  }

  function translateSegment(segment, lang) {
    const clean = normalizeDashSpacing(segment);

    const directNumbered = translateSingleNumberedLabel(clean, lang);
    if (directNumbered) return directNumbered;

    const exact = EXACT_MAP.get(getLookupKey(clean));
    if (exact?.[lang]) return postProcessTranslatedText(exact[lang], lang);

    const tpl = translateTemplateSegment(clean, lang);
    if (tpl) return postProcessTranslatedText(tpl, lang);

    const partial = translateExactSegment(clean, lang);
    if (norm(partial) !== norm(clean)) return postProcessTranslatedText(partial, lang);

    const generic = postProcessTranslatedText(clean, lang);
    if (norm(generic) !== norm(clean)) return generic;

    return clean;
  }

  function reorderTranslatedMarketParts(parts, lang) {
    const out = [...parts];

    if (lang === "da" && out.length >= 3) {
      for (let i = 0; i < out.length - 1; i++) {
        const current = String(out[i] || "").trim();
        const next = String(out[i + 1] || "").trim();

        const stageMatch = current.match(/^(\d+)\.\s*etape$/i);
        const winnerMatch = next.match(/^vinder$/i);

        if (stageMatch && winnerMatch) {
          out.splice(i, 2, `vinder ${stageMatch[1]}. etape`);
          break;
        }
      }
    }

    return out;
  }

  function translateMarket(srcText, lang) {
    const original = normalizeDashSpacing(srcText);
    if (!original) return "";

    const fullExact = EXACT_MAP.get(getLookupKey(original));
    if (fullExact?.[lang]) return postProcessTranslatedText(fullExact[lang], lang);

    // Critical for long markets:
    // Tournament X - Regular Season - Total Receiving Yards - Player X
    const fullTemplate = translateTemplateSegment(original, lang);
    if (fullTemplate && norm(fullTemplate) !== norm(original)) {
      return postProcessTranslatedText(fullTemplate, lang);
    }

    const parts = splitMarketPartsForTranslation(original);
    if (!parts.length) return original;

    let translatedParts = parts.map((part) => translateSegment(part, lang));
    translatedParts = reorderTranslatedMarketParts(translatedParts, lang);

    return translatedParts.join(" - ");
  }

  function applyBaseAll(srcText) {
    const original = normalizeDashSpacing(srcText);
    const out = { mode: "generic" };

    for (const lang of getTranslationLangKeys()) {
      out[lang] = translateMarket(original, lang);
    }

    return out;
  }

  function refreshGeminiKey() {
    GEMINI_KEY = String(GEMINI_KEY || "").trim() || null;
    return GEMINI_KEY;
  }

  function clearGeminiKey() {
    GEMINI_KEY = null;
  }

  function loadGeminiCache() {
    try {
      const raw = localStorage.getItem(GEMINI_CACHE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveGeminiCache(cache) {
    try {
      localStorage.setItem(GEMINI_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }

  function postFixPT(s) {
    return String(s || "")
      .replace(/\bremates\b/gi, "chutes")
      .replace(/\bremate\b/gi, "chute")
      .replace(/\bfinalizações\b/gi, "chutes")
      .replace(/\bfinalização\b/gi, "chute");
  }

  function tryParseGeminiJson(rawText) {
    let raw = String(rawText || "").trim();
    if (!raw) return null;

    raw = raw.replace(/^\uFEFF/, "").trim();

    try {
      return JSON.parse(raw);
    } catch {}

    const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i) || raw.match(/```\s*([\s\S]*?)\s*```/i);

    if (fenced) {
      try {
        return JSON.parse(fenced[1].trim());
      } catch {}
    }

    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) {
      const candidate = raw.slice(first, last + 1).trim();
      try {
        return JSON.parse(candidate);
      } catch {}
    }

    return null;
  }

  function buildGeminiPrompt(text) {
    return `
You are a sportsbook market translation engine.

Translate the input from English into:
- Danish (da)
- Finnish (fi)
- Portuguese (pt)
- Swedish (sv)
- French (fr)

Rules:
- Use sportsbook and betting-market terminology.
- Keep tournament names unchanged.
- Keep competition names unchanged.
- Keep player names unchanged.
- Keep team names unchanged.
- Keep proper nouns unchanged.
- Keep numbers unchanged unless a natural ordinal form is required in the target language.
- Translate only the market wording that should be localized.
- Do not add explanations.
- Do not add notes.
- Do not add markdown.
- Do not wrap the answer in code fences.
- Return exactly one JSON object and nothing else.

Required output format:
{"da":"","fi":"","pt":"","sv":"","fr":""}

Input:
${text}
    `.trim();
  }

  function sanitizeGeminiResult(srcText, parsed, fromCache = false) {
    const original = sanitizeGeminiText(srcText);

    return {
      da: sanitizeGeminiText(parsed?.da || original),
      fi: sanitizeGeminiText(parsed?.fi || original),
      pt: postFixPT(sanitizeGeminiText(parsed?.pt || original)),
      sv: sanitizeGeminiText(parsed?.sv || original),
      fr: sanitizeGeminiText(parsed?.fr || original),
      mode: "gemini",
      _cached: !!fromCache,
    };
  }

  function buildGeminiCacheKey(text) {
    return norm(sanitizeGeminiText(text));
  }

  function countChangedTranslations(original, result) {
    const src = norm(normalizeDashSpacing(original));
    if (!result) return 0;

    let count = 0;
    for (const lang of getTranslationLangKeys()) {
      const val = norm(normalizeDashSpacing(result[lang] || ""));
      if (val && val !== src) count++;
    }
    return count;
  }

  function hasAnyTranslationChanged(original, result) {
    return countChangedTranslations(original, result) > 0;
  }

  async function translateWithGemini(text) {
    const sourceText = sanitizeGeminiText(text);
    const apiKey = refreshGeminiKey();

    if (!apiKey) throw new Error("No Gemini API key loaded.");

    const cacheKey = buildGeminiCacheKey(sourceText);
    const cache = loadGeminiCache();

    if (cache[cacheKey] && cache[cacheKey].da != null) {
      return sanitizeGeminiResult(sourceText, cache[cacheKey], true);
    }

    const now = Date.now();
    const wait = GEMINI_COOLDOWN_MS - (now - lastGeminiAt);
    if (wait > 0) await sleep(wait);
    lastGeminiAt = Date.now();

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

    const body = {
      contents: [{ role: "user", parts: [{ text: buildGeminiPrompt(sourceText) }] }],
      generationConfig: {
        temperature: 0,
        topP: 0.1,
        topK: 1,
        maxOutputTokens: 400,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            da: { type: "STRING" },
            fi: { type: "STRING" },
            pt: { type: "STRING" },
            sv: { type: "STRING" },
            fr: { type: "STRING" },
          },
          required: ["da", "fi", "pt", "sv", "fr"],
        },
      },
    };

    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const rawHttpText = await r.text().catch(() => "");

    if (!r.ok) {
      if (r.status === 429) throw new Error("Gemini 429 (quota/cooldown).");
      throw new Error(`Gemini error (${r.status}): ${rawHttpText || r.statusText}`);
    }

    let data;
    try {
      data = JSON.parse(rawHttpText);
    } catch {
      throw new Error("Gemini returned non-JSON HTTP payload.");
    }

    if (data?.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data?.candidates?.[0];
    const modelText = candidate?.content?.parts?.map((p) => p?.text || "").join("") || "";

    let parsed = tryParseGeminiJson(modelText);

    if (!parsed && candidate?.content?.parts?.[0]?.text) {
      parsed = tryParseGeminiJson(candidate.content.parts[0].text);
    }

    if (!parsed) throw new Error("Gemini did not return valid JSON.");

    const result = sanitizeGeminiResult(sourceText, parsed, false);

    const cacheToSave = loadGeminiCache();
    cacheToSave[cacheKey] = {
      da: result.da,
      fi: result.fi,
      pt: result.pt,
      sv: result.sv,
      fr: result.fr,
      ts: Date.now(),
      source: "gemini",
      model: GEMINI_MODEL,
    };
    saveGeminiCache(cacheToSave);

    return result;
  }

  async function translateSmart(srcText) {
    const baseResult = applyBaseAll(srcText);
    const baseChanged = countChangedTranslations(srcText, baseResult);

    if (baseChanged >= 1) {
      return { ...baseResult, mode: "base" };
    }

    if (!refreshGeminiKey()) {
      return { ...baseResult, mode: "base-no-match-no-key" };
    }

    try {
      const geminiResult = await translateWithGemini(srcText);

      if (geminiResult && hasAnyTranslationChanged(srcText, geminiResult)) {
        return geminiResult;
      }

      return { ...baseResult, mode: "base-no-match-gemini-no-change" };
    } catch (err) {
      console.warn("Gemini fallback failed:", err);
      return {
        ...baseResult,
        mode: "base-no-match-gemini-failed",
        error: err?.message || String(err || "Unknown Gemini error"),
      };
    }
  }

  function ensureStyles() {
    if (document.getElementById(PANEL_ID + "-style")) return;
    const style = document.createElement("style");
    style.id = PANEL_ID + "-style";
    style.textContent = `
      #${PANEL_ID} { font-family: system-ui,-apple-system,sans-serif; box-sizing: border-box; }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .tt-panel{ position: fixed; top: 90px; right: 24px; width: 300px; background: #13161D; color: #E6E8EE; border: 1px solid rgba(255,255,255,0.10); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.45); z-index: 999999; }
      #${PANEL_ID} .tt-header{ display:flex; align-items:center; justify-content:space-between; padding: 10px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.10); cursor: move; user-select: none; }
      #${PANEL_ID} .tt-title{ font-size: 13px; font-weight: 600; cursor: pointer; }
      #${PANEL_ID} .tt-actions{ display:flex; gap: 4px; }
      #${PANEL_ID} .tt-iconbtn{ width: 26px; height: 26px; border-radius: 6px; border: 1px solid transparent; background: transparent; color: #E6E8EE; cursor: pointer; font-weight: bold; font-size: 13px;}
      #${PANEL_ID} .tt-iconbtn:hover{ background: rgba(255,255,255,0.1); }
      #${PANEL_ID} .tt-body{ padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      #${PANEL_ID} .tt-btn{ width: 100%; border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 600; border: 1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.03); color: #E6E8EE; cursor: pointer; transition: 0.1s; }
      #${PANEL_ID} .tt-btn:hover{ background: rgba(255,255,255,0.08); }
      #${PANEL_ID} .tt-btnprimary{ color: #111; background: linear-gradient(180deg, rgba(240,166,74,0.95) 0%, rgba(200,133,51,0.95) 100%); border: none; }
      #${PANEL_ID} .tt-btnprimary:hover{ filter: brightness(1.1); }
      #${PANEL_ID} .tt-btnadmin{ color: white; background: #b91c1c; border: none; display: none; }
      #${PANEL_ID} .tt-status{ font-size: 11px; padding: 8px; border-radius: 8px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.10); color: #aaa; white-space: pre-wrap; display: none; }
    `;
    document.head.appendChild(style);
  }

  function openPanel() {
    if (document.getElementById(PANEL_ID)) {
      document.getElementById(PANEL_ID).style.display = "block";
      return;
    }

    ensureStyles();

    const root = document.createElement("div");
    root.id = PANEL_ID;

    const panel = document.createElement("div");
    panel.className = "tt-panel";

    const header = document.createElement("div");
    header.className = "tt-header";

    const title = document.createElement("div");
    title.className = "tt-title";
    title.textContent = "Translation Tool";

    let iaClickCount = 0;
    let iaTimer = null;

    const headerActions = document.createElement("div");
    headerActions.className = "tt-actions";

    const btnSync = document.createElement("button");
    btnSync.className = "tt-iconbtn";
    btnSync.textContent = "🔄";
    btnSync.title = "Sync with Database";

    const btnMin = document.createElement("button");
    btnMin.className = "tt-iconbtn";
    btnMin.textContent = "–";

    const btnX = document.createElement("button");
    btnX.className = "tt-iconbtn";
    btnX.textContent = "×";

    const bPush = document.createElement("button");
    bPush.className = "tt-btn tt-btnadmin";
    bPush.textContent = "Push to Database";

    const statusEl = document.createElement("div");
    statusEl.className = "tt-status";

    const setStatus = (msg) => {
      statusEl.textContent = msg;
      statusEl.style.display = msg ? "block" : "none";
    };

    title.addEventListener("click", () => {
      iaClickCount++;
      clearTimeout(iaTimer);

      if (iaClickCount >= 4) {
        iaClickCount = 0;
        const newKey = prompt("🔧 AI MODE\nEnter Gemini API Key:", "");
        if (newKey !== null) {
          GEMINI_KEY = newKey.trim() || null;
          setStatus(GEMINI_KEY ? "API Key loaded for this session." : "API Key cleared.");
        }
      } else {
        iaTimer = setTimeout(() => {
          iaClickCount = 0;
        }, 1200);
      }
    });

    let popupWindow = null;

    if (!window._tboListener) {
      window.addEventListener("message", (e) => {
        if (e.data && e.data.source === "tbo-translation") {
          if (popupWindow && !popupWindow.closed) {
            popupWindow.close();
            popupWindow = null;
          }

          if (e.data.action === "sync") {
            buildIndexFromSheet(e.data.data);
            setStatus(`✅ Sync Complete: ${EXACT_MAP.size} terms loaded.`);
          }

          if (e.data.action === "add") {
            setStatus("✅ Term pushed to Cloud Database.");
          }
        }
      });
      window._tboListener = true;
    }

    let adminClickCount = 0;
    let adminTimer = null;

    btnMin.addEventListener("click", () => {
      adminClickCount++;
      clearTimeout(adminTimer);

      if (adminClickCount >= 4) {
        adminClickCount = 0;
        const isHidden = bPush.style.display === "none" || bPush.style.display === "";
        bPush.style.display = isHidden ? "block" : "none";
      } else {
        adminTimer = setTimeout(() => {
          adminClickCount = 0;
          const body = document.querySelector(`#${PANEL_ID} .tt-body`);
          body.style.display = body.style.display === "none" ? "flex" : "none";
        }, 400);
      }
    });

    headerActions.appendChild(btnSync);
    headerActions.appendChild(btnMin);
    headerActions.appendChild(btnX);

    header.appendChild(title);
    header.appendChild(headerActions);

    const body = document.createElement("div");
    body.className = "tt-body";

    const bAuto = document.createElement("button");
    bAuto.className = "tt-btn tt-btnprimary";
    bAuto.textContent = "Translate";

    btnSync.onclick = () => {
      setStatus("Syncing...");
      if (popupWindow && !popupWindow.closed) popupWindow.close();
      popupWindow = window.open(SHEET_URL, "tbo_sync", "width=400,height=300,left=200,top=200");
    };

    bAuto.onclick = async () => {
      const row = await waitFor(
        '[data-testid*="multilanguage-translations-popup"][data-testid*="row"]',
        15,
        100
      );

      if (!row) return setStatus("Modal not found. Please open it first.");

      const fields = getModalFields();
      if (!fields?.en) return setStatus("English field not found in TBO.");

      const enText = (fields.en.value || "").trim();
      if (!enText) return setStatus("English field is empty.");

      setStatus("Translating...");

      const result = await translateSmart(enText);
      const builtStore = buildStoredValues(enText, result);

      LAST_TRANSLATION_CONTEXT = {
        rawSource: enText,
        changedIndexes: builtStore.changedIndexes,
        storedValues: builtStore.storedValues,
        result,
      };

      for (const [lang, field] of Object.entries(fields)) {
        if (!field || lang === SOURCE_LANG) continue;
        setNativeValue(field, result?.[lang] || "");
      }

      if (result.error) {
        setStatus(`⚠️ ${result.mode}: ${result.error}`);
      } else {
        setStatus(`✅ Translated (${result.mode}${result._cached ? " / cache" : ""}): ${builtStore.storedValues.en}`);
      }
    };

    bPush.onclick = () => {
      const fields = getModalFields();
      const enText = fields?.en ? (fields.en.value || "").trim() : "";
      if (!enText) return setStatus("⚠️ No English term found to push.");

      const useStoredSource =
        LAST_TRANSLATION_CONTEXT?.rawSource &&
        norm(normalizeDashSpacing(LAST_TRANSLATION_CONTEXT.rawSource)) === norm(normalizeDashSpacing(enText)) &&
        LAST_TRANSLATION_CONTEXT?.storedValues;

      const valuesToStore = {
        en: useStoredSource ? sanitizeGeminiText(LAST_TRANSLATION_CONTEXT.storedValues.en) : sanitizeGeminiText(enText),
      };

      for (const lang of getTranslationLangKeys()) {
        const fieldValue = fields?.[lang] ? (fields[lang].value || "").trim() : "";
        valuesToStore[lang] = useStoredSource
          ? sanitizeGeminiText(LAST_TRANSLATION_CONTEXT.storedValues?.[lang] || "")
          : sanitizeGeminiText(fieldValue);
      }

      if (!valuesToStore.en) return setStatus("⚠️ No valid sourceToStore found to push.");

      setStatus(`Pushing: ${valuesToStore.en}`);

      if (popupWindow && !popupWindow.closed) popupWindow.close();

      const paramKeyByLang = {
        en: "en",
        en_CA: "en_CA",
        da: "da",
        fi: "fi",
        pt: "pt",
        sv: "sv",
        fr: "fr",
      };

      let queryParams = `?action=add`;

      for (const [lang, value] of Object.entries(valuesToStore)) {
        const paramKey = paramKeyByLang[lang] || lang;
        queryParams += `&${encodeURIComponent(paramKey)}=${encodeURIComponent(value || "")}`;
      }

      popupWindow = window.open(SHEET_URL + queryParams, "tbo_push", "width=400,height=300,left=200,top=200");
    };

    btnX.onclick = () => {
      clearGeminiKey();
      root.remove();
    };

    let dragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener("mousedown", (e) => {
      if (e.target.tagName === "BUTTON" || e.target === title) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = `${Math.max(0, e.clientX - offsetX)}px`;
      panel.style.top = `${Math.max(0, e.clientY - offsetY)}px`;
    });

    window.addEventListener("mouseup", () => {
      dragging = false;
    });

    body.appendChild(bAuto);
    body.appendChild(bPush);
    body.appendChild(statusEl);

    panel.appendChild(header);
    panel.appendChild(body);
    root.appendChild(panel);
    document.body.appendChild(root);
  }

  if (!window.registerAutomation) {
    openPanel();
  } else {
    window.registerAutomation(
      "translationTool",
      { name: "Translation Tool" },
      async () => {
        try {
          openPanel();
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      }
    );
  }
})();
