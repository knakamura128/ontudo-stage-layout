"use client";

import { useMemo, useState } from "react";

type SectionKey = "arrangement" | "details" | "check";

const initialRows = [
  { id: 1, name: "前列", count: 18, tone: "coral" },
  { id: 2, name: "中列", count: 18, tone: "sky" },
  { id: 3, name: "後列", count: 16, tone: "navy" },
  { id: 4, name: "ひな壇", count: 8, tone: "ochre" },
];

const navItems: { key: SectionKey; label: string; icon: string }[] = [
  { key: "arrangement", label: "舞台配置", icon: "⌘" },
  { key: "details", label: "団体情報", icon: "◇" },
  { key: "check", label: "提出前チェック", icon: "✓" },
];

export default function Home() {
  const [active, setActive] = useState<SectionKey>("arrangement");
  const [rows, setRows] = useState(initialRows);
  const [selectedRow, setSelectedRow] = useState(1);
  const [hasPiano, setHasPiano] = useState(true);
  const [hasConductor, setHasConductor] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  const studentCount = useMemo(
    () => rows.reduce((total, row) => total + row.count, 0),
    [rows],
  );

  const adjustRow = (id: number, delta: number) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, count: Math.max(0, row.count + delta) } : row,
      ),
    );
    setSubmitted(false);
  };

  const updateName = (id: number, name: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, name } : row)));
    setSubmitted(false);
  };

  return (
    <main className="app-shell">
      <aside className="side-nav" aria-label="主なメニュー">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">♪</div>
          <div>
            <p className="brand-eyebrow">令和8年度</p>
            <p className="brand-name">音楽のつどい</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              className={`nav-item ${active === item.key ? "is-active" : ""}`}
              key={item.key}
              onClick={() => setActive(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.key === "check" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>

        <div className="deadline-card">
          <span>提出締切</span>
          <strong>9月20日（金）</strong>
          <small>あと 14 日</small>
        </div>
        <div className="nav-foot">お問い合わせ　›</div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="crumbs">ホーム <span>／</span> 舞台配置</div>
          <div className="account"><span className="school-avatar">高</span> 高南小学校 <span className="chevron">⌄</span></div>
        </header>

        <div className="content-wrap">
          <section className="page-heading">
            <div>
              <p className="section-kicker">STAGE LAYOUT</p>
              <h1>舞台配置をつくる</h1>
              <p className="lead">児童の位置や楽器を、舞台図を見ながら登録できます。</p>
            </div>
            <div className="saved-state"><span /> 下書き保存済み　<time>10:42</time></div>
          </section>

          {active === "arrangement" && (
            <>
              <section className="event-strip">
                <div className="event-num">演奏<br /><strong>03</strong></div>
                <div><span>午前の部　10:20〜10:28</span><h2>高南小学校　4年生</h2></div>
                <div className="event-meta"><span>合唱</span><b>曲目　心をひとつに</b></div>
              </section>

              <div className="layout-grid">
                <section className="stage-card">
                  <div className="card-head">
                    <div><p className="mini-label">STAGE PREVIEW</p><h2>舞台図</h2></div>
                    <button className="text-button">全体表示　⌖</button>
                  </div>
                  <div className="stage-legend"><span><i className="legend-coral" />児童</span><span><i className="legend-navy" />引率者</span><span><i className="legend-outline" />設備</span></div>
                  <div className="stage-wrap">
                    <div className="stage-label">客　席</div>
                    <div className="stage-floor" aria-label="舞台配置プレビュー">
                      <div className="stage-back">舞　台</div>
                      <div className="piano" aria-label="ピアノ"><span>PIANO</span></div>
                      {hasConductor && <div className="conductor" aria-label="指揮者"><span>指揮</span></div>}
                      {rows.map((row, index) => (
                        <div
                          className={`people row-${index + 1} ${row.tone} ${selectedRow === row.id ? "is-selected" : ""}`}
                          key={row.id}
                          onClick={() => setSelectedRow(row.id)}
                          role="button"
                          tabIndex={0}
                          aria-label={`${row.name}、${row.count}人を選択`}
                          onKeyDown={(event) => event.key === "Enter" && setSelectedRow(row.id)}
                        >
                          {Array.from({ length: Math.min(row.count, 20) }).map((_, person) => <i key={person} />)}
                          {row.count > 20 && <em>+{row.count - 20}</em>}
                        </div>
                      ))}
                    </div>
                    <div className="audience-note">客席側から見た図</div>
                  </div>
                  <div className="stage-caption">● を選択すると、右側の人数・列名を編集できます。</div>
                </section>

                <section className="control-panel">
                  <div className="panel-head"><div><p className="mini-label">ARRANGEMENT</p><h2>出演者の配置</h2></div><button className="help" aria-label="使い方">?</button></div>
                  <div className="total-card"><div><span>ステージ上の人数</span><strong>{studentCount}<small>人</small></strong></div><div className="total-sub"><span>児童</span><b>{studentCount}人</b><span>引率</span><b>2人</b></div></div>
                  <div className="row-list">
                    {rows.map((row) => (
                      <div className={`setting-row ${selectedRow === row.id ? "is-selected" : ""}`} key={row.id}>
                        <button className={`row-color ${row.tone}`} onClick={() => setSelectedRow(row.id)} aria-label={`${row.name}を選択`} />
                        <input value={row.name} onChange={(event) => updateName(row.id, event.target.value)} aria-label="列の名前" />
                        <div className="counter"><button onClick={() => adjustRow(row.id, -1)} aria-label={`${row.name}を1人減らす`}>−</button><strong>{row.count}</strong><button onClick={() => adjustRow(row.id, 1)} aria-label={`${row.name}を1人増やす`}>＋</button></div>
                      </div>
                    ))}
                  </div>
                  <button className="add-row" onClick={() => setRows((current) => [...current, { id: Date.now(), name: "新しい列", count: 0, tone: "sky" }])}>＋　列を追加</button>
                  <div className="equipment"><h3>設備・配置物</h3><label><input type="checkbox" checked={hasPiano} onChange={(event) => setHasPiano(event.target.checked)} /> <span className="fake-checkbox" />ピアノを使用する</label><label><input type="checkbox" checked={hasConductor} onChange={(event) => setHasConductor(event.target.checked)} /> <span className="fake-checkbox" />指揮者を配置する</label></div>
                </section>
              </div>

              <section className="bottom-card">
                <div><p className="mini-label">NEXT STEP</p><h2>この配置で登録しますか？</h2><p>提出後も締切日までは編集できます。</p></div>
                <button className={`submit-button ${submitted ? "is-done" : ""}`} onClick={() => setSubmitted(true)}>{submitted ? "✓　登録しました" : "配置を登録する　→"}</button>
              </section>
            </>
          )}

          {active === "details" && <section className="empty-state"><span>◇</span><h2>団体情報</h2><p>学校名、学年、曲目、担当者の情報を確認・編集できます。</p><button onClick={() => setActive("arrangement")}>舞台配置へ戻る</button></section>}
          {active === "check" && <section className="empty-state"><span>✓</span><h2>提出前チェック</h2><p>舞台配置・人数・設備の登録内容を確認します。</p><button onClick={() => setActive("arrangement")}>舞台配置を確認する</button></section>}
        </div>
      </section>
    </main>
  );
}
