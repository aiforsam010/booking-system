const ADMIN_PASS = '1';
let currentTab = 'dashboard';
let calSize = 100;

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
  closeMobileSidebar();
  document.querySelectorAll('.nav-item[data-tab]').forEach(el =>
    el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach(el =>
    el.style.display = el.id === 'tab-' + tab ? 'block' : 'none');

  if (tab === 'dashboard')         renderDashboard();
  if (tab === 'appts-central')    renderClinicCalendar('central');
  if (tab === 'appts-taikoo')     renderClinicCalendar('taikoo');
  if (tab === 'appts-shaukeiwan') renderClinicCalendar('shaukeiwan');
  if (tab === 'patients')         renderPatientsTab();
  if (tab === 'ortho-patients')   renderOrthoTab();
  if (tab === 'doctors')          renderDoctorsTab();
  if (tab === 'settings')         renderSettingsTab();
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

  const startH = Math.min(...DOCTORS.map(d => d.start));
  const endH   = Math.max(...DOCTORS.map(d => d.end));
  const slots  = [];
  for (let h = startH; h < endH; h++) {
    for (let m = 0; m < 60; m += 15) slots.push(formatTimeSlot(h, m));
  }

  const weekStartStr = days[0].toISOString().split('T')[0];
  const weekEndStr   = new Date(days[4].getTime() + 86400000).toISOString().split('T')[0];

  const allWeekAppts = getAppointments().filter(a =>
    a.date >= weekStartStr && a.date < weekEndStr && a.clinic === clinicId);

  const appts = allWeekAppts.filter(a => a.status !== 'cancelled' && a.status !== 'rescheduled');

  const sideByDate = {};
  allWeekAppts
    .filter(a => a.status === 'cancelled' || a.status === 'rescheduled')
    .forEach(a => { (sideByDate[a.date] = sideByDate[a.date] || []).push(a); });

  // Per-day: which doctors are visible, whether the side column is needed
  const dayMeta = {};
  days.forEach(d => {
    const ds = d.toISOString().split('T')[0];
    const visibleDocs = DOCTORS.filter(doc => appts.some(a => a.doctorId === doc.id && a.date === ds));
    const hasSide     = (sideByDate[ds] || []).length > 0;
    const numCols     = Math.max(1, visibleDocs.length) + (hasSide ? 1 : 0);
    dayMeta[ds] = { visibleDocs, hasSide, numCols };
  });

  // Build appointment grid for all doctors (filtered per day at render time)
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

  const pctLabel = document.getElementById(`cal-scale-pct-${clinicId}`);
  if (pctLabel) pctLabel.textContent = calSize + '%';
  const slider = document.querySelector(`#tab-appts-${clinicId} .cal-scale-slider`);
  if (slider) slider.value = calSize;

  const html = `
    <table class="week-table" style="--cal-scale:${calSize/100}">
      <thead>
        <tr class="wt-row-days">
          <th class="wt-corner" rowspan="2"></th>
          ${days.map(d => {
            const ds = d.toISOString().split('T')[0];
            return `<th class="wt-day-hdr${ds === todayStr ? ' wt-today-col' : ''}" colspan="${dayMeta[ds].numCols}">
              <div class="wt-day-name">${DAYNAMES[d.getDay()]}</div>
              <div class="wt-day-num${ds === todayStr ? ' wt-today-num' : ''}">${d.getDate()} ${MONTHS[d.getMonth()]}</div>
            </th>`;
          }).join('')}
        </tr>
        <tr class="wt-row-docs">
          ${days.map(d => {
            const ds = d.toISOString().split('T')[0];
            const { visibleDocs, hasSide } = dayMeta[ds];
            const isToday = ds === todayStr;
            const docHdrs = visibleDocs.length === 0
              ? `<th class="wt-doc-hdr${isToday ? ' wt-today-col' : ''}"></th>`
              : visibleDocs.map(doc => {
                  const color = getAvatarColor(doc.name);
                  return `<th class="wt-doc-hdr${isToday ? ' wt-today-col' : ''}">
                    <span class="wt-doc-dot" style="background:${color}"></span>${doc.name.replace('Dr. ', '')}
                  </th>`;
                }).join('');
            const sideHdr = hasSide
              ? `<th class="wt-doc-hdr wt-side-hdr${isToday ? ' wt-today-col' : ''}">Cancelled / Rescheduled</th>`
              : '';
            return docHdrs + sideHdr;
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
              const { visibleDocs, hasSide } = dayMeta[ds];
              const isToday = ds === todayStr;

              // Doctor columns — only visible ones
              let docCells = '';
              if (visibleDocs.length === 0) {
                docCells = si === 0 ? `<td class="wt-cell${isToday ? ' wt-today-col' : ''}" rowspan="${slots.length}"></td>` : '';
              } else {
                docCells = visibleDocs.map(doc => {
                  const cell = grid[doc.id][ds][slot];
                  if (cell === 'skip') return '';
                  const isWorking = doc.days.includes(d.getDay());
                  const isLunch   = isWorking && slotH >= doc.lunch[0] && slotH < doc.lunch[1];
                  if (!cell) {
                    const cls = !isWorking ? 'wt-off' : isLunch ? 'wt-lunch' : '';
                    return `<td class="wt-cell${cls ? ' '+cls : ''}${isToday ? ' wt-today-col' : ''}"></td>`;
                  }
                  const isNewPt  = !cell.appt.patientId;
                  const isOrtho  = cell.appt.typeId === 'orthodontic';
                  const color    = isNewPt ? '#ea580c' : isOrtho ? '#7c3aed' : getAvatarColor(doc.name);
                  return `<td class="wt-cell wt-appt-cell${isToday ? ' wt-today-col' : ''}" rowspan="${cell.rowspan}">
                    <div class="wt-appt${isNewPt ? ' wt-new-patient' : ''}${isOrtho ? ' wt-ortho-appt' : ''}" style="border-left:3px solid ${color};background:${color}18;">
                      <div class="wt-appt-name">${isNewPt ? '<span class="wt-new-badge">NEW</span>' : ''}${isOrtho ? '<span class="wt-ortho-badge">ORTHO</span>' : ''}${cell.appt.patientName}</div>
                      ${cell.rowspan >= 2 ? `<div class="wt-appt-type">${cell.appt.typeName}</div>` : ''}
                      ${cell.appt.status === 'confirmed' ? `<div class="wt-appt-btns">
                        <button class="btn-xs btn-outline-sm" onclick="openRescheduleModal('${cell.appt.id}','${clinicId}')">Reschedule</button>
                        <button class="btn-xs btn-danger" onclick="setStatus('${cell.appt.id}','cancelled')">Cancel</button>
                      </div>` : ''}
                      ${cell.appt.status === 'completed' ? `<span class="status-chip sc-completed" style="font-size:10px;">done</span>` : ''}
                    </div>
                  </td>`;
                }).join('');
              }

              // Side column — only if day has cancelled/rescheduled, rendered once at si===0
              let sideCell = '';
              if (hasSide && si === 0) {
                const items = (sideByDate[ds] || []).map(a => {
                  const isRs   = a.status === 'rescheduled';
                  const badgeCls = isRs ? 'wt-side-rescheduled' : 'wt-side-cancelled';
                  return `<div class="wt-appt wt-appt-faded">
                    <div class="wt-appt-name">
                      <span class="wt-side-badge ${badgeCls}">${isRs ? 'Rescheduled' : 'Cancelled'}</span>
                      ${a.patientName}
                    </div>
                    <div class="wt-appt-type">${a.time} · ${a.typeName}</div>
                  </div>`;
                }).join('');
                sideCell = `<td class="wt-cell wt-side-col${isToday ? ' wt-today-col' : ''}" rowspan="${slots.length}">${items}</td>`;
              }

              return docCells + sideCell;
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
  calSize = parseInt(size, 10);
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

// ── Reschedule modal ─────────────────────────────────────────────────────────

const rsState = {
  apptId: null, clinicId: null, original: null,
  mode: null,                    // 'keep' | 'change'
  doctorId: null, typeId: null, typeName: null, duration: null,
  date: null, time: null,
  calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
};

function openRescheduleModal(apptId, clinicId) {
  const original = getAppointments().find(a => a.id === apptId);
  if (!original) return;
  Object.assign(rsState, {
    apptId, clinicId, original, mode: null,
    doctorId: null, typeId: null, typeName: null, duration: null,
    date: null, time: null,
    calYear: new Date().getFullYear(), calMonth: new Date().getMonth(),
  });
  document.getElementById('reschedule-modal').style.display = 'flex';
  rsRender();
}

function closeRescheduleModal() {
  document.getElementById('reschedule-modal').style.display = 'none';
}

function rsRender() {
  const card = document.getElementById('rs-card');
  const a    = rsState.original;

  const summaryHTML = `
    <div class="rs-summary">
      <div class="rs-sum-row"><span class="rs-sum-label">Patient</span><span>${a.patientName}</span></div>
      <div class="rs-sum-row"><span class="rs-sum-label">Original date</span><span>${formatDate(a.date)} at ${a.time}</span></div>
      <div class="rs-sum-row"><span class="rs-sum-label">Dentist</span><span>${a.doctorName}</span></div>
      <div class="rs-sum-row"><span class="rs-sum-label">Treatment</span><span>${a.typeName} · ${a.duration || 30} min</span></div>
    </div>`;

  // ── Step 0: mode selection ────────────────────────────────────────────────
  if (!rsState.mode) {
    card.innerHTML = `
      <div class="modal-header">
        <h2>Reschedule Appointment</h2>
        <button class="modal-close" onclick="closeRescheduleModal()">×</button>
      </div>
      ${summaryHTML}
      <p class="rs-section-title">How would you like to reschedule?</p>
      <div class="rs-mode-grid">
        <button class="rs-mode-btn" onclick="rsSelectMode('keep')">
          <div class="rs-mode-icon">📋</div>
          <div class="rs-mode-name">Keep existing details</div>
          <div class="rs-mode-desc">Same dentist, treatment &amp; duration — pick a new date and time only</div>
        </button>
        <button class="rs-mode-btn" onclick="rsSelectMode('change')">
          <div class="rs-mode-icon">✏️</div>
          <div class="rs-mode-name">Change booking details</div>
          <div class="rs-mode-desc">Choose a different dentist, treatment, or duration</div>
        </button>
      </div>`;
    return;
  }

  // ── Details form (change mode only) ──────────────────────────────────────
  const dur = rsState.duration;
  const customActive = typeof dur === 'number' && ![5,15,30].includes(dur);

  let detailsHTML = '';
  if (rsState.mode === 'change') {
    detailsHTML = `
      <p class="rs-section-title">New booking details</p>
      <div class="rs-details-form">
        <div class="rs-field">
          <label class="rs-label">Dentist</label>
          <div class="rs-btn-row">
            ${DOCTORS.map(d => `<button class="rs-opt-btn ${rsState.doctorId === d.id ? 'selected' : ''}"
                onclick="rsSelectDoctor(${d.id})">${d.name}</button>`).join('')}
          </div>
        </div>
        <div class="rs-field">
          <label class="rs-label">Treatment</label>
          <div class="rs-btn-row" style="flex-wrap:wrap;">
            ${APPOINTMENT_TYPES.map(t => `<button class="rs-opt-btn ${rsState.typeId === t.id ? 'selected' : ''}"
                onclick="rsSelectType('${t.id}','${t.name}')">${t.name}</button>`).join('')}
          </div>
        </div>
        <div class="rs-field">
          <label class="rs-label">Duration</label>
          <div class="rs-btn-row">
            <button class="rs-opt-btn ${dur === 5 ? 'selected' : ''}"  onclick="rsSelectDuration(5)">5 min</button>
            <button class="rs-opt-btn ${dur === 15 ? 'selected' : ''}" onclick="rsSelectDuration(15)">15 min</button>
            <button class="rs-opt-btn ${dur === 30 ? 'selected' : ''}" onclick="rsSelectDuration(30)">30 min</button>
            <button class="rs-opt-btn ${customActive || dur === 'custom' ? 'selected' : ''}" onclick="rsSelectDuration('custom')">Custom</button>
            <div style="display:${customActive || dur === 'custom' ? 'flex' : 'none'};align-items:center;gap:6px;margin-top:4px;">
              <input id="rs-custom-dur" type="number" min="1" max="480" placeholder="min"
                     class="form-input" style="width:80px;" value="${customActive ? dur : ''}"
                     oninput="rsApplyCustomDuration(this.value)">
              <span style="font-size:13px;color:var(--text-muted);">min</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  // Resolve active doctor and duration for the calendar
  const activeDoctorId = rsState.mode === 'keep' ? a.doctorId : (rsState.doctorId || null);
  const activeDuration  = rsState.mode === 'keep' ? (a.duration || 30) : (typeof dur === 'number' && dur > 0 ? dur : null);
  const activeDoctor    = activeDoctorId ? getDoctorById(activeDoctorId) : null;

  // ── Month calendar ────────────────────────────────────────────────────────
  const MONTHS_LONG = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const today = new Date(); today.setHours(0,0,0,0);
  const firstDay    = new Date(rsState.calYear, rsState.calMonth, 1).getDay();
  const daysInMonth = new Date(rsState.calYear, rsState.calMonth + 1, 0).getDate();

  let calDays = ['Su','Mo','Tu','We','Th','Fr','Sa'].map(wd => `<div class="cal-wday">${wd}</div>`).join('');
  for (let i = 0; i < firstDay; i++) calDays += '<div class="cal-day empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const date  = new Date(rsState.calYear, rsState.calMonth, d); date.setHours(0,0,0,0);
    const ds    = date.toISOString().split('T')[0];
    const past  = date < today;
    const works = activeDoctor ? activeDoctor.days.includes(date.getDay()) : false;
    const isSel = rsState.date === ds;
    const isToday = date.getTime() === today.getTime();
    const cls = ['cal-day', (past || !works || !activeDoctor) ? 'disabled' : 'available',
                 isSel ? 'selected' : '', isToday ? 'today' : ''].filter(Boolean).join(' ');
    calDays += `<div class="${cls}" ${!past && works && activeDoctor ? `onclick="rsSelectDate('${ds}')"` : ''}>${d}</div>`;
  }

  // ── Time slots ────────────────────────────────────────────────────────────
  let slotsHTML = '<div class="slots-placeholder"><span>📅</span><p>Select a date to see available times</p></div>';
  if (rsState.date && activeDoctor && activeDuration) {
    const slots = generateTimeSlots(activeDoctor, rsState.date, activeDuration);
    slotsHTML = slots.length
      ? `<h4 class="rs-slots-title">${formatDate(rsState.date)}</h4>
         <div class="slots-grid">
           ${slots.map(s => `<button class="slot ${s.available ? '' : 'booked'} ${rsState.time === s.time && s.available ? 'selected' : ''}"
               ${s.available ? `onclick="rsSelectTime('${s.time}')"` : 'disabled'}>${s.time}</button>`).join('')}
         </div>`
      : '<div class="slots-placeholder"><span>🚫</span><p>No slots available for this date</p></div>';
  }

  const calNotReady = rsState.mode === 'change' && (!rsState.doctorId || !rsState.typeId || !activeDuration || dur === 'custom');
  const canConfirm  = rsState.date && rsState.time &&
    (rsState.mode === 'keep' || (rsState.doctorId && rsState.typeId && activeDuration && dur !== 'custom'));

  card.innerHTML = `
    <div class="modal-header">
      <div>
        <h2>Reschedule Appointment</h2>
        <button class="btn btn-ghost btn-sm" style="font-size:12px;margin-top:2px;" onclick="rsState.mode=null;rsRender()">← Change option</button>
      </div>
      <button class="modal-close" onclick="closeRescheduleModal()">×</button>
    </div>
    ${summaryHTML}
    ${detailsHTML}
    <p class="rs-section-title">New date &amp; time</p>
    ${calNotReady ? '<p style="color:var(--text-muted);font-size:13px;margin-bottom:16px;">Select a dentist, treatment, and duration above first.</p>' : `
    <div class="rs-datetime">
      <div>
        <div class="cal-nav">
          <button class="cal-arrow" onclick="rsCalPrev()">&#8249;</button>
          <span class="cal-title">${MONTHS_LONG[rsState.calMonth]} ${rsState.calYear}</span>
          <button class="cal-arrow" onclick="rsCalNext()">&#8250;</button>
        </div>
        <div class="cal-weekdays">${['Su','Mo','Tu','We','Th','Fr','Sa'].map(wd=>`<div class="cal-wday">${wd}</div>`).join('')}</div>
        <div class="cal-days">${calDays.replace(/<div class="cal-wday">.*?<\/div>/g,'')}</div>
      </div>
      <div class="rs-slots-panel">${slotsHTML}</div>
    </div>`}
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeRescheduleModal()">Cancel</button>
      <button class="btn btn-primary" ${canConfirm ? '' : 'disabled'} onclick="rsConfirm()">Confirm Reschedule →</button>
    </div>`;
}

