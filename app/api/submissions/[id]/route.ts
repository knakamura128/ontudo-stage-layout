import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { readSession } from "@/app/lib/google-auth";

type Submission = { id: number; school_name: string; program_name: string; performer_total: number; status: "draft" | "submitted"; payload: string };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await readSession(request.headers.get("cookie"));
    if (!user || user.role !== "admin") return NextResponse.json({ error: "管理者としてログインしてください。" }, { status: 403 });
    const { id } = await params;
    const submissionId = Number(id);
    if (!Number.isSafeInteger(submissionId) || submissionId <= 0) return NextResponse.json({ error: "申請を指定してください。" }, { status: 400 });
    const db = (env as { DB?: D1Database }).DB;
    if (!db) return NextResponse.json({ error: "申請管理の保存先を準備しています。少し時間をおいて再度お試しください。" }, { status: 503 });
    const row = await db.prepare("SELECT id, school_name, program_name, performer_total, status, payload FROM submissions WHERE id = ?").bind(submissionId).first<Submission>();
    if (!row) return NextResponse.json({ error: "申請が見つかりません。" }, { status: 404 });
    let payload: unknown = {};
    try { payload = JSON.parse(row.payload); } catch { payload = {}; }
    return NextResponse.json({ submission: { ...row, payload } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "申請内容を取得できませんでした。" }, { status: 500 });
  }
}
