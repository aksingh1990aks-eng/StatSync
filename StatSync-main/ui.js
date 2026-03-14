/* ══════════════════════════════════════════════════════════════════════
   ui.js — UI Interactivity, Navigation, Modals, and Charts
══════════════════════════════════════════════════════════════════════ */

// ── Auth Handling ───────────────────────────────────────────────────
function loginAs(roleKey) {
  if (!ROLES[roleKey]) return;
  var card = document.querySelector('.login-card');
  if (card) {
    card.style.transition = 'opacity .22s ease, transform .22s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-10px)';
  }
  setTimeout(function() {
    localStorage.setItem('medcmd_role', roleKey);
    window.location.reload();
  }, 230);
}

function logout() {
  localStorage.removeItem('medcmd_role');
  window.location.reload();
}

function applyRoleSwitch() {
  var sel = document.getElementById('role-switcher');
  if (sel) {
    localStorage.setItem('medcmd_role', sel.value);
    window.location.reload();
  }
}

// ── Sidebar & Layout ────────────────────────────────────────────────
function openSidebar() {
  var sb = document.querySelector('.sidebar');
  var bd = document.getElementById('sidebar-backdrop');
  if (sb) sb.classList.add('open');
  if (bd) bd.classList.add('visible');
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  var sb = document.querySelector('.sidebar');
  var bd = document.getElementById('sidebar-backdrop');
  if (sb) sb.classList.remove('open');
  if (bd) bd.classList.remove('visible');
  document.body.classList.remove('sidebar-open');
}

function toggleSidebar() {
  var sb = document.querySelector('.sidebar');
  if (!sb) return;
  if (sb.classList.contains('open')) { closeSidebar(); } else { openSidebar(); }
}

function dismissAlert() {
  var b = document.getElementById('alert-banner');
  if (!b) return;
  b.style.transition = 'all .3s ease';
  b.style.opacity = '0';
  b.style.transform = 'translateY(-4px)';
  setTimeout(function() { b.style.display = 'none'; }, 300);
}

// ── Navigation ──────────────────────────────────────────────────────
function navigate(sectionId) {
  var role = ROLES[USER_ROLE] || ROLES.HEAD;
  if (!role.sections.includes(sectionId)) {
    navigate('dashboard');
    return;
  }

  document.querySelectorAll('.page-section').forEach(function(s) {
    s.classList.remove('active');
  });

  var target = document.getElementById('sec-' + sectionId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.section === sectionId);
  });

  var crumb = document.getElementById('page-title');
  if (crumb) crumb.textContent = SECTION_TITLES[sectionId] || sectionId;

  var content = document.querySelector('.content');
  if (content) content.scrollTop = 0;

  closeSidebar();

  // Defined in app.js
  if (typeof loadSectionData === 'function' && !chartsReady[sectionId]) {
    chartsReady[sectionId] = true;
    initSectionCharts(sectionId);
    loadSectionData(sectionId);
  }
}

// ── Modals & Toasts ─────────────────────────────────────────────────
function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

function showToast(message, type) {
  type = type || 'success';
  var icons = {success:'✅', error:'❌', info:'ℹ️'};
  var tc = document.getElementById('toast-container');
  if (!tc) return;
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<span class="toast-icon">' + (icons[type]||'•') + '</span>' + message;
  tc.appendChild(el);
  setTimeout(function() {
    el.style.animation = 'toast-out .3s ease forwards';
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
  }, 3200);
}

// ── Form Helpers ────────────────────────────────────────────────────
function _setVal(id, v) { var e = document.getElementById(id); if (e) e.value = v || ''; }
function _getVal(id)    { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
function _setTxt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }

function openResourceModal(type) {
  if (type === 'icu') {
    _setVal('icu-edit-id',''); _setVal('icu-bed-number',''); _setVal('icu-status','available');
    _setVal('icu-patient',''); _setVal('icu-condition','');
    _setTxt('modal-icu-title','Add ICU Bed'); openModal('modal-icu');
  } else if (type === 'doctor') {
    _setVal('doctor-edit-id',''); _setVal('doctor-name',''); _setVal('doctor-dept','');
    _setVal('doctor-shift',''); _setVal('doctor-status','on-duty'); _setVal('doctor-appts','');
    _setTxt('modal-doctor-title','Add Doctor'); openModal('modal-doctor');
  } else if (type === 'ambulance') {
    _setVal('amb-edit-id',''); _setVal('amb-id-input',''); _setVal('amb-driver','');
    _setVal('amb-status','available'); _setVal('amb-location','');
    _setTxt('modal-ambulance-title','Add Vehicle'); openModal('modal-ambulance');
  } else if (type === 'oxygen') {
    _setVal('oxy-edit-id',''); _setVal('oxy-ward',''); _setVal('oxy-total','');
    _setVal('oxy-active',''); _setVal('oxy-stored','');
    _setTxt('modal-oxygen-title','Add Oxygen Cylinders'); openModal('modal-oxygen');
  }
}

