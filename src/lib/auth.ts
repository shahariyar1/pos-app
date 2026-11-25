/* Basic brute-force guard (per server instance). Use Redis/Upstash if you run many instances. */
const attempts = new Map<string, { count: number; resetAt: number }>();

export function tooManyAttempts(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 5;
}

export const clearAttempts = (key: string) => attempts.delete(key);
