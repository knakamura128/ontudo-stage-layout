"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

type StageObject = { id: number; label: string; icon: string; kind: "instrument" | "stand" | "chair"; x: number; y: number; power: boolean };
type StagePoint = { left: number; top: number };
type PlayerSeat = "player" | "folding" | "none";
type ProgramLayout = { fanLayout: boolean; objects: StageObject[]; playerPositions: Record<number, StagePoint>; playerLabels: Record<number, string>; playerSeats: Record<number, PlayerSeat> };
type SignedInUser = { email: string; name: string; role: "admin" | "viewer" };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; auto_select?: boolean }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = "395301319192-sr44o695g8se9vkklp2485rb15jqpum2.apps.googleusercontent.com";
const FIXED_STAGE_SIZE = { width: 15, depth: 12 };

const playerSlots = Array.from({ length: 100 }, (_, index) => ({ index }));
const blankPlayerLabels = () => Object.fromEntries(playerSlots.map(({ index }) => [index, ""]));

const palette = [
  { label: "譜面台", icon: "🎼", kind: "stand" as const },
];
const initialPlayerPositions = (() => {
  const positions: Record<number, StagePoint> = {};
  const line = (start: number, count: number, left: number, right: number, top: number) => Array.from({ length: count }, (_, offset) => { positions[start + offset] = { left: left + (right - left) * (offset / Math.max(1, count - 1)), top }; });
  line(0, 8, 32, 52, 15); line(8, 4, 20, 31, 30); line(12, 6, 57, 75, 15); line(18, 6, 37, 54, 30); line(24, 6, 60, 79, 30);
  [[23, 54], [28, 48], [34, 46], [39, 44], [29, 60], [36, 57], [43, 54], [25, 67], [34, 64], [41, 61], [29, 75], [38, 71], [46, 67]].forEach(([left, top], index) => { positions[30 + index] = { left, top }; });
  [[42, 51], [47, 48], [52, 51], [47, 58], [54, 57], [58, 61]].forEach(([left, top], index) => { positions[43 + index] = { left, top }; });
  [[66, 65], [70, 72], [66, 80], [72, 86]].forEach(([left, top], index) => { positions[49 + index] = { left, top }; });
  [[76, 63], [79, 72], [77, 80]].forEach(([left, top], index) => { positions[53 + index] = { left, top }; });
  [[82, 55], [86, 67], [87, 80]].forEach(([left, top], index) => { positions[56 + index] = { left, top }; });
  return positions;
})();

