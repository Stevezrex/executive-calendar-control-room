// Shared wrapper for the functions: store, JSON in, JSON out.
import { getStore } from '@netlify/blobs';

// store.get(key)            read one record
// store.add(key, value)     write only if the key is new, returns true when it was written
// store.update(key, fn)     read, change, write. fn(record or null) returns { rec, out }.
//                           rec null means "no write". A clash with another writer re-runs fn.
export const wrap = (s) => {
  return {
    get: (key) => s.get(key, { type: 'json' }),
    async add(key, value) {
      const r = await s.setJSON(key, value, { onlyIfNew: true });
      return r.modified;
    },
    async update(key, fn) {
      for (let i = 0; i < 6; i++) {
        const cur = await s.getWithMetadata(key, { type: 'json' });
        const step = fn(cur ? cur.data : null);
        if (!step || step.rec === null) return step ? step.out : null;
        const r = await s.setJSON(key, step.rec, cur ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
        if (r.modified) return step.out;
      }
      throw new Error('busy');
    },
  };
};
export const store = () => wrap(getStore({ name: 'calendar-simulation', consistency: 'strong' }));

export async function readJson(req) {
  const text = await req.text();
  if (text.length > 60000) throw new Error('Too large');
  return JSON.parse(text || '{}');
}

export const reply = (code, body) => new Response(JSON.stringify(body), {
  status: code,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

// Posts one row to Netlify Forms. The hidden form in index.html lets Netlify detect it.
export const formPoster = (origin) => async (row) => {
  const res = await fetch(origin + '/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 'form-name': 'calendar-test', ...row }).toString(),
  });
  if (!res.ok && res.status !== 303) throw new Error('Forms ' + res.status);
};

export async function run(req, handler) {
  if (req.method !== 'POST') return reply(405, { error: 'Use POST.' });
  try {
    const body = await readJson(req);
    const out = await handler(body);
    return reply(out.code, out.body);
  } catch (err) {
    // One line in the Netlify function log: which call and why. No names or emails.
    console.error('call failed', new URL(req.url).pathname, String((err && err.message) || err).slice(0, 200));
    return reply(500, { error: 'Server error. Try again.' });
  }
}
