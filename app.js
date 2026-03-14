/* ══════════════════════════════════════════════════════════════════════
   app.js — Core Logic, Rendering, CRUD, and Bootstrapping
══════════════════════════════════════════════════════════════════════ */

// ── API Layer ───────────────────────────────────────────────────────
async function apiFetch(path, options) {
  options = options || {};
  var res = await fetch(API_BASE + path, {
    headers: Object.assign({'Content-Type':'application/json'}, options.headers || {}),
    method: options.method || 'GET',
    body:   options.body   || undefined,
  });
  if (!res.ok) {
    var e = await res.text().catch(function() { return res.statusText; });
    throw new Error(e || 'HTTP ' + res.status);
  }
  return res.json();
}

async function loadDashboardStats() {
  try {
    var data = await apiFetch('/api/dashboard');
    if (data && typeof data === 'object') {
      var sv = document.querySelectorAll('#sec-dashboard .stat-value');
      if (data.total_patients   !== undefined && sv[0]) sv[0].textContent = Number(data.total_patients).toLocaleString();
      if (data.total_doctors    !== undefined && sv[1]) sv[1].textContent = data.total_doctors;
      if (data.total_nurses     !== undefined && sv[2]) sv[2].textContent = data.total_nurses;
      if (data.icu_beds         !== undefined && sv[3]) sv[3].textContent = data.icu_beds;
      if (data.ambulances       !== undefined && sv[4]) sv[4].textContent = data.ambulances;
      if (data.oxygen_cylinders !== undefined && sv[5]) sv[5].textContent = data.oxygen_cylinders;
    }
  } catch (_) { /* silently use static values */ }
}

async function loadSectionData(sectionId) {
  try {
    if      (sectionId === 'icu')        { renderBedGrid(await apiFetch('/api/icu')); }
    else if (sectionId === 'doctors')    { renderDoctorsTable(await apiFetch('/api/doctors')); }
    else if (sectionId === 'ambulances') { renderAmbGrid(await apiFetch('/api/ambulances')); }
    else if (sectionId === 'oxygen')     { renderTankGrid(await apiFetch('/api/oxygen')); }
    else if (sectionId === 'issues')     { await loadIssues(); }
    else if (sectionId === 'reports')    { 
        var res = await apiFetch('/api/reports');
        renderMLCReports(res.reports); 
    }
    else if (sectionId === 'patients')   {
        var expiring = await apiFetch('/api/patients/expiring-consultations');
        renderExpiringPatients(expiring);
    }
  } catch (err) {
    console.warn('[MedCMD] API offline for', sectionId, '—', err.message);
    showToast('Using local data (API offline — ' + sectionId + ')', 'info');
    
    // Fallback for the patients/WhatsApp tab
    if (sectionId === 'patients') {
        renderExpiringPatients(typeof expiringPatientsSeed !== 'undefined' ? expiringPatientsSeed : []);
    }
  }
}

// ── AI Predictive Surge ─────────────────────────────────────────────
async function loadPredictiveSurge() {
  try {
    var data = await apiFetch('/api/predict-surge');
    var banner = document.getElementById('alert-banner');
    
    if (banner && data.surge_risk === "High") {
      banner.style.display = 'flex';
      banner.style.background = 'linear-gradient(100deg, #fffbeb 0%, #ffffff 80%)';
      banner.style.borderColor = '#fde68a';
      
      banner.innerHTML = `
        <span class="alert-banner-icon" style="animation: pulse-dot 2s infinite;">⚠️</span>
        <div class="alert-banner-text">
          <strong style="color: #d97706;">AI SURGE PREDICTION: Heatwave & High AQI (${data.external_factors.aqi}) Detected.</strong>&nbsp; 
          Expecting ${data.predicted_inflow}. <br/><span style="color:var(--n600); font-size: 11.5px;"><b>System Recommendation:</b> ${data.action_alert}</span>
        </div>
        <button class="alert-banner-ack" style="color: #d97706; border-color: #fde68a;" onclick="this.parentElement.style.display='none'">Acknowledge</button>
      `;
    }
  } catch (e) {
    console.log("Predictive AI offline", e);
  }
}

// ── Rendering Functions ─────────────────────────────────────────────
var statusTagMap = {
  occupied:   {cls:'bst-occupied',   label:'Occupied',    dot:'#ef4444'},
  available:  {cls:'bst-available',  label:'Available',   dot:'#22c55e'},
  maintenance:{cls:'bst-maintenance',label:'Maintenance', dot:'#b0bdb0'},
  reserved:   {cls:'bst-reserved',   label:'Reserved',    dot:'#f59e0b'},
};