export default function Home() {
  const stageRef = useRef<HTMLDivElement>(null);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const loadedEditIdRef = useRef<number | null>(null);
  const [programs, setPrograms] = useState(["", "", ""]);
  const [activeProgram, setActiveProgram] = useState(0);
  const [separatePrograms, setSeparatePrograms] = useState(false);
  const [programPerformers, setProgramPerformers] = useState([0, 0, 0]);
  const [schoolName, setSchoolName] = useState("");
  const [performerTotal, setPerformerTotal] = useState(0);
  const [layouts, setLayouts] = useState<Record<number, ProgramLayout>>({
    0: { fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} },
    1: { fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} },
    2: { fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} },
  });
  const [carDelivery, setCarDelivery] = useState<"有" | "無">("無");
  const [deliveryDate, setDeliveryDate] = useState("当日（11/14 10時〜）");
  const [soundVideo, setSoundVideo] = useState<"あり" | "なし">("なし");
  const [soundCue, setSoundCue] = useState<"あり" | "なし">("なし");
  const [media, setMedia] = useState<string[]>([]);
  const [usePower, setUsePower] = useState(false);
  const [usePiano, setUsePiano] = useState(true);
  const [useChildPianoBench, setUseChildPianoBench] = useState(false);
  const [bringChildPianoBench, setBringChildPianoBench] = useState(false);
  const [loading, setLoading] = useState<string[]>([]);
  const [poweredLoading, setPoweredLoading] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggingPlayerIndex, setDraggingPlayerIndex] = useState<number | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number | null>(null);
  const [counts, setCounts] = useState({ microphones: 0, micStands: 0, playerChairs: 0, foldingChairs: 0 });
  const [customEquipmentName, setCustomEquipmentName] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [authUser, setAuthUser] = useState<SignedInUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submitModal, setSubmitModal] = useState<"submitting" | "success" | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [stepMessage, setStepMessage] = useState("");

  const completeGoogleSignIn = async (credential: string) => {
    setAuthError("");
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const data = await response.json() as { user?: SignedInUser; error?: string };
      if (!response.ok || !data.user) throw new Error(data.error || "ログインできませんでした。");
      setAuthUser(data.user);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "ログインできませんでした。");
    }
  };

  useEffect(() => {
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: { user?: SignedInUser } | null) => setAuthUser(data?.user ?? null))
      .catch(() => setAuthUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading || authUser || !googleButtonRef.current) return;
    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) return;
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: ({ credential }) => void completeGoogleSignIn(credential), auto_select: false });
      window.google.accounts.id.renderButton(googleButtonRef.current, { type: "standard", theme: "outline", size: "large", text: "signin_with", shape: "pill", width: 220 });
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      if (window.google) renderGoogleButton();
      else existing.addEventListener("load", renderGoogleButton, { once: true });
      return () => existing.removeEventListener("load", renderGoogleButton);
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", renderGoogleButton, { once: true });
    document.head.appendChild(script);
    return () => script.removeEventListener("load", renderGoogleButton);
  }, [authLoading, authUser]);

  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    setAuthUser(null);
    setSaved(false);
  };

  const isAdmin = authUser?.role === "admin";
  useEffect(() => {
    if (!isAdmin) return;
    const requestedId = Number(new URLSearchParams(window.location.search).get("edit"));
    if (!Number.isSafeInteger(requestedId) || requestedId <= 0 || loadedEditIdRef.current === requestedId) return;
    loadedEditIdRef.current = requestedId;
    fetch(`/api/submissions/${requestedId}`).then(async (response) => {
      const data = await response.json() as { submission?: { id: number; school_name: string; program_name: string; performer_total: number; payload?: { layouts?: Record<number, ProgramLayout>; programs?: string[]; separatePrograms?: boolean; programPerformers?: number[]; counts?: Partial<typeof counts>; carDelivery?: "有" | "無"; deliveryDate?: string; soundVideo?: "あり" | "なし"; soundCue?: "あり" | "なし"; media?: string[]; usePower?: boolean; usePiano?: boolean; useChildPianoBench?: boolean; bringChildPianoBench?: boolean; loading?: string[]; poweredLoading?: string[]; notes?: string } }; error?: string };
      if (!response.ok || !data.submission) throw new Error(data.error || "申請内容を読み込めませんでした。");
      return data.submission;
    }).then((submission) => {
      const saved = submission.payload ?? {};
      setSchoolName(submission.school_name); setPerformerTotal(submission.performer_total);
      const savedPrograms = Array.isArray(saved.programs) ? saved.programs.slice(0, 3) : [];
      const savedProgramIndex = Math.max(0, savedPrograms.findIndex((program) => program === submission.program_name));
      setPrograms(savedPrograms.length ? [savedPrograms[0] ?? submission.program_name, savedPrograms[1] ?? "", savedPrograms[2] ?? ""] : [submission.program_name, "", ""]);
      setSeparatePrograms(Boolean(saved.separatePrograms));
      setProgramPerformers(Array.isArray(saved.programPerformers) ? [Number(saved.programPerformers[0]) || submission.performer_total, Number(saved.programPerformers[1]) || 0, Number(saved.programPerformers[2]) || 0] : [submission.performer_total, 0, 0]);
      const savedLayout = saved.layouts?.[savedProgramIndex] ?? saved.layouts?.[0];
      if (saved.separatePrograms && saved.layouts) setLayouts((now) => ({ ...now, ...saved.layouts }));
      else if (savedLayout) setLayouts((now) => ({ ...now, 0: savedLayout }));
      setCounts({ microphones: Number(saved.counts?.microphones) || 0, micStands: Number(saved.counts?.micStands) || 0, playerChairs: Number(saved.counts?.playerChairs) || 0, foldingChairs: Number(saved.counts?.foldingChairs) || 0 });
      setCarDelivery(saved.carDelivery === "有" ? "有" : "無"); setDeliveryDate(saved.deliveryDate ?? ""); setSoundVideo(saved.soundVideo === "あり" ? "あり" : "なし"); setSoundCue(saved.soundCue === "あり" ? "あり" : "なし"); setMedia(Array.isArray(saved.media) ? saved.media : []); setUsePower(Boolean(saved.usePower)); setUsePiano(Boolean(saved.usePiano)); setUseChildPianoBench(Boolean(saved.useChildPianoBench)); setBringChildPianoBench(Boolean(saved.bringChildPianoBench)); setLoading(Array.isArray(saved.loading) ? saved.loading : []); setPoweredLoading(Array.isArray(saved.poweredLoading) ? saved.poweredLoading : []); setNotes(saved.notes ?? "");
      setActiveProgram(0); setEditingSubmissionId(submission.id); setSaved(false); setSubmissionMessage("申請内容を読み込みました。修正後に保存または再提出してください。");
    }).catch((error: Error) => { loadedEditIdRef.current = null; setSubmissionMessage(error.message || "申請内容を読み込めませんでした。"); });
  }, [isAdmin]);
  const submissionChecks = [
    { label: "団体情報（学校名）", ok: Boolean(schoolName.trim()) },
    { label: "出演人数", ok: (separatePrograms ? programPerformers[0] : performerTotal) > 0 },
    ...(separatePrograms ? [{ label: "演目", ok: Boolean(programs.some((program) => program.trim())) }] : []),
  ];
  const missingChecks = submissionChecks.filter((item) => !item.ok);
  const goToNextStep = () => {
    if (currentStep === 1 && missingChecks.length) { setStepMessage("学校名と出演人数を入力してください。配置を変える場合は、演目1も入力してください。"); return; }
    setStepMessage("");
    setCurrentStep((step) => Math.min(4, step + 1));
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };
  const saveRegistration = async (submit: boolean) => {
    setSubmissionMessage("");
    if (submit && missingChecks.length) { setSubmissionMessage("提出前チェックを完了してください。"); return; }
    if (submit) setSubmitModal("submitting");
    try {
      const submissionKey = authUser ? undefined : (sessionStorage.getItem("music-stage-submission-key") ?? crypto.randomUUID());
      if (submissionKey) sessionStorage.setItem("music-stage-submission-key", submissionKey);
      const primaryPerformerTotal = separatePrograms ? programPerformers[0] : performerTotal;
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolName, programName: separatePrograms ? programs[0] : "配置図共通", performerTotal: primaryPerformerTotal, submit, submissionKey, submissionId: editingSubmissionId ?? undefined, payload: { layouts, programs, separatePrograms, programPerformers, counts, carDelivery, deliveryDate, soundVideo, soundCue, media, usePower, usePiano, useChildPianoBench, bringChildPianoBench, loading, poweredLoading, notes } }) });
      const data = await response.json() as { id?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "保存できませんでした。");
      setSaved(true); setSubmissionMessage(submit ? (editingSubmissionId ? "修正内容を提出済みに更新しました。" : "提出しました。設営資料は管理者ページで確認・PDF作成できます。") : "下書きを保存しました。");
      if (submit) setSubmitModal("success");
    } catch (error) { if (submit) setSubmitModal(null); setSubmissionMessage(error instanceof Error ? error.message : "保存できませんでした。"); }
  };

  const layoutKey = separatePrograms ? activeProgram : 0;
  const activeLayout = layouts[layoutKey];
  const fanLayout = activeLayout.fanLayout;
  const objects = activeLayout.objects;
  const updateLayoutAt = (targetLayoutKey: number, updater: (layout: ProgramLayout) => ProgramLayout) => setLayouts((now) => ({ ...now, [targetLayoutKey]: updater(now[targetLayoutKey]) }));
  const updateLayout = (updater: (layout: ProgramLayout) => ProgramLayout) => updateLayoutAt(layoutKey, updater);

  const players = playerSlots;
  const placedPlayerCount = players.filter((_, index) => Boolean(activeLayout.playerLabels[index])).length;

  const syncPerformerCount = (value: number, targetLayoutKey = layoutKey) => {
    const targetCount = Math.min(100, Math.max(0, value));
    const playerChairCount = Math.min(60, counts.playerChairs, targetCount);
    const foldingChairCount = Math.min(50, counts.foldingChairs, Math.max(0, targetCount - playerChairCount));
    updateLayoutAt(targetLayoutKey, (now) => {
      const playerLabels = { ...now.playerLabels };
      const playerPositions = { ...now.playerPositions };
      const playerSeats = { ...now.playerSeats };
      const existing = playerSlots.map(({ index }) => index).filter((index) => Boolean(playerLabels[index]));
      existing.slice(targetCount).forEach((index) => { playerLabels[index] = ""; delete playerPositions[index]; delete playerSeats[index]; });
      const retained = existing.slice(0, targetCount);
      const additions = playerSlots.map(({ index }) => index).filter((index) => !playerLabels[index]).slice(0, targetCount - retained.length);
      additions.forEach((index) => { playerLabels[index] = "出演者"; playerSeats[index] = "none"; });
      const placed = playerSlots.map(({ index }) => index).filter((index) => Boolean(playerLabels[index]));
      placed.forEach((index, order) => { playerSeats[index] = order < playerChairCount ? "player" : order < playerChairCount + foldingChairCount ? "folding" : "none"; });
      return { ...now, playerLabels, playerPositions, playerSeats };
    });
    if (targetLayoutKey === layoutKey) setCounts((now) => ({ ...now, playerChairs: playerChairCount, foldingChairs: foldingChairCount }));
  };
  const setSeatCounts = (playerChairValue: number, foldingChairValue: number) => {
    const playerChairCount = Math.min(60, Math.max(0, playerChairValue), placedPlayerCount);
    const foldingChairCount = Math.min(50, Math.max(0, foldingChairValue), Math.max(0, placedPlayerCount - playerChairCount));
    updateLayout((now) => {
      const playerSeats = { ...now.playerSeats };
      const placed = playerSlots.map(({ index }) => index).filter((index) => Boolean(now.playerLabels[index]));
      placed.forEach((index, order) => { playerSeats[index] = order < playerChairCount ? "player" : order < playerChairCount + foldingChairCount ? "folding" : "none"; });
      return { ...now, playerSeats };
    });
    setCounts((now) => ({ ...now, playerChairs: playerChairCount, foldingChairs: foldingChairCount }));
    setSaved(false);
  };
  const syncCountedObjects = (label: "マイク" | "マイクスタンド", icon: string, kind: StageObject["kind"], value: number) => {
    const maximum = label === "マイク" ? 4 : 15;
    const targetCount = Math.min(maximum, Math.max(0, value));
    updateLayout((now) => {
      const matching = now.objects.filter((item) => item.label === label).slice(0, targetCount);
      const additions = Array.from({ length: Math.max(0, targetCount - matching.length) }, (_, index) => ({ id: Date.now() + index, label, icon, kind, x: 46 + ((now.objects.length + index) % 4) * 9, y: 62 + (Math.floor((now.objects.length + index) / 4) % 2) * 10, power: false }));
      return { ...now, objects: [...now.objects.filter((item) => item.label !== label), ...matching, ...additions] };
    });
    setCounts((now) => ({ ...now, [label === "マイク" ? "microphones" : "micStands"]: targetCount }));
    setSelectedId(null);
    setSaved(false);
  };
  const addObject = (label: string, icon: string, kind: StageObject["kind"] = "instrument", power = false) => {
    const id = Date.now() + objects.length;
    updateLayout((now) => ({ ...now, objects: [...now.objects, { id, label, icon, kind, x: 50 + (now.objects.length % 3) * 7, y: 66 + (now.objects.length % 2) * 8, power }] }));
    setSelectedId(id);
    setSelectedPlayerIndex(null);
    setSaved(false);
  };
  const toggleStageObject = (label: string, icon: string, kind: StageObject["kind"], enabled: boolean) => {
    updateLayout((now) => ({
      ...now,
      objects: enabled
        ? [...now.objects, { id: Date.now(), label, icon, kind, x: 50, y: 78, power: false }]
        : now.objects.filter((item) => item.label !== label),
    }));
    setSaved(false);
  };
  const clearStageLayout = () => {
    if (!window.confirm("この配置図の出演者・備品をすべてクリアしますか？")) return;
    updateLayout((now) => ({ ...now, fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} }));
    setCounts({ microphones: 0, micStands: 0, playerChairs: 0, foldingChairs: 0 });
    if (separatePrograms) setProgramPerformers((now) => now.map((count, index) => index === layoutKey ? 0 : count));
    else setPerformerTotal(0);
    setSelectedId(null);
    setSelectedPlayerIndex(null);
    setSaved(false);
  };
  const removeObject = (id: number) => {
    const removed = objects.find((item) => item.id === id);
    updateLayout((now) => ({ ...now, objects: now.objects.filter((item) => item.id !== id) }));
    if (removed?.label === "マイク") setCounts((now) => ({ ...now, microphones: Math.max(0, now.microphones - 1) }));
    if (removed?.label === "マイクスタンド") setCounts((now) => ({ ...now, micStands: Math.max(0, now.micStands - 1) }));
    setSelectedId(null);
    setSaved(false);
  };
  const removePlayer = (index: number) => {
    const seat = activeLayout.playerSeats[index] ?? "player";
    updateLayout((now) => { const playerLabels = { ...now.playerLabels, [index]: "" }; const playerPositions = { ...now.playerPositions }; const playerSeats = { ...now.playerSeats }; delete playerPositions[index]; delete playerSeats[index]; return { ...now, playerLabels, playerPositions, playerSeats }; });
    if (seat !== "none") setCounts((now) => ({ ...now, [seat === "player" ? "playerChairs" : "foldingChairs"]: Math.max(0, now[seat === "player" ? "playerChairs" : "foldingChairs"] - 1) }));
    if (separatePrograms) setProgramPerformers((now) => now.map((count, current) => current === layoutKey ? Math.max(0, count - 1) : count));
    else setPerformerTotal((now) => Math.max(0, now - 1));
    setSelectedPlayerIndex(null);
    setSaved(false);
  };
  const moveObject = (event: PointerEvent<HTMLElement>) => {
    if ((draggingId === null && draggingPlayerIndex === null) || !stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(90, Math.max(8, ((event.clientY - bounds.top) / bounds.height) * 100));
    if (draggingId !== null) updateLayout((now) => ({ ...now, objects: now.objects.map((item) => item.id === draggingId ? { ...item, x, y } : item) }));
    if (draggingPlayerIndex !== null) updateLayout((now) => ({ ...now, playerPositions: { ...now.playerPositions, [draggingPlayerIndex]: { left: x, top: y } } }));
  };
  const playerPosition = (position: number) => {
    const riserUpperCount = 14;
    const riserLowerCount = 16;
    const riserCount = riserUpperCount + riserLowerCount;

    if (position < riserUpperCount) return { left: Number((22 + position * (56 / (riserUpperCount - 1))).toFixed(3)), top: 13 };
    if (position < riserCount) {
      const lowerIndex = position - riserUpperCount;
      return { left: Number((27 + lowerIndex * (47 / (riserLowerCount - 1))).toFixed(3)), top: 29 };
    }

    const outsideIndex = position - riserCount;
    const outsideCount = players.length - riserCount;
    const row = Math.floor(outsideIndex / 16);
    const inRow = outsideIndex % 16;
    const rowSize = Math.min(16, outsideCount - row * 16);
    if (!fanLayout) return { left: Number((23 + inRow * (54 / Math.max(1, rowSize - 1))).toFixed(3)), top: 52 + row * 18 };

    const angle = 202 + inRow * (136 / Math.max(1, rowSize - 1));
    const radius = 29 - row * 7;
    return { left: Number((50 + Math.cos((angle * Math.PI) / 180) * radius * 1.28).toFixed(3)), top: Number((82 + Math.sin((angle * Math.PI) / 180) * radius).toFixed(3)) };
  };

  return <main className="app-shell">
    <aside className="side-nav" aria-label="主なメニュー">
      <div className="brand"><div className="brand-mark">♪</div><div><p className="brand-eyebrow">令和8年度</p><p className="brand-name">音楽のつどい</p></div></div>
      <nav className="nav-list"><button className="nav-item is-active"><span className="nav-icon">⌘</span> 舞台配置</button><button className="nav-item" onClick={() => document.getElementById("organization")?.scrollIntoView({ behavior: "smooth" })}><span className="nav-icon">◇</span> 団体情報</button><button className="nav-item" onClick={() => document.getElementById("precheck")?.scrollIntoView({ behavior: "smooth" })}><span className="nav-icon">✓</span> 提出前チェック <span className={missingChecks.length ? "nav-dot" : ""} /></button><a className="nav-item admin-nav-link" href="/admin"><span className="nav-icon">⚙</span> 管理者ページ</a></nav>
      <div className="deadline-card"><span>提出締切</span><strong>10月16日（金）</strong><small>原本の様式に準拠</small></div><div className="nav-foot">お問い合わせ　›</div>
    </aside>

    <section className="workspace">
      <header className="topbar"><div className="crumbs">ホーム <span>／</span> 舞台配置</div><div className="account auth-account"><a className="top-admin-link" href="/admin">⚙ 管理者ページ</a>{authUser ? <><span className="account-email">{authUser.email}</span><span className={`role-badge ${authUser.role}`}>{authUser.role === "admin" ? "管理者" : "閲覧者"}</span><button className="signout-button" onClick={() => void signOut()}>ログアウト</button></> : <><span className="public-entry">どなたでも作成・提出できます</span><div ref={googleButtonRef} className="google-signin" aria-label="管理者ログイン" /></>}</div></header>
      {authError && <div className="auth-notice"><b>ログインできませんでした</b><small>{authError}</small></div>}
      <div className="content-wrap form-content">
        <section className="page-heading"><div><p className="section-kicker">STAGE LAYOUT / 1104</p><h1>ステージ配置・備品申請</h1><p className="lead">第61回 音楽のつどい　舞台配置図</p></div><div className="saved-state"><span /> {editingSubmissionId ? `申請 #${editingSubmissionId} を編集中` : saved ? "登録内容を保存しました" : "どなたでも入力・提出できます"}</div></section>

        <nav className="entry-steps" aria-label="入力ステップ">{[[1, "基本情報"], [2, "配置図"], [3, "備品・要望"], [4, "確認・提出"]].map(([step, label]) => <button key={step} className={currentStep === step ? "is-active" : currentStep > step ? "is-complete" : ""} onClick={() => { setCurrentStep(Number(step)); setStepMessage(""); }}><i>{currentStep > step ? "✓" : step}</i><span>{label}</span></button>)}</nav>

        {currentStep === 1 && <><section className="request-summary" id="organization">
          <label><span>学校名</span><input value={schoolName} onChange={(event) => { setSchoolName(event.target.value); setSaved(false); }} placeholder="学校名を入力" /></label>{!separatePrograms && <label><span>出演人数</span><div className="summary-number"><input type="number" value={performerTotal || ""} min="0" max="100" onChange={(event) => { const value = Math.max(0, Math.min(100, Number(event.target.value))); setPerformerTotal(value); syncPerformerCount(value); setSaved(false); }} placeholder="0" /><small>名</small></div></label>}<label className="separate-program-toggle"><input type="checkbox" checked={separatePrograms} onChange={(event) => { const enabled = event.target.checked; setSeparatePrograms(enabled); if (enabled) { const count = programPerformers[0] || performerTotal; setProgramPerformers((now) => [count, now[1], now[2]]); syncPerformerCount(count, 0); } else setActiveProgram(0); setSaved(false); }} /><span aria-hidden="true" /><span className="toggle-copy"><b>演目ごとに配置を変える</b><small>配置変更がある学校のみ選択してください</small></span></label>
        </section>
        {separatePrograms && <section className="program-layout-card"><div><p className="mini-label">PROGRAM-SPECIFIC LAYOUTS</p><h2>演目ごとの舞台配置</h2><p>配置を変える演目だけ、演目名と出演人数を入力してください。提出資料は演目ごとに1ページずつ出力されます。</p></div><div className="program-inputs">{[0, 1, 2].map((index) => <label key={index}><span>演目 {index + 1}</span><input value={programs[index]} onChange={(event) => { const value = event.target.value; setPrograms((now) => now.map((program, current) => current === index ? value : program)); setSaved(false); }} placeholder="例：合奏『風のシンフォニー』" /><span>出演人数</span><div className="summary-number"><input type="number" min="0" max="100" value={programPerformers[index] || ""} onChange={(event) => { const value = Math.max(0, Math.min(100, Number(event.target.value))); setProgramPerformers((now) => now.map((count, current) => current === index ? value : count)); syncPerformerCount(value, index); setSaved(false); }} /><small>名</small></div></label>)}</div><div className="program-tabs" aria-label="設定する演目">{[0, 1, 2].map((index) => <button key={index} className={activeProgram === index ? "is-active" : ""} onClick={() => { setActiveProgram(index); setSelectedId(null); setSelectedPlayerIndex(null); }} disabled={!programs[index].trim()}>{programs[index].trim() || `演目 ${index + 1}（未入力）`}</button>)}</div></section>}
        {stepMessage && <p className="step-message" role="alert">{stepMessage}</p>}<div className="step-actions"><button onClick={goToNextStep}>配置図へ進む →</button></div></>}

        {(currentStep === 2 || currentStep === 3) && <><section className="notice-card"><b>配置の手順</b><p>出演人数を入力すると、出演者が自動で配置されます。必要な椅子と舞台備品の数を指定し、配置図上でドラッグして位置を調整してください。</p></section><div className="layout-grid detailed-grid">
          <section className="stage-card detailed-stage-card" id="stage">
            <div className="card-head"><div><p className="mini-label">STAGE LAYOUT / {separatePrograms ? `PROGRAM ${activeProgram + 1}` : "COMMON LAYOUT"}</p><h2>舞台配置図 <span className="view-hint">（{separatePrograms ? programs[layoutKey] : "共通配置"}）</span></h2></div><div className="stage-actions"><button className="clear-layout" onClick={clearStageLayout}>この配置図をクリア</button><label className="fan-toggle"><input type="checkbox" checked={fanLayout} onChange={(e) => { updateLayout((now) => ({ ...now, fanLayout: e.target.checked })); setSaved(false); }} /><span />ひな壇以外を扇状に配置</label></div></div>
            <div className="stage-legend"><span><i className="legend-coral" />出演者 {placedPlayerCount}名</span><span><i className="legend-navy" />固定備品</span><span><i className="legend-power" />電源使用</span><span>出演者・備品をドラッグして配置</span><span>備品右上の × で削除</span></div>
            <div className="stage-howto" role="note"><b>配置のしかた</b><ol><li>基本情報の出演人数を入れると、出演者のみが自動で並びます</li><li>必要な椅子・マイク類の数を右側で指定します</li><li>配置後はドラッグで移動し、不要な備品は右上の × で外します</li></ol></div>
            <div className="stage-outline"><div className="stage-dimension top">奥行 {FIXED_STAGE_SIZE.depth}m</div><div className="stage-dimension bottom">幅 {FIXED_STAGE_SIZE.width}m</div><div className="curtain left" /><div className="curtain right" />
              <div className="stage-floor large-floor" ref={stageRef} onPointerMove={moveObject} onPointerUp={() => { setDraggingId(null); setDraggingPlayerIndex(null); }} onPointerCancel={() => { setDraggingId(null); setDraggingPlayerIndex(null); }}>
                <div className="fixed-piano"><span>🎹 固定</span><b>PIANO</b></div>
                <div className="riser riser-top"><b>ひな壇 2段目</b><span>椅子 14</span><small>横 12.6m × 縦 1.2m</small>{Array.from({ length: 6 }).map((_, i) => <i key={i} />)}</div>
                <div className="riser riser-low"><b>ひな壇 1段目</b><span>椅子 16</span><small>横 10.8m × 縦 0.9m</small>{Array.from({ length: 7 }).map((_, i) => <i key={i} />)}</div>
                {!usePiano && <div className="unused-label">ピアノ 不使用</div>}
                {players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); const seat = activeLayout.playerSeats[index] ?? "player"; return label ? <button className={`player-dot ${seat} ${selectedPlayerIndex === index ? "is-selected" : ""}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }} key={player.index} onClick={() => { setSelectedPlayerIndex(index); setSelectedId(null); }} onPointerDown={(event) => { event.stopPropagation(); stageRef.current?.setPointerCapture(event.pointerId); setDraggingPlayerIndex(index); setDraggingId(null); setSelectedPlayerIndex(index); setSelectedId(null); setSaved(false); }} aria-label={`${label}の出演者を選択して移動`}><span>{label}</span></button> : null; })}
                {objects.map((item) => <div key={item.id} className="stage-object-wrap" style={{ left: `${item.x}%`, top: `${item.y}%` }}><button className={`stage-object ${item.kind} ${selectedId === item.id ? "is-selected" : ""}`} onClick={() => { setSelectedId(item.id); setSelectedPlayerIndex(null); }} onPointerDown={(event) => { event.stopPropagation(); stageRef.current?.setPointerCapture(event.pointerId); setDraggingId(item.id); setDraggingPlayerIndex(null); setSelectedId(item.id); setSelectedPlayerIndex(null); setSaved(false); }} aria-label={`${item.label}を選択して移動`}><span className="stage-object-icon">{item.icon}</span><span>{item.label}</span>{item.power && <em>⚡</em>}</button><button className="stage-object-delete" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeObject(item.id); }} aria-label={`${item.label}を削除`} title={`${item.label}を削除`}>×</button></div>)}
                <div className="audience">客　席</div>
              </div>
            </div>
            <div className="stage-measurements" aria-label="舞台寸法"><span><b>後方ひな壇</b> 横 12.6m × 縦 1.2m</span><span><b>前方ひな壇</b> 横 10.8m × 縦 0.9m</span><span><b>前方スペース</b> ひな壇前方から舞台袖まで 5.0m + 1.2m</span></div>
            {selectedPlayerIndex !== null && <div className="object-editor performer-editor-selected" aria-live="polite"><b>出演者を選択中</b><small>配置をドラッグで調整できます。削除すると出演人数も1名減ります。</small><button className="delete-player" onClick={() => removePlayer(selectedPlayerIndex)}>削除</button></div>}
            {selectedId !== null && <div className="object-editor"><b>選択中の配置物</b><span>{objects.find((item) => item.id === selectedId)?.icon} {objects.find((item) => item.id === selectedId)?.label}</span><label><input type="checkbox" checked={objects.find((item) => item.id === selectedId)?.power ?? false} onChange={(e) => { updateLayout((now) => ({ ...now, objects: now.objects.map((item) => item.id === selectedId ? { ...item, power: e.target.checked } : item) })); if (e.target.checked) setUsePower(true); setSaved(false); }} />電源を使用</label><button onClick={() => removeObject(selectedId)}>削除</button></div>}
          </section>

          <section className="control-panel comprehensive-panel">
            <div className="panel-head"><div><p className="mini-label">EQUIPMENT & DELIVERY</p><h2>申請内容</h2></div><span className="form-no">様式 1104</span></div>
            <section className="form-section"><h3>利用備品</h3><label className="switch-line"><input type="checkbox" checked={usePiano} onChange={(e) => { setUsePiano(e.target.checked); setSaved(false); }} /><span />ピアノを使用する <small>（位置固定）</small></label><label className="switch-line"><input type="checkbox" checked={useChildPianoBench} onChange={(e) => { setUseChildPianoBench(e.target.checked); if (!e.target.checked) setBringChildPianoBench(false); setSaved(false); }} /><span />子ども用ピアノ台を使用する</label><label className="switch-line"><input type="checkbox" checked={bringChildPianoBench} disabled={!useChildPianoBench} onChange={(e) => { setBringChildPianoBench(e.target.checked); setSaved(false); }} /><span />子ども用ピアノ台を持ち込む</label><label className="switch-line"><input type="checkbox" checked={objects.some((item) => item.label === "指揮台")} onChange={(e) => toggleStageObject("指揮台", "▣", "stand", e.target.checked)} /><span />指揮台を使用する <small>（配置図上で移動可）</small></label><label className="switch-line"><input type="checkbox" checked={objects.some((item) => item.label === "指揮者譜面台")} onChange={(e) => toggleStageObject("指揮者譜面台", "🎼", "stand", e.target.checked)} /><span />指揮者譜面台を使用する <small>（配置図上で移動可）</small></label></section>
            <section className="form-section count-section"><h3>出演者・舞台備品の数量</h3><p className="move-help">出演人数は基本情報で入力します。椅子の数は出演者に反映され、マイク類の数は配置図に追加されます。</p><Count label="出演者椅子" suffix={`脚（最大60・出演者 ${placedPlayerCount}名まで）`} value={counts.playerChairs} max={Math.min(60, placedPlayerCount)} onChange={(v) => setSeatCounts(v, counts.foldingChairs)} /><Count label="折りたたみ椅子" suffix={`脚（最大50・残り ${Math.max(0, placedPlayerCount - counts.playerChairs)}名まで）`} value={counts.foldingChairs} max={Math.min(50, Math.max(0, placedPlayerCount - counts.playerChairs))} onChange={(v) => setSeatCounts(counts.playerChairs, v)} /><Count label="マイク" suffix="本（最大4・配置図に追加）" value={counts.microphones} max={4} onChange={(v) => syncCountedObjects("マイク", "🎤", "instrument", v)} /><Count label="マイクスタンド" suffix="本（最大15・配置図に追加）" value={counts.micStands} max={15} onChange={(v) => syncCountedObjects("マイクスタンド", "🎙️", "stand", v)} /></section>
          </section>
        </div>{currentStep === 2 && <div className="step-actions"><button className="secondary" onClick={() => setCurrentStep(1)}>← 基本情報へ戻る</button><button onClick={goToNextStep}>備品・要望へ進む →</button></div>}</>}

        {currentStep === 3 && <><section className="equipment-workspace">
          <div className="equipment-heading"><div><p className="mini-label">STAGE EQUIPMENT</p><h2>舞台備品を配置</h2><p>必要な備品を押すと、上の配置図へ追加されます。追加された備品は赤枠で選択され、ドラッグで移動できます。</p></div></div>
          <label className="switch-line power-entry"><input type="checkbox" checked={usePower} onChange={(e) => { setUsePower(e.target.checked); setSaved(false); }} /><span />電源（コンセント）を使用する <small>配置した備品を選び、「電源を使用」をチェックしてください</small></label>
          <div className="object-palette"><div className="palette-label">舞台備品</div>{palette.map((item) => <button key={item.label} onClick={() => addObject(item.label, item.icon, item.kind)}><span className="tool-icon">{item.icon}</span><span>{item.label}</span><small>舞台へ追加</small></button>)}<label className="custom-equipment"><span>その他の備品・楽器</span><input value={customEquipmentName} onChange={(event) => setCustomEquipmentName(event.target.value)} placeholder="例：木琴、和太鼓" /><button type="button" disabled={!customEquipmentName.trim()} onClick={() => addObject(customEquipmentName.trim(), "◆", "instrument")}>配置図に追加</button><small>必要な数だけ、同じ名称でも何度でも追加できます</small></label></div>
        </section>

        <section className="application-card">
          <div className="application-head"><div><p className="mini-label">APPLICATION FORM / 1)-3)</p><h2>舞台使用機器・搬出入等申請</h2><p>申請書の入力項目を、舞台配置と同じ画面で管理します。</p></div><span>提出期限　<strong>10月16日（金）</strong></span></div>
          <div className="application-grid">
            <section className="application-section"><div className="application-number">1</div><div className="application-body"><h3>車での搬入出</h3><div className="field-row"><Field label="搬入出" type="select" value={carDelivery === "有" ? "あり" : "なし"} options={["あり", "なし"]} onChange={(value) => { setCarDelivery(value === "あり" ? "有" : "無"); setSaved(false); }} />{carDelivery === "有" && <Field label="搬入希望日" type="select" value={deliveryDate} options={["前日（11/13 18時〜19時）", "当日（11/14 10時〜）"]} onChange={(value) => { setDeliveryDate(value); setSaved(false); }} />}</div>{carDelivery === "有" && <><Field label="搬入物" type="text" value={loading.join("、")} placeholder="主な搬入物" onChange={(value) => { setLoading(value.split(/[、,]/).map((item) => item.trim()).filter(Boolean)); setSaved(false); }} /><div className="field-row"><Field label="車両責任者氏名" type="text" placeholder="氏名" onChange={() => setSaved(false)} /><Field label="連絡先" type="text" placeholder="電話番号" onChange={() => setSaved(false)} /></div><div className="field-row"><Field label="車種（車高3m未満）" type="text" placeholder="車種" onChange={() => setSaved(false)} /><Field label="台数" type="number" suffix="台" onChange={() => setSaved(false)} /></div></>}</div></section>
            <section className="application-section"><div className="application-number">3</div><div className="application-body"><h3>音響・映像備品</h3><div className="field-row"><Field label="音響・映像備品の利用" type="select" value={soundVideo} options={["あり", "なし"]} onChange={(value) => { setSoundVideo(value as "あり" | "なし"); setSaved(false); }} /><Field label="演者から音響への音出し指示" type="select" value={soundCue} options={["あり", "なし"]} onChange={(value) => { setSoundCue(value as "あり" | "なし"); setSaved(false); }} /></div><div className="field-row"><Field label="音楽データ形式" type="text" placeholder="MP3、WAV、CD-DA" onChange={() => setSaved(false)} /><Field label="映像データ形式" type="text" placeholder="mp4、AVCHD" onChange={() => setSaved(false)} /></div><div className="media-field"><span>記録媒体</span><div>{["USB", "SD", "SDHC", "SDXC", "CD-R", "CD-RW", "BD", "DVD"].map((item) => <button className={media.includes(item) ? "is-selected" : ""} key={item} onClick={() => { setMedia((now) => now.includes(item) ? now.filter((current) => current !== item) : [...now, item]); setSaved(false); }}>{media.includes(item) ? "✓ " : ""}{item}</button>)}</div></div><p className="cable-note">電源が必要な機器の場合は、必ず電源ケーブルを持参してください。</p></div></section>
          </div>
        </section>

        <section className="notes-card"><div><p className="mini-label">REQUESTS FOR SETUP STAFF</p><h2>その他担当者への要望</h2><p>当日の動きや配慮が必要なことがあれば、任意で入力してください。</p></div><textarea value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false); }} placeholder={"例）舞台へ入るタイミングを、ピアノの音をきっかけにしたいです。\n例）車椅子の出演者がいます。"} /></section><div className="step-actions"><button className="secondary" onClick={() => setCurrentStep(2)}>← 配置図へ戻る</button><button onClick={goToNextStep}>確認・提出へ進む →</button></div></>}
        {currentStep === 4 && <><section className="precheck-card" id="precheck"><div><p className="mini-label">PRE-SUBMISSION CHECK</p><h2>提出前チェック</h2><p>必須項目が入力されていれば提出できます。配置物・備品がない学校も提出可能です。</p></div><ul>{submissionChecks.map((item) => <li key={item.label} className={item.ok ? "is-ok" : ""}>{item.ok ? "✓" : "!"} {item.label}<span>{item.ok ? "入力済み" : "未入力"}</span></li>)}</ul></section>
        <section className="bottom-card" id="submit"><div><p className="mini-label">SUBMIT</p><h2>この内容で舞台配置を登録しますか？</h2><p>{submissionMessage || "内容を確認して、提出してください。"}</p></div><div className="submit-actions"><button className="pdf-button" onClick={() => void saveRegistration(false)} disabled={submitModal === "submitting"}>下書きを保存</button><button className={`submit-button ${saved ? "is-done" : ""}`} onClick={() => void saveRegistration(true)} disabled={submitModal === "submitting"} aria-busy={submitModal === "submitting"}>{submitModal === "submitting" ? "提出中…" : saved ? "✓　提出済み" : "舞台配置を提出する　→"}</button></div></section><div className="step-actions"><button className="secondary" onClick={() => setCurrentStep(3)}>← 備品・要望へ戻る</button></div></>}
        <section className="submission-pdf" aria-hidden="true"><header><p>令和8年度　音楽のつどい</p><h1>舞台配置・使用機器等 提出資料</h1><small>作成日　{new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(new Date())}</small></header><div className="pdf-meta"><div><span>学校名</span><b>{schoolName || "未入力"}</b></div><div><span>出演人数</span><b>{(separatePrograms ? programPerformers[activeProgram] : performerTotal) || placedPlayerCount}名</b></div><div><span>配置</span><b>{separatePrograms ? programs[activeProgram] || "未入力" : "共通配置"}</b></div></div><section className="pdf-section"><h2>舞台配置図（幅 {FIXED_STAGE_SIZE.width}m × 奥行 {FIXED_STAGE_SIZE.depth}m）</h2><div className="pdf-stage"><div className="pdf-piano">PIANO</div><div className="pdf-riser pdf-riser-top">ひな壇 2段目　椅子14</div><div className="pdf-riser pdf-riser-low">ひな壇 1段目　椅子16</div>{players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); const seat = activeLayout.playerSeats[index] ?? "player"; return label ? <span key={player.index} className={`pdf-player ${seat}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>{label}</span> : null; })}{objects.map((item) => <span key={item.id} className={`pdf-object ${item.kind}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>{item.icon} {item.label}{item.power ? " ⚡" : ""}</span>)}<div className="pdf-audience">客　席</div></div><div className="pdf-stage-measurements">後方ひな壇：横12.6m × 縦1.2m　／　前方ひな壇：横10.8m × 縦0.9m　／　ひな壇前方から舞台袖まで：5.0m + 1.2m</div></section><div className="pdf-info-grid"><section><h2>利用備品・数量</h2><dl><div><dt>ピアノ</dt><dd>{usePiano ? "使用" : "不使用"}</dd></div><div><dt>マイク</dt><dd>{counts.microphones}本</dd></div><div><dt>マイクスタンド</dt><dd>{counts.micStands}本</dd></div><div><dt>出演者椅子</dt><dd>{counts.playerChairs}脚</dd></div><div><dt>折り畳み椅子</dt><dd>{counts.foldingChairs}脚</dd></div><div><dt>電源（コンセント）</dt><dd>{usePower ? "使用" : "不使用"}</dd></div></dl></section><section><h2>搬入・音響</h2><dl><div><dt>車での搬入</dt><dd>{carDelivery}</dd></div><div><dt>搬入希望日</dt><dd>{deliveryDate}</dd></div><div><dt>搬入物</dt><dd>{loading.join("、") || "なし"}</dd></div><div><dt>音響・映像備品</dt><dd>{soundVideo}</dd></div><div><dt>音出し指示</dt><dd>{soundCue}</dd></div></dl></section></div><section className="pdf-notes"><h2>その他担当者への要望</h2><p>{notes || "なし"}</p></section><footer>教育委員会提出用／当日設営用資料</footer></section>
      </div>
    </section>
    {submitModal && <div className="submit-modal-backdrop" role="presentation"><section className="submit-modal" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title"><div className={`submit-modal-icon ${submitModal}`}>{submitModal === "success" ? "✓" : "…"}</div><p className="mini-label">{submitModal === "success" ? "SUBMISSION COMPLETE" : "SUBMITTING"}</p><h2 id="submit-modal-title">{submitModal === "success" ? "舞台配置を提出しました" : "提出内容を送信しています"}</h2><p>{submitModal === "success" ? <>{schoolName || "学校"}の提出内容を受け付けました。管理者ページで設営資料として確認・PDF作成できます。学校担当者の操作はこれで完了です。</> : "画面を閉じずに、そのままお待ちください。"}</p>{submitModal === "success" && <button onClick={() => setSubmitModal(null)} autoFocus>確認しました</button>}</section></div>}
  </main>;
}

function Count({ label, suffix, value, max, onChange }: { label: string; suffix: string; value: number; max?: number; onChange: (value: number) => void }) {
  return <label className="count-input"><span>{label}</span><button onClick={() => onChange(value - 1)} type="button">−</button><input type="number" value={value} min="0" max={max} onChange={(e) => onChange(Number(e.target.value))} /><button onClick={() => onChange(value + 1)} type="button">＋</button><small>{suffix}</small></label>;
}

function Field({ label, type, value, options, placeholder, suffix, onChange }: { label: string; type: "text" | "number" | "select"; value?: string; options?: string[]; placeholder?: string; suffix?: string; onChange: (value: string) => void }) {
  return <label className="application-field"><span>{label}</span>{type === "select" ? <select value={value} onChange={(event) => onChange(event.target.value)}>{options?.map((option) => <option key={option}>{option}</option>)}</select> : <div><input type={type} placeholder={placeholder} min="0" onChange={(event) => onChange(event.target.value)} />{suffix && <small>{suffix}</small>}</div>}</label>;
}
