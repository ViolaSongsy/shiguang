import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db, initDb } from "@/lib/db";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "afterthought_session";
const SESSION_DAYS = 30;

export type AppUser = { id: string; email: string };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function updatePassword(userId: string, password: string) {
  await initDb();
  await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(password), userId);
  await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(hash, "hex");
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

export async function createSession(userId: string) {
  await initDb();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(randomUUID(), userId, hashToken(token), expires.toISOString(), now.toISOString());
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession() {
  await initDb();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  cookieStore.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", expires: new Date(0) });
}

export async function getCurrentUser(): Promise<AppUser | null> {
  await initDb();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await db.prepare(`
    SELECT users.id, users.email
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get<AppUser>(hashToken(token), new Date().toISOString());
  return row ?? null;
}
