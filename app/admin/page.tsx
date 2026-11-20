"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;
type DashboardData = {
  role: string;
  data: { users: Row[]; videos: Row[]; plans: Row[]; subscriptions: Row[] };
};

const labels: Record<string, string> = {
  users: "کاربران",
  videos: "ویدیوها",
  plans: "پلن‌ها",
  subscriptions: "اشتراک‌ها",
};

export default function AdminPage() {
  const [result, setResult] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "بارگذاری اطلاعات ناموفق بود");
      setResult(body as DashboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای نامشخص");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const counts = result ? [
    ["users", result.data.users.length],
    ["videos", result.data.videos.length],
    ["plans", result.data.plans.length],
    ["subscriptions", result.data.subscriptions.length],
  ] as const : [];

  return (
    <main className="admin-page" dir="rtl">
      <header className="admin-header">
        <a href="/" className="admin-brand"><span>G</span> GOLDEN CLUB</a>
        <div><span className="admin-role">{result?.role === "admin" ? "مدیر اصلی" : "مدیر محتوا"}</span><a href="/">بازگشت به سایت ↗</a></div>
      </header>
      <section className="admin-content">
        <div className="admin-heading">
          <div><p className="admin-eyebrow">CONTROL CENTER / 2026</p><h1>پنل مدیریت <em>طلایی</em></h1><p>مدیریت کاربران، محتوا و اشتراک‌های GOLDEN CLUB</p></div>
          <button onClick={() => void load()} disabled={loading}>{loading ? "در حال بروزرسانی…" : "بروزرسانی ↻"}</button>
        </div>
        {error && <div className="admin-error">{error}{error.includes("sign in") ? " — ابتدا مینی‌اپ را از داخل تلگرام باز کن." : ""}</div>}
        {loading && <div className="admin-loading">در حال دریافت اطلاعات امن پنل…</div>}
        {result && <>
          <div className="admin-stats">
            {counts.map(([key, count]) => <article key={key}><span>{labels[key]}</span><strong>{count.toLocaleString("fa-IR")}</strong><small>آخرین ۱۰۰ رکورد قابل نمایش</small></article>)}
          </div>
          <div className="admin-sections">
            {(["users", "subscriptions", "videos", "plans"] as const).map((key) => (
              <section className="admin-panel" key={key}>
                <div className="admin-panel-title"><h2>{labels[key]}</h2><span>{result.data[key].length.toLocaleString("fa-IR")} رکورد</span></div>
                {result.data[key].length === 0 ? <p className="admin-empty">هنوز موردی ثبت نشده است.</p> : <div className="admin-table-wrap"><table><tbody>
                  {result.data[key].slice(0, 12).map((row, index) => {
                    const primary = String(row.first_name || row.title || row.plan_id || row.telegram_id || row.id || "—");
                    const secondary = String(row.username || row.status || row.duration_days || row.expires_at || "");
                    return <tr key={String(row.id || row.telegram_id || index)}><td>{primary}</td><td>{secondary}</td></tr>;
                  })}
                </tbody></table></div>}
              </section>
            ))}
          </div>
        </>}
      </section>
    </main>
  );
}
