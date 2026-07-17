const STORAGE_KEY = 'todo_tasks';

const CATEGORY_LABELS = {
  'شخصی': 'شخصی',
  'کار': 'کار',
  'تحصیلی': 'تحصیلی',
  'خرید': 'خرید',
  'سایر': 'سایر',
};

const PRIORITY_LABELS = {
  'زیاد': 'زیاد',
  'متوسط': 'متوسط',
  'کم': 'کم',
};

const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const JALALI_WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const JALALI_WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

let tasks = [];
let currentFilter = 'all';
let searchQuery = '';

const addForm = document.getElementById('addForm');
const taskInput = document.getElementById('taskInput');
const categoryInput = document.getElementById('categoryInput');
const priorityInput = document.getElementById('priorityInput');
const dueDateInput = document.getElementById('dueDateInput');
const searchInput = document.getElementById('searchInput');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const taskStats = document.getElementById('taskStats');
const filterBtns = document.querySelectorAll('.filter-btn');

// ─── Jalali Calendar Utilities ───────────────────────────────────────────────

function gregorianToJalali(gy, gm, gd) {
  let g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { jy, jm, jd };
}

function jalaliToGregorian(jy, jm, jd) {
  let sal_a = jy - 979;
  let monthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  let leap = ((sal_a % 33) * 16 + (sal_a % 33 + 4)) < 33;
  if (leap) monthDays[11] = 30;

  let days = (jm - 1) * 31;
  if (jm > 6) days -= (jm - 7) * 30 + 6;
  days += jd - 1;
  days += sal_a * 1094;
  if (leap) days += 1;
  days += Math.floor(sal_a / 33) * 8 + Math.floor(((sal_a % 33) + 3) / 4);

  let gy = 1600 + 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  let sal_a2 = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
  let monthDays2 = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  if (sal_a2) monthDays2[2] = 60;

  let gm = 1;
  for (let i = 11; i >= 0; i--) {
    if (gd > monthDays2[i]) {
      gm = i + 1;
      gd -= monthDays2[i];
      break;
    }
  }
  return { gy, gm, gd };
}

function getJalaliToday() {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function getJalaliDayOfWeek(jy, jm, jd) {
  const g = jalaliToGregorian(jy, jm, jd);
  const d = new Date(g.gy, g.gm - 1, g.gd);
  return (d.getDay() + 1) % 7; // Saturday=0 ... Friday=6
}

function jalaliMonthDays(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: check if jalali year is leap
  const g1 = jalaliToGregorian(jy, jm, 1);
  const g2 = jalaliToGregorian(jy + 1, 1, 1);
  const diffDays = Math.round((new Date(g2.gy, g2.gm - 1, g2.gd) - new Date(g1.gy, g1.gm - 1, g1.gd)) / 86400000);
  return diffDays === 365 ? 29 : 30;
}

function toJalaliNum(n) {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).split('').map(d => persianDigits[parseInt(d)]).join('');
}

function formatJalaliFull(jy, jm, jd) {
  const wd = JALALI_WEEKDAYS[getJalaliDayOfWeek(jy, jm, jd)];
  return `${wd}, ${toJalaliNum(jd)} ${JALALI_MONTHS[jm - 1]} ${toJalaliNum(jy)}`;
}