function rsSelectMode(mode)         { rsState.mode = mode; rsState.date = null; rsState.time = null; rsRender(); }
function rsSelectDoctor(id)         { rsState.doctorId = id; rsState.date = null; rsState.time = null; rsRender(); }
function rsSelectType(id, name)     { rsState.typeId = id; rsState.typeName = name; rsRender(); }
function rsSelectDuration(val)      { rsState.duration = val; rsState.date = null; rsState.time = null; rsRender(); }
function rsApplyCustomDuration(val) { const n = parseInt(val,10); rsState.duration = n > 0 ? n : 'custom'; rsState.time = null; rsRender(); }
function rsCalPrev() {
  const { calYear, calMonth } = rsState;
  Object.assign(rsState, calMonth === 0 ? { calYear: calYear - 1, calMonth: 11 } : { calMonth: calMonth - 1 });
  rsRender();
}
function rsCalNext() {
  const { calYear, calMonth } = rsState;
  Object.assign(rsState, calMonth === 11 ? { calYear: calYear + 1, calMonth: 0 } : { calMonth: calMonth + 1 });
  rsRender();
}
function rsSelectDate(ds) { rsState.date = ds; rsState.time = null; rsRender(); }
function rsSelectTime(t)  { rsState.time = t; rsRender(); }

