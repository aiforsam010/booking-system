// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  step: 1,
  clinic: null,
  specialty: 'dentistry',
  doctor: null,
  type: null,
  duration: null,
  date: null,
  time: null,
  calMonth: null,
  patientMode: 'new',       // 'new' | 'registered'
  linkedPatientId: null,
  patient: { name: '', phone: '', patientNumber: '', clinic: '', reason: '' },
  booking: null,
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

function initBooking() {
  Object.assign(state, {
    step: 1, clinic: null, specialty: 'dentistry',
    doctor: null, type: null, duration: null, date: null, time: null, booking: null, calMonth: null,
    patientMode: 'new', linkedPatientId: null,
    patient: { name: '', phone: '', patientNumber: '', clinic: '', reason: '' },
  });
  renderStep();
}

// ── Render dispatcher ─────────────────────────────────────────────────────────

function renderStep() {
  try {
    updateProgress();
    const content = document.getElementById('step-content');
    if (!content) return;

    switch (state.step) {
      case 1: content.innerHTML = renderClinics(); break;
      case 2: content.innerHTML = renderDoctors();     break;
      case 3: content.innerHTML = renderDateTime();    renderCalendar(); break;
      case 4: content.innerHTML = renderPatientForm(); break;
      case 5: content.innerHTML = renderConfirmation(); break;
    }

    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.style.display = (state.step > 1 && state.step < 5) ? 'inline-flex' : 'none';
  } catch (err) {
    console.error('renderStep error:', err);
    const content = document.getElementById('step-content');
    if (content) content.innerHTML = `<div class="empty-state" style="color:var(--danger)">Error rendering step: ${err.message}</div>`;
  }
}

function updateProgress() {
  [1, 2, 3, 4].forEach(i => {
    const el = document.getElementById('bstep-' + i);
    if (!el) return;
    el.className = 'step-indicator ' +
      (i < state.step ? 'done' : i === state.step ? 'active' : 'idle');
  });
}

// ── Step 1 — Clinic ───────────────────────────────────────────────────────────

function renderClinics() {
  return `
    <div class="step-header">
      <h2>Select Clinic</h2>
      <p>Choose the BrightSmile branch you are booking at</p>
    </div>
    <div class="grid-3">
      ${CLINICS.map(c => `
        <button class="card specialty-card ${state.clinic === c.id ? 'selected' : ''}"
                onclick="selectClinic('${c.id}')">
          <div class="specialty-icon">${c.icon}</div>
          <div class="specialty-name">${c.name}</div>
          <div class="specialty-desc">${c.address}</div>
        </button>`).join('')}
    </div>`;
}

function selectClinic(id) {
  state.clinic = id;
  state.doctor = null;
  state.step = 2;
  renderStep();
}

// ── Step 2 — Doctor ───────────────────────────────────────────────────────────

function renderDoctors() {
  const doctors = DOCTORS.filter(d => d.specialty === state.specialty);
  const clinic = CLINICS.find(c => c.id === state.clinic);
  return `
    <div class="step-header">
      <h2>Select Dentist</h2>
      <p>${clinic ? clinic.name + ' branch · ' : ''}${doctors.length} dentist${doctors.length !== 1 ? 's' : ''} available</p>
    </div>
    <div class="grid-2">
      ${doctors.map(d => renderDoctorCard(d)).join('')}
    </div>`;
}

function renderDoctorCard(d) {
  const color    = getAvatarColor(d.name);
  const initials = getInitials(d.name);
  return `
    <button class="card doctor-card ${state.doctor === d.id ? 'selected' : ''}"
            onclick="selectDoctor(${d.id})">
      <div class="doctor-header">
        <div class="avatar" style="background:${color}">${initials}</div>
        <div class="doctor-name">${d.name}</div>
      </div>
    </button>`;
}