function openEditICU(bed) {
  _setVal('icu-edit-id', bed._id); _setVal('icu-bed-number', bed.bed_number||bed.id);
  _setVal('icu-status', bed.status); _setVal('icu-patient', bed.patient_name);
  _setVal('icu-condition', bed.cond||bed.condition);
  _setTxt('modal-icu-title','Edit ICU Bed'); openModal('modal-icu');
}

function openEditDoctor(doc) {
  _setVal('doctor-edit-id', doc._id); _setVal('doctor-name', doc.name);
  _setVal('doctor-dept', doc.dept||doc.specialization); _setVal('doctor-shift', doc.shift);
  _setVal('doctor-status', doc.status); _setVal('doctor-appts', doc.appts||doc.appointments);
  _setTxt('modal-doctor-title','Edit Doctor'); openModal('modal-doctor');
}

function openEditAmbulance(amb) {
  _setVal('amb-edit-id', amb._id); _setVal('amb-id-input', amb.id||amb.vehicle_id);
  _setVal('amb-driver', amb.driver); _setVal('amb-status', amb.status);
  _setVal('amb-location', amb.location);
  _setTxt('modal-ambulance-title','Edit Vehicle'); openModal('modal-ambulance');
}

function openEditOxygen(tank) {
  _setVal('oxy-edit-id', tank._id); _setVal('oxy-ward', tank.ward||tank.location);
  _setVal('oxy-total', tank.total); _setVal('oxy-active', tank.active); _setVal('oxy-stored', tank.stored);
  _setTxt('modal-oxygen-title','Update Quantities'); openModal('modal-oxygen');
}

function openIssueModal(dept) {
  _setVal('iss-title',''); _setVal('iss-desc',''); _setVal('iss-priority','High');
  if (dept) _setVal('iss-dept', dept);
  openModal('modal-issue');
}

// ── Charts ──────────────────────────────────────────────────────────
function initSectionCharts(sectionId) {
  if (typeof Chart === 'undefined') return;
  if (sectionId === 'dashboard') initDashboardCharts();
  else if (sectionId === 'reports') initReportCharts();
}