function rsConfirm() {
  const a        = rsState.original;
  const doctorId = rsState.mode === 'keep' ? a.doctorId : rsState.doctorId;
  const doctor   = getDoctorById(doctorId);
  const typeId   = rsState.mode === 'keep' ? a.typeId   : rsState.typeId;
  const typeName = rsState.mode === 'keep' ? a.typeName : rsState.typeName;
  const duration = rsState.mode === 'keep' ? (a.duration || 30) : rsState.duration;

  // Mark original as rescheduled
  updateAppointmentStatus(rsState.apptId, 'rescheduled');

  // Create the new appointment
  addAppointment({
    doctorId, doctorName: doctor.name, specialty: doctor.specialty,
    patientId: a.patientId, patientNumber: a.patientNumber,
    patientName: a.patientName, patientPhone: a.patientPhone,
    clinic: rsState.clinicId,
    clinicName: CLINICS.find(c => c.id === rsState.clinicId)?.name || '',
    date: rsState.date, time: rsState.time,
    typeId, typeName, duration,
    reason: a.reason,
    rescheduledFrom: rsState.apptId,
  });

  closeRescheduleModal();
  renderClinicCalendar(rsState.clinicId);
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

// ── Orthodontic Patients tab ──────────────────────────────────────────────────

function renderOrthoTab() {
  const q       = (document.getElementById('ortho-search')?.value || '').toLowerCase();
  const allAppts = getAppointments();
  const allPts   = getPatients();

  // Collect all orthodontic appointment data grouped by patient (registered)
  const orthoAppts = allAppts.filter(a => a.typeId === 'orthodontic');

  // Build patient map: registered patients who have ≥1 orthodontic appt
  const patMap = {};
  orthoAppts.forEach(a => {
    if (!a.patientId) return; // skip unregistered walk-ins
    if (!patMap[a.patientId]) {
      const pt = allPts.find(p => p.id === a.patientId);
      if (!pt) return;
      patMap[a.patientId] = { patient: pt, appts: [] };
    }
    patMap[a.patientId].appts.push(a);
  });

  let rows = Object.values(patMap);

  if (q) rows = rows.filter(({ patient: p }) =>
    p.name.toLowerCase().includes(q) ||
    p.patientNumber.toLowerCase().includes(q) ||
    p.phone.includes(q) ||
    (p.clinic || '').toLowerCase().includes(q));

  rows.sort((a, b) => a.patient.patientNumber.localeCompare(b.patient.patientNumber));

  const countEl = document.getElementById('ortho-count');
  if (countEl) countEl.textContent = `${rows.length} orthodontic patient${rows.length !== 1 ? 's' : ''}`;

  const container = document.getElementById('ortho-patient-list');
  if (!container) return;

  if (!rows.length) {
    container.innerHTML = '<div class="empty-state">No orthodontic patients found.</div>';
    return;
  }

  const orthoPrice = APPOINTMENT_TYPES.find(t => t.id === 'orthodontic')?.price || 800;

  container.innerHTML = `
    <div class="ortho-list-header">
      <span>Patient No.</span>
      <span>Name</span>
      <span>Phone</span>
      <span>Clinic</span>
      <span>Sessions</span>
      <span>Total Fee</span>
      <span>Paid (HK$)</span>
      <span>Outstanding</span>
    </div>
    ${rows.map(({ patient: p, appts }) => {
      const billable   = appts.filter(a => a.status !== 'cancelled' && a.status !== 'rescheduled');
      const totalFee   = billable.length * orthoPrice;
      const paid       = billable.reduce((sum, a) => sum + (a.paidAmount || 0), 0);
      const outstanding = totalFee - paid;
      const clinic     = CLINICS.find(c => c.id === p.clinic)?.name || p.clinic || '—';
      return `
        <div class="pat-row ortho-pat-row" id="opr-${p.id}">
          <div class="pat-num">${p.patientNumber}</div>
          <div class="pat-name">${p.name}</div>
          <div class="pat-phone">${p.phone}</div>
          <div class="pat-clinic"><span class="clinic-badge clinic-${p.clinic}">${clinic}</span></div>
          <div class="pat-appts">${billable.length}</div>
          <div class="ortho-fee">HK$${totalFee.toLocaleString()}</div>
          <div class="ortho-paid" id="paid-cell-${p.id}">
            <span class="ortho-paid-val">HK$${paid.toLocaleString()}</span>
            <button class="btn-xs btn-primary" onclick="openPaymentEditor('${p.id}')">Edit</button>
          </div>
          <div class="ortho-outstanding ${outstanding > 0 ? 'outstanding-due' : 'outstanding-clear'}">
            ${outstanding > 0 ? `HK$${outstanding.toLocaleString()}` : '✓ Paid'}
          </div>
        </div>
        <div class="pat-history-panel" id="ophist-${p.id}" style="display:none"></div>
        <div class="ortho-pay-editor" id="pay-editor-${p.id}" style="display:none">
          ${appts.filter(a => a.status !== 'cancelled' && a.status !== 'rescheduled').map(a => `
            <div class="ope-row">
              <span class="ope-date">${a.date} ${a.time}</span>
              <span class="ope-type">${a.typeName}</span>
              <span class="ope-fee">HK$${orthoPrice}</span>
              <span class="ope-paid-wrap">
                Paid: <input type="number" class="ope-input" id="ope-${a.id}"
                  value="${a.paidAmount || 0}" min="0" max="${orthoPrice}" step="50">
              </span>
              <button class="btn-xs btn-primary" onclick="saveApptPayment('${a.id}','${p.id}')">Save</button>
            </div>
          `).join('')}
        </div>`;
    }).join('')}`;
}

function openPaymentEditor(patientId) {
  const ed = document.getElementById('pay-editor-' + patientId);
  if (!ed) return;
  ed.style.display = ed.style.display === 'none' ? 'block' : 'none';
}

function saveApptPayment(apptId, patientId) {
  const input = document.getElementById('ope-' + apptId);
  if (!input) return;
  updateAppointmentPaid(apptId, input.value);
  renderOrthoTab();
}

// ── Doctors tab ───────────────────────────────────────────────────────────────

function renderDoctorsTab() {
  const container = document.getElementById('doctors-list');
  const today = new Date().toISOString().split('T')[0];
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const allAppts = getAppointments();
  const now = new Date();
  const weekStart = getMonday(now).toISOString().split('T')[0];
  const weekEnd   = new Date(getMonday(now).getTime() + 7 * 86400000).toISOString().split('T')[0];
  const monthStr  = today.slice(0, 7); // "YYYY-MM"

  container.innerHTML = DOCTORS.map(d => {
    const color    = getAvatarColor(d.name);
    const ini      = getInitials(d.name);
    const spec     = SPECIALTIES.find(s => s.id === d.specialty);
    const workDays = d.days.map(i => DAY_NAMES[i]).join(', ');

    const docAppts = allAppts.filter(a => a.doctorId === d.id && a.status !== 'cancelled' && a.status !== 'rescheduled');
    const upcoming   = docAppts.filter(a => a.date >= today).length;
    const weekTotal  = docAppts.filter(a => a.date >= weekStart && a.date < weekEnd).length;
    const weekNew    = docAppts.filter(a => a.date >= weekStart && a.date < weekEnd && !a.patientId).length;
    const monthTotal = docAppts.filter(a => a.date.startsWith(monthStr)).length;
    const monthNew   = docAppts.filter(a => a.date.startsWith(monthStr) && !a.patientId).length;

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
        <div class="doc-stats-row">
          <div class="doc-stat">
            <div class="doc-stat-num">${weekTotal}</div>
            <div class="doc-stat-label">This week</div>
            ${weekNew > 0 ? `<div class="doc-stat-new">${weekNew} new pt</div>` : ''}
          </div>
          <div class="doc-stat">
            <div class="doc-stat-num">${monthTotal}</div>
            <div class="doc-stat-label">This month</div>
            ${monthNew > 0 ? `<div class="doc-stat-new">${monthNew} new pt</div>` : ''}
          </div>
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

// ── Sidebar toggle ────────────────────────────────────────────────────────────

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
}

function openMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar.classList.add('mobile-open');
  if (backdrop) backdrop.style.display = 'block';
}

function closeMobileSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.style.display = '';
}

// ── Settings & Backup tab ─────────────────────────────────────────────────────

const BACKUP_LOG_KEY = 'clinic_backup_log';
const BACKUP_LOG_MAX_DAYS = 7;

function getBackupLog() {
  return JSON.parse(localStorage.getItem(BACKUP_LOG_KEY) || '[]');
}

function addBackupLogEntry(label) {
  const log = getBackupLog()
    .filter(e => Date.now() - new Date(e.ts).getTime() < BACKUP_LOG_MAX_DAYS * 86400000);
  log.unshift({ ts: new Date().toISOString(), label });
  localStorage.setItem(BACKUP_LOG_KEY, JSON.stringify(log.slice(0, 100)));
}

function renderSettingsTab() {
  const log    = getBackupLog()
    .filter(e => Date.now() - new Date(e.ts).getTime() < BACKUP_LOG_MAX_DAYS * 86400000);
  const logEl  = document.getElementById('backup-log');
  if (!logEl) return;
  if (!log.length) {
    logEl.innerHTML = '<div class="empty-state">No automatic backups recorded yet.</div>';
    return;
  }
  logEl.innerHTML = log.map(e => {
    const d = new Date(e.ts);
    return `<div class="backup-log-row">
      <span class="bl-icon">✓</span>
      <span class="bl-label">${e.label}</span>
      <span class="bl-time">${d.toLocaleDateString('en-HK', { weekday:'short', month:'short', day:'numeric' })} ${d.toLocaleTimeString('en-HK', { hour:'2-digit', minute:'2-digit' })}</span>
    </div>`;
  }).join('');
}

function buildWorkbook(type) {
  const wb    = XLSX.utils.book_new();
  const appts = getAppointments();
  const pts   = getPatients();
  const orthoPrice = APPOINTMENT_TYPES.find(t => t.id === 'orthodontic')?.price || 800;

  function apptRows(list) {
    return list.map(a => ({
      ID: a.id, Date: a.date, Time: a.time,
      Clinic: a.clinicName, Doctor: a.doctorName,
      Patient: a.patientName, 'Patient No.': a.patientNumber || '',
      Phone: a.patientPhone, Treatment: a.typeName,
      Duration: a.duration, Status: a.status,
      'Paid (HK$)': a.paidAmount || 0, Reason: a.reason || '',
    }));
  }

  function ptRows(list) {
    return list.map(p => ({
      ID: p.id, 'Patient No.': p.patientNumber, Name: p.name,
      Phone: p.phone, Clinic: p.clinic, 'Created At': p.createdAt,
    }));
  }

  function orthoRows() {
    const orthoAppts = appts.filter(a => a.typeId === 'orthodontic');
    const map = {};
    orthoAppts.forEach(a => {
      if (!a.patientId) return;
      if (!map[a.patientId]) {
        const pt = pts.find(p => p.id === a.patientId);
        if (!pt) return;
        map[a.patientId] = { pt, appts: [] };
      }
      map[a.patientId].appts.push(a);
    });
    const rows = [];
    Object.values(map).forEach(({ pt, appts: pa }) => {
      const billable = pa.filter(a => a.status !== 'cancelled' && a.status !== 'rescheduled');
      const total = billable.length * orthoPrice;
      const paid  = billable.reduce((s, a) => s + (a.paidAmount || 0), 0);
      rows.push({
        'Patient No.': pt.patientNumber, Name: pt.name, Phone: pt.phone,
        Clinic: pt.clinic, Sessions: billable.length,
        'Total Fee (HK$)': total, 'Paid (HK$)': paid, 'Outstanding (HK$)': total - paid,
      });
      billable.forEach(a => rows.push({
        'Patient No.': '', Name: `  └ ${a.date} ${a.time}`, Phone: '', Clinic: '',
        Sessions: '', 'Total Fee (HK$)': orthoPrice,
        'Paid (HK$)': a.paidAmount || 0, 'Outstanding (HK$)': orthoPrice - (a.paidAmount || 0),
      }));
    });
    return rows;
  }

  const clinics = ['central', 'taikoo', 'shaukeiwan'];

  if (type === 'appointments' || type === 'full') {
    clinics.forEach(c => {
      const rows = apptRows(appts.filter(a => a.clinic === c));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), c.charAt(0).toUpperCase() + c.slice(1));
    });
  }
  if (type === 'patients' || type === 'full') {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ptRows(pts)), 'Patients');
  }
  if (type === 'orthodontic' || type === 'full') {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(orthoRows()), 'Orthodontic');
  }

  return wb;
}

