import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { readSession } from "@/app/lib/google-auth";

type SubmissionRow = { id: number; owner_email: string; school_name: string; program_name: string; status: "draft" | "submitted"; drive_file_id: string | null };
type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

const driveScope = "https://www.googleapis.com/auth/drive.file";

function database() {
  const db = (env as { DB?: D1Database }).DB;
  if (!db) throw new Error("申請管理の保存先を準備しています。少し時間をおいて再度お試しください。");
  return db;
}

function base64Url(value: string | ArrayBuffer) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64(value: string) {
  const normalized = value.replace(/\s/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) throw new Error("PDFデータを確認できませんでした。");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 70) || "未入力";
}

async function driveToken(credentials: ServiceAccount) {
  const pem = credentials.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const privateKey = decodeBase64(pem);
  const key = await crypto.subtle.importKey("pkcs8", privateKey.buffer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const tokenUri = credentials.token_uri ?? "https://oauth2.googleapis.com/token";
  const issuedAt = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({ iss: credentials.client_email, scope: driveScope, aud: tokenUri, iat: issuedAt, exp: issuedAt + 3600 }))}`;
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(unsigned));
  const response = await fetch(tokenUri, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64Url(signature)}` }) });
  const result = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "Google Driveへの接続に失敗しました。");
  return result.access_token;
}

async function createDriveFile(accessToken: string, folderId: string, fileName: string, pdf: Uint8Array) {
  const boundary = `stage-layout-${crypto.randomUUID()}`;
  const prefix = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: fileName, mimeType: "application/pdf", parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
  const suffix = `\r\n--${boundary}--`;
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body: new Blob([prefix, pdf, suffix]) });
  const result = await response.json() as { id?: string; webViewLink?: string; error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error(result.error?.message || "Google DriveへPDFを保存できませんでした。");
  return result;
}

async function replaceDriveFile(accessToken: string, fileId: string, pdf: Uint8Array) {
  const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,webViewLink`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/pdf" }, body: pdf });
  const result = await response.json() as { id?: string; webViewLink?: string; error?: { message?: string } };
  if (!response.ok || !result.id) throw new Error(result.error?.message || "Google Drive上のPDFを更新できませんでした。");
  return result;
}

export async function POST(request: Request) {
  try {
    const user = await readSession(request.headers.get("cookie"));
    const body = await request.json() as { submissionId?: number; submissionKey?: string; pdfBase64?: string };
    const submissionId = Number(body.submissionId);
    if (!Number.isSafeInteger(submissionId) || submissionId <= 0) return NextResponse.json({ error: "提出内容を確認できませんでした。" }, { status: 400 });
    const db = database();
    const row = await db.prepare("SELECT id, owner_email, school_name, program_name, status, drive_file_id FROM submissions WHERE id = ?").bind(submissionId).first<SubmissionRow>();
    if (!row || row.status !== "submitted") return NextResponse.json({ error: "提出済みの申請が見つかりません。" }, { status: 404 });
    const submissionKey = body.submissionKey?.trim() ?? "";
    const allowed = user?.role === "admin" || (submissionKey.length >= 10 && row.owner_email === `guest:${submissionKey}`);
    if (!allowed) return NextResponse.json({ error: "この申請を保存する権限がありません。" }, { status: 403 });
    const pdf = decodeBase64(body.pdfBase64 ?? "");
    if (pdf.length > 8 * 1024 * 1024) return NextResponse.json({ error: "PDFの容量が大きすぎます。" }, { status: 413 });
    const runtime = env as { GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?: string; GOOGLE_DRIVE_FOLDER_ID?: string };
    if (!runtime.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON || !runtime.GOOGLE_DRIVE_FOLDER_ID) throw new Error("Google Driveの保存設定が完了していません。");
    const credentials = JSON.parse(runtime.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
    if (!credentials.client_email || !credentials.private_key) throw new Error("Google Driveの認証情報を確認できませんでした。");
    const accessToken = await driveToken(credentials);
    const fileName = `舞台設営・備品配置資料_${safeFileName(row.school_name)}_${safeFileName(row.program_name)}.pdf`;
    let file = row.drive_file_id ? await replaceDriveFile(accessToken, row.drive_file_id, pdf).catch(() => null) : null;
    if (!file) file = await createDriveFile(accessToken, runtime.GOOGLE_DRIVE_FOLDER_ID, fileName, pdf);
    const savedAt = new Date().toISOString();
    await db.prepare("UPDATE submissions SET drive_file_id = ?, drive_file_url = ?, drive_saved_at = ? WHERE id = ?").bind(file.id, file.webViewLink ?? null, savedAt, row.id).run();
    return NextResponse.json({ ok: true, fileUrl: file.webViewLink ?? null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google DriveへPDFを保存できませんでした。" }, { status: 500 });
  }
}
