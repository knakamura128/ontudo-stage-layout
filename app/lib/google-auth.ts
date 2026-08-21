import { env } from "cloudflare:workers";

export type AppUser = {
  email: string;
  name: string;
  role: "admin" | "viewer";
};

type GoogleTokenHeader = { alg?: string; kid?: string };
type GoogleTokenPayload = {
  aud?: string | string[];
  email?: string;
  email_verified?: boolean | string;
  exp?: number;
  iss?: string;
  name?: string;
};

const GOOGLE_CLIENT_ID = "395301319192-sr44o695g8se9vkklp2485rb15jqpum2.apps.googleusercontent.com";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const SESSION_COOKIE = "music_stage_session";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 8;

function base64UrlToBytes(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + padding;
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function bytesToBase64Url(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(value))) as T;
}

function sessionSecret() {
  const secret = (env as { AUTH_SESSION_SECRET?: string }).AUTH_SESSION_SECRET;
  if (!secret) throw new Error("認証設定がまだ完了していません。");
  return secret;
}

function adminEmails() {
  const configured = (env as { ADMIN_EMAILS?: string }).ADMIN_EMAILS ?? "";
  return new Set(configured.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function createSignedValue(value: string) {
  return `${value}.${bytesToBase64Url(await hmac(value))}`;
}

export async function verifySignedValue(value: string, expected: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || payload !== expected) return false;
  const actual = bytesToBase64Url(await hmac(payload));
  if (actual.length !== signature.length) return false;
  let different = 0;
  for (let index = 0; index < actual.length; index += 1) different |= actual.charCodeAt(index) ^ signature.charCodeAt(index);
  return different === 0;
}

export async function verifyGoogleCredential(credential: string): Promise<AppUser> {
  const parts = credential.split(".");
  if (parts.length !== 3) throw new Error("Googleの認証情報が不正です。");

  const header = decodeJson<GoogleTokenHeader>(parts[0]);
  const payload = decodeJson<GoogleTokenPayload>(parts[1]);
  if (!header.kid || header.alg !== "RS256") throw new Error("Googleの認証情報を確認できません。");

  const keyResponse = await fetch(GOOGLE_JWKS_URL);
  if (!keyResponse.ok) throw new Error("Googleの認証情報を確認できません。");
  const keys = await keyResponse.json() as { keys?: JsonWebKey[] };
  const jwk = keys.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Googleの認証鍵が見つかりません。もう一度ログインしてください。");

  const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, base64UrlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const audienceMatches = Array.isArray(payload.aud) ? payload.aud.includes(GOOGLE_CLIENT_ID) : payload.aud === GOOGLE_CLIENT_ID;
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  const issuerMatches = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
  if (!verified || !audienceMatches || !issuerMatches || !emailVerified || !payload.email || !payload.exp || payload.exp * 1000 <= Date.now()) {
    throw new Error("Googleアカウントを確認できませんでした。");
  }

  const email = payload.email.toLowerCase();
  return { email, name: payload.name?.trim() || email, role: adminEmails().has(email) ? "admin" : "viewer" };
}

type SessionData = AppUser & { expiresAt: number };

export async function createSession(user: AppUser) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ ...user, expiresAt: Date.now() + SESSION_LIFETIME_SECONDS * 1000 } satisfies SessionData)));
  return `${payload}.${bytesToBase64Url(await hmac(payload))}`;
}

export async function readSession(cookieHeader: string | null): Promise<AppUser | null> {
  const value = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  try {
    const expected = bytesToBase64Url(await hmac(payload));
    if (expected.length !== signature.length) return null;
    let different = 0;
    for (let index = 0; index < expected.length; index += 1) different |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
    if (different !== 0) return null;
    const session = decodeJson<SessionData>(payload);
    if (!session.email || !session.name || !session.expiresAt || session.expiresAt <= Date.now()) return null;
    return { email: session.email, name: session.name, role: adminEmails().has(session.email.toLowerCase()) ? "admin" : "viewer" };
  } catch {
    return null;
  }
}

export const sessionCookie = SESSION_COOKIE;
export const sessionMaxAge = SESSION_LIFETIME_SECONDS;
