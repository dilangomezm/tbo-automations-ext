// NBAlertsMonster.js  (formerly BasketballMonsterNewsMonitor.js)
(() => {
  if (!window.registerAutomation) return;

  window.registerAutomation(
    "NBAlertsMonster",
    { name: "NBAlerts (Monster)" },
    async () => {
      try {
        // =========================
        // CONFIG
        // =========================
        let intervalMs = 10000; // default 10s (editable)
        const MAX_ITEMS = 40;

        const SITE_URL = "https://basketballmonster.com/playernews.aspx";

        const STORAGE_POS_KEY = "bm_news_panel_pos_v1";
        const STORAGE_VOL_KEY = "bm_news_alarm_vol_v1"; // 0..100

        // Matches in TBO (persistencia)
        const STORAGE_TBO_ROWS_KEY = "bm_tbo_matches_rows_v1";
        const STORAGE_TBO_COUNT_KEY = "bm_tbo_matches_count_v1"; // 1..20

        // Collapses
        const STORAGE_TBO_COLLAPSED_KEY = "bm_tbo_collapsed_v1"; // "0" | "1"
        const STORAGE_LATEST_COLLAPSED_KEY = "bm_latest_collapsed_v1"; // "0" | "1"
        const STORAGE_PANEL_MINIMIZED_KEY = "bm_panel_minimized_v1"; // "0" | "1"

        const nowStr = () => new Date().toLocaleTimeString();
        const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
        const up = (s) => norm(s).toUpperCase();
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

        // Team aliases (BasketballMonster sometimes uses PHO instead of PHX)
        const TEAM_ALIASES = {
          PHO: "PHX",
          PHX: "PHX",
        };

        const normTeam = (code) => {
          const c = up(code).replace(/[^A-Z]/g, "");
          return TEAM_ALIASES[c] || c;
        };

        const NBA_TEAMS = [
          { code: "ATL", name: "Atlanta Hawks" },
          { code: "BOS", name: "Boston Celtics" },
          { code: "BKN", name: "Brooklyn Nets" },
          { code: "CHA", name: "Charlotte Hornets" },
          { code: "CHI", name: "Chicago Bulls" },
          { code: "CLE", name: "Cleveland Cavaliers" },
          { code: "DAL", name: "Dallas Mavericks" },
          { code: "DEN", name: "Denver Nuggets" },
          { code: "DET", name: "Detroit Pistons" },
          { code: "GSW", name: "Golden State Warriors" },
          { code: "HOU", name: "Houston Rockets" },
          { code: "IND", name: "Indiana Pacers" },
          { code: "LAC", name: "LA Clippers" },
          { code: "LAL", name: "Los Angeles Lakers" },
          { code: "MEM", name: "Memphis Grizzlies" },
          { code: "MIA", name: "Miami Heat" },
          { code: "MIL", name: "Milwaukee Bucks" },
          { code: "MIN", name: "Minnesota Timberwolves" },
          { code: "NOP", name: "New Orleans Pelicans" },
          { code: "NYK", name: "New York Knicks" },
          { code: "OKC", name: "Oklahoma City Thunder" },
          { code: "ORL", name: "Orlando Magic" },
          { code: "PHI", name: "Philadelphia 76ers" },
          { code: "PHX", name: "Phoenix Suns" },
          { code: "POR", name: "Portland Trail Blazers" },
          { code: "SAC", name: "Sacramento Kings" },
          { code: "SAS", name: "San Antonio Spurs" },
          { code: "TOR", name: "Toronto Raptors" },
          { code: "UTA", name: "Utah Jazz" },
          { code: "WAS", name: "Washington Wizards" },
        ];

        const TEAM_BY_CODE = (() => {
          const m = new Map();
          for (const t of NBA_TEAMS) m.set(t.code, t.name);
          return m;
        })();

        const labelTeam = (code) => {
          const c = up(code);
          const name = TEAM_BY_CODE.get(c) || c;
          return `${name} (${c})`;
        };

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        const loadPos = () => {
          try {
            const raw = localStorage.getItem(STORAGE_POS_KEY);
            if (!raw) return null;
            const p = JSON.parse(raw);
            if (typeof p?.top !== "number" || typeof p?.left !== "number") return null;
            return p;
          } catch {
            return null;
          }
        };

        const savePos = (top, left) => {
          try {
            localStorage.setItem(STORAGE_POS_KEY, JSON.stringify({ top, left }));
          } catch {}
        };

        // Default volume: 10%
        const loadVol = () => {
          try {
            const raw = localStorage.getItem(STORAGE_VOL_KEY);
            if (raw == null) return 10;
            const n = Number(raw);
            if (!Number.isFinite(n)) return 10;
            return clamp(Math.round(n), 0, 100);
          } catch {
            return 10;
          }
        };

        const saveVol = (n) => {
          try {
            localStorage.setItem(STORAGE_VOL_KEY, String(clamp(Math.round(n), 0, 100)));
          } catch {}
        };

        const loadTboCount = () => {
          try {
            const raw = localStorage.getItem(STORAGE_TBO_COUNT_KEY);
            const n = Number(raw);
            if (!Number.isFinite(n)) return 5;
            return clamp(Math.round(n), 1, 20);
          } catch {
            return 5;
          }
        };

        const saveTboCount = (n) => {
          try {
            localStorage.setItem(STORAGE_TBO_COUNT_KEY, String(clamp(Math.round(n), 1, 20)));
          } catch {}
        };

        const loadTboRows = () => {
          try {
            const raw = localStorage.getItem(STORAGE_TBO_ROWS_KEY);
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) return [];
            return arr
              .map((r) => ({
                home: up(r?.home),
                away: up(r?.away),
                id: norm(r?.id),
              }))
              .filter((r) => r.home || r.away || r.id);
          } catch {
            return [];
          }
        };

        const saveTboRows = (rows) => {
          try {
            localStorage.setItem(STORAGE_TBO_ROWS_KEY, JSON.stringify(rows));
          } catch {}
        };

        const buildTboIndex = (rows) => {
          // map "AAA|BBB" (ordenados) -> id
          const m = new Map();
          for (const r of rows || []) {
            const a = normTeam(r.home);
            const b = normTeam(r.away);
            const id = norm(r.id);
            if (!a || !b || !id) continue;
            const key = [a, b].sort().join("|");
            if (!m.has(key)) m.set(key, id);
          }
          return m;
        };

        const buildTboTeamIndex = (rows) => {
          // map "AAA" -> Array(ids) (primeras coincidencias por orden de filas)
          const m = new Map();
          for (const r of rows || []) {
            const home = normTeam(r.home);
            const away = normTeam(r.away);
            const id = norm(r.id);
            if (!id) continue;

            if (home) {
              if (!m.has(home)) m.set(home, []);
              m.get(home).push(id);
            }
            if (away) {
              if (!m.has(away)) m.set(away, []);
              m.get(away).push(id);
            }
          }
          // dedupe manteniendo orden
          for (const [k, arr] of m.entries()) {
            const seen = new Set();
            const out = [];
            for (const v of arr) {
              if (seen.has(v)) continue;
              seen.add(v);
              out.push(v);
            }
            m.set(k, out);
          }
          return m;
        };

        // =========================
        // AUDIO
        // =========================
        const Audio = (() => {
          let ctx = null;
          let current = null;
          let vol01 = 1; // 0..1

          const ensureCtx = async () => {
            if (!ctx) {
              const Ctx = window.AudioContext || window.webkitAudioContext;
              if (!Ctx) return null;
              ctx = new Ctx();
            }
            if (ctx.state === "suspended") {
              try {
                await ctx.resume();
              } catch {}
            }
            return ctx;
          };

          const setVolume01 = (v) => {
            vol01 = clamp(Number(v) || 0, 0, 1);
          };

          const stopCurrent = () => {
            try {
              current?.stop?.();
            } catch {}
            current = null;
          };

          const playNotification = async () => {
            const c = await ensureCtx();
            if (!c) return;

            stopCurrent();

            const g = c.createGain();
            g.gain.setValueAtTime(0.0001, c.currentTime);
            g.connect(c.destination);

            const tone = (freq, tStart, tDur, peakMul = 1) => {
              const o = c.createOscillator();
              const og = c.createGain();

              o.type = "sine";
              o.frequency.setValueAtTime(freq, tStart);

              const peak = Math.max(0.00011, 0.09 * vol01 * peakMul);

              og.gain.setValueAtTime(0.0001, tStart);
              og.gain.exponentialRampToValueAtTime(peak, tStart + 0.015);
              og.gain.exponentialRampToValueAtTime(0.0001, tStart + tDur);

              o.connect(og);
              og.connect(g);

              o.start(tStart);
              o.stop(tStart + tDur + 0.02);

              return { o, og };
            };

            const t0 = c.currentTime;
            const t1 = t0 + 0.11;

            const a = tone(784, t0, 0.12, 1.0); // G5
            const b = tone(1046.5, t1, 0.14, 0.95); // C6

            const stop = () => {
              const endT = c.currentTime;
              try {
                g.gain.cancelScheduledValues(endT);
                g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), endT);
                g.gain.exponentialRampToValueAtTime(0.0001, endT + 0.06);
              } catch {}
              setTimeout(() => {
                try {
                  g.disconnect();
                } catch {}
                try {
                  a.o.disconnect();
                } catch {}
                try {
                  a.og.disconnect();
                } catch {}
                try {
                  b.o.disconnect();
                } catch {}
                try {
                  b.og.disconnect();
                } catch {}
              }, 90);
            };

            current = { stop };
            setTimeout(() => {
              if (current?.stop === stop) stopCurrent();
            }, 380);
          };

          const playSiren = async (durSeconds = 1.5) => {
            const c = await ensureCtx();
            if (!c) return;

            stopCurrent();

            const o = c.createOscillator();
            const g = c.createGain();
            const trem = c.createOscillator();
            const tremGain = c.createGain();

            o.type = "sawtooth";
            trem.type = "sine";

            const peak = 0.22 * vol01;
            const tremDepth = 0.12 * vol01;

            g.gain.setValueAtTime(0.0001, c.currentTime);
            g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.00011), c.currentTime + 0.04);

            trem.frequency.setValueAtTime(9, c.currentTime);
            tremGain.gain.setValueAtTime(tremDepth, c.currentTime);
            trem.connect(tremGain);
            tremGain.connect(g.gain);

            const baseLo = 650;
            const baseHi = 1200;
            const t0 = c.currentTime;
            const dur = Math.max(0.2, Number(durSeconds) || 1.5);
            const step = 0.35;

            o.frequency.setValueAtTime(baseLo, t0);
            let t = t0;
            let upFlag = true;

            while (t < t0 + dur) {
              const t1 = Math.min(t + step, t0 + dur);
              const target = upFlag ? baseHi : baseLo;
              o.frequency.exponentialRampToValueAtTime(target, t1);
              upFlag = !upFlag;
              t = t1;
            }

            o.connect(g);
            g.connect(c.destination);

            o.start();
            trem.start();

            const stop = () => {
              const endT = c.currentTime;
              try {
                g.gain.cancelScheduledValues(endT);
                g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), endT);
                g.gain.exponentialRampToValueAtTime(0.0001, endT + 0.08);
              } catch {}

              setTimeout(() => {
                try {
                  o.stop();
                } catch {}
                try {
                  trem.stop();
                } catch {}
                try {
                  o.disconnect();
                } catch {}
                try {
                  trem.disconnect();
                } catch {}
                try {
                  tremGain.disconnect();
                } catch {}
                try {
                  g.disconnect();
                } catch {}
              }, 120);
            };

            current = { stop };
            setTimeout(() => {
              if (current?.stop === stop) stopCurrent();
            }, Math.round(dur * 1000) + 120);
          };

          return { playNotification, playSiren, stopCurrent, setVolume01 };
        })();

        // =========================
        // DOM (Player News)
        // =========================
        const getHolder = () => document.querySelector(".q-su-holder");

        const extractMatchTeamsFromText = (text, playerTeam) => {
          // e.g. "Wednesday @LAC" or "Sunday vs BOS"
          const t = norm(text);
          const pt = up(playerTeam);

          let opp = "";
          let isAt = false;
          if (t.includes("@")) {
            isAt = true;
            opp = up(t.split("@").pop());
          } else if (t.toLowerCase().includes("vs")) {
            isAt = false;
            opp = up(t.split(/vs/i).pop());
          }

          opp = normTeam(opp);
          const me = normTeam(pt);

          if (!me || !opp) return null;

          const home = isAt ? opp : me;
          const away = isAt ? me : opp;

          return { home, away };
        };

        const parseTradeTeams = (tradeDetailText, playerTeam) => {
          // "chi to nyk" OR "to bulls" OR "... (Trade Pending)"
          const txt = up(tradeDetailText).replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();
          const m = txt.match(/\b([A-Z]{3})\s+TO\s+([A-Z]{3})\b/);
          if (m) {
            const a = up(m[1]);
            const b = up(m[2]);
            const teams = [];
            if (a) teams.push(a);
            if (b && b !== a) teams.push(b);
            return teams;
          }
          const pt = up(playerTeam).replace(/[^A-Z]/g, "");
          return pt ? [pt] : [];
        };

        const parseNewsFromDOM = () => {
          const holder = getHolder();
          if (!holder) return [];

          const items = [...holder.querySelectorAll(".q-item.q-su-item")].slice(0, MAX_ITEMS);

          return items
            .map((it) => {
              const player = norm(it.querySelector(".q-title a")?.textContent);
              const team = normTeam(it.querySelector(".q-player-info")?.textContent);
              const pos = norm(it.querySelectorAll(".q-player-info")[1]?.textContent);

              const statusEl = it.querySelector(".status-update-player-status");
              const statusLine = norm(statusEl?.textContent);

              const date = norm(it.querySelector(".q-date")?.textContent);

              const levelEl = it.querySelector(
                ".status-update-player-status .q-date[title='news level'], .status-update-player-status .q-date[alt='news level']"
              );
              const level = norm(levelEl?.textContent).toLowerCase();

              const matchLine = norm(it.querySelector(".ml-1.small")?.textContent);
              const teams = extractMatchTeamsFromText(matchLine, team);

              // TRADE detection
              const statusSquareRaw = norm(it.querySelector(".status-square")?.textContent);
              const statusSquareToken = up(statusSquareRaw).split(/\s+/)[0];
              const isTrade =
                statusSquareToken === "TRADE" ||
                up(norm(statusEl?.querySelector("span")?.textContent)) === "TRADE" ||
                up(statusLine).includes("TRADED");

              const tradeMuted = norm(statusEl?.querySelector?.(".text-muted")?.textContent);
              const tradeTeams = isTrade ? parseTradeTeams(tradeMuted, team) : [];

              const key = norm(`${player}|${team}|${pos}|${statusLine}|${level}`);
              return {
                key,
                player,
                team,
                pos,
                statusLine,
                date,
                level,
                matchLine,
                matchTeams: teams || null, // {home, away}
                isTrade,
                tradeMuted,
                tradeTeams, // ["CHI"] or ["CHI","NYK"]
              };
            })
            .filter((x) => x.player);
        };

        // =========================
        // UI helpers
        // =========================
        const statCard = (label, id, value, extraCss = "") => `
          <div style="
            ${extraCss}
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.10);
            background: rgba(255,255,255,0.02);
            padding: 10px;
            min-width: 0;
          ">
            <div style="font-size:11px;color:rgba(230,232,238,0.65);white-space:nowrap;">${label}</div>
            <div id="${id}" style="margin-top:4px;font-size:12px;font-weight:650;">${value}</div>
          </div>
        `;

        const openTboBtnInline = (id, label = "Open event") => `
          <button data-tbo-open="${norm(id)}" style="
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.10);
            background: linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95));
            color: #111;
            padding: 8px 12px;
            font-size: 12px;
            font-weight: 650;
            cursor: pointer;
            white-space: nowrap;
            width: 100%;
          ">${label}</button>
        `;

        const renderItemCard = (n, tboEventIds) => {
          const levelTag = n.level
            ? `<span style="margin-left:8px;font-size:10.5px;color:rgba(230,232,238,0.65);">(${n.level})</span>`
            : "";

          const matchTag =
            n.matchTeams?.home && n.matchTeams?.away
              ? `<div style="margin-top:4px;font-size:10.5px;color:rgba(230,232,238,0.65);">Match: ${n.matchTeams.home} vs ${n.matchTeams.away}</div>`
              : "";

          const tradeTag = n.isTrade
            ? `<div style="margin-top:4px;font-size:10.5px;color:rgba(230,232,238,0.65);">Trade: ${norm(n.tradeMuted || "")}</div>`
            : "";

          const teamLabel = n.team ? labelTeam(n.team) : "";

          const ids = Array.isArray(tboEventIds) ? tboEventIds.filter(Boolean) : [];
          const btns = ids.length
            ? ids
                .slice(0, 2)
                .map((id, idx) =>
                  openTboBtnInline(id, ids.length > 1 ? `Open event ${idx + 1}` : "Open event")
                )
                .join(`<div style="height:8px;"></div>`)
            : "";

          return `
            <div style="
              border-radius: 12px;
              border: 1px solid rgba(255,255,255,0.10);
              background: rgba(255,255,255,0.02);
              padding: 10px;
              margin-bottom: 10px;
              display:flex;
              align-items:flex-start;
              justify-content:space-between;
              gap: 12px;
            ">
              <div style="min-width:0; flex: 1 1 auto;">
                <div style="font-size:12px;font-weight:650; display:flex; align-items:baseline; flex-wrap:wrap; gap:6px;">
                  <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${n.player}</span>
                  <span style="color: rgba(230,232,238,0.65); font-weight:600; white-space:nowrap;">${teamLabel} ${n.pos || ""}</span>
                  ${levelTag}
                </div>

                <div style="margin-top:4px;font-size:11px;color:rgba(230,232,238,0.85);">
                  ${n.statusLine || ""}
                </div>

                ${tradeTag}
                ${matchTag}

                <div style="margin-top:4px;font-size:10.5px;color:rgba(230,232,238,0.65);">
                  ${n.date ? `hace ${n.date}` : ""}
                </div>
              </div>

              <div style="flex: 0 0 140px; padding-top: 2px;">
                ${btns}
              </div>
            </div>
          `;
        };

        const makeDraggable = (root, handle) => {
          let dragging = false;
          let startX = 0,
            startY = 0,
            startTop = 0,
            startLeft = 0;

          const onDown = (e) => {
            if (e.button !== 0) return;
            if (e.target?.closest("button")) return;
            if (e.target?.closest("input")) return;
            if (e.target?.closest("select")) return;
            if (e.target?.closest("a")) return;

            dragging = true;

            const rect = root.getBoundingClientRect();
            startTop = rect.top;
            startLeft = rect.left;

            startX = e.clientX;
            startY = e.clientY;

            handle.style.cursor = "grabbing";
            root.style.userSelect = "none";
            e.preventDefault();
          };

          const onMove = (e) => {
            if (!dragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const rect = root.getBoundingClientRect();

            let top = clamp(startTop + dy, 8, vh - rect.height - 8);
            let left = clamp(startLeft + dx, 8, vw - rect.width - 8);

            root.style.top = `${top}px`;
            root.style.left = `${left}px`;
            root.style.right = "auto";
            savePos(top, left);
          };

          const onUp = () => {
            if (!dragging) return;
            dragging = false;
            handle.style.cursor = "grab";
            root.style.userSelect = "";
          };

          handle.addEventListener("mousedown", onDown);
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        };

        const teamSelectHtml = (attr, idx, selectedCode) => {
          const safeSel = up(selectedCode || "");
          const opts =
            `<option value="">Select team</option>` +
            NBA_TEAMS.map((t) => {
              const sel = t.code === safeSel ? "selected" : "";
              return `<option value="${t.code}" ${sel}>${t.name} (${t.code})</option>`;
            }).join("");

          return `
            <select ${attr}="${idx}" style="
              width:100%;
              border-radius: 10px;
              border: 1px solid rgba(255,255,255,0.10);
              background: #0B0D10;
              color: #E6E8EE;
              padding: 8px 10px;
              font-size: 12px;
              outline: none;
              appearance: none;
              -webkit-appearance: none;
              -moz-appearance: none;
            ">
              ${opts}
            </select>
          `;
        };

        const buildTboRowsHtml = (count, rows) => {
          const safe = (v) => String(v ?? "").replace(/"/g, "&quot;");

          let body = "";
          for (let i = 0; i < count; i++) {
            const r = rows[i] || { home: "", away: "", id: "" };
            body += `
              <tr>
                <td style="padding:6px 6px;">
                  ${teamSelectHtml("data-tbo-home", i, r.home)}
                </td>
                <td style="padding:6px 6px;">
                  ${teamSelectHtml("data-tbo-away", i, r.away)}
                </td>
                <td style="padding:6px 6px;">
                  <input data-tbo-id="${i}" value="${safe(r.id)}" placeholder="769991" style="
                    width:100%;
                    border-radius: 10px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: #0B0D10;
                    color:#E6E8EE;
                    padding: 8px 10px;
                    font-size: 12px;
                    outline:none;
                  "/>
                </td>
              </tr>
            `;
          }

          return `
            <div style="
              border-radius:14px;
              border:1px solid rgba(255,255,255,0.10);
              background: rgba(255,255,255,0.02);
              overflow:hidden;
              margin-bottom:10px;
            ">
              <div style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.10); display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="font-size:12px; font-weight:650;">Matches in TBO</div>

                <div style="display:flex; align-items:center; gap:10px;">
                  <div style="font-size:11px; color:rgba(230,232,238,0.65); white-space:nowrap;"># matches</div>

                  <input id="bmTboCount" type="number" min="1" max="20" value="${count}" style="
                    width:70px;
                    border-radius:10px;
                    border:1px solid rgba(255,255,255,0.10);
                    background:#0B0D10;
                    color:#E6E8EE;
                    padding:8px 10px;
                    font-size:12px;
                    outline:none;
                  "/>

                  <button id="bmTboToggle" type="button" style="
                    width:34px;
                    height:34px;
                    border-radius:10px;
                    border:1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.03);
                    color: rgba(230,232,238,0.85);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    cursor:pointer;
                    font-size:18px;
                    font-weight:650;
                    line-height:1;
                  ">▾</button>
                </div>
              </div>

              <div id="bmTboBody" style="padding:10px;">
                <div style="font-size:11px; color:rgba(230,232,238,0.65); margin-bottom:8px;">
                  Register matches (Home | Away | TBO Event ID)
                </div>

                <table style="width:100%; border-collapse:separate; border-spacing:0;">
                  <thead>
                    <tr>
                      <th style="text-align:left; font-size:11px; color:rgba(230,232,238,0.65); font-weight:650; padding:6px 6px;">Home</th>
                      <th style="text-align:left; font-size:11px; color:rgba(230,232,238,0.65); font-weight:650; padding:6px 6px;">Away</th>
                      <th style="text-align:left; font-size:11px; color:rgba(230,232,238,0.65); font-weight:650; padding:6px 6px;">TBO ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${body}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        };

        const refreshSelectCarets = (scopeEl) => {
          const wrap = scopeEl || document;
          const sels = wrap.querySelectorAll("select");
          sels.forEach((s) => {
            s.style.backgroundImage =
              "linear-gradient(45deg, transparent 50%, rgba(230,232,238,0.55) 50%), linear-gradient(135deg, rgba(230,232,238,0.55) 50%, transparent 50%)";
            s.style.backgroundPosition =
              "calc(100% - 14px) calc(50% - 2px), calc(100% - 9px) calc(50% - 2px)";
            s.style.backgroundSize = "5px 5px, 5px 5px";
            s.style.backgroundRepeat = "no-repeat";
            s.style.paddingRight = "28px";
          });
        };

        // =========================
        // PANEL
        // =========================
        const ensurePanel = () => {
          let root = document.getElementById("bmNewsPanel_root");
          if (root) return root;

          const initialVol = loadVol(); // default 10
          Audio.setVolume01(initialVol / 100);

          const tboCount = loadTboCount();
          const tboRows = loadTboRows();

          root = document.createElement("div");
          root.id = "bmNewsPanel_root";
          root.style.cssText = `
            position: fixed;
            top: 14px;
            right: 14px;
            width: 440px;
            max-width: calc(100vw - 28px);
            z-index: 999999;
            font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
            color: #E6E8EE;
          `;

          const saved = loadPos();
          if (saved) {
            root.style.top = `${saved.top}px`;
            root.style.left = `${saved.left}px`;
            root.style.right = "auto";
          }

          root.innerHTML = `
            <div id="bmNewsPanel_card" style="
              background: #13161D;
              border: 1px solid rgba(255,255,255,0.10);
              border-radius: 14px;
              box-shadow: 0 10px 30px rgba(0,0,0,0.45);
              overflow: hidden;
            ">
              <div id="bmHandle" style="
                padding: 10px 12px;
                background: linear-gradient(90deg, rgba(240,166,74,0.18), rgba(240,166,74,0.04));
                border-bottom: 1px solid rgba(255,255,255,0.10);
                display:flex; align-items:center; justify-content:space-between; gap:10px;
                cursor: grab;
              ">
                <div style="min-width:0;">
                  <a href="${SITE_URL}" target="_blank" rel="noopener noreferrer" style="
                    display:block;
                    font-size:13px;
                    font-weight:650;
                    white-space:nowrap;
                    overflow:hidden;
                    text-overflow:ellipsis;
                    color:#E6E8EE;
                    text-decoration:none;
                  ">NBAlerts (Monster)</a>
                  <div id="bmSub" style="margin-top:2px;font-size:11px;color:rgba(230,232,238,0.65);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    Idle
                  </div>
                </div>

                <div style="display:flex; gap:8px; align-items:center; flex:0 0 auto;">
                  <button id="bmStop" style="
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.03);
                    color: rgba(230,232,238,0.85);
                    padding: 7px 10px;
                    font-size: 12px;
                    font-weight: 650;
                    cursor: pointer;
                  ">Stop</button>

                  <button id="bmRun" style="
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: linear-gradient(180deg, rgba(240,166,74,0.95), rgba(200,133,51,0.95));
                    color: #111;
                    padding: 7px 10px;
                    font-size: 12px;
                    font-weight: 650;
                    cursor: pointer;
                  ">Run</button>

                  <button id="bmMin" title="Minimize" style="
                    width: 34px;
                    height: 34px;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.03);
                    color: rgba(230,232,238,0.85);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 700;
                    line-height: 1;
                  ">—</button>

                  <button id="bmClose" title="Close" style="
                    width: 34px;
                    height: 34px;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.03);
                    color: rgba(230,232,238,0.85);
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    cursor: pointer;
                    font-size: 16px;
                    font-weight: 650;
                    line-height: 1;
                  ">×</button>
                </div>
              </div>

              <div id="bmBody">
                <div style="padding: 10px 12px; display:flex; gap:10px; align-items:stretch;">
                  <div style="
                    flex: 1 1 220px;
                    border-radius: 14px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.02);
                    padding: 10px;
                    min-width: 0;
                  ">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                      <div style="font-size:11px;color:rgba(230,232,238,0.65);white-space:nowrap;">Interval (s)</div>
                      <input id="bmIntervalInput" type="number" value="${Math.round(intervalMs / 1000)}"
                        style="
                          width: 60px;
                          border-radius: 8px;
                          border: 1px solid rgba(255,255,255,0.10);
                          background: rgba(255,255,255,0.03);
                          color: #E6E8EE;
                          padding: 6px 8px;
                          font-size: 12px;
                          outline: none;
                        "
                      />
                    </div>
                  </div>

                  ${statCard("Ticks", "bmTicks", "0", "flex: 0 0 82px;")}
                  ${statCard("Last check", "bmLast", "—", "flex: 0 0 120px;")}
                </div>

                <div style="padding: 0 12px 12px 12px;">
                  <!-- Volume -->
                  <div style="
                    border-radius: 14px;
                    border: 1px solid rgba(255,255,255,0.10);
                    background: rgba(255,255,255,0.02);
                    padding: 10px;
                    margin-bottom: 10px;
                  ">
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                      <div style="font-size:11px;color:rgba(230,232,238,0.65);white-space:nowrap;">Alarm volume</div>
                      <div id="bmVolVal" style="font-size:11px;font-weight:650;">${initialVol}%</div>
                    </div>

                    <input id="bmVol" type="range" min="0" max="100" value="${initialVol}"
                      style="
                        width: 100%;
                        margin-top: 8px;
                        accent-color: #F0A64A;
                      "
                    />
                  </div>

                  <!-- Latest detected -->
                  <div style="border-radius:14px; border:1px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.02); overflow:hidden; margin-bottom:10px;">
                    <div style="padding:8px 10px; border-bottom:1px solid rgba(255,255,255,0.10); display:flex; align-items:center; justify-content:space-between; gap:10px;">
                      <div style="font-size:12px; font-weight:650;">Latest detected</div>

                      <div style="display:flex; gap:8px; align-items:center;">
                        <button id="bmLatestToggle" type="button" style="
                          width:34px;
                          height:34px;
                          border-radius:10px;
                          border:1px solid rgba(255,255,255,0.10);
                          background: rgba(255,255,255,0.03);
                          color: rgba(230,232,238,0.85);
                          display:flex;
                          align-items:center;
                          justify-content:center;
                          cursor:pointer;
                          font-size:18px;
                          font-weight:650;
                          line-height:1;
                        ">▾</button>

                        <button id="bmClearLatest" style="
                          border-radius: 12px;
                          border: 1px solid rgba(255,255,255,0.10);
                          background: rgba(255,255,255,0.03);
                          color: rgba(230,232,238,0.85);
                          padding: 6px 9px;
                          font-size: 11px;
                          font-weight: 600;
                          cursor: pointer;
                        ">Clear</button>
                      </div>
                    </div>

                    <div id="bmLatestBody" style="padding:10px;">
                      <div id="bmLatest" style="font-size:11px; color: rgba(230,232,238,0.85);">
                        —
                      </div>
                    </div>
                  </div>

                  <!-- Matches in TBO -->
                  <div id="bmTboWrap">
                    ${buildTboRowsHtml(tboCount, tboRows)}
                  </div>
                </div>
              </div>
            </div>
          `;

          root.__bmState = {
            running: false,
            intervalId: null,
            lastSnapshotKeys: new Set(),
            tickCount: 0,
            lastTickAt: null,
            tboCount,
            tboRows,
            tboIndex: buildTboIndex(tboRows),
            tboTeamIndex: buildTboTeamIndex(tboRows),
          };

          document.documentElement.appendChild(root);
          makeDraggable(root, root.querySelector("#bmHandle"));
          refreshSelectCarets(root);

          return root;
        };

        // =========================
        // Small UI setters
        // =========================
        const setText = (id, text) => {
          const root = ensurePanel();
          const el = root.querySelector(`#${id}`);
          if (el) el.textContent = text;
        };

        const setHTML = (id, html) => {
          const root = ensurePanel();
          const el = root.querySelector(`#${id}`);
          if (el) el.innerHTML = html;
          refreshSelectCarets(root);
        };

        const sub = (text) => setText("bmSub", text);

        const syncButtons = () => {
          const root = ensurePanel();
          const st = root.__bmState;
          const btnStop = root.querySelector("#bmStop");
          const btnRun = root.querySelector("#bmRun");
          if (btnStop) btnStop.disabled = !st.running;
          if (btnRun) btnRun.disabled = st.running;

          if (btnStop) btnStop.style.opacity = st.running ? "1" : "0.45";
          if (btnRun) btnRun.style.opacity = st.running ? "0.45" : "1";
        };

        const refreshTboUI = () => {
          const root = ensurePanel();
          const st = root.__bmState;
          const wrap = root.querySelector("#bmTboWrap");
          if (!wrap) return;

          wrap.innerHTML = buildTboRowsHtml(st.tboCount, st.tboRows);
          refreshSelectCarets(wrap);

          // re-apply accordion state after rerender
          try {
            const collapsed = localStorage.getItem(STORAGE_TBO_COLLAPSED_KEY) === "1";
            const body = wrap.querySelector("#bmTboBody");
            const btn = wrap.querySelector("#bmTboToggle");
            if (body && btn) {
              body.style.display = collapsed ? "none" : "block";
              btn.textContent = collapsed ? "+" : "-";
            }
          } catch {}
        };

        const readTboInputsAndPersist = () => {
          const root = ensurePanel();
          const st = root.__bmState;

          const rows = [];
          for (let i = 0; i < st.tboCount; i++) {
            const home = up(root.querySelector(`[data-tbo-home="${i}"]`)?.value);
            const away = up(root.querySelector(`[data-tbo-away="${i}"]`)?.value);
            const id = norm(root.querySelector(`[data-tbo-id="${i}"]`)?.value);

            rows.push({ home, away, id });
          }

          st.tboRows = rows;
          st.tboIndex = buildTboIndex(rows);
          st.tboTeamIndex = buildTboTeamIndex(rows);

          saveTboRows(rows);
        };

        // =========================
        // REFRESH block (fetch latest HTML)
        // =========================
        const refreshBlock = async () => {
          const holder = getHolder();
          if (!holder) throw new Error("No encuentro .q-su-holder (Player News).");

          const url = new URL("statusupdates.aspx", location.origin).toString();
          const res = await fetch(url, { credentials: "include", cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          const newHolder = doc.querySelector(".q-su-holder");
          if (!newHolder) throw new Error("No pude extraer .q-su-holder desde statusupdates.aspx");

          holder.innerHTML = newHolder.innerHTML;
        };

        // =========================
        // TBO lookup helpers
        // =========================
        const tboUrlForId = (id) =>
          `https://leo-prod-trading-bo.k8s.goldrush.llc/events/details/${encodeURIComponent(
            norm(id)
          )}`;

        const getTboEventIdsForNews = (newsItem, tboIndex, tboTeamIndex) => {
          // Normal: matchTeams => search by pair; fallback by player's team
          if (newsItem?.matchTeams?.home && newsItem?.matchTeams?.away) {
            const key = [up(newsItem.matchTeams.home), up(newsItem.matchTeams.away)].sort().join("|");
            const id = tboIndex.get(key) || "";
            if (id) return [id];

            const team = up(newsItem?.team);
            const arr = (team && tboTeamIndex.get(team)) || [];
            if (arr.length > 0) return [arr[0]];
            return [];
          }

          // TRADE: 2 teams => 2 buttons (first match for each team)
          if (newsItem?.isTrade) {
            const out = [];
            const teams = Array.isArray(newsItem.tradeTeams) ? newsItem.tradeTeams : [];

            for (const code of teams.slice(0, 2)) {
              const arr = tboTeamIndex.get(up(code)) || [];
              if (arr.length > 0) out.push(arr[0]);
            }

            if (out.length === 0) {
              const pt = up(newsItem.team);
              const arr = (pt && tboTeamIndex.get(pt)) || [];
              if (arr.length > 0) out.push(arr[0]);
            }

            const seen = new Set();
            return out.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
          }

          // fallback: by player's team
          {
            const team = up(newsItem?.team);
            const arr = (team && tboTeamIndex.get(team)) || [];
            if (arr.length > 0) return [arr[0]];
          }

          return [];
        };

        // =========================
        // LOOP
        // =========================
        const baseline = () => {
          const root = ensurePanel();
          const st = root.__bmState;

          const items = parseNewsFromDOM();
          st.lastSnapshotKeys = new Set(items.map((x) => x.key));
        };

        const tick = async () => {
          const root = ensurePanel();
          const st = root.__bmState;

          st.tickCount += 1;
          st.lastTickAt = nowStr();
          setText("bmTicks", String(st.tickCount));
          setText("bmLast", st.lastTickAt);

          const prevKeys = st.lastSnapshotKeys;

          await refreshBlock();

          const items = parseNewsFromDOM();
          const newOnes = items.filter((x) => !prevKeys.has(x.key));

          if (newOnes.length > 0) {
            const html = newOnes
              .slice(0, 6)
              .map((n) => {
                const ids = getTboEventIdsForNews(n, st.tboIndex, st.tboTeamIndex);
                return renderItemCard(n, ids);
              })
              .join("");

            setHTML("bmLatest", html);

            const hasMonster = newOnes.some((n) => norm(n.level).toLowerCase() === "monster");
            const hasHigh = newOnes.some((n) => norm(n.level).toLowerCase() === "high level");

            if (hasMonster || hasHigh) {
              await Audio.playSiren(1.5);
            } else {
              await Audio.playNotification();
            }

            try {
              chrome?.runtime?.sendMessage?.({
                type: "BM_NOTIFY",
                title: "BasketballMonster — Player News",
                message: `${newOnes.length} new item(s)`,
              });
            } catch {}
          }

          st.lastSnapshotKeys = new Set(items.map((x) => x.key));
          sub(`Monitoring • every ${Math.round(intervalMs / 1000)}s • last ${st.lastTickAt}`);
        };

        const startTimer = () => {
          const root = ensurePanel();
          const st = root.__bmState;

          if (st.intervalId) {
            clearInterval(st.intervalId);
            st.intervalId = null;
          }

          st.intervalId = setInterval(() => {
            (async () => {
              if (!st.running) return;
              try {
                await tick();
              } catch (e) {
                console.error("[NBAlerts (Monster)] Tick error:", e);
                sub("Tick error (see console)");
              }
            })();
          }, intervalMs);
        };

        const start = async () => {
          const root = ensurePanel();
          const st = root.__bmState;

          if (!location.hostname.includes("basketballmonster.com")) {
            sub("Open this on basketballmonster.com to run monitoring");
            st.running = false;
            syncButtons();
            return;
          }

          if (!getHolder()) {
            sub("Player News not found");
            st.running = false;
            syncButtons();
            return;
          }

          if (st.running) return;

          st.running = true;
          syncButtons();

          sub("Initializing…");

          baseline();
          await tick();

          startTimer();

          syncButtons();
        };

        const stop = () => {
          const root = ensurePanel();
          const st = root.__bmState;

          if (!st.running) {
            sub("Idle");
            syncButtons();
            return;
          }

          st.running = false;
          if (st.intervalId) {
            clearInterval(st.intervalId);
            st.intervalId = null;
          }

          try {
            Audio.stopCurrent();
          } catch {}

          sub("Idle");
          syncButtons();
        };

        // =========================
        // UI listeners (once)
        // =========================
        {
          const root = ensurePanel();
          const st = root.__bmState;

          if (!root.dataset.bmInit) {
            root.dataset.bmInit = "1";

            // Close (X)
            root.querySelector("#bmClose").addEventListener("click", () => root.remove());

            // Minimize panel (collapse body)
            {
              const btn = root.querySelector("#bmMin");
              const body = root.querySelector("#bmBody");

              const applyMin = (minimized) => {
                if (!body || !btn) return;
                body.style.display = minimized ? "none" : "block";
                btn.textContent = minimized ? "▢" : "—";
                btn.title = minimized ? "Restore" : "Minimize";
                try {
                  localStorage.setItem(STORAGE_PANEL_MINIMIZED_KEY, minimized ? "1" : "0");
                } catch {}
              };

              let minimized = false;
              try {
                minimized = localStorage.getItem(STORAGE_PANEL_MINIMIZED_KEY) === "1";
              } catch {}
              applyMin(minimized);

              btn?.addEventListener("click", () => {
                minimized = !minimized;
                applyMin(minimized);
              });
            }

            // Latest accordion
            {
              const toggleBtn = root.querySelector("#bmLatestToggle");
              const body = root.querySelector("#bmLatestBody");

              const applyCollapsed = (collapsed) => {
                if (!body || !toggleBtn) return;
                body.style.display = collapsed ? "none" : "block";
                toggleBtn.textContent = collapsed ? "+" : "-";
                try {
                  localStorage.setItem(STORAGE_LATEST_COLLAPSED_KEY, collapsed ? "1" : "0");
                } catch {}
              };

              let collapsed = false;
              try {
                collapsed = localStorage.getItem(STORAGE_LATEST_COLLAPSED_KEY) === "1";
              } catch {}
              applyCollapsed(collapsed);

              toggleBtn?.addEventListener("click", () => {
                collapsed = !collapsed;
                applyCollapsed(collapsed);
              });
            }

            // Matches in TBO accordion toggle
            {
              const toggleBtn = root.querySelector("#bmTboToggle");
              const body = root.querySelector("#bmTboBody");

              const applyCollapsed = (collapsed) => {
                if (!body || !toggleBtn) return;
                body.style.display = collapsed ? "none" : "block";
                toggleBtn.textContent = collapsed ? "+" : "-";
                try {
                  localStorage.setItem(STORAGE_TBO_COLLAPSED_KEY, collapsed ? "1" : "0");
                } catch {}
              };

              let collapsed = false;
              try {
                collapsed = localStorage.getItem(STORAGE_TBO_COLLAPSED_KEY) === "1";
              } catch {}
              applyCollapsed(collapsed);

              toggleBtn?.addEventListener("click", () => {
                collapsed = !collapsed;
                applyCollapsed(collapsed);
              });
            }

            // Clear latest
            root.querySelector("#bmClearLatest").addEventListener("click", () => {
              const latest = root.querySelector("#bmLatest");
              if (latest) latest.innerHTML = "—";
            });

            // Stop / Run
            root.querySelector("#bmStop").addEventListener("click", () => stop());
            root.querySelector("#bmRun").addEventListener("click", async () => {
              try {
                await start();
              } catch (e) {
                console.error("[NBAlerts (Monster)] Run error:", e);
                sub("Run error (see console)");
              }
            });

            // Interval input
            const intervalInput = root.querySelector("#bmIntervalInput");
            intervalInput?.addEventListener("change", () => {
              const v = Number(intervalInput.value);
              if (!Number.isFinite(v)) return;
              const sec = clamp(v, 1, 9999);
              intervalInput.value = String(sec);

              intervalMs = Math.round(sec * 1000);

              const isRunning = st.running;
              if (isRunning) {
                startTimer();
                sub(`Monitoring • every ${Math.round(intervalMs / 1000)}s • last ${st.lastTickAt || "—"}`);
              } else {
                sub("Idle");
              }
            });

            // Volume
            const vol = root.querySelector("#bmVol");
            const volVal = root.querySelector("#bmVolVal");
            if (vol && volVal) {
              vol.addEventListener("input", () => {
                const n = clamp(Number(vol.value), 0, 100);
                volVal.textContent = `${Math.round(n)}%`;
                Audio.setVolume01(n / 100);
                saveVol(n);
              });
            }

            // Matches in TBO changes
            root.addEventListener("change", (e) => {
              const t = e.target;

              if (t?.id === "bmTboCount") {
                const n = clamp(Number(t.value), 1, 20);
                t.value = String(n);
                st.tboCount = n;
                saveTboCount(n);

                const next = [];
                for (let i = 0; i < n; i++) {
                  next.push(st.tboRows[i] || { home: "", away: "", id: "" });
                }
                st.tboRows = next;
                st.tboIndex = buildTboIndex(next);
                st.tboTeamIndex = buildTboTeamIndex(next);
                saveTboRows(next);

                refreshTboUI();
                return;
              }

              if (
                t?.hasAttribute?.("data-tbo-home") ||
                t?.hasAttribute?.("data-tbo-away") ||
                t?.hasAttribute?.("data-tbo-id")
              ) {
                readTboInputsAndPersist();
              }
            });

            // Open event buttons (delegation)
            root.addEventListener("click", (e) => {
              const btn = e.target?.closest?.("[data-tbo-open]");
              if (!btn) return;
              const id = norm(btn.getAttribute("data-tbo-open"));
              if (!id) return;

              const url = tboUrlForId(id);

              try {
                window.open(url, "_blank", "noopener,noreferrer");
              } catch {
                window.open(url, "_blank");
              }
            });
          }

          // Always sync buttons
          syncButtons();

          // On automation run: toggle run/stop
          if (st.running) stop();
          else await start();
          syncButtons();
        }

        return { ok: true };
      } catch (err) {
        console.error("[NBAlerts (Monster)] Error:", err);
        return { ok: false, error: String(err?.message || err) };
      }
    }
  );
})();