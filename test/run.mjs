// Logic tests, and a local dev server: `node test/run.mjs` runs tests, `node test/run.mjs serve 8080` serves the page.
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES, MEMO, HELP, TEMPLATES, EVENTS, T, MAX_ATTEMPTS } from '../public/data.js';
import { KEYS, GROUPS, FIELDS, evaluate, earliestValid, validSlots, slotCredit, scoreAttempt, sanitize, finalDefects } from '../netlify/lib/scenario.mjs';
import { handleStart, handleSave, handleSubmit, handleReset } from '../netlify/lib/attempts.mjs';
import { wrap } from '../netlify/lib/http.mjs';

const ROOT = fileURLToPath(new URL('../public/', import.meta.url));
// Same policy as netlify.toml, so the dev server shows any violation.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'";
// In memory stand in for Netlify Blobs: same get, add and update contract, with clashes simulated by awaiting between read and write.
const memStore = () => {
  const m = new Map();
  return {
    m,
    get: async (k) => (m.has(k) ? structuredClone(m.get(k)) : null),
    add: async (k, v) => { if (m.has(k)) return false; m.set(k, structuredClone(v)); return true; },
    update: async (k, fn) => {
      const step = fn(m.has(k) ? structuredClone(m.get(k)) : null);
      if (!step || step.rec === null) return step ? step.out : null;
      m.set(k, structuredClone(step.rec));
      return step.out;
    },
  };
};
const learners = (s) => [...s.m].filter(([k]) => k.startsWith('learner/')).map(([, v]) => v);
const learner = (s) => learners(s)[0];

// ------------------------------------------------------------------ perfect answers
export const PERFECT = {
  's1.view': 'day', 's1.window': 'w1430',
  's1.r1430': ['notice', 'buffer'], 's1.r1545': ['attendee'], 's1.r1630': ['hours'],
  's1.allday': 'free', 's1.freebusy': 'ok', 's1.slot': '3@16:15',
  's1.rec.date': '3', 's1.rec.start': '16:15', 's1.rec.end': '16:45', 's1.rec.zone': 'wat',
  's1.rec.participant': 'kemi', 's1.rec.contact': 'email', 's1.rec.provider': 'dami', 's1.rec.attendee': 'sani', 's1.rec.link': 'video', 's1.rec.status': 'confirmed',
  's1.confirm': 'a', 's1.reminders': 'both', 's1.notes': ['purpose', 'zone', 'attendee'],
  's2.slot': '5@14:45', 's2.record': 'edit', 's2.release': 'release', 's2.recur': 'one', 's2.notice': 'a',
  's2.reminders': ['cancel24', 'cancel2', 'new24', 'new2'], 's2.wl.person': 'femi', 's2.wl.deadline': '10:45', 's2.followup': 'call',
  's3.conflicts': ['travel', 'room'],
  's3.classify': { travel: 'hard', room1: 'hard', capacity: 'hard', protected: 'hard', client: 'pref', mornings: 'pref', screen: 'pref' },
  's3.slot': '6@12:45', 's3.room': 'r1',
  's3.rec.affected': 'review', 's3.rec.constraints': ['travel', 'room', 'capacity', 'protected'], 's3.rec.resolution': 'moved', 's3.rec.contacted': ['client', 'exec', 'desk'], 's3.rec.status': 'booked',
  's3.diag': 'limit',
  's4.outcome': 'rebook', 's4.protect': ['start', 'buffer', 'after'], 's4.slot': '10@10:15', 's4.notice': 'a', 's4.status': 'late_rebooked', 's4.reminders': 'new',
  's4.checks': { conflicts: 'no', resources: 'no', reminders: 'no', records: 'no' },
};

const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const sc = (patch) => scoreAttempt({ ...PERFECT, ...patch });
const item = (patch, key) => scoreAttempt({ ...PERFECT, ...patch }).items[key];

