import Link from "next/link";
import { headers } from "next/headers";
import { readSession } from "@/app/lib/google-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const requestHeaders = await headers();
  const user = await readSession(requestHeaders.get("cookie"));

  if (!user || user.role !== "admin") {
    return (
      <main className="admin-gate">
        <section className="admin-gate-card">
          <div className="admin-lock">⌘</div>
          <p className="section-kicker">ADMIN ONLY</p>
          <h1>管理者ページ</h1>
          <p>このページは管理者用です。舞台配置ページで、管理者に登録されたGoogleアカウントでログインしてください。</p>
          <Link href="/" className="admin-primary-link">舞台配置ページへ戻る</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link href="/" className="admin-brand"><span>♪</span><b>音楽のつどい</b><small>管理者ページ</small></Link>
        <div className="admin-user"><span>{user.email}</span><b>管理者</b></div>
      </header>
      <div className="admin-wrap">
        <section className="admin-hero">
          <div><p className="section-kicker">ADMIN CONSOLE</p><h1>運用管理</h1><p>舞台配置の編集・提出資料の作成・公開設定を、管理者として確認できます。</p></div>
          <Link href="/" className="admin-primary-link">舞台配置を編集する <span>→</span></Link>
        </section>

        <section className="admin-summary" aria-label="運用状況">
          <article><span className="admin-card-icon coral">⌘</span><div><small>ログイン権限</small><b>管理者</b><p>このアカウントは編集可能です</p></div></article>
          <article><span className="admin-card-icon blue">◎</span><div><small>公開状態</small><b>URL共有で閲覧可</b><p>一般の閲覧者は編集できません</p></div></article>
          <article><span className="admin-card-icon green">▣</span><div><small>提出資料</small><b>PDF作成に対応</b><p>舞台配置ページからA4で出力できます</p></div></article>
        </section>

        <section className="admin-grid">
          <article className="admin-panel admin-panel-main">
            <div className="admin-panel-heading"><div><p className="mini-label">WORKFLOW</p><h2>管理者の作業</h2></div><span>3 STEP</span></div>
            <ol className="admin-workflow">
              <li><i>1</i><div><b>舞台配置を編集</b><p>演目ごとの配置、演奏者、備品・搬入物を設定します。</p></div><Link href="/">編集する →</Link></li>
              <li><i>2</i><div><b>提出資料を作成</b><p>「PDF作成（A4・1枚）」から提出用の資料を出力します。</p></div><Link href="/">作成する →</Link></li>
              <li><i>3</i><div><b>共有して確認</b><p>公開URLを関係者へ案内し、閲覧用の画面として共有します。</p></div><Link href="/">確認する →</Link></li>
            </ol>
          </article>

          <aside className="admin-panel">
            <div className="admin-panel-heading"><div><p className="mini-label">ACCESS CONTROL</p><h2>アクセス管理</h2></div></div>
            <div className="access-status"><span className="access-dot" />Googleアカウント認証を有効化中</div>
            <p className="admin-copy">管理者に指定されたアカウントだけが、舞台配置の編集・削除・PDF作成を行えます。</p>
            <div className="admin-tip"><b>管理者の追加</b><span>追加したいGoogleメールアドレスをお知らせください。すぐに編集権限を付与できます。</span></div>
          </aside>
        </section>

        <section className="admin-notice"><b>現在の運用について</b><p>この管理ページでは、公開状態と編集権限を確認できます。申請の一覧・提出状況をまとめて管理する機能も、次の段階で追加できます。</p></section>
      </div>
    </main>
  );
}