function initDashboardCharts() {
  if (typeof Chart === 'undefined') return;
  var gridColor = 'rgba(0,0,0,.04)';

  var ctx1 = document.getElementById('admissionsChart');
  if (ctx1) {
    var c1 = ctx1.getContext('2d');
    var gG = c1.createLinearGradient(0,0,0,200); gG.addColorStop(0,'rgba(34,197,94,.18)'); gG.addColorStop(1,'rgba(34,197,94,0)');
    var gS = c1.createLinearGradient(0,0,0,200); gS.addColorStop(0,'rgba(14,165,233,.14)'); gS.addColorStop(1,'rgba(14,165,233,0)');
    new Chart(c1, {
      data: {
        labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        datasets:[
          {type:'line',label:'Admitted',  data:[42,51,47,63,58,39,45],borderColor:'#22c55e',borderWidth:2.5,backgroundColor:gG,fill:true, tension:0.4,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:'#22c55e',pointHoverBorderColor:'#fff',pointHoverBorderWidth:2},
          {type:'line',label:'Discharged',data:[38,44,50,55,47,42,41],borderColor:'#0ea5e9',borderWidth:2.5,backgroundColor:gS,fill:true, tension:0.4,pointRadius:0,pointHoverRadius:5,pointHoverBackgroundColor:'#0ea5e9',pointHoverBorderColor:'#fff',pointHoverBorderWidth:2},
          {type:'line',label:'ICU',       data:[6,8,5,11,9,7,8],      borderColor:'#ef4444',borderWidth:2,  backgroundColor:'transparent',fill:false,tension:0.4,borderDash:[5,3],pointRadius:3,pointBackgroundColor:'#ef4444',pointBorderColor:'#fff',pointBorderWidth:1.5,pointHoverRadius:6},
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#2d3d2d',bodyColor:'#637063',borderColor:'#e4ebe4',borderWidth:1,padding:10,cornerRadius:10}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#9aab99',font:{size:10.5}}},y:{grid:{color:gridColor},border:{display:false},ticks:{color:'#9aab99',font:{size:10.5}}}}}
    });
  }

  var ctx2 = document.getElementById('ambulanceChart');
  if (ctx2) {
    new Chart(ctx2.getContext('2d'), {
      type:'bar',
      data:{
        labels:['MON','TUE','WED','THU','FRI','SAT','SUN'],
        datasets:[
          {label:'Available',  data:[4,3,5,2,4,5,3],backgroundColor:'#4ade80',borderRadius:{topLeft:0,topRight:0,bottomLeft:4,bottomRight:4},borderSkipped:false,stack:'f'},
          {label:'On Mission', data:[2,3,1,4,2,1,3],backgroundColor:'#ef4444',borderRadius:0,stack:'f'},
          {label:'Maintenance',data:[1,1,1,1,1,1,1],backgroundColor:'#d1dbd1',borderRadius:{topLeft:4,topRight:4,bottomLeft:0,bottomRight:0},borderSkipped:false,stack:'f'},
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#2d3d2d',bodyColor:'#637063',borderColor:'#e4ebe4',borderWidth:1,padding:10,cornerRadius:10}},scales:{x:{stacked:true,grid:{display:false},border:{display:false},ticks:{color:'#9aab99',font:{size:10}}},y:{stacked:true,grid:{color:gridColor},border:{display:false},ticks:{color:'#9aab99',font:{size:10},stepSize:2}}},barThickness:18}
    });
  }

  var ctx3 = document.getElementById('icuDonut');
  if (ctx3) {
    new Chart(ctx3.getContext('2d'), {
      type:'doughnut',
      data:{labels:['Occupied','Available','Reserved','Maintenance'],datasets:[{data:[47,33,14,6],backgroundColor:['#ef4444','#22c55e','#f59e0b','#c4cec3'],borderWidth:3,borderColor:'#fff',hoverBorderWidth:3,hoverOffset:5}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return '  '+c.label+': '+c.parsed+' beds';}},backgroundColor:'#fff',titleColor:'#2d3d2d',bodyColor:'#637063',borderColor:'#e4ebe4',borderWidth:1,padding:10,cornerRadius:10}}}
    });
  }

  var ctx4 = document.getElementById('oxygenChart');
  if (ctx4) {
    var c4 = ctx4.getContext('2d');
    var gO = c4.createLinearGradient(0,0,0,170); gO.addColorStop(0,'rgba(245,158,11,.22)'); gO.addColorStop(1,'rgba(245,158,11,0)');
    new Chart(c4, {
      type:'line',
      data:{labels:['06:00','08:00','10:00','12:00','14:00','16:00','18:00','20:00','22:00'],datasets:[{label:'Usage',data:[120,145,162,138,171,155,148,133,119],borderColor:'#f59e0b',borderWidth:2.5,backgroundColor:gO,fill:true,tension:0.4,pointRadius:3.5,pointBackgroundColor:'#f59e0b',pointBorderColor:'#fff',pointBorderWidth:2,pointHoverRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#2d3d2d',bodyColor:'#637063',borderColor:'#e4ebe4',borderWidth:1,padding:10,cornerRadius:10}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#9aab99',font:{size:9.5}}},y:{grid:{color:gridColor},border:{display:false},ticks:{color:'#9aab99',font:{size:9.5}},min:80}}}
    });
  }
}

function initReportCharts() {
  if (typeof Chart === 'undefined') return;
  var gridColor = 'rgba(0,0,0,.04)';

  var rAC = document.getElementById('reportAdmissionsChart');
  if (rAC) {
    new Chart(rAC.getContext('2d'), {
      type:'bar',
      data:{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],datasets:[{label:'Admissions',data:[1540,1620,1490,1700,1580,1650,1720,1800,1680,1760,1840,1920],backgroundColor:'rgba(34,197,94,.2)',borderColor:'#22c55e',borderWidth:2,borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#2d3d2d',bodyColor:'#637063',borderColor:'#e4ebe4',borderWidth:1,padding:10,cornerRadius:10}},scales:{x:{grid:{display:false},border:{display:false},ticks:{color:'#9aab99',font:{size:10}}},y:{grid:{color:gridColor},border:{display:false},ticks:{color:'#9aab99',font:{size:10}}}}}
    });
  }

  var rDC = document.getElementById('reportDeptChart');
  if (rDC) {
    new Chart(rDC.getContext('2d'), {
      type:'bar',
      data:{labels:['Cardiology','Emergency','Neurology','Orthopedics','Oncology','Pulmonology'],datasets:[{label:'Patients',data:[312,487,228,196,143,88],backgroundColor:['rgba(34,197,94,.7)','rgba(239,68,68,.7)','rgba(14,165,233,.7)','rgba(245,158,11,.7)','rgba(124,58,237,.7)','rgba(13,148,136,.7)'],borderRadius:6}]},
      options:{responsive:true,maintainAspectRatio:false,indexAxis:'y',plugins:{legend:{display:false},tooltip:{backgroundColor:'#fff',titleColor:'#2d3d2d',bodyColor:'#637063',borderColor:'#e4ebe4',borderWidth:1,padding:10,cornerRadius:10}},scales:{x:{grid:{color:gridColor},border:{display:false},ticks:{color:'#9aab99',font:{size:10}}},y:{grid:{display:false},border:{display:false},ticks:{color:'#9aab99',font:{size:10}}}}}
    });
  }
}