function selectDoctor(id) {
  state.doctor = id;
  state.step   = 3;
  const now    = new Date();
  state.calMonth = { year: now.getFullYear(), month: now.getMonth() };
  renderStep();
}

// ── Step 3 — Date & Time ──────────────────────────────────────────────────────

function renderDateTime() {
  const DURATION_OPTIONS = [
    { label: '5 mins',  value: 5 },
    { label: '15 mins', value: 15 },
    { label: '30 mins', value: 30 },
    { label: 'Custom',  value: 'custom' },
  ];
  const isCustom = state.duration === 'custom' || (state.duration !== null && ![5,15,30].includes(state.duration) && state.duration !== null);
  const customActive = typeof state.duration === 'number' && ![5,15,30].includes(state.duration);

  return `
    <div class="step-header">
      <h2>Select Date &amp; Time</h2>
      <p>Choose the appointment type, duration, date, and time slot</p>
    </div>
    <div class="type-section">
      <h3>Appointment Type</h3>
      <div class="type-grid">
        ${APPOINTMENT_TYPES.map(t => `
          <button class="type-card ${state.type === t.id ? 'selected' : ''}"
                  onclick="selectType('${t.id}')">
            <div class="type-name">${t.name}</div>
          </button>`).join('')}
      </div>
    </div>
    <div class="duration-section">
      <h3>Appointment Length</h3>
      <div class="duration-row">
        <button class="dur-btn ${state.duration === 5 ? 'selected' : ''}" onclick="selectDuration(5)">5 mins</button>
        <button class="dur-btn ${state.duration === 15 ? 'selected' : ''}" onclick="selectDuration(15)">15 mins</button>
        <button class="dur-btn ${state.duration === 30 ? 'selected' : ''}" onclick="selectDuration(30)">30 mins</button>
        <button class="dur-btn ${customActive || state.duration === 'custom' ? 'selected' : ''}" onclick="selectDuration('custom')">Custom</button>
        <div id="custom-dur-wrap" style="display:${customActive || state.duration === 'custom' ? 'flex' : 'none'};align-items:center;gap:8px;">
          <input id="custom-dur-input" type="number" min="1" max="480" placeholder="mins"
                 class="form-input" style="width:90px;"
                 value="${customActive ? state.duration : ''}"
                 oninput="applyCustomDuration(this.value)">
          <span style="color:var(--text-muted);font-size:13px;">min</span>
        </div>
      </div>
    </div>
    <div class="datetime-layout">
      <div class="calendar-section">
        <div class="cal-nav">
          <button class="cal-arrow" onclick="prevMonth()">&#8249;</button>
          <span id="cal-title" class="cal-title"></span>
          <button class="cal-arrow" onclick="nextMonth()">&#8250;</button>
        </div>
        <div id="calendar-grid"></div>
      </div>
      <div class="slots-section" id="slots-section">
        ${state.date && state.type && state.duration && state.duration !== 'custom'
          ? buildTimeSlotsHTML()
          : '<div class="slots-placeholder"><span>📅</span><p>Select type, length, and date to see available times</p></div>'}
      </div>
    </div>
    <div class="step3-footer">
      <button class="btn btn-primary" id="step3-next" onclick="goToStep4()"
              ${state.type && state.duration && state.duration !== 'custom' && state.date && state.time ? '' : 'disabled'}>
        Continue →
      </button>
    </div>`;
}

function renderCalendar() {
  const { year, month } = state.calMonth;
  const titleEl = document.getElementById('cal-title');
  const gridEl  = document.getElementById('calendar-grid');
  if (!titleEl || !gridEl) return;

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  titleEl.textContent = `${MONTHS[month]} ${year}`;

  const today      = new Date(); today.setHours(0,0,0,0);
  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const doctor     = getDoctorById(state.doctor);

  let html = '<div class="cal-weekdays">' +
    ['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => `<div class="cal-wday">${d}</div>`).join('') +
    '</div><div class="cal-days">';

  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date  = new Date(year, month, d); date.setHours(0,0,0,0);
    const ds    = date.toISOString().split('T')[0];
    const past  = date < today;
    const works = doctor.days.includes(date.getDay());
    const cls   = ['cal-day', past || !works ? 'disabled' : 'available',
                   state.date === ds ? 'selected' : '',
                   date.getTime() === today.getTime() ? 'today' : ''].filter(Boolean).join(' ');
    html += `<div class="${cls}" ${!past && works ? `onclick="selectDate('${ds}')"` : ''}>${d}</div>`;
  }
  html += '</div>';
  gridEl.innerHTML = html;
}

