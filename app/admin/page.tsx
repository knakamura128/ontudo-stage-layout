import Link from "next/link";
import { headers } from "next/headers";
import { readSession } from "@/app/lib/google-auth";
import AdminLogin from "./admin-login";
import SubmissionList from "./submission-list";

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
          <p>このページは管理者用です。管理者に登録されたGoogleアカウントでログインしてください。</p>
          <AdminLogin />
          <Link href="/" className="admin-secondary-link">舞台配置ページへ戻る</Link>
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
          <div><p className="section-kicker">ADMIN CONSOLE</p><h1>運用管理</h1><p>学校から提出された舞台配置・備品資料を確認し、教育委員会への提出用に整えます。</p></div>
          <Link href="#submissions" className="admin-primary-link">申請一覧を開く <span>→</span></Link>
        </section>

        <section className="admin-summary" aria-label="運用状況">
          <article><span className="admin-card-icon coral">⌘</span><div><small>ログイン権限</small><b>管理者</b><p>申請一覧・設営資料を確認できます</p></div></article>
          <article><span className="admin-card-icon blue">◎</span><div><small>学校担当者の入稿</small><b>どなたでも提出可</b><p>学校は提出後の対応は不要です</p></div></article>
          <article><span className="admin-card-icon green">▣</span><div><small>設営資料</small><b>管理者画面でPDF作成</b><p>学校ごと・選択した学校をまとめて出力できます</p></div></article>
        </section>

        <section className="admin-grid">
          <article className="admin-panel admin-panel-main">
            <div className="admin-panel-heading"><div><p className="mini-label">WORKFLOW</p><h2>管理者の作業</h2></div><span>3 STEP</span></div>
            <ol className="admin-workflow">
              <li><i>1</i><div><b>提出内容を確認</b><p>学校から届いた舞台配置・備品の申請を一覧で確認します。</p></div><Link href="#submissions">一覧を見る →</Link></li>
              <li><i>2</i><div><b>設営資料PDFを作成</b><p>学校ごとの資料を確認・ダウンロードし、必要な学校を選んで1つのPDFにもまとめられます。</p></div><Link href="#submissions">PDFを作成 →</Link></li>
              <li><i>3</i><div><b>教育委員会へ提出・当日配布</b><p>印刷した資料を教育委員会へ渡し、打ち合わせ当日の設営資料として配布します。</p></div><Link href="#submissions">申請を確認 →</Link></li>
            </ol>
          </article>

          <aside className="admin-panel">
            <div className="admin-panel-heading"><div><p className="mini-label">ACCESS CONTROL</p><h2>アクセス管理</h2></div></div>
            <div className="access-status"><span className="access-dot" />Googleアカウント認証を有効化中</div>
            <p className="admin-copy">管理者に指定されたアカウントだけが、申請一覧の確認・申請詳細の閲覧・設営資料PDFの作成を行えます。</p>
            <div className="admin-tip"><b>管理者の追加</b><span>追加したいGoogleメールアドレスをお知らせください。すぐに編集権限を付与できます。</span></div>
          </aside>
        </section>

        <SubmissionList />

        <section className="admin-notice"><b>現在の運用について</b><p>集計は行いません。学校ごとの提出内容をそのまま設営資料として出力し、教育委員会への提出・当日の備品配置に使用します。</p></section>
      </div>
    </main>
  );
}
