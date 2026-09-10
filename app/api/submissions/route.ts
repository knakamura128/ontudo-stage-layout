import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { readSession } from "@/app/lib/google-auth";

type SubmissionRow = { id: number; owner_email: string; school_name: string; program_name: string; performer_total: number; status: "draft" | "submitted"; payload: string; updated_at: string; submitted_at: string | null; deleted_at: string | null };
let schemaReady: Promise<void> | null = null;

function database() {
  const db = (env as { DB?: D1Database }).DB;
  if (!db) throw new Error("申請管理の保存先を準備しています。少し時間をおいて再度お試しください。");
  return db;
}

async function ensureSchema(db: D1Database) {
  schemaReady ??= (async () => {
    await db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_email TEXT NOT NULL UNIQUE, school_name TEXT NOT NULL, program_name TEXT NOT NULL, performer_total INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', payload TEXT NOT NULL, updated_at TEXT NOT NULL, submitted_at TEXT, deleted_at TEXT)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_submissions_status_updated_at ON submissions(status, updated_at DESC)"),
      db.prepare("CREATE TABLE IF NOT EXISTS submission_revisions (id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id INTEGER NOT NULL, school_name TEXT NOT NULL, program_name TEXT NOT NULL, performer_total INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', payload TEXT NOT NULL, created_at TEXT NOT NULL)"),
      db.prepare("CREATE INDEX IF NOT EXISTS idx_submission_revisions_submission_id_created_at ON submission_revisions(submission_id, created_at DESC)"),
    ]);
  })();
  await schemaReady;
}

async function archiveSubmission(db: D1Database, submission: SubmissionRow, createdAt: string) {
  await db.prepare("INSERT INTO submission_revisions (submission_id, school_name, program_name, performer_total, status, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(submission.id, submission.school_name, submission.program_name, submission.performer_total, submission.status, submission.payload, createdAt).run();
}

export async function GET(request: Request) {
  try {
    const user = await readSession(request.headers.get("cookie"));
    if (!user || user.role !== "admin") return NextResponse.json({ error: "管理者としてログインしてください。" }, { status: 403 });
    const db = database();
    await ensureSchema(db);
    const result = await db.prepare("SELECT id, owner_email, school_name, program_name, performer_total, status, updated_at, submitted_at, payload FROM submissions WHERE deleted_at IS NULL ORDER BY CASE status WHEN 'submitted' THEN 0 ELSE 1 END, updated_at DESC").all<SubmissionRow>();
    return NextResponse.json({ submissions: result.results ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "申請一覧を取得できませんでした。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await readSession(request.headers.get("cookie"));
    const body = await request.json() as { schoolName?: string; programName?: string; performerTotal?: number; payload?: unknown; submit?: boolean; submissionKey?: string; submissionId?: number };
    if (!body.schoolName?.trim() || !body.programName?.trim()) return NextResponse.json({ error: "学校名と演目を入力してください。" }, { status: 400 });
    const db = database();
    await ensureSchema(db);
    const now = new Date().toISOString();
    const status = body.submit ? "submitted" : "draft";
    const submissionId = Number(body.submissionId);
    if (user?.role === "admin" && Number.isSafeInteger(submissionId) && submissionId > 0) {
      const previous = await db.prepare("SELECT id, owner_email, school_name, program_name, performer_total, status, payload, updated_at, submitted_at, deleted_at FROM submissions WHERE id = ? AND deleted_at IS NULL").bind(submissionId).first<SubmissionRow>();
      if (!previous) return NextResponse.json({ error: "更新対象の申請が見つかりません。" }, { status: 404 });
      await archiveSubmission(db, previous, now);
      const result = await db.prepare("UPDATE submissions SET school_name = ?, program_name = ?, performer_total = ?, status = ?, payload = ?, updated_at = ?, submitted_at = ? WHERE id = ?")
        .bind(body.schoolName.trim(), body.programName.trim(), Math.max(0, Number(body.performerTotal) || 0), status, JSON.stringify(body.payload ?? {}), now, body.submit ? now : null, submissionId).run();
      if (!result.meta.changes) return NextResponse.json({ error: "申請を更新できませんでした。" }, { status: 500 });
      return NextResponse.json({ ok: true, id: submissionId, status, updatedAt: now });
    }
    const providedKey = body.submissionKey?.trim();
    const guestKey = providedKey && /^[A-Za-z0-9_-]{10,120}$/.test(providedKey) ? providedKey : crypto.randomUUID();
    const ownerKey = user?.role === "admin" ? user.email : `guest:${guestKey}`;
    const previous = await db.prepare("SELECT id, owner_email, school_name, program_name, performer_total, status, payload, updated_at, submitted_at FROM submissions WHERE owner_email = ?").bind(ownerKey).first<SubmissionRow>();
    if (previous) await archiveSubmission(db, previous, now);
    await db.prepare("INSERT INTO submissions (owner_email, school_name, program_name, performer_total, status, payload, updated_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_email) DO UPDATE SET school_name = excluded.school_name, program_name = excluded.program_name, performer_total = excluded.performer_total, status = excluded.status, payload = excluded.payload, updated_at = excluded.updated_at, submitted_at = excluded.submitted_at")
      .bind(ownerKey, body.schoolName.trim(), body.programName.trim(), Math.max(0, Number(body.performerTotal) || 0), status, JSON.stringify(body.payload ?? {}), now, body.submit ? now : null).run();
    const saved = await db.prepare("SELECT id FROM submissions WHERE owner_email = ?").bind(ownerKey).first<{ id: number }>();
    return NextResponse.json({ ok: true, id: saved?.id, status, updatedAt: now });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "申請を保存できませんでした。" }, { status: 500 });
  }
}
