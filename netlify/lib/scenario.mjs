// Server side rules, answer keys and scoring. Never sent to the browser.
import {
  T, absMin, parseSlot, RULES, EVENTS, STAGES,
} from '../../public/data.js';

// ---------------------------------------------------------------- field index
export const FIELDS = {};
for (const st of STAGES) {
  for (const task of st.tasks) {
    for (const f of task.fields) FIELDS[f.key] = { ...f, stage: st.n };
  }
}
export const stageOfKey = (key) => Number(String(key)[1]);

// ---------------------------------------------------------------- rule engine
const STARTS = [];
for (let m = RULES.open; m <= RULES.close - RULES.len; m += 15) STARTS.push(m);

const clientsOn = (day) => EVENTS.filter((e) => e.day === day && e.type === 'client').length;

// Returns the hard rules a start time breaks. Double booking means it overlaps another appointment.
export function evaluate(stageN, day, start) {
  const st = STAGES[stageN - 1];
  const end = start + RULES.len;
  const bufEnd = end + RULES.buffer;
  const rules = new Set();
  let double = false;

  if (start < RULES.open || bufEnd > RULES.close) rules.add('hours');
  if (absMin(day, start) - absMin(st.clock.day, T(st.clock.time)) < RULES.notice) rules.add('notice');

  for (const ev of EVENTS) {
    if (ev.day !== day || ev.free || ev.type === 'allday' || ev.type === 'proposed') continue;
    if (ev.type === 'client' || ev.type === 'internal') {
      if (start < ev.b && end > ev.a) { rules.add('overlap'); double = true; }
      else if (ev.a >= end && ev.a < bufEnd) rules.add('buffer');
      else if (start >= ev.b && start < ev.b + RULES.buffer) rules.add('buffer');
    } else if (ev.type === 'protected') {
      if (start < ev.b && bufEnd > ev.a) rules.add('protected');
    } else if (ev.type === 'travel') {
      if (start < ev.b && end > ev.a) rules.add('travel');
    }
  }

  if (st.attendee) {
    for (const b of st.attendee.busy) {
      if (b.day === day && start < T(b.to) && end > T(b.from)) rules.add('attendee');
    }
  }
  const w = st.window;
  if (!(w.days.includes(day) && start >= T(w.from) && end <= T(w.to))) rules.add('window');
  if (clientsOn(day) >= RULES.dailyLimit) rules.add('limit');
  if (st.roomFreeFrom && start < st.roomFreeFrom) rules.add('room');

  return { rules: [...rules], double };
}

export function earliestValid(stageN) {
  const st = STAGES[stageN - 1];
  for (const day of st.days) {
    for (const s of STARTS) if (evaluate(stageN, day, s).rules.length === 0) return { day, start: s };
  }
  return null;
}

export function validSlots(stageN) {
  const st = STAGES[stageN - 1];
  const out = [];
  for (const day of st.days) for (const s of STARTS) if (evaluate(stageN, day, s).rules.length === 0) out.push({ day, start: s });
  return out;
}

// Slot credit: valid and earliest 100%, valid 85%, one hard rule broken 40%, two or more or a double booking 0.
export function slotCredit(stageN, value) {
  const slot = parseSlot(value);
  const st = STAGES[stageN - 1];
  if (!slot || !st.days.includes(slot.day) || !STARTS.includes(slot.start)) return 0;
  const ev = evaluate(stageN, slot.day, slot.start);
  if (ev.double) return 0;
  if (ev.rules.length === 0) {
    const first = earliestValid(stageN);
    return first && first.day === slot.day && first.start === slot.start ? 1 : 0.85;
  }
  return ev.rules.length === 1 ? 0.4 : 0;
}

// ---------------------------------------------------------------- answer keys
const choice = (map) => ({ kind: 'choice', map });
const multi = (correct) => ({ kind: 'multi', correct });