// ------------------------------------------------------------------ plan checks
test('marks add up to 100 and match the five criteria sizes', () => {
  const sum = (keys) => keys.reduce((n, k) => n + KEYS[k].marks, 0);
  assert.equal(sum(GROUPS.c1), 20); assert.equal(sum(GROUPS.c2), 20); assert.equal(sum(GROUPS.c3), 20);
  assert.equal(sum(GROUPS.c4), 25); assert.equal(sum(GROUPS.c5), 15);
  assert.equal(Object.values(KEYS).reduce((n, d) => n + d.marks, 0), 100);
  const all = Object.values(GROUPS).flat();
  assert.deepEqual([...all].sort(), Object.keys(KEYS).sort());
});

test('every scored key is a real field and every field is scored', () => {
  for (const k of Object.keys(KEYS)) assert.ok(FIELDS[k], 'no field for ' + k);
  for (const k of Object.keys(FIELDS)) assert.ok(KEYS[k], 'no key for ' + k);
});

test('every credited option exists in the page options', () => {
  for (const [k, d] of Object.entries(KEYS)) {
    const ids = (FIELDS[k].options || []).map((x) => x.id);
    for (const id of Object.keys(d.map || {})) assert.ok(ids.includes(id), `${k}: ${id}`);
    for (const id of d.correct && !Array.isArray(d.correct) ? Object.keys(d.correct) : (d.correct || [])) assert.ok(ids.includes(id), `${k}: ${id}`);
  }
});

test('Stage 1: 16:15 is the only valid slot', () => {
  assert.deepEqual(validSlots(1), [{ day: 3, start: T('16:15') }]);
  const r = (t) => evaluate(1, 3, T(t)).rules.sort();
  assert.deepEqual(r('14:30'), ['buffer', 'notice']);
  assert.deepEqual(r('15:45'), ['attendee']);
  assert.deepEqual(r('16:30'), ['hours']);
});

test('Stage 2: valid starts are 14:45 and 15:00 only', () => {
  assert.deepEqual(validSlots(2).map((s) => `${s.day}@${s.start}`), [`5@${T('14:45')}`, `5@${T('15:00')}`]);
  const r = (t) => evaluate(2, 5, T(t)).rules.sort();
  assert.deepEqual(r('14:15'), ['attendee']);
  assert.deepEqual(r('14:30'), ['attendee']);
  assert.deepEqual(r('15:15'), ['buffer']);
});

test('Stage 3: 12:45 is the earliest valid slot, with the stated failures', () => {
  assert.deepEqual(earliestValid(3), { day: 6, start: T('12:45') });
  const r = (t) => evaluate(3, 6, T(t)).rules.sort();
  assert.deepEqual(r('12:15'), ['room']);
  assert.deepEqual(r('12:30'), ['room']);
  assert.deepEqual(r('13:00'), ['protected']);
  assert.ok(r('11:30').length >= 2);
});

test('Stage 4: earliest rebooking is Tuesday 10 at 10:15, with the stated failures', () => {
  assert.deepEqual(earliestValid(4), { day: 10, start: T('10:15') });
  assert.ok(validSlots(4).some((s) => s.day === 12 && s.start === T('14:45')));
  assert.ok(!validSlots(4).some((s) => s.day === 9));
  assert.deepEqual(evaluate(4, 9, T('11:15')).rules, ['limit']);
  assert.deepEqual(evaluate(4, 10, T('11:00')).rules, ['buffer']);
  assert.deepEqual(evaluate(4, 12, T('09:30')).rules, ['protected']);
  assert.ok(evaluate(4, 11, T('16:30')).rules.includes('protected'));
  assert.ok(evaluate(4, 13, T('10:00')).rules.includes('window'));
});

// ------------------------------------------------------------------ scoring
test('every stated answer scores full marks', () => {
  const r = scoreAttempt(PERFECT);
  assert.equal(r.total, 100);
  for (const [k, v] of Object.entries(r.items)) assert.equal(v, KEYS[k].marks, k);
});

test('an empty attempt scores 0', () => assert.equal(scoreAttempt({}).total, 0));

test('slot credit rules', () => {
  assert.equal(slotCredit(1, '3@16:15'), 1);
  assert.equal(slotCredit(2, '5@15:00'), 0.85);
  assert.equal(slotCredit(1, '3@15:45'), 0.4);
  assert.equal(slotCredit(1, '3@14:30'), 0);
  assert.equal(slotCredit(1, '3@15:00'), 0);          // double booking
  assert.equal(slotCredit(3, '6@12:45'), 1);
  assert.equal(slotCredit(3, '6@14:30'), 0.85);
  assert.equal(slotCredit(4, '12@14:45'), 0.85);
  assert.equal(slotCredit(4, '9@11:15'), 0.4);        // full day only
  assert.equal(slotCredit(1, 'rubbish'), 0);
});