function buildTimeSlotsHTML() {
  const doctor = getDoctorById(state.doctor);
  const dur    = typeof state.duration === 'number' ? state.duration : 30;
  const slots  = generateTimeSlots(doctor, state.date, dur);
  if (!slots.length) return '<div class="slots-placeholder"><span>🚫</span><p>No available slots for this date</p></div>';
  return `
    <h3>Available Times</h3>
    <div class="date-label">${formatDate(state.date)}</div>
    <div class="slots-grid">
      ${slots.map(s => `
        <button class="slot ${s.available ? '' : 'booked'} ${state.time === s.time && s.available ? 'selected' : ''}"
                ${s.available ? `onclick="selectTime('${s.time}')"` : 'disabled title="Already booked"'}>
          ${s.time}
        </button>`).join('')}
    </div>`;
}

function selectType(id) {
  state.type = id; state.time = null;
  document.querySelectorAll('.type-card').forEach(el =>
    el.classList.toggle('selected', el.querySelector('.type-name').textContent ===
      APPOINTMENT_TYPES.find(t => t.id === id).name));
  refreshSlots(); updateStep3Next();
}

function selectDuration(val) {
  state.duration = val; state.time = null;
  document.querySelectorAll('.dur-btn').forEach((btn, i) => {
    const vals = [5, 15, 30, 'custom'];
    const isCustomActive = typeof state.duration === 'number' && ![5,15,30].includes(state.duration);
    btn.classList.toggle('selected',
      (vals[i] === val) || (vals[i] === 'custom' && isCustomActive));
  });
  const wrap = document.getElementById('custom-dur-wrap');
  if (wrap) wrap.style.display = (val === 'custom' || (typeof val === 'number' && ![5,15,30].includes(val))) ? 'flex' : 'none';
  refreshSlots(); updateStep3Next();
}

function applyCustomDuration(val) {
  const mins = parseInt(val, 10);
  state.duration = (mins > 0) ? mins : 'custom';
  state.time = null;
  refreshSlots(); updateStep3Next();
}

function selectDate(ds) {
  state.date = ds; state.time = null;
  renderCalendar(); refreshSlots(); updateStep3Next();
}

function selectTime(time) {
  state.time = time;
  document.querySelectorAll('.slot.available').forEach(el =>
    el.classList.toggle('selected', el.textContent.trim() === time));
  updateStep3Next();
}

function refreshSlots() {
  const el = document.getElementById('slots-section');
  if (!el) return;
  el.innerHTML = (state.date && state.type && state.duration && state.duration !== 'custom')
    ? buildTimeSlotsHTML()
    : '<div class="slots-placeholder"><span>📅</span><p>Select type, length, and date to see available times</p></div>';
}

function updateStep3Next() {
  const btn = document.getElementById('step3-next');
  if (btn) btn.disabled = !(state.type && state.duration && state.duration !== 'custom' && state.date && state.time);
}

function prevMonth() {
  const { year, month } = state.calMonth;
  state.calMonth = month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
  renderCalendar();
}

function nextMonth() {
  const { year, month } = state.calMonth;
  state.calMonth = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
  renderCalendar();
}

function goToStep4() {
  if (!state.type || !state.duration || state.duration === 'custom' || !state.date || !state.time) return;
  state.step = 4; renderStep();
}

