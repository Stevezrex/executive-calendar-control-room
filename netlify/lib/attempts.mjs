// Attempt handling. The store is injected so the same code runs on Netlify Blobs and in tests.
// Blobs: learner/<id> holds the learner and every attempt. name/<hash> and email/<hash> point to the learner.
import { createHash } from 'node:crypto';
import { MAX_ATTEMPTS } from '../../public/data.js';
import { sanitize, scoreAttempt, stageOfKey } from './scenario.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 40);

// Lowercase, no accents or punctuation, words sorted: "Obi, Ada" and "ada obi" are one name.
export const normName = (name) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
const nameKey = (name) => 'name/' + sha(normName(name));
const emailKey = (email) => 'email/' + sha(email);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function readIdentity(body) {
  const email = clean(body.email, 120).toLowerCase();
  const name = clean(body.name, 80);
  const device = clean(body.device, 64);
  if (!EMAIL.test(email)) return { error: 'Enter a valid email address.' };
  if (device.length < 8) return { error: 'Missing device.' };
  return { email, name, device };
}

const view = (rec) => ({ used: rec.attempts.length, max: MAX_ATTEMPTS, open: rec.attempts.find((a) => a.status === 'open') });
const stateOf = (att) => ({ attempt: att.n, stage: att.stage, answers: att.answers, rev: att.rev, reset: !!att.resetUsed });
const find = (rec, body) => rec && rec.attempts.find((a) => a.n === Number(body.attempt));
const fail = (code, error) => ({ rec: null, out: { code, body: { error } } });

// The first name and email a learner uses are fixed. A new email under the same name, or a new
// spelling under the same email, is linked to that learner. An email that belongs to someone else is refused.
async function register(store, id, now) {
  const nk = nameKey(id.name);
  const ek = emailKey(id.email);
  const [n, e] = await Promise.all([store.get(nk), store.get(ek)]);
  if (n && e && n.learner !== e.learner) {
    return { error: 'This email is registered to another learner. Use the name and email you first registered.' };
  }
  let lid = (n && n.learner) || (e && e.learner);
  const isNew = !lid;
  if (isNew) {
    lid = 'learner/' + sha(normName(id.name));
    await store.add(lid, { name: id.name, email: id.email, emails: [id.email], created: now.toISOString(), attempts: [] });
  }
  if (!n) await store.add(nk, { learner: lid });
  if (!e) {
    await store.add(ek, { learner: lid });
    if (!isNew) {
      await store.update(lid, (rec) => {
        if (!rec) return null;
        if (!rec.emails.includes(id.email)) rec.emails.push(id.email);
        return { rec, out: true };
      });
    }
  }
  return { lid };
}

const learnerOf = async (store, email) => {
  const link = await store.get(emailKey(email));
  return link ? link.learner : null;
};

// Merge incoming answers into an attempt. Earlier stages are locked once the attempt has moved past them.
function merge(att, body) {
  const incoming = sanitize(body.answers);
  const merged = { ...att.answers };
  for (const [key, value] of Object.entries(incoming)) {
    if (stageOfKey(key) >= att.stage) merged[key] = value;
  }
  const want = Number(body.stage) || att.stage;
  const stage = Math.min(Math.max(want, att.stage), Math.min(att.stage + 1, 4));
  return { answers: merged, stage };
}

export async function handleStart(store, body, now = new Date()) {
  const id = readIdentity(body);
  if (id.error) return { code: 400, body: { error: id.error } };
  if (!normName(id.name)) return { code: 400, body: { error: 'Enter your name.' } };

  const reg = await register(store, id, now);
  if (reg.error) return { code: 409, body: { error: reg.error } };

  return store.update(reg.lid, (rec) => {
    const { used, open } = view(rec);
    if (open) {
      const out = { code: 200, body: { status: 'open', used, max: MAX_ATTEMPTS, name: rec.name, state: stateOf(open) } };
      if (open.device === id.device) return { rec: null, out };
      out.body.took = true; // another device held the attempt. The browser uses this to judge its saved copy.
      open.device = id.device;
      open.takenAt = now.toISOString();
      return { rec, out };
    }
    if (used >= MAX_ATTEMPTS) return { rec: null, out: { code: 200, body: { status: 'exhausted', used, max: MAX_ATTEMPTS, name: rec.name } } };
    if (!body.begin) return { rec: null, out: { code: 200, body: { status: 'ready', used, max: MAX_ATTEMPTS, next: used + 1, name: rec.name } } };

    const att = { n: used + 1, status: 'open', startedAt: now.toISOString(), device: id.device, rev: 0, stage: 1, answers: {} };
    rec.attempts.push(att);
    return { rec, out: { code: 200, body: { status: 'open', used: used + 1, max: MAX_ATTEMPTS, name: rec.name, state: stateOf(att) } } };
  });
}