test('select all: credit per pick, minus half per wrong pick, floor 0', () => {
  assert.equal(item({ 's1.r1430': ['notice'] }, 's1.r1430'), 1);
  assert.equal(item({ 's1.r1430': ['notice', 'buffer', 'limit'] }, 's1.r1430'), 1.5);
  assert.equal(item({ 's1.r1430': ['limit', 'window'] }, 's1.r1430'), 0);
  assert.equal(item({ 's1.r1545': ['attendee', 'notice'] }, 's1.r1545'), 1);
});

test('classification is proportional', () => {
  const c = { ...PERFECT['s3.classify'], client: 'hard', mornings: 'hard' };
  assert.equal(item({ 's3.classify': c }, 's3.classify'), Math.round(5 * 5 / 7 * 100) / 100);
});

test('templates and statuses follow the credit rules', () => {
  const k = (id) => item({ 's1.confirm': id }, 's1.confirm');
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map(k), [3, 1.5, 1.5, 0, 0]);
  assert.equal(item({ 's4.status': 'rebooked' }, 's4.status'), 1.2);
  assert.equal(item({ 's4.status': 'noshow' }, 's4.status'), 0);
  assert.equal(item({ 's4.outcome': 'serve' }, 's4.outcome'), 1);
  for (const o of ['buffer', 'delay', 'noshow']) assert.equal(item({ 's4.outcome': o }, 's4.outcome'), 0);
  assert.equal(item({ 's1.rec.status': 'pending' }, 's1.rec.status'), 0.25);
  assert.equal(item({ 's2.record': 'recreate' }, 's2.record'), 1.2);
});

test('waiting list deadline: only replies due before the 24 hour mark score', () => {
  for (const d of ['10:15', '10:30', '10:45']) assert.equal(item({ 's2.wl.deadline': d }, 's2.wl.deadline'), 1);
  for (const d of ['11:15', '11:30', '12:00']) assert.equal(item({ 's2.wl.deadline': d }, 's2.wl.deadline'), 0);
});

test('record fields are checked against the learner’s own slot', () => {
  const r = scoreAttempt({ ...PERFECT, 's1.slot': '3@15:45', 's1.rec.start': '15:45', 's1.rec.end': '16:15' });
  assert.equal(r.items['s1.rec.start'], 0.5);
  assert.equal(r.items['s1.rec.end'], 0.5);
  const bad = scoreAttempt({ ...PERFECT, 's1.rec.date': '4' });
  assert.equal(bad.items['s1.rec.date'], 0);
});

test('final checks follow the real state of the calendar', () => {
  assert.deepEqual(finalDefects(PERFECT), { conflicts: false, resources: false, reminders: false, records: false });
  const bad = { ...PERFECT, 's1.slot': '3@15:45', 's2.reminders': ['new24', 'new2'], 's2.record': 'new' };
  const d = finalDefects(bad);
  assert.equal(d.resources, true); assert.equal(d.reminders, true); assert.equal(d.records, true);
  const right = { conflicts: 'no', resources: 'yes', reminders: 'yes', records: 'yes' };
  assert.equal(scoreAttempt({ ...bad, 's4.checks': right }).items['s4.checks'], 1);
  assert.equal(scoreAttempt({ ...bad, 's4.checks': { conflicts: 'no', resources: 'no', reminders: 'no', records: 'no' } }).items['s4.checks'], 0.25);
});

test('sanitize drops unknown keys and options', () => {
  const s = sanitize({ 's1.view': 'day', 's1.window': 'zzz', hack: 'x', 's1.slot': '3@16:15', 's2.slot': '9@10:00', 's1.notes': ['purpose', 'nope', 'purpose'] });
  assert.deepEqual(s, { 's1.view': 'day', 's1.slot': '3@16:15', 's1.notes': ['purpose'] });
});

