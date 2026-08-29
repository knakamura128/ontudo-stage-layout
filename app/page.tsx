"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

type StageObject = { id: number; label: string; icon: string; kind: "instrument" | "stand" | "chair"; x: number; y: number; power: boolean };
type StagePoint = { left: number; top: number };
type PlayerSeat = "player" | "folding" | "none";
type ProgramLayout = { fanLayout: boolean; autoPlacement?: "riser" | "floor"; showPerformers?: boolean; objects: StageObject[]; playerPositions: Record<number, StagePoint>; playerLabels: Record<number, string>; playerSeats: Record<number, PlayerSeat> };
type PlayerDrag = { indices: number[]; startX: number; startY: number; positions: Record<number, StagePoint> };
type SignedInUser = { email: string; name: string; role: "admin" | "viewer" };

const FIXED_STAGE_SIZE = { width: 15, depth: 12 };
const MAX_PERFORMERS = 150;
const SCHOOL_OPTIONS = ["仰高小学校", "駒込小学校", "巣鴨小学校", "清和小学校", "西巣鴨小学校", "豊成小学校", "朋有小学校", "朝日小学校", "池袋第一小学校", "池袋小学校", "南池袋小学校", "高南小学校", "目白小学校", "長崎小学校", "要小学校", "椎名町小学校", "富士見台小学校", "千早小学校", "高松小学校", "さくら小学校", "池袋本町小学校"];
const normalizedSchoolName = (value: string) => value.replace(/[\s　]/g, "").replace(/^豊島区立/, "").replace(/小学校$/, "");

