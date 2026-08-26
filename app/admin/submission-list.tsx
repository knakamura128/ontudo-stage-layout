"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StageObject = { id: number; label: string; icon: string; kind: "instrument" | "stand" | "chair"; x: number; y: number; power: boolean };
type StagePoint = { left: number; top: number };
type ProgramLayout = { fanLayout?: boolean; objects?: StageObject[]; playerPositions?: Record<number, StagePoint>; playerLabels?: Record<number, string>; playerSeats?: Record<number, "player" | "folding" | "none"> };
type SubmissionPayload = { layouts?: Record<string, ProgramLayout>; programs?: string[]; separatePrograms?: boolean; programPerformers?: number[]; counts?: Record<string, number>; loading?: string[]; notes?: string; carDelivery?: string; deliveryDate?: string; soundVideo?: string; soundCue?: string; usePower?: boolean; usePiano?: boolean; useChildPianoBench?: boolean; bringChildPianoBench?: boolean };
type Submission = { id: number; school_name: string; program_name: string; performer_total: number; status: "draft" | "submitted"; updated_at: string; submitted_at: string | null; payload: string };
type PdfPage = { submission: Submission; payload: SubmissionPayload; programIndex: number; programName: string; performerTotal: number; layout: ProgramLayout };

const playerSlots = Array.from({ length: 100 }, (_, index) => index);
const toshimaElementarySchools = ["仰高小学校", "駒込小学校", "巣鴨小学校", "清和小学校", "西巣鴨小学校", "豊成小学校", "朋有小学校", "朝日小学校", "池袋第一小学校", "池袋小学校", "南池袋小学校", "高南小学校", "目白小学校", "長崎小学校", "要小学校", "椎名町小学校", "富士見台小学校", "千早小学校", "高松小学校", "さくら小学校", "池袋本町小学校"];

function fallbackPosition(index: number, fanLayout: boolean): StagePoint {
  if (index < 14) return { left: Number((22 + index * (56 / 13)).toFixed(3)), top: 13 };
  if (index < 30) return { left: Number((27 + (index - 14) * (47 / 15)).toFixed(3)), top: 29 };
  const outsideIndex = index - 30;
  const row = Math.floor(outsideIndex / 16);
  const inRow = outsideIndex % 16;
  const rowSize = Math.min(16, 70 - row * 16);
  if (!fanLayout) return { left: Number((23 + inRow * (54 / Math.max(1, rowSize - 1))).toFixed(3)), top: 52 + row * 18 };
  const angle = 202 + inRow * (136 / Math.max(1, rowSize - 1));
  const radius = 29 - row * 7;
  return { left: Number((50 + Math.cos((angle * Math.PI) / 180) * radius * 1.28).toFixed(3)), top: Number((82 + Math.sin((angle * Math.PI) / 180) * radius).toFixed(3)) };
}

function valueOrNone(value?: string) { return value?.trim() || "なし"; }

function parsePayload(item: Submission): SubmissionPayload {
  try { return JSON.parse(item.payload) as SubmissionPayload; } catch { return {}; }
}

function normalizeSchoolName(value: string) { return value.replace(/[\s　]/g, "").replace(/^豊島区立/, "").replace(/小学校$/, ""); }

function pdfPages(items: Submission[]) {
  return items.flatMap((submission): PdfPage[] => {
    const payload = parsePayload(submission);
    const programs = payload.programs?.map((value) => value?.trim() ?? "") ?? [submission.program_name];
    const indices = payload.separatePrograms ? programs.map((name, index) => name ? index : -1).filter((index) => index >= 0) : [0];
    return (indices.length ? indices : [0]).map((programIndex) => ({
      submission, payload, programIndex, programName: programs[programIndex] || submission.program_name,
      performerTotal: payload.separatePrograms ? Number(payload.programPerformers?.[programIndex]) || submission.performer_total : submission.performer_total,
      layout: payload.layouts?.[String(programIndex)] ?? payload.layouts?.["0"] ?? {},
    }));
  });
}