// ------------------------------------------------------------------ page content
test('message templates use only known tokens and every option has wording', () => {
  for (const [key, set] of Object.entries(TEMPLATES)) {
    const ids = FIELDS[key].options.map((x) => x.id).sort();
    assert.deepEqual(Object.keys(set).sort(), ids, key);
    for (const text of Object.values(set)) for (const t of text.match(/\{\w+\}/g) || []) assert.ok(['{day}', '{start}', '{end}', '{nyStart}', '{nyEnd}'].includes(t), t);
  }
});

test('page text follows the Build rules: no dashes, no hyphens in words, ize spelling', () => {
  const texts = [];
  const walk = (v, key = '') => {
    if (typeof v === 'string') { if (!['id', 'key', 'kind', 'channel', 'slotKey', 'type'].includes(key)) texts.push(v); }
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
  };
  walk(STAGES); walk(MEMO); walk(HELP); walk(TEMPLATES);
  for (const e of EVENTS) walk([e.title, e.sub].filter(Boolean));
  for (const t of texts) {
    assert.ok(!/[–—]/.test(t), 'dash: ' + t);
    assert.ok(!/[A-Za-z]-[A-Za-z]/.test(t), 'hyphen: ' + t);
    assert.ok(!/\b(organis|recognis|analys[ei]|programme|minimis|authoris)/i.test(t), 'spelling: ' + t);
  }
});

// ------------------------------------------------------------------ attempts
const base = { name: 'Ada Obi', email: 'Ada.Obi@Example.com', device: 'device-aaaaaaaa' };
const forms = () => { const rows = []; return { rows, post: async (r) => { rows.push(r); } }; };

test('login shows the next attempt and does not count it until Start shift', async () => {
  const s = memStore();
  const a = await handleStart(s, base);
  assert.equal(a.body.status, 'ready'); assert.equal(a.body.next, 1); assert.equal(learner(s).attempts.length, 0);
  const b = await handleStart(s, { ...base, begin: true });
  assert.equal(b.body.status, 'open'); assert.equal(b.body.state.attempt, 1); assert.equal(b.body.state.stage, 1);
});

test('three attempts per learner, then none', async () => {
  const s = memStore(); const f = forms();
  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    const st = await handleStart(s, { ...base, begin: true });
    assert.equal(st.body.state.attempt, n);
    const r = await handleSubmit(s, { ...base, attempt: n, answers: PERFECT }, f.post);
    assert.equal(r.body.used, n);
  }
  const done = await handleStart(s, { ...base, begin: true });
  assert.equal(done.body.status, 'exhausted');
});

test('Forms gets a new row only when the best score goes up, so the last row is the highest', async () => {
  const s = memStore(); const f = forms();
  const run = async (n, answers) => { await handleStart(s, { ...base, begin: true }); await handleSubmit(s, { ...base, attempt: n, answers }, f.post); };
  await run(1, { 's1.view': 'day', 's1.window': 'w1430' });   // 6
  await run(2, {});                                            // 0, lower: no row
  await run(3, PERFECT);                                       // 100, higher: new row
  assert.deepEqual(f.rows.map((r) => r.score), ['6', '100']);
  assert.equal(learner(s).best, 100);
});

test('an equal score is not posted again', async () => {
  const s = memStore(); const f = forms();
  for (let n = 1; n <= 2; n++) { await handleStart(s, { ...base, begin: true }); await handleSubmit(s, { ...base, attempt: n, answers: PERFECT }, f.post); }
  assert.equal(f.rows.length, 1);
});

test('a failed Forms post is retried by the next submit that holds the best score', async () => {
  const s = memStore(); const f = forms();
  await handleStart(s, { ...base, begin: true });
  await handleSubmit(s, { ...base, attempt: 1, answers: PERFECT }, async () => { throw new Error('Forms 500'); });
  await handleStart(s, { ...base, begin: true });
  await handleSubmit(s, { ...base, attempt: 2, answers: { 's1.view': 'day' } }, f.post);
  assert.deepEqual(f.rows.map((r) => r.score), ['100']);
});

