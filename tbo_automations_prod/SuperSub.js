/**
 * SuperSub.js
 * Automatizacion modular para la extension.
 * Consolida las estadisticas de un jugador TITULAR y su SUPLENTE como si
 * fueran un solo jugador.
 *
 * Reglas:
 *   1. Empareja Titular/Suplente desde la linea de tiempo (eventos de
 *      sustitucion). Sale (Opta-IconOff) = TITULAR (hereda el nombre);
 *      Entra (Opta-IconOn) = SUPLENTE.
 *   2. Una fila por sustitucion con la SUMA aritmetica de ambos jugadores.
 *   3. Columnas: G | A | RC | YC | Crn | S | SOnT | BS | P | C | Tk | O | FC | FW | SAV
 *   5. Resalta en rojo claro las celdas que cambiaron (el suplente aporto != 0).
 *
 * El widget de Opta carga de forma asincrona, por eso usa MutationObserver +
 * setInterval (igual que OddsConverter) para esperar a que la linea de tiempo y
 * la tabla esten disponibles y re-renderizar si cambian.
 */
(() => {
  if (!window.registerAutomation) return;

  window.registerAutomation("SuperSub", { name: "SuperSub" }, async () => {
    try {
      // Evita crear la ventana dentro de iframes cuando corre con all_frames:true
      if (window.top !== window.self) {
        return { ok: true };
      }

      (function () {
        var PANEL_ID = 'supersub-panel';
        var STATE_KEY = '__SuperSubState__';

        // Orden EXACTO de columnas (coincide con la tabla de datos crudos)
        var STAT_COLUMNS = ['G', 'A', 'RC', 'YC', 'Crn', 'S', 'SOnT', 'BS', 'P', 'C', 'Tk', 'O', 'FC', 'FW', 'SAV'];

        // Si ya hay una instancia activa y el panel existe, no duplicar
        if (window[STATE_KEY] && window[STATE_KEY].active && document.getElementById(PANEL_ID)) {
          return;
        }

        // Limpiar instancia previa incompleta
        if (window[STATE_KEY]) {
          try {
            if (window[STATE_KEY].observer) window[STATE_KEY].observer.disconnect();
            if (window[STATE_KEY].interval) clearInterval(window[STATE_KEY].interval);
          } catch (e) {}
        }

        window[STATE_KEY] = { active: true, observer: null, interval: null };

        var lastSignature = null;
        var mainObserver = null;
        var mainInterval = null;

        // -------------------------------------------------------- Utilidades
        function extractId(el, prefix) {
          if (!el) return null;
          var classes = (el.className || '').split(/\s+/);
          for (var i = 0; i < classes.length; i++) {
            var c = classes[i];
            if (c.length > prefix.length && c.indexOf(prefix) === 0) {
              return c.substring(prefix.length);
            }
          }
          return null;
        }

        function cleanName(el) {
          return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
        }

        function toInt(v) {
          var n = parseInt(v, 10);
          return isNaN(n) ? 0 : n;
        }

        // ------------------------------- 1. Emparejamiento Titular/Suplente
        function parsePairings(root) {
          root = root || document;
          var subs = root.querySelectorAll('li.Opta-Event-Type-990');
          var pairings = [];

          Array.prototype.forEach.call(subs, function (li) {
            var ul = li.closest ? li.closest('ul') : null;
            var team = 'unknown';
            if (ul && ul.classList.contains('Opta-Home')) team = 'home';
            else if (ul && ul.classList.contains('Opta-Away')) team = 'away';

            var offIcon = li.querySelector('.Opta-IconOff'); // SALE = TITULAR
            var onIcon = li.querySelector('.Opta-IconOn');    // ENTRA = SUPLENTE
            if (!offIcon || !onIcon) return;

            var offDiv = offIcon.closest('div');
            var onDiv = onIcon.closest('div');

            var titular = {
              id: extractId(offDiv && offDiv.querySelector('.Opta-Image-Player'), 'Opta-Image-Player-'),
              name: cleanName(offDiv && offDiv.querySelector('p'))
            };
            var suplente = {
              id: extractId(onDiv && onDiv.querySelector('.Opta-Image-Player'), 'Opta-Image-Player-'),
              name: cleanName(onDiv && onDiv.querySelector('p'))
            };

            pairings.push({ team: team, titular: titular, suplente: suplente });
          });

          return pairings;
        }

        // --------------------------------------- 2. Lectura de datos crudos
        function parseStats(root) {
          root = root || document;
          var byId = {};
          var byName = {};

          var rows = root.querySelectorAll('table.Opta-Striped tbody tr[role="row"]');
          Array.prototype.forEach.call(rows, function (tr) {
            var th = tr.querySelector('th.Opta-Player');
            if (!th || th.classList.contains('Opta-Total')) return;

            var id = extractId(th, 'Opta-Player-');
            var name = cleanName(th);
            var cells = tr.querySelectorAll('td.Opta-Stat');
            if (cells.length < STAT_COLUMNS.length) return;

            var stats = {};
            STAT_COLUMNS.forEach(function (col, i) {
              var cell = cells[i];
              var raw = cell.getAttribute('data-srt');
              stats[col] = toInt(raw != null ? raw : cell.textContent);
            });

            var record = { id: id, name: name, stats: stats };
            if (id) byId[id] = record;   // dedup natural entre "All" y pestanas de equipo
            if (name) byName[name] = record;
          });

          return { byId: byId, byName: byName };
        }

        function lookup(statsMaps, player) {
          if (player.id && statsMaps.byId[player.id]) return statsMaps.byId[player.id];
          if (player.name && statsMaps.byName[player.name]) return statsMaps.byName[player.name];
          return null;
        }

        // ----------------------------------------- 3. Motor de consolidacion
        function consolidate(pairings, statsMaps) {
          var result = [];

          pairings.forEach(function (pair) {
            var tRec = lookup(statsMaps, pair.titular);
            var sRec = lookup(statsMaps, pair.suplente);
            var tStats = tRec ? tRec.stats : {};
            var sStats = sRec ? sRec.stats : {};

            var total = {};
            var changed = {}; // true si el suplente aporto (valor != 0) -> se resalta

            STAT_COLUMNS.forEach(function (col) {
              var tv = toInt(tStats[col]);
              var sv = toInt(sStats[col]);
              total[col] = tv + sv;
              changed[col] = sv !== 0;
            });

            var missing = [];
            if (!tRec) missing.push(pair.titular.name || '(titular ?)');
            if (!sRec) missing.push(pair.suplente.name || '(suplente ?)');

            result.push({
              team: pair.team,
              displayName: (tRec && tRec.name) || pair.titular.name, // hereda nombre del titular
              titular: pair.titular.name,
              suplente: pair.suplente.name,
              stats: total,
              changed: changed,
              missing: missing
            });
          });

          return result;
        }

        // ------------------------------------ 4/5. Render de la tabla final
        function buildTable(consolidated) {
          var table = document.createElement('table');
          table.className = 'supersub-table';

          var thead = document.createElement('thead');
          var htr = document.createElement('tr');
          var nameth = document.createElement('th');
          nameth.textContent = 'Player (SuperSub Stats)';
          nameth.className = 'supersub-name';
          htr.appendChild(nameth);
          STAT_COLUMNS.forEach(function (col) {
            var th = document.createElement('th');
            th.textContent = col;
            htr.appendChild(th);
          });
          thead.appendChild(htr);
          table.appendChild(thead);

          var tbody = document.createElement('tbody');
          consolidated.forEach(function (row) {
            var tr = document.createElement('tr');
            if (row.team) tr.setAttribute('data-team', row.team);

            var nameTd = document.createElement('td');
            nameTd.className = 'supersub-name supersub-team-' + (row.team || 'unknown');
            nameTd.textContent = row.displayName;
            nameTd.title = row.titular + ' + ' + row.suplente;
            tr.appendChild(nameTd);

            STAT_COLUMNS.forEach(function (col) {
              var td = document.createElement('td');
              td.textContent = row.stats[col];
              if (row.changed[col]) td.classList.add('supersub-changed'); // rojo claro
              tr.appendChild(td);
            });
            tbody.appendChild(tr);
          });
          table.appendChild(tbody);

          return table;
        }

        function injectStyles() {
          if (document.getElementById('supersub-styles')) return;
          var css = [
            '#supersub-panel{margin:16px 0;font:12px/1.4 Arial,Helvetica,sans-serif;}',
            '#supersub-panel .supersub-header{display:flex;align-items:center;justify-content:space-between;margin:0 0 8px;}',
            '#supersub-panel .supersub-title{font-size:14px;font-weight:700;margin:0;}',
            '#supersub-panel .supersub-close{border:1px solid #ccc;background:#fff;border-radius:6px;cursor:pointer;font-size:12px;line-height:1;padding:3px 7px;}',
            '.supersub-table{border-collapse:collapse;width:100%;}',
            '.supersub-table th,.supersub-table td{border:1px solid #d9d9d9;padding:4px 8px;text-align:center;}',
            '.supersub-table thead th{background:#1f1f1f;color:#fff;font-weight:600;}',
            '.supersub-table td.supersub-name,.supersub-table th.supersub-name{text-align:left;white-space:nowrap;font-weight:600;}',
            '.supersub-table tbody tr:nth-child(even){background:#fafafa;}',
            '.supersub-table td.supersub-name.supersub-team-home{background:#d6e6fb;}',
            '.supersub-table td.supersub-name.supersub-team-away{background:#d8f3dc;}',
            '#supersub-panel .supersub-legend{display:flex;gap:16px;align-items:center;margin:0 0 8px;font-size:12px;color:#333;}',
            '#supersub-panel .supersub-chip{display:inline-block;width:12px;height:12px;border:1px solid #bbb;border-radius:3px;margin-right:5px;vertical-align:middle;}',
            '#supersub-panel .supersub-chip.supersub-team-home{background:#d6e6fb;}',
            '#supersub-panel .supersub-chip.supersub-team-away{background:#d8f3dc;}',
            '.supersub-table td.supersub-changed{background:#f8caca !important;color:#7a0010;font-weight:700;}'
          ].join('\n');
          var style = document.createElement('style');
          style.id = 'supersub-styles';
          style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
        }

        // --------------------------------------------------- Cierre / limpieza
        function closeTool() {
          if (mainObserver) mainObserver.disconnect();
          if (mainInterval) clearInterval(mainInterval);
          var panel = document.getElementById(PANEL_ID);
          if (panel) panel.remove();
          window[STATE_KEY] = { active: false, observer: null, interval: null };
        }
        window.__SuperSubClose = closeTool;

        // ------------------------------------------------- DOM listo?
        function dataReady() {
          var hasSub = document.querySelector('li.Opta-Event-Type-990 .Opta-IconOn');
          var hasStats = document.querySelector('table.Opta-Striped tbody tr[role="row"] td.Opta-Stat');
          return !!(hasSub && hasStats);
        }

        function signatureOf(consolidated) {
          return consolidated.map(function (r) {
            return r.displayName + ':' + STAT_COLUMNS.map(function (c) { return r.stats[c]; }).join(',');
          }).join('|');
        }

        function mountPanel(consolidated) {
          injectStyles();
          var prev = document.getElementById(PANEL_ID);
          if (prev) prev.remove();

          var panel = document.createElement('div');
          panel.id = PANEL_ID;

          var header = document.createElement('div');
          header.className = 'supersub-header';
          var title = document.createElement('h3');
          title.className = 'supersub-title';
          title.textContent = 'SuperSub - Substitutions: (' + consolidated.length + ')';
          var closeBtn = document.createElement('button');
          closeBtn.className = 'supersub-close';
          closeBtn.type = 'button';
          closeBtn.textContent = 'x';
          closeBtn.title = 'Cerrar';
          closeBtn.addEventListener('click', closeTool);
          header.appendChild(title);
          header.appendChild(closeBtn);

          panel.appendChild(header);

          // Leyenda de colores por equipo
          var legend = document.createElement('div');
          legend.className = 'supersub-legend';
          var legHome = document.createElement('span');
          legHome.innerHTML = '<span class="supersub-chip supersub-team-home"></span>Home';
          var legAway = document.createElement('span');
          legAway.innerHTML = '<span class="supersub-chip supersub-team-away"></span>Away';
          legend.appendChild(legHome);
          legend.appendChild(legAway);
          panel.appendChild(legend);

          panel.appendChild(buildTable(consolidated));

          // Inserta ANTES del contenedor de estadisticas (arriba para comparar mejor);
          // si no existe, al inicio del body como respaldo.
          var anchor = document.getElementById('opta-player-stats-container') || document.querySelector('.Opta_F_MP_container');
          if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor);
          else document.body.insertBefore(panel, document.body.firstChild);

          window.__SuperSubData = consolidated;
        }

        function render() {
          if (!dataReady()) return; // aun cargando -> esperar
          var pairings = parsePairings(document);
          var statsMaps = parseStats(document);
          var consolidated = consolidate(pairings, statsMaps);
          if (!consolidated.length) return;

          var sig = signatureOf(consolidated);
          if (sig === lastSignature && document.getElementById(PANEL_ID)) return; // sin cambios
          lastSignature = sig;
          mountPanel(consolidated);
        }

        // Primer intento + resiliencia ante carga tardia del widget Opta
        render();

        mainObserver = new MutationObserver(render);
        mainObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

        mainInterval = setInterval(render, 1000);

        window[STATE_KEY].observer = mainObserver;
        window[STATE_KEY].interval = mainInterval;
      })();

      return { ok: true };
    } catch (err) {
      console.error("[SuperSub] Error:", err);
      return { ok: false, error: String((err && err.message) || err) };
    }
  });
})();