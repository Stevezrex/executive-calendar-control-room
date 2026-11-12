import { handleSubmit } from '../lib/attempts.mjs';
import { run, store, formPoster } from '../lib/http.mjs';

export default async (req) => {
  const origin = new URL(req.url).origin;
  return run(req, (body) => handleSubmit(store(), body, formPoster(origin)));
};
export const config = { path: '/api/submit' };
