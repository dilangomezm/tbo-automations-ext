/**
 * SuperSub.js
 * Automatizacion modular para la extension.
 * Consolida las estadisticas de un jugador TITULAR y su SUPLENTE como si
 * fueran un solo jugador, resalta las celdas que cambiaron y permite generar
 * enlaces por estadistica hacia el evento en TBO.
 *
 * Columnas: G | A | RC | YC | Crn | S | SOnT | BS | P | C | Tk | O | FC | FW | SAV
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

        // Nombre de mercado (WWWW) por columna. marketInputType=NAME, se envia URL-encoded.
        // Crn y C no estan aqui (no interesan). BS tiene manejo especial en buildStatLink.
        // >>> Si algun nombre de mercado no coincide con TBO, ajustalo aqui. <<<
        var MARKET_MAP = {
          G: 'goals',
          A: 'Assist',
          RC: 'Card',
          YC: 'Card',
          S: '+ Shots',
          SOnT: '+ Shots on Goal',
          P: 'Passes',
          Tk: '+ Tackles',
          O: '+ Offsides',
          FC: '+ Fouls Committed',
          FW: 'Player to Win',
          SAV: '+ Saves'
        };

        var HOST_BASE = 'https://leo-prod-trading-bo.k8s.goldrush.llc/events/details/';

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

        // Estado del campo de link (se conserva si el panel se reconstruye)
        var eventLinkValue = '';
        var linksGenerated = false;

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

            result.push({
              team: pair.team,
              displayName: (tRec && tRec.name) || pair.titular.name, // hereda nombre del titular
              titular: pair.titular.name,
              suplente: pair.suplente.name,
              stats: total,
              changed: changed
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
          nameth.textContent = 'Jugador (SuperSub)';
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
              td.setAttribute('data-col', col);
              td.setAttribute('data-value', String(row.stats[col]));
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
            '#supersub-panel .supersub-legend{display:flex;gap:16px;align-items:center;margin:0 0 8px;font-size:12px;color:#333;}',
            '#supersub-panel .supersub-chip{display:inline-block;width:12px;height:12px;border:1px solid #bbb;border-radius:3px;margin-right:5px;vertical-align:middle;}',
            '#supersub-panel .supersub-chip.supersub-team-home{background:#d6e6fb;}',
            '#supersub-panel .supersub-chip.supersub-team-away{background:#d8f3dc;}',
            '.supersub-table{border-collapse:collapse;width:100%;}',
            '.supersub-table th,.supersub-table td{border:1px solid #d9d9d9;padding:4px 8px;text-align:center;}',
            '.supersub-table thead th{background:#1f1f1f;color:#fff;font-weight:600;}',
            '.supersub-table td.supersub-name,.supersub-table th.supersub-name{text-align:left;white-space:nowrap;font-weight:600;}',
            '.supersub-table tbody tr:nth-child(even){background:#fafafa;}',
            '.supersub-table td.supersub-name.supersub-team-home{background:#d6e6fb;}',
            '.supersub-table td.supersub-name.supersub-team-away{background:#d8f3dc;}',
            '.supersub-table td.supersub-changed{background:#f8caca !important;color:#7a0010;font-weight:700;}',
            '.supersub-table a.supersub-link{color:#0645ad;text-decoration:underline;font-weight:700;}',
            '#supersub-panel .supersub-footer{display:flex;gap:8px;align-items:center;margin:10px 0 2px;flex-wrap:wrap;}',
            '#supersub-panel .supersub-lbl{font-size:12px;font-weight:600;white-space:nowrap;}',
            '#supersub-panel .supersub-input{flex:1;min-width:280px;padding:6px 8px;border:1px solid #ccc;border-radius:6px;font-size:12px;}',
            '#supersub-panel .supersub-generate{border:none;background:#1f6feb;color:#fff;border-radius:6px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;}',
            '#supersub-panel .supersub-generate:hover{background:#1a5fd0;}'
          ].join('\n');
          var style = document.createElement('style');
          style.id = 'supersub-styles';
          style.textContent = css;
          (document.head || document.documentElement).appendChild(style);
        }

        // --------------------------------------------- Construccion de links
        // Transforma el nombre mostrado en el "outcome" (ZZZZ):
        //  - "F. Torres"        -> "Torres"          (inicial + punto -> solo el resto)
        //  - "G. de Arrascaeta" -> "de Arrascaeta"
        //  - "Matheus Cunha"    -> "Matheus Cunha"   (nombre completo se deja igual)
        function outcomeName(displayName) {
          var name = (displayName || '').trim();
          var m = name.match(/^[^\s.]\.\s*(.+)$/); // una inicial, punto, luego el resto
          return m ? m[1].trim() : name;
        }

        // Extrae la base ".../events/details/<id>" del link que pega el usuario.
        function parseEventBase(input) {
          input = (input || '').trim();
          if (!input) return null;
          var m = input.match(/^(https?:\/\/[^\s?#]*\/events\/details\/)(\d+)/);
          if (m) return m[1] + m[2];
          var only = input.match(/(\d{3,})/); // por si pegan solo el id
          if (only) return HOST_BASE + only[1];
          return null;
        }

        // Construye el href para una estadistica dada. Devuelve null si no aplica.
        function buildStatLink(base, col, playerName) {
          var params = 'detail=markets&groups=player-props&scores=odds,risk';
          var zzzz = outcomeName(playerName);

          if (col === 'BS') {
            // Caso especial: market = "<jugador> 1st Shot (inc ET)" y SIN outcome
            var wwwwBs = zzzz + ' 1st Shot (inc ET)';
            return base + '?' + params + '&market=' + encodeURIComponent(wwwwBs) + '&marketInputType=NAME';
          }

          var market = MARKET_MAP[col];
          if (!market) return null; // Crn, C u otras sin mapping -> sin enlace
          return base + '?' + params + '&market=' + encodeURIComponent(market) +
                 '&marketInputType=NAME&outcome=' + encodeURIComponent(zzzz);
        }

        // Convierte en enlaces las celdas modificadas (excepto Crn y C).
        function applyLinks(table, base) {
          if (mainObserver) { try { mainObserver.disconnect(); } catch (e) {} }

          var rows = table.querySelectorAll('tbody tr');
          Array.prototype.forEach.call(rows, function (tr) {
            var nameCell = tr.querySelector('.supersub-name');
            if (!nameCell) return;
            var playerName = nameCell.textContent.trim();

            var cells = tr.querySelectorAll('td[data-col]');
            Array.prototype.forEach.call(cells, function (td) {
              var col = td.getAttribute('data-col');
              if (!td.classList.contains('supersub-changed')) return; // solo las que cambiaron
              if (col === 'Crn' || col === 'C') return;               // excepciones

              var href = buildStatLink(base, col, playerName);
              if (!href) return;

              var value = td.getAttribute('data-value');
              if (value == null) value = td.textContent;

              td.textContent = '';
              var a = document.createElement('a');
              a.href = href;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.className = 'supersub-link';
              a.textContent = value;
              td.appendChild(a);
            });
          });

          if (mainObserver) {
            try {
              mainObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
            } catch (e) {}
          }
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

          // Header con boton de cierre
          var header = document.createElement('div');
          header.className = 'supersub-header';
          var title = document.createElement('h3');
          title.className = 'supersub-title';
          title.textContent = 'SuperSub - Titular + Suplente (' + consolidated.length + ')';
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
          legHome.innerHTML = '<span class="supersub-chip supersub-team-home"></span>Local';
          var legAway = document.createElement('span');
          legAway.innerHTML = '<span class="supersub-chip supersub-team-away"></span>Visitante';
          legend.appendChild(legHome);
          legend.appendChild(legAway);
          panel.appendChild(legend);

          // Tabla de resultados
          var tableNode = buildTable(consolidated);
          panel.appendChild(tableNode);

          // Campo "TBO Event Link" + boton "Generate Links"
          var footer = document.createElement('div');
          footer.className = 'supersub-footer';
          var lbl = document.createElement('label');
          lbl.className = 'supersub-lbl';
          lbl.textContent = 'TBO Event Link';
          var input = document.createElement('input');
          input.type = 'text';
          input.className = 'supersub-input';
          input.placeholder = HOST_BASE + '1591547';
          input.value = eventLinkValue;
          input.addEventListener('input', function () { eventLinkValue = input.value; });
          var genBtn = document.createElement('button');
          genBtn.type = 'button';
          genBtn.className = 'supersub-generate';
          genBtn.textContent = 'Generate Links';
          genBtn.addEventListener('click', function () {
            eventLinkValue = input.value;
            var base = parseEventBase(eventLinkValue);
            if (!base) { input.style.borderColor = '#c00'; input.focus(); return; }
            input.style.borderColor = '';
            linksGenerated = true;
            applyLinks(tableNode, base);
          });
          footer.appendChild(lbl);
          footer.appendChild(input);
          footer.appendChild(genBtn);
          panel.appendChild(footer);

          // Inserta ANTES del contenedor de estadisticas (arriba para comparar mejor);
          // si no existe, al inicio del body como respaldo.
          var anchor = document.getElementById('opta-player-stats-container') || document.querySelector('.Opta_F_MP_container');
          if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor);
          else document.body.insertBefore(panel, document.body.firstChild);

          // Si ya se habian generado los enlaces, reaplicarlos tras el re-render
          if (linksGenerated) {
            var restoreBase = parseEventBase(eventLinkValue);
            if (restoreBase) applyLinks(tableNode, restoreBase);
          }

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