var ambStatusCfg = {
  available:    {label:'Available',   bg:'#f0fdf4',dot:'#22c55e',iconBg:'#dcfce7'},
  'on-mission': {label:'On Mission',  bg:'#fef2f2',dot:'#ef4444',iconBg:'#fee2e2'},
  maintenance:  {label:'Maintenance', bg:'#f7f9f7',dot:'#b0bdb0',iconBg:'#eff3ef'},
};

function renderBedGrid(beds) {
  var grid = document.getElementById('bed-grid');
  if (!grid) return;
  var isHead = USER_ROLE === 'HEAD';
  grid.innerHTML = beds.map(function(b) {
    var s = statusTagMap[b.status] || statusTagMap.available;
    var editBtn = isHead
      ? '<div style="display:flex;gap:5px;margin-top:8px;"><button class="btn-sm btn-outline" style="flex:1;font-size:10px;padding:3px 0;" onclick=\'openEditICU(' + JSON.stringify(b) + ')\'>Edit</button><button class="btn-sm btn-danger" style="font-size:10px;padding:3px 8px;" onclick="deleteICUBed(\'' + b._id + '\')">✕</button></div>'
      : '';
    return '<div class="bed-card"><div class="bed-num">' + (b.bed_number||b.id) + '</div>'
      + '<div class="bed-status-tag ' + s.cls + '"><span style="width:5px;height:5px;border-radius:50%;background:' + s.dot + ';display:inline-block;"></span>' + s.label + '</div>'
      + (b.patient_name ? '<div class="bed-patient">' + b.patient_name + '</div><div class="bed-cond">' + (b.cond||'') + '</div>' : '<div class="bed-cond" style="color:var(--n300);">—</div>')
      + editBtn + '</div>';
  }).join('');
}

function renderDoctorsTable(docs) {
  var tbody = document.getElementById('doctors-full-tbody');
  if (!tbody) return;
  var isHead = USER_ROLE === 'HEAD';
  tbody.innerHTML = docs.map(function(d) {
    var ini = d.name.split(' ').pop()[0];
    var on  = d.status === 'on-duty';
    var actions = isHead
      ? '<button class="btn-sm btn-outline" onclick=\'openEditDoctor(' + JSON.stringify(d) + ')\'>Edit</button><button class="btn-sm btn-danger" onclick="deleteDoctor(\'' + d._id + '\')" style="margin-left:4px;">Delete</button>'
      : '<span style="font-size:11px;color:var(--n400);">View only</span>';
    return '<tr><td><div class="doc-cell"><div class="doc-avt">' + ini + '</div><span class="doc-name">' + d.name + '</span></div></td>'
      + '<td><span class="dept-pill">' + (d.dept||d.specialization||'') + '</span></td>'
      + '<td style="font-family:\'IBM Plex Mono\';font-size:12px;color:var(--n600);">' + (d.shift||'—') + '</td>'
      + '<td style="text-align:center;font-family:\'IBM Plex Mono\';font-size:12px;font-weight:700;color:var(--n700);">' + (d.appts||d.appointments||0) + '</td>'
      + '<td><span class="status-chip ' + (on?'sc-on':'sc-off') + '"><span class="sc-dot"></span>' + (on?'On Duty':'Off Duty') + '</span></td>'
      + '<td>' + actions + '</td></tr>';
  }).join('');
}

function renderAmbGrid(ambs) {
  var grid = document.getElementById('amb-grid');
  if (!grid) return;
  var isHead = USER_ROLE === 'HEAD';
  grid.innerHTML = ambs.map(function(a) {
    var c = ambStatusCfg[a.status] || ambStatusCfg.available;
    var actions = isHead
      ? '<button class="btn-sm btn-outline" onclick=\'openEditAmbulance(' + JSON.stringify(a) + ')\'>Edit</button>'
        + (a.status==='available' ? '<button class="btn-sm btn-green" onclick="dispatchAmbulance(\'' + a._id + '\')">Dispatch</button>' : '')
      : '';
    return '<div class="amb-card">'
      + '<div class="amb-header"><div><div class="amb-id">' + (a.id||a.vehicle_id||'') + '</div><div class="amb-driver">' + (a.driver||'') + '</div></div>'
      + '<div class="amb-icon" style="background:' + c.iconBg + ';">🚑</div></div>'
      + '<div class="amb-info">📍 ' + (a.location||'—') + '</div>'
      + '<div class="amb-info" style="color:var(--n400);">🛣 ' + (a.km||'—') + ' km</div>'
      + '<div style="margin-top:6px;"><span class="status-chip" style="background:' + c.bg + ';color:var(--n700);border:1px solid ' + c.bg + ';"><span style="width:5px;height:5px;border-radius:50%;background:' + c.dot + ';display:inline-block;"></span>&nbsp;' + c.label + '</span></div>'
      + '<div class="amb-actions">' + actions + '</div></div>';
  }).join('');
}

