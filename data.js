const SPECIALTIES = [
  { id: 'dentistry', name: 'Dentistry', icon: '🦷', description: 'General & cosmetic dental care' },
];

const DOCTORS = [
  { id: 1, name: 'Dr. Samuel Chan', specialty: 'dentistry', experience: '12 years', rating: 4.9, reviews: 218, bio: 'General dentist specializing in preventive care, cosmetic dentistry, and restorations.', days: [1,2,3,4,5], start: 9,  end: 17, lunch: [12,13] },
  { id: 2, name: 'Dr. Agassi Kwok', specialty: 'dentistry', experience: '8 years',  rating: 4.8, reviews: 154, bio: 'Focuses on oral surgery, root canals, implants, and complex extractions.',               days: [1,2,3,4,5], start: 10, end: 18, lunch: [13,14] },
];

const APPOINTMENT_TYPES = [
  { id: 'checkup',      name: 'Check-up & Cleaning',   duration: 60,  price: 120,  description: 'Routine exam, scale & polish'           },
  { id: 'consult',      name: 'New Patient Consult',    duration: 45,  price: 90,   description: 'First visit — full oral assessment'     },
  { id: 'filling',      name: 'Filling / Restoration',  duration: 60,  price: 180,  description: 'Cavity filling or tooth restoration'    },
  { id: 'extraction',   name: 'Tooth Extraction',       duration: 45,  price: 150,  description: 'Simple or surgical tooth removal'       },
  { id: 'rootcanal',    name: 'Root Canal',             duration: 90,  price: 350,  description: 'Endodontic treatment to save the tooth'  },
  { id: 'whitening',    name: 'Teeth Whitening',        duration: 60,  price: 200,  description: 'Professional in-chair whitening'        },
  { id: 'orthodontic',  name: 'Orthodontic Treatment',  duration: 60,  price: 800,  description: 'Braces, aligners, and orthodontic adjustment' },
];

const CLINICS = [
  { id: 'central',    name: 'Central',      icon: '🏙️', address: 'Shop 3, Central Building, Hong Kong'      },
  { id: 'taikoo',     name: 'Taikoo',       icon: '🌊', address: '2/F, Taikoo Place, Quarry Bay'             },
  { id: 'shaukeiwan', name: 'Shau Kei Wan', icon: '⚓', address: 'G/F, 88 Shau Kei Wan Main Street East'     },
];

// ── Appointments storage ──────────────────────────────────────────────────────

function getAppointments() {
  return JSON.parse(localStorage.getItem('clinic_appointments') || '[]');
}

function saveAppointments(list) {
  localStorage.setItem('clinic_appointments', JSON.stringify(list));
}

function addAppointment(data) {
  const list = getAppointments();
  const appt = {
    ...data,
    id: 'APT-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).substr(2, 3).toUpperCase(),
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };
  list.push(appt);
  saveAppointments(list);
  return appt;
}

function updateAppointmentStatus(id, status) {
  const list = getAppointments();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return false;
  list[idx].status = status;
  saveAppointments(list);
  return true;
}

function updateAppointmentPaid(id, paidAmount) {
  const list = getAppointments();
  const idx = list.findIndex(a => a.id === id);
  if (idx === -1) return false;
  list[idx].paidAmount = Math.max(0, Number(paidAmount) || 0);
  saveAppointments(list);
  return true;
}

// ── Patient storage ───────────────────────────────────────────────────────────

function getPatients() {
  return JSON.parse(localStorage.getItem('clinic_patients') || '[]');
}

function savePatients(list) {
  localStorage.setItem('clinic_patients', JSON.stringify(list));
}

function addPatient(data) {
  const list = getPatients();
  if (list.some(p => p.patientNumber === data.patientNumber)) {
    return { error: `Patient number "${data.patientNumber}" already exists.` };
  }
  const patient = {
    ...data,
    id: 'PAT-' + Date.now().toString(36).toUpperCase().slice(-6),
    createdAt: new Date().toISOString(),
  };
  list.push(patient);
  savePatients(list);
  return patient;
}