function formatJalaliShort(jy, jm, jd) {
  return `${toJalaliNum(jd)} ${JALALI_MONTHS[jm - 1]} ${toJalaliNum(jy)}`;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadTasks() {
  try {
    tasks = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    tasks = [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

// ─── Task CRUD ───────────────────────────────────────────────────────────────

function addTask(text, category, priority, dueDate) {
  tasks.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text,
    category,
    priority,
    dueDate,
    completed: false,
    createdAt: new Date().toISOString(),
  });
  saveTasks();
  render();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    render();
  }
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
}

function updateTaskText(id, newText) {
  const task = tasks.find(t => t.id === id);
  if (task && newText.trim()) {
    task.text = newText.trim();
    saveTasks();
    render();
  }
}

function reorderTasks(fromIndex, toIndex) {
  const filtered = getFilteredTasks();
  const fromTask = filtered[fromIndex];
  const toTask = filtered[toIndex];

  const fromRealIndex = tasks.indexOf(fromTask);
  const toRealIndex = tasks.indexOf(toTask);

  if (fromRealIndex === -1 || toRealIndex === -1) return;

  const [moved] = tasks.splice(fromRealIndex, 1);
  tasks.splice(toRealIndex, 0, moved);
  saveTasks();
  render();
}

// ─── Filtering ───────────────────────────────────────────────────────────────

function getFilteredTasks() {
  let filtered = tasks;

  if (currentFilter === 'active') {
    filtered = filtered.filter(t => !t.completed);
  } else if (currentFilter === 'completed') {
    filtered = filtered.filter(t => t.completed);
  }

  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(t =>
      t.text.toLowerCase().includes(q) ||
      t.category.includes(q) ||
      t.priority.includes(q)
    );
  }

  return filtered;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const [jy, jm, jd] = dateStr.split('/').map(Number);
  const g = jalaliToGregorian(jy, jm, jd);
  const date = new Date(g.gy, g.gm - 1, g.gd);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  const formatted = formatJalaliShort(jy, jm, jd);

  if (diff < 0) return { text: `${formatted} (سررسید گذشته)`, cls: 'overdue' };
  if (diff === 0) return { text: `${formatted} (امروز)`, cls: 'soon' };
  if (diff <= 3) return { text: `${formatted} (${diff} روز دیگر)`, cls: 'soon' };
  return { text: formatted, cls: 'normal' };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getPriorityClass(priority) {
  if (priority === 'زیاد') return 'priority-zayad';
  if (priority === 'متوسط') return 'priority-motavasset';
  if (priority === 'کم') return 'priority-kam';
  return '';
}

// ─── Render ──────────────────────────────────────────────────────────────────

let dragFromIndex = null;

function render() {
  const filtered = getFilteredTasks();

  taskList.innerHTML = '';

  filtered.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = `task-item ${getPriorityClass(task.priority)}${task.completed ? ' completed' : ''}`;
    li.dataset.index = index;
    li.draggable = true;

    const due = formatDueDate(task.dueDate);

    li.innerHTML = `
      <div class="drag-handle" title="برای جابجایی بکشید">&#9776;</div>
      <div class="task-check${task.completed ? ' checked' : ''}" data-action="toggle" data-id="${task.id}"></div>
      <div class="task-content">
        <div class="task-text">${escapeHtml(task.text)}</div>
        <div class="task-meta">
          <span class="task-tag">${escapeHtml(CATEGORY_LABELS[task.category] || task.category)}</span>
          <span class="task-tag">${escapeHtml(PRIORITY_LABELS[task.priority] || task.priority)}</span>
          ${due ? `<span class="task-tag due-date ${due.cls}">${due.text}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <button class="task-btn edit" data-action="edit" data-id="${task.id}" title="ویرایش">&#9998;</button>
        <button class="task-btn delete" data-action="delete" data-id="${task.id}" title="حذف">&#10005;</button>
      </div>
    `;

    // Drag events
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragenter', handleDragEnter);
    li.addEventListener('dragleave', handleDragLeave);
    li.addEventListener('drop', handleDrop);

    // Touch drag support
    const handle = li.querySelector('.drag-handle');
    handle.addEventListener('touchstart', handleTouchStart, { passive: false });

    taskList.appendChild(li);
  });

  const total = tasks.length;
  const active = tasks.filter(t => !t.completed).length;
  const completed = tasks.filter(t => t.completed).length;
  taskStats.textContent = total > 0 ? `${total} کار · ${active} فعال · ${completed} انجام شده` : '';

  emptyState.classList.toggle('visible', total === 0);
}

// ─── Drag and Drop ───────────────────────────────────────────────────────────

function handleDragStart(e) {
  dragFromIndex = parseInt(this.dataset.index);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragFromIndex);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  document.querySelectorAll('.task-item').forEach(item => {
    item.classList.remove('drag-over');
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
  e.preventDefault();
  this.classList.add('drag-over');
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const toIndex = parseInt(this.dataset.index);
  if (dragFromIndex !== null && dragFromIndex !== toIndex) {
    reorderTasks(dragFromIndex, toIndex);
  }
  dragFromIndex = null;
}

// ─── Touch Drag Support ──────────────────────────────────────────────────────

let touchDragEl = null;
let touchClone = null;
let touchStartIndex = null;
let touchStartY = 0;

function handleTouchStart(e) {
  const item = e.target.closest('.task-item');
  if (!item) return;

  touchDragEl = item;
  touchStartIndex = parseInt(item.dataset.index);
  touchStartY = e.touches[0].clientY;

  touchClone = item.cloneNode(true);
  touchClone.style.position = 'fixed';
  touchClone.style.zIndex = '9999';
  touchClone.style.opacity = '0.8';
  touchClone.style.pointerEvents = 'none';
  touchClone.style.width = item.offsetWidth + 'px';
  touchClone.style.transform = 'scale(1.02)';

  const rect = item.getBoundingClientRect();
  touchClone.style.left = rect.left + 'px';
  touchClone.style.top = (e.touches[0].clientY - rect.height / 2) + 'px';

  document.body.appendChild(touchClone);
  item.classList.add('dragging');

  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd);
}

function handleTouchMove(e) {
  e.preventDefault();
  if (!touchClone) return;

  const touch = e.touches[0];
  const rect = touchDragEl.getBoundingClientRect();
  touchClone.style.top = (touch.clientY - rect.height / 2) + 'px';

  // Find element under touch
  touchClone.style.display = 'none';
  const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  touchClone.style.display = '';

  const targetItem = elementBelow ? elementBelow.closest('.task-item') : null;

  document.querySelectorAll('.task-item').forEach(item => item.classList.remove('drag-over'));
  if (targetItem && parseInt(targetItem.dataset.index) !== touchStartIndex) {
    targetItem.classList.add('drag-over');
  }
}

function handleTouchEnd(e) {
  if (!touchClone || !touchDragEl) return;

  const touch = e.changedTouches[0];
  touchClone.style.display = 'none';
  const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
  touchClone.style.display = '';

  const targetItem = elementBelow ? elementBelow.closest('.task-item') : null;

  if (targetItem) {
    const toIndex = parseInt(targetItem.dataset.index);
    if (touchStartIndex !== null && touchStartIndex !== toIndex) {
      reorderTasks(touchStartIndex, toIndex);
    }
  }

  touchDragEl.classList.remove('dragging');
  document.querySelectorAll('.task-item').forEach(item => item.classList.remove('drag-over'));

  touchClone.remove();
  touchClone = null;
  touchDragEl = null;
  touchStartIndex = null;

  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('touchend', handleTouchEnd);
}

// ─── Inline Edit ─────────────────────────────────────────────────────────────

function startEdit(id, textEl) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'task-text-input';
  input.value = textEl.textContent;

  textEl.replaceWith(input);
  input.focus();
  input.select();

  function finish() {
    updateTaskText(id, input.value);
  }

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') render();
  });
}

// ─── Delete Confirmation Modal ───────────────────────────────────────────────

const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDelete');
const confirmDeleteBtn = document.getElementById('confirmDelete');
let pendingDeleteId = null;

function showDeleteModal(id) {
  pendingDeleteId = id;
  deleteModal.classList.add('open');
}

function hideDeleteModal() {
  pendingDeleteId = null;
  deleteModal.classList.remove('open');
}

cancelDeleteBtn.addEventListener('click', hideDeleteModal);
confirmDeleteBtn.addEventListener('click', () => {
  if (pendingDeleteId) {
    deleteTask(pendingDeleteId);
  }
  hideDeleteModal();
});

deleteModal.addEventListener('click', e => {
  if (e.target === deleteModal) hideDeleteModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && deleteModal.classList.contains('open')) {
    hideDeleteModal();
  }
});

// ─── Jalali Datepicker ───────────────────────────────────────────────────────

const datepickerEl = document.getElementById('datepicker');
let dpViewDate = getJalaliToday(); // { jy, jm, jd }
let dpSelectedDate = null; // "jy/jm/jd" string

function openDatepicker() {
  const val = dueDateInput.value;
  if (val) {
    const [jy, jm, jd] = val.split('/').map(Number);
    dpViewDate = { jy, jm, jd };
    dpSelectedDate = val;
  } else {
    dpViewDate = getJalaliToday();
    dpSelectedDate = null;
  }
  renderDatepicker();
  datepickerEl.classList.add('open');
}

function closeDatepicker() {
  datepickerEl.classList.remove('open');
}

function renderDatepicker() {
  const today = getJalaliToday();
  const { jy, jm } = dpViewDate;

  const daysInMonth = jalaliMonthDays(jy, jm);
  const firstDayOfWeek = getJalaliDayOfWeek(jy, jm, 1);

  let html = '';

  // Header
  html += `<div class="dp-header">`;
  html += `<button class="dp-nav dp-prev" title="ماه قبل">&#9660;</button>`;
  html += `<span class="dp-title">${JALALI_MONTHS[jm - 1]} ${toJalaliNum(jy)}</span>`;
  html += `<button class="dp-nav dp-next" title="ماه بعد">&#9650;</button>`;
  html += `</div>`;

  // Weekday headers
  html += `<div class="dp-weekdays">`;
  JALALI_WEEKDAY_SHORT.forEach(w => {
    html += `<span class="dp-weekday">${w}</span>`;
  });
  html += `</div>`;

  // Days grid
  html += `<div class="dp-days">`;

  // Empty cells before first day
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevJm = jm === 1 ? 12 : jm - 1;
    const prevJy = jm === 1 ? jy - 1 : jy;
    const prevDays = jalaliMonthDays(prevJy, prevJm);
    const dayNum = prevDays - firstDayOfWeek + i + 1;
    html += `<button class="dp-day other-month" data-jy="${prevJy}" data-jm="${prevJm}" data-jd="${dayNum}">${toJalaliNum(dayNum)}</button>`;
  }

  // Current month days
  const isRTL = true;
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = jy === today.jy && jm === today.jm && d === today.jd;
    const isSelected = dpSelectedDate === `${jy}/${jm}/${d}`;
    const cls = `dp-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`;
    html += `<button class="${cls}" data-jy="${jy}" data-jm="${jm}" data-jd="${d}">${toJalaliNum(d)}</button>`;
  }

  // Fill remaining cells
  const totalCells = firstDayOfWeek + daysInMonth;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    const nextJm = jm === 12 ? 1 : jm + 1;
    const nextJy = jm === 12 ? jy + 1 : jy;
    html += `<button class="dp-day other-month" data-jy="${nextJy}" data-jm="${nextJm}" data-jd="${i}">${toJalaliNum(i)}</button>`;
  }

  html += `</div>`;

  // Clear button
  html += `<button class="dp-clear" id="dpClear">پاک کردن تاریخ</button>`;

  datepickerEl.innerHTML = html;

  // Bind events
  datepickerEl.querySelector('.dp-prev').addEventListener('click', () => {
    dpViewDate.jm--;
    if (dpViewDate.jm < 1) { dpViewDate.jm = 12; dpViewDate.jy--; }
    renderDatepicker();
  });

  datepickerEl.querySelector('.dp-next').addEventListener('click', () => {
    dpViewDate.jm++;
    if (dpViewDate.jm > 12) { dpViewDate.jm = 1; dpViewDate.jy++; }
    renderDatepicker();
  });

  datepickerEl.querySelectorAll('.dp-day').forEach(btn => {
    btn.addEventListener('click', () => {
      const jy = parseInt(btn.dataset.jy);
      const jm = parseInt(btn.dataset.jm);
      const jd = parseInt(btn.dataset.jd);
      dueDateInput.value = `${jy}/${jm}/${jd}`;
      closeDatepicker();
    });
  });

  datepickerEl.querySelector('#dpClear').addEventListener('click', () => {
    dueDateInput.value = '';
    dpSelectedDate = null;
    closeDatepicker();
  });
}

// Open/close datepicker
dueDateInput.addEventListener('click', (e) => {
  e.stopPropagation();
  if (datepickerEl.classList.contains('open')) {
    closeDatepicker();
  } else {
    openDatepicker();
  }
});

document.addEventListener('click', (e) => {
  if (!datepickerEl.contains(e.target) && e.target !== dueDateInput) {
    closeDatepicker();
  }
});

// ─── Event Listeners ─────────────────────────────────────────────────────────

addForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = taskInput.value.trim();
  if (!text) return;
  addTask(text, categoryInput.value, priorityInput.value, dueDateInput.value);
  taskInput.value = '';
  dueDateInput.value = '';
  taskInput.focus();
});

taskList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'toggle') toggleTask(id);
  if (action === 'delete') showDeleteModal(id);
  if (action === 'edit') {
    const textEl = btn.closest('.task-item').querySelector('.task-text');
    startEdit(id, textEl);
  }
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  render();
});

loadTasks();
render();