function renderTankGrid(tanks) {
  var grid = document.getElementById('tank-grid');
  if (!grid) return;
  var isHead = USER_ROLE === 'HEAD';
  grid.innerHTML = tanks.map(function(t) {
    var pct = t.total > 0 ? Math.round((t.active/t.total)*100) : 0;
    var col = t.low ? '#ef4444' : pct>60 ? '#22c55e' : pct>30 ? '#f59e0b' : '#ef4444';
    var editBtn = isHead
      ? '<button class="btn-sm btn-outline" style="font-size:10px;margin-top:10px;width:100%;" onclick=\'openEditOxygen(' + JSON.stringify(t) + ')\'>Update Quantity</button>'
      : '';
    return '<div class="tank-card"><div class="tank-top">'
      + '<div><div style="font-family:\'Outfit\';font-size:13px;font-weight:700;color:var(--n800);">' + (t.ward||t.location||'') + '</div>'
      + (t.low ? '<div style="font-size:10px;font-weight:700;color:#ef4444;margin-top:2px;">⚠ LOW STOCK</div>' : '') + '</div>'
      + '<div style="text-align:right;"><div style="font-family:\'IBM Plex Mono\';font-size:20px;font-weight:800;color:' + col + ';">' + t.active + '</div><div style="font-size:10px;color:var(--n400);">in use</div></div></div>'
      + '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--n500);margin-bottom:4px;"><span>' + t.stored + ' stored</span><span>' + t.total + ' total</span></div>'
      + '<div class="tank-level-bar"><div class="tank-level-fill" style="width:' + pct + '%;background:' + col + ';"></div></div>'
      + editBtn + '</div>';
  }).join('');
}


// ── MLC Reports & Document Viewer ───────────────────────────────────
let _globalMLCReports = [];

function renderMLCReports(reports) {
  var tbody = document.getElementById('mlc-reports-tbody');
  if (!tbody) return;
  
  _globalMLCReports = reports; // Store them for the viewer

  if (!reports || reports.length === 0) { 
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--n400);font-size:12px;">No MLC reports generated yet</td></tr>'; 
    return; 
  }

  var urgencyCls = {CRITICAL:'prio-critical', HIGH:'prio-high', MODERATE:'prio-medium', LOW:'prio-low'};

  tbody.innerHTML = reports.map(function(r) {
    var dt = r.created_at ? new Date(r.created_at).toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    var patient = r.report_data && r.report_data.patient_name ? r.report_data.patient_name : 'Unknown';
    
    var statHtml = r.status === 'VERIFIED'
      ? '<span class="status-chip sc-on" style="background:var(--g50);color:var(--g700);border:1px solid var(--g200);"><span class="sc-dot"></span>Verified</span>'
      : '<span class="status-chip sc-off" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;"><span class="sc-dot"></span>AI Draft</span>';

    var actionBtn = `<button class="btn-sm btn-outline" onclick="viewMLCDocument('${r.mlc_number}')">📄 View Doc</button>`;

    return '<tr>'
      + '<td style="font-family:\'IBM Plex Mono\';font-size:11px;color:var(--n600);">' + (r.mlc_number || '—') + '</td>'
      + '<td style="font-family:\'IBM Plex Mono\';font-size:10.5px;color:var(--n400);">' + dt + '</td>'
      + '<td style="font-weight:600;color:var(--n700);">' + patient + '</td>'
      + '<td><span class="dept-pill">' + (r.incident_type || '—') + '</span></td>'
      + '<td><span class="priority-tag ' + (urgencyCls[r.urgency_level] || 'prio-low') + '">' + (r.urgency_level || 'UNKNOWN') + '</span></td>'
      + '<td>' + statHtml + '</td>'
      + '<td>' + actionBtn + '</td>'
      + '</tr>';
  }).join('');
}

