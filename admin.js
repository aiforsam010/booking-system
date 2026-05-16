const ADMIN_PASS = '1';
let currentTab = 'dashboard';
let calSize = 'normal';

const weekStarts = {
  central:    getMonday(new Date()),
  taikoo:     getMonday(new Date()),
  shaukeiwan: getMonday(new Date()),
};

const miniCalMonths = {
  central:    { year: new Date().getFullYear(), month: new Date().getMonth() },
  taikoo:     { year: new Date().getFullYear(), month: new Date().getMonth() },
  shaukeiwan: { year: new Date().getFullYear(), month: new Date().getMonth() },
};

// ── Auth ──────────────────────────────────────────────────────────────────────

function init() {
  seedData();
  document.getElementById('admin-date').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  if (sessionStorage.getItem('admin_auth')) {
    showApp();
  } else {
    document.getElementById('login-overlay').style.display = 'flex';
  }
}

function login() {
  const val = document.getElementById('pass-input').value;
  if (val === ADMIN_PASS) {
    sessionStorage.setItem('admin_auth', '1');
    document.getElementById('login-overlay').style.display = 'none';
    showApp();
  } else {
    document.getElementById('login-error').textContent = 'Incorrect password.';
  }
}

function logout() {
  sessionStorage.removeItem('admin_auth');
  location.reload();
}

function showApp() {
  document.getElementById('app').style.display = 'flex';
  showTab('dashboard');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function showTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.nav-item[data-tab]').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(el =>
    el.style.display = el.id === 'tab-' + tab ? 'block' : 'none');

  if (tab === 'dashboard')         renderDashboard();
  if (tab === 'appts-central')    renderClinicCalendar('central');
  if (tab === 'appts-taikoo')     renderClinicCalendar('taikoo');
  if (tab === 'appts-shaukeiwan') renderClinicCalendar('shaukeiwan');
  if (tab === 'patients')         renderPatientsTab();
  if (tab === 'doctors')          renderDoctorsTab();
  if (tab === 'booking')          setTimeout(initBooking, 0);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function renderDashboard() {
  const appts  = getAppointments();
  const today  = new Date().toISOString().split('T')[0];
  const todayA = appts.filter(a => a.date === today);

  document.getElementById('stat-today').textContent     = todayA.length;
  document.getElementById('stat-upcoming').textContent  = appts.filter(a => a.date >= today && a.status === 'confirmed').length;
  document.getElementById('stat-total').textContent     = appts.length;
  document.getElementById('stat-newpt').textContent     = appts.filter(a => !a.patientId && a.status !== 'cancelled').length;
  document.getElementById('stat-cancelled').textContent = appts.filter(a => a.status === 'cancelled').length;

  const container = document.getElementById('today-appts');
  if (!todayA.length) {
    container.innerHTML = '<div class="empty-state">No appointments scheduled for today.</div>';
    return;
  }
  todayA.sort((a, b) => a.time.localeCompare(b.time));
  container.innerHTML = todayA.map(a => apptRowHTML(a)).join('');
}

// ── Appointment row (used in dashboard) ──────────────────────────────────────

function apptRowHTML(a) {
  const doctor = getDoctorById(a.doctorId);
  const color  = getAvatarColor(doctor.name);
  const ini    = getInitials(doctor.name);
  const sc     = { confirmed: 'sc-confirmed', cancelled: 'sc-cancelled', completed: 'sc-completed' }[a.status] || '';
  return `
    <div class="appt-row" id="ar-${a.id}">
      <div class="ar-time">${a.time}</div>
      <div class="ar-doctor">
        <div class="avatar-sm" style="background:${color}">${ini}</div>
        <div>
          <div class="ar-dname">${doctor.name}</div>
          <div class="ar-type">${a.typeName}</div>
        </div>
      </div>
      <div class="ar-patient">
        <div class="ar-pname">${a.patientName}</div>
        <div class="ar-contact">${a.patientPhone || ''}</div>
      </div>
      <div class="ar-date">${formatDate(a.date)}</div>
      <span class="status-chip ${sc}">${a.status}</span>
      <div class="ar-actions">
        ${a.status === 'confirmed' ? `
          <button class="btn-xs btn-success" onclick="setStatus('${a.id}','completed')">Complete</button>
          <button class="btn-xs btn-danger"  onclick="setStatus('${a.id}','cancelled')">Cancel</button>
        ` : ''}
        ${a.status === 'cancelled' ? `
          <button class="btn-xs btn-primary" onclick="setStatus('${a.id}','confirmed')">Restore</button>
        ` : ''}
        ${a.status === 'completed' ? `<span class="done-label">Done</span>` : ''}
      </div>
    </div>`;
}

