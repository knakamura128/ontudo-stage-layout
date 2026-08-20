import Link from "next/link";
import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { readSession } from "@/app/lib/google-auth";
import PdfButton from "./pdf-button";

export const dynamic = "force-dynamic";

type StageObject = { id: number; label: string; icon: string; kind: "instrument" | "stand" | "chair"; x: number; y: number; power: boolean };
type StagePoint = { left: number; top: number };
type ProgramLayout = { objects?: StageObject[]; playerPositions?: Record<number, StagePoint>; playerLabels?: Record<number, string>; playerSeats?: Record<number, "player" | "folding"> };
type SubmissionPayload = { layouts?: Record<number, ProgramLayout>; programs?: string[]; counts?: Record<string, number>; loading?: string[]; notes?: string; carDelivery?: string; deliveryDate?: string; soundVideo?: string; soundCue?: string; usePower?: boolean; usePiano?: boolean };
type Row = { id: number; school_name: string; program_name: string; performer_total: number; status: "draft" | "submitted"; payload: string; submitted_at: string | null };

function fallbackPosition(index: number): StagePoint {
  const row = Math.floor(index / 12);
  return { left: 20 + (index % 12) * 5.5, top: 48 + row * 13 };
}

function valueOrNone(value?: string) { return value?.trim() || "なし"; }

export default async function SubmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await readSession((await headers()).get("cookie"));
  const { id } = await params;
  if (!user || user.role !== "admin") return <main className="admin-gate"><section className="admin-gate-card"><h1>管理者専用です</h1><Link href="/admin" className="admin-primary-link">管理者ページへ戻る</Link></section></main>;

  const db = (env as { DB?: D1Database }).DB;
  const row = db ? await db.prepare("SELECT id, school_name, program_name, performer_total, status, payload, submitted_at FROM submissions WHERE id = ?").bind(Number(id)).first<Row>() : null;
  if (!row) return <main className="admin-gate"><section className="admin-gate-card"><h1>申請が見つかりません</h1><Link href="/admin" className="admin-primary-link">一覧へ戻る</Link></section></main>;

  let payload: SubmissionPayload = {};
  try { payload = JSON.parse(row.payload) as SubmissionPayload; } catch { payload = {}; }
  const programIndex = Math.max(0, payload.programs?.findIndex((program) => program === row.program_name) ?? 0);
  const layout = payload.layouts?.[programIndex] ?? payload.layouts?.[0] ?? {};
  const players = Object.entries(layout.playerLabels ?? {}).filter(([, label]) => Boolean(label));
  const objects = layout.objects ?? [];
  const submittedAt = row.submitted_at ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(row.submitted_at)) : "未提出";

  return <main className="admin-shell">
    <header className="admin-topbar"><Link href="/admin" className="admin-brand"><span>♪</span><b>音楽のつどい</b><small>申請詳細</small></Link><div className="admin-user"><b>{row.status === "submitted" ? "提出済み" : "下書き"}</b></div></header>
    <div className="admin-wrap">
      <Link href="/admin" className="admin-secondary-link">← 申請一覧へ戻る</Link>
      <div className="detail-actions"><PdfButton /></div>
      <section className="setup-sheet">
        <header className="setup-sheet-header"><div><p>令和8年度　音楽のつどい</p><h1>舞台設営・備品配置資料</h1></div><aside><b>{row.status === "submitted" ? "提出済み" : "下書き"}</b><small>{submittedAt}</small></aside></header>
        <div className="setup-sheet-meta"><div><span>学校名</span><b>{row.school_name}</b></div><div><span>出演人数</span><b>{row.performer_total}名</b></div><div><span>演目</span><b>{row.program_name}</b></div></div>
        <section className="setup-stage-section"><div className="setup-section-head"><h2>舞台配置図</h2><span>客席側から見た配置</span></div><div className="setup-stage-map">
          <div className="setup-piano">PIANO</div><div className="setup-riser setup-riser-top">ひな壇 2段目（椅子14）</div><div className="setup-riser setup-riser-low">ひな壇 1段目（椅子16）</div>
          {players.map(([index, label]) => { const playerIndex = Number(index); const point = layout.playerPositions?.[playerIndex] ?? fallbackPosition(playerIndex); const seat = layout.playerSeats?.[playerIndex] ?? "player"; return <span key={index} className={`setup-player ${seat}`} style={{ left: `${point.left}%`, top: `${point.top}%` }}>{label}</span>; })}
          {objects.map((item) => <span key={item.id} className={`setup-object ${item.kind}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}><i>{item.icon}</i>{item.label}{item.power && <em>⚡</em>}</span>)}
          <div className="setup-audience">客　席</div>
        </div><div className="setup-legend"><span><i className="solid" />演奏者椅子</span><span><i className="dashed" />折り畳み椅子</span><span>⚡ 電源を使用する備品</span></div>
        </section>
        <section className="setup-information-grid">
          <article><h2>備品・数量</h2><dl><div><dt>ピアノ</dt><dd>{payload.usePiano ? "使用" : "不使用"}</dd></div><div><dt>マイク</dt><dd>{payload.counts?.microphones ?? 0}本</dd></div><div><dt>マイクスタンド</dt><dd>{payload.counts?.micStands ?? 0}本</dd></div><div><dt>演奏者椅子</dt><dd>{payload.counts?.playerChairs ?? 0}脚</dd></div><div><dt>折り畳み椅子</dt><dd>{payload.counts?.foldingChairs ?? 0}脚</dd></div></dl></article>
          <article><h2>搬入・設営</h2><dl><div><dt>車での搬入</dt><dd>{valueOrNone(payload.carDelivery)}</dd></div><div><dt>搬入希望日</dt><dd>{valueOrNone(payload.deliveryDate)}</dd></div><div><dt>搬入物</dt><dd>{payload.loading?.join("、") || "なし"}</dd></div><div><dt>電源（コンセント）</dt><dd>{payload.usePower ? "使用" : "不使用"}</dd></div><div><dt>音響・映像備品</dt><dd>{valueOrNone(payload.soundVideo)}</dd></div></dl></article>
        </section>
        <section className="setup-notes"><h2>設営担当への要望</h2><p>{valueOrNone(payload.notes)}</p></section>
        <footer>教育委員会提出用／当日設営用資料　・　Hareza備品設営担当・担当会長でご確認ください</footer>
      </section>
    </div>
  </main>;
}