function viewMLCDocument(mlcNumber) {
  const reportWrapper = _globalMLCReports.find(r => r.mlc_number === mlcNumber);
  if (!reportWrapper) return;

  const data = reportWrapper.report_data;
  const dateStr = new Date(reportWrapper.created_at).toLocaleString('en-IN');
  
  let html = `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 5px 0;"><strong>MLC Number:</strong> ${reportWrapper.mlc_number}</td>
        <td style="padding: 5px 0; text-align: right;"><strong>Date/Time:</strong> ${dateStr}</td>
      </tr>
      <tr>
        <td style="padding: 5px 0;"><strong>Status:</strong> ${reportWrapper.status}</td>
        <td style="padding: 5px 0; text-align: right;"><strong>Urgency:</strong> ${reportWrapper.urgency_level}</td>
      </tr>
    </table>

    <div style="border: 1px solid #000; padding: 15px; margin-bottom: 15px;">
      <h4 style="margin: 0 0 10px 0; text-decoration: underline;">1. PATIENT DEMOGRAPHICS</h4>
      <p style="margin: 4px 0;"><strong>Name:</strong> ${data.patient_name || 'Unknown'}</p>
      <p style="margin: 4px 0;"><strong>Age:</strong> ${data.age || 'Unknown'} | <strong>Gender:</strong> ${data.gender || 'Unknown'}</p>
      <p style="margin: 4px 0;"><strong>Attendant:</strong> ${data.attendant || 'None'}</p>
    </div>

    <div style="border: 1px solid #000; padding: 15px; margin-bottom: 15px;">
      <h4 style="margin: 0 0 10px 0; text-decoration: underline;">2. INCIDENT DETAILS</h4>
      <p style="margin: 4px 0;"><strong>Type:</strong> ${data.incident_type || 'Unknown'}</p>
      <p style="margin: 4px 0;"><strong>Location:</strong> ${data.incident_location || 'Unknown'}</p>
      <p style="margin: 4px 0;"><strong>Transported By:</strong> ${data.transported_by || 'Unknown'} (Call Time: ${data.time_of_call || 'Unknown'})</p>
      <p style="margin: 4px 0;"><strong>Police Informed:</strong> ${data.police_informed || 'Unknown'}</p>
    </div>

    <div style="border: 1px solid #000; padding: 15px; margin-bottom: 15px;">
      <h4 style="margin: 0 0 10px 0; text-decoration: underline;">3. CLINICAL OBSERVATIONS</h4>
      <p style="margin: 4px 0;"><strong>Vitals:</strong> Consciousness (${data.vital_signs?.consciousness || 'Unknown'}), 
         Bleeding (${data.vital_signs?.bleeding || 'Unknown'}), 
         Breathing (${data.vital_signs?.breathing || 'Unknown'})</p>
      <p style="margin: 4px 0;"><strong>Chief Complaints:</strong> ${(data.chief_complaints || []).join(', ')}</p>
      <p style="margin: 4px 0;"><strong>Visible Injuries:</strong> ${(data.visible_injuries || []).join(', ')}</p>
      <p style="margin: 4px 0; margin-top: 10px;"><strong>Additional Notes:</strong><br/> ${data.additional_notes || 'None'}</p>
    </div>
  `;

  document.getElementById('mlc-doc-content').innerHTML = html;
  document.getElementById('mlc-doc-nurse').innerText = reportWrapper.verified_by || 'Not Verified';
  
  openModal('modal-mlc-doc');
}

function printMLC() {
  const printContent = document.getElementById('mlc-print-area').innerHTML;
  const originalContent = document.body.innerHTML;

  document.body.innerHTML = printContent;
  window.print();
  
  document.body.innerHTML = originalContent;
  window.location.reload(); 
}


// ── WhatsApp Reminders (Expiring Consultations) ─────────────────────
let _expiringPatientIds = [];

function renderExpiringPatients(patients) {
  var tbody = document.getElementById('expiring-patients-tbody');
  if (!tbody) return;
  
  if (!patients || patients.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--n400);font-size:12px;">No expiring consultations</td></tr>';
    _expiringPatientIds = [];
    return;
  }
  
  // Store IDs for the WhatsApp button
  _expiringPatientIds = patients.map(p => p.id);
  
  tbody.innerHTML = patients.map(function(p) {
    var statusHtml = p.reminder_sent 
      ? '<span class="status-chip sc-on" style="background:var(--g50);color:var(--g700);border:1px solid var(--g200);">Sent</span>'
      : '<span class="status-chip sc-off" style="background:#fffbeb;color:#d97706;border:1px solid #fde68a;">Pending</span>';
    
    return '<tr>'
      + '<td style="font-family:\'IBM Plex Mono\';font-size:11px;color:var(--n400);">' + (p.id || '—') + '</td>'
      + '<td style="font-weight:600;color:var(--n800);">' + (p.name || 'Unknown') + '</td>'
      + '<td style="font-family:\'IBM Plex Mono\';font-size:11px;color:var(--n500);">' + (p.free_consult_expiry || '—') + '</td>'
      + '<td>' + statusHtml + '</td>'
      + '</tr>';
  }).join('');
}

