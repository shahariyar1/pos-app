import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const scrypt = (pw: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, len, (err, key) => (err ? reject(err) : resolve(key))));

/** salt:hash, both hex. Passwords are never stored as text. */
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await scrypt(password, Buffer.from(salt, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