const playerSlots = Array.from({ length: MAX_PERFORMERS }, (_, index) => ({ index }));
const blankPlayerLabels = () => Object.fromEntries(playerSlots.map(({ index }) => [index, ""]));

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
  const loadedEditIdRef = useRef<number | null>(null);
  const [programs, setPrograms] = useState(["", "", ""]);
  const [activeProgram, setActiveProgram] = useState(0);
  const [separatePrograms, setSeparatePrograms] = useState(false);
  const [programPerformers, setProgramPerformers] = useState([0, 0, 0]);
  const [schoolName, setSchoolName] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [performerTotal, setPerformerTotal] = useState(0);
  const [layouts, setLayouts] = useState<Record<number, ProgramLayout>>({
    0: { fanLayout: false, autoPlacement: "riser", objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} },
    1: { fanLayout: false, autoPlacement: "riser", objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} },
    2: { fanLayout: false, autoPlacement: "riser", objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} },
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
  const [draggingPlayers, setDraggingPlayers] = useState<PlayerDrag | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number | null>(null);
  const [selectedPlayerIndices, setSelectedPlayerIndices] = useState<number[]>([]);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [counts, setCounts] = useState({ microphones: 0, micStands: 0, podiums: 0, conductorStands: 0, musicStands: 0, playerChairs: 0, foldingChairs: 0 });
  const [customEquipmentName, setCustomEquipmentName] = useState("");
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [authUser, setAuthUser] = useState<SignedInUser | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [submitModal, setSubmitModal] = useState<"submitting" | "success" | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [stepMessage, setStepMessage] = useState("");
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingPage, setOnboardingPage] = useState(0);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(async (response) => response.ok ? response.json() : null)
      .then((data: { user?: SignedInUser } | null) => setAuthUser(data?.user ?? null))
      .catch(() => setAuthUser(null));
  }, []);

  useEffect(() => {
    if (!window.localStorage.getItem("music-stage-onboarding-seen")) setOnboardingOpen(true);
  }, []);

  const closeOnboarding = () => {
    window.localStorage.setItem("music-stage-onboarding-seen", "1");
    setOnboardingOpen(false);
  };

  const isAdmin = authUser?.role === "admin";
  useEffect(() => {
    if (!isAdmin) return;
    const requestedId = Number(new URLSearchParams(window.location.search).get("edit"));
    if (!Number.isSafeInteger(requestedId) || requestedId <= 0 || loadedEditIdRef.current === requestedId) return;
    loadedEditIdRef.current = requestedId;
    fetch(`/api/submissions/${requestedId}`).then(async (response) => {
      const data = await response.json() as { submission?: { id: number; school_name: string; program_name: string; performer_total: number; payload?: { applicantName?: string; layouts?: Record<number, ProgramLayout>; programs?: string[]; separatePrograms?: boolean; programPerformers?: number[]; counts?: Partial<typeof counts>; carDelivery?: "有" | "無"; deliveryDate?: string; soundVideo?: "あり" | "なし"; soundCue?: "あり" | "なし"; media?: string[]; usePower?: boolean; useChildPianoBench?: boolean; bringChildPianoBench?: boolean; loading?: string[]; poweredLoading?: string[]; notes?: string } }; error?: string };
      if (!response.ok || !data.submission) throw new Error(data.error || "申請内容を読み込めませんでした。");
      return data.submission;
    }).then((submission) => {
      const saved = submission.payload ?? {};
      setSchoolName(submission.school_name); setApplicantName(saved.applicantName ?? ""); setPerformerTotal(submission.performer_total);
      const savedPrograms = Array.isArray(saved.programs) ? saved.programs.slice(0, 3) : [];
      const savedProgramIndex = Math.max(0, savedPrograms.findIndex((program) => program === submission.program_name));
      setPrograms(savedPrograms.length ? [savedPrograms[0] ?? submission.program_name, savedPrograms[1] ?? "", savedPrograms[2] ?? ""] : [submission.program_name, "", ""]);
      setSeparatePrograms(Boolean(saved.separatePrograms));
      setProgramPerformers(Array.isArray(saved.programPerformers) ? [Number(saved.programPerformers[0]) || submission.performer_total, Number(saved.programPerformers[1]) || 0, Number(saved.programPerformers[2]) || 0] : [submission.performer_total, 0, 0]);
      const savedLayout = saved.layouts?.[savedProgramIndex] ?? saved.layouts?.[0];
      if (saved.separatePrograms && saved.layouts) setLayouts((now) => ({ ...now, ...saved.layouts }));
      else if (savedLayout) setLayouts((now) => ({ ...now, 0: savedLayout }));
      setCounts({ microphones: Number(saved.counts?.microphones) || 0, micStands: Number(saved.counts?.micStands) || 0, podiums: Number(saved.counts?.podiums) || 0, conductorStands: Number(saved.counts?.conductorStands) || 0, musicStands: Number(saved.counts?.musicStands) || 0, playerChairs: Number(saved.counts?.playerChairs) || 0, foldingChairs: Number(saved.counts?.foldingChairs) || 0 });
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
    setCurrentStep((step) => Math.min(5, step + 1));
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
      const response = await fetch("/api/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schoolName, programName: separatePrograms ? programs[0] : "配置図共通", performerTotal: primaryPerformerTotal, submit, submissionKey, submissionId: editingSubmissionId ?? undefined, payload: { applicantName, layouts, programs, separatePrograms, programPerformers, counts, carDelivery, deliveryDate, soundVideo, soundCue, media, usePower, usePiano, useChildPianoBench, bringChildPianoBench, loading, poweredLoading, notes } }) });
      const data = await response.json() as { id?: number; error?: string };
      if (!response.ok) throw new Error(data.error || "保存できませんでした。");
      setSaved(true); setSubmissionMessage(submit ? (editingSubmissionId ? "修正内容を提出済みに更新しました。以前の内容は管理者ページの更新履歴に残ります。" : "提出しました。学校担当者側でPDFを保存する必要はありません。管理者が設営資料をPDFで保存・印刷します。") : "下書きを保存しました。");
      if (submit) setSubmitModal("success");
    } catch (error) { if (submit) setSubmitModal(null); setSubmissionMessage(error instanceof Error ? error.message : "保存できませんでした。"); }
  };

  const layoutKey = separatePrograms ? activeProgram : 0;
  const activeLayout = layouts[layoutKey];
  const fanLayout = activeLayout.fanLayout;
  const autoPlacement = activeLayout.autoPlacement ?? "riser";
  const showPerformers = activeLayout.showPerformers !== false;
  const objects = activeLayout.objects;
  const selectedObject = selectedId === null ? undefined : objects.find((item) => item.id === selectedId);
  const updateLayoutAt = (targetLayoutKey: number, updater: (layout: ProgramLayout) => ProgramLayout) => setLayouts((now) => ({ ...now, [targetLayoutKey]: updater(now[targetLayoutKey]) }));
  const updateLayout = (updater: (layout: ProgramLayout) => ProgramLayout) => updateLayoutAt(layoutKey, updater);
  const setSelectedObjectPower = (power: boolean) => {
    if (selectedId === null) return;
    const hasPowerInOtherLayouts = Object.entries(layouts).some(([key, layout]) => Number(key) !== layoutKey && layout.objects.some((item) => item.power));
    setUsePower(hasPowerInOtherLayouts || power || objects.some((item) => item.id !== selectedId && item.power));
    updateLayout((now) => ({ ...now, objects: now.objects.map((item) => item.id === selectedId ? { ...item, power } : item) }));
    setSaved(false);
  };

  const players = playerSlots;
  const placedPlayerCount = players.filter((_, index) => Boolean(activeLayout.playerLabels[index])).length;
  const currentPerformerTotal = separatePrograms ? programPerformers[activeProgram] : performerTotal;
  const changePerformerTotal = (value: number) => {
    const nextValue = Math.min(MAX_PERFORMERS, Math.max(0, value));
    if (separatePrograms) setProgramPerformers((now) => now.map((count, index) => index === activeProgram ? nextValue : count));
    else setPerformerTotal(nextValue);
    syncPerformerCount(nextValue);
    setSaved(false);
  };

  const syncPerformerCount = (value: number, targetLayoutKey = layoutKey) => {
    const targetCount = Math.min(MAX_PERFORMERS, Math.max(0, value));
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
  const syncCountedObjects = (label: "ワイヤレスマイク" | "マイクスタンド" | "指揮台" | "指揮者譜面台" | "譜面台", icon: string, kind: StageObject["kind"], value: number) => {
    const settings = {
      "ワイヤレスマイク": { maximum: 5, countKey: "microphones" as const, positions: [{ x: 46, y: 62 }, { x: 55, y: 62 }, { x: 64, y: 62 }, { x: 50, y: 71 }, { x: 59, y: 71 }] },
      "マイクスタンド": { maximum: 5, countKey: "micStands" as const, positions: [{ x: 46, y: 62 }, { x: 55, y: 62 }, { x: 64, y: 62 }, { x: 50, y: 71 }, { x: 59, y: 71 }] },
      "指揮台": { maximum: 3, countKey: "podiums" as const, positions: [{ x: 47, y: 75 }, { x: 53, y: 75 }, { x: 50, y: 82 }] },
      "指揮者譜面台": { maximum: 1, countKey: "conductorStands" as const, positions: [{ x: 59, y: 74 }] },
      "譜面台": { maximum: 10, countKey: "musicStands" as const, positions: [{ x: 36, y: 62 }, { x: 44, y: 62 }, { x: 52, y: 62 }, { x: 60, y: 62 }, { x: 68, y: 62 }, { x: 40, y: 70 }, { x: 48, y: 70 }, { x: 56, y: 70 }, { x: 64, y: 70 }, { x: 72, y: 70 }] },
    }[label];
    const maximum = settings.maximum;
    const targetCount = Math.min(maximum, Math.max(0, value));
    updateLayout((now) => {
      const matchingLabels = label === "ワイヤレスマイク" ? [label, "マイク"] : [label];
      const matching = now.objects.filter((item) => matchingLabels.includes(item.label)).slice(0, targetCount).map((item) => ({ ...item, label, icon, kind }));
      const additions = Array.from({ length: Math.max(0, targetCount - matching.length) }, (_, index) => ({ id: Date.now() + index, label, icon, kind, ...(settings.positions[matching.length + index] ?? settings.positions.at(-1) ?? { x: 50, y: 70 }), power: false }));
      return { ...now, objects: [...now.objects.filter((item) => !matchingLabels.includes(item.label)), ...matching, ...additions] };
    });
    setCounts((now) => ({ ...now, [settings.countKey]: targetCount }));
    setSelectedId(null);
    setSaved(false);
  };
  const addObject = (label: string, icon: string, kind: StageObject["kind"] = "instrument", power = false) => {
    const id = Date.now() + objects.length;
    updateLayout((now) => ({ ...now, objects: [...now.objects, { id, label, icon, kind, x: 50 + (now.objects.length % 3) * 7, y: 66 + (now.objects.length % 2) * 8, power }] }));
    setSelectedId(id);
    setPlayerSelection([]);
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
  const setAutoPlacement = (value: "riser" | "floor") => {
    updateLayout((now) => ({ ...now, autoPlacement: value, fanLayout: value === "floor" ? now.fanLayout : false, playerPositions: {} }));
    setPlayerSelection([]);
    setSaved(false);
  };
  const clearStageLayout = () => {
    if (!window.confirm("この配置図の出演者・備品をすべてクリアしますか？")) return;
    updateLayout((now) => ({ ...now, fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels(), playerSeats: {} }));
    setCounts({ microphones: 0, micStands: 0, podiums: 0, conductorStands: 0, musicStands: 0, playerChairs: 0, foldingChairs: 0 });
    if (separatePrograms) setProgramPerformers((now) => now.map((count, index) => index === layoutKey ? 0 : count));
    else setPerformerTotal(0);
    setSelectedId(null);
    setPlayerSelection([]);
    setSaved(false);
  };
  const removeObject = (id: number) => {
    const removed = objects.find((item) => item.id === id);
    if (removed?.power) {
      const hasPowerInOtherLayouts = Object.entries(layouts).some(([key, layout]) => Number(key) !== layoutKey && layout.objects.some((item) => item.power));
      setUsePower(hasPowerInOtherLayouts || objects.some((item) => item.id !== id && item.power));
    }
    updateLayout((now) => ({ ...now, objects: now.objects.filter((item) => item.id !== id) }));
    if (removed?.label === "マイク" || removed?.label === "ワイヤレスマイク") setCounts((now) => ({ ...now, microphones: Math.max(0, now.microphones - 1) }));
    if (removed?.label === "マイクスタンド") setCounts((now) => ({ ...now, micStands: Math.max(0, now.micStands - 1) }));
    if (removed?.label === "指揮台") setCounts((now) => ({ ...now, podiums: Math.max(0, now.podiums - 1) }));
    if (removed?.label === "指揮者譜面台") setCounts((now) => ({ ...now, conductorStands: Math.max(0, now.conductorStands - 1) }));
    if (removed?.label === "譜面台") setCounts((now) => ({ ...now, musicStands: Math.max(0, now.musicStands - 1) }));
    setSelectedId(null);
    setSaved(false);
  };
  const removePlayer = (index: number) => {
    const seat = activeLayout.playerSeats[index] ?? "player";
    updateLayout((now) => { const playerLabels = { ...now.playerLabels, [index]: "" }; const playerPositions = { ...now.playerPositions }; const playerSeats = { ...now.playerSeats }; delete playerPositions[index]; delete playerSeats[index]; return { ...now, playerLabels, playerPositions, playerSeats }; });
    if (seat !== "none") setCounts((now) => ({ ...now, [seat === "player" ? "playerChairs" : "foldingChairs"]: Math.max(0, now[seat === "player" ? "playerChairs" : "foldingChairs"] - 1) }));
    if (separatePrograms) setProgramPerformers((now) => now.map((count, current) => current === layoutKey ? Math.max(0, count - 1) : count));
    else setPerformerTotal((now) => Math.max(0, now - 1));
    setPlayerSelection([]);
    setSaved(false);
  };
  const moveObject = (event: PointerEvent<HTMLElement>) => {
    if ((draggingId === null && draggingPlayers === null) || !stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const x = Math.min(94, Math.max(6, ((event.clientX - bounds.left) / bounds.width) * 100));
    const y = Math.min(90, Math.max(8, ((event.clientY - bounds.top) / bounds.height) * 100));
    if (draggingId !== null) updateLayout((now) => ({ ...now, objects: now.objects.map((item) => item.id === draggingId ? { ...item, x, y } : item) }));
    if (draggingPlayers !== null) {
      const deltaX = ((event.clientX - draggingPlayers.startX) / bounds.width) * 100;
      const deltaY = ((event.clientY - draggingPlayers.startY) / bounds.height) * 100;
      updateLayout((now) => ({
        ...now,
        playerPositions: {
          ...now.playerPositions,
          ...Object.fromEntries(draggingPlayers.indices.map((index) => [index, {
            left: Math.min(94, Math.max(6, draggingPlayers.positions[index].left + deltaX)),
            top: Math.min(90, Math.max(8, draggingPlayers.positions[index].top + deltaY)),
          }])),
        },
      }));
    }
  };
  const playerPosition = (position: number) => {
    const performersPerRow = 15;
    const performerCount = Math.max(1, placedPlayerCount);
    if (autoPlacement === "floor") {
      const row = Math.floor(position / performersPerRow);
      const inRow = position % performersPerRow;
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

    if (position < riserUpperCount) return { left: Number((22 + position * (56 / (riserUpperCount - 1))).toFixed(3)), top: 13 };
    if (position < riserCount) {
      const lowerIndex = position - riserUpperCount;
      return { left: Number((27 + lowerIndex * (47 / (riserLowerCount - 1))).toFixed(3)), top: 29 };
    }

    const outsideIndex = position - riserCount;
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
  };
  const setPlayerSelection = (indices: number[]) => { setSelectedPlayerIndices(indices); setSelectedPlayerIndex(indices.length === 1 ? indices[0] : null); };
  const clearPlayerSelection = () => setPlayerSelection([]);
  const startPlayerDrag = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    const additive = multiSelectMode || event.shiftKey;
    const indices = additive ? (selectedPlayerIndices.includes(index) ? selectedPlayerIndices : [...selectedPlayerIndices, index]) : [index];
    setPlayerSelection(indices);
    const positions = Object.fromEntries(indices.map((playerIndex) => [playerIndex, activeLayout.playerPositions[playerIndex] ?? playerPosition(playerIndex)]));
    stageRef.current?.setPointerCapture(event.pointerId);
    setDraggingPlayers({ indices, startX: event.clientX, startY: event.clientY, positions });
    setDraggingId(null);
    setSelectedId(null);
    setSaved(false);
  };
  const setPerformerPlacement = (enabled: boolean) => {
    updateLayout((now) => ({ ...now, showPerformers: enabled }));
    clearPlayerSelection();
    setMultiSelectMode(false);
    setSaved(false);
  };
  const navigateToStep = (step: number) => {
    const targets: Record<number, string> = { 1: "organization", 2: "stage", 3: "stage-equipment", 4: "common-application", 5: "precheck" };
    setCurrentStep(step);
    setStepMessage("");
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(targets[step])?.scrollIntoView({ behavior: "smooth", block: "start" })));
  };

  return <main className="app-shell">
    <aside className="side-nav" aria-label="主なメニュー">
      <div className="brand"><div className="brand-mark">♪</div><div><p className="brand-eyebrow">令和8年度</p><p className="brand-name">音楽のつどい</p></div></div>
      <nav className="nav-list"><button className="nav-item is-active"><span className="nav-icon">⌘</span> 舞台配置</button><button className="nav-item" onClick={() => document.getElementById("organization")?.scrollIntoView({ behavior: "smooth" })}><span className="nav-icon">◇</span> 団体情報</button><button className="nav-item" onClick={() => document.getElementById("precheck")?.scrollIntoView({ behavior: "smooth" })}><span className="nav-icon">✓</span> 提出前チェック <span className={missingChecks.length ? "nav-dot" : ""} /></button><a className="nav-item admin-nav-link" href="/admin"><span className="nav-icon">⚙</span> 管理者ページ</a></nav>
      <div className="deadline-card"><span>提出締切</span><strong>10月16日（金）</strong><small>原本の様式に準拠</small></div><div className="nav-foot">お問い合わせ　›</div>
    </aside>

    <section className="workspace">
      <header className="topbar"><div className="crumbs">ホーム <span>／</span> 舞台配置</div><div className="account"><span className="public-entry">どなたでも作成・提出できます</span></div></header>
      <div className="content-wrap form-content">
        <section className="page-heading"><div><p className="section-kicker">STAGE LAYOUT / 1104</p><h1>ステージ配置・備品申請</h1><p className="lead">第63回 音楽のつどい　舞台配置図</p></div><div className="saved-state"><span /> {editingSubmissionId ? (saved ? `申請 #${editingSubmissionId} を保存しました` : `申請 #${editingSubmissionId} を編集中（変更は未保存）`) : saved ? "登録内容を保存しました" : "どなたでも入力・提出できます"}</div></section>

        <nav className="entry-steps" aria-label="入力ステップ">{[[1, "基本情報"], [2, "配置図"], [3, "舞台備品"], [4, "共通申請"], [5, "確認・提出"]].map(([step, label]) => <button key={step} className={currentStep === step ? "is-active" : currentStep > step ? "is-complete" : ""} onClick={() => navigateToStep(Number(step))}><i>{currentStep > step ? "✓" : step}</i><span>{label}</span></button>)}</nav>
        <FlowGuide step={currentStep} separatePrograms={separatePrograms} onOpenDemo={() => { setOnboardingPage(1); setOnboardingOpen(true); }} />

        {currentStep === 1 && <><section className="request-summary" id="organization">
          <label><span>学校名</span><input list="school-options" value={schoolName} onChange={(event) => { setSchoolName(event.target.value); setSaved(false); }} onBlur={(event) => { const canonical = SCHOOL_OPTIONS.find((school) => normalizedSchoolName(school) === normalizedSchoolName(event.target.value)); if (canonical) setSchoolName(canonical); }} placeholder="学校名を選択または入力" /></label><label><span>申請者氏名 <small>（任意）</small></span><input value={applicantName} onChange={(event) => { setApplicantName(event.target.value); setSaved(false); }} placeholder="例：山田 太郎" /></label>{!separatePrograms && <label><span>出演人数</span><div className="summary-number"><input type="number" value={performerTotal || ""} min="0" max={MAX_PERFORMERS} onChange={(event) => changePerformerTotal(Number(event.target.value))} placeholder="0" /><small>名</small></div></label>}<label className="separate-program-toggle"><input type="checkbox" checked={separatePrograms} onChange={(event) => { const enabled = event.target.checked; setSeparatePrograms(enabled); if (enabled) { const count = programPerformers[0] || performerTotal; setProgramPerformers((now) => [count, now[1], now[2]]); syncPerformerCount(count, 0); } else setActiveProgram(0); setSaved(false); }} /><span aria-hidden="true" /><span className="toggle-copy"><b>演目ごとに配置を変える</b><small>配置変更がある学校のみ選択してください</small></span></label><datalist id="school-options">{SCHOOL_OPTIONS.map((school) => <option key={school} value={school} />)}</datalist>
        </section>
        {separatePrograms && <section className="program-layout-card"><div><p className="mini-label">PROGRAM-SPECIFIC LAYOUTS</p><h2>演目ごとの舞台配置</h2><p>配置を変える演目だけ、演目名と出演人数を入力してください。提出資料は演目ごとに1ページずつ出力されます。</p></div><div className="program-inputs">{[0, 1, 2].map((index) => <label key={index}><span>演目 {index + 1}</span><input value={programs[index]} onChange={(event) => { const value = event.target.value; setPrograms((now) => now.map((program, current) => current === index ? value : program)); setSaved(false); }} placeholder="例：合奏『風のシンフォニー』" /><span>出演人数</span><div className="summary-number"><input type="number" min="0" max={MAX_PERFORMERS} value={programPerformers[index] || ""} onChange={(event) => { const value = Math.max(0, Math.min(MAX_PERFORMERS, Number(event.target.value))); setProgramPerformers((now) => now.map((count, current) => current === index ? value : count)); syncPerformerCount(value, index); setSaved(false); }} /><small>名</small></div></label>)}</div><div className="program-tabs" aria-label="設定する演目">{[0, 1, 2].map((index) => <button key={index} className={activeProgram === index ? "is-active" : ""} onClick={() => { setActiveProgram(index); setSelectedId(null); clearPlayerSelection(); }} disabled={!programs[index].trim()}>{programs[index].trim() || `演目 ${index + 1}（未入力）`}</button>)}</div></section>}
        {stepMessage && <p className="step-message" role="alert">{stepMessage}</p>}<div className="step-actions"><button onClick={goToNextStep}>配置図へ進む →</button></div></>}

        {(currentStep === 2 || currentStep === 3) && <><section className="notice-card"><b>配置の手順</b><p>{separatePrograms ? "下の演目タブで切り替えて、演目ごとの出演者・備品配置を設定します。共通の搬入・音響申請は、このあと最後に入力します。" : "出演人数を入力すると、出演者が自動で配置されます。必要な椅子と舞台備品の数を指定し、配置図上でドラッグして位置を調整してください。"}</p></section>{separatePrograms && <section className="layout-program-selector" aria-label="配置を設定する演目"><div><b>配置を設定する演目</b><small>選択した演目の配置図だけを編集します。</small></div><div className="program-tabs">{[0, 1, 2].map((index) => <button key={index} className={activeProgram === index ? "is-active" : ""} onClick={() => { setActiveProgram(index); setSelectedId(null); clearPlayerSelection(); }} disabled={!programs[index].trim()}>{programs[index].trim() || `演目 ${index + 1}（未入力）`}</button>)}</div></section>}<div className="layout-grid detailed-grid">
          <section className="stage-card detailed-stage-card" id="stage">
            <div className="card-head"><div><p className="mini-label">STAGE LAYOUT / {separatePrograms ? `PROGRAM ${activeProgram + 1}` : "COMMON LAYOUT"}</p><h2>舞台配置図 <span className="view-hint">（{separatePrograms ? programs[layoutKey] : "共通配置"}）</span></h2></div><div className="stage-actions"><button className="clear-layout" onClick={clearStageLayout}>この配置図をクリア</button></div></div>
            <div className="stage-legend"><span><i className="legend-coral" />出演者 {currentPerformerTotal}名{showPerformers ? "を配置" : "（配置なし）"}</span><span><i className="legend-navy" />固定備品</span><span><i className="legend-power" />電源使用</span><span>出演者・椅子・備品をドラッグして配置</span><span>備品右上の × で削除</span></div>
            <div className="stage-howto" role="note"><b>配置のしかた</b><ol><li>出演者の位置を資料に載せない場合は「配置しない」を選びます</li><li>配置なしでも、必要な出演者椅子・折りたたみ椅子は配置できます</li><li>個別または複数選択で、まとめてドラッグして調整できます</li></ol></div>
            <section className="performer-placement-control" aria-labelledby="performer-placement-title"><div><b id="performer-placement-title">出演者を配置しますか？</b><small>人数だけを提出し、位置を載せないこともできます。</small></div><div role="group" aria-label="出演者を配置するか"><button type="button" className={showPerformers ? "is-active" : ""} aria-pressed={showPerformers} onClick={() => setPerformerPlacement(true)}><span>配置する</span><small>配置図に出演者を表示</small></button><button type="button" className={!showPerformers ? "is-active" : ""} aria-pressed={!showPerformers} onClick={() => setPerformerPlacement(false)}><span>配置しない</span><small>人数のみ資料に記載</small></button></div></section>
            {(showPerformers || counts.playerChairs + counts.foldingChairs > 0) && <><section className="auto-placement-picker" aria-labelledby="auto-placement-title"><div><b id="auto-placement-title">{showPerformers ? "出演者" : "椅子"}の自動配置先</b><small>選び直すと、{showPerformers ? "出演者" : "椅子"}を自動で並べ直します。</small></div><div role="group" aria-label={`${showPerformers ? "出演者" : "椅子"}の自動配置先`}><button type="button" className={autoPlacement === "riser" ? "is-active" : ""} aria-pressed={autoPlacement === "riser"} onClick={() => setAutoPlacement("riser")}><span>ひな壇を埋める</span><small>ひな壇から順に配置</small></button><button type="button" className={autoPlacement === "floor" ? "is-active" : ""} aria-pressed={autoPlacement === "floor"} onClick={() => setAutoPlacement("floor")}><span>ひな壇の下に並べる</span><small>前方の舞台に配置</small></button></div><label className={`auto-fan-toggle ${autoPlacement === "floor" ? "" : "is-disabled"}`}><input type="checkbox" disabled={autoPlacement !== "floor"} checked={fanLayout} onChange={(e) => { updateLayout((now) => ({ ...now, fanLayout: e.target.checked, playerPositions: {} })); setSaved(false); }} /><span /><b>ひな壇の下を扇状に配置</b><small>{autoPlacement === "floor" ? `前方舞台に並べる${showPerformers ? "出演者" : "椅子"}を、ゆるい弧に並べます。` : "「ひな壇の下に並べる」を選ぶと利用できます。"}</small></label></section><section className="multi-select-toolbar" aria-label={`${showPerformers ? "出演者" : "椅子"}の複数選択`}><div><b>{showPerformers ? "複数人" : "複数の椅子"}をまとめて動かす</b><small>PCはShift＋クリック、スマホは「複数選択」をONにして{showPerformers ? "出演者" : "椅子"}をタップします。</small></div><div><button type="button" className={multiSelectMode ? "is-active" : ""} aria-pressed={multiSelectMode} onClick={() => setMultiSelectMode((now) => !now)}>{multiSelectMode ? "複数選択中" : "複数選択"}</button><button type="button" onClick={() => setPlayerSelection(players.map((player) => player.index).filter((index) => showPerformers ? Boolean(activeLayout.playerLabels[index]) : (activeLayout.playerSeats[index] ?? "none") !== "none"))}>{showPerformers ? "全出演者を選択" : "全ての椅子を選択"}</button>{selectedPlayerIndices.length > 0 && <button type="button" className="clear-selection" onClick={clearPlayerSelection}>選択解除</button>}</div></section></>}
            <div className="stage-outline"><div className="stage-dimension top">奥行 {FIXED_STAGE_SIZE.depth}m</div><div className="stage-dimension bottom">幅 {FIXED_STAGE_SIZE.width}m</div><div className="curtain left" /><div className="curtain right" />
              <div className="stage-floor large-floor" ref={stageRef} onPointerMove={moveObject} onPointerUp={() => { setDraggingId(null); setDraggingPlayers(null); }} onPointerCancel={() => { setDraggingId(null); setDraggingPlayers(null); }}>
                <div className="fixed-piano"><span>🎹 固定</span><b>PIANO</b></div>
                <div className="riser riser-top"><b>ひな壇 2段目</b><span>椅子 14</span><small>横 12.6m × 縦 1.2m</small>{Array.from({ length: 6 }).map((_, i) => <i key={i} />)}</div>
                <div className="riser riser-low"><b>ひな壇 1段目</b><span>椅子 16</span><small>横 10.8m × 縦 0.9m</small>{Array.from({ length: 7 }).map((_, i) => <i key={i} />)}</div>
                {!usePiano && <div className="unused-label">ピアノ 不使用</div>}
                {!showPerformers && <div className="performers-skipped-note" aria-label={`出演者 ${currentPerformerTotal}名は配置図に表示しません`}>出演者の配置なし（{currentPerformerTotal}名）</div>}
                {showPerformers && players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); const seat = activeLayout.playerSeats[index] ?? "player"; return label ? <button className={`player-dot ${seat} ${selectedPlayerIndices.includes(index) ? "is-selected" : ""}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }} key={player.index} onPointerDown={(event) => { event.stopPropagation(); startPlayerDrag(index, event); }} aria-label={`${label}の出演者を${selectedPlayerIndices.includes(index) ? "選択中。" : "選択して"}移動`}><span>{label}</span></button> : null; })}
                {!showPerformers && players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); const seat = activeLayout.playerSeats[index] ?? "none"; const chairLabel = seat === "player" ? "出演者椅子" : "折りたたみ椅子"; return label && seat !== "none" ? <button className={`player-dot chair-only ${seat} ${selectedPlayerIndices.includes(index) ? "is-selected" : ""}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }} key={player.index} onPointerDown={(event) => { event.stopPropagation(); startPlayerDrag(index, event); }} aria-label={`${chairLabel}を${selectedPlayerIndices.includes(index) ? "選択中。" : "選択して"}移動`}><span>{chairLabel}</span></button> : null; })}
                {objects.map((item) => <div key={item.id} className="stage-object-wrap" style={{ left: `${item.x}%`, top: `${item.y}%` }}><button className={`stage-object ${item.kind} ${selectedId === item.id ? "is-selected" : ""}`} onClick={() => { setSelectedId(item.id); clearPlayerSelection(); }} onPointerDown={(event) => { event.stopPropagation(); stageRef.current?.setPointerCapture(event.pointerId); setDraggingId(item.id); setDraggingPlayers(null); setSelectedId(item.id); clearPlayerSelection(); setSaved(false); }} aria-label={`${item.label}を選択して移動`}><span className="stage-object-icon">{item.icon}</span><span>{item.label}</span>{item.power && <em>◆</em>}</button><button className="stage-object-delete" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); removeObject(item.id); }} aria-label={`${item.label}を削除`} title={`${item.label}を削除`}>×</button></div>)}
                <div className="audience">客　席</div>
              </div>
            </div>
            <div className="stage-measurements" aria-label="舞台寸法"><span><b>後方ひな壇</b> 横 12.6m × 縦 1.2m</span><span><b>前方ひな壇</b> 横 10.8m × 縦 0.9m</span><span><b>前方スペース</b> ひな壇前方から舞台袖まで 5.0m + 1.2m</span></div>
            {selectedPlayerIndices.length > 1 && <div className="object-editor performer-editor-selected multi-performer-editor" aria-live="polite"><b>{showPerformers ? `出演者 ${selectedPlayerIndices.length}名` : `椅子 ${selectedPlayerIndices.length}脚`}を選択中</b><small>選択した{showPerformers ? "出演者" : "椅子"}を、どれか1つをドラッグしてまとめて移動できます。</small><button className="delete-player" onClick={clearPlayerSelection}>選択解除</button></div>}
            {selectedPlayerIndex !== null && <div className="object-editor performer-editor-selected" aria-live="polite"><b>{showPerformers ? "出演者" : "椅子"}を選択中</b><small>{showPerformers ? "配置をドラッグで調整できます。削除すると出演人数も1名減ります。" : "椅子をドラッグで調整できます。出演人数は変わりません。"}</small>{showPerformers ? <button className="delete-player" onClick={() => removePlayer(selectedPlayerIndex)}>削除</button> : <button className="delete-player" onClick={clearPlayerSelection}>選択解除</button>}</div>}
            {selectedObject && <div className="object-editor"><b>選択中の配置物</b><span>{selectedObject.icon} {selectedObject.label}</span><label><input type="checkbox" checked={selectedObject.power} onChange={(e) => setSelectedObjectPower(e.target.checked)} />この備品で電源を使用</label><button onClick={() => removeObject(selectedObject.id)}>削除</button></div>}
          </section>

          <section className="control-panel comprehensive-panel">
            <div className="panel-head"><div><p className="mini-label">EQUIPMENT & DELIVERY</p><h2>申請内容</h2></div><span className="form-no">様式 1104</span></div>
            <section className="form-section"><h3>利用備品</h3><label className="switch-line"><input type="checkbox" checked={usePiano} onChange={(e) => { setUsePiano(e.target.checked); setSaved(false); }} /><span />ピアノを使用する <small>（位置固定）</small></label><label className="switch-line"><input type="checkbox" checked={useChildPianoBench} onChange={(e) => { setUseChildPianoBench(e.target.checked); if (!e.target.checked) setBringChildPianoBench(false); setSaved(false); }} /><span />子ども用ピアノ台を使用する</label><label className="switch-line"><input type="checkbox" checked={bringChildPianoBench} disabled={!useChildPianoBench} onChange={(e) => { setBringChildPianoBench(e.target.checked); setSaved(false); }} /><span />子ども用ピアノ台を持ち込む</label></section>
            <section className="form-section count-section"><h3>出演者・舞台備品の数量</h3><div className="quantity-tree"><div className="quantity-total"><span>出演人数</span><strong>{currentPerformerTotal}名</strong><small>配置図と連動</small></div><div className="quantity-tree-rows"><Count label="出演者" suffix={`名（最大${MAX_PERFORMERS}）`} value={currentPerformerTotal} max={MAX_PERFORMERS} onChange={changePerformerTotal} /><Count label="出演者椅子" suffix={`脚（最大60・出演者 ${placedPlayerCount}名まで）`} value={counts.playerChairs} max={Math.min(60, placedPlayerCount)} onChange={(v) => setSeatCounts(v, counts.foldingChairs)} /><Count label="折りたたみ椅子" suffix={`脚（最大50・残り ${Math.max(0, placedPlayerCount - counts.playerChairs)}名まで）`} value={counts.foldingChairs} max={Math.min(50, Math.max(0, placedPlayerCount - counts.playerChairs))} onChange={(v) => setSeatCounts(counts.playerChairs, v)} /></div></div><p className="move-help">出演者を増減すると、配置図の出演者も自動で増減します。椅子の数は出演者に反映され、舞台備品の数は配置図に追加されます。</p><Count label="ワイヤレスマイク" suffix="本（最大5・配置図に追加）" value={counts.microphones} max={5} onChange={(v) => syncCountedObjects("ワイヤレスマイク", "🎤", "instrument", v)} /><Count label="マイクスタンド" suffix="本（最大5・配置図に追加）" value={counts.micStands} max={5} onChange={(v) => syncCountedObjects("マイクスタンド", "🎙️", "stand", v)} /><Count label="指揮台" suffix="台（最大3・配置図に追加）" value={counts.podiums} max={3} onChange={(v) => syncCountedObjects("指揮台", "▣", "stand", v)} /><Count label="指揮者用譜面台" suffix="台（最大1・配置図に追加）" value={counts.conductorStands} max={1} onChange={(v) => syncCountedObjects("指揮者譜面台", "🎼", "stand", v)} /><Count label="譜面台" suffix="台（最大10・配置図に追加）" value={counts.musicStands} max={10} onChange={(v) => syncCountedObjects("譜面台", "🎼", "stand", v)} /></section>
          </section>
        </div>{currentStep === 2 && <div className="step-actions"><button className="secondary" onClick={() => setCurrentStep(1)}>← 基本情報へ戻る</button><button onClick={goToNextStep}>舞台備品へ進む →</button></div>}</>}

        {currentStep === 3 && <><section className="equipment-workspace" id="stage-equipment">
          <div className="equipment-heading"><div><p className="mini-label">STAGE EQUIPMENT</p><h2>舞台備品を配置</h2><p>必要な備品を押すと、上の配置図へ追加されます。追加された備品は赤枠で選択され、ドラッグで移動できます。</p></div></div>
          <label className={`switch-line power-entry ${selectedObject ? "" : "is-disabled"}`} aria-disabled={!selectedObject}><input type="checkbox" disabled={!selectedObject} checked={selectedObject?.power ?? false} onChange={(e) => setSelectedObjectPower(e.target.checked)} /><span />この備品で電源を使用する <small>{selectedObject ? `選択中：${selectedObject.label}　◆マークが配置図と資料に付きます` : "先に配置図上の備品をタップして選択してください。その他の備品・楽器を追加した直後にも設定できます。"}</small></label>
          <div className="object-palette"><label className="custom-equipment"><span>その他の備品・楽器</span><input value={customEquipmentName} onChange={(event) => setCustomEquipmentName(event.target.value)} placeholder="例：木琴、和太鼓" /><button type="button" disabled={!customEquipmentName.trim()} onClick={() => addObject(customEquipmentName.trim(), "●", "instrument")}>配置図に追加</button><small>必要な数だけ、同じ名称でも何度でも追加できます</small></label></div>
        </section><div className="step-actions"><button className="secondary" onClick={() => setCurrentStep(2)}>← 配置図へ戻る</button><button onClick={goToNextStep}>共通申請へ進む →</button></div></>}

        {currentStep === 4 && <><section className="application-card" id="common-application">
          <div className="application-head"><div><p className="mini-label">APPLICATION FORM / 1)-3)</p><h2>舞台使用機器・搬出入等申請</h2><p>申請書の入力項目を、舞台配置と同じ画面で管理します。</p></div><span>提出期限　<strong>10月16日（金）</strong></span></div>
          <div className="application-grid">
            <section className="application-section"><div className="application-number">1</div><div className="application-body"><h3>車での搬入出</h3><div className="field-row"><Field label="搬入出" type="select" value={carDelivery === "有" ? "あり" : "なし"} options={["あり", "なし"]} onChange={(value) => { setCarDelivery(value === "あり" ? "有" : "無"); setSaved(false); }} />{carDelivery === "有" && <Field label="搬入希望日" type="select" value={deliveryDate} options={["前日（11/13 18時〜19時）", "当日（11/14 10時〜）"]} onChange={(value) => { setDeliveryDate(value); setSaved(false); }} />}</div>{carDelivery === "有" && <><Field label="搬入物" type="text" value={loading.join("、")} placeholder="主な搬入物" onChange={(value) => { setLoading(value.split(/[、,]/).map((item) => item.trim()).filter(Boolean)); setSaved(false); }} /><div className="field-row"><Field label="車両責任者氏名" type="text" placeholder="氏名" onChange={() => setSaved(false)} /><Field label="連絡先" type="text" placeholder="電話番号" onChange={() => setSaved(false)} /></div><div className="field-row"><Field label="車種（車高3m未満）" type="text" placeholder="車種" onChange={() => setSaved(false)} /><Field label="台数" type="number" suffix="台" onChange={() => setSaved(false)} /></div></>}</div></section>
            <section className="application-section"><div className="application-number">3</div><div className="application-body"><h3>音響・映像備品</h3><div className="field-row"><Field label="音響・映像備品の利用" type="select" value={soundVideo} options={["あり", "なし"]} onChange={(value) => { setSoundVideo(value as "あり" | "なし"); setSaved(false); }} /><Field label="演者から音響への音出し指示" type="select" value={soundCue} options={["あり", "なし"]} onChange={(value) => { setSoundCue(value as "あり" | "なし"); setSaved(false); }} /></div><div className="field-row"><Field label="音楽データ形式" type="text" placeholder="MP3、WAV、CD-DA" onChange={() => setSaved(false)} /><Field label="映像データ形式" type="text" placeholder="mp4、AVCHD" onChange={() => setSaved(false)} /></div><div className="media-field"><span>記録媒体</span><div>{["USB", "SD", "SDHC", "SDXC", "CD-R", "CD-RW", "BD", "DVD"].map((item) => <button className={media.includes(item) ? "is-selected" : ""} key={item} onClick={() => { setMedia((now) => now.includes(item) ? now.filter((current) => current !== item) : [...now, item]); setSaved(false); }}>{media.includes(item) ? "✓ " : ""}{item}</button>)}</div></div><p className="cable-note">電源が必要な機器の場合は、必ず電源ケーブルを持参してください。</p></div></section>
          </div>
        </section>

        <section className="notes-card"><div><p className="mini-label">REQUESTS FOR SETUP STAFF</p><h2>その他担当者への要望</h2><p>当日の動きや配慮が必要なことがあれば、任意で入力してください。</p></div><textarea value={notes} onChange={(event) => { setNotes(event.target.value); setSaved(false); }} placeholder={"例）舞台へ入るタイミングを、ピアノの音をきっかけにしたいです。\n例）車椅子の出演者がいます。"} /></section><div className="step-actions"><button className="secondary" onClick={() => setCurrentStep(3)}>← 舞台備品へ戻る</button><button onClick={goToNextStep}>確認・提出へ進む →</button></div></>}
        {currentStep === 5 && <><section className="precheck-card" id="precheck"><div><p className="mini-label">PRE-SUBMISSION CHECK</p><h2>提出前チェック</h2><p>学校名・出演人数（配置を変える場合は演目名）の入力有無を確認します。学校名を変更しても入力済みなら点灯します。申請者氏名は連絡用の任意項目です。</p></div><ul>{submissionChecks.map((item) => <li key={item.label} className={item.ok ? "is-ok" : ""}>{item.ok ? "✓" : "!"} {item.label}<span>{item.ok ? "入力済み" : "未入力"}</span></li>)}</ul></section>
        <section className="bottom-card" id="submit"><div><p className="mini-label">SUBMIT</p><h2>この内容で舞台配置を登録しますか？</h2><p>{submissionMessage || "内容を確認して、提出してください。PDFの保存・印刷は、提出後に管理者が行います。"}</p></div><div className="submit-actions"><button className="pdf-button" onClick={() => void saveRegistration(false)} disabled={submitModal === "submitting"}>下書きを保存</button><button className={`submit-button ${saved ? "is-done" : ""}`} onClick={() => void saveRegistration(true)} disabled={submitModal === "submitting"} aria-busy={submitModal === "submitting"}>{submitModal === "submitting" ? "提出中…" : saved ? "✓　提出済み" : "舞台配置を提出する　→"}</button></div></section><div className="step-actions"><button className="secondary" onClick={() => setCurrentStep(4)}>← 共通申請へ戻る</button></div></>}
        <section className="submission-pdf" aria-hidden="true">
          <header><p>令和8年度　第63回 音楽のつどい</p><h1>舞台配置・使用機器等 提出資料</h1><small>作成日　{new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeZone: "Asia/Tokyo" }).format(new Date())}</small></header>
          <div className="pdf-meta"><div><span>学校名</span><b>{schoolName || "未入力"}</b></div><div><span>申請者</span><b>{applicantName || "未入力"}</b></div><div><span>出演人数</span><b>{(separatePrograms ? programPerformers[activeProgram] : performerTotal) || placedPlayerCount}名</b></div><div><span>配置</span><b>{separatePrograms ? programs[activeProgram] || "未入力" : "共通配置"}</b></div></div>
          <section className="pdf-section"><h2>舞台配置図（幅 {FIXED_STAGE_SIZE.width}m × 奥行 {FIXED_STAGE_SIZE.depth}m）</h2><div className="pdf-stage"><div className="pdf-piano">PIANO</div><div className="pdf-riser pdf-riser-top">ひな壇 2段目　椅子14</div><div className="pdf-riser pdf-riser-low">ひな壇 1段目　椅子16</div>
            {showPerformers ? players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); const seat = activeLayout.playerSeats[index] ?? "player"; return label ? <span key={player.index} className={`pdf-player ${seat}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>{label}</span> : null; }) : <><span className="pdf-performers-skipped">出演者の配置なし（{currentPerformerTotal}名）</span>{players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); const seat = activeLayout.playerSeats[index] ?? "none"; return label && seat !== "none" ? <span key={player.index} className={`pdf-player chair-only ${seat}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>{seat === "player" ? "椅子" : "折り畳"}</span> : null; })}</>}
            {objects.map((item) => <span key={item.id} className={`pdf-object ${item.kind}`} style={{ left: `${item.x}%`, top: `${item.y}%` }}>{item.icon} {item.label}{item.power ? " ◆" : ""}</span>)}<div className="pdf-audience">客　席</div></div><div className="pdf-stage-measurements">後方ひな壇：横12.6m × 縦1.2m　／　前方ひな壇：横10.8m × 縦0.9m　／　ひな壇前方から舞台袖まで：5.0m + 1.2m</div></section>
          <div className="pdf-info-grid"><section><h2>利用備品・数量</h2><dl><div><dt>ピアノ</dt><dd>{usePiano ? "使用" : "不使用"}</dd></div><div><dt>ワイヤレスマイク</dt><dd>{counts.microphones}本</dd></div><div><dt>マイクスタンド</dt><dd>{counts.micStands}本</dd></div><div><dt>指揮台</dt><dd>{counts.podiums}台</dd></div><div><dt>指揮者用譜面台</dt><dd>{counts.conductorStands}台</dd></div><div><dt>譜面台</dt><dd>{counts.musicStands}台</dd></div><div><dt>出演者椅子</dt><dd>{counts.playerChairs}脚</dd></div><div><dt>折り畳み椅子</dt><dd>{counts.foldingChairs}脚</dd></div><div><dt>電源（コンセント）</dt><dd>{usePower ? "使用" : "不使用"}</dd></div></dl></section><section><h2>搬入・音響</h2><dl><div><dt>車での搬入</dt><dd>{carDelivery}</dd></div><div><dt>搬入希望日</dt><dd>{deliveryDate}</dd></div><div><dt>搬入物</dt><dd>{loading.join("、") || "なし"}</dd></div><div><dt>音響・映像備品</dt><dd>{soundVideo}</dd></div><div><dt>音出し指示</dt><dd>{soundCue}</dd></div></dl></section></div>
          <section className="pdf-notes"><h2>その他担当者への要望</h2><p>{notes || "なし"}</p></section><footer>教育委員会提出用／当日設営用資料</footer>
        </section>
      </div>
    </section>
    {onboardingOpen && <OnboardingGuide page={onboardingPage} onNext={() => onboardingPage < 2 ? setOnboardingPage((now) => now + 1) : closeOnboarding()} onSkip={closeOnboarding} />}
    {submitModal && <div className="submit-modal-backdrop" role="presentation"><section className="submit-modal" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title"><div className={`submit-modal-icon ${submitModal}`}>{submitModal === "success" ? "✓" : "…"}</div><p className="mini-label">{submitModal === "success" ? "SUBMISSION COMPLETE" : "SUBMITTING"}</p><h2 id="submit-modal-title">{submitModal === "success" ? "舞台配置を提出しました" : "提出内容を送信しています"}</h2><p>{submitModal === "success" ? <>{schoolName || "学校"}の提出内容を受け付けました。管理者ページで設営資料として確認・PDF作成できます。学校担当者の操作はこれで完了です。</> : "画面を閉じずに、そのままお待ちください。"}</p>{submitModal === "success" && <button onClick={() => setSubmitModal(null)} autoFocus>確認しました</button>}</section></div>}
  </main>;
}