function setStatus(id, status) {
  if (status === 'cancelled' && !confirm('Cancel this appointment?')) return;
  updateAppointmentStatus(id, status);
  if (currentTab === 'dashboard')         renderDashboard();
  if (currentTab === 'appts-central')    renderClinicCalendar('central');
  if (currentTab === 'appts-taikoo')     renderClinicCalendar('taikoo');
  if (currentTab === 'appts-shaukeiwan') renderClinicCalendar('shaukeiwan');
}

// ── Weekly Calendar ───────────────────────────────────────────────────────────

function getMonday(d) {
  const date = new Date(d);
  const day  = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseSlotLabel(label) {
  const [time, period] = label.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return [h, m];
}

function renderClinicCalendar(clinicId) {
  const weekStart = weekStarts[clinicId];
  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  // 15-min slots covering all doctors' hours
  const startH = Math.min(...DOCTORS.map(d => d.start));
  const endH   = Math.max(...DOCTORS.map(d => d.end));
  const slots  = [];
  for (let h = startH; h < endH; h++) {
    for (let m = 0; m < 60; m += 15) slots.push(formatTimeSlot(h, m));
  }

  const weekStartStr = days[0].toISOString().split('T')[0];
  const weekEndStr   = new Date(days[4].getTime() + 86400000).toISOString().split('T')[0];
  const appts = getAppointments().filter(a =>
    a.date >= weekStartStr && a.date < weekEndStr &&
    a.status !== 'cancelled' && a.clinic === clinicId);

  // grid[doctorId][dateStr][slotLabel] = { appt, rowspan } | 'skip' | null
  const grid = {};
  DOCTORS.forEach(doc => {
    grid[doc.id] = {};
    days.forEach(day => {
      const ds = day.toISOString().split('T')[0];
      grid[doc.id][ds] = {};
      slots.forEach(s => { grid[doc.id][ds][s] = null; });

      appts.filter(a => a.doctorId === doc.id && a.date === ds).forEach(appt => {
        const dur    = appt.duration || APPOINTMENT_TYPES.find(t => t.id === appt.typeId)?.duration || 30;
        const span   = Math.max(1, Math.ceil(dur / 15));
        const si     = slots.indexOf(appt.time);
        if (si === -1) return;
        const actual = Math.min(span, slots.length - si);
        grid[doc.id][ds][slots[si]] = { appt, rowspan: actual };
        for (let i = 1; i < actual; i++) {
          if (slots[si + i]) grid[doc.id][ds][slots[si + i]] = 'skip';
        }
      });
    });
  });

  const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYNAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayStr = new Date().toISOString().split('T')[0];

  const labelEl = document.getElementById('week-label-' + clinicId);
  if (labelEl) {
    labelEl.textContent =
      `${days[0].getDate()} ${MONTHS[days[0].getMonth()]} – ` +
      `${days[4].getDate()} ${MONTHS[days[4].getMonth()]} ${days[4].getFullYear()}`;
  }

  // Sync size buttons in the active pane
  document.querySelectorAll(`#tab-appts-${clinicId} .size-btn`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === calSize);
  });

  const html = `
    <table class="week-table cal-size-${calSize}">
      <thead>
        <tr class="wt-row-days">
          <th class="wt-corner" rowspan="2"></th>
          ${days.map(d => {
            const ds = d.toISOString().split('T')[0];
            return `<th class="wt-day-hdr${ds === todayStr ? ' wt-today-col' : ''}"
                        colspan="${DOCTORS.length}">
              <div class="wt-day-name">${DAYNAMES[d.getDay()]}</div>
              <div class="wt-day-num${ds === todayStr ? ' wt-today-num' : ''}">
                ${d.getDate()} ${MONTHS[d.getMonth()]}
              </div>
            </th>`;
          }).join('')}
        </tr>
        <tr class="wt-row-docs">
          ${days.map(d => {
            const ds = d.toISOString().split('T')[0];
            return DOCTORS.map(doc => {
              const color = getAvatarColor(doc.name);
              return `<th class="wt-doc-hdr${ds === todayStr ? ' wt-today-col' : ''}">
                <span class="wt-doc-dot" style="background:${color}"></span>
                ${doc.name.replace('Dr. ', '')}
              </th>`;
            }).join('');
          }).join('')}
        </tr>
      </thead>
      <tbody>
        ${slots.map((slot, si) => {
          const isHour = si % 4 === 0;
          const [slotH] = parseSlotLabel(slot);
          return `<tr class="${isHour ? 'wt-hour-row' : 'wt-slot-row'}">
            <td class="wt-time-cell">${isHour ? slot : (si % 4 === 2 ? '<span class="half-mark">·</span>' : '')}</td>
            ${days.map(d => {
              const ds = d.toISOString().split('T')[0];
              return DOCTORS.map(doc => {
                const cell = grid[doc.id][ds][slot];
                if (cell === 'skip') return '';

                const isWorking = doc.days.includes(d.getDay());
                const isLunch   = isWorking && slotH >= doc.lunch[0] && slotH < doc.lunch[1];

                if (!cell) {
                  const cls = !isWorking ? 'wt-off' : isLunch ? 'wt-lunch' : '';
                  return `<td class="wt-cell ${cls}"></td>`;
                }

                const isNewPt = !cell.appt.patientId;
                const color   = isNewPt ? '#ea580c' : getAvatarColor(doc.name);
                return `<td class="wt-cell wt-appt-cell" rowspan="${cell.rowspan}">
                  <div class="wt-appt${isNewPt ? ' wt-new-patient' : ''}" style="border-left:3px solid ${color};background:${color}18;">
                    <div class="wt-appt-name">
                      ${isNewPt ? '<span class="wt-new-badge">NEW</span>' : ''}${cell.appt.patientName}
                    </div>
                    ${cell.rowspan >= 2 ? `<div class="wt-appt-type">${cell.appt.typeName}</div>` : ''}
                    ${cell.appt.status === 'confirmed' ? `
                      <div class="wt-appt-btns">
                        <button class="btn-xs btn-success" onclick="setStatus('${cell.appt.id}','completed')">Done</button>
                        <button class="btn-xs btn-danger"  onclick="setStatus('${cell.appt.id}','cancelled')">Cancel</button>
                      </div>` : ''}
                    ${cell.appt.status === 'completed' ? `<span class="status-chip sc-completed" style="font-size:10px;">done</span>` : ''}
                  </div>
                </td>`;
              }).join('');
            }).join('')}
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  const container = document.getElementById('cal-container-' + clinicId);
  if (container) container.innerHTML = html;

  renderMiniCal(clinicId);
}

