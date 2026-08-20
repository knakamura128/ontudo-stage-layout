"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

type StageObject = { id: number; label: string; icon: string; kind: "instrument" | "stand" | "chair"; x: number; y: number; power: boolean };
type StagePoint = { left: number; top: number };
type PlayerSeat = "player" | "folding";
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

const playerSlots = Array.from({ length: 100 }, (_, index) => ({ index }));
const blankPlayerLabels = () => Object.fromEntries(playerSlots.map(({ index }) => [index, ""]));

const loadingOptions = ["管楽器", "ティンパニ", "ドラムセット", "バスドラム", "シロフォン", "ビブラフォン", "グロッケン", "コンガ", "ボンゴ", "ウィンドチャイム", "サスペンドシンバル", "ウッドブロック", "パーカッション小物"];
const loadInItemMeta: Record<string, Pick<StageObject, "label" | "icon" | "kind">> = {
  "管楽器": { label: "管楽器", icon: "🎺", kind: "instrument" }, "ティンパニ": { label: "ティンパニ", icon: "🥁", kind: "instrument" }, "ドラムセット": { label: "ドラム", icon: "🥁", kind: "instrument" }, "バスドラム": { label: "バスドラム", icon: "🥁", kind: "instrument" }, "シロフォン": { label: "シロフォン", icon: "🎵", kind: "instrument" }, "ビブラフォン": { label: "ビブラフォン", icon: "🎶", kind: "instrument" }, "グロッケン": { label: "グロッケン", icon: "🎶", kind: "instrument" }, "コンガ": { label: "コンガ", icon: "🪘", kind: "instrument" }, "ボンゴ": { label: "ボンゴ", icon: "🪘", kind: "instrument" }, "ウィンドチャイム": { label: "ウィンドチャイム", icon: "🎐", kind: "instrument" }, "サスペンドシンバル": { label: "サスペンドシンバル", icon: "◯", kind: "instrument" }, "ウッドブロック": { label: "ウッドブロック", icon: "▰", kind: "instrument" }, "パーカッション小物": { label: "打楽器小物", icon: "▤", kind: "instrument" },
};
const palette = [
  { label: "譜面台", icon: "🎼", kind: "stand" as const },
  { label: "マイク", icon: "🎤", kind: "instrument" as const }, { label: "マイクスタンド", icon: "🎙️", kind: "stand" as const },
  { label: "キーボード", icon: "🎹", kind: "instrument" as const }, { label: "その他", icon: "＋", kind: "instrument" as const },
];
const initialObjects: StageObject[] = [
  { id: 1, label: "ウィンドチャイム", icon: "🎐", kind: "instrument", x: 18, y: 13, power: false },
  { id: 2, label: "サスペンドシンバル", icon: "◯", kind: "instrument", x: 15, y: 24, power: false },
  { id: 3, label: "ボンゴ", icon: "🪘", kind: "instrument", x: 24, y: 14, power: false },
  { id: 4, label: "コンガ", icon: "🪘", kind: "instrument", x: 31, y: 14, power: false },
  { id: 5, label: "小物", icon: "▤", kind: "instrument", x: 22, y: 23, power: false },
  { id: 6, label: "ウッドブロック", icon: "▰", kind: "instrument", x: 30, y: 23, power: false },
  { id: 7, label: "バスドラム", icon: "🥁", kind: "instrument", x: 13, y: 48, power: false },
  { id: 8, label: "ドラム", icon: "🥁", kind: "instrument", x: 24, y: 57, power: false },
  { id: 9, label: "ティンパニ", icon: "🥁", kind: "instrument", x: 39, y: 49, power: false },
  { id: 10, label: "ティンパニ", icon: "🥁", kind: "instrument", x: 66, y: 50, power: false },
  { id: 11, label: "チューバベル", icon: "🔔", kind: "instrument", x: 59, y: 55, power: false },
  { id: 12, label: "シロフォン", icon: "🎵", kind: "instrument", x: 10, y: 75, power: false },
  { id: 13, label: "グロッケン", icon: "🎶", kind: "instrument", x: 21, y: 71, power: false },
  { id: 14, label: "指揮台", icon: "▣", kind: "stand", x: 50, y: 84, power: false },
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
  const [newPlayerLabel, setNewPlayerLabel] = useState("");
  const [newPlayerSeat, setNewPlayerSeat] = useState<PlayerSeat>("player");
  const [counts, setCounts] = useState({ microphones: 0, micStands: 0, playerChairs: 0, foldingChairs: 0 });
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [authUser, setAuthUser] = useState<SignedInUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);

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
      const data = await response.json() as { submission?: { id: number; school_name: string; program_name: string; performer_total: number; payload?: { layouts?: Record<number, ProgramLayout>; programs?: string[]; counts?: Partial<typeof counts>; carDelivery?: "有" | "無"; deliveryDate?: string; soundVideo?: "あり" | "なし"; soundCue?: "あり" | "なし"; media?: string[]; usePower?: boolean; usePiano?: boolean; useChildPianoBench?: boolean; bringChildPianoBench?: boolean; loading?: string[]; poweredLoading?: string[]; notes?: string } }; error?: string };
      if (!response.ok || !data.submission) throw new Error(data.error || "申請内容を読み込めませんでした。");
      return data.submission;
    }).then((submission) => {
      const saved = submission.payload ?? {};
      setSchoolName(submission.school_name); setPerformerTotal(submission.performer_total);
      const savedPrograms = Array.isArray(saved.programs) ? saved.programs.slice(0, 3) : [];
      const savedProgramIndex = Math.max(0, savedPrograms.findIndex((program) => program === submission.program_name));
      setPrograms([submission.program_name, "", ""]);
      const savedLayout = saved.layouts?.[savedProgramIndex] ?? saved.layouts?.[0];
      if (savedLayout) setLayouts((now) => ({ ...now, 0: savedLayout }));
      setCounts({ microphones: Number(saved.counts?.microphones) || 0, micStands: Number(saved.counts?.micStands) || 0, playerChairs: Number(saved.counts?.playerChairs) || 0, foldingChairs: Number(saved.counts?.foldingChairs) || 0 });
      setCarDelivery(saved.carDelivery === "有" ? "有" : "無"); setDeliveryDate(saved.deliveryDate ?? ""); setSoundVideo(saved.soundVideo === "あり" ? "あり" : "なし"); setSoundCue(saved.soundCue === "あり" ? "あり" : "なし"); setMedia(Array.isArray(saved.media) ? saved.media : []); setUsePower(Boolean(saved.usePower)); setUsePiano(Boolean(saved.usePiano)); setUseChildPianoBench(Boolean(saved.useChildPianoBench)); setBringChildPianoBench(Boolean(saved.bringChildPianoBench)); setLoading(Array.isArray(saved.loading) ? saved.loading : []); setPoweredLoading(Array.isArray(saved.poweredLoading) ? saved.poweredLoading : []); setNotes(saved.notes ?? "");
      setActiveProgram(0); setEditingSubmissionId(submission.id); setSaved(false); setSubmissionMessage("申請内容を読み込みました。修正後に保存または再提出してください。");
    }).catch((error: Error) => { loadedEditIdRef.current = null; setSubmissionMessage(error.message || "申請内容を読み込めませんでした。"); });
  }, [isAdmin]);
  const submissionChecks = [
    { label: "団体情報（学校名）", ok: Boolean(schoolName.trim()) },
    { label: "出演人数", ok: performerTotal > 0 },
    { label: "演目", ok: Boolean(programs.some((program) => program.trim())) },
    { label: "配置図の演奏者・備品", ok: Object.values(layouts).some((layout) => Object.values(layout.playerLabels).some(Boolean) || layout.objects.length > 0) },
  ];
  const missingChecks = submissionChecks.filter((item) => !item.ok);
  const saveRegistration = async (submit: boolean) => {
    setSubmissionMessage("");
    if (submit && missingChecks.length) { setSubmissionMessage("提出前チェックを完了してください。"); return; }
    try {
      const submissionKey = authUser ? undefined : (sessionStorage.getItem("music-stage-submission-key") ?? crypto.randomUUID());
      if (submissionKey) sessionStorage.setItem("music-stage-submission-key", submissionKey);
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolName, programName: programs[0], performerTotal, submit, submissionKey, submissionId: editingSubmissionId ?? undefined, payload: { layouts, programs, counts, carDelivery, deliveryDate, soundVideo, soundCue, media, usePower, usePiano, useChildPianoBench, bringChildPianoBench, loading, poweredLoading, notes } }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "保存できませんでした。");
      setSaved(true); setSubmissionMessage(submit ? (editingSubmissionId ? "修正内容を提出済みに更新しました。" : "提出しました。管理者ページで提出状況を確認できます。") : "下書きを保存しました。");
    } catch (error) { setSubmissionMessage(error instanceof Error ? error.message : "保存できませんでした。"); }
  };

  const layoutKey = 0;
  const activeLayout = layouts[layoutKey];
  const fanLayout = activeLayout.fanLayout;
  const objects = activeLayout.objects;
  const updateLayout = (updater: (layout: ProgramLayout) => ProgramLayout) => setLayouts((now) => ({ ...now, [layoutKey]: updater(now[layoutKey]) }));

  const players = playerSlots;
  const placedPlayerCount = players.filter((_, index) => Boolean(activeLayout.playerLabels[index])).length;

  const syncChairPlayers = (seat: PlayerSeat, targetCount: number) => updateLayout((now) => {
    const existing = Object.keys(now.playerLabels).map(Number).filter((index) => Boolean(now.playerLabels[index]) && (now.playerSeats[index] ?? "player") === seat).sort((a, b) => a - b);
    const playerLabels = { ...now.playerLabels }; const playerSeats = { ...now.playerSeats }; const playerPositions = { ...now.playerPositions };
    if (existing.length > targetCount) existing.slice(targetCount).forEach((index) => { playerLabels[index] = ""; delete playerSeats[index]; delete playerPositions[index]; });
    if (existing.length < targetCount) {
      const additions = targetCount - existing.length;
      const available = players.filter((_, index) => !playerLabels[index]).slice(0, additions).map(({ index }) => index);
      available.forEach((index) => { playerLabels[index] = "演奏者"; playerSeats[index] = seat; });
    }
    return { ...now, playerLabels, playerSeats, playerPositions };
  });
  const changeCount = (key: keyof typeof counts, value: number) => {
    const maximum = key === "playerChairs" ? 60 : key === "foldingChairs" ? 50 : key === "microphones" ? 4 : key === "micStands" ? 15 : Number.POSITIVE_INFINITY;
    const nextValue = Math.min(maximum, Math.max(0, value));
    setCounts((now) => ({ ...now, [key]: nextValue }));
    if (key === "playerChairs" || key === "foldingChairs") {
      syncChairPlayers(key === "playerChairs" ? "player" : "folding", nextValue);
      const totalSeats = key === "playerChairs" ? nextValue + counts.foldingChairs : counts.playerChairs + nextValue;
      if (totalSeats > 30) updateLayout((now) => ({ ...now, fanLayout: true }));
    }
    setSaved(false);
  };
  const addObject = (label: string, icon: string, kind: StageObject["kind"] = "instrument", power = false) => {
    updateLayout((now) => ({ ...now, objects: [...now.objects, { id: Date.now(), label, icon, kind, x: 50 + (now.objects.length % 3) * 7, y: 66 + (now.objects.length % 2) * 8, power }] }));
    setSaved(false);
  };
  const addLoadInObject = (item: string) => {
    const meta = loadInItemMeta[item];
    if (!meta) return;
    setLoading((now) => now.includes(item) ? now : [...now, item]);
    addObject(meta.label, meta.icon, meta.kind, usePower && poweredLoading.includes(item));
  };
  const addBulkObjects = (count: number, label: string, icon: string, kind: StageObject["kind"] = "instrument") => {
    if (count <= 0) return;
    updateLayout((now) => ({
      ...now,
      objects: [...now.objects, ...Array.from({ length: count }, (_, index) => ({ id: Date.now() + index, label, icon, kind, x: 50 + ((now.objects.length + index) % 5) * 8, y: 62 + (Math.floor((now.objects.length + index) / 5) % 3) * 9, power: false }))],
    }));
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
  const addPlayer = (seat = newPlayerSeat) => {
    const label = newPlayerLabel.trim() || "演奏者";
    const index = players.findIndex((_, current) => !activeLayout.playerLabels[current]);
    const countKey = seat === "player" ? "playerChairs" : "foldingChairs";
    const maximum = seat === "player" ? 60 : 50;
    if (!label || index === -1 || counts[countKey] >= maximum) return;
    updateLayout((now) => ({ ...now, playerLabels: { ...now.playerLabels, [index]: label }, playerSeats: { ...now.playerSeats, [index]: seat } }));
    setCounts((now) => ({ ...now, [countKey]: now[countKey] + 1 }));
    setSelectedPlayerIndex(index);
    setNewPlayerLabel("");
    setSaved(false);
  };
  const addBulkPlayers = (seat: PlayerSeat, count: number) => {
    if (count <= 0) return;
    const availableIndexes = players.filter((_, index) => !activeLayout.playerLabels[index]).slice(0, count).map((item) => item.index);
    if (!availableIndexes.length) return;
    updateLayout((now) => ({
      ...now,
      playerLabels: { ...now.playerLabels, ...Object.fromEntries(availableIndexes.map((index) => [index, "演奏者"])) },
      playerSeats: { ...now.playerSeats, ...Object.fromEntries(availableIndexes.map((index) => [index, seat])) },
    }));
    setSelectedPlayerIndex(availableIndexes[0]);
    setSaved(false);
  };
  const clearStageLayout = () => {
    if (!window.confirm("この演目の演奏者・備品の配置をすべてクリアしますか？")) return;
    updateLayout((now) => ({ ...now, fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} }));
    setCounts((now) => ({ ...now, playerChairs: 0, foldingChairs: 0 }));
    setSelectedId(null);
    setSelectedPlayerIndex(null);
    setSaved(false);
  };
  const removeObject = (id: number) => {
    const removed = objects.find((item) => item.id === id);
    updateLayout((now) => ({ ...now, objects: now.objects.filter((item) => item.id !== id) }));
    const loadingItem = removed && Object.entries(loadInItemMeta).find(([, meta]) => meta.label === removed.label)?.[0];
    if (loadingItem && !objects.some((item) => item.id !== id && item.label === removed.label)) {
      setLoading((now) => now.filter((item) => item !== loadingItem));
      setPoweredLoading((now) => now.filter((item) => item !== loadingItem));
    }
    setSelectedId(null);
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

    // ひな壇上の演奏者は、扇状配置の切替に関わらず直線配置に保つ。
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
      <nav className="nav-list"><button className="nav-item is-active"><span className="nav-icon">⌘</span> 舞台配置</button><button className="nav-item" onClick={() => document.getElementById("organization")?.scrollIntoView({ behavior: "smooth" })}><span className="nav-icon">◇</span> 団体情報</button><button className="nav-item" onClick={() => document.getElementById("precheck")?.scrollIntoView({ behavior: "smooth" })}><span className="nav-icon">✓</span> 提出前チェック <span className={missingChecks.length ? "nav-dot" : ""} /></button>{isAdmin && <a className="nav-item admin-nav-link" href="/admin"><span className="nav-icon">⚙</span> 管理者ページ</a>}</nav>
      <div className="deadline-card"><span>提出締切</span><strong>10月16日（金）</strong><small>原本の様式に準拠</small></div><div className="nav-foot">お問い合わせ　›</div>
    </aside>

    <section className="workspace">
      <header className="topbar"><div className="crumbs">ホーム <span>／</span> 舞台配置</div><div className="account auth-account">{authUser ? <><span className="account-email">{authUser.email}</span><span className={`role-badge ${authUser.role}`}>{authUser.role === "admin" ? "管理者" : "閲覧者"}</span><button className="signout-button" onClick={() => void signOut()}>ログアウト</button></> : <><span className="public-entry">どなたでも作成・提出できます</span><div ref={googleButtonRef} className="google-signin" aria-label="管理者ログイン" /></>}</div></header>
      {authError && <div className="auth-notice"><b>ログインできませんでした</b><small>{authError}</small></div>}
      <div className="content-wrap form-content">
        <section className="page-heading"><div><p className="section-kicker">STAGE LAYOUT / 1104</p><h1>ステージ配置・備品申請</h1><p className="lead">第61回 音楽のつどい　舞台配置図</p></div><div className="saved-state"><span /> {editingSubmissionId ? `申請 #${editingSubmissionId} を編集中` : saved ? "登録内容を保存しました" : "どなたでも入力・提出できます"}</div></section>

        <section className="notice-card"><b>固定配置について</b><p>ピアノの位置・向き、ひな壇は会場の固定配置です。演奏者・椅子・楽器などの配置物は、ドラッグで自由に調整できます。</p></section>

        <section className="request-summary" id="organization">
          <label><span>学校名</span><input value={schoolName} onChange={(event) => { setSchoolName(event.target.value); setSaved(false); }} placeholder="学校名を入力" /></label><label><span>出演人数（1曲目）</span><div className="summary-number"><input type="number" value={performerTotal || ""} min="0" onChange={(event) => { setPerformerTotal(Math.max(0, Number(event.target.value))); setSaved(false); }} placeholder={`${placedPlayerCount}`} /><small>名</small></div></label><div><span>舞台サイズ</span><strong>幅15m × 奥行12m</strong></div><label><span>演目（1曲目）</span><input value={programs[0]} onChange={(event) => { const value = event.target.value; setPrograms((now) => [value, "", ""]); setSaved(false); }} placeholder="例：合奏『風のシンフォニー』" /></label>
        </section>

        <div className="layout-grid detailed-grid">
          <section className="stage-card detailed-stage-card" id="stage">
            <div className="card-head"><div><p className="mini-label">STAGE LAYOUT / FIRST PROGRAM</p><h2>舞台配置図 <span className="view-hint">（{programs[0] || "1曲目"}）</span></h2></div><div className="stage-actions"><button className="clear-layout" onClick={clearStageLayout}>配置図をすべてクリア</button><label className="fan-toggle"><input type="checkbox" checked={fanLayout} onChange={(e) => { updateLayout((now) => ({ ...now, fanLayout: e.target.checked })); setSaved(false); }} /><span />ひな壇以外を扇状に配置</label></div></div>
            <div className="stage-legend"><span><i className="legend-coral" />演奏者 {placedPlayerCount}名</span><span><i className="legend-navy" />固定備品</span><span><i className="legend-power" />電源使用</span><span>ひな壇上は直線固定</span><span>演奏者・備品をドラッグして配置</span><span>備品右上の × で削除</span></div>
            <div className="stage-outline"><div className="stage-dimension top">奥行 12m</div><div className="stage-dimension bottom">幅 15m</div><div className="curtain left" /><div className="curtain right" />
              <div className="stage-floor large-floor" ref={stageRef} onPointerMove={moveObject} onPointerUp={() => { setDraggingId(null); setDraggingPlayerIndex(null); }} onPointerLeave={() => { setDraggingId(null); setDraggingPlayerIndex(null); }}>
                <div className="fixed-piano"><span>🎹 固定</span><b>PIANO</b></div>
                <div className="riser riser-top"><b>ひな壇 2段目</b><span>椅子 14</span>{Array.from({ length: 6 }).map((_, i) => <i key={i} />)}</div>
                <div className="riser riser-low"><b>ひな壇 1段目</b><span>椅子 16</span>{Array.from({ length: 7 }).map((_, i) => <i key={i} />)}</div>
                {!usePiano && <div className="unused-label">ピアノ 不使用</div>}
                {players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); const seat = activeLayout.playerSeats[index] ?? "player"; return label ? <button className={`player-dot ${seat} ${selectedPlayerIndex === index ? "is-selected" : ""}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }} key={player.index} onClick={() => { setSelectedPlayerIndex(index); setSelectedId(null); }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDraggingPlayerIndex(index); setDraggingId(null); setSaved(false); }} aria-label={`${label}の演奏者を移動`}><span>{label}</span></button> : null; })}
                {objects.map((item) => <div key={item.id} className="stage-object-wrap" style={{ left: `${item.x}%`, top: `${item.y}%` }}><button className={`stage-object ${item.kind} ${selectedId === item.id ? "is-selected" : ""}`} onClick={() => setSelectedId(item.id)} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDraggingId(item.id); setDraggingPlayerIndex(null); setSelectedId(item.id); setSaved(false); }} aria-label={`${item.label}を移動`}><span className="stage-object-icon">{item.icon}</span><span>{item.label}</span>{item.power && <em>⚡</em>}</button><button className="stage-object-delete" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeObject(item.id); }} aria-label={`${item.label}を削除`} title={`${item.label}を削除`}>×</button></div>)}
                <div className="audience">客　席</div>
              </div>
            </div>
            <div className="player-editor"><label><span>演奏者の表記</span><input value={newPlayerLabel} onChange={(event) => setNewPlayerLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addPlayer(); }} placeholder="例：Tp、Hr、Euph" maxLength={12} /></label><div className="seat-picker"><button className={newPlayerSeat === "player" ? "is-active" : ""} onClick={() => setNewPlayerSeat("player")}>🪑 演奏者椅子</button><button className={newPlayerSeat === "folding" ? "is-active" : ""} onClick={() => setNewPlayerSeat("folding")}>▱ 折り畳み椅子</button></div><button onClick={() => addPlayer()}>演奏者を配置</button><small>空欄なら「演奏者」として追加し、クリック後に表記を編集できます。</small></div>
            {selectedPlayerIndex !== null && <div className="object-editor performer-editor-selected"><b>選択中の演奏者を編集</b><input value={activeLayout.playerLabels[selectedPlayerIndex] ?? ""} onChange={(event) => { const label = event.target.value; updateLayout((now) => ({ ...now, playerLabels: { ...now.playerLabels, [selectedPlayerIndex]: label } })); setSaved(false); }} maxLength={12} aria-label="演奏者の表記" /><button onClick={() => { const seat = activeLayout.playerSeats[selectedPlayerIndex] ?? "player"; updateLayout((now) => { const playerLabels = { ...now.playerLabels, [selectedPlayerIndex]: "" }; const playerPositions = { ...now.playerPositions }; const playerSeats = { ...now.playerSeats }; delete playerPositions[selectedPlayerIndex]; delete playerSeats[selectedPlayerIndex]; return { ...now, playerLabels, playerPositions, playerSeats }; }); setCounts((now) => ({ ...now, [seat === "player" ? "playerChairs" : "foldingChairs"]: Math.max(0, now[seat === "player" ? "playerChairs" : "foldingChairs"] - 1) })); setSelectedPlayerIndex(null); setSaved(false); }}>削除</button></div>}
            {selectedId !== null && <div className="object-editor"><b>選択中の配置物</b><span>{objects.find((item) => item.id === selectedId)?.icon} {objects.find((item) => item.id === selectedId)?.label}</span><label><input type="checkbox" checked={objects.find((item) => item.id === selectedId)?.power ?? false} onChange={(e) => { updateLayout((now) => ({ ...now, objects: now.objects.map((item) => item.id === selectedId ? { ...item, power: e.target.checked } : item) })); if (e.target.checked) setUsePower(true); setSaved(false); }} />電源を使用</label><button onClick={() => removeObject(selectedId)}>削除</button></div>}
          </section>

          <section className="control-panel comprehensive-panel">
            <div className="panel-head"><div><p className="mini-label">EQUIPMENT & DELIVERY</p><h2>申請内容</h2></div><span className="form-no">様式 1104</span></div>
            <section className="form-section"><h3>利用備品</h3><label className="switch-line"><input type="checkbox" checked={usePiano} onChange={(e) => { setUsePiano(e.target.checked); setSaved(false); }} /><span />ピアノを使用する <small>（位置固定）</small></label><label className="switch-line"><input type="checkbox" checked={useChildPianoBench} onChange={(e) => { setUseChildPianoBench(e.target.checked); if (!e.target.checked) setBringChildPianoBench(false); setSaved(false); }} /><span />子ども用ピアノ台を使用する</label><label className="switch-line"><input type="checkbox" checked={bringChildPianoBench} disabled={!useChildPianoBench} onChange={(e) => { setBringChildPianoBench(e.target.checked); setSaved(false); }} /><span />子ども用ピアノ台を持ち込む</label><label className="switch-line"><input type="checkbox" checked={objects.some((item) => item.label === "指揮台")} onChange={(e) => toggleStageObject("指揮台", "▣", "stand", e.target.checked)} /><span />指揮台を使用する <small>（配置図上で移動可）</small></label><label className="switch-line"><input type="checkbox" checked={objects.some((item) => item.label === "指揮者譜面台")} onChange={(e) => toggleStageObject("指揮者譜面台", "🎼", "stand", e.target.checked)} /><span />指揮者譜面台を使用する <small>（配置図上で移動可）</small></label></section>
            <section className="form-section count-section"><h3>確定使用数</h3><Count label="マイク" suffix="本（最大4）" value={counts.microphones} max={4} onChange={(v) => changeCount("microphones", v)} /><Count label="マイクスタンド" suffix="本（最大15）" value={counts.micStands} max={15} onChange={(v) => changeCount("micStands", v)} /><Count label="演奏者椅子" suffix="脚（最大60）" value={counts.playerChairs} max={60} onChange={(v) => changeCount("playerChairs", v)} /><Count label="折りたたみ椅子" suffix="脚（最大50）" value={counts.foldingChairs} max={50} onChange={(v) => changeCount("foldingChairs", v)} /><p className="move-help">椅子数を変更すると、演奏者として舞台図に自動で追加・削除されます。ひな壇は上段14席・下段16席、超過分は扇状配置できます。</p></section>
          </section>
        </div>

        <section className="equipment-workspace">
          <div className="equipment-heading"><div><p className="mini-label">LOAD-IN & OBJECT PALETTE</p><h2>搬入物・舞台備品を配置</h2><p>追加したい種類のタグを押すと、舞台図へ1つ追加されます。追加後はドラッグで動かせます。</p></div><div className="chosen-count">配置した種類 <b>{loading.length}</b> 件</div></div>
          <label className="switch-line power-entry"><input type="checkbox" checked={usePower} onChange={(e) => { setUsePower(e.target.checked); if (!e.target.checked) setPoweredLoading([]); setSaved(false); }} /><span />電源（コンセント）を使用する <small>電源を使う搬入物の⚡をONにします</small></label>
          <div className="loadin-tag-grid" aria-label="搬入物を舞台へ追加">{loadingOptions.map((item) => { const meta = loadInItemMeta[item]; const placedCount = objects.filter((object) => object.label === meta.label).length; const isPowered = poweredLoading.includes(item); return <div className="loadin-tag" key={item}><button className={placedCount ? "is-placed" : ""} onClick={() => addLoadInObject(item)} aria-label={`${item}を舞台へ追加`}><span className="tool-icon">{meta.icon}</span><span>{item}</span><small>{placedCount ? `配置 ${placedCount}` : "舞台へ追加"}</small></button><button className={`power-choice ${isPowered ? "is-powered" : ""}`} disabled={!usePower || !placedCount} onClick={() => { setPoweredLoading((now) => now.includes(item) ? now.filter((current) => current !== item) : [...now, item]); setSaved(false); }} title={`${item}で電源を使用`}>⚡</button></div>; })}</div>
          <div className="object-palette"><div className="palette-label">舞台備品</div>{palette.map((item) => <button key={item.label} onClick={() => addObject(item.label, item.icon, item.kind)}><span className="tool-icon">{item.icon}</span><span>{item.label}</span><small>舞台へ追加</small></button>)}</div>
        </section>

        <section className="application-card">
          <div className="application-head"><div><p className="mini-label">APPLICATION FORM / 1)-3)</p><h2>舞台使用機器・搬出入等申請</h2><p>申請書の入力項目を、舞台配置と同じ画面で管理します。</p></div><span>提出期限　<strong>10月16日（金）</strong></span></div>
          <div className="application-grid">
            <section className="application-section"><div className="application-number">1</div><div className="application-body"><h3>車での搬入出</h3><div className="field-row"><Field label="搬入出" type="select" value={carDelivery === "有" ? "あり" : "なし"} options={["あり", "なし"]} onChange={(value) => { setCarDelivery(value === "あり" ? "有" : "無"); setSaved(false); }} />{carDelivery === "有" && <Field label="搬入希望日" type="select" value={deliveryDate} options={["前日（11/13 18時〜19時）", "当日（11/14 10時〜）"]} onChange={(value) => { setDeliveryDate(value); setSaved(false); }} />}</div>{carDelivery === "有" && <><Field label="搬入物" type="text" placeholder="搬入する主な楽器・機材" onChange={() => setSaved(false)} /><div className="field-row"><Field label="車両責任者氏名" type="text" placeholder="氏名" onChange={() => setSaved(false)} /><Field label="連絡先" type="text" placeholder="電話番号" onChange={() => setSaved(false)} /></div><div className="field-row"><Field label="車種（車高3m未満）" type="text" placeholder="車種" onChange={() => setSaved(false)} /><Field label="台数" type="number" suffix="台" onChange={() => setSaved(false)} /></div></>}</div></section>
            <section className="application-section"><div className="application-number">3</div><div className="application-body"><h3>音響・映像備品</h3><div className="field-row"><Field label="音響・映像備品の利用" type="select" value={soundVideo} options={["あり", "なし"]} onChange={(value) => { setSoundVideo(value as "あり" | "なし"); setSaved(false); }} /><Field label="演者から音響への音出し指示" type="select" value={soundCue} options={["あり", "なし"]} onChange={(value) => { setSoundCue(value as "あり" | "なし"); setSaved(false); }} /></div><div className="field-row"><Field label="音楽データ形式" type="text" placeholder="MP3、WAV、CD-DA" onChange={() => setSaved(false)} /><Field label="映像データ形式" type="text" placeholder="mp4、AVCHD" onChange={() => setSaved(false)} /></div><div className="media-field"><span>記録媒体</span><div>{["USB", "SD", "SDHC", "SDXC", "CD-R", "CD-RW", "BD", "DVD"].map((item) => <button className={media.includes(item) ? "is-selected" : ""} key={item} onClick={() => { setMedia((now) => now.includes(item) ? now.filter((current) => current !== item) : [...now, item]); setSaved(false); }}>{media.includes(item) ? "✓ " : ""}{item}</button>)}</div></div><p className="cable-note">電源が必要な機器の場合は、必ず電源ケーブルを持参してください。</p></div></section>
          </div>
        </section>

        <section className="notes-card"><div><p className="mini-label">REQUESTS FOR SETUP STAFF</p><h2>その他・設営担当への要望</h2><p>設営に関して伝えておきたいことがあれば、任意で入力してください。</p></div><textarea value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false); }} placeholder="任意入力" /></section>
        <section className="precheck-card" id="precheck"><div><p className="mini-label">PRE-SUBMISSION CHECK</p><h2>提出前チェック</h2><p>不足している項目を確認してから提出してください。</p></div><ul>{submissionChecks.map((item) => <li key={item.label} className={item.ok ? "is-ok" : ""}>{item.ok ? "✓" : "!"} {item.label}<span>{item.ok ? "入力済み" : "未入力"}</span></li>)}</ul></section>
        <section className="bottom-card" id="submit"><div><p className="mini-label">SUBMIT</p><h2>この内容で舞台配置を登録しますか？</h2><p>{submissionMessage || "提出前チェックを確認後、内容を提出してください。"}</p></div><div className="submit-actions"><button className="pdf-button" onClick={() => void saveRegistration(false)}>下書きを保存</button><button className={`submit-button ${saved ? "is-done" : ""}`} onClick={() => void saveRegistration(true)}>{saved ? "✓　提出済み" : "舞台配置を提出する　→"}</button></div></section>
        <section className="submission-pdf" aria-hidden="true"><header><p>令和8年度　音楽のつどい</p><h1>舞台配置・使用機器等 提出資料</h1><small>作成日　{new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(new Date())}</small></header><div className="pdf-meta"><div><span>学校名</span><b>{schoolName || "未入力"}</b></div><div><span>出演人数</span><b>{performerTotal || placedPlayerCount}名</b></div><div><span>演目</span><b>{programs[activeProgram] || "未入力"}</b></div></div><section className="pdf-section"><h2>舞台配置図</h2><div className="pdf-stage"><div className="pdf-piano">PIANO</div><div className="pdf-riser pdf-riser-top">ひな壇 2段目　椅子14</div><div className="pdf-riser pdf-riser-low">ひな壇 1段目　椅子16</div>{players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); const seat = activeLayout.playerSeats[index] ?? "player"; return label ? <span key={player.index} className={`pdf-player ${seat}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>{label}</span> : null; })}{objects.map((item) => <span key={item.id} className={`pdf-object ${item.kind}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>{item.icon} {item.label}{item.power ? " ⚡" : ""}</span>)}<div className="pdf-audience">客　席</div></div></section><div className="pdf-info-grid"><section><h2>利用備品・数量</h2><dl><div><dt>ピアノ</dt><dd>{usePiano ? "使用" : "不使用"}</dd></div><div><dt>マイク</dt><dd>{counts.microphones}本</dd></div><div><dt>マイクスタンド</dt><dd>{counts.micStands}本</dd></div><div><dt>演奏者椅子</dt><dd>{counts.playerChairs}脚</dd></div><div><dt>折り畳み椅子</dt><dd>{counts.foldingChairs}脚</dd></div><div><dt>電源（コンセント）</dt><dd>{usePower ? "使用" : "不使用"}</dd></div></dl></section><section><h2>搬入・音響</h2><dl><div><dt>車での搬入</dt><dd>{carDelivery}</dd></div><div><dt>搬入希望日</dt><dd>{deliveryDate}</dd></div><div><dt>搬入物</dt><dd>{loading.join("、") || "なし"}</dd></div><div><dt>音響・映像備品</dt><dd>{soundVideo}</dd></div><div><dt>音出し指示</dt><dd>{soundCue}</dd></div></dl></section></div><section className="pdf-notes"><h2>その他・設営担当への要望</h2><p>{notes || "なし"}</p></section><footer>第61回 音楽のつどい　舞台配置・使用機器等 提出資料</footer></section>
      </div>
    </section>
  </main>;
}

function Count({ label, suffix, value, max, onChange }: { label: string; suffix: string; value: number; max?: number; onChange: (value: number) => void }) {
  return <label className="count-input"><span>{label}</span><button onClick={() => onChange(value - 1)} type="button">−</button><input type="number" value={value} min="0" max={max} onChange={(e) => onChange(Number(e.target.value))} /><button onClick={() => onChange(value + 1)} type="button">＋</button><small>{suffix}</small></label>;
}

function Field({ label, type, value, options, placeholder, suffix, onChange }: { label: string; type: "text" | "number" | "select"; value?: string; options?: string[]; placeholder?: string; suffix?: string; onChange: (value: string) => void }) {
  return <label className="application-field"><span>{label}</span>{type === "select" ? <select value={value} onChange={(event) => onChange(event.target.value)}>{options?.map((option) => <option key={option}>{option}</option>)}</select> : <div><input type={type} placeholder={placeholder} min="0" onChange={(event) => onChange(event.target.value)} />{suffix && <small>{suffix}</small>}</div>}</label>;
}