// ── Step 4 — Patient Info ─────────────────────────────────────────────────────

function renderPatientForm() {
  const doctor = getDoctorById(state.doctor);
  const type   = APPOINTMENT_TYPES.find(t => t.id === state.type);
  const color  = getAvatarColor(doctor.name);
  const ini    = getInitials(doctor.name);
  const isNew  = state.patientMode === 'new';

  return `
    <div class="step-header">
      <h2>Patient Information</h2>
    </div>

    <div class="booking-summary-bar">
      <div class="summary-left">
        <div class="avatar-sm" style="background:${color}">${ini}</div>
        <div>
          <div class="summary-doctor">${doctor.name}</div>
          <div class="summary-type">${type.name} &bull; ${state.duration} min</div>
        </div>
      </div>
      <div class="summary-mid">
        <div class="summary-date">${formatDate(state.date)}</div>
        <div class="summary-time">${state.time}</div>
      </div>
      <div class="summary-price">$${type.price}</div>
    </div>

    <div class="mode-tabs">
      <button class="mode-tab ${isNew ? 'active' : ''}" onclick="switchPatientMode('new')">
        New Patient
      </button>
      <button class="mode-tab ${!isNew ? 'active' : ''}" onclick="switchPatientMode('registered')">
        Registered Patient
      </button>
    </div>

    <!-- ── New patient ── -->
    <div id="mode-new" style="display:${isNew ? 'block' : 'none'}">
      <form id="patient-form" onsubmit="submitBooking(event,'new')">
        <div class="form-grid">
          <div class="form-group">
            <label for="f-name">Full Name <span class="req">*</span></label>
            <input id="f-name" type="text" name="name"
                   value="${state.patient.name}" placeholder="e.g. Chan Tai Man" required>
          </div>
          <div class="form-group">
            <label for="f-phone">Phone Number <span class="req">*</span></label>
            <input id="f-phone" type="tel" name="phone"
                   value="${state.patient.phone}" placeholder="e.g. 6123 4567" required>
          </div>
          <div class="form-group full-width">
            <label for="f-reason">Chief Complaint / Notes</label>
            <textarea id="f-reason" name="reason" rows="3"
                      placeholder="e.g. toothache upper left, sensitivity to cold…">${state.patient.reason}</textarea>
          </div>
        </div>
        <div class="form-footer">
          <div></div>
          <button type="submit" class="btn btn-primary btn-lg">Confirm Booking →</button>
        </div>
      </form>
    </div>

    <!-- ── Registered patient ── -->
    <div id="mode-reg" style="display:${!isNew ? 'block' : 'none'}">
      <div id="reg-search-wrap">
        <div class="patient-search-box">
          <input id="reg-search" type="text" class="form-input"
                 placeholder="Search by name or patient number…"
                 oninput="searchRegisteredPatients(this.value)">
        </div>
        <div id="reg-results"></div>
      </div>

      <div id="reg-selected-wrap" style="display:none">
        <div class="selected-patient-card" id="selected-patient-card"></div>
        <form id="patient-form-reg" onsubmit="submitBooking(event,'registered')">
          <div class="form-group" style="margin-top:16px;">
            <label for="f-reason-reg">Chief Complaint / Notes</label>
            <textarea id="f-reason-reg" name="reason" rows="3"
                      placeholder="e.g. toothache upper left, sensitivity to cold…"></textarea>
          </div>
          <div class="form-footer">
            <button type="button" class="btn btn-ghost" onclick="clearLinkedPatient()">← Change Patient</button>
            <button type="submit" class="btn btn-primary btn-lg">Confirm Booking →</button>
          </div>
        </form>
      </div>

      <div id="reg-prompt" class="reg-prompt" style="display:${!isNew ? 'flex' : 'none'}">
        Search and select a registered patient to continue
      </div>
    </div>`;
}

