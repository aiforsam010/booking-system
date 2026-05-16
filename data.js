const SPECIALTIES = [
  { id: 'dentistry', name: 'Dentistry', icon: '🦷', description: 'General & cosmetic dental care' },
];

const DOCTORS = [
  { id: 1, name: 'Dr. Samuel Chan', specialty: 'dentistry', experience: '12 years', rating: 4.9, reviews: 218, bio: 'General dentist specializing in preventive care, cosmetic dentistry, and restorations.', days: [1,2,3,4,5], start: 9,  end: 17, lunch: [12,13] },
  { id: 2, name: 'Dr. Agassi Kwok', specialty: 'dentistry', experience: '8 years',  rating: 4.8, reviews: 154, bio: 'Focuses on oral surgery, root canals, implants, and complex extractions.',               days: [1,2,3,4,5], start: 10, end: 18, lunch: [13,14] },
];

const APPOINTMENT_TYPES = [
  { id: 'checkup',    name: 'Check-up & Cleaning',   duration: 60, price: 120, description: 'Routine exam, scale & polish'          },
  { id: 'consult',    name: 'New Patient Consult',    duration: 45, price: 90,  description: 'First visit — full oral assessment'    },
  { id: 'filling',    name: 'Filling / Restoration',  duration: 60, price: 180, description: 'Cavity filling or tooth restoration'   },
  { id: 'extraction', name: 'Tooth Extraction',       duration: 45, price: 150, description: 'Simple or surgical tooth removal'      },
  { id: 'rootcanal',  name: 'Root Canal',             duration: 90, price: 350, description: 'Endodontic treatment to save the tooth' },
  { id: 'whitening',  name: 'Teeth Whitening',        duration: 60, price: 200, description: 'Professional in-chair whitening'       },
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
  if (localStorage.getItem('clinic_seeded_v5')) return;
  ['clinic_seeded','clinic_seeded_v2','clinic_seeded_v3','clinic_seeded_v4'].forEach(k => localStorage.removeItem(k));

  // Compute Monday of the current week
  const today = new Date(); today.setHours(0,0,0,0);
  const dow   = today.getDay();
  const mon   = new Date(today); mon.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));

  function ds(offsetDays) {
    const d = new Date(mon); d.setDate(mon.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  }

  const now = new Date().toISOString();
  const appt = (id, clinic, clinicName, doctorId, dayOffset, h, m, patient, phone, typeId, typeName, duration, status, reason) => ({
    id, clinic, clinicName,
    doctorId,
    doctorName: DOCTORS.find(d => d.id === doctorId).name,
    specialty:  'dentistry',
    date:       ds(dayOffset),
    time:       formatTimeSlot(h, m),
    patientId: null, patientNumber: '',
    patientName: patient, patientPhone: phone,
    typeId, typeName, duration,
    status, reason, createdAt: now,
  });

  const list = [
    // ── Central ─────────────────────────────────────────────────────────────────
    appt('SEED-C01','central','Central', 1, 0,  9, 0,  'Alice Wong',   '9800 0001','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine exam'),
    appt('SEED-C02','central','Central', 2, 0, 10, 0,  'Bob Chan',     '9800 0002','filling',   'Filling / Restoration',30,'confirmed','Upper right cavity'),
    appt('SEED-C03','central','Central', 1, 0, 11, 0,  'Carol Lam',    '9800 0003','consult',   'New Patient Consult',  30,'confirmed','First visit'),
    appt('SEED-C04','central','Central', 2, 1,  9, 0,  'David Ho',     '9800 0004','extraction','Tooth Extraction',     30,'confirmed','Wisdom tooth pain'),
    appt('SEED-C05','central','Central', 1, 1, 10, 30, 'Emma Cheng',   '9800 0005','whitening', 'Teeth Whitening',      30,'confirmed','Whitening consult'),
    appt('SEED-C06','central','Central', 2, 2, 14, 0,  'Felix Yuen',   '9800 0006','rootcanal', 'Root Canal',           30,'confirmed','Lower molar pain'),
    appt('SEED-C07','central','Central', 1, 2, 15, 0,  'Grace Tsang',  '9800 0007','checkup',   'Check-up & Cleaning',  30,'completed','Annual check-up'),
    appt('SEED-C08','central','Central', 2, 3,  9, 30, 'Henry Mak',    '9800 0008','filling',   'Filling / Restoration',30,'confirmed','Broken filling'),
    appt('SEED-C09','central','Central', 1, 4, 10, 0,  'Iris Tang',    '9800 0009','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine check-up'),
    appt('SEED-C10','central','Central', 2, 4, 14, 30, 'Jack Cheung',  '9800 0010','consult',   'New Patient Consult',  30,'confirmed','New patient'),

    // ── Taikoo ──────────────────────────────────────────────────────────────────
    appt('SEED-T01','taikoo','Taikoo',   1, 0, 10, 0,  'Karen Liu',    '9800 0011','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine exam'),
    appt('SEED-T02','taikoo','Taikoo',   2, 0, 11, 0,  'Leo Pang',     '9800 0012','filling',   'Filling / Restoration',30,'confirmed','Cavity filling'),
    appt('SEED-T03','taikoo','Taikoo',   1, 1,  9, 30, 'Mandy Tsui',   '9800 0013','whitening', 'Teeth Whitening',      30,'confirmed','Pre-wedding whitening'),
    appt('SEED-T04','taikoo','Taikoo',   2, 1, 14, 0,  'Nathan Fung',  '9800 0014','extraction','Tooth Extraction',     30,'confirmed','Impacted tooth'),
    appt('SEED-T05','taikoo','Taikoo',   1, 2,  9, 0,  'Olivia Kwong', '9800 0015','consult',   'New Patient Consult',  30,'confirmed','New patient assessment'),
    appt('SEED-T06','taikoo','Taikoo',   2, 2, 10, 30, 'Peter Siu',    '9800 0016','rootcanal', 'Root Canal',           30,'completed','Root canal follow-up'),
    appt('SEED-T07','taikoo','Taikoo',   1, 3, 14, 0,  'Queenie Ng',   '9800 0017','checkup',   'Check-up & Cleaning',  30,'confirmed','Annual check'),
    appt('SEED-T08','taikoo','Taikoo',   2, 4,  9, 0,  'Raymond Au',   '9800 0018','filling',   'Filling / Restoration',30,'confirmed','Old filling replaced'),
    appt('SEED-T09','taikoo','Taikoo',   1, 4, 11, 0,  'Stella Chan',  '9800 0019','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine exam'),

    // ── Shau Kei Wan ────────────────────────────────────────────────────────────
    appt('SEED-S01','shaukeiwan','Shau Kei Wan', 1, 0,  9, 0,  'Tommy Lo',    '9800 0021','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine exam'),
    appt('SEED-S02','shaukeiwan','Shau Kei Wan', 2, 0, 10, 30, 'Uma Leung',   '9800 0022','consult',   'New Patient Consult',  30,'confirmed','First visit'),
    appt('SEED-S03','shaukeiwan','Shau Kei Wan', 1, 1,  9, 30, 'Victor Wong', '9800 0023','filling',   'Filling / Restoration',30,'confirmed','Two cavities'),
    appt('SEED-S04','shaukeiwan','Shau Kei Wan', 2, 1, 14, 0,  'Wendy Ma',    '9800 0024','whitening', 'Teeth Whitening',      30,'confirmed','Whitening treatment'),
    appt('SEED-S05','shaukeiwan','Shau Kei Wan', 1, 2, 10, 0,  'Xavier Chow', '9800 0025','extraction','Tooth Extraction',     30,'confirmed','Broken molar'),
    appt('SEED-S06','shaukeiwan','Shau Kei Wan', 2, 3,  9, 0,  'Yvonne Lam',  '9800 0026','rootcanal', 'Root Canal',           30,'completed','Root canal treatment'),
    appt('SEED-S07','shaukeiwan','Shau Kei Wan', 1, 3, 11, 0,  'Zachary Hui', '9800 0027','checkup',   'Check-up & Cleaning',  30,'confirmed','Annual check-up'),
    appt('SEED-S08','shaukeiwan','Shau Kei Wan', 2, 4, 10, 0,  'Amy Fong',    '9800 0028','filling',   'Filling / Restoration',30,'confirmed','Filling replacement'),
    appt('SEED-S09','shaukeiwan','Shau Kei Wan', 1, 4, 14, 30, 'Brian Tse',   '9800 0029','checkup',   'Check-up & Cleaning',  30,'confirmed','Routine exam'),
  ];

  saveAppointments(list);
  localStorage.setItem('clinic_seeded_v5', '1');
}