function Count({ label, suffix, value, max, onChange }: { label: string; suffix: string; value: number; max?: number; onChange: (value: number) => void }) {
  return <label className="count-input"><span>{label}</span><button onClick={() => onChange(value - 1)} type="button">−</button><input type="number" value={value} min="0" max={max} onChange={(e) => onChange(Number(e.target.value))} /><button onClick={() => onChange(value + 1)} type="button">＋</button><small>{suffix}</small></label>;
}

function FlowGuide({ step, separatePrograms, onOpenDemo }: { step: number; separatePrograms: boolean; onOpenDemo: () => void }) {
  const guide = {
    1: { title: "まずは学校名と出演人数を入力", chips: ["学校名", "出演人数", "配置を変えるか選択"], tip: separatePrograms ? "演目ごとに配置を変える場合は、続けて各演目名と人数を入力します。" : "配置が同じなら、演目ごとの設定は選ばなくて大丈夫です。" },
    2: { title: separatePrograms ? "演目ごとに配置図をつくる" : "出演者を自動で配置する", chips: separatePrograms ? ["演目タブを選ぶ", "出演者を並べる", "ドラッグで調整"] : ["配置先を選ぶ", "出演者を確認", "ドラッグで調整"], tip: separatePrograms ? "演目タブごとに配置は保存されます。設定し終えたら「舞台備品へ進む」を押してください。" : "ひな壇または前方舞台を選び、必要なら扇状配置も使えます。" },
    3: { title: "必要な舞台備品だけを追加", chips: ["数量を決める", "備品を追加", "赤枠を動かす"], tip: "マイク類は数を増やすと配置図にも追加されます。不要になった備品は配置図の × で外せます。" },
    4: { title: "全演目共通の申請を入力", chips: ["車で搬入するか", "音響・映像", "担当者への要望"], tip: separatePrograms ? "この内容はすべての演目で共通です。演目別の配置を設定し終えてから入力します。" : "搬入や音響など、当日の設営に必要な共通情報を入力します。" },
    5: { title: "最後に確認して提出", chips: ["未入力を確認", "必要なら戻る", "提出する"], tip: "提出後は管理者が設営資料として確認します。学校担当者の作業はここで完了です。" },
  }[step] ?? { title: "入力を進める", chips: [], tip: "" };
  return <section className="flow-guide" aria-live="polite"><div className="flow-guide-head"><span>{step}</span><div><p>この画面でやること</p><h2>{guide.title}</h2></div><button type="button" onClick={onOpenDemo}>動くデモ</button></div><div className="flow-guide-chips">{guide.chips.map((chip, index) => <span key={chip}><i>{index + 1}</i>{chip}</span>)}</div><p className="flow-guide-tip"><b>ポイント</b>{guide.tip}</p></section>;
}