test('Forms rows hold name, email and score only', async () => {
  const s = memStore(); const f = forms();
  await handleStart(s, { ...base, begin: true });
  await handleSubmit(s, { ...base, attempt: 1, answers: PERFECT }, f.post);
  assert.deepEqual(f.rows[0], { name: 'Ada Obi', email: 'ada.obi@example.com', score: '100' });
});

test('the attempt record keeps every answer and item mark', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  await handleSubmit(s, { ...base, attempt: 1, answers: PERFECT }, forms().post);
  const rec = learner(s);
  assert.equal(rec.attempts[0].total, 100);
  assert.equal(rec.attempts[0].items['s1.slot'], 7);
  assert.equal(rec.attempts[0].answers['s1.slot'], '3@16:15');
  assert.equal(rec.attempts[0].formStatus, 'sent');
  assert.equal(rec.best, 100);
});

test('a failed Forms post still scores and stores the attempt', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  const r = await handleSubmit(s, { ...base, attempt: 1, answers: PERFECT }, async () => { throw new Error('Forms 500'); });
  assert.equal(r.body.ok, true);
  const rec = learner(s);
  assert.match(rec.attempts[0].formStatus, /failed/);
  assert.equal(rec.attempts[0].total, 100);
});

test('submitting twice does not score or log twice', async () => {
  const s = memStore(); const f = forms();
  await handleStart(s, { ...base, begin: true });
  await handleSubmit(s, { ...base, attempt: 1, answers: PERFECT }, f.post);
  const again = await handleSubmit(s, { ...base, attempt: 1, answers: {} }, f.post);
  assert.equal(again.body.already, true); assert.equal(f.rows.length, 1);
});

test('early submit scores what is answered', async () => {
  const s = memStore(); const f = forms();
  await handleStart(s, { ...base, begin: true });
  await handleSubmit(s, { ...base, attempt: 1, answers: { 's1.view': 'day', 's1.window': 'w1430' } }, f.post);
  assert.equal(f.rows[0].score, '6');
});

test('resume across devices: newest device takes over, the old one is refused', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  await handleSave(s, { ...base, attempt: 1, rev: 1, stage: 1, answers: { 's1.view': 'day' } });
  const other = { ...base, device: 'device-bbbbbbbb' };
  const back = await handleStart(s, other);
  assert.equal(back.body.status, 'open'); assert.equal(back.body.state.answers['s1.view'], 'day'); assert.equal(back.body.state.rev, 1);
  const stale = await handleSave(s, { ...base, attempt: 1, rev: 2, stage: 1, answers: { 's1.view': 'month' } });
  assert.equal(stale.code, 409); assert.equal(stale.body.error, 'taken');
  const ok = await handleSave(s, { ...other, attempt: 1, rev: 2, stage: 1, answers: { 's1.view': 'week' } });
  assert.equal(ok.body.ok, true);
});

test('start tells the browser when it took the attempt from another device', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  const same = await handleStart(s, base);
  assert.equal(same.body.took, undefined);
  const other = await handleStart(s, { ...base, device: 'device-bbbbbbbb' });
  assert.equal(other.body.took, true);
  const again = await handleStart(s, { ...base, device: 'device-bbbbbbbb' });
  assert.equal(again.body.took, undefined);
});

test('an older save never overwrites a newer one', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  await handleSave(s, { ...base, attempt: 1, rev: 5, stage: 1, answers: { 's1.view': 'day' } });
  const late = await handleSave(s, { ...base, attempt: 1, rev: 3, stage: 1, answers: { 's1.view': 'month' } });
  assert.equal(late.body.ignored, true);
  const st = await handleStart(s, base);
  assert.equal(st.body.state.answers['s1.view'], 'day');
});

test('stages lock at Continue and move one step at a time', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  await handleSave(s, { ...base, attempt: 1, rev: 1, stage: 1, answers: { 's1.view': 'day' } });
  const skip = await handleSave(s, { ...base, attempt: 1, rev: 2, stage: 3, answers: { 's1.view': 'day' } });
  assert.equal(skip.body.stage, 2);
  await handleSave(s, { ...base, attempt: 1, rev: 3, stage: 2, answers: { 's1.view': 'month', 's2.recur': 'one' } });
  const st = await handleStart(s, base);
  assert.equal(st.body.state.answers['s1.view'], 'day');
  assert.equal(st.body.state.answers['s2.recur'], 'one');
});

