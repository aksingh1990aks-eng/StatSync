/* ══════════════════════════════════════════════════════════════════════
   data.js — Global State, Configuration, and Mock Seeds
══════════════════════════════════════════════════════════════════════ */

const USER_ROLE = localStorage.getItem('medcmd_role');
const API_BASE = 'https://statsync-kese.onrender.com'; // set to 'http://localhost:8000' for local dev

const ROLES = {
  HEAD: {
    user:'Dr. Sarah Chen', title:'Chief Medical Officer', initials:'SC',
    chipCls:'role-head', chipText:'Head',
    sections:['dashboard','icu','doctors','ambulances','patients','oxygen','reports','issues','settings'],
    nav:[
      {id:'dashboard', icon:'⊞', label:'Dashboard',      group:'main'},
      {id:'icu',       icon:'🛏', label:'ICU Management', group:'main', badge:'3'},
      {id:'doctors',   icon:'👨‍⚕️', label:'Doctors',        group:'main'},
      {id:'ambulances',icon:'🚑', label:'Ambulances',     group:'main', badge:'2'},
      {id:'patients',  icon:'📋', label:'Patient Queue',  group:'main', badge:'8'},
      {id:'oxygen',    icon:'🫁', label:'Oxygen Supply',  group:'system'},
      {id:'reports',   icon:'📊', label:'Reports',        group:'system'},
      {id:'issues',    icon:'⚠️', label:'Issues',          group:'system', badge:'!'},
      {id:'settings',  icon:'⚙️', label:'Settings',        group:'system'},
    ]
  },
  RECEPTIONIST: {
    user:'Anna Brooks', title:'Receptionist', initials:'AB',
    chipCls:'role-receptionist', chipText:'Receptionist',
    sections:['dashboard','icu','doctors','ambulances','oxygen'],
    nav:[
      {id:'dashboard', icon:'⊞', label:'Dashboard',      group:'main'},
      {id:'icu',       icon:'🛏', label:'ICU Management', group:'main'},
      {id:'doctors',   icon:'👨‍⚕️', label:'Doctors',        group:'main'},
      {id:'ambulances',icon:'🚑', label:'Ambulances',     group:'main'},
      {id:'oxygen',    icon:'🫁', label:'Oxygen Supply',  group:'main'},
    ]
  }
};

const SECTION_TITLES = {
  dashboard:'Dashboard', icu:'ICU Management', doctors:'Doctor Scheduling',
  ambulances:'Ambulance Fleet', patients:'Patient Priority Queue',
  oxygen:'Oxygen Supply', reports:'Reports & Analytics',
  issues:'Issue Management', settings:'Settings'
};

const chartsReady = {};

// Mock Data Seeds
var doctorDataSeed = [
  {_id:'d1',name:'Dr. James Mitchell',dept:'Cardiology',   shift:'07:00-15:00',appts:12,status:'on-duty'},
  {_id:'d2',name:'Dr. Priya Sharma',  dept:'Neurology',    shift:'08:00-16:00',appts:8, status:'on-duty'},
  {_id:'d3',name:'Dr. Aisha Patel',   dept:'Orthopedics',  shift:'09:00-17:00',appts:10,status:'on-duty'},
  {_id:'d4',name:'Dr. Robert Hayes',  dept:'Emergency Med',shift:'15:00-23:00',appts:5, status:'on-duty'},
  {_id:'d5',name:'Dr. Elena Vasquez', dept:'Oncology',     shift:'07:00-15:00',appts:7, status:'off-duty'},
  {_id:'d6',name:'Dr. Marcus Lee',    dept:'Pulmonology',  shift:'00:00-08:00',appts:3, status:'off-duty'},
];

