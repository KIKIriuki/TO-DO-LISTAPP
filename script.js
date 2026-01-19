// CEO Time-Block Planner - script.js
// All data stored in localStorage key: 'ceoWeeklySchedule'

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const STORAGE_KEY = "ceoWeeklySchedule";

const plannerEl = document.getElementById("planner");
const summaryText = document.getElementById("summaryText");
const datetimeEl = document.getElementById("datetime");
const resetBtn = document.getElementById("resetBtn");

const dayTemplate = document.getElementById("day-template");
const slotTemplate = document.getElementById("slot-template");

// ---------- Utilities ----------
function now() {
  return new Date();
}
function timeToMinutes(t) { // "HH:MM" -> minutes since midnight
  const [h,m] = t.split(":").map(Number);
  return h*60 + m;
}
function minutesToTime(mins) {
  const h = Math.floor(mins/60);
  const m = mins%60;
  return String(h).padStart(2,"0") + ":" + String(m).padStart(2,"0");
}
function formatDisplay(dt){
  return dt.toLocaleString(undefined, {
    weekday: "long", year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

// ---------- Storage ----------
function loadSchedule(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSchedule();
    const parsed = JSON.parse(raw);
    // ensure all days exist
    DAYS.forEach(d => { if (!parsed[d]) parsed[d]= { slots: [] }; });
    return parsed;
  } catch(e) {
    console.error("loadSchedule error", e);
    return defaultSchedule();
  }
}
function saveSchedule(schedule){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
  updateSummary(schedule);
}

// defau lt: empty schedule with a sample slot for each day (9:00)
function defaultSchedule(){
  const s = {};
  DAYS.forEach(d => s[d] = { slots: [] });
  return s;
}

// ---------- Rendering ----------
function buildPlanner(){
  plannerEl.innerHTML = "";
  const schedule = loadSchedule();

  DAYS.forEach(day => {
    const dayNode = dayTemplate.content.cloneNode(true);
    const card = dayNode.querySelector(".day-card");
    const name = card.querySelector(".day-name");
    const addBtn = card.querySelector(".add-slot-btn");
    const timeInput = card.querySelector(".new-slot-time");
    const slotsWrap = card.querySelector(".slots-wrap");

    name.textContent = day;
    // default time input to next hour
    timeInput.value = "07:00";

    // add slot handler
    addBtn.addEventListener("click", () => {
      const t = timeInput.value;
      if (!t) return;
      addSlot(day, t);
    });
    timeInput.addEventListener("keypress", e => { if (e.key==="Enter") addBtn.click(); });

    // render existing slots
    schedule[day].slots.sort((a,b)=>timeToMinutes(a.time)-timeToMinutes(b.time));
    schedule[day].slots.forEach((slot, idx) => {
      const slotNode = renderSlot(day, slot, idx);
      slotsWrap.appendChild(slotNode);
    });

    plannerEl.appendChild(card);
  });

  // after DOM inserted, try scroll to current day & hour
  scrollToNow();
  updateSummary(schedule);
}

function renderSlot(day, slot, slotIndex){
  const template = slotTemplate.content.cloneNode(true);
  const slotEl = template.querySelector(".slot");
  const slotTimeEl = template.querySelector(".slot-time");
  const removeSlotBtn = template.querySelector(".remove-slot");
  const taskInput = template.querySelector(".task-input");
  const addTaskBtn = template.querySelector(".add-task-btn");
  const taskList = template.querySelector(".task-list");

  slotTimeEl.textContent = toDisplayHour(slot.time);

  // remove slot
  removeSlotBtn.addEventListener("click", () => {
    if (!confirm(`Remove slot ${slot.time} on ${day}? This will delete all tasks in it.`)) return;
    removeSlot(day, slotIndex);
  });

  // add task
  addTaskBtn.addEventListener("click", () => {
    addTaskFromInput(day, slotIndex, taskInput);
  });
  taskInput.addEventListener("keypress", e => {
    if (e.key === "Enter") addTaskFromInput(day, slotIndex, taskInput);
  });

  // tasks
  (slot.tasks || []).forEach((task, tIdx) => {
    const li = document.createElement("li");
    li.className = "task-item";
    if (task.done) li.classList.add("done");
    if (task.highlight) li.classList.add("highlight");

    const left = document.createElement("div");
    left.className = "left";

    const txt = document.createElement("div");
    txt.className = "task-text";
    txt.textContent = task.text;

    left.appendChild(txt);

    const btns = document.createElement("div");
    btns.className = "task-buttons";

    const doneBtn = document.createElement("button");
    doneBtn.title = "Toggle done";
    doneBtn.innerText = "✔";
    doneBtn.addEventListener("click", () => toggleDone(day, slotIndex, tIdx));

    const highlightBtn = document.createElement("button");
    highlightBtn.title = "Toggle highlight";
    highlightBtn.innerText = "★";
    highlightBtn.addEventListener("click", () => toggleHighlight(day, slotIndex, tIdx));

    const delBtn = document.createElement("button");
    delBtn.title = "Delete task";
    delBtn.innerText = "✕";
    delBtn.addEventListener("click", () => deleteTask(day, slotIndex, tIdx));

    btns.append(doneBtn, highlightBtn, delBtn);

    li.appendChild(left);
    li.appendChild(btns);

    taskList.appendChild(li);
  });

  return slotEl;
}

function toDisplayHour(hhmm){
  // optional formatting to 12-hour with AM/PM
  const [h,m] = hhmm.split(":").map(Number);
  const ampm = h>=12 ? "PM" : "AM";
  const hr12 = (h%12) === 0 ? 12 : h%12;
  return `${String(hr12)}:${String(m).padStart(2,"0")} ${ampm}`;
}

// ---------- Actions ----------
function addSlot(day, timeStr){
  if (!/^\d{2}:\d{2}$/.test(timeStr)) return;
  const schedule = loadSchedule();
  schedule[day].slots = schedule[day].slots || [];
  // prevent duplicate time slot
  if (schedule[day].slots.some(s=>s.time===timeStr)){
    alert("A slot at this time already exists for " + day);
    return;
  }
  schedule[day].slots.push({ time: timeStr, tasks: [] });
  saveSchedule(schedule);
  buildPlanner();
}

function removeSlot(day, slotIndex){
  const schedule = loadSchedule();
  if (!schedule[day] || !schedule[day].slots[slotIndex]) return;
  schedule[day].slots.splice(slotIndex,1);
  saveSchedule(schedule);
  buildPlanner();
}

function addTaskFromInput(day, slotIndex, inputEl){
  const text = inputEl.value.trim();
  if (!text) return;
  addTask(day, slotIndex, text);
  inputEl.value = "";
}

function addTask(day, slotIndex, text){
  const schedule = loadSchedule();
  schedule[day].slots[slotIndex].tasks = schedule[day].slots[slotIndex].tasks || [];
  schedule[day].slots[slotIndex].tasks.push({ text, done:false, highlight:false });
  saveSchedule(schedule);
  buildPlanner();
}

function toggleDone(day, slotIndex, taskIndex){
  const schedule = loadSchedule();
  const t = schedule[day].slots[slotIndex].tasks[taskIndex];
  t.done = !t.done;
  saveSchedule(schedule);
  buildPlanner();
}

function toggleHighlight(day, slotIndex, taskIndex){
  const schedule = loadSchedule();
  const t = schedule[day].slots[slotIndex].tasks[taskIndex];
  t.highlight = !t.highlight;
  saveSchedule(schedule);
  buildPlanner();
}

function deleteTask(day, slotIndex, taskIndex){
  const schedule = loadSchedule();
  schedule[day].slots[slotIndex].tasks.splice(taskIndex,1);
  saveSchedule(schedule);
  buildPlanner();
}

// ---------- Summary & Time ----------
function updateSummary(schedule){
  const s = schedule || loadSchedule();
  let total=0, done=0;
  Object.values(s).forEach(dayObj => {
    (dayObj.slots || []).forEach(slot => {
      (slot.tasks || []).forEach(t => {
        total++;
        if (t.done) done++;
      });
    });
  });
  summaryText.textContent = `${done} of ${total} tasks done`;
}

function updateDateTime(){
  datetimeEl.textContent = formatDisplay(now());
}
setInterval(updateDateTime, 1000);
updateDateTime();

// ---------- Auto-scroll to current day/hour ----------
function scrollToNow(){
  const schedule = loadSchedule();
  const todayIndex = (new Date()).getDay(); // 0 Sun .. 6 Sat
  // convert to Monday-based index: want 0 => Monday ... 6 => Sunday
  const mondayIndex = (todayIndex + 6) % 7;
  const dayName = DAYS[mondayIndex];

  // find the day card element
  const cards = Array.from(document.querySelectorAll(".day-card"));
  const dayCard = cards.find(c => c.querySelector(".day-name").textContent === dayName);
  if (!dayCard) return;

  // mark current day
  cards.forEach(c => c.classList.remove("current-day"));
  dayCard.classList.add("current-day");

  // find nearest slot to current hour
  const nowMins = now().getHours()*60 + now().getMinutes();
  const slots = schedule[dayName].slots || [];
  if (!slots.length){
    // optionally create a default slot at current hour
    // do nothing for now
    dayCard.scrollIntoView({behavior:"smooth",block:"center"});
    return;
  }
  // find slot index with minimal absolute difference
  let bestIndex = 0;
  let bestDiff = Infinity;
  slots.forEach((s, i) => {
    const diff = Math.abs(timeToMinutes(s.time) - nowMins);
    if (diff < bestDiff){ bestDiff = diff; bestIndex = i; }
  });

  // find corresponding slot element
  const slotEls = Array.from(dayCard.querySelectorAll(".slot"));
  if (slotEls[bestIndex]){
    slotEls.forEach(se => se.classList.remove("current-slot"));
    slotEls[bestIndex].classList.add("current-slot");
    // ensure it's visible
    slotEls[bestIndex].scrollIntoView({behavior:"smooth",block:"center"});
  } else {
    dayCard.scrollIntoView({behavior:"smooth",block:"center"});
  }
}

// ---------- Reset ----------
resetBtn.addEventListener("click", () => {
  if (!confirm("This will clear all planner data from this browser. Continue?")) return;
  localStorage.removeItem(STORAGE_KEY);
  buildPlanner();
});

// ---------- Init ----------
buildPlanner();