async function sendWhatsAppReminders() {
  if (!_expiringPatientIds || _expiringPatientIds.length === 0) {
    showToast('No pending reminders to send', 'info');
    return;
  }
  try {
    await apiFetch('/api/patients/send-reminders', {
      method: 'POST',
      body: JSON.stringify({ patient_ids: _expiringPatientIds })
    });
    showToast('WhatsApp reminders sent successfully!', 'success');
    loadSectionData('patients'); // Refreshes the list from Supabase
  } catch (err) {
    showToast('Sent locally — API offline', 'info');
    
    // Fallback UI update if API fails
    var tbody = document.getElementById('expiring-patients-tbody');
    if (tbody) {
       var rows = tbody.getElementsByTagName('tr');
       for(var i=0; i<rows.length; i++) {
          var statusCell = rows[i].cells[3];
          if(statusCell && !statusCell.innerHTML.includes('Sent')) {
              statusCell.innerHTML = '<span class="status-chip sc-on" style="background:var(--g50);color:var(--g700);border:1px solid var(--g200);">Sent</span>';
          }
       }
    }
    _expiringPatientIds = [];
  }
}


// ── CRUD Logic ──────────────────────────────────────────────────────
async function submitICUBed() {
  var editId = _getVal('icu-edit-id'), bedNumber = _getVal('icu-bed-number');
  if (!bedNumber) { showToast('Bed number is required','error'); return; }
  var payload = {bed_number:bedNumber, status:_getVal('icu-status'), patient_name:_getVal('icu-patient')||null, condition:_getVal('icu-condition')||null};
  try {
    if (editId) { await apiFetch('/api/icu/'+editId,{method:'PATCH',body:JSON.stringify(payload)}); showToast('ICU bed updated','success'); }
    else        { await apiFetch('/api/icu',        {method:'POST', body:JSON.stringify(payload)}); showToast('ICU bed added',  'success'); }
    closeModal('modal-icu');
    renderBedGrid(await apiFetch('/api/icu'));
  } catch(err) { showToast('Saved locally — API offline','info'); closeModal('modal-icu'); }
}

async function deleteICUBed(id) {
  if (!confirm('Delete this ICU bed?')) return;
  try { await apiFetch('/api/icu/'+id,{method:'DELETE'}); showToast('Deleted','success'); renderBedGrid(await apiFetch('/api/icu')); }
  catch(e) { showToast('Delete failed — API offline','error'); }
}

async function submitDoctor() {
  var editId = _getVal('doctor-edit-id'), name = _getVal('doctor-name');
  if (!name) { showToast('Doctor name is required','error'); return; }
  var payload = {name:name, specialization:_getVal('doctor-dept'), shift:_getVal('doctor-shift'), status:_getVal('doctor-status'), appointments:parseInt(_getVal('doctor-appts'))||0};
  try {
    if (editId) { await apiFetch('/api/doctors/'+editId,{method:'PATCH',body:JSON.stringify(payload)}); showToast('Doctor updated','success'); }
    else        { await apiFetch('/api/doctors',         {method:'POST', body:JSON.stringify(payload)}); showToast('Doctor added',  'success'); }
    closeModal('modal-doctor');
    renderDoctorsTable(await apiFetch('/api/doctors'));
  } catch(err) { showToast('Saved locally — API offline','info'); closeModal('modal-doctor'); }
}

async function deleteDoctor(id) {
  if (!confirm('Remove this doctor?')) return;
  try { await apiFetch('/api/doctors/'+id,{method:'DELETE'}); showToast('Doctor removed','success'); renderDoctorsTable(await apiFetch('/api/doctors')); }
  catch(e) { showToast('Delete failed — API offline','error'); }
}