var bedDataSeed = [
  {_id:'b01',bed_number:'ICU-01',status:'occupied',   patient_name:'Margaret Wilson',cond:'Post-op cardiac'},
  {_id:'b02',bed_number:'ICU-02',status:'occupied',   patient_name:'Thomas Anderson',cond:'Brain injury'},
  {_id:'b03',bed_number:'ICU-03',status:'available',  patient_name:null,cond:null},
  {_id:'b04',bed_number:'ICU-04',status:'occupied',   patient_name:'Elena Rodriguez',cond:'Respiratory failure'},
  {_id:'b05',bed_number:'ICU-05',status:'available',  patient_name:null,cond:null},
  {_id:'b06',bed_number:'ICU-06',status:'maintenance',patient_name:null,cond:null},
  {_id:'b07',bed_number:'ICU-07',status:'occupied',   patient_name:'James Sullivan', cond:'Septic shock'},
  {_id:'b08',bed_number:'ICU-08',status:'available',  patient_name:null,cond:null},
  {_id:'b09',bed_number:'ICU-09',status:'occupied',   patient_name:'Mary Johnson',   cond:'Multi-organ failure'},
  {_id:'b10',bed_number:'ICU-10',status:'available',  patient_name:null,cond:null},
  {_id:'b11',bed_number:'ICU-11',status:'reserved',   patient_name:'John Park',      cond:'Pre-op scheduled'},
  {_id:'b12',bed_number:'ICU-12',status:'occupied',   patient_name:'Linda Torres',   cond:'Stroke recovery'},
];

var ambDataSeed = [
  {_id:'a1',id:'AMB-001',driver:'John Davis',   status:'available',  location:'Central Station',  km:'1,420'},
  {_id:'a2',id:'AMB-002',driver:'Maria Garcia', status:'on-mission', location:'Downtown District', km:'2,180'},
  {_id:'a3',id:'AMB-003',driver:'Robert Smith', status:'available',  location:'North Wing Base',   km:'980'},
  {_id:'a4',id:'AMB-004',driver:'Linda Chen',   status:'on-mission', location:'Highway 5, Mile 23',km:'3,050'},
  {_id:'a5',id:'AMB-005',driver:'Carlos Ruiz',  status:'maintenance',location:'Service Garage',    km:'1,760'},
  {_id:'a6',id:'AMB-006',driver:'Amy Taylor',   status:'available',  location:'East Station',      km:'2,340'},
  {_id:'a7',id:'AMB-007',driver:'David Kim',    status:'on-mission', location:'Airport Road',      km:'890'},
  {_id:'a8',id:'AMB-008',driver:'Sara Wilson',  status:'available',  location:'South Base',        km:'1,550'},
];

var tankDataSeed = [
  {_id:'o1',ward:'ICU Wing A',     total:40,active:22,stored:18,low:false},
  {_id:'o2',ward:'ICU Wing B',     total:38,active:20,stored:18,low:false},
  {_id:'o3',ward:'Emergency Ward', total:30,active:18,stored:12,low:false},
  {_id:'o4',ward:'General Ward C', total:32,active:10,stored:22,low:false},
  {_id:'o5',ward:'Paediatrics',    total:20,active:8, stored:12,low:false},
  {_id:'o6',ward:'Cardiology',     total:24,active:4, stored:20,low:false},
  {_id:'o7',ward:'Oncology',       total:18,active:2, stored:16,low:true},
  {_id:'o8',ward:'Maternity',      total:16,active:2, stored:14,low:false},
];

var patientData = [
  {name:'William Park',   cond:'Chest pain & SOB',   sev:'critical',prio:1,time:'09:00',status:'waiting',      doctor:'Dr. Mitchell'},
  {name:'Emma Wilson',    cond:'Diabetic emergency',  sev:'critical',prio:1,time:'08:45',status:'in-treatment', doctor:'Dr. Lee'},
  {name:'Sarah Thompson', cond:'Fractured femur',     sev:'high',    prio:2,time:'09:30',status:'waiting',      doctor:'Dr. Patel'},
  {name:'Kevin Chen',     cond:'Appendicitis',        sev:'high',    prio:2,time:'11:00',status:'in-treatment', doctor:'Dr. Sharma'},
  {name:'Robert Lee',     cond:'Hypertension crisis', sev:'high',    prio:2,time:'10:00',status:'waiting',      doctor:'Dr. Mitchell'},
  {name:'Diana Martinez', cond:'Migraine with aura',  sev:'moderate',prio:3,time:'10:30',status:'waiting',      doctor:'Dr. Sharma'},
];