export async function handleSave(store, body, now = new Date()) {
  const id = readIdentity(body);
  if (id.error) return { code: 400, body: { error: id.error } };
  const lid = await learnerOf(store, id.email);
  if (!lid) return { code: 404, body: { error: 'No such attempt.' } };

  return store.update(lid, (rec) => {
    const att = find(rec, body);
    if (!att) return fail(404, 'No such attempt.');
    if (att.status !== 'open') return fail(409, 'closed');
    if (att.device !== id.device) return fail(409, 'taken');
    const rev = Number(body.rev);
    if (!Number.isInteger(rev) || rev <= att.rev) return { rec: null, out: { code: 200, body: { ok: true, rev: att.rev, ignored: true } } };

    const m = merge(att, body);
    att.answers = m.answers;
    att.stage = m.stage;
    att.rev = rev;
    att.savedAt = now.toISOString();
    return { rec, out: { code: 200, body: { ok: true, rev, stage: att.stage } } };
  });
}

// Reset clears the open attempt and starts it again. Nothing is kept and no attempt is used. Once per attempt.
export async function handleReset(store, body) {
  const id = readIdentity(body);
  if (id.error) return { code: 400, body: { error: id.error } };
  const lid = await learnerOf(store, id.email);
  if (!lid) return { code: 404, body: { error: 'No such attempt.' } };

  return store.update(lid, (rec) => {
    const att = find(rec, body);
    if (!att) return fail(404, 'No such attempt.');
    if (att.status !== 'open') return fail(409, 'closed');
    if (att.device !== id.device) return fail(409, 'taken');
    if (att.resetUsed) return fail(409, 'used');
    att.resetUsed = true;
    att.answers = {};
    att.stage = 1;
    att.rev = Math.max(att.rev, Number(body.rev) || 0) + 1; // a save still in flight from before the reset is ignored
    delete att.savedAt;
    return { rec, out: { code: 200, body: { ok: true, state: stateOf(att) } } };
  });
}

// Forms gets one row, name, email and score, and only when the learner's best score is higher than the last row sent.
// The last row for a learner is therefore always their highest. postForm is injected.
export async function handleSubmit(store, body, postForm, now = new Date()) {
  const id = readIdentity(body);
  if (id.error) return { code: 400, body: { error: id.error } };
  const lid = await learnerOf(store, id.email);
  if (!lid) return { code: 404, body: { error: 'No such attempt.' } };

  let row = null;
  const out = await store.update(lid, (rec) => {
    row = null;
    const att = find(rec, body);
    if (!att) return fail(404, 'No such attempt.');
    const used = rec.attempts.length;
    if (att.status === 'submitted') return { rec: null, out: { code: 200, body: { ok: true, used, max: MAX_ATTEMPTS, already: true } } };
    if (att.device !== id.device) return fail(409, 'taken');

    const m = merge(att, { answers: body.answers, stage: att.stage });
    att.answers = m.answers;
    att.rev = Math.max(att.rev, Number(body.rev) || 0);
    const result = scoreAttempt(att.answers);
    att.status = 'submitted';
    att.submittedAt = now.toISOString();
    att.total = result.total;
    att.items = result.items;
    rec.best = Math.max(rec.best || 0, result.total);
    if (rec.best > (rec.posted ?? -1)) {
      row = { name: rec.name, email: rec.email, score: String(rec.best) };
      att.formStatus = 'pending';
    } else {
      att.formStatus = 'not sent, not higher than the last row';
    }
    return { rec, out: { code: 200, body: { ok: true, used, max: MAX_ATTEMPTS } } };
  });

  if (row) {
    let status = 'sent';
    try {
      await postForm(row);
    } catch {
      try { await postForm(row); } catch (err) { status = 'failed: ' + String((err && err.message) || err).slice(0, 120); }
    }
    if (status !== 'sent') console.error('forms post', status);
    try {
      await store.update(lid, (rec) => {
        const att = find(rec, body);
        if (!att) return null;
        att.formStatus = status;
        if (status === 'sent') rec.posted = Math.max(rec.posted ?? -1, Number(row.score));
        return { rec, out: true };
      });
    } catch { /* the attempt is already recorded */ }
  }
  return out;
}