async function submitAmbulance() {
  var editId = _getVal('amb-edit-id'), vehicleId = _getVal('amb-id-input');
  if (!vehicleId) { showToast('Vehicle ID required','error'); return; }
  var payload = {vehicle_id:vehicleId, driver:_getVal('amb-driver'), status:_getVal('amb-status'), location:_getVal('amb-location')};
  try {
    if (editId) { await apiFetch('/api/ambulances/'+editId,{method:'PATCH',body:JSON.stringify(payload)}); showToast('Vehicle updated','success'); }
    else        { await apiFetch('/api/ambulances',         {method:'POST', body:JSON.stringify(payload)}); showToast('Vehicle added',  'success'); }
    closeModal('modal-ambulance');
    renderAmbGrid(await apiFetch('/api/ambulances'));
  } catch(err) { showToast('Saved locally — API offline','info'); closeModal('modal-ambulance'); }
}

async function dispatchAmbulance(id) {
  try { await apiFetch('/api/ambulances/'+id,{method:'PATCH',body:JSON.stringify({status:'on-mission'})}); showToast('Dispatched','success'); renderAmbGrid(await apiFetch('/api/ambulances')); }
  catch(e) { showToast('Dispatched locally — API offline','info'); }
}

async function submitOxygen() {
  var editId = _getVal('oxy-edit-id'), ward = _getVal('oxy-ward');
  if (!ward) { showToast('Ward name required','error'); return; }
  var payload = {ward:ward, total:parseInt(_getVal('oxy-total'))||0, active:parseInt(_getVal('oxy-active'))||0, stored:parseInt(_getVal('oxy-stored'))||0};
  try {
    if (editId) { await apiFetch('/api/oxygen/'+editId,{method:'PATCH',body:JSON.stringify(payload)}); showToast('Updated','success'); }
    else        { await apiFetch('/api/oxygen',         {method:'POST', body:JSON.stringify(payload)}); showToast('Added',   'success'); }
    closeModal('modal-oxygen');
    renderTankGrid(await apiFetch('/api/oxygen'));
  } catch(err) { showToast('Saved locally — API offline','info'); closeModal('modal-oxygen'); }
}

// ── Issue Handlers ──────────────────────────────────────────────────
async function submitIssue() {
  var title = _getVal('iss-title');
  if (!title) { showToast('Issue title is required','error'); return; }
  var payload = {title:title, description:_getVal('iss-desc'), department:_getVal('iss-dept'), priority:_getVal('iss-priority'), created_by:USER_ROLE, status:'pending', created_at:new Date().toISOString()};
  try { await apiFetch('/api/issues',{method:'POST',body:JSON.stringify(payload)}); showToast('Issue submitted','success'); }
  catch(err) { showToast('Recorded locally (API offline)','info'); }
  closeModal('modal-issue');
}

async function loadIssues() {
  try { _allIssues = await apiFetch('/api/issues'); }
  catch(_) { _allIssues = issuesSeed; }
  renderIssues();
  updateIssueSummary();
}

function filterIssues(f) {
  _issueFilter = f;
  ['all','pending','approved','rejected'].forEach(function(k) {
    var btn = document.getElementById('iss-filter-' + k);
    if (!btn) return;
    btn.style.background  = k === f ? 'var(--g600)' : '';
    btn.style.color       = k === f ? '#fff' : '';
    btn.style.borderColor = k === f ? 'var(--g600)' : '';
  });
  renderIssues();
}

function renderIssues() {
  var tbody = document.getElementById('issues-tbody');
  if (!tbody) return;
  var list = _issueFilter === 'all' ? _allIssues : _allIssues.filter(function(i) { return i.status === _issueFilter; });
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--n400);font-size:12px;">No issues found</td></tr>'; return; }

  var prioCls  = {Low:'prio-low',Medium:'prio-medium',High:'prio-high',Critical:'prio-critical'};
  var statCls  = {pending:'iss-pending',approved:'iss-approved',rejected:'iss-rejected'};

  tbody.innerHTML = list.map(function(iss, i) {
    var dt = iss.created_at ? new Date(iss.created_at).toLocaleString('en-IN',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
    var id = iss._id || iss.id;
    var acts = iss.status === 'pending'
      ? '<button class="btn-sm btn-approve" onclick="resolveIssue(\'' + id + '\',\'approved\')">Approve</button><button class="btn-sm btn-reject" onclick="resolveIssue(\'' + id + '\',\'rejected\')" style="margin-left:4px;">Reject</button>'
      : '<span style="font-size:11px;color:var(--n400);">' + (iss.status==='approved'?'✅ Done':'❌ Closed') + '</span>';
    return '<tr>'
      + '<td style="font-family:\'IBM Plex Mono\';font-size:11px;color:var(--n400);">#' + String(i+1).padStart(3,'0') + '</td>'
      + '<td style="font-weight:600;color:var(--n800);max-width:200px;">' + iss.title + '</td>'
      + '<td><span class="dept-pill">' + iss.department + '</span></td>'
      + '<td><span class="priority-tag ' + (prioCls[iss.priority]||'prio-medium') + '">' + iss.priority + '</span></td>'
      + '<td style="font-size:11.5px;color:var(--n500);">' + (iss.created_by||'Staff') + '</td>'
      + '<td style="font-family:\'IBM Plex Mono\';font-size:10.5px;color:var(--n400);">' + dt + '</td>'
      + '<td><span class="status-chip ' + (statCls[iss.status]||'iss-pending') + '">' + iss.status.charAt(0).toUpperCase() + iss.status.slice(1) + '</span></td>'
      + '<td>' + acts + '</td></tr>';
  }).join('');

  var badge = document.getElementById('issues-count-badge');
  if (badge) badge.textContent = list.length + ' ' + (_issueFilter==='all'?'total':_issueFilter);
}