function SubmissionPdfPage({ page }: { page: PdfPage }) {
  const { submission, payload, layout, programName, performerTotal } = page;
  const objects = layout.objects ?? [];
  const playerLabels = layout.playerLabels ?? {};
  const players = playerSlots.filter((index) => Boolean(playerLabels[index]));
  return <section className="submission-pdf pdf-rendering admin-pdf-page" data-batch-pdf-page aria-hidden="true">
    <header><p>令和8年度　音楽のつどい</p><h1>舞台設営・備品配置資料</h1><small>提出資料</small></header>
    <div className="pdf-meta"><div><span>学校名</span><b>{submission.school_name}</b></div><div><span>出演人数</span><b>{performerTotal}名</b></div><div><span>配置</span><b>{programName === "配置図共通" ? "共通配置" : programName || "未入力"}</b></div></div>
    <section className="pdf-section"><h2>舞台配置図（幅 15m × 奥行 12m）</h2><div className="pdf-stage"><div className="pdf-piano">PIANO</div><div className="pdf-riser pdf-riser-top">ひな壇 2段目　椅子14</div><div className="pdf-riser pdf-riser-low">ひな壇 1段目　椅子16</div>
      {players.map((index) => { const point = layout.playerPositions?.[index] ?? fallbackPosition(index, Boolean(layout.fanLayout)); const seat = layout.playerSeats?.[index] ?? "player"; return <span key={index} className={`pdf-player ${seat}`} style={{ left: `${point.left}%`, top: `${point.top}%` }}>{playerLabels[index]}</span>; })}
      {objects.map((item) => <span key={item.id} className={`pdf-object ${item.kind}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>{item.icon} {item.label}{item.power ? " ⚡" : ""}</span>)}<div className="pdf-audience">客　席</div></div></section>
    <div className="pdf-info-grid"><section><h2>利用備品・数量</h2><dl><div><dt>ピアノ</dt><dd>{payload.usePiano ? "使用" : "不使用"}</dd></div><div><dt>子ども用ピアノ台</dt><dd>{payload.useChildPianoBench ? payload.bringChildPianoBench ? "使用・持ち込み" : "使用" : "不使用"}</dd></div><div><dt>マイク</dt><dd>{payload.counts?.microphones ?? 0}本</dd></div><div><dt>マイクスタンド</dt><dd>{payload.counts?.micStands ?? 0}本</dd></div><div><dt>出演者椅子</dt><dd>{payload.counts?.playerChairs ?? 0}脚</dd></div><div><dt>折り畳み椅子</dt><dd>{payload.counts?.foldingChairs ?? 0}脚</dd></div></dl></section><section><h2>搬入・設営</h2><dl><div><dt>車での搬入</dt><dd>{valueOrNone(payload.carDelivery)}</dd></div><div><dt>搬入希望日</dt><dd>{valueOrNone(payload.deliveryDate)}</dd></div><div><dt>搬入物</dt><dd>{payload.loading?.join("、") || "なし"}</dd></div><div><dt>電源（コンセント）</dt><dd>{payload.usePower ? "使用" : "不使用"}</dd></div><div><dt>音響・映像備品</dt><dd>{valueOrNone(payload.soundVideo)}</dd></div></dl></section></div>
    <section className="pdf-notes"><h2>その他担当者への要望</h2><p>{valueOrNone(payload.notes)}</p></section><footer>教育委員会提出用／当日設営用資料</footer>
  </section>;
}

export default function SubmissionList() {
  const [items, setItems] = useState<Submission[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [renderItems, setRenderItems] = useState<Submission[]>([]);
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const load = () => { setMessage("読み込み中…"); fetch("/api/submissions").then(async (response) => { const data = await response.json() as { submissions?: Submission[]; error?: string }; if (!response.ok) throw new Error(data.error); return data.submissions ?? []; }).then((data) => { setItems(data); setSelectedIds((now) => now.filter((id) => data.some((item) => item.id === id && item.status === "submitted"))); setMessage(""); }).catch((error: Error) => setMessage(error.message || "申請一覧を取得できませんでした。")); };
  useEffect(() => { const timer = window.setTimeout(load, 180); return () => window.clearTimeout(timer); }, []);
  const selectedItems = useMemo(() => (items ?? []).filter((item) => selectedIds.includes(item.id)), [items, selectedIds]);
  const renderPages = useMemo(() => pdfPages(renderItems), [renderItems]);
  const toggle = (id: number) => setSelectedIds((now) => now.includes(id) ? now.filter((value) => value !== id) : [...now, id]);
  const toggleAll = () => { const submitted = (items ?? []).filter((item) => item.status === "submitted"); setSelectedIds(selectedIds.length === submitted.length ? [] : submitted.map((item) => item.id)); };
  const download = async (chosen: Submission[]) => {
    const pages = pdfPages(chosen);
    if (!pages.length || creating) return;
    setCreating(true); setMessage("PDFを作成中…");
    try {
      setRenderItems(chosen);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const targets = [...document.querySelectorAll<HTMLElement>("[data-batch-pdf-page]")].slice(0, pages.length);
      if (targets.length !== pages.length) throw new Error("PDFのページを準備できませんでした。");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      for (const [index, target] of targets.entries()) {
        const canvas = await html2canvas(target, { backgroundColor: "#fff", scale: 2 });
        if (index) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }
      const suffix = chosen.length === 1 ? chosen[0].school_name : `${chosen.length}校分`;
      pdf.save(`音楽のつどい_設営資料_${suffix}.pdf`);
      setMessage(`${pages.length}ページのPDFをダウンロードしました。`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "PDFを作成できませんでした。"); } finally { setRenderItems([]); setCreating(false); }
  };
  const submitted = (items ?? []).filter((item) => item.status === "submitted");
  const schoolStatuses = useMemo(() => toshimaElementarySchools.map((school) => {
    const related = (items ?? []).filter((item) => normalizeSchoolName(item.school_name) === normalizeSchoolName(school));
    return { school, status: related.some((item) => item.status === "submitted") ? "submitted" : related.length ? "draft" : "waiting" };
  }), [items]);
  const submittedSchoolCount = schoolStatuses.filter((item) => item.status === "submitted").length;
  const draftSchoolCount = schoolStatuses.filter((item) => item.status === "draft").length;
  const progress = (submittedSchoolCount / toshimaElementarySchools.length) * 100;
  return <section className="admin-panel submission-panel" id="submissions"><div className="admin-panel-heading"><div><p className="mini-label">SUBMISSIONS</p><h2>申請一覧・提出状況</h2></div><button onClick={load}>{items ? "更新" : "一覧を読み込む"}</button></div>
    {items ? <><section className="school-status-board" aria-label="豊島区立小学校の提出状況"><div className="school-progress"><div className="progress-ring" style={{ background: `conic-gradient(#42a879 ${progress}%, #e8eeec 0)` }}><div><b>{submittedSchoolCount}</b><span>/ {toshimaElementarySchools.length} 校</span></div></div><div><p className="mini-label">TOSHIMA ELEMENTARY SCHOOLS</p><h3>豊島区立小学校の提出状況</h3><p>池袋第三小学校を除く {toshimaElementarySchools.length} 校</p></div></div><div className="school-status-summary"><span className="submitted"><b>{submittedSchoolCount}</b>提出済み</span><span className="draft"><b>{draftSchoolCount}</b>下書きあり</span><span className="waiting"><b>{toshimaElementarySchools.length - submittedSchoolCount - draftSchoolCount}</b>未提出</span></div><div className="school-status-grid">{schoolStatuses.map((item) => <div key={item.school} className={`school-status ${item.status}`}><i>{item.status === "submitted" ? "✓" : item.status === "draft" ? "…" : ""}</i><span>{item.school}</span><small>{item.status === "submitted" ? "提出済み" : item.status === "draft" ? "下書き" : "未提出"}</small></div>)}</div></section>{items.length ? <><div className="submission-bulk-bar"><label><input type="checkbox" checked={submitted.length > 0 && selectedIds.length === submitted.length} onChange={toggleAll} /> 提出済みをすべて選択</label><span>{selectedIds.length}校を選択中</span><button className="bulk-pdf-button" onClick={() => void download(selectedItems)} disabled={!selectedIds.length || creating}>{creating ? "PDFを作成中…" : `選択した資料をまとめてPDF化（${selectedIds.length}校）`}</button></div><div className="submission-table">{items.map((item) => <article key={item.id}><label className="submission-check"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} disabled={item.status !== "submitted"} aria-label={`${item.school_name}を選択`} /></label><div><b>{item.school_name}</b><span>{item.program_name}・{item.performer_total}名</span></div><time>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tokyo" }).format(new Date(item.updated_at))}</time><strong className={item.status}>{item.status === "submitted" ? "提出済み" : "下書き"}</strong><div className="submission-row-actions"><Link href={`/admin/submissions/${item.id}`}>資料を参照</Link>{item.status === "submitted" && <button onClick={() => void download([item])} disabled={creating}>PDFをダウンロード</button>}</div></article>)}</div></> : <p className="admin-empty">まだ保存された申請はありません。</p>}</> : <p className="admin-empty">{message || "提出状況を読み込み中…"}</p>}
    {items && <div className="admin-pdf-pages" aria-hidden="true">{renderPages.map((page, index) => <SubmissionPdfPage key={`${page.submission.id}-${page.programIndex}-${index}`} page={page} />)}</div>}
    {items?.length ? <p className="admin-empty submission-message" aria-live="polite">{message || "「資料を参照」で内容確認、「PDFをダウンロード」で学校ごとの資料を出力できます。"}</p> : null}
  </section>;
}
