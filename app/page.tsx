"use client";

import { PointerEvent, useMemo, useRef, useState } from "react";

type StageObject = { id: number; label: string; icon: string; kind: "instrument" | "stand" | "chair"; x: number; y: number; power: boolean };
type StagePoint = { left: number; top: number };
type ProgramLayout = { fanLayout: boolean; objects: StageObject[]; playerPositions: Record<number, StagePoint>; playerLabels: Record<number, string> };

const playerGroups = [
  ["Tp", 12], ["Tb", 6], ["Hr", 6], ["Euph", 6], ["Cl", 13], ["Fl", 6], ["A.Sax", 4], ["B.Sax", 3], ["Tub", 3],
] as const;
const blankPlayerLabels = () => Object.fromEntries(Array.from({ length: playerGroups.reduce((total, [, count]) => total + count, 0) }, (_, index) => [index, ""]));

const loadingOptions = ["管楽器", "ティンパニ", "ドラムセット", "バスドラム", "シロフォン", "ビブラフォン", "グロッケン", "コンガ", "ボンゴ", "ウィンドチャイム", "サスペンドシンバル", "ウッドブロック", "パーカッション小物"];
const palette = [
  { label: "演奏者椅子", icon: "🪑", kind: "chair" as const }, { label: "折り畳み椅子", icon: "🪑", kind: "chair" as const }, { label: "譜面台", icon: "🎼", kind: "stand" as const },
  { label: "マイク", icon: "🎤", kind: "instrument" as const }, { label: "マイクスタンド", icon: "🎙️", kind: "stand" as const },
  { label: "キーボード", icon: "🎹", kind: "instrument" as const }, { label: "ドラム", icon: "🥁", kind: "instrument" as const },
  { label: "ティンパニ", icon: "🥁", kind: "instrument" as const }, { label: "バスドラム", icon: "🥁", kind: "instrument" as const },
  { label: "木琴", icon: "🎵", kind: "instrument" as const }, { label: "鉄琴", icon: "🎶", kind: "instrument" as const },
  { label: "ウィンドチャイム", icon: "🎐", kind: "instrument" as const }, { label: "サスペンドシンバル", icon: "◯", kind: "instrument" as const },
  { label: "コンガ", icon: "🪘", kind: "instrument" as const }, { label: "ボンゴ", icon: "🪘", kind: "instrument" as const },
  { label: "指揮台", icon: "▣", kind: "stand" as const }, { label: "その他", icon: "＋", kind: "instrument" as const },
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
  const [layoutMode, setLayoutMode] = useState<"common" | "program">("program");
  const [programs, setPrograms] = useState(["吹奏楽：心をひとつに", "合奏：風のシンフォニー", "フィナーレ"]);
  const [activeProgram, setActiveProgram] = useState(0);
  const [layouts, setLayouts] = useState<Record<number, ProgramLayout>>({
    0: { fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels() },
    1: { fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels() },
    2: { fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels() },
  });
  const [carDelivery, setCarDelivery] = useState<"有" | "無">("無");
  const [deliveryDate, setDeliveryDate] = useState("当日（11/14 10時〜）");
  const [soundVideo, setSoundVideo] = useState<"あり" | "なし">("なし");
  const [soundCue, setSoundCue] = useState<"あり" | "なし">("なし");
  const [media, setMedia] = useState<string[]>([]);
  const [usePower, setUsePower] = useState(false);
  const [usePiano, setUsePiano] = useState(true);
  const [loading, setLoading] = useState<string[]>(["管楽器"]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [draggingPlayerIndex, setDraggingPlayerIndex] = useState<number | null>(null);
  const [selectedPlayerIndex, setSelectedPlayerIndex] = useState<number | null>(null);
  const [newPlayerLabel, setNewPlayerLabel] = useState("");
  const [counts, setCounts] = useState({ microphones: 0, micStands: 0, playerChairs: 0, foldingChairs: 0 });
  const [saved, setSaved] = useState(false);

  const layoutKey = layoutMode === "common" ? 0 : activeProgram;
  const activeLayout = layouts[layoutKey];
  const fanLayout = activeLayout.fanLayout;
  const objects = activeLayout.objects;
  const updateLayout = (updater: (layout: ProgramLayout) => ProgramLayout) => setLayouts((now) => ({ ...now, [layoutKey]: updater(now[layoutKey]) }));

  const players = useMemo(() => playerGroups.flatMap(([label, count]) => Array.from({ length: count }, (_, index) => ({ label, index }))), []);
  const placedPlayerCount = players.filter((_, index) => Boolean(activeLayout.playerLabels[index])).length;

  const changeCount = (key: keyof typeof counts, value: number) => {
    setCounts((now) => ({ ...now, [key]: Math.max(0, value) }));
    setSaved(false);
  };
  const addObject = (label: string, icon: string, kind: StageObject["kind"] = "instrument") => {
    updateLayout((now) => ({ ...now, objects: [...now.objects, { id: Date.now(), label, icon, kind, x: 50 + (now.objects.length % 3) * 7, y: 66 + (now.objects.length % 2) * 8, power: false }] }));
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
  const addPlayer = () => {
    const label = newPlayerLabel.trim();
    const index = players.findIndex((_, current) => !activeLayout.playerLabels[current]);
    if (!label || index === -1) return;
    updateLayout((now) => ({ ...now, playerLabels: { ...now.playerLabels, [index]: label } }));
    setSelectedPlayerIndex(index);
    setNewPlayerLabel("");
    setSaved(false);
  };
  const clearStageLayout = () => {
    if (!window.confirm("この演目の演奏者・備品の配置をすべてクリアしますか？")) return;
    updateLayout((now) => ({ ...now, fanLayout: false, objects: [], playerPositions: {}, playerLabels: blankPlayerLabels() }));
    setSelectedId(null);
    setSelectedPlayerIndex(null);
    setSaved(false);
  };
  const toggleLoading = (label: string) => {
    setLoading((now) => now.includes(label) ? now.filter((item) => item !== label) : [...now, label]);
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
    const riserUpperCount = 16;
    const riserLowerCount = 14;
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
      <nav className="nav-list"><button className="nav-item is-active"><span className="nav-icon">⌘</span> 舞台配置</button><button className="nav-item"><span className="nav-icon">◇</span> 団体情報</button><button className="nav-item"><span className="nav-icon">✓</span> 提出前チェック <span className="nav-dot" /></button></nav>
      <div className="deadline-card"><span>提出締切</span><strong>10月11日（金）</strong><small>原本の様式に準拠</small></div><div className="nav-foot">お問い合わせ　›</div>
    </aside>

    <section className="workspace">
      <header className="topbar"><div className="crumbs">ホーム <span>／</span> 舞台配置</div><div className="account"><span className="school-avatar">高</span> 高南小学校 <span className="chevron">⌄</span></div></header>
      <div className="content-wrap form-content">
        <section className="page-heading"><div><p className="section-kicker">KOUNAN ELEMENTARY SCHOOL / 1104</p><h1>ステージ配置・備品申請</h1><p className="lead">第61回 音楽のつどい　舞台配置図</p></div><div className="saved-state"><span /> {saved ? "登録内容を保存しました" : "編集内容は自動保存されます"}</div></section>

        <section className="notice-card"><b>固定配置について</b><p>ピアノの位置・向き、ひな壇は会場の固定配置です。演奏者・椅子・楽器などの配置物は、ドラッグで自由に調整できます。</p></section>

        <section className="request-summary">
          <div><span>学校名</span><strong>高南小学校</strong></div><div><span>出演人数</span><strong>{placedPlayerCount}名</strong></div><div><span>舞台サイズ</span><strong>幅15m × 奥行12m</strong></div><div><span>演目</span><strong>吹奏楽</strong></div>
        </section>

        <section className="program-card">
          <div className="program-card-head"><div><p className="mini-label">PROGRAM LAYOUTS</p><h2>演目ごとの舞台配置</h2><p>演目によって配置が変わる場合は、それぞれのタブで舞台図を編集します。</p></div><div className="layout-mode"><button className={layoutMode === "common" ? "is-active" : ""} onClick={() => { setLayoutMode("common"); setActiveProgram(0); setSelectedId(null); setSelectedPlayerIndex(null); }}>共通配置</button><button className={layoutMode === "program" ? "is-active" : ""} onClick={() => setLayoutMode("program")}>演目ごと</button></div></div>
          <div className="program-inputs">{programs.map((program, index) => <label key={index}><span>演目 {index + 1}</span><input value={program} onChange={(event) => { setPrograms((now) => now.map((item, current) => current === index ? event.target.value : item)); setSaved(false); }} /></label>)}</div>
          {layoutMode === "program" ? <div className="program-tabs">{programs.map((program, index) => <button key={index} className={activeProgram === index ? "is-active" : ""} onClick={() => { setActiveProgram(index); setSelectedId(null); setSelectedPlayerIndex(null); }}>{program || `演目 ${index + 1}`}</button>)}<button className="copy-layout" onClick={() => { const next = (activeProgram + 1) % programs.length; setLayouts((now) => ({ ...now, [next]: { fanLayout: activeLayout.fanLayout, objects: activeLayout.objects.map((item, index) => ({ ...item, id: Date.now() + index })), playerPositions: { ...activeLayout.playerPositions }, playerLabels: { ...activeLayout.playerLabels } } })); setActiveProgram(next); setSelectedId(null); setSelectedPlayerIndex(null); setSaved(false); }}>この配置を次の演目へコピー　→</button></div> : <div className="program-note">舞台配置図は1つです。作成した配置をすべての演目で共通して使用します。</div>}
        </section>

        <div className="layout-grid detailed-grid">
          <section className="stage-card detailed-stage-card">
            <div className="card-head"><div><p className="mini-label">STAGE LAYOUT / {layoutMode === "program" ? `PROGRAM ${activeProgram + 1}` : "COMMON"}</p><h2>舞台配置図 <span className="view-hint">（{layoutMode === "program" ? programs[activeProgram] : "共通配置"}）</span></h2></div><div className="stage-actions"><button className="clear-layout" onClick={clearStageLayout}>配置図をすべてクリア</button><label className="fan-toggle"><input type="checkbox" checked={fanLayout} onChange={(e) => { updateLayout((now) => ({ ...now, fanLayout: e.target.checked })); setSaved(false); }} /><span />ひな壇以外を扇状に配置</label></div></div>
            <div className="stage-legend"><span><i className="legend-coral" />演奏者 {placedPlayerCount}名</span><span><i className="legend-navy" />固定備品</span><span><i className="legend-power" />電源使用</span><span>ひな壇上は直線固定</span><span>演奏者・備品をドラッグして配置</span><span>備品右上の × で削除</span></div>
            <div className="stage-outline"><div className="stage-dimension top">奥行 12m</div><div className="stage-dimension bottom">幅 15m</div><div className="curtain left" /><div className="curtain right" />
              <div className="stage-floor large-floor" ref={stageRef} onPointerMove={moveObject} onPointerUp={() => { setDraggingId(null); setDraggingPlayerIndex(null); }} onPointerLeave={() => { setDraggingId(null); setDraggingPlayerIndex(null); }}>
                <div className="fixed-piano"><span>🎹 固定</span><b>PIANO</b></div>
                <div className="riser riser-top"><b>ひな壇 2段目</b><span>椅子 14</span>{Array.from({ length: 6 }).map((_, i) => <i key={i} />)}</div>
                <div className="riser riser-low"><b>ひな壇 1段目</b><span>椅子 16</span>{Array.from({ length: 7 }).map((_, i) => <i key={i} />)}</div>
                {!usePiano && <div className="unused-label">ピアノ 不使用</div>}
                {players.map((player, index) => { const label = activeLayout.playerLabels[index]; const pos = activeLayout.playerPositions[index] ?? playerPosition(index); return label ? <button className="player-dot" style={{ left: `${pos.left}%`, top: `${pos.top}%` }} key={`${player.label}-${index}`} onClick={() => { setSelectedPlayerIndex(index); setSelectedId(null); }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDraggingPlayerIndex(index); setDraggingId(null); setSaved(false); }} aria-label={`${label}の演奏者を移動`}>{label}</button> : null; })}
                {objects.map((item) => <div key={item.id} className="stage-object-wrap" style={{ left: `${item.x}%`, top: `${item.y}%` }}><button className={`stage-object ${item.kind} ${selectedId === item.id ? "is-selected" : ""}`} onClick={() => setSelectedId(item.id)} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDraggingId(item.id); setDraggingPlayerIndex(null); setSelectedId(item.id); setSaved(false); }} aria-label={`${item.label}を移動`}><span className="stage-object-icon">{item.icon}</span><span>{item.label}</span>{item.power && <em>⚡</em>}</button><button className="stage-object-delete" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); updateLayout((now) => ({ ...now, objects: now.objects.filter((current) => current.id !== item.id) })); setSelectedId(null); setSaved(false); }} aria-label={`${item.label}を削除`} title={`${item.label}を削除`}>×</button></div>)}
                <div className="audience">客　席</div>
              </div>
            </div>
            <div className="player-editor"><label><span>演奏者を追加</span><input value={newPlayerLabel} onChange={(event) => setNewPlayerLabel(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addPlayer(); }} placeholder="例：Tp、Hr、Euph" maxLength={12} /></label><button onClick={addPlayer}>追加</button><small>任意の表記で追加後、舞台図上をドラッグして配置できます。</small></div>
            {selectedPlayerIndex !== null && <div className="object-editor"><b>選択中の演奏者</b><input value={activeLayout.playerLabels[selectedPlayerIndex] ?? ""} onChange={(event) => { const label = event.target.value; updateLayout((now) => ({ ...now, playerLabels: { ...now.playerLabels, [selectedPlayerIndex]: label } })); setSaved(false); }} maxLength={12} aria-label="演奏者の表記" /><button onClick={() => { updateLayout((now) => { const playerLabels = { ...now.playerLabels, [selectedPlayerIndex]: "" }; const playerPositions = { ...now.playerPositions }; delete playerPositions[selectedPlayerIndex]; return { ...now, playerLabels, playerPositions }; }); setSelectedPlayerIndex(null); setSaved(false); }}>削除</button></div>}
            {selectedId !== null && <div className="object-editor"><b>選択中の配置物</b><span>{objects.find((item) => item.id === selectedId)?.icon} {objects.find((item) => item.id === selectedId)?.label}</span><label><input type="checkbox" checked={objects.find((item) => item.id === selectedId)?.power ?? false} onChange={(e) => updateLayout((now) => ({ ...now, objects: now.objects.map((item) => item.id === selectedId ? { ...item, power: e.target.checked } : item) }))} />電源を使用</label><button onClick={() => { updateLayout((now) => ({ ...now, objects: now.objects.filter((item) => item.id !== selectedId) })); setSelectedId(null); }}>削除</button></div>}
          </section>

          <section className="control-panel comprehensive-panel">
            <div className="panel-head"><div><p className="mini-label">EQUIPMENT & DELIVERY</p><h2>申請内容</h2></div><span className="form-no">様式 1104</span></div>
            <section className="form-section"><h3>搬入・電源</h3><div className="choice-line"><span>車での搬入</span><div className="segmented">{(["有", "無"] as const).map((value) => <button className={carDelivery === value ? "is-active" : ""} key={value} onClick={() => { setCarDelivery(value); setSaved(false); }}>{value}</button>)}</div></div><label className="switch-line"><input type="checkbox" checked={usePower} onChange={(e) => { setUsePower(e.target.checked); setSaved(false); }} /><span />電源（コンセント）を使用する</label>{usePower && <p className="power-note">使用する楽器を選び、舞台図上の対象オブジェクトで「電源を使用」をONにしてください。</p>}</section>
            <section className="form-section"><h3>利用備品</h3><label className="switch-line"><input type="checkbox" checked={usePiano} onChange={(e) => setUsePiano(e.target.checked)} /><span />ピアノを使用する <small>（位置固定）</small></label><label className="switch-line"><input type="checkbox" checked={objects.some((item) => item.label === "指揮台")} onChange={(e) => toggleStageObject("指揮台", "▣", "stand", e.target.checked)} /><span />指揮台を使用する <small>（配置図上で移動可）</small></label><label className="switch-line"><input type="checkbox" checked={objects.some((item) => item.label === "指揮者譜面台")} onChange={(e) => toggleStageObject("指揮者譜面台", "🎼", "stand", e.target.checked)} /><span />指揮者譜面台を使用する <small>（配置図上で移動可）</small></label></section>
            <section className="form-section count-section"><h3>数量</h3><Count label="マイク" suffix="本（ワイヤレス）" value={counts.microphones} onChange={(v) => changeCount("microphones", v)} onAdd={() => addObject("マイク", "🎤")} /><Count label="マイクスタンド" suffix="本" value={counts.micStands} onChange={(v) => changeCount("micStands", v)} onAdd={() => addObject("マイクスタンド", "🎙️", "stand")} /><Count label="演奏者椅子" suffix="脚（最大100）" value={counts.playerChairs} max={100} onChange={(v) => changeCount("playerChairs", v)} onAdd={() => addObject("演奏者椅子", "🪑", "chair")} /><Count label="折りたたみ椅子" suffix="脚（最大50）" value={counts.foldingChairs} max={50} onChange={(v) => changeCount("foldingChairs", v)} onAdd={() => addObject("折り畳み椅子", "🪑", "chair")} /><p className="move-help">「配置」を押すと舞台図へ追加され、ドラッグで自由に動かせます。</p></section>
          </section>
        </div>

        <section className="equipment-workspace">
          <div className="equipment-heading"><div><p className="mini-label">LOAD-IN & OBJECT PALETTE</p><h2>搬入物を選び、舞台へ配置</h2><p>選択した楽器は、下のパレットから舞台図へ追加して配置できます。</p></div><div className="chosen-count">選択中 <b>{loading.length}</b> 件</div></div>
          <div className="loading-options">{loadingOptions.map((item) => <button key={item} className={loading.includes(item) ? "is-selected" : ""} onClick={() => toggleLoading(item)}>{loading.includes(item) ? "✓" : "＋"} {item}</button>)}</div>
          <div className="object-palette"><div className="palette-label">舞台に追加</div>{palette.map((item) => <button key={item.label} onClick={() => addObject(item.label, item.icon, item.kind)}><span className="tool-icon">{item.icon}</span><span>{item.label}</span></button>)}</div>
        </section>

        <section className="application-card">
          <div className="application-head"><div><p className="mini-label">APPLICATION FORM / 1)-3)</p><h2>舞台使用機器・搬出入等申請</h2><p>申請書の入力項目を、舞台配置と同じ画面で管理します。</p></div><span>提出期限　<strong>10月16日（金）</strong></span></div>
          <div className="application-grid">
            <section className="application-section"><div className="application-number">1</div><div className="application-body"><h3>車での搬入出</h3><div className="field-row"><Field label="搬入出" type="select" value={carDelivery === "有" ? "あり" : "なし"} options={["あり", "なし"]} onChange={(value) => { setCarDelivery(value === "あり" ? "有" : "無"); setSaved(false); }} /><Field label="搬入希望日" type="select" value={deliveryDate} options={["前日（11/13 18時〜19時）", "当日（11/14 10時〜）"]} onChange={(value) => { setDeliveryDate(value); setSaved(false); }} /></div><Field label="搬入物" type="text" placeholder="例：ティンパニ、ドラムセット、管楽器" onChange={() => setSaved(false)} /><div className="field-row"><Field label="車両責任者氏名" type="text" placeholder="氏名を入力" onChange={() => setSaved(false)} /><Field label="連絡先" type="text" placeholder="電話番号を入力" onChange={() => setSaved(false)} /></div><div className="field-row"><Field label="車種（車高3m未満）" type="text" placeholder="例：ワゴン車" onChange={() => setSaved(false)} /><Field label="台数" type="number" suffix="台" onChange={() => setSaved(false)} /></div></div></section>
            <section className="application-section"><div className="application-number">3</div><div className="application-body"><h3>音響・映像備品</h3><div className="field-row"><Field label="音響・映像備品の利用" type="select" value={soundVideo} options={["あり", "なし"]} onChange={(value) => { setSoundVideo(value as "あり" | "なし"); setSaved(false); }} /><Field label="演者から音響への音出し指示" type="select" value={soundCue} options={["あり", "なし"]} onChange={(value) => { setSoundCue(value as "あり" | "なし"); setSaved(false); }} /></div><div className="field-row"><Field label="音楽データ形式" type="text" placeholder="MP3、WAV、CD-DA" onChange={() => setSaved(false)} /><Field label="映像データ形式" type="text" placeholder="mp4、AVCHD" onChange={() => setSaved(false)} /></div><div className="media-field"><span>記録媒体</span><div>{["USB", "SD", "SDHC", "SDXC", "CD-R", "CD-RW", "BD", "DVD"].map((item) => <button className={media.includes(item) ? "is-selected" : ""} key={item} onClick={() => { setMedia((now) => now.includes(item) ? now.filter((current) => current !== item) : [...now, item]); setSaved(false); }}>{media.includes(item) ? "✓ " : ""}{item}</button>)}</div></div><p className="cable-note">電源が必要な機器の場合は、必ず電源ケーブルを持参してください。</p></div></section>
          </div>
        </section>

        <section className="notes-card"><div><p className="mini-label">REQUESTS FOR SETUP STAFF</p><h2>その他・設営担当への要望</h2><p>必要な電源、大きな楽器の移動補助などを記入してください。</p></div><textarea defaultValue="バスオルガンを使用しないことになったため、電源使用もなしとなりました。配置図の「★」は譜面台を置く予定の椅子です。譜面台はこちらで持参いたします。" onChange={() => setSaved(false)} /></section>
        <section className="bottom-card"><div><p className="mini-label">SUBMIT</p><h2>この内容で舞台配置を登録しますか？</h2><p>締切日までは、何度でも編集・再登録できます。</p></div><button className={`submit-button ${saved ? "is-done" : ""}`} onClick={() => setSaved(true)}>{saved ? "✓　登録内容を保存しました" : "舞台配置を登録する　→"}</button></section>
      </div>
    </section>
  </main>;
}

function Count({ label, suffix, value, max, onChange, onAdd }: { label: string; suffix: string; value: number; max?: number; onChange: (value: number) => void; onAdd?: () => void }) {
  return <label className="count-input"><span>{label}</span><button onClick={() => onChange(value - 1)} type="button">−</button><input type="number" value={value} min="0" max={max} onChange={(e) => onChange(Number(e.target.value))} /><button onClick={() => onChange(value + 1)} type="button">＋</button><small>{suffix}</small>{onAdd && <button className="count-add" onClick={onAdd} type="button">配置</button>}</label>;
}

function Field({ label, type, value, options, placeholder, suffix, onChange }: { label: string; type: "text" | "number" | "select"; value?: string; options?: string[]; placeholder?: string; suffix?: string; onChange: (value: string) => void }) {
  return <label className="application-field"><span>{label}</span>{type === "select" ? <select value={value} onChange={(event) => onChange(event.target.value)}>{options?.map((option) => <option key={option}>{option}</option>)}</select> : <div><input type={type} placeholder={placeholder} min="0" onChange={(event) => onChange(event.target.value)} />{suffix && <small>{suffix}</small>}</div>}</label>;
}