function updateIssueSummary() {
  function el(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  el('iss-total',    _allIssues.length);
  el('iss-pending',  _allIssues.filter(function(i){return i.status==='pending';}).length);
  el('iss-approved', _allIssues.filter(function(i){return i.status==='approved';}).length);
  el('iss-rejected', _allIssues.filter(function(i){return i.status==='rejected';}).length);
  var nb = document.querySelector('[data-section="issues"] .nav-badge');
  if (nb) { var p = _allIssues.filter(function(i){return i.status==='pending';}).length; nb.textContent = p > 0 ? p : '✓'; }
}

async function resolveIssue(id, newStatus) {
  try { await apiFetch('/api/issues/'+id,{method:'PATCH',body:JSON.stringify({status:newStatus})}); showToast('Issue '+newStatus,'success'); }
  catch(err) { showToast('Updated locally — API offline','info'); }
  _allIssues = _allIssues.map(function(i) { return (i._id===id||i.id===id) ? Object.assign({},i,{status:newStatus}) : i; });
  renderIssues();
  updateIssueSummary();
}

// ── Application Bootstrapper ────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function() {
  var loginScreen = document.getElementById('login-screen');
  var appShell    = document.querySelector('.app-shell');

  if (!USER_ROLE) {
    if (loginScreen) loginScreen.classList.add('visible');
    if (appShell)    appShell.style.display = 'none';
    return;
  }

  if (loginScreen) loginScreen.style.display = 'none';
  if (appShell)    appShell.style.display    = 'flex';
  document.body.classList.add('role-' + USER_ROLE);

  var role       = ROLES[USER_ROLE] || ROLES.HEAD;
  var mainGroup  = document.getElementById('nav-main');
  var sysGroup   = document.getElementById('nav-system');
  var mainItems  = role.nav.filter(function(n){return n.group==='main';});
  var sysItems   = role.nav.filter(function(n){return n.group==='system';});

  if (document.getElementById('sb-avatar'))   document.getElementById('sb-avatar').textContent   = role.initials;
  if (document.getElementById('sb-name'))     document.getElementById('sb-name').textContent     = role.user;
  if (document.getElementById('sb-title'))    document.getElementById('sb-title').textContent    = role.title;
  var chip = document.getElementById('sb-role-chip');
  if (chip) { chip.className = 'role-chip ' + role.chipCls; chip.textContent = role.chipText; }

  mainItems.forEach(function(n) {
    var btn = document.createElement('button');
    btn.className       = 'nav-item' + (n.id==='dashboard' ? ' active' : '');
    btn.dataset.section = n.id;
    btn.innerHTML       = '<span class="nav-icon">' + n.icon + '</span>' + n.label
                        + (n.badge ? '<span class="nav-badge">' + n.badge + '</span>' : '');
    btn.addEventListener('click', function() { navigate(n.id); });
    if (mainGroup) mainGroup.appendChild(btn);
  });

  if (sysItems.length > 0 && sysGroup) {
    sysGroup.style.display = 'block';
    sysItems.forEach(function(n) {
      var btn = document.createElement('button');
      btn.className       = 'nav-item';
      btn.dataset.section = n.id;
      btn.innerHTML       = '<span class="nav-icon">' + n.icon + '</span>' + n.label;
      btn.addEventListener('click', function() { navigate(n.id); });
      sysGroup.appendChild(btn);
    });
  }

  var switcher = document.getElementById('role-switcher');
  if (switcher) switcher.value = USER_ROLE;

  var menuToggle = document.getElementById('menu-toggle');
  if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSidebar();
  });

  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  renderBedGrid(bedDataSeed);
  renderDoctorsTable(doctorDataSeed);
  renderAmbGrid(ambDataSeed);
  renderTankGrid(tankDataSeed);

  var actList = document.getElementById('activity-list');
  if (actList) {
    activities.forEach(function(a, i) {
      actList.innerHTML += '<div class="act-item"><div class="act-icon-col"><div class="act-icon" style="background:' + a.bg + ';">' + a.icon + '</div>'
        + (i < activities.length-1 ? '<div class="act-line"></div>' : '')
        + '</div><div class="act-body"><div class="act-msg">' + a.msg + '<span class="act-tag ' + a.tc + '">' + a.tag + '</span></div><div class="act-sub">' + a.sub + '</div></div></div>';
    });
  }

  var dtbody = document.getElementById('doctors-tbody');
  if (dtbody) {
    doctorDataSeed.slice(0,5).forEach(function(d) {
      var ini = d.name.split(' ').pop()[0];
      var on  = d.status === 'on-duty';
      dtbody.innerHTML += '<tr><td><div class="doc-cell"><div class="doc-avt">' + ini + '</div><span class="doc-name">' + d.name + '</span></div></td>'
        + '<td><span class="dept-pill">' + d.dept + '</span></td>'
        + '<td style="text-align:center;font-family:\'IBM Plex Mono\';font-size:12px;font-weight:700;color:var(--n700);">' + d.appts + '</td>'
        + '<td><span class="status-chip ' + (on?'sc-on':'sc-off') + '"><span class="sc-dot"></span>' + (on?'On Duty':'Off Duty') + '</span></td></tr>';
    });
  }

  var ptbody = document.getElementById('patients-tbody');
  if (ptbody) {
    var sevStyle = {critical:'background:#fef2f2;color:#ef4444;',high:'background:#fff7ed;color:#f97316;',moderate:'background:#fffbeb;color:#f59e0b;',low:'background:#f0fdf4;color:#16a344;'};
    var stStyle  = {'waiting':'background:var(--n100);color:var(--n600);','in-treatment':'background:#f0fdfa;color:#0d9488;','discharged':'background:var(--g50);color:var(--g700);'};
    patientData.forEach(function(p) {
      ptbody.innerHTML += '<tr>'
        + '<td><span class="prio-badge prio-' + p.prio + '">' + p.prio + '</span></td>'
        + '<td style="font-weight:600;color:var(--n700);">' + p.name + '</td>'
        + '<td style="color:var(--n500);font-size:12px;">' + p.cond + '</td>'
        + '<td><span class="status-chip" style="' + sevStyle[p.sev] + 'border:none;">' + p.sev.charAt(0).toUpperCase()+p.sev.slice(1) + '</span></td>'
        + '<td style="font-family:\'IBM Plex Mono\';font-size:12px;color:var(--n500);">' + p.time + '</td>'
        + '<td><span class="status-chip" style="' + stStyle[p.status] + 'border:none;">' + (p.status==='in-treatment'?'In Treatment':p.status.charAt(0).toUpperCase()+p.status.slice(1)) + '</span></td>'
        + '<td style="font-size:12px;color:var(--n500);">' + p.doctor + '</td></tr>';
    });
  }

  if (typeof Chart !== 'undefined') {
    Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
    Chart.defaults.font.size   = 11;
    Chart.defaults.color       = '#8a988a';
    Chart.defaults.plugins.legend.display = false;
    chartsReady['dashboard'] = true;
    initDashboardCharts();
  }

  function tick() {
    var now  = new Date();
    var date = now.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
    var time = now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    var clockEl = document.getElementById('clock');
    if (clockEl) clockEl.textContent = date + '  ·  ' + time;
  }
  tick();
  setInterval(tick, 1000);

  document.querySelectorAll('.ct-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabs = this.closest('.chart-tabs');
      if (tabs) tabs.querySelectorAll('.ct-tab').forEach(function(t){t.classList.remove('active');});
      this.classList.add('active');
    });
  });

  // ── API background loads ──────────────────────────────────────────
  loadDashboardStats();
  loadPredictiveSurge();
  if (USER_ROLE === 'HEAD') loadIssues();
});