test('log out and submit are one action: a half finished attempt is scored and closes', async () => {
  const s = memStore(); const f = forms();
  await handleStart(s, { ...base, begin: true });
  await handleSave(s, { ...base, attempt: 1, rev: 1, stage: 1, answers: { 's1.view': 'day' } });
  const r = await handleSubmit(s, { ...base, attempt: 1, rev: 1, answers: { 's1.view': 'day', 's1.window': 'w1430' } }, f.post);
  assert.equal(r.body.used, 1);
  assert.equal(learner(s).attempts[0].status, 'submitted');
  const late = await handleSave(s, { ...base, attempt: 1, rev: 9, stage: 1, answers: { 's1.view': 'month' } });
  assert.equal(late.code, 409); assert.equal(late.body.error, 'closed');
  assert.equal(learner(s).attempts[0].answers['s1.view'], 'day');
});

test('reset clears the attempt, uses no attempt, and works once', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  await handleSave(s, { ...base, attempt: 1, rev: 1, stage: 1, answers: { 's1.view': 'day', 's1.window': 'w1430' } });
  const r = await handleReset(s, { ...base, attempt: 1, rev: 1 });
  assert.equal(r.code, 200); assert.deepEqual(r.body.state.answers, {}); assert.equal(r.body.state.stage, 1);
  assert.equal(r.body.state.reset, true); assert.ok(r.body.state.rev > 1);
  assert.equal(learner(s).attempts.length, 1);
  assert.deepEqual(learner(s).attempts[0].answers, {});
  const again = await handleReset(s, { ...base, attempt: 1, rev: r.body.state.rev });
  assert.equal(again.code, 409); assert.equal(again.body.error, 'used');
  // a save that was already in flight before the reset is ignored
  const stale = await handleSave(s, { ...base, attempt: 1, rev: 1, stage: 1, answers: { 's1.view': 'month' } });
  assert.equal(stale.body.ignored, true);
  assert.deepEqual(learner(s).attempts[0].answers, {});
  const back = await handleStart(s, base);
  assert.equal(back.body.state.reset, true);
});

test('reset is refused from an older device and after submit', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  await handleStart(s, { ...base, device: 'device-bbbbbbbb' });
  assert.equal((await handleReset(s, { ...base, attempt: 1, rev: 1 })).body.error, 'taken');
  await handleSubmit(s, { ...base, device: 'device-bbbbbbbb', attempt: 1, answers: {} }, forms().post);
  assert.equal((await handleReset(s, { ...base, device: 'device-bbbbbbbb', attempt: 1, rev: 1 })).body.error, 'closed');
});

test('name and email are fixed once registered', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  // same name, different case, order and punctuation: same learner
  const a = await handleStart(s, { ...base, name: 'OBI, ada' });
  assert.equal(a.body.status, 'open'); assert.equal(a.body.name, 'Ada Obi');
  // same name, new email: linked to the same learner and attempts
  const b = await handleStart(s, { ...base, email: 'ada.second@example.com', device: 'device-cccccccc' });
  assert.equal(b.body.status, 'open'); assert.equal(b.body.name, 'Ada Obi'); assert.equal(b.body.used, 1);
  assert.deepEqual(learner(s).emails, ['ada.obi@example.com', 'ada.second@example.com']);
  assert.equal(learners(s).length, 1);
  // saving and submitting work with the linked email
  assert.equal((await handleSave(s, { ...base, email: 'ada.second@example.com', device: 'device-cccccccc', attempt: 1, rev: 1, stage: 1, answers: { 's1.view': 'day' } })).body.ok, true);
  // same email, different spelling of the name: same learner, first spelling kept
  const c = await handleStart(s, { ...base, name: 'Adaobi' });
  assert.equal(c.body.name, 'Ada Obi'); assert.equal(learners(s).length, 1);
});