function updatePatient(id, data) {
  const list = getPatients();
  const idx  = list.findIndex(p => p.id === id);
  if (idx === -1) return false;
  if (data.patientNumber !== list[idx].patientNumber &&
      list.some(p => p.patientNumber === data.patientNumber && p.id !== id)) {
    return { error: `Patient number "${data.patientNumber}" already exists.` };
  }
  list[idx] = { ...list[idx], ...data };
  savePatients(list);
  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDoctorById(id) {
  return DOCTORS.find(d => d.id === id);
}

const AVATAR_COLORS = ['#2563eb','#7c3aed','#db2777','#ea580c','#16a34a','#0891b2','#dc2626','#9333ea'];

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name.replace('Dr. ', '').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTimeSlot(hour, min) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
  return `${h}:${min.toString().padStart(2, '0')} ${period}`;
}

function generateTimeSlots(doctor, dateStr, durationMin) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay();
  if (!doctor.days.includes(dayOfWeek)) return [];

  const booked = getAppointments()
    .filter(a => a.doctorId === doctor.id && a.date === dateStr && a.status !== 'cancelled')
    .map(a => a.time);

  const slots = [];
  let hour = doctor.start, min = 0;

  while (true) {
    const slotStartMins = hour * 60 + min;
    const slotEndMins   = slotStartMins + durationMin;
    if (Math.floor(slotEndMins / 60) > doctor.end ||
       (Math.floor(slotEndMins / 60) === doctor.end && slotEndMins % 60 > 0)) break;

    const lunchStart = doctor.lunch[0] * 60;
    const lunchEnd   = doctor.lunch[1] * 60;
    const overlapsLunch = slotStartMins < lunchEnd && slotEndMins > lunchStart;

    if (!overlapsLunch) {
      const timeStr = formatTimeSlot(hour, min);
      slots.push({ time: timeStr, available: !booked.includes(timeStr) });
    }

    min += 30;
    if (min >= 60) { hour++; min -= 60; }
  }
  return slots;
}

// ── Seed Data ─────────────────────────────────────────────────────────────────

