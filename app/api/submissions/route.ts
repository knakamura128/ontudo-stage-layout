import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { readSession } from "@/app/lib/google-auth";

type SubmissionRow = { id: number; owner_email: string; school_name: string; program_name: string; performer_total: number; status: "draft" | "submitted"; updated_at: string; submitted_at: string | null };
let schemaReady: Promise<void> | null = null;

function database() {
  const db = (env as { DB?: D1Database }).DB;
  if (!db) throw new Error("申請管理の保存先を準備しています。少し時間をおいて再度お試しください。");
  return db;
}

async function ensureSchema(db: D1Database) {
  schemaReady ??= db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_email TEXT NOT NULL UNIQUE, school_name TEXT NOT NULL, program_name TEXT NOT NULL, performer_total INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'draft', payload TEXT NOT NULL, updated_at TEXT NOT NULL, submitted_at TEXT)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_submissions_status_updated_at ON submissions(status, updated_at DESC)"),
  ]).then(() => undefined);
  await schemaReady;
}

export async function GET(request: Request) {
  try {
    const user = await readSession(request.headers.get("cookie"));
    if (!user || user.role !== "admin") return NextResponse.json({ error: "管理者としてログインしてください。" }, { status: 403 });
    const db = database();
    await ensureSchema(db);
    const result = await db.prepare("SELECT id, owner_email, school_name, program_name, performer_total, status, updated_at, submitted_at FROM submissions ORDER BY CASE status WHEN 'submitted' THEN 0 ELSE 1 END, updated_at DESC").all<SubmissionRow>();
    return NextResponse.json({ submissions: result.results ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "申請一覧を取得できませんでした。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await readSession(request.headers.get("cookie"));
    if (!user || user.role !== "admin") return NextResponse.json({ error: "管理者としてログインしてください。" }, { status: 403 });
    const body = await request.json() as { schoolName?: string; programName?: string; performerTotal?: number; payload?: unknown; submit?: boolean };
    if (!body.schoolName?.trim() || !body.programName?.trim()) return NextResponse.json({ error: "学校名と演目を入力してください。" }, { status: 400 });
    const db = database();
    await ensureSchema(db);
    const now = new Date().toISOString();
    const status = body.submit ? "submitted" : "draft";
    await db.prepare("INSERT INTO submissions (owner_email, school_name, program_name, performer_total, status, payload, updated_at, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_email) DO UPDATE SET school_name = excluded.school_name, program_name = excluded.program_name, performer_total = excluded.performer_total, status = excluded.status, payload = excluded.payload, updated_at = excluded.updated_at, submitted_at = excluded.submitted_at")
      .bind(user.email, body.schoolName.trim(), body.programName.trim(), Math.max(0, Number(body.performerTotal) || 0), status, JSON.stringify(body.payload ?? {}), now, body.submit ? now : null).run();
    return NextResponse.json({ ok: true, status, updatedAt: now });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "申請を保存できませんでした。" }, { status: 500 });
  }
}