test('an email that belongs to another learner is refused', async () => {
  const s = memStore();
  await handleStart(s, { ...base, begin: true });
  await handleStart(s, { name: 'Tunde Bello', email: 'tunde@example.com', device: 'device-dddddddd', begin: true });
  const clash = await handleStart(s, { name: 'Tunde Bello', email: base.email, device: 'device-dddddddd' });
  assert.equal(clash.code, 409); assert.match(clash.body.error, /another learner/);
  const other = await handleStart(s, { name: 'Someone Else', email: base.email, device: 'device-eeeeeeee' });
  assert.equal(other.body.name, 'Ada Obi');
  assert.equal(learners(s).length, 2);
});

test('two submits at once record and post one result', async () => {
  const s = memStore(); const f = forms();
  await handleStart(s, { ...base, begin: true });
  await Promise.all([1, 2, 3].map(() => handleSubmit(s, { ...base, attempt: 1, answers: PERFECT }, f.post)));
  assert.equal(f.rows.length, 1); assert.equal(learner(s).attempts.length, 1);
});

test('the Blobs wrapper re-runs a change when another writer wins the race', async () => {
  // Fake of the Blobs calls the wrapper uses: etags, onlyIfMatch, onlyIfNew.
  const data = new Map(); let n = 0; let rival = null;
  const fake = {
    async getWithMetadata(k) { const e = data.get(k); const out = e ? { data: structuredClone(e.v), etag: e.etag } : null; if (rival) { const r = rival; rival = null; await r(); } return out; },
    async get(k) { const e = data.get(k); return e ? structuredClone(e.v) : null; },
    async setJSON(k, v, o = {}) {
      const e = data.get(k);
      if (o.onlyIfNew && e) return { modified: false };
      if (o.onlyIfMatch && (!e || e.etag !== o.onlyIfMatch)) return { modified: false };
      data.set(k, { v: structuredClone(v), etag: 'e' + (++n) }); return { modified: true, etag: 'e' + n };
    },
  };
  const st = wrap(fake);
  assert.equal(await st.add('k', { list: [] }), true);
  assert.equal(await st.add('k', { list: ['x'] }), false);
  let runs = 0;
  rival = () => st.update('k', (r) => { r.list.push('rival'); return { rec: r, out: 1 }; });
  await st.update('k', (r) => { runs++; r.list.push('mine'); return { rec: r, out: 1 }; });
  assert.equal(runs, 2);
  assert.deepEqual((await st.get('k')).list, ['rival', 'mine']);
  assert.equal(await st.update('k', () => ({ rec: null, out: 'read only' })), 'read only');
});

test('bad input is refused', async () => {
  const s = memStore();
  assert.equal((await handleStart(s, { name: 'A', email: 'nope', device: 'device-aaaaaaaa' })).code, 400);
  assert.equal((await handleStart(s, { name: '', email: 'a@b.co', device: 'device-aaaaaaaa' })).code, 400);
  assert.equal((await handleSave(s, { ...base, attempt: 1, rev: 1, answers: {} })).code, 404);
});

// ------------------------------------------------------------------ runner
async function runTests() {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + String(e.message).split('\n').join('\n     ')); }
  }
  console.log(`\n${tests.length - failed} of ${tests.length} passed`);
  process.exit(failed ? 1 : 0);
}

// ------------------------------------------------------------------ dev server
async function serve(port) {
  const store = memStore(); const rows = [];
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
  const post = async (r) => { rows.push(r); console.log('FORM ROW', JSON.stringify(r)); };
  http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      let text = ''; for await (const c of req) text += c;
      const body = JSON.parse(text || '{}');
      const fn = { '/api/start': () => handleStart(store, body), '/api/save': () => handleSave(store, body), '/api/submit': () => handleSubmit(store, body, post), '/api/reset': () => handleReset(store, body) }[url.pathname];
      const out = fn ? await fn() : { code: 404, body: {} };
      res.writeHead(out.code, { 'content-type': 'application/json' }); res.end(JSON.stringify(out.body)); return;
    }
    const path = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
    try { const data = await readFile(join(ROOT, path)); res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream', 'content-security-policy': CSP }); res.end(data); }
    catch { res.writeHead(404); res.end('Not found'); }
  }).listen(port, () => console.log('Dev server on http://localhost:' + port));
}

if (process.argv[2] === 'serve') serve(Number(process.argv[3]) || 8080);
else await runTests();
