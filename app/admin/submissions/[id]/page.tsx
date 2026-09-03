import Link from "next/link";
import { headers } from "next/headers";
import { env } from "cloudflare:workers";
import { readSession } from "@/app/lib/google-auth";
import PdfButton from "./pdf-button";

export const dynamic = "force-dynamic";

type StageObject = { id: number; label: string; icon: string; kind: "instrument" | "stand" | "chair"; x: number; y: number; power: boolean };
type StagePoint = { left: number; top: number };
type ProgramLayout = { fanLayout?: boolean; autoPlacement?: "riser" | "floor"; showPerformers?: boolean; objects?: StageObject[]; playerPositions?: Record<number, StagePoint>; playerLabels?: Record<number, string>; playerSeats?: Record<number, "player" | "folding" | "none"> };
type SubmissionPayload = { layouts?: Record<number, ProgramLayout>; programs?: string[]; counts?: Record<string, number>; loading?: string[]; notes?: string; carDelivery?: string; vehicleType?: string; vehicleCount?: string; deliveryDate?: string; soundVideo?: string; soundCue?: string; usePower?: boolean; usePiano?: boolean; useChildPianoBench?: boolean; bringChildPianoBench?: boolean };
type Row = { id: number; school_name: string; program_name: string; performer_total: number; status: "draft" | "submitted"; payload: string; submitted_at: string | null };
type Revision = { id: number; school_name: string; program_name: string; performer_total: number; status: "draft" | "submitted"; created_at: string };
const MAX_PERFORMERS = 150;

function fallbackPosition(index: number, fanLayout: boolean, autoPlacement: "riser" | "floor" = "riser", performerCount = MAX_PERFORMERS): StagePoint {
  const performersPerRow = 15;
  if (autoPlacement === "floor") {
    const row = Math.floor(index / performersPerRow);
    const inRow = index % performersPerRow;
    const rowCount = Math.max(1, Math.ceil(performerCount / performersPerRow));
    const rowSize = Math.min(performersPerRow, Math.max(1, performerCount - row * performersPerRow));
    const top = 48 + row * (36 / Math.max(1, rowCount - 1));
    if (!fanLayout) return { left: Number((13 + inRow * (74 / Math.max(1, rowSize - 1))).toFixed(3)), top: Number(top.toFixed(3)) };
    const angle = 202 + inRow * (136 / Math.max(1, rowSize - 1));
    const radius = 29 - row * (16 / Math.max(1, rowCount - 1));
    return { left: Number((50 + Math.cos((angle * Math.PI) / 180) * radius * 1.28).toFixed(3)), top: Number((82 + Math.sin((angle * Math.PI) / 180) * radius).toFixed(3)) };
  }
  const riserUpperCount = 14;
  const riserLowerCount = 16;
  const riserCount = riserUpperCount + riserLowerCount;
  if (index < riserUpperCount) return { left: Number((22 + index * (56 / (riserUpperCount - 1))).toFixed(3)), top: 13 };
  if (index < riserCount) {
    const lowerIndex = index - riserUpperCount;
    return { left: Number((27 + lowerIndex * (47 / (riserLowerCount - 1))).toFixed(3)), top: 29 };
  }
  const outsideIndex = index - riserCount;
  const outsideCount = Math.max(1, performerCount - riserCount);
  const row = Math.floor(outsideIndex / performersPerRow);
  const inRow = outsideIndex % performersPerRow;
  const rowCount = Math.max(1, Math.ceil(outsideCount / performersPerRow));
  const rowSize = Math.min(performersPerRow, Math.max(1, outsideCount - row * performersPerRow));
  const top = 52 + row * (36 / Math.max(1, rowCount - 1));
  if (!fanLayout) return { left: Number((23 + inRow * (54 / Math.max(1, rowSize - 1))).toFixed(3)), top: Number(top.toFixed(3)) };
  const angle = 202 + inRow * (136 / Math.max(1, rowSize - 1));
  const radius = 29 - row * (16 / Math.max(1, rowCount - 1));
  return { left: Number((50 + Math.cos((angle * Math.PI) / 180) * radius * 1.28).toFixed(3)), top: Number((82 + Math.sin((angle * Math.PI) / 180) * radius).toFixed(3)) };
}