// marks and credit for every scored key. Marks add up to 100.
export const KEYS = {
  's1.view': { marks: 2, ...choice({ day: 1, week: 0.5 }) },
  's1.window': { marks: 4, ...choice({ w1430: 1 }) },
  's1.r1430': { marks: 2, ...multi(['notice', 'buffer']) },
  's1.r1545': { marks: 2, ...multi(['attendee']) },
  's1.r1630': { marks: 2, ...multi(['hours']) },
  's1.allday': { marks: 2, ...choice({ free: 1 }) },
  's1.freebusy': { marks: 2, ...choice({ ok: 1, vague: 0.5 }) },
  's1.slot': { marks: 7, kind: 'slot', stage: 1 },
  's1.rec.date': { marks: 1, kind: 'recDate', slotKey: 's1.slot' },
  's1.rec.start': { marks: 0.5, kind: 'recStart', slotKey: 's1.slot' },
  's1.rec.end': { marks: 0.5, kind: 'recEnd', slotKey: 's1.slot' },
  's1.rec.zone': { marks: 1, ...choice({ wat: 1, est: 0.5 }) },
  's1.rec.participant': { marks: 0.5, ...choice({ kemi: 1 }) },
  's1.rec.contact': { marks: 0.5, ...choice({ email: 1 }) },
  's1.rec.provider': { marks: 0.5, ...choice({ dami: 1 }) },
  's1.rec.attendee': { marks: 0.5, ...choice({ sani: 1 }) },
  's1.rec.link': { marks: 0.5, ...choice({ video: 1 }) },
  's1.rec.status': { marks: 0.5, ...choice({ confirmed: 1, pending: 0.5 }) },
  's1.confirm': { marks: 3, ...choice({ a: 1, b: 0.5, c: 0.5 }) },
  's1.reminders': { marks: 2, ...choice({ both: 1, day: 0.5, two: 0.5 }) },
  's1.notes': { marks: 2, ...multi(['purpose', 'zone', 'attendee']) },

  's2.slot': { marks: 5, kind: 'slot', stage: 2 },
  's2.record': { marks: 3, ...choice({ edit: 1, recreate: 0.4 }) },
  's2.release': { marks: 2, ...choice({ release: 1, hold: 0.5 }) },
  's2.recur': { marks: 2, ...choice({ one: 1 }) },
  's2.notice': { marks: 3, ...choice({ a: 1, b: 0.5 }) },
  's2.reminders': { marks: 2, ...multi(['cancel24', 'cancel2', 'new24', 'new2']) },
  's2.wl.person': { marks: 1, ...choice({ femi: 1 }) },
  's2.wl.deadline': { marks: 1, ...choice({ '10:15': 1, '10:30': 1, '10:45': 1 }) },
  's2.followup': { marks: 1, ...choice({ call: 1, resend: 0.5 }) },

  's3.conflicts': { marks: 4, ...multi(['travel', 'room']) },
  's3.classify': {
    marks: 5,
    kind: 'classify',
    correct: { travel: 'hard', room1: 'hard', capacity: 'hard', protected: 'hard', client: 'pref', mornings: 'pref', screen: 'pref' },
  },
  's3.slot': { marks: 8, kind: 'slot', stage: 3 },
  's3.room': { marks: 3, ...choice({ r1: 1 }) },
  's3.rec.affected': { marks: 1, ...choice({ review: 1 }) },
  's3.rec.constraints': { marks: 1, ...multi(['travel', 'room', 'capacity', 'protected']) },
  's3.rec.resolution': { marks: 1, ...choice({ moved: 1 }) },
  's3.rec.contacted': { marks: 1, ...multi(['client', 'exec', 'desk']) },
  's3.rec.status': { marks: 1, ...choice({ booked: 1, proposed: 0.5 }) },
  's3.diag': { marks: 4, ...choice({ limit: 1 }) },

  's4.outcome': { marks: 4, ...choice({ rebook: 1, serve: 0.25 }) },
  's4.protect': { marks: 2, ...multi(['start', 'buffer', 'after']) },
  's4.slot': { marks: 3, kind: 'slot', stage: 4 },
  's4.notice': { marks: 2, ...choice({ a: 1, b: 0.5, c: 0.5 }) },
  's4.status': { marks: 2, ...choice({ late_rebooked: 1, rebooked: 0.6 }) },
  's4.reminders': { marks: 1, ...choice({ new: 1 }) },
  's4.checks': { marks: 1, kind: 'checks' },
};

export const GROUPS = {
  // used by tests only, to confirm the marks table matches the plan
  c1: ['s1.view', 's1.window', 's1.r1430', 's1.r1545', 's1.r1630', 's1.allday', 's1.freebusy', 's3.diag'],
  c2: ['s1.slot', 's1.rec.date', 's1.rec.start', 's1.rec.end', 's1.rec.zone', 's1.rec.participant', 's1.rec.contact', 's1.rec.provider', 's1.rec.attendee', 's1.rec.link', 's1.rec.status', 's1.confirm', 's1.reminders', 's1.notes'],
  c3: ['s2.slot', 's2.record', 's2.release', 's2.recur', 's2.notice', 's2.reminders', 's2.wl.person', 's2.wl.deadline', 's2.followup'],
  c4: ['s3.conflicts', 's3.classify', 's3.slot', 's3.room', 's3.rec.affected', 's3.rec.constraints', 's3.rec.resolution', 's3.rec.contacted', 's3.rec.status'],
  c5: ['s4.outcome', 's4.protect', 's4.slot', 's4.notice', 's4.status', 's4.reminders', 's4.checks'],
};