var activities = [
  {icon:'🚑',bg:'#ffe4e4',msg:'Ambulance AMB-004 dispatched',          tag:'Emergency', tc:'at-red',    sub:'14 Crescent Ave — ETA 8 min · 2 min ago'},
  {icon:'🛏',bg:'#f0fdf4',msg:'ICU Bed #07 assigned to patient',       tag:'ICU',       tc:'at-sky',    sub:'James Sullivan — Septic shock · 11 min ago'},
  {icon:'👤',bg:'#f0fdf4',msg:'New patient admitted',                   tag:'Admission', tc:'at-green',  sub:'Margaret Wilson — Ward B, Room 14 · 18 min ago'},
  {icon:'🫁',bg:'#fffbeb',msg:'Oxygen cylinders restocked',             tag:'Supply',    tc:'at-amber',  sub:'3× cylinders in ICU Wing B · 34 min ago'},
  {icon:'👨‍⚕️',bg:'#f5f3ff',msg:'Dr. Priya Sharma started shift',     tag:'Staff',     tc:'at-violet', sub:'Neurology · 08:00–16:00 · 52 min ago'},
  {icon:'⚠️',bg:'#fff7ed',msg:'High patient queue alert triggered',    tag:'Alert',     tc:'at-amber',  sub:'ED waiting time exceeded 35 min · 1 hr ago'},
  {icon:'✅',bg:'#f0fdf4',msg:'Patient discharged — full recovery',    tag:'Discharge', tc:'at-green',  sub:'Robert Chen confirmed · 2 hr ago'},
];

var issuesSeed = [
  {_id:'iss1',title:'Need more doctors for night shift',   description:'Only 2 doctors on night duty',        department:'Doctors',    priority:'High',    created_by:'RECEPTIONIST',status:'pending',  created_at:new Date(Date.now()-120*60000).toISOString()},
  {_id:'iss2',title:'Oxygen cylinders running low — Oncology', description:'Down to 2 active cylinders', department:'Oxygen',     priority:'Critical',created_by:'RECEPTIONIST',status:'pending',  created_at:new Date(Date.now()-45*60000).toISOString()},
  {_id:'iss3',title:'ICU Bed #14 maintenance overdue',    description:'In maintenance for 3 weeks',          department:'ICU',        priority:'Medium',  created_by:'RECEPTIONIST',status:'approved', created_at:new Date(Date.now()-2*3600000).toISOString()},
  {_id:'iss4',title:'AMB-005 needs tyre replacement',     description:'Tyre pressure warning',               department:'Ambulances', priority:'Low',     created_by:'RECEPTIONIST',status:'rejected', created_at:new Date(Date.now()-5*3600000).toISOString()},
];

// Seed for WhatsApp Reminders (Expiring Consultations)
var expiringPatientsSeed = [
  {id: 'P-8802', name: 'Arjun Kumar', free_consult_expiry: new Date(Date.now()+86400000).toISOString().split('T')[0], reminder_sent: false},
  {id: 'P-8805', name: 'Priya Singh', free_consult_expiry: new Date(Date.now()+172800000).toISOString().split('T')[0], reminder_sent: false},
  {id: 'P-8812', name: 'Rohan Gupta', free_consult_expiry: new Date(Date.now()+86400000).toISOString().split('T')[0], reminder_sent: false}
];

// Mutable variables used across the application state
var _allIssues    = [];
var _issueFilter  = 'all';