function displayObjectPositions(objects: StageObject[]) {
  const placed: StagePoint[] = [];
  const offsets = [
    { left: 0, top: 0 }, { left: 24, top: -10 }, { left: -24, top: -10 },
    { left: 24, top: 10 }, { left: -24, top: 10 }, { left: 0, top: 20 },
    { left: 48, top: 0 }, { left: -48, top: 0 }, { left: 48, top: 20 }, { left: -48, top: 20 },
  ];
  return objects.map((item) => {
    const position = offsets.find((offset) => {
      const candidate = { left: Math.max(8, Math.min(92, item.x + offset.left)), top: Math.max(7, Math.min(91, item.y + offset.top)) };
      return !placed.some((current) => Math.abs(candidate.left - current.left) < 21 && Math.abs(candidate.top - current.top) < 8);
    }) ?? { left: 0, top: 0 };
    const point = { left: Math.max(8, Math.min(92, item.x + position.left)), top: Math.max(7, Math.min(91, item.y + position.top)) };
    placed.push(point);
    return { ...item, displayPoint: point };
  });
}

function valueOrNone(value?: string) { return value?.trim() || "なし"; }

export default async function SubmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const user = await readSession((await headers()).get("cookie"));
  const { id } = await params;
  if (!user || user.role !== "admin") return <main className="admin-gate"><section className="admin-gate-card"><h1>管理者専用です</h1><p>管理者としてログインすると、申請詳細を確認できます。</p><a href="/admin?login=redirect" className="admin-primary-link">管理者ログインへ進む</a><a href="/" className="admin-secondary-link">舞台配置ページへ戻る</a></section></main>;

  const db = (env as { DB?: D1Database }).DB;
  const row = db ? await db.prepare("SELECT id, school_name, program_name, performer_total, status, payload, submitted_at FROM submissions WHERE id = ?").bind(Number(id)).first<Row>() : null;
  if (!row) return <main className="admin-gate"><section className="admin-gate-card"><h1>申請が見つかりません</h1><Link href="/admin" className="admin-primary-link">一覧へ戻る</Link></section></main>;

  let payload: SubmissionPayload = {};
  try { payload = JSON.parse(row.payload) as SubmissionPayload; } catch { payload = {}; }
  const programIndex = Math.max(0, payload.programs?.findIndex((program) => program === row.program_name) ?? 0);
  const layout = payload.layouts?.[programIndex] ?? payload.layouts?.[0] ?? {};
  const players = Object.entries(layout.playerLabels ?? {}).filter(([, label]) => Boolean(label));
  const showPerformers = layout.showPerformers !== false;
  const objects = layout.objects ?? [];
  const displayedObjects = displayObjectPositions(objects);
  const submittedAt = row.submitted_at ? new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(row.submitted_at)) : "未提出";
  let revisions: { results?: Revision[] } = { results: [] };
  if (db) {
    try { revisions = await db.prepare("SELECT id, school_name, program_name, performer_total, status, created_at FROM submission_revisions WHERE submission_id = ? ORDER BY created_at DESC LIMIT 30").bind(row.id).all<Revision>(); } catch { revisions = { results: [] }; }
  }
  const formatRevisionDate = (value: string) => new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(value));

  return <main className="admin-shell">
    <header className="admin-topbar"><Link href="/admin" className="admin-brand"><span>♪</span><b>音楽のつどい</b><small>申請詳細</small></Link><div className="admin-user"><b>{row.status === "submitted" ? "提出済み" : "下書き"}</b></div></header>
    <div className="admin-wrap">
      <Link href="/admin" className="admin-secondary-link">← 申請一覧へ戻る</Link>
      <div className="detail-actions"><a href={`/?edit=${row.id}`} className="detail-edit-link">編集画面で修正する →</a><PdfButton /></div>
      <section className="setup-sheet">
        <header className="setup-sheet-header"><div><p>令和8年度　第63回 音楽のつどい</p><h1>舞台設営・備品配置資料</h1></div><aside><b>{row.status === "submitted" ? "提出済み" : "下書き"}</b><small>{submittedAt}</small></aside></header>
        <div className="setup-sheet-meta"><div><span>学校・団体名</span><b>{row.school_name}</b></div><div><span>出演人数</span><b>{row.performer_total}名</b></div><div><span>演目名</span><b>{row.program_name === "配置図共通" ? "未入力" : row.program_name}</b></div></div>
        <section className="setup-stage-section"><div className="setup-section-head"><h2>舞台配置図</h2><span>客席側から見た配置　幅 15m × 奥行 12m</span></div><div className="setup-collision-note">近接した備品は、名称が読めるよう表示位置のみ少しずらしています。</div><div className="setup-stage-map">
          <div className="setup-piano">PIANO</div><div className="setup-riser setup-riser-top">ひな壇 2段目（椅子14）<small>横12.6m × 縦1.2m</small></div><div className="setup-riser setup-riser-low">ひな壇 1段目（椅子16）<small>横10.8m × 縦0.9m</small></div>
          {showPerformers ? players.map(([index, label]) => { const playerIndex = Number(index); const point = layout.playerPositions?.[playerIndex] ?? fallbackPosition(playerIndex, Boolean(layout.fanLayout), layout.autoPlacement, players.length); const seat = layout.playerSeats?.[playerIndex] ?? "player"; return <span key={index} className={`setup-player ${seat}`} style={{ left: `${point.left}%`, top: `${point.top}%` }}>{label}</span>; }) : <><span className="setup-performers-skipped">出演者の配置なし（{row.performer_total}名）</span>{players.map(([index]) => { const playerIndex = Number(index); const point = layout.playerPositions?.[playerIndex] ?? fallbackPosition(playerIndex, Boolean(layout.fanLayout), layout.autoPlacement, players.length); const seat = layout.playerSeats?.[playerIndex] ?? "none"; return seat !== "none" ? <span key={index} className={`setup-player chair-only ${seat}`} style={{ left: `${point.left}%`, top: `${point.top}%` }}>{seat === "player" ? "椅子" : "折り畳"}</span> : null; })}</>}
          {displayedObjects.map((item) => <span key={item.id} className={`setup-object ${item.kind}`} style={{ left: `${item.displayPoint.left}%`, top: `${item.displayPoint.top}%` }}><i aria-hidden="true">{item.icon}</i><b>{item.label}</b>{item.power && <em>◆</em>}</span>)}
          <div className="setup-audience">客　席</div>
        </div><div className="setup-stage-measurements">後方ひな壇：横12.6m × 縦1.2m　／　前方ひな壇：横10.8m × 縦0.9m　／　ひな壇前方から舞台袖まで：5.0m + 1.2m</div><div className="setup-legend"><span><i className="solid" />出演者椅子</span><span><i className="dashed" />折り畳み椅子</span><span>◆ 電源を使用する備品</span></div>
        </section>
        <section className="setup-information-grid">
          <article><h2>備品・数量</h2><dl><div><dt>ピアノ</dt><dd>{payload.usePiano ? "使用" : "不使用"}</dd></div><div><dt>子ども用ピアノ台</dt><dd>{payload.useChildPianoBench ? payload.bringChildPianoBench ? "使用・持ち込み" : "使用" : "不使用"}</dd></div><div><dt>ワイヤレスマイク</dt><dd>{payload.counts?.microphones ?? 0}本</dd></div><div><dt>マイクスタンド</dt><dd>{payload.counts?.micStands ?? 0}本</dd></div><div><dt>指揮台</dt><dd>{payload.counts?.podiums ?? 0}台</dd></div><div><dt>指揮者用譜面台</dt><dd>{payload.counts?.conductorStands ?? 0}台</dd></div><div><dt>譜面台</dt><dd>{payload.counts?.musicStands ?? 0}台</dd></div><div><dt>出演者椅子</dt><dd>{payload.counts?.playerChairs ?? 0}脚</dd></div><div><dt>折り畳み椅子</dt><dd>{payload.counts?.foldingChairs ?? 0}脚</dd></div></dl></article>
          <article><h2>搬入・設営</h2><dl><div><dt>車での搬入</dt><dd>{valueOrNone(payload.carDelivery)}</dd></div><div><dt>搬入物</dt><dd>{payload.loading?.join("、") || "なし"}</dd></div><div><dt>車種</dt><dd>{valueOrNone(payload.vehicleType)}</dd></div><div><dt>台数</dt><dd>{payload.vehicleCount ? `${payload.vehicleCount}台` : "なし"}</dd></div><div><dt>電源（コンセント）</dt><dd>{payload.usePower ? "使用" : "不使用"}</dd></div><div><dt>音響・映像備品</dt><dd>{valueOrNone(payload.soundVideo)}</dd></div></dl></article>
        </section>
        <section className="setup-notes"><h2>その他担当者への要望</h2><p>{valueOrNone(payload.notes)}</p></section>
        <footer>教育委員会提出用／当日設営用資料　・　Hareza備品設営担当・担当会長でご確認ください</footer>
      </section>
      <section className="revision-history"><div><p className="mini-label">VERSION HISTORY</p><h2>更新履歴</h2><p>この画面は最新版です。保存・再提出の直前の内容を履歴として残します。</p></div><ol>{revisions.results?.length ? revisions.results.map((revision) => <li key={revision.id}><time>{formatRevisionDate(revision.created_at)}</time><span>{revision.school_name}・{revision.program_name === "配置図共通" ? "共通配置" : revision.program_name}・{revision.performer_total}名</span><b>{revision.status === "submitted" ? "提出済み版" : "下書き版"}</b></li>) : <li className="empty-history">まだ更新履歴はありません。</li>}</ol></section>
    </div>
  </main>;
}