// ---------------------------------------------------------------- final checks
// The state of the learner's own calendar as they leave it.
export function finalDefects(a) {
  const slots = [1, 2, 3, 4].map((n) => ({ n, slot: parseSlot(a[`s${n}.slot`]) })).filter((x) => x.slot);
  const broke = (ids) => slots.some(({ n, slot }) => evaluate(n, slot.day, slot.start).rules.some((r) => ids.includes(r)));

  const conflicts = broke(['overlap', 'buffer', 'hours', 'protected', 'limit', 'travel']);
  const resources = broke(['attendee', 'room']) || a['s3.room'] === 'r2';

  const r2 = Array.isArray(a['s2.reminders']) ? a['s2.reminders'] : [];
  const oldLive = !(r2.includes('cancel24') && r2.includes('cancel2')) || r2.includes('keep');
  const reminders = oldLive || a['s4.reminders'] === 'old';

  const s1 = parseSlot(a['s1.slot']);
  let mismatch = false;
  if (s1) {
    const end = s1.start + RULES.len;
    mismatch = String(s1.day) !== a['s1.rec.date']
      || a['s1.rec.start'] !== hh(s1.start)
      || a['s1.rec.end'] !== hh(end);
  }
  const records = mismatch
    || a['s2.record'] !== 'edit'
    || a['s4.status'] === 'noshow'
    || a['s4.status'] === 'completed'
    || a['s4.status'] === undefined;

  return { conflicts, resources, reminders, records };
}

const hh = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');

// ---------------------------------------------------------------- credit
const round2 = (n) => Math.round(n * 100) / 100;

function fraction(key, def, a) {
  const v = a[key];
  if (v === undefined || v === null) return 0;
  switch (def.kind) {
    case 'choice': return def.map[v] || 0;
    case 'multi': {
      if (!Array.isArray(v)) return 0;
      const right = v.filter((x) => def.correct.includes(x)).length;
      const wrong = v.length - right;
      return Math.max(0, Math.min(1, (right - 0.5 * wrong) / def.correct.length));
    }
    case 'classify': {
      if (typeof v !== 'object') return 0;
      const ids = Object.keys(def.correct);
      return ids.filter((id) => v[id] === def.correct[id]).length / ids.length;
    }
    case 'slot': return slotCredit(def.stage, v);
    case 'recDate': { const s = parseSlot(a[def.slotKey]); return s && String(s.day) === v ? 1 : 0; }
    case 'recStart': { const s = parseSlot(a[def.slotKey]); return s && hh(s.start) === v ? 1 : 0; }
    case 'recEnd': { const s = parseSlot(a[def.slotKey]); return s && hh(s.start + RULES.len) === v ? 1 : 0; }
    case 'checks': {
      if (typeof v !== 'object') return 0;
      const truth = finalDefects(a);
      const ids = Object.keys(truth);
      return ids.filter((id) => v[id] === (truth[id] ? 'yes' : 'no')).length / ids.length;
    }
    default: return 0;
  }
}

export function scoreAttempt(answers) {
  const items = {};
  let total = 0;
  for (const [key, def] of Object.entries(KEYS)) {
    const mark = round2(def.marks * fraction(key, def, answers));
    items[key] = mark;
    total += mark;
  }
  return { total: Math.round(total * 10) / 10, items };
}

// ---------------------------------------------------------------- input cleaning
// Keeps only known keys with known option ids, so nothing odd reaches the store.
export function sanitize(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, raw] of Object.entries(input)) {
    const f = FIELDS[key];
    if (!f) continue;
    const ids = (f.options || []).map((x) => x.id);
    switch (f.kind) {
      case 'radio': case 'select': case 'template':
        if (typeof raw === 'string' && ids.includes(raw)) out[key] = raw;
        break;
      case 'multi':
        if (Array.isArray(raw)) out[key] = [...new Set(raw.filter((x) => typeof x === 'string' && ids.includes(x)))];
        break;
      case 'classify': case 'checks':
        if (raw && typeof raw === 'object') {
          const choices = f.choices.map((c) => c.id);
          const clean = {};
          for (const id of ids) if (typeof raw[id] === 'string' && choices.includes(raw[id])) clean[id] = raw[id];
          out[key] = clean;
        }
        break;
      case 'slot': {
        const s = parseSlot(raw);
        const st = STAGES[f.stage - 1];
        if (s && st.days.includes(s.day) && STARTS.includes(s.start)) out[key] = raw;
        break;
      }
      default: break;
    }
  }
  return out;
}