function seedData() {
  if (localStorage.getItem('clinic_seeded_v8')) return;
  ['clinic_seeded','clinic_seeded_v2','clinic_seeded_v3','clinic_seeded_v4','clinic_seeded_v5','clinic_seeded_v6','clinic_seeded_v7'].forEach(k => localStorage.removeItem(k));

  // Compute Monday of the current week
  const today = new Date(); today.setHours(0,0,0,0);
  const dow   = today.getDay();
  const mon   = new Date(today); mon.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));

  function ds(offsetDays) {
    const d = new Date(mon); d.setDate(mon.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  const now = new Date().toISOString();

  // Template registered patients
  const seedPatients = [
    { id:'PAT-SEED01', patientNumber:'P001', name:'Alice Wong',   phone:'9800 0001', clinic:'central',    createdAt: now },
    { id:'PAT-SEED02', patientNumber:'P002', name:'Bob Chan',     phone:'9800 0002', clinic:'central',    createdAt: now },
    { id:'PAT-SEED03', patientNumber:'P003', name:'Carol Lam',    phone:'9800 0003', clinic:'central',    createdAt: now },
    { id:'PAT-SEED04', patientNumber:'P004', name:'David Ho',     phone:'9800 0004', clinic:'taikoo',     createdAt: now },
    { id:'PAT-SEED05', patientNumber:'P005', name:'Emma Cheng',   phone:'9800 0005', clinic:'taikoo',     createdAt: now },
    { id:'PAT-SEED06', patientNumber:'P006', name:'Felix Yuen',   phone:'9800 0006', clinic:'taikoo',     createdAt: now },
    { id:'PAT-SEED07', patientNumber:'P007', name:'Grace Tsang',  phone:'9800 0007', clinic:'shaukeiwan', createdAt: now },
    { id:'PAT-SEED08', patientNumber:'P008', name:'Henry Mak',    phone:'9800 0008', clinic:'shaukeiwan', createdAt: now },
    { id:'PAT-SEED09', patientNumber:'P009', name:'Iris Tang',    phone:'9800 0009', clinic:'shaukeiwan', createdAt: now },
    { id:'PAT-SEED10', patientNumber:'P010', name:'Jack Cheung',  phone:'9800 0010', clinic:'central',    createdAt: now },
    { id:'PAT-SEED11', patientNumber:'P011', name:'Karen Liu',    phone:'9800 0011', clinic:'taikoo',     createdAt: now },
    { id:'PAT-SEED12', patientNumber:'P012', name:'Leo Pang',     phone:'9800 0012', clinic:'taikoo',     createdAt: now },
    // Orthodontic patients
    { id:'PAT-SEED13', patientNumber:'P013', name:'Michael Yip',  phone:'9800 0013', clinic:'central',    createdAt: now },
    { id:'PAT-SEED14', patientNumber:'P014', name:'Nancy Chu',    phone:'9800 0014', clinic:'taikoo',     createdAt: now },
    { id:'PAT-SEED15', patientNumber:'P015', name:'Oscar Wong',   phone:'9800 0015', clinic:'shaukeiwan', createdAt: now },
  ];
  savePatients(seedPatients);

  // patId=null → new patient booking (not a registered patient)
  const appt = (id, clinic, clinicName, doctorId, dayOffset, h, m, patId, patNum, patient, phone, typeId, typeName, duration, status, reason) => ({
    id, clinic, clinicName,
    doctorId, doctorName: DOCTORS.find(d => d.id === doctorId).name,
    specialty: 'dentistry',
    date: ds(dayOffset), time: formatTimeSlot(h, m),
    patientId: patId, patientNumber: patNum,
    patientName: patient, patientPhone: phone,
    typeId, typeName, duration,
    status, reason, createdAt: now,
  });

  const list = [
    // ── Central ── Mon: Dr Samuel Chan only ────────────────────────────────────
    appt('SEED-C01','central','Central',1,0, 9, 0, 'PAT-SEED01','P001','Alice Wong',  '9800 0001','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine exam'),
    appt('SEED-C02','central','Central',1,0,10, 0, 'PAT-SEED03','P003','Carol Lam',   '9800 0003','filling',   'Filling / Restoration',30,'confirmed','Upper right cavity'),
    appt('SEED-C03','central','Central',1,0,14, 0, null,'','Mandy Tsui',  '6100 0031','consult',   'New Patient Consult',  30,'confirmed','New patient walk-in'),
    // ── Central ── Tue: Dr Agassi Kwok only ────────────────────────────────────
    appt('SEED-C04','central','Central',2,1,10, 0, 'PAT-SEED02','P002','Bob Chan',    '9800 0002','filling',   'Filling / Restoration',30,'confirmed','Upper right cavity'),
    appt('SEED-C05','central','Central',2,1,11, 0, 'PAT-SEED10','P010','Jack Cheung', '9800 0010','checkup',   'Check-up & Cleaning',  30,'confirmed','Annual check'),
    appt('SEED-C06','central','Central',2,1,14,30, 'PAT-SEED03','P003','Carol Lam',   '9800 0003','extraction','Tooth Extraction',     30,'cancelled','Cancelled by patient'),
    // ── Central ── Wed: Dr Samuel Chan only ────────────────────────────────────
    appt('SEED-C07','central','Central',1,2, 9, 0, 'PAT-SEED01','P001','Alice Wong',  '9800 0001','whitening', 'Teeth Whitening',      30,'completed','Whitening complete'),
    // ── Central ── Thu: Dr Agassi Kwok only ────────────────────────────────────
    appt('SEED-C08','central','Central',2,3,10, 0, null,'','Nathan Fung', '6100 0032','consult',   'New Patient Consult',  30,'confirmed','New patient referral'),
    appt('SEED-C09','central','Central',2,3,14, 0, 'PAT-SEED02','P002','Bob Chan',    '9800 0002','extraction','Tooth Extraction',     30,'confirmed','Wisdom tooth pain'),
    // ── Central ── Fri: Dr Samuel Chan only ────────────────────────────────────
    appt('SEED-C10','central','Central',1,4, 9, 0, 'PAT-SEED10','P010','Jack Cheung', '9800 0010','checkup',   'Check-up & Cleaning',  30,'confirmed','Annual check'),
    appt('SEED-C11','central','Central',1,4,10,30, null,'','Olivia Kwong','6100 0033','checkup',   'Check-up & Cleaning',  30,'confirmed','New patient walk-in'),

    // ── Taikoo ── Mon: Dr Agassi Kwok only ─────────────────────────────────────
    appt('SEED-T01','taikoo','Taikoo',  2,0,10, 0, 'PAT-SEED04','P004','David Ho',   '9800 0004','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine exam'),
    appt('SEED-T02','taikoo','Taikoo',  2,0,11, 0, 'PAT-SEED06','P006','Felix Yuen', '9800 0006','filling',   'Filling / Restoration',30,'confirmed','Cavity filling'),
    // ── Taikoo ── Tue: Dr Samuel Chan only ─────────────────────────────────────
    appt('SEED-T03','taikoo','Taikoo',  1,1, 9,30, 'PAT-SEED11','P011','Karen Liu',  '9800 0011','whitening', 'Teeth Whitening',      30,'confirmed','Pre-wedding whitening'),
    appt('SEED-T04','taikoo','Taikoo',  1,1,11, 0, null,'','Peter Siu',   '6100 0034','consult',   'New Patient Consult',  30,'confirmed','New patient — first visit'),
    appt('SEED-T05','taikoo','Taikoo',  1,1,14, 0, 'PAT-SEED11','P011','Karen Liu',  '9800 0011','extraction','Tooth Extraction',     30,'cancelled','Cancelled — rescheduled'),
    // ── Taikoo ── Wed: Dr Agassi Kwok only ─────────────────────────────────────
    appt('SEED-T06','taikoo','Taikoo',  2,2,10,30, 'PAT-SEED04','P004','David Ho',   '9800 0004','rootcanal', 'Root Canal',           30,'completed','Root canal complete'),
    // ── Taikoo ── Thu: Dr Samuel Chan only ─────────────────────────────────────
    appt('SEED-T07','taikoo','Taikoo',  1,3, 9, 0, 'PAT-SEED12','P012','Leo Pang',   '9800 0012','checkup',   'Check-up & Cleaning',  30,'confirmed','Annual check'),
    appt('SEED-T08','taikoo','Taikoo',  1,3,11, 0, null,'','Queenie Ng',  '6100 0035','consult',   'New Patient Consult',  30,'confirmed','New patient assessment'),
    // ── Taikoo ── Fri: Dr Agassi Kwok only ─────────────────────────────────────
    appt('SEED-T09','taikoo','Taikoo',  2,4,10, 0, 'PAT-SEED06','P006','Felix Yuen', '9800 0006','filling',   'Filling / Restoration',30,'confirmed','Old filling replaced'),
    appt('SEED-T10','taikoo','Taikoo',  2,4,14, 0, 'PAT-SEED05','P005','Emma Cheng', '9800 0005','extraction','Tooth Extraction',     30,'confirmed','Impacted wisdom tooth'),

    // ── Shau Kei Wan ── Mon: Dr Samuel Chan only ───────────────────────────────
    appt('SEED-S01','shaukeiwan','Shau Kei Wan',1,0, 9, 0, 'PAT-SEED07','P007','Grace Tsang','9800 0007','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine exam'),
    appt('SEED-S02','shaukeiwan','Shau Kei Wan',1,0,10, 0, null,'','Raymond Au', '6100 0036','filling',   'Filling / Restoration',30,'confirmed','New patient — two cavities'),
    // ── Shau Kei Wan ── Tue: Dr Agassi Kwok only ───────────────────────────────
    appt('SEED-S03','shaukeiwan','Shau Kei Wan',2,1,10, 0, 'PAT-SEED08','P008','Henry Mak',  '9800 0008','consult',   'New Patient Consult',  30,'confirmed','First visit'),
    appt('SEED-S04','shaukeiwan','Shau Kei Wan',2,1,11,30, 'PAT-SEED09','P009','Iris Tang',  '9800 0009','filling',   'Filling / Restoration',30,'cancelled','Cancelled — emergency'),
    // ── Shau Kei Wan ── Wed: Dr Samuel Chan only ───────────────────────────────
    appt('SEED-S05','shaukeiwan','Shau Kei Wan',1,2,11, 0, 'PAT-SEED09','P009','Iris Tang',  '9800 0009','rootcanal', 'Root Canal',           30,'confirmed','Root canal treatment'),
    // ── Shau Kei Wan ── Thu: Dr Agassi Kwok only ───────────────────────────────
    appt('SEED-S06','shaukeiwan','Shau Kei Wan',2,3,14, 0, 'PAT-SEED07','P007','Grace Tsang','9800 0007','whitening', 'Teeth Whitening',      30,'confirmed','Whitening treatment'),
    appt('SEED-S07','shaukeiwan','Shau Kei Wan',2,3,15,30, null,'','Stella Chan','6100 0037','consult',   'New Patient Consult',  30,'confirmed','New patient walk-in'),
    // ── Shau Kei Wan ── Fri: Dr Samuel Chan only ───────────────────────────────
    appt('SEED-S08','shaukeiwan','Shau Kei Wan',1,4, 9, 0, 'PAT-SEED09','P009','Iris Tang',  '9800 0009','checkup',     'Check-up & Cleaning',   30,'completed','Annual check'),
    appt('SEED-S09','shaukeiwan','Shau Kei Wan',1,4,10,30, null,'','Ming Lau',   '6100 0038','consult',     'New Patient Consult',   30,'confirmed','New patient referral'),

    // ── Orthodontic appointments — Central (P013 Michael Yip) ──────────────────
    appt('SEED-O01','central','Central',1,0,11, 0, 'PAT-SEED13','P013','Michael Yip','9800 0013','orthodontic','Orthodontic Treatment',60,'completed','Initial fitting — upper braces'),
    appt('SEED-O02','central','Central',2,3,10,30, 'PAT-SEED13','P013','Michael Yip','9800 0013','orthodontic','Orthodontic Treatment',60,'confirmed','4-week adjustment'),
    // ── Orthodontic appointments — Taikoo (P014 Nancy Chu) ─────────────────────
    appt('SEED-O03','taikoo','Taikoo',  1,1,13, 0, 'PAT-SEED14','P014','Nancy Chu', '9800 0014','orthodontic','Orthodontic Treatment',60,'completed','Aligner fitting — set 1'),
    appt('SEED-O04','taikoo','Taikoo',  1,3,13, 0, 'PAT-SEED14','P014','Nancy Chu', '9800 0014','orthodontic','Orthodontic Treatment',60,'confirmed','Aligner progress check'),
    // ── Orthodontic appointments — Shau Kei Wan (P015 Oscar Wong) ──────────────
    appt('SEED-O05','shaukeiwan','Shau Kei Wan',1,2, 9, 0, 'PAT-SEED15','P015','Oscar Wong','9800 0015','orthodontic','Orthodontic Treatment',60,'completed','Initial consultation & records'),
    appt('SEED-O06','shaukeiwan','Shau Kei Wan',1,4,13, 0, 'PAT-SEED15','P015','Oscar Wong','9800 0015','orthodontic','Orthodontic Treatment',60,'confirmed','Bonding appointment'),
  ];

  // Seed paid amounts for orthodontic patients
  const seedPaid = {
    'SEED-O01': 800, 'SEED-O02': 0,    // Michael: 1 of 2 paid
    'SEED-O03': 800, 'SEED-O04': 400,  // Nancy: 1.5 of 2 paid
    'SEED-O05': 0,   'SEED-O06': 0,    // Oscar: none paid yet
  };
  const apptList = list.map(a => seedPaid[a.id] !== undefined ? { ...a, paidAmount: seedPaid[a.id] } : a);

  saveAppointments(apptList);
  localStorage.setItem('clinic_seeded_v8', '1');
}