function exportXlsx(type, isAuto) {
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded. Check your internet connection.'); return; }
  const labels = { appointments: 'All Appointments', patients: 'Patients', orthodontic: 'Orthodontic', full: 'Full Backup' };
  const prefix = { appointments: 'appointments', patients: 'patients', orthodontic: 'orthodontic', full: 'full-backup' };
  const ts     = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fname  = `clinic-${prefix[type]}-${ts}.xlsx`;
  const wb     = buildWorkbook(type);
  XLSX.writeFile(wb, fname);
  addBackupLogEntry(`${isAuto ? '(Auto) ' : ''}${labels[type]} → ${fname}`);
  if (currentTab === 'settings') renderSettingsTab();
}

function handleImport(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('import-filename').textContent = file.name;
  if (!confirm(`Import "${file.name}"? This will overwrite the current database and cannot be undone.`)) {
    input.value = '';
    document.getElementById('import-filename').textContent = 'Choose a .xlsx file to import…';
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      if (typeof XLSX === 'undefined') { alert('Excel library not loaded.'); return; }
      const wb      = XLSX.read(e.target.result, { type: 'array' });
      let imported  = [];

      const clinicSheets = ['Central', 'Taikoo', 'Shaukeiwan'];
      let apptData = null;
      clinicSheets.forEach(name => {
        const sh = wb.Sheets[name];
        if (sh) {
          const rows = XLSX.utils.sheet_to_json(sh);
          if (!apptData) apptData = [];
          rows.forEach(r => apptData.push({
            id: r.ID, clinic: name.toLowerCase(), clinicName: name,
            doctorName: r.Doctor, date: r.Date, time: r.Time,
            patientName: r.Patient, patientNumber: r['Patient No.'] || '',
            patientPhone: r.Phone, typeName: r.Treatment,
            duration: r.Duration, status: r.Status,
            paidAmount: r['Paid (HK$)'] || 0, reason: r.Reason || '',
          }));
          imported.push(name);
        }
      });
      if (apptData) saveAppointments(apptData);

      const ptSheet = wb.Sheets['Patients'];
      if (ptSheet) {
        const rows = XLSX.utils.sheet_to_json(ptSheet);
        savePatients(rows.map(r => ({
          id: r.ID, patientNumber: r['Patient No.'], name: r.Name,
          phone: r.Phone, clinic: r.Clinic, createdAt: r['Created At'],
        })));
        imported.push('Patients');
      }

      alert(`Import successful!\nSheets imported: ${imported.join(', ')}`);
      renderSettingsTab();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    input.value = '';
    document.getElementById('import-filename').textContent = 'Choose a .xlsx file to import…';
  };
  reader.readAsArrayBuffer(file);
}

// ── Scheduled auto-backup (1 PM and 7 PM while page is open) ─────────────────

let _lastAutoBackupHour = -1;

function checkAutoBackup() {
  const h = new Date().getHours();
  if ((h === 13 || h === 19) && h !== _lastAutoBackupHour) {
    _lastAutoBackupHour = h;
    exportXlsx('full', true);
  }
}

setInterval(checkAutoBackup, 60000); // check every minute

document.addEventListener('DOMContentLoaded', init);
