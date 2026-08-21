import { env } from "cloudflare:workers";

type Setting = { value: string };
type DriveTokenResponse = { access_token?: string; error_description?: string };

function database() {
  const db = (env as { DB?: D1Database }).DB;
  if (!db) throw new Error("Google Driveの連携先を準備しています。少し時間をおいて再度お試しください。");
  return db;
}

async function ensureSettings(db: D1Database) {
  await db.prepare("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)").run();
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function encryptionKey() {
  const secret = (env as { AUTH_SESSION_SECRET?: string }).AUTH_SESSION_SECRET;
  if (!secret) throw new Error("Drive連携の認証設定が完了していません。");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await encryptionKey(), new TextEncoder().encode(value));
  return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

async function decrypt(value: string) {
  const [ivValue, encryptedValue] = value.split(".");
  if (!ivValue || !encryptedValue) throw new Error("保存済みのGoogle Drive連携情報を確認できませんでした。");
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64Url(ivValue) }, await encryptionKey(), fromBase64Url(encryptedValue));
  return new TextDecoder().decode(decrypted);
}

async function readSetting(db: D1Database, key: string) {
  const setting = await db.prepare("SELECT value FROM app_settings WHERE key = ?").bind(key).first<Setting>();
  return setting?.value ?? null;
}

async function writeSetting(db: D1Database, key: string, value: string) {
  await db.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .bind(key, value, new Date().toISOString()).run();
}

export async function saveDriveConnection(refreshToken: string, email: string) {
  const db = database();
  await ensureSettings(db);
  await writeSetting(db, "google_drive_refresh_token", await encrypt(refreshToken));
  await writeSetting(db, "google_drive_email", email);
}

export async function getDriveConnection() {
  const db = database();
  await ensureSettings(db);
  const email = await readSetting(db, "google_drive_email");
  return { connected: Boolean(await readSetting(db, "google_drive_refresh_token")), email };
}

export async function getDriveAccessToken() {
  const db = database();
  await ensureSettings(db);
  const encryptedToken = await readSetting(db, "google_drive_refresh_token");
  if (!encryptedToken) throw new Error("管理者ページでGoogle Driveを連携してください。");
  const runtime = env as { GOOGLE_DRIVE_OAUTH_CLIENT_ID?: string; GOOGLE_DRIVE_OAUTH_CLIENT_SECRET?: string };
  if (!runtime.GOOGLE_DRIVE_OAUTH_CLIENT_ID || !runtime.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET) throw new Error("Google Drive連携の認証設定が完了していません。");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: runtime.GOOGLE_DRIVE_OAUTH_CLIENT_ID, client_secret: runtime.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET, refresh_token: await decrypt(encryptedToken), grant_type: "refresh_token" }) });
  const token = await response.json() as DriveTokenResponse;
  if (!response.ok || !token.access_token) throw new Error(token.error_description || "Google Driveとの連携を更新できませんでした。管理者ページから再連携してください。");
  return token.access_token;
}
