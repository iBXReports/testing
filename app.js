
    // =========================================================================
    // 🔴 IMPORTANTE: PEGA AQUÍ LA URL DE TU WEB APP DE GOOGLE 🔴
    // =========================================================================
    const GAS_URL = "https://script.google.com/macros/s/AKfycbxtez1DVq_4IERovfzH4oCLIuS67uvTNaYSpf4HHDviOH8PxsVuAIhzbocAfPxW-6sE/exec"; 
    // =========================================================================

    // ── Estado global ──────────────────────────────────────────
    let globalAirlines    = [];
    let authenticatedPass = "";
    let isUserAdmin       = false;
    let allRecords        = [];
    let filteredRecords   = [];
    let currentPage       = 1;
    const PAGE_SIZE       = 20;
    let tableHeadersData  = [];
    let sessionTarget     = 'admin';
    let adminPollInterval = null;
    
    const COL = { fecha:0, aerolinea:3, vuelo:4, pax:10, agente:11, estado:13 };
    const TZ = "America/Santiago";
    
    const REPORT_HEADERS = [
      "Fecha Registro", "Hora Registro", "Operación", "Aerolínea", "Vuelo",
      "ETA/ETD", "Puerta", "Hora Inicio", "Hora Término", "Total Asistencias",
      "Nombre Pasajero", "Atendido Por", "Asistencia", "Estado del Pasajero"
    ];

    // ── Motor de Conexión API ────────
    async function fetchAPI(action, data = {}) {
      const payload = { action, ...data };
      try {
        const response = await fetch(GAS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(payload),
          redirect: 'follow'
        });
        return await response.json();
      } catch (error) {
        console.error("Error en la conexión:", error);
        throw error;
      }
    }

    window.onload = () => {
      addAgentField();
      addPassengerRow();
      syncAirlinesDropdown();
      applyThemeLabel();
      const remembered = localStorage.getItem('cmob_admin_pass');
      if (remembered) {
        document.getElementById('adminPassword').value = remembered;
        document.getElementById('rememberPassword').checked = true;
      }
    };

    // ── Tema ───────────────────────────────────────────────────
    function toggleTheme() {
      const html = document.documentElement;
      html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      applyThemeLabel();
    }
    function applyThemeLabel() {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      document.getElementById('themeToggleBtn').textContent = isDark ? '☀️ Claro' : '🌙 Oscuro';
    }

    // ── Navegación ─────────────────────────────────────────────
    function switchView(target) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      document.getElementById('view-' + target).classList.add('active');
      const btn = document.getElementById('nav-' + target);
      if (btn) btn.classList.add('active');
      if (target === 'admin') startAdminPolling(); else stopAdminPolling();
    }
    function gatekeeperAdmin() {
      if (isUserAdmin) { switchView('admin'); fetchExcelRecords(); return; }
      sessionTarget = 'admin'; switchView('login');
    }
    function startAdminPolling() {
      stopAdminPolling();
      adminPollInterval = setInterval(() => fetchExcelRecords(true), 10000);
    }
    function stopAdminPolling() {
      if (adminPollInterval) { clearInterval(adminPollInterval); adminPollInterval = null; }
    }
    function gatekeeperConfig() {
      if (isUserAdmin) { switchView('config'); buildAdminAirlinesList(); return; }
      sessionTarget = 'config'; switchView('login');
    }

    async function validateAdminLogin() {
      const inputPass = document.getElementById('adminPassword').value;
      const recordar = document.getElementById('rememberPassword').checked;
      
      const btn = document.querySelector('.login-box .btn');
      const originalText = btn.textContent;
      btn.textContent = "Validando..."; btn.disabled = true;

      try {
        const res = await fetchAPI('verificarPassword', { password: inputPass });
        if (res.success) {
          isUserAdmin = true; authenticatedPass = inputPass;
          if (recordar) localStorage.setItem('cmob_admin_pass', inputPass);
          else localStorage.removeItem('cmob_admin_pass');

          if (sessionTarget === 'config') {
            switchView('config'); buildAdminAirlinesList();
          } else {
            switchView('admin'); fetchExcelRecords();
          }
        } else { alert("Contraseña inválida. Intente nuevamente."); }
      } catch (error) {
        alert("Fallo de red conectando con el servidor.");
      }
      btn.textContent = originalText; btn.disabled = false;
    }

    // ── Aerolíneas ─────────────────────────────────────────────
    function renderFormAirlinesDropdown() {
      const select = document.getElementById('aerolinea');
      const previaSeleccion = select.value;
      select.innerHTML = '<option value="">-- Seleccione una Aerolínea --</option>';
      [...globalAirlines].sort().forEach(air => {
        const opt = document.createElement('option');
        opt.value = air; opt.textContent = air; select.appendChild(opt);
      });
      if (globalAirlines.includes(previaSeleccion)) select.value = previaSeleccion;
    }
    
    async function syncAirlinesDropdown() {
      try {
        globalAirlines = await fetchAPI('getAirlines');
        renderFormAirlinesDropdown();
      } catch(e) { console.error("Fallo al obtener aerolineas"); }
    }
    
    function buildAdminAirlinesList() {
      const container = document.getElementById('adminAirlinesUI');
      container.innerHTML = "";
      if (!globalAirlines.length) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted); font-size:0.85em;">No hay aerolíneas registradas.</div>';
        return;
      }
      [...globalAirlines].sort().forEach(air => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `<span class="airline-name">${air}</span><button class="btn btn-danger btn-sm" onclick="removeAirlineItem('${air}')">✕</button>`;
        container.appendChild(item);
      });
    }
    
    function addNewAirlineToList() {
      const input = document.getElementById('newAirlineName');
      const name = input.value.trim().toUpperCase();
      if (name && !globalAirlines.includes(name)) {
        globalAirlines.push(name); input.value = "";
        buildAdminAirlinesList();
        renderFormAirlinesDropdown();
      } else if (!name) { input.focus(); }
      else { alert(`"${name}" ya existe en el catálogo.`); }
    }
    
    function removeAirlineItem(targetName) {
      globalAirlines = globalAirlines.filter(i => i !== targetName);
      buildAdminAirlinesList();
      renderFormAirlinesDropdown();
    }
    
    async function pushAirlinesToServer() {
      const btn = document.getElementById('btn-save-airlines');
      btn.textContent = "Sincronizando..."; btn.disabled = true;
      try {
        const res = await fetchAPI('saveAirlines', { airlinesArray: globalAirlines, password: authenticatedPass });
        alert(res.msg);
        if (res.success) syncAirlinesDropdown();
      } catch(e) { alert("Error al contactar con la base de datos."); }
      btn.textContent = "✅ Confirmar Catálogo"; btn.disabled = false;
    }

    // ── Agentes ────────────────────────────────────────────────
    function addAgentField() {
      const container = document.getElementById('agents-list-container');
      const div = document.createElement('div');
      div.className = 'agent-entry';
      div.innerHTML = `
        <input type="text" class="agent-input-name" placeholder="Nombre Agente" oninput="syncAgentDropdowns()" required style="flex:1;text-transform:uppercase;">
        <button type="button" class="btn btn-danger btn-sm" onclick="removeAgentField(this)">✕</button>`;
      container.appendChild(div);
      syncAgentDropdowns();
    }
    function removeAgentField(btn) {
      const container = document.getElementById('agents-list-container');
      if (container.children.length > 1) { btn.parentElement.remove(); syncAgentDropdowns(); }
      else { alert("Debe registrar al menos un agente para el vuelo."); }
    }
    function syncAgentDropdowns() {
      let agents = [];
      document.querySelectorAll('.agent-input-name').forEach(inp => {
        const v = inp.value.trim().toUpperCase();
        if (v && !agents.includes(v)) agents.push(v);
      });
      document.querySelectorAll('.pax-agent-select').forEach(select => {
        const saved = select.value;
        select.innerHTML = '<option value="">-- Seleccionar Agente --</option>';
        agents.forEach(a => { const o = document.createElement('option'); o.value = a; o.textContent = a; select.appendChild(o); });
        if (agents.includes(saved)) select.value = saved;
      });
    }

    // ── Pasajeros ──────────────────────────────────────────────
    function addPassengerRow() {
      const container = document.getElementById('pax-container');
      const row = document.createElement('div');
      row.className = 'pax-row';
      row.innerHTML = `
        <div class="pax-field pax-field-name" data-label="Nombre Completo">
          <input type="text" class="pax-name" placeholder="Nombre completo" required>
        </div>
        <div class="pax-field" data-label="Asistencia">
          <select class="pax-service">
            <option value="WCHR">WCHR</option><option value="WCHS">WCHS</option>
            <option value="WCHC">WCHC</option><option value="ORUGA">ORUGA</option>
            <option value="DEAF/BLND">DEAF/BLND</option><option value="UMNR">UMNR</option>
            <option value="OTRO">OTRO</option>
          </select>
        </div>
        <div class="pax-field" data-label="Estado del Pasajero">
          <select class="pax-status" onchange="calculateMetrics()">
            <option value="PAX ASISTIDO">PAX ASISTIDO</option>
            <option value="NO ASISTIDO">NO ASISTIDO</option>
            <option value="NO CONTACTA">NO CONTACTA</option>
            <option value="NO MANIFESTADO">NO MANIFESTADO</option>
            <option value="NO REQUIERE ASISTENCIA">NO REQUIERE ASISTENCIA</option>
          </select>
        </div>
        <div class="pax-field" data-label="Atendido Por">
          <select class="pax-agent-select" required><option value="">-- Seleccionar Agente --</option></select>
        </div>
        <div class="pax-field pax-field-action">
          <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('.pax-row').remove(); calculateMetrics();">✕</button>
        </div>`;
      container.appendChild(row);
      syncAgentDropdowns(); calculateMetrics();
    }
    
    function calculateMetrics() {
      const rows = document.querySelectorAll('.pax-row');
      let asistidos = 0, noManif = 0, otros = 0;
      rows.forEach(row => {
        const s = row.querySelector('.pax-status').value;
        if (s === "PAX ASISTIDO") asistidos++;
        else if (s === "NO MANIFESTADO") noManif++;
        else otros++;
      });
      document.getElementById('count-total').textContent = rows.length;
      document.getElementById('count-asistidos').textContent = asistidos;
      document.getElementById('count-nomanif').textContent = noManif;
      document.getElementById('count-otros').textContent = otros;
    }

    // ── Formulario ─────────────────────────────────────────────
    function generateConsolidadoTexto(payload) {
      const totalPax  = payload.pasajeros.length;
      const asistidos = payload.pasajeros.filter(p => p.estado === "PAX ASISTIDO");
      const noManif   = payload.pasajeros.filter(p => p.estado === "NO MANIFESTADO");
      const noReq     = payload.pasajeros.filter(p => p.estado === "NO REQUIERE ASISTENCIA");
      let txt = `✈️${payload.tipoOperacion} Finalizado: ${payload.vuelo}\n`;
      txt += `⏰ETA/ETD: ${payload.etaEtd}\n🚪Puerta : ${payload.puerta}\n`;
      txt += `🕧Hora de Inicio : ${payload.horaInicio}\n🕧Hora de Termino : ${payload.horaTermino}\n`;
      txt += `🧑Asistencias: # de asistencias ${asistidos.length} / ${totalPax}\nPAX (LISTADO DE PASAJEROS):\n`;
      if (!payload.pasajeros.length) txt += "SIN PASAJEROS REGISTRADOS\n";
      else payload.pasajeros.forEach((p,i) => { txt += `${i+1}.- ${p.nombre} - ${p.asistencia} (${p.estado}) - ATENDIDO POR: ${p.agente||'SIN ASIGNAR'}\n`; });

      if (noManif.length > 0) {
        txt += `👤No manifestados: # de asistencias ${noManif.length}\n-(LISTADO DE PAX) NO MANIFESTADOS-\n`;
        noManif.forEach((p,i) => { txt += `${i+1}.- ${p.nombre} - ${p.asistencia} - ATENDIDO POR: ${p.agente||'SIN ASIGNAR'}\n`; });
        txt += "❌ NO REQUIEREN ASISTENCIA\n";
        if (noReq.length) noReq.forEach((p,i) => { txt += `${i+1}.- ${p.nombre} - ${p.asistencia} - ATENDIDO POR: ${p.agente||'SIN ASIGNAR'}\n`; });
        else txt += "SIN PAX EN ESTA CATEGORÍA\n";
      } else {
        txt += "❌ NO REQUIEREN ASISTENCIA\n";
        if (noReq.length) noReq.forEach((p,i) => { txt += `${i+1}.- ${p.nombre} - ${p.asistencia} - ATENDIDO POR: ${p.agente||'SIN ASIGNAR'}\n`; });
        else txt += "-SIN PAX-\n";
      }

      txt += `\n🛎️ LIST@ PARA PROXIMAS ASIGNACIONES!`;
      return txt;
    }

    async function sendFormToServer() {
      const aerolinea = document.getElementById('aerolinea').value;
      const vuelo = document.getElementById('vuelo').value.trim().toUpperCase();
      if (!aerolinea || !vuelo) { alert("Por favor complete los campos obligatorios del vuelo."); return; }
      let agentesArray = [];
      document.querySelectorAll('.agent-input-name').forEach(inp => { const v = inp.value.trim().toUpperCase(); if (v) agentesArray.push(v); });
      if (!agentesArray.length) { alert("Por favor ingrese al menos un agente."); return; }
      let validado = true, listaPasajeros = [], totalAsist = 0;
      document.querySelectorAll('.pax-row').forEach(row => {
        const nombre = row.querySelector('.pax-name').value.trim().toUpperCase();
        const service = row.querySelector('.pax-service').value;
        const status  = row.querySelector('.pax-status').value;
        const agente  = row.querySelector('.pax-agent-select').value;
        if (nombre) { if (!agente) validado = false; listaPasajeros.push({ nombre, asistencia: service, estado: status, agente }); if (status === "PAX ASISTIDO") totalAsist++; }
      });
      if (!validado) { alert("Por favor, asigne qué agente atendió a cada pasajero."); return; }
      
      const btn = document.getElementById('btn-submit');
      btn.textContent = "Guardando en la nube..."; btn.disabled = true;
      
      const payload = {
        tipoOperacion: document.getElementById('tipoOperacion').value, aerolinea, vuelo,
        etaEtd:      document.getElementById('etaEtd').value,
        puerta:      document.getElementById('puerta').value.toUpperCase(),
        horaInicio:  document.getElementById('horaInicio').value,
        horaTermino: document.getElementById('horaTermino').value,
        totalAsistencias: totalAsist, agentes: agentesArray.join(" - "), pasajeros: listaPasajeros
      };
      
      try {
        const res = await fetchAPI('salvarRegistro', { datos: payload });
        if (res.success) {
          document.getElementById('consolidadoTextArea').value = generateConsolidadoTexto(payload);
          document.getElementById('consolidadoModal').classList.add('active');
          document.getElementById('mainForm').reset();
          document.getElementById('pax-container').innerHTML = "";
          document.getElementById('agents-list-container').innerHTML = "";
          addAgentField(); addPassengerRow();
        } else { alert(res.msg); }
      } catch(e) {
        alert("Error de conexión al guardar el registro.");
      }
      btn.textContent = "💾 Guardar Registro General"; btn.disabled = false;
    }
    
    function copyConsolidadoText() {
      const ta = document.getElementById('consolidadoTextArea');
      ta.select(); navigator.clipboard.writeText(ta.value).then(() => { alert("¡Reporte copiado con éxito!"); });
    }
    function closeModal() { document.getElementById('consolidadoModal').classList.remove('active'); }

    // ── Exportar a Excel / Respaldo ─────────────────────────────
    async function downloadBackup() {
      try {
        const resAirlines = await fetchAPI('getAirlines');
        const resRecords = await fetchAPI('obtenerRegistros', { password: authenticatedPass });
        if(resRecords.error) { alert(resRecords.error); return; }

        const payload = {
          generatedAt: new Date().toISOString(),
          airlines: resAirlines,
          records: resRecords.data
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        const dt = new Date();
        const stamp = `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
        link.href = URL.createObjectURL(blob);
        link.download = "Respaldo_CMOB_Completo_" + stamp + ".json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 3000);
      } catch (e) { alert("No se pudo descargar el respaldo: " + e.message); }
    }
    
    function toggleExportInputs() {
      const tipo = document.getElementById('export-tipo').value;
      document.getElementById('export-input-dia').style.display = (tipo === 'dia') ? '' : 'none';
      document.getElementById('export-input-rango-inicio').style.display = (tipo === 'rango') ? '' : 'none';
      document.getElementById('export-input-rango-fin').style.display = (tipo === 'rango') ? '' : 'none';
      document.getElementById('export-input-mes').style.display = (tipo === 'mes') ? '' : 'none';
      document.getElementById('export-input-anio').style.display = (tipo === 'anio') ? '' : 'none';
    }
    
    async function exportToExcel() {
      const tipo = document.getElementById('export-tipo').value;
      const filtro = { tipo };
      if (tipo === 'dia') {
        filtro.fecha = document.getElementById('export-fecha').value;
        if (!filtro.fecha) { alert("Seleccione una fecha."); return; }
      } else if (tipo === 'rango') {
        filtro.fechaInicio = document.getElementById('export-fecha-inicio').value;
        filtro.fechaFin = document.getElementById('export-fecha-fin').value;
        if (!filtro.fechaInicio || !filtro.fechaFin) { alert("Seleccione el rango de fechas completo."); return; }
      } else if (tipo === 'mes') {
        filtro.mes = document.getElementById('export-mes').value;
        if (!filtro.mes) { alert("Seleccione un mes."); return; }
      } else if (tipo === 'anio') {
        filtro.anio = document.getElementById('export-anio').value;
        if (!filtro.anio) { alert("Ingrese un año."); return; }
      }
      
      const btn = document.getElementById('btn-export-excel');
      const originalText = btn.textContent;
      btn.textContent = "⏳ Generando archivo..."; btn.disabled = true;

      try {
        const res = await fetchAPI('exportarRegistros', { password: authenticatedPass, filtro: filtro });
        btn.textContent = originalText; btn.disabled = false;
        
        if (!res.success) { alert(res.msg || "No se pudo generar el archivo."); return; }
        
        const byteChars = atob(res.base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 3000);
      } catch (err) {
        btn.textContent = originalText; btn.disabled = false;
        alert("Error al exportar. Compruebe su conexión.");
      }
    }

    // ── Tabla Admin ────────────────────────────────────────────
    async function fetchExcelRecords(silent) {
      if (!silent) {
        document.getElementById('tableBody').innerHTML =
          '<tr><td colspan="14" style="text-align:center;padding:30px;color:var(--text-muted);font-style:italic;">⏳ Sincronizando base de datos...</td></tr>';
      }
      
      try {
        const res = await fetchAPI('obtenerRegistros', { password: authenticatedPass });
        
        if (res.error) { stopAdminPolling(); alert(res.error); switchView('login'); return; }
        const data = res.data;
        if (!data || data.length < 1) {
          allRecords = []; filteredRecords = [];
          tableHeadersData = REPORT_HEADERS;
          renderHeaders();
          document.getElementById('tableBody').innerHTML = '<tr><td colspan="14" style="text-align:center;padding:30px;color:var(--text-muted);">No se encontraron registros.</td></tr>';
          document.getElementById('paginationInfo').textContent = "Sin registros";
          document.getElementById('paginationControls').innerHTML = "";
          return;
        }
        const primeraCelda = (data[0][0] || '').toString().trim().toUpperCase();
        const tieneCabecera = primeraCelda === 'FECHA REGISTRO';
        tableHeadersData = tieneCabecera ? data[0] : REPORT_HEADERS;
        const filas = tieneCabecera ? data.slice(1) : data;
        allRecords = filas.slice().reverse();
        renderHeaders();

        const hasFilter = document.getElementById('filter-date').value
          || document.getElementById('filter-airline-flight').value.trim()
          || document.getElementById('filter-pax-agent').value.trim();
        if (!silent) currentPage = 1;
        if (hasFilter) { applyFilters(); } else { filteredRecords = [...allRecords]; renderPage(); }
        
      } catch (error) {
        if (!silent) {
           document.getElementById('tableBody').innerHTML = '<tr><td colspan="14" style="text-align:center;padding:30px;color:var(--danger);">Error al sincronizar con el servidor.</td></tr>';
        }
      }
    }
    
    function renderHeaders() {
      const thead = document.getElementById('tableHeaders');
      thead.innerHTML = "";
      tableHeadersData.forEach(h => { const th = document.createElement('th'); th.textContent = h; thead.appendChild(th); });
    }
    function renderPage() {
      const tbody = document.getElementById('tableBody');
      tbody.innerHTML = "";
      const total = filteredRecords.length;
      const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
      if (currentPage > totalPages) currentPage = totalPages;
      const start = (currentPage - 1) * PAGE_SIZE;
      const end   = Math.min(start + PAGE_SIZE, total);
      const slice = filteredRecords.slice(start, end);
      if (!slice.length) {
        tbody.innerHTML = `<tr><td colspan="${tableHeadersData.length||14}" style="text-align:center;padding:40px;color:var(--text-muted);">🔍 No se encontraron registros con los filtros aplicados.</td></tr>`;
      } else {
        slice.forEach(row => {
          const tr = document.createElement('tr');
          row.forEach((cell, idx) => {
            const td = document.createElement('td');
            td.textContent = cell;
            if (idx === COL.estado && (cell || '').toString().trim().toUpperCase() === 'NO MANIFESTADO') {
              td.classList.add('estado-no-manifestado');
            }
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      }
      document.getElementById('paginationInfo').textContent =
        total > 0
          ? `Mostrando ${start+1}–${end} de ${total} registros${allRecords.length !== total ? ` (filtrados de ${allRecords.length})` : ''}`
          : "Sin registros";
      renderPagination(totalPages);
    }
    function renderPagination(totalPages) {
      const container = document.getElementById('paginationControls');
      container.innerHTML = "";
      if (totalPages <= 1) return;
      const mkBtn = (label, page, disabled, active) => {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (active ? ' active' : '');
        btn.textContent = label; btn.disabled = disabled;
        if (!disabled && !active) btn.onclick = () => { currentPage = page; renderPage(); };
        container.appendChild(btn);
      };
      const dot = () => { const s = document.createElement('span'); s.textContent = '…'; s.style.cssText = 'color:var(--text-muted);font-size:0.85em;padding:0 4px;'; container.appendChild(s); };
      mkBtn('‹', currentPage-1, currentPage===1, false);
      let s = Math.max(1, currentPage-2), e = Math.min(totalPages, currentPage+2);
      if (s > 1) { mkBtn('1', 1, false, false); if (s > 2) dot(); }
      for (let p = s; p <= e; p++) mkBtn(p, p, false, p === currentPage);
      if (e < totalPages) { if (e < totalPages-1) dot(); mkBtn(totalPages, totalPages, false, false); }
      mkBtn('›', currentPage+1, currentPage===totalPages, false);
    }

    // ── Filtros ────────────────────────────────────────────────
    function normalizeDate(str) {
      if (!str) return '';
      const p = str.split('/');
      if (p.length === 3) return `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
      return str;
    }
    function applyFilters() {
      const dateVal = document.getElementById('filter-date').value;
      const afRaw   = document.getElementById('filter-airline-flight').value.trim().toUpperCase();
      const paRaw   = document.getElementById('filter-pax-agent').value.trim().toLowerCase();
      filteredRecords = allRecords.filter(row => {
        if (dateVal && normalizeDate(row[COL.fecha]||'') !== dateVal) return false;
        if (afRaw) {
          const a = (row[COL.aerolinea]||'').toUpperCase(), v = (row[COL.vuelo]||'').toUpperCase();
          if (!a.includes(afRaw) && !v.includes(afRaw)) return false;
        }
        if (paRaw) {
          const px = (row[COL.pax]||'').toLowerCase(), ag = (row[COL.agente]||'').toLowerCase();
          if (!px.includes(paRaw) && !ag.includes(paRaw)) return false;
        }
        return true;
      });
      const hasFilter = dateVal || afRaw || paRaw;
      const strip = document.getElementById('info-strip-results');
      if (hasFilter) {
        strip.style.display = 'flex';
        document.getElementById('info-strip-text').textContent = `Se encontraron ${filteredRecords.length} registro(s) que coinciden con la búsqueda.`;
      } else { strip.style.display = 'none'; }
      currentPage = 1; renderPage();
    }
    function clearFilters(render = true) {
      document.getElementById('filter-date').value = '';
      document.getElementById('filter-airline-flight').value = '';
      document.getElementById('filter-pax-agent').value = '';
      document.getElementById('info-strip-results').style.display = 'none';
      filteredRecords = [...allRecords];
      if (render) { currentPage = 1; renderPage(); }
    }
// app.js

function showAdminSection(sec) {
    document.querySelectorAll('.admin-section').forEach(s => s.style.display = 'none');
    document.getElementById('admin-sec-' + sec).style.display = 'block';
}

function switchView(target) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + target).classList.add('active');
}

// Lógica para forzar minúsculas en el input de contraseña
const passInput = document.getElementById('adminPassword');
if (passInput) {
    passInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toLowerCase();
    });
}

