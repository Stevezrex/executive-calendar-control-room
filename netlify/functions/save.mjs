import { handleSave } from '../lib/attempts.mjs';
import { run, store } from '../lib/http.mjs';

export default async (req) => run(req, (body) => handleSave(store(), body));
export const config = { path: '/api/save' };