function switchPatientMode(mode) {
  state.patientMode    = mode;
  state.linkedPatientId = null;
  const isNew = mode === 'new';
  document.querySelectorAll('.mode-tab').forEach((btn, i) =>
    btn.classList.toggle('active', isNew ? i === 0 : i === 1));
  document.getElementById('mode-new').style.display = isNew ? 'block' : 'none';
  document.getElementById('mode-reg').style.display = isNew ? 'none' : 'block';
}

function searchRegisteredPatients(q) {
  const results = document.getElementById('reg-results');
  const prompt  = document.getElementById('reg-prompt');
  if (!results) return;

  if (!q.trim()) {
    results.innerHTML = '';
    if (prompt) prompt.style.display = 'flex';
    return;
  }
  if (prompt) prompt.style.display = 'none';

  const matches = getPatients().filter(p =>
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.patientNumber.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 6);

  if (!matches.length) {
    results.innerHTML = '<div class="reg-no-result">No registered patients found</div>';
    return;
  }
  results.innerHTML = matches.map(p => {
    const clinic = CLINICS.find(c => c.id === p.clinic)?.name || '';
    return `<div class="reg-result" onclick="linkPatient('${p.id}')">
      <div class="rr-num">${p.patientNumber}</div>
      <div class="rr-info">
        <div class="rr-name">${p.name}</div>
        <div class="rr-meta">${p.phone}${clinic ? ' · ' + clinic : ''}</div>
      </div>
      <div class="rr-link">Select →</div>
    </div>`;
  }).join('');
}

