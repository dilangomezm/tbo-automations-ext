// translationTool.js
// Translation Tool (full UI refresh + extension-compatible)
// - NO auto-open on page load
// - Opens ONLY when invoked via window.registerAutomation()
// - Clean dark UI, draggable, minimize, close (X)
// - No "(Lite)" in title, no version pill, no "Close tool" button
// - Status starts empty
(() => {
  // Must exist in your extension runtime
  if (!window.registerAutomation) return;

  const PANEL_ID = "tbo-translation-tool";
  const POS_KEY = "tbo_translation_tool_pos_v2";

  // Import (Exact + Templates) with Swedish
  const USER_EXACT_KEY = "tbo_translation_user_base_exact_v3_sv"; // { enKey: {da,fi,pt,sv} }
  const USER_TPL_KEY = "tbo_translation_user_base_tpl_v3_sv"; // [{ enTpl, subtype, daTpl, fiTpl, ptTpl, svTpl }, ...]

  // ---------------- Helpers ----------------
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => (s || "").trim().toLowerCase();

  function setNativeValue(el, value) {
    if (!el) return;
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    desc?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function waitFor(selector, tries = 60, delay = 120) {
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

  // ---------------- Modal mapping (ignore input values) ----------------
  function getRowTextWithoutInputs(row) {
    try {
      const clone = row.cloneNode(true);
      clone.querySelectorAll("input, textarea").forEach((el) => el.remove());
      return norm(clone.textContent || "");
    } catch {
      return norm(row.textContent || "");
    }
  }

  function detectLangFromRow(row) {
    const txt = getRowTextWithoutInputs(row);
    const isEN = txt.includes("english") || txt.includes("inglés");
    const isDA = txt.includes("danish") || txt.includes("dansk");
    const isFI = txt.includes("finnish") || txt.includes("suomi");
    const isPT =
      txt.includes("portuguese") || txt.includes("português") || txt.includes("portugues");
    const isSV = txt.includes("swedish") || txt.includes("svenska");

    if (isEN) return "en";
    if (isDA) return "da";
    if (isFI) return "fi";
    if (isPT) return "pt";
    if (isSV) return "sv";
    return null;
  }

  function getModalFields() {
    const rows = Array.from(
      document.querySelectorAll(
        '[data-testid*="multilanguage-translations-popup"][data-testid*="row"]'
      )
    );
    const map = { en: null, da: null, fi: null, pt: null, sv: null };

    for (const row of rows) {
      const lang = detectLangFromRow(row);
      const input = row.querySelector("input, textarea");
      if (!lang || !input) continue;
      map[lang] = input;
    }
    return map;
  }

  function fieldsArePresent(fields) {
    // Swedish may exist or not
    return fields?.en && fields?.da && fields?.fi && fields?.pt;
  }

  // ---------------- Data store ----------------
  // Build CORE_EXACT from ordered pairs to avoid silent overwrites (duplicate keys in the sheet)
  function buildCoreExactFromPairs(pairs) {
    const out = {};
    const seen = new Set();
    const dupes = [];

    for (const [kRaw, v] of pairs) {
      const k = String(kRaw || "").trim();
      const kn = norm(k);
      if (!kn) continue;

      if (seen.has(kn)) {
        // keep FIRST occurrence to avoid unexpected changes
        dupes.push(k);
        continue;
      }
      seen.add(kn);

      out[k] = {
        da: v?.da ?? "",
        fi: v?.fi ?? "",
        pt: v?.pt ?? "",
        sv: v?.sv ?? "",
      };
    }

    if (dupes.length) {
      console.warn("[TranslationTool] Duplicate CORE keys ignored (kept first):", dupes);
    }
    return out;
  }

  // Embedded default base (Outcome → translations)
  const CORE_EXACT_PAIRS = [
    ["1st Quarter", { da: "1. Fjerdedel", fi: "1. Neljännes", pt: "1º Quadrante", sv: "1:a kvartalet" }],
    ["2nd Quarter", { da: "2. Fjerdedel", fi: "2. Neljännes", pt: "2º Quadrante", sv: "andra kvartalet" }],
    ["3rd Quarter", { da: "3. Fjerdedel", fi: "3. Neljännes", pt: "3º Quadrante", sv: "3:e kvartalet" }],
    ["4th Quarter", { da: "4. Fjerdedel", fi: "4. Neljännes", pt: "4º Quadrante", sv: "4:e kvartalet" }],
    ["Top Half", { da: "Øverste Halvdel", fi: "Ylempi Puolisko", pt: "Metade de Cima", sv: "Övre halvan" }],
    ["Bottom Half", { da: "Nederste Halvdel", fi: "Alempi Puolisko", pt: "Metade de Baixo", sv: "Nedre halvan" }],
    ["Runner Up", { da: "Sølvvinder", fi: "Kakkonen", pt: "Vice-campeão", sv: "Andra plats" }],
    ["Winner", { da: "Vinder", fi: "Voittaja", pt: "Vencedor", sv: "Vinnare" }],
    ["Semi Final", { da: "Semifinale", fi: "Välierä", pt: "Semifinal", sv: "Semifinal" }],
    ["Quarter Final", { da: "Kvartfinaler", fi: "Puolivälierät", pt: "Quartas de Final", sv: "Kvartsfinal" }],
    ["Round 2", { da: "2. runde", fi: "2. kierros", pt: "2ª Rodada", sv: "Omgång 2" }],
    ["Round 1", { da: "1. runde", fi: "1. kierros", pt: "1ª Rodada", sv: "Omgång 1" }],
    ["Round 3", { da: "3. runde", fi: "3. kierros", pt: "3ª Rodada", sv: "Omgång 3" }],
    ["Round 4", { da: "4. runde", fi: "4. kierros", pt: "4ª Rodada", sv: "Omgång 4" }],
    ["Yes", { da: "Ja", fi: "Kyllä", pt: "Sim", sv: "Ja" }],
    ["No", { da: "Nej", fi: "Ei", pt: "Não", sv: "Inga" }],
    ["Zero", { da: "Nul", fi: "Nolla", pt: "Zero", sv: "Noll" }],
    ["One", { da: "En", fi: "Yksi", pt: "Um", sv: "En" }],
    ["Two", { da: "To", fi: "Kaksi", pt: "Dois", sv: "Två" }],
    ["Three", { da: "Tre", fi: "Kolme", pt: "Três", sv: "Tre" }],
    ["Four", { da: "Fire", fi: "Neljä", pt: "Quatro", sv: "Fyra" }],
    ["Five", { da: "Fem", fi: "Viisi", pt: "Cinco", sv: "Fem" }],
    ["Six", { da: "Seks", fi: "Kuusi", pt: "Seis", sv: "Sex" }],
    ["Seven", { da: "Syv", fi: "Seitsemän", pt: "Sete", sv: "Sju" }],
    ["Eight", { da: "Otte", fi: "Kahdeksan", pt: "Oito", sv: "Åtta" }],
    ["Nine", { da: "Ni", fi: "Yhdeksän", pt: "Nove", sv: "Nio" }],
    ["Ten", { da: "Ti", fi: "Kymmenen", pt: "Dez", sv: "Tio" }],
    ["Double", { da: "Doubler", fi: "Nelinpeli", pt: "Duplas", sv: "Dubbel" }],
    ["Rest Of The World", { da: "Øvrige verden", fi: "Muu maailma", pt: "Resto do Mundo", sv: "Resten av världen" }],
    ["Europe", { da: "Europa", fi: "Eurooppa", pt: "Europa", sv: "Europa" }],
    ["0 Teams", { da: "0 Hold", fi: "0 Joukkueet", pt: "0 times", sv: "0 lag" }],
    ["1 Team", { da: "1 Hold", fi: "1 Joukkue", pt: "1 time", sv: "1 lag" }],
    ["2 Teams", { da: "2 Hold", fi: "2 Joukkueet", pt: "2 times", sv: "2 lag" }],
    ["Over", { da: "Over", fi: "Yli", pt: "Mais", sv: "Över" }],
    ["Under", { da: "Under", fi: "Alle", pt: "Menos", sv: "Under" }],
    ["Youth", { da: "Ungdom", fi: "Nuoret", pt: "Juvenil", sv: "Ungdomsturnering" }],
    ["Weekly Specials", { da: "Uge specials", fi: "Viikon erikoiset", pt: "Especiais da semana", sv: "Veckans specialerbjudanden" }],
    ["Season Specials", { da: "Sæson specials", fi: "Kauden erikoiset", pt: "Especiais da temporada", sv: "Säsongsspecialer" }],
    ["Away Teams", { da: "Udehold", fi: "Vierasjoukkueet", pt: "Times visitantes", sv: "Bortalag" }],
    ["Home Teams", { da: "Hjemmehold", fi: "Kotijoukkueet", pt: "Times da casa", sv: "Hemmalag" }],
    ["Tie", { da: "Uafgjort", fi: "Tasapeli", pt: "Empate", sv: "Slips" }],
    ["Round of 16", { da: "Ottendedelsfinaler", fi: "Neljännesvälierät", pt: "Oitavas de Final", sv: "Åttondelsfinal" }],
    ["Round of 32", { da: "Sekstendedelsfinaler", fi: "32 parhaan kierros", pt: "16 avos de final", sv: "Omgång 32" }],
    ["Group Stage", { da: "Gruppespil", fi: "Lohkovaihe", pt: "Fase de Grupos", sv: "Gruppspel" }],
    ["South America", { da: "Sydamerika", fi: "Etelä-Amerikka", pt: "América do Sul", sv: "Sydamerika" }],
    ["Africa", { da: "Afrika", fi: "Afrikka", pt: "África", sv: "Afrika" }],
    ["Asia", { da: "Asien", fi: "Aasia", pt: "Ásia", sv: "Asien" }],
    ["Oceania", { da: "Oceanien", fi: "Oseania", pt: "Oceania", sv: "Oceanien" }],
    ["AFC/NFC West", { da: "AFC/NFC West", fi: "AFC/NFC West", pt: "AFC/NFC West", sv: "AFC/NFC Väst" }],
    ["AFC/NFC East", { da: "AFC/NFC East", fi: "AFC/NFC East", pt: "AFC/NFC East", sv: "AFC/NFC Öst" }],
    ["AFC/NFC North", { da: "AFC/NFC North", fi: "AFC/NFC North", pt: "AFC/NFC North", sv: "AFC/NFC Nord" }],
    ["AFC/NFC South", { da: "AFC/NFC South", fi: "AFC/NFC South", pt: "AFC/NFC South", sv: "AFC/NFC Syd" }],
    ["Odd", { da: "Ulige", fi: "Pariton", pt: "Ímpar", sv: "Udda" }],
    ["Even", { da: "Lige", fi: "Parillinen", pt: "Par", sv: "Även" }],
    ["1st Practice", { da: "1. Træning", fi: "1. Harjoitukset", pt: "1º Treino Livre", sv: "1:a övningen" }],
    ["2nd Practice", { da: "2. Træning", fi: "2. Harjoitukset", pt: "2º Treino Livre", sv: "2:a övningen" }],
    ["3rd Practice", { da: "3. Træning", fi: "3. Harjoitukset", pt: "3º Treino Livre", sv: "3:e övningen" }],
    ["No Retirement", { da: "Ingen Udgåede", fi: "Ei Keskeytyksiä", pt: "Sem abandono", sv: "Ingen pensionering" }],
    ["5-10 Seconds", { da: "5-10 sekunder", fi: "5-10 sekuntia", pt: "5-10 segundos", sv: "5–10 sekunder" }],
    ["Under 5 Seconds", { da: "Under 5 sekunder", fi: "Alle 5 sekunnin", pt: "Menos de 5 segundos", sv: "Under 5 sekunder" }],
    ["Over 10 Seconds", { da: "Over 10 sekunder", fi: "Yli 10 sekuntia", pt: "Mais de 10 segundos", sv: "Över 10 sekunder" }],
    ["Other Country", { da: "Andet Land", fi: "Muu Maa", pt: "Outro país", sv: "Andra länder" }],
    ["Great Britain", { da: "Storbritannien", fi: "Iso-Britannia", pt: "Grã-Bretanha", sv: "Storbritannien" }],
    ["Australia", { da: "Australien", fi: "Australia", pt: "Austrália", sv: "Australien" }],
    ["France", { da: "Frankrig", fi: "Ranska", pt: "França", sv: "Frankrike" }],
    ["Spain", { da: "Spanien", fi: "Espanja", pt: "Espanha", sv: "Spanien" }],
    ["3 or More", { da: "3 eller flere", fi: "3 Tai Enemmän", pt: "3 ou mais", sv: "3 eller fler" }],
    ["Team X to beat Team Y", { da: "Team X Slår Team Y", fi: "Team X Voitti Team Y", pt: "Time X para vencer o Time Y", sv: "Lag X slår lag Y" }],
    ["Conference Finals", { da: "Konferencefinaler", fi: "Konferenssifinaalit", pt: "Finais de Conferência", sv: "Konferensfinaler" }],
    ["Second Round", { da: "Anden Runde", fi: "Toinen Kierros", pt: "Segunda Rodada", sv: "Andra omgången" }],
    ["First Round", { da: "Første Runde", fi: "Ensimmäinen kierros", pt: "Primeira Rodada", sv: "Första omgången" }],
    ["Games", { da: "Kampe", fi: "Ottelu", pt: "Jogos", sv: "Spel" }],
    ["Eleven or more", { da: "Elleve Eller Flere", fi: "Yksitoista Tai Enemmän", pt: "Onze ou mais", sv: "Elva eller fler" }],
    ["Wildcard Series", { da: "Wildcard-Runde", fi: "Wildcard-Kierros", pt: "Série Wildcard", sv: "Wildcard-serien" }],
    ["Divisional Series", { da: "Divisionsserie", fi: "Divisioonasarja", pt: "Série Divisional", sv: "Divisionsserie" }],
    ["League Championship Series", { da: "Ligaens Finale", fi: "Liigafinaalit", pt: "Final da Liga", sv: "Ligamästerskapsserien" }],
    ["American League", { da: "American League", fi: "American Leaguen", pt: "Liga Americana", sv: "Amerikanska ligan" }],
    ["National League", { da: "National League", fi: "National Leaguen", pt: "Liga Nacional", sv: "Nationella ligan" }],
    ["1st Round", { da: "1. Runde", fi: "1. kierroksen", pt: "1ª Rodada", sv: "1:a omgången" }],
    ["2nd Round", { da: "2. Runde", fi: "2. kierroksen", pt: "2ª Rodada", sv: "2:a omgången" }],
    ["3rd Round", { da: "3. Runde", fi: "3. kierroksen", pt: "3ª Rodada", sv: "3:e omgången" }],
    ["Eastern Conference", { da: "Østkonferencen", fi: "Itäinen Konferenssi", pt: "Conferência Leste", sv: "Östra konferensen" }],
    ["Western Conference", { da: "Vestkonferencen", fi: "Läntinen konferenssi", pt: "Conferência Oeste", sv: "Västra konferensen" }],
    ["Atlantic Division", { da: "Atlanterhavsdivisionen", fi: "Atlantin divisioona", pt: "Divisão Atlântica", sv: "Atlantdivisionen" }],
    ["Central Division", { da: "Central Divisionen", fi: "Keskinen divisioona", pt: "Divisão Central", sv: "Centrala divisionen" }],
    ["Pacific Division", { da: "Stillehavsdivisionen", fi: "Tyynenmeren divisioona", pt: "Divisão do Pacífico", sv: "Stillahavsdivisionen" }],
    ["Metropolitan Division", { da: "Metropolitan Divisionen", fi: "Metropolitan divisioona", pt: "Divisão Metropolitana", sv: "Storstadsdivisionen" }],
    ["Men", { da: "Mænd", fi: "Miehet", pt: "Masculino", sv: "Herrar" }],
    ["Women", { da: "Kvinder", fi: "Naiset", pt: "Feminino", sv: "Damer" }],
    ["Reserves", { da: "Reserver", fi: "Reservit", pt: "Reservas", sv: "Reservlag" }],
    ["(W)", { da: "(K)", fi: "(N)", pt: "(F)", sv: "(D)" }],
    ["U20", { da: "U20", fi: "U20", pt: "Sub-20", sv: "U20" }],
    ["U20W", { da: "U20K", fi: "U20N", pt: "Sub-20F", sv: "U20D" }],
    ["1 Shot", { da: "1 Skud", fi: "1 Laukaus", pt: "1 Tacadas", sv: "1 Skott" }],
    ["Play Off", { da: "Slutspil", fi: "Pudotuspelit", pt: "Playoff", sv: "Slutspel" }],
    ["4 Shots Or More", { da: "4 Skud Eller Flere", fi: "4 Laukausta Tai Enemmän", pt: "4 tacadas ou mais", sv: "4 skott eller fler" }],
    ["2 Shots", { da: "2 Skud", fi: "2 Laukausta", pt: "2 Tacadas", sv: "2 skott" }],
    ["3 Shots", { da: "3 Skud", fi: "3 Laukausta", pt: "3 Tacadas", sv: "3 skott" }],
    ["Mixed Double", { da: "Mixed Double", fi: "Sekanelinpeli", pt: "Duplas Mistas", sv: "Mixad dubbel" }],
    ["Equal", { da: "Lige", fi: "Tasan", pt: "Igual", sv: "Lika" }],
    ["Doubles", { da: "Doubler", fi: "Nelinpeli", pt: "Duplas", sv: "Dubbel" }],
  ];

  const CORE_EXACT = buildCoreExactFromPairs(CORE_EXACT_PAIRS);

  const CORE_TEMPLATES = [
    {
      enTpl: "Tournament X - Winner",
      subtype: "Tournament Winner",
      daTpl: "Tournament X - Vinder",
      fiTpl: "Tournament X - Voittaja",
      ptTpl: "Tournament X - Vencedor",
      svTpl: "Tournament X - Vinnare",
    },
    {
      enTpl: "Tournament X - Finalists",
      subtype: "Finalist",
      daTpl: "Tournament X - Finalister",
      fiTpl: "Tournament X - Finalistit",
      ptTpl: "Tournament X - Finalistas",
      svTpl: "Tournament X - Finalister",
    },
    {
      enTpl: "Tournament X - Stage of Elimination - Team X",
      subtype: "Elimination Round",
      daTpl: "Tournament X - Elimineringsrunde - Team X",
      fiTpl: "Tournament X - Pudotuspelivaihe - Team X",
      ptTpl: "Tournament X - Fase de Eliminação - Team X",
      svTpl: "Tournament X - Utslagningsrunda - Team X",
    },
  ];

  function loadUserExact() {
    try {
      const raw = localStorage.getItem(USER_EXACT_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  function saveUserExact(obj) {
    try {
      localStorage.setItem(USER_EXACT_KEY, JSON.stringify(obj));
    } catch {}
  }

  function loadUserTemplates() {
    try {
      const raw = localStorage.getItem(USER_TPL_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function saveUserTemplates(arr) {
    try {
      localStorage.setItem(USER_TPL_KEY, JSON.stringify(arr));
    } catch {}
  }

  function buildExactMap() {
    const user = loadUserExact();
    const merged = { ...CORE_EXACT, ...user };
    return new Map(Object.entries(merged).map(([k, v]) => [norm(k), v]));
  }

  let EXACT_MAP = buildExactMap();
  let EXACT_KEYS_BY_LEN = Array.from(EXACT_MAP.keys()).sort((a, b) => b.length - a.length);

  function rebuildExactIndex() {
    EXACT_MAP = buildExactMap();
    EXACT_KEYS_BY_LEN = Array.from(EXACT_MAP.keys()).sort((a, b) => b.length - a.length);
  }

  // ---------------- Template engine ----------------
  const TOKEN_DEFS = [
    { token: "Tournament X", placeholder: "@@TOK_TOURN@@", base: "tournament" },
    { token: "Team X", placeholder: "@@TOK_TEAMX@@", base: "teamX" },
    { token: "Player X", placeholder: "@@TOK_PLAYERX@@", base: "playerX" },
    { token: "Player Y", placeholder: "@@TOK_PLAYERY@@", base: "playerY" },
    { token: "xth", placeholder: "@@TOK_XTH@@", base: "xth" },
    { token: "X", placeholder: "@@TOK_X@@", base: "X" },
  ].sort((a, b) => b.token.length - a.token.length);

  function compileTemplate(enTpl) {
    let raw = String(enTpl || "");
    for (const d of TOKEN_DEFS) {
      if (!raw.includes(d.token)) continue;
      raw = raw.split(d.token).join(d.placeholder);
    }

    const seq = [];
    const counters = Object.create(null);
    const phRe = /@@TOK_[A-Z0-9_]+@@/g;
    let m;
    while ((m = phRe.exec(raw)) !== null) {
      const ph = m[0];
      const def = TOKEN_DEFS.find((x) => x.placeholder === ph);
      if (!def) continue;
      counters[def.base] = (counters[def.base] || 0) + 1;
      seq.push({ token: def.token, groupName: `${def.base}_${counters[def.base]}` });
    }

    let s = escapeRegExp(raw);
    s = s.replace(/\s*\\-\s*/g, "\\s*[-–]\\s*");
    s = s.replace(/\bvs\b/gi, "vs\\.?");

    function groupFor(token, gname) {
      if (token === "Tournament X") return `(?<${gname}>.+?)`;
      if (token === "xth") return `(?<${gname}>\\d+(?:st|nd|rd|th)?)`;
      return `(?<${gname}>.+?)`;
    }

    for (const item of seq) {
      const placeholder = TOKEN_DEFS.find((d) => d.token === item.token)?.placeholder;
      if (!placeholder) continue;
      s = s.replace(new RegExp(escapeRegExp(placeholder)), groupFor(item.token, item.groupName));
    }

    return { re: new RegExp(`^${s}$`, "i"), seq };
  }

  function fillTemplateString(langTpl, seq, groups) {
    let out = String(langTpl || "");
    for (const item of seq) {
      const val = groups?.[item.groupName];
      if (val == null) continue;
      const idx = out.indexOf(item.token);
      if (idx >= 0) out = out.slice(0, idx) + String(val) + out.slice(idx + item.token.length);
    }
    return out;
  }

  let TEMPLATE_LIST = [];
  function rebuildTemplateIndex() {
    const user = loadUserTemplates();
    const byKey = new Map();
    for (const t of CORE_TEMPLATES) byKey.set(norm(t.enTpl), t);
    for (const t of user) byKey.set(norm(t.enTpl), t);

    const ordered = Array.from(byKey.values()).sort(
      (a, b) => String(b.enTpl || "").length - String(a.enTpl || "").length
    );

    TEMPLATE_LIST = ordered.map((t) => {
      const compiled = compileTemplate(t.enTpl);
      return { ...t, _re: compiled.re, _seq: compiled.seq };
    });
  }
  rebuildTemplateIndex();

  function matchTemplateSmart(srcText) {
    const s = String(srcText || "");
    for (const t of TEMPLATE_LIST) {
      const m = s.match(t._re);
      if (!m) continue;
      const g = m.groups || {};
      return {
        da: fillTemplateString(t.daTpl, t._seq, g),
        fi: fillTemplateString(t.fiTpl, t._seq, g),
        pt: fillTemplateString(t.ptTpl, t._seq, g),
        sv: fillTemplateString(t.svTpl || "", t._seq, g),
        subtype: t.subtype || "",
      };
    }
    return null;
  }

  // ---------------- Post-process: Round X ----------------
  function translateRoundInText(text, lang) {
    let s = String(text || "");

    s = s.replace(/\bRound\s*[-_]*\s*(\d+)\b/gi, (_m, d) => {
      const n = Number(d);
      if (!Number.isFinite(n)) return _m;
      if (lang === "da") return `${n}. Runde`;
      if (lang === "fi") return `${n}. kierros`;
      if (lang === "pt") return `${n}ª Rodada`;
      return `${n}:a Rundan`;
    });

    s = s.replace(/\b(\d+)(st|nd|rd|th)\s+Round\b/gi, (_m, d) => {
      const n = Number(d);
      if (!Number.isFinite(n)) return _m;
      if (lang === "da") return `${n}. Runde`;
      if (lang === "fi") return `${n}. kierros`;
      if (lang === "pt") return `${n}ª Rodada`;
      return `${n}:a Rundan`;
    });

    return s;
  }

  // ---------------- Exact replacement ----------------
  function applyExactToText(srcText, lang) {
    const original = String(srcText || "");
    let out = original;

    const exact = EXACT_MAP.get(norm(original));
    if (exact && exact[lang]) return exact[lang];

    for (const key of EXACT_KEYS_BY_LEN) {
      const tr = EXACT_MAP.get(key)?.[lang];
      if (!tr) continue;
      const re = new RegExp(
        `(^|[\\s\\-\\/:,()])(${escapeRegExp(key)})(?=$|[\\s\\-\\/:,()])`,
        "gi"
      );
      out = out.replace(re, (m, p1) => `${p1}${tr}`);
    }

    out = translateRoundInText(out, lang);
    return out;
  }

  function applyBaseAll(srcText) {
    const tpl = matchTemplateSmart(srcText);
    if (tpl) {
      const out = {
        da: translateRoundInText(tpl.da || "", "da"),
        fi: translateRoundInText(tpl.fi || "", "fi"),
        pt: translateRoundInText(tpl.pt || "", "pt"),
        sv: translateRoundInText(tpl.sv || "", "sv"),
        subtype: tpl.subtype || "",
      };
      if (!out.sv) out.sv = srcText;
      return { mode: "tpl", out };
    }

    const da = applyExactToText(srcText, "da");
    const fi = applyExactToText(srcText, "fi");
    const pt = applyExactToText(srcText, "pt");
    let sv = applyExactToText(srcText, "sv");
    if (!sv || norm(sv) === norm(srcText)) sv = srcText;

    return { mode: "exact", out: { da, fi, pt, sv, subtype: "" } };
  }

  // ---------------- Import parser (supports Outcome header) ----------------
  function parseTSVorCSV(text) {
    const lines = (text || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return { type: "none", rows: [] };

    const delim = lines[0].includes("\t") ? "\t" : ",";
    const rows = lines.map((l) => l.split(delim).map((c) => c.trim()));
    const header = rows[0].map(norm);

    const hasExact =
      (header.includes("english") || header.includes("outcome")) &&
      (header.includes("danish") || header.includes("dansk")) &&
      (header.includes("finnish") || header.includes("suomi")) &&
      (header.includes("portuguese") ||
        header.includes("português") ||
        header.includes("portugese"));

    const hasMarket =
      header.includes("market") &&
      (header.includes("respective subtype") || header.includes("subtype")) &&
      (header.includes("danish") || header.includes("dansk")) &&
      (header.includes("finnish") || header.includes("suomi")) &&
      (header.includes("portuguese") ||
        header.includes("português") ||
        header.includes("portugese"));

    if (hasMarket) return { type: "market", rows, header: true };
    if (hasExact) return { type: "exact", rows, header: true };

    // no header: 5 columns exact (EN DA FI PT SV) or 6 market (Market Subtype DA FI PT SV)
    const colCount = rows[0].length;
    if (colCount >= 6) return { type: "market", rows, header: false };
    if (colCount >= 5) return { type: "exact", rows, header: false };
    if (colCount >= 4) return { type: "exact", rows, header: false }; // legacy without sv
    return { type: "none", rows: [] };
  }

  function importData(text) {
    const parsed = parseTSVorCSV(text);
    if (parsed.type === "none") return { kind: "none" };

    if (parsed.type === "exact") {
      const start = parsed.header ? 1 : 0;
      const rows = parsed.rows;
      const header = parsed.header ? rows[0].map(norm) : [];
      const idx = (name) => (parsed.header ? header.indexOf(norm(name)) : -1);

      const userExact = loadUserExact();
      let added = 0,
        updated = 0;

      for (let i = start; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 4) continue;

        let en, da, fi, pt, sv;

        if (parsed.header) {
          // English can be "English" or "Outcome"
          en = r[idx("english")];
          if (!en) en = r[idx("outcome")];

          da = r[idx("danish")] ?? r[idx("dansk")];
          fi = r[idx("finnish")] ?? r[idx("suomi")];
          pt =
            r[idx("portuguese")] ?? r[idx("português")] ?? r[idx("portugese")];
          sv = r[idx("swedish")] ?? r[idx("svenska")];
        } else {
          [en, da, fi, pt, sv] = r;
        }

        const key = norm(en);
        if (!key) continue;

        const existed = !!userExact[key];
        userExact[key] = { da: da || "", fi: fi || "", pt: pt || "", sv: sv || "" };
        if (existed) updated++;
        else added++;
      }

      saveUserExact(userExact);
      rebuildExactIndex();
      return { kind: "exact", added, updated, total: Object.keys(userExact).length };
    }

    if (parsed.type === "market") {
      const start = parsed.header ? 1 : 0;
      const rows = parsed.rows;
      const header = parsed.header ? rows[0].map(norm) : [];
      const idx = (name) => (parsed.header ? header.indexOf(norm(name)) : -1);

      const current = loadUserTemplates();
      const byKey = new Map(current.map((t) => [norm(t.enTpl), t]));
      let added = 0,
        updated = 0;

      for (let i = start; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 5) continue;

        let enTpl, subtype, daTpl, fiTpl, ptTpl, svTpl;

        if (parsed.header) {
          enTpl = r[idx("market")];
          subtype = r[idx("respective subtype")] ?? r[idx("subtype")] ?? "";
          daTpl = r[idx("danish")] ?? r[idx("dansk")] ?? "";
          fiTpl = r[idx("finnish")] ?? r[idx("suomi")] ?? "";
          ptTpl =
            r[idx("portuguese")] ??
            r[idx("português")] ??
            r[idx("portugese")] ??
            "";
          svTpl = r[idx("swedish")] ?? r[idx("svenska")] ?? "";
        } else {
          [enTpl, subtype, daTpl, fiTpl, ptTpl, svTpl] = r;
        }

        if (!enTpl) continue;

        const key = norm(enTpl);
        const obj = {
          enTpl,
          subtype: subtype || "",
          daTpl: daTpl || "",
          fiTpl: fiTpl || "",
          ptTpl: ptTpl || "",
          svTpl: svTpl || "",
        };

        const existed = byKey.has(key);
        byKey.set(key, obj);
        if (existed) updated++;
        else added++;
      }

      const merged = Array.from(byKey.values());
      saveUserTemplates(merged);
      rebuildTemplateIndex();
      return { kind: "market", added, updated, total: merged.length };
    }

    return { kind: "none" };
  }

  // ---------------- UI ----------------
  function ensureStyles() {
    const ID = "tbo-translation-tool-style";
    if (document.getElementById(ID)) return;
    const style = document.createElement("style");
    style.id = ID;
    style.textContent = `
      #${PANEL_ID} { font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif; }
      #${PANEL_ID} * { box-sizing: border-box; }
      #${PANEL_ID} .tt-panel{
        position: fixed;
        top: 90px;
        right: 24px;
        width: 420px;
        max-width: calc(100vw - 40px);
        background: #13161D;
        color: #E6E8EE;
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.45);
        z-index: 999999;
        overflow: hidden;
      }
      #${PANEL_ID} .tt-header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding: 10px 12px;
        background: linear-gradient(90deg, rgba(240,166,74,0.18), rgba(240,166,74,0.04));
        border-bottom: 1px solid rgba(255,255,255,0.10);
        cursor: move;
        user-select: none;
      }
      #${PANEL_ID} .tt-title{
        font-size: 13px;
        font-weight: 650;
        letter-spacing: .2px;
      }
      #${PANEL_ID} .tt-actions{
        display:flex;
        align-items:center;
        gap: 8px;
      }
      #${PANEL_ID} .tt-iconbtn{
        width: 28px;
        height: 24px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.03);
        color: rgba(230,232,238,0.9);
        cursor: pointer;
        display:flex;
        align-items:center;
        justify-content:center;
        font-weight: 750;
        line-height: 1;
      }
      #${PANEL_ID} .tt-iconbtn:hover{
        border-color: rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.05);
      }

      #${PANEL_ID} .tt-body{
        padding: 12px;
      }

      #${PANEL_ID} .tt-section{
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 14px;
        padding: 10px;
      }

      #${PANEL_ID} .tt-sectiontitle{
        font-size: 11px;
        font-weight: 650;
        color: rgba(230,232,238,0.70);
        margin-bottom: 8px;
      }

      #${PANEL_ID} .tt-grid{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      #${PANEL_ID} .tt-btn{
        width: 100%;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 12px;
        font-weight: 650;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.03);
        color: #E6E8EE;
        cursor: pointer;
        user-select: none;
        transition: transform 80ms ease, border-color 120ms ease, background 120ms ease;
      }
      #${PANEL_ID} .tt-btn:hover{
        border-color: rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.05);
      }
      #${PANEL_ID} .tt-btn:active{ transform: translateY(1px); }

      #${PANEL_ID} .tt-btnprimary{
        border: 1px solid rgba(255,255,255,0.10);
        color: #111;
        background: linear-gradient(
          180deg,
          rgba(240,166,74,0.95) 0%,
          rgba(200,133,51,0.95) 100%
        );
      }
      #${PANEL_ID} .tt-btnprimary:hover{ filter: brightness(1.02); }

      #${PANEL_ID} .tt-status{
        margin-top: 10px;
        font-size: 11px;
        line-height: 1.35;
        padding: 10px;
        border-radius: 14px;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.10);
        color: rgba(230,232,238,0.75);
        white-space: pre-wrap;
        min-height: 56px;
      }

      #${PANEL_ID} .tt-status.empty{
        min-height: 0;
        padding: 0;
        border: none;
        background: transparent;
      }
    `;
    document.head.appendChild(style);
  }

  function openPanel() {
    // Prevent duplicates
    const existing = document.getElementById(PANEL_ID);
    if (existing) {
      existing.style.display = "block";
      return existing;
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

    const headerActions = document.createElement("div");
    headerActions.className = "tt-actions";

    const btnMin = document.createElement("button");
    btnMin.className = "tt-iconbtn";
    btnMin.title = "Minimize";
    btnMin.type = "button";
    btnMin.textContent = "–";

    const btnX = document.createElement("button");
    btnX.className = "tt-iconbtn";
    btnX.title = "Close";
    btnX.type = "button";
    btnX.textContent = "×";

    headerActions.appendChild(btnMin);
    headerActions.appendChild(btnX);

    header.appendChild(title);
    header.appendChild(headerActions);

    const body = document.createElement("div");
    body.className = "tt-body";

    // Actions section
    const sec = document.createElement("div");
    sec.className = "tt-section";

    const secTitle = document.createElement("div");
    secTitle.className = "tt-sectiontitle";
    secTitle.textContent = "Actions";

    const grid = document.createElement("div");
    grid.className = "tt-grid";

    const bImport = document.createElement("button");
    bImport.className = "tt-btn";
    bImport.type = "button";
    bImport.textContent = "Import base";

    const bLoad = document.createElement("button");
    bLoad.className = "tt-btn";
    bLoad.type = "button";
    bLoad.textContent = "Load from modal";

    const bAll = document.createElement("button");
    bAll.className = "tt-btn tt-btnprimary";
    bAll.type = "button";
    bAll.textContent = "All (Base)";

    const bInsert = document.createElement("button");
    bInsert.className = "tt-btn";
    bInsert.type = "button";
    bInsert.textContent = "Insert into modal";

    grid.appendChild(bImport);
    grid.appendChild(bLoad);
    grid.appendChild(bAll);
    grid.appendChild(bInsert);

    sec.appendChild(secTitle);
    sec.appendChild(grid);

    // Status (empty by default)
    const statusEl = document.createElement("div");
    statusEl.className = "tt-status empty";
    statusEl.textContent = "";

    body.appendChild(sec);
    body.appendChild(statusEl);

    panel.appendChild(header);
    panel.appendChild(body);
    root.appendChild(panel);
    document.body.appendChild(root);

    // Restore position
    try {
      const saved = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        panel.style.left = `${saved.x}px`;
        panel.style.top = `${saved.y}px`;
        panel.style.right = "auto";
      }
    } catch {}

    // Drag
    let dragging = false,
      offsetX = 0,
      offsetY = 0;

    header.addEventListener("mousedown", (e) => {
      // allow clicks on header buttons without dragging
      const t = e.target;
      if (t && (t === btnMin || t === btnX)) return;

      dragging = true;
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
      const y = Math.max(
        0,
        Math.min(window.innerHeight - 40, e.clientY - offsetY)
      );
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      panel.style.right = "auto";
    });

    window.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      try {
        const rect = panel.getBoundingClientRect();
        localStorage.setItem(POS_KEY, JSON.stringify({ x: rect.left, y: rect.top }));
      } catch {}
    });

    // Minimize
    let minimized = false;
    btnMin.onclick = () => {
      minimized = !minimized;
      body.style.display = minimized ? "none" : "block";
      btnMin.textContent = minimized ? "▢" : "–";
    };

    // Close
    btnX.onclick = () => root.remove();

    // Status helpers
    const setStatus = (msg) => {
      const t = String(msg || "");
      statusEl.textContent = t;
      if (!t.trim()) statusEl.classList.add("empty");
      else statusEl.classList.remove("empty");
    };

    // State
    let lastFields = null;
    let lastEnglish = "";
    let lastOut = null;

    // Buttons
    bImport.onclick = () => {
      const example =
        `Outcome\tDanish\tFinnish\tPortuguese\tSwedish\n` +
        `1st Quarter\t1. Fjerdedel\t1. Neljännes\t1º Quadrante\t1:a kvartalet\n\n` +
        `English\tDanish\tFinnish\tPortuguese\tSwedish\n` +
        `Yes\tJa\tKyllä\tSim\tJa\n\n` +
        `Market\tRespective Subtype\tDanish\tFinnish\tPortuguese\tSwedish\n` +
        `Tournament X - Finalists\tFinalist\tTournament X - Finalister\tTournament X - Finalistit\tTournament X - Finalistas\tTournament X - Finalister`;

      const txt = prompt(
        "Paste TSV/CSV copied from Google Sheets/Excel.\n\nExample:\n" + example,
        ""
      );
      if (!txt) return setStatus("Import cancelled.");

      const res = importData(txt);
      if (res.kind === "none") return setStatus("Could not detect format. Paste TSV/CSV with full columns.");
      setStatus("Import OK:\n" + JSON.stringify(res, null, 2));
    };

    bLoad.onclick = async () => {
      setStatus("...");
      const anyRow = await waitFor(
        '[data-testid*="multilanguage-translations-popup"][data-testid*="row"]'
      );
      if (!anyRow) return setStatus("Modal not found. Open it and retry.");

      const fields = getModalFields();
      if (!fieldsArePresent(fields)) return setStatus("Could not map EN/DA/FI/PT/SV in the modal.");

      lastFields = fields;
      lastEnglish = (fields.en.value || "").trim();
      setStatus("Loaded from modal." + (lastEnglish ? `\nEN: ${lastEnglish}` : ""));
    };

    bAll.onclick = async () => {
      if (!lastFields) {
        const anyRow = await waitFor(
          '[data-testid*="multilanguage-translations-popup"][data-testid*="row"]',
          10,
          100
        );
        if (!anyRow) return setStatus("Modal not found. Open it and retry.");
        const fields = getModalFields();
        if (!fieldsArePresent(fields)) return setStatus("Could not map EN/DA/FI/PT/SV in the modal.");
        lastFields = fields;
        lastEnglish = (fields.en.value || "").trim();
      }

      if (!lastEnglish) lastEnglish = (lastFields.en.value || "").trim();
      if (!lastEnglish) return setStatus("EN is empty.");

      const res = applyBaseAll(lastEnglish);
      lastOut = res.out;

      setStatus(
        "Translation ready (Base). Click Insert into modal.\n" +
          `DA: ${lastOut.da}\n` +
          `FI: ${lastOut.fi}\n` +
          `PT: ${lastOut.pt}\n` +
          `SV: ${lastOut.sv}`
      );
    };

    bInsert.onclick = async () => {
      const anyRow = await waitFor(
        '[data-testid*="multilanguage-translations-popup"][data-testid*="row"]',
        10,
        100
      );
      if (!anyRow) return setStatus("Modal not found. Open it and retry.");

      const fields = getModalFields();
      if (!fieldsArePresent(fields)) return setStatus("Could not map EN/DA/FI/PT/SV in the modal.");

      if (!lastOut) {
        const en = (fields.en.value || "").trim();
        if (!en) return setStatus("EN is empty.");
        lastOut = applyBaseAll(en).out;
      }

      setNativeValue(fields.da, lastOut.da ?? "");
      setNativeValue(fields.fi, lastOut.fi ?? "");
      setNativeValue(fields.pt, lastOut.pt ?? "");
      if (fields.sv) setNativeValue(fields.sv, lastOut.sv ?? (fields.en.value || ""));

      setStatus("Inserted into the modal. Now press Save.");
    };

    // Start empty
    setStatus("");

    return root;
  }

  // ---------------- Register automation (NO auto-open) ----------------
  window.registerAutomation("translationTool", { name: "Translation Tool" }, async () => {
    try {
      openPanel();
      return { ok: true };
    } catch (err) {
      console.error("[translationTool] Error:", err);
      return { ok: false, error: err?.message ? String(err.message) : String(err) };
    }
  });
})();