function prevWeek(clinicId) {
  weekStarts[clinicId] = new Date(weekStarts[clinicId].getTime() - 7 * 86400000);
  renderClinicCalendar(clinicId);
}
function nextWeek(clinicId) {
  weekStarts[clinicId] = new Date(weekStarts[clinicId].getTime() + 7 * 86400000);
  renderClinicCalendar(clinicId);
}
function goToToday(clinicId) {
  weekStarts[clinicId] = getMonday(new Date());
  renderClinicCalendar(clinicId);
}

// ── Calendar sizing ───────────────────────────────────────────────────────────

function setCalSize(size) {
  calSize = size;
  if (currentTab.startsWith('appts-')) {
    renderClinicCalendar(currentTab.replace('appts-', ''));
  }
}

// ── Mini calendar ─────────────────────────────────────────────────────────────

function renderMiniCal(clinicId) {
  const el = document.getElementById('mini-cal-' + clinicId);
  if (!el) return;

  const { year, month } = miniCalMonths[clinicId];
  const ws  = weekStarts[clinicId];
  const we  = new Date(ws.getTime() + 4 * 86400000);
  const MONTHS   = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];
  const DAYNAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const today    = new Date(); today.setHours(0,0,0,0);

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let days = DAYNAMES.map(d => `<div class="mc-wday">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) days += '<div class="mc-day mc-empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d); date.setHours(0,0,0,0);
    const ds   = date.toISOString().split('T')[0];
    const inWeek    = date >= ws && date <= we;
    const isToday   = date.getTime() === today.getTime();
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const isStart   = date.getTime() === ws.getTime();
    const isEnd     = date.getTime() === we.getTime();
    let cls = 'mc-day';
    if (inWeek)   cls += ' mc-in-week';
    if (isStart)  cls += ' mc-week-start';
    if (isEnd)    cls += ' mc-week-end';
    if (isToday)  cls += ' mc-today';
    if (isWeekend) cls += ' mc-weekend';
    days += `<div class="${cls}" onclick="jumpToWeek('${clinicId}','${ds}')">${d}</div>`;
  }

  el.innerHTML = `
    <div class="mini-cal">
      <div class="mc-header">
        <button class="mc-nav" onclick="miniCalPrev('${clinicId}')">&#8249;</button>
        <span class="mc-title">${MONTHS[month]} ${year}</span>
        <button class="mc-nav" onclick="miniCalNext('${clinicId}')">&#8250;</button>
      </div>
      <div class="mc-grid">${days}</div>
    </div>`;
}

function miniCalPrev(clinicId) {
  const { year, month } = miniCalMonths[clinicId];
  miniCalMonths[clinicId] = month === 0
    ? { year: year - 1, month: 11 }
    : { year, month: month - 1 };
  renderMiniCal(clinicId);
}

function miniCalNext(clinicId) {
  const { year, month } = miniCalMonths[clinicId];
  miniCalMonths[clinicId] = month === 11
    ? { year: year + 1, month: 0 }
    : { year, month: month + 1 };
  renderMiniCal(clinicId);
}

function jumpToWeek(clinicId, ds) {
  const [y, m, d] = ds.split('-').map(Number);
  weekStarts[clinicId] = getMonday(new Date(y, m - 1, d));
  // Sync mini-cal month to show the jumped-to month
  miniCalMonths[clinicId] = { year: weekStarts[clinicId].getFullYear(), month: weekStarts[clinicId].getMonth() };
  renderClinicCalendar(clinicId);
}

// ── Patients tab ─────────────────────────────────────────────────────────────

let editingPatientId = null;

function renderPatientsTab() {
  renderPatientList();
}

function showAddPatient() {
  editingPatientId = null;
  document.getElementById('pat-form-title').textContent = 'New Patient';
  document.getElementById('patient-reg-form').reset();
  document.getElementById('patient-form-panel').style.display = 'block';
  document.getElementById('patient-form-panel').scrollIntoView({ behavior: 'smooth' });
}

function cancelPatientForm() {
  document.getElementById('patient-form-panel').style.display = 'none';
  editingPatientId = null;
}

function savePatient(e) {
  e.preventDefault();
  const fd   = new FormData(e.target);
  const data = {
    patientNumber: fd.get('patientNumber').trim().toUpperCase(),
    name:          fd.get('name').trim(),
    phone:         fd.get('phone').trim(),
    clinic:        fd.get('clinic'),
  };

  let result;
  if (editingPatientId) {
    result = updatePatient(editingPatientId, data);
    editingPatientId = null;
  } else {
    result = addPatient(data);
  }

  if (result && result.error) { alert(result.error); return; }
  cancelPatientForm();
  renderPatientList();
}

function editPatient(id) {
  const p = getPatients().find(pt => pt.id === id);
  if (!p) return;
  editingPatientId = id;
  const form = document.getElementById('patient-reg-form');
  form.elements['patientNumber'].value = p.patientNumber;
  form.elements['name'].value          = p.name;
  form.elements['phone'].value         = p.phone;
  form.elements['clinic'].value        = p.clinic;
  document.getElementById('pat-form-title').textContent = 'Edit Patient';
  document.getElementById('patient-form-panel').style.display = 'block';
  document.getElementById('patient-form-panel').scrollIntoView({ behavior: 'smooth' });
}

function renderPatientList() {
  const q = (document.getElementById('pat-search')?.value || '').toLowerCase();
  let patients = getPatients();

  if (q) patients = patients.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.phone.includes(q) ||
    p.patientNumber.toLowerCase().includes(q) ||
    p.clinic.toLowerCase().includes(q));

  patients.sort((a, b) => a.patientNumber.localeCompare(b.patientNumber));

  const countEl = document.getElementById('pat-count');
  if (countEl) countEl.textContent = `${patients.length} patient${patients.length !== 1 ? 's' : ''}`;

  const container = document.getElementById('patient-list');
  if (!container) return;

  if (!patients.length) {
    container.innerHTML = '<div class="empty-state">No patients found.</div>';
    return;
  }

  const allAppts = getAppointments();
  container.innerHTML = `
    <div class="pat-list-header">
      <span>Patient No.</span><span>Name</span><span>Phone</span><span>Clinic</span><span>Visits</span><span></span>
    </div>
    ${patients.map(p => {
      const clinic    = CLINICS.find(c => c.id === p.clinic)?.name || p.clinic || '—';
      const patAppts  = allAppts.filter(a => a.patientId === p.id);
      const apptCount = patAppts.length;
      return `
        <div class="pat-row" id="pr-${p.id}">
          <div class="pat-num">${p.patientNumber}</div>
          <div class="pat-name">${p.name}</div>
          <div class="pat-phone">${p.phone}</div>
          <div class="pat-clinic"><span class="clinic-badge clinic-${p.clinic}">${clinic}</span></div>
          <div class="pat-appts">${apptCount}</div>
          <div class="pat-actions">
            <button class="btn-xs" onclick="togglePatientHistory('${p.id}')">History</button>
            <button class="btn-xs btn-primary" onclick="editPatient('${p.id}')">Edit</button>
          </div>
        </div>
        <div class="pat-history-panel" id="phist-${p.id}" style="display:none"></div>`;
    }).join('')}`;
}

function togglePatientHistory(id) {
  const el = document.getElementById('phist-' + id);
  if (!el) return;
  if (el.style.display === 'none') {
    renderPatientHistory(id);
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

function renderPatientHistory(id) {
  const el = document.getElementById('phist-' + id);
  if (!el) return;
  const appts = getAppointments()
    .filter(a => a.patientId === id)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (!appts.length) {
    el.innerHTML = '<div class="phist-empty">No appointment history.</div>';
    return;
  }
  el.innerHTML = `
    <div class="phist-header">
      <span>Date</span><span>Time</span><span>Clinic</span><span>Treatment</span><span>Dentist</span><span>Status</span>
    </div>
    ${appts.map(a => {
      const sc = { confirmed:'sc-confirmed', cancelled:'sc-cancelled', completed:'sc-completed' }[a.status] || '';
      return `<div class="phist-row">
        <div>${formatDate(a.date)}</div>
        <div>${a.time}</div>
        <div>${a.clinicName}</div>
        <div>${a.typeName}</div>
        <div>${a.doctorName}</div>
        <div><span class="status-chip ${sc}">${a.status}</span></div>
      </div>`;
    }).join('')}`;
}

// ── Doctors tab ───────────────────────────────────────────────────────────────

function renderDoctorsTab() {
  const container = document.getElementById('doctors-list');
  const today = new Date().toISOString().split('T')[0];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  container.innerHTML = DOCTORS.map(d => {
    const color    = getAvatarColor(d.name);
    const ini      = getInitials(d.name);
    const spec     = SPECIALTIES.find(s => s.id === d.specialty);
    const upcoming = getAppointments().filter(a => a.doctorId === d.id && a.date >= today && a.status === 'confirmed').length;
    const workDays = d.days.map(i => DAY_NAMES[i]).join(', ');
    return `
      <div class="doctor-admin-card">
        <div class="doc-card-top">
          <div class="avatar" style="background:${color}">${ini}</div>
          <div class="doc-info">
            <div class="doc-name">${d.name}</div>
            <div class="doc-spec">${spec.name}</div>
            <div class="doc-rating">★ ${d.rating} &bull; ${d.reviews} reviews &bull; ${d.experience}</div>
          </div>
          <div class="doc-badge">${upcoming} upcoming</div>
        </div>
        <p class="doc-bio">${d.bio}</p>
        <div class="doc-schedule">
          <div class="doc-sched-item"><span class="sched-label">Days</span>${workDays}</div>
          <div class="doc-sched-item"><span class="sched-label">Hours</span>${formatTimeSlot(d.start,0)} – ${formatTimeSlot(d.end,0)}</div>
          <div class="doc-sched-item"><span class="sched-label">Lunch</span>${formatTimeSlot(d.lunch[0],0)} – ${formatTimeSlot(d.lunch[1],0)}</div>
        </div>
      </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', init);