function OnboardingGuide({ page, onNext, onSkip }: { page: number; onNext: () => void; onSkip: () => void }) {
  const slides = [
    { kicker: "30秒でわかる", title: "入力は5つのステップだけ", text: "上の番号を順に押すだけで、学校情報・配置図・備品・共通申請・提出まで進めます。途中で戻って直しても大丈夫です。", points: ["学校名と出演人数を入力", "配置図と備品を設定", "最後に共通申請を入力"] },
    { kicker: "配置図の操作", title: "長押しして、そのまま動かす", text: "出演者や備品を長押しして、指を離さず移動します。タップすると赤枠になり、備品は右上の × で削除できます。", points: ["出演者を長押し", "指を動かして配置", "赤枠・× で確認"] },
    { kicker: "備品と提出", title: "数を決めて、最後に提出", text: "マイクなどは数量を増やすと配置図にも追加されます。搬入や音響は共通申請で入力し、最後に提出してください。", points: ["数量と配置は連動", "搬入・音響は共通入力", "提出後は作業完了"] },
  ][page];
  return <div className="onboarding-backdrop" role="presentation"><section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><button className="onboarding-skip" type="button" onClick={onSkip}>スキップ</button><div className="onboarding-progress" aria-label={`${page + 1} / 3`}>{[0, 1, 2].map((index) => <i key={index} className={index === page ? "is-active" : index < page ? "is-done" : ""} />)}</div><p>{slides.kicker}</p><h2 id="onboarding-title">{slides.title}</h2>{page === 1 ? <StageDragDemo /> : <div className={`onboarding-illustration page-${page}`} aria-hidden="true"><span>{page === 0 ? "①" : "✓"}</span><b>{page === 0 ? "順番に進めばOK" : "提出まであと少し"}</b></div>}<div className="onboarding-points">{slides.points.map((point, index) => <span key={point}><i>{index + 1}</i>{point}</span>)}</div><p className="onboarding-copy">{slides.text}</p><button className="onboarding-next" type="button" onClick={onNext}>{page === 2 ? "ガイドを閉じて入力を始める" : "次へ　→"}</button></section></div>;
}

function StageDragDemo() { return <figure className="stage-drag-demo"><img src="/stage-drag-demo.gif" alt="実際の配置図で出演者を選択し、舞台下へドラッグして移動する操作例" /><figcaption>実際の画面で「出演者」をタップして、そのまま動かす様子</figcaption></figure>; }

function Field({ label, type, value, options, placeholder, suffix, onChange }: { label: string; type: "text" | "number" | "select"; value?: string; options?: string[]; placeholder?: string; suffix?: string; onChange: (value: string) => void }) {
  return <label className="application-field"><span>{label}</span>{type === "select" ? <select value={value} onChange={(event) => onChange(event.target.value)}>{options?.map((option) => <option key={option}>{option}</option>)}</select> : <div><input type={type} placeholder={placeholder} min="0" onChange={(event) => onChange(event.target.value)} />{suffix && <small>{suffix}</small>}</div>}</label>;
}
