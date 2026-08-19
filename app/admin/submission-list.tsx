"use client";
import { useEffect, useState } from "react";
type Submission = { id: number; school_name: string; program_name: string; performer_total: number; status: "draft" | "submitted"; updated_at: string; submitted_at: string | null };
export default function SubmissionList() {
  const [items, setItems] = useState<Submission[]>([]); const [message, setMessage] = useState("読み込み中…");
  const load = () => fetch("/api/submissions").then(async (response) => { const data = await response.json() as { submissions?: Submission[]; error?: string }; if (!response.ok) throw new Error(data.error); return data.submissions ?? []; }).then((data) => { setItems(data); setMessage(""); }).catch((error: Error) => setMessage(error.message || "申請一覧を取得できませんでした。"));
  useEffect(() => { void load(); }, []);
  return <section className="admin-panel submission-panel"><div className="admin-panel-heading"><div><p className="mini-label">SUBMISSIONS</p><h2>申請一覧・提出状況</h2></div><button onClick={load}>更新</button></div>{message ? <p className="admin-empty">{message}</p> : items.length ? <div className="submission-table">{items.map((item) => <article key={item.id}><div><b>{item.school_name}</b><span>{item.program_name}・{item.performer_total}名</span></div><time>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(item.updated_at))}</time><strong className={item.status}>{item.status === "submitted" ? "提出済み" : "下書き"}</strong></article>)}</div> : <p className="admin-empty">まだ保存された申請はありません。</p>}</section>;
}