function linkPatient(id) {
  const p = getPatients().find(pt => pt.id === id);
  if (!p) return;
  state.linkedPatientId = id;

  const clinic = CLINICS.find(c => c.id === p.clinic)?.name || '';
  const history = getAppointments()
    .filter(a => a.patientId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const histHTML = history.length
    ? `<div class="linked-hist">
        <div class="lh-title">Booking History (${history.length})</div>
        ${history.map(a => {
          const sc = { confirmed:'sc-confirmed', cancelled:'sc-cancelled', completed:'sc-completed' }[a.status] || '';
          return `<div class="lh-row">
            <span class="lh-date">${formatDate(a.date)}</span>
            <span class="lh-sep">·</span>
            <span class="lh-type">${a.typeName}</span>
            <span class="lh-sep">·</span>
            <span class="lh-clinic">${a.clinicName}</span>
            <span class="status-chip ${sc}" style="margin-left:auto;">${a.status}</span>
          </div>`;
        }).join('')}
      </div>`
    : '<div class="linked-hist lh-empty">No previous appointments.</div>';

  document.getElementById('selected-patient-card').innerHTML = `
    <div class="sp-check">✓</div>
    <div class="sp-detail">
      <div class="sp-name">${p.name}</div>
      <div class="sp-meta">
        <span class="sp-num">${p.patientNumber}</span>
        · ${p.phone}
        ${clinic ? `· <span class="clinic-badge clinic-${p.clinic}">${clinic}</span>` : ''}
      </div>
    </div>
    ${histHTML}`;

  document.getElementById('reg-search-wrap').style.display = 'none';
  document.getElementById('reg-selected-wrap').style.display = 'block';
  document.getElementById('reg-prompt').style.display = 'none';
}

function clearLinkedPatient() {
  state.linkedPatientId = null;
  document.getElementById('reg-search-wrap').style.display = 'block';
  document.getElementById('reg-selected-wrap').style.display = 'none';
  document.getElementById('reg-prompt').style.display = 'flex';
  const s = document.getElementById('reg-search');
  if (s) { s.value = ''; }
  const r = document.getElementById('reg-results');
  if (r) r.innerHTML = '';
}

function submitBooking(e, mode) {
  e.preventDefault();
  const fd     = new FormData(e.target);
  const doctor = getDoctorById(state.doctor);
  const type   = APPOINTMENT_TYPES.find(t => t.id === state.type);

  if (mode === 'registered') {
    if (!state.linkedPatientId) { alert('Please select a registered patient.'); return; }
    const p      = getPatients().find(pt => pt.id === state.linkedPatientId);
    state.patient = {
      name: p.name, phone: p.phone,
      patientNumber: p.patientNumber, clinic: p.clinic, reason: (fd.get('reason') || '').trim(),
    };
    state.booking = addAppointment({
      doctorId: state.doctor, doctorName: doctor.name, specialty: doctor.specialty,
      patientId: p.id, patientNumber: p.patientNumber,
      patientName: p.name, patientPhone: p.phone,
      clinic: state.clinic, clinicName: CLINICS.find(c => c.id === state.clinic)?.name || '',
      date: state.date, time: state.time,
      typeId: state.type, typeName: type.name, duration: state.duration, reason: state.patient.reason,
    });
  } else {
    state.patient = {
      name: fd.get('name').trim(), phone: fd.get('phone').trim(),
      patientNumber: '', clinic: '', reason: (fd.get('reason') || '').trim(),
    };
    state.booking = addAppointment({
      doctorId: state.doctor, doctorName: doctor.name, specialty: doctor.specialty,
      patientId: null, patientNumber: '',
      patientName: state.patient.name, patientPhone: state.patient.phone,
      clinic: state.clinic, clinicName: CLINICS.find(c => c.id === state.clinic)?.name || '',
      date: state.date, time: state.time,
      typeId: state.type, typeName: type.name, duration: state.duration, reason: state.patient.reason,
    });
  }

  state.step = 5;
  renderStep();
}

// ── Step 5 — Confirmation ─────────────────────────────────────────────────────

function renderConfirmation() {
  const a      = state.booking;
  const doctor = getDoctorById(a.doctorId);
  const type   = APPOINTMENT_TYPES.find(t => t.id === a.typeId);
  const spec   = SPECIALTIES.find(s => s.id === doctor.specialty);
  const color  = getAvatarColor(doctor.name);
  const ini    = getInitials(doctor.name);
  const rows   = [
    ['Date',    formatDate(a.date)],
    ['Time',    a.time],
    ['Clinic',  a.clinicName || '—'],
    ['Type',    `${a.typeName} (${a.duration} min)`],
    ['Patient', a.patientName],
    ['Phone',   a.patientPhone],
    ...(a.patientNumber ? [['Patient No.', a.patientNumber]] : []),
    ['Fee',     `$${type.price}`],
  ];

  return `
    <div class="confirmation">
      <div class="confirm-check">✓</div>
      <h2>Appointment Booked!</h2>
      <p class="confirm-sub">The appointment has been saved successfully.</p>
      <div class="confirm-ref">Booking Ref: <strong>${a.id}</strong></div>

      <div class="confirm-card">
        <div class="confirm-doctor-row">
          <div class="avatar" style="background:${color}">${ini}</div>
          <div>
            <div class="confirm-doctor-name">${doctor.name}</div>
            <div class="confirm-specialty">${spec.name}</div>
          </div>
        </div>
        <div class="confirm-details">
          ${rows.map(([label, val]) => `
            <div class="confirm-row-item">
              <span class="confirm-label">${label}</span>
              <span class="confirm-value">${val || '—'}</span>
            </div>`).join('')}
          ${a.reason ? `
            <div class="confirm-row-item full">
              <span class="confirm-label">Notes</span>
              <span class="confirm-value">${a.reason}</span>
            </div>` : ''}
        </div>
      </div>

      <div class="confirm-actions">
        <button class="btn btn-outline" onclick="initBooking()">Book Another Patient</button>
        <button class="btn btn-primary" onclick="showTab('appointments')">View Appointments</button>
      </div>
    </div>`;
}

// ── Navigation ────────────────────────────────────────────────────────────────

function goBack() {
  if (state.step <= 1 || state.step === 5) return;
  state.step--;
  renderStep();
}
