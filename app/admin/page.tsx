"use client";

import { useCallback, useEffect, useState } from "react";

type Row = Record<string, unknown>;
type DashboardData = {
  role: string;
  data: { users: Row[]; videos: Row[]; plans: Row[]; subscriptions: Row[] };
};
type VideoForm = { id?: string; title: string; description: string; thumbnail_url: string; storage_key: string; preview_storage_key: string; preview_seconds: string; is_published: boolean };
const emptyVideo: VideoForm = { title: "", description: "", thumbnail_url: "", storage_key: "", preview_storage_key: "", preview_seconds: "15", is_published: false };
const labels: Record<string, string> = { users: "کاربران", videos: "ویدیوها", plans: "پلن‌ها", subscriptions: "اشتراک‌ها" };

export default function AdminPage() {
  const [result, setResult] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [video, setVideo] = useState<VideoForm>(emptyVideo);
  const [showVideoForm, setShowVideoForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [planEdits, setPlanEdits] = useState<Record<string, { title: string; duration_days: string; price_minor: string; currency: string; is_active: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/overview", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "بارگذاری اطلاعات ناموفق بود");
      setResult(body as DashboardData);
      const edits: typeof planEdits = {};
      for (const p of body.data.plans as Row[]) {
        const id = String(p.id);
        edits[id] = { title: String(p.title ?? ""), duration_days: String(p.duration_days ?? 30), price_minor: String(p.price_minor ?? 0), currency: String(p.currency ?? "IRR"), is_active: p.is_active !== false };
      }
      setPlanEdits(edits);
    } catch (e) { setError(e instanceof Error ? e.message : "خطای نامشخص"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function mutate(method: "POST" | "PATCH" | "DELETE", body?: unknown, query = "") {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/manage" + query, {
        method, headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "عملیات ناموفق بود");
      setNotice("تغییرات با موفقیت ذخیره شد.");
      await load();
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "خطای نامشخص"); return false; }
    finally { setSaving(false); }
  }

  async function uploadVideoFile(file: File, purpose: "video" | "preview" = "video") {
    const initResponse = await fetch("/api/admin/videos/upload/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, purpose }),
    });
    const init = await initResponse.json();
    if (!initResponse.ok) throw new Error(init.error || "شروع آپلود ناموفق بود");

    const uploadedParts: Array<{ partNumber: number; etag: string }> = [];
    for (const part of init.parts as Array<{ partNumber: number; url: string }>) {
      const start = (part.partNumber - 1) * Number(init.partSize);
      const end = Math.min(start + Number(init.partSize), file.size);
      const response = await fetch(part.url, { method: "PUT", body: file.slice(start, end) });
      if (!response.ok) throw new Error("آپلود بخش " + part.partNumber + " ناموفق بود");
      const etag = response.headers.get("ETag");
      if (!etag) throw new Error("ETag فایل دریافت نشد؛ تنظیم CORS باکت را بررسی کن");
      uploadedParts.push({ partNumber: part.partNumber, etag });
      setUploadProgress(Math.round((uploadedParts.length / init.parts.length) * 100));
    }

    const completeResponse = await fetch("/api/admin/videos/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: init.key, uploadId: init.uploadId, parts: uploadedParts }),
    });
    const complete = await completeResponse.json();
    if (!completeResponse.ok) throw new Error(complete.error || "تکمیل آپلود ناموفق بود");
    return String(complete.storage_key);
  }

  async function saveVideo(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice(""); setUploadProgress(0);
    try {
      let storage_key = video.storage_key;
      let preview_storage_key = video.preview_storage_key;
      if (videoFile) storage_key = await uploadVideoFile(videoFile, "video");
      if (previewFile) preview_storage_key = await uploadVideoFile(previewFile, "preview");
      if (!storage_key) throw new Error("ابتدا فایل ویدیویی را انتخاب کن.");
      const ok = await mutate(video.id ? "PATCH" : "POST", { kind: "video", ...video, storage_key, preview_storage_key, preview_seconds: 15 });
      if (ok) { setVideo(emptyVideo); setVideoFile(null); setPreviewFile(null); setShowVideoForm(false); setUploadProgress(0); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "آپلود ویدیو ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  function editVideo(row: Row) {
    setVideo({ id: String(row.id), title: String(row.title ?? ""), description: String(row.description ?? ""), thumbnail_url: String(row.thumbnail_url ?? ""), storage_key: String(row.storage_key ?? ""), preview_storage_key: String(row.preview_storage_key ?? ""), preview_seconds: "15", is_published: row.is_published === true });
    setVideoFile(null); setPreviewFile(null); setUploadProgress(0);
    setShowVideoForm(true);
  }

  async function savePlan(id: string) {
    const p = planEdits[id];
    if (!p) return;
    await mutate("POST", { kind: "plan", id, ...p, duration_days: Number(p.duration_days), price_minor: Number(p.price_minor) });
  }

  const counts = result ? (["users", "videos", "plans", "subscriptions"] as const).map(key => [key, result.data[key].length] as const) : [];

  return <main className="admin-page" dir="rtl">
    <header className="admin-header"><a href="/" className="admin-brand"><span>G</span> لوتی پریمیوم</a><div><span className="admin-role">{result?.role === "admin" ? "مدیر اصلی" : "مدیر محتوا"}</span><a href="/">بازگشت به سایت ↗</a></div></header>
    <section className="admin-content">
      <div className="admin-heading"><div><p className="admin-eyebrow">CONTROL CENTER / 2026</p><h1>پنل مدیریت <em>طلایی</em></h1><p>مدیریت کاربران، محتوا و اشتراک‌های لوتی پریمیوم</p></div><button onClick={() => void load()} disabled={loading}>بروزرسانی ↻</button></div>
      {error && <div className="admin-error">{error}</div>}{notice && <div className="admin-notice">{notice}</div>}
      {loading && <div className="admin-loading">در حال دریافت اطلاعات امن پنل…</div>}
      {result && <>
        <div className="admin-stats">{counts.map(([key, count]) => <article key={key}><span>{labels[key]}</span><strong>{count.toLocaleString("fa-IR")}</strong><small>رکوردهای دریافت‌شده</small></article>)}</div>
        <section className="admin-panel admin-wide">
          <div className="admin-panel-title"><h2>مدیریت ویدیوها</h2><button className="admin-action" onClick={() => { setVideo(emptyVideo); setVideoFile(null); setPreviewFile(null); setUploadProgress(0); setShowVideoForm(!showVideoForm); }}>+ افزودن ویدیو</button></div>
          {showVideoForm && <form className="admin-form" onSubmit={saveVideo}>
            <label>عنوان ویدیو<input required value={video.title} onChange={e => setVideo({ ...video, title: e.target.value })}/></label>
            <label>انتخاب فایل ویدیو (حداکثر ۵۰۰ مگابایت)<input type="file" accept="video/*" onChange={e => { const file = e.target.files?.[0] || null; if (file && file.size > 500 * 1024 * 1024) { setError("حجم فایل نباید بیشتر از ۵۰۰ مگابایت باشد."); e.target.value = ""; setVideoFile(null); return; } setError(""); setVideoFile(file); }}/></label>
            {videoFile && <p className="admin-hint">فایل انتخاب‌شده: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(1)} مگابایت)</p>}
            {saving && videoFile && <p className="admin-hint">در حال آپلود مستقیم به فضای ابری: {uploadProgress}٪</p>}
            <label>فایل پیش‌نمایش ۱۵ ثانیه‌ای (اختیاری، فقط برای کاربران بدون اشتراک)<input type="file" accept="video/*" onChange={e => { const file = e.target.files?.[0] || null; if (file && file.size > 500 * 1024 * 1024) { setError("حجم فایل پیش‌نمایش نباید بیشتر از ۵۰۰ مگابایت باشد."); e.target.value = ""; setPreviewFile(null); return; } setError(""); setPreviewFile(file); }}/></label>
            {previewFile && <p className="admin-hint">پیش‌نمایش انتخاب‌شده: {previewFile.name}. لطفاً قبل از آپلود، آن را به ۱۵ ثانیه اول برش بده.</p>}
            {video.preview_storage_key && !previewFile && <p className="admin-hint">برای این ویدیو فایل پیش‌نمایش ثبت شده است.</p>}
            <label>آدرس تصویر کاور<input value={video.thumbnail_url} onChange={e => setVideo({ ...video, thumbnail_url: e.target.value })}/></label>
            <label>توضیحات<textarea value={video.description} onChange={e => setVideo({ ...video, description: e.target.value })}/></label>
            <p className="admin-hint">مدت پیش‌نمایش برای همه کاربران بدون اشتراک ثابت و برابر ۱۵ ثانیه است.</p>
            <label className="admin-check"><input type="checkbox" checked={video.is_published} onChange={e => setVideo({ ...video, is_published: e.target.checked })}/> انتشار و نمایش ویدیو</label>
            <div className="admin-form-actions"><button disabled={saving}>{saving ? "در حال ذخیره…" : "ذخیره ویدیو"}</button><button type="button" onClick={() => setShowVideoForm(false)}>انصراف</button></div>
          </form>}
          {result.data.videos.length === 0 ? <p className="admin-empty">هنوز ویدیویی ثبت نشده است.</p> : <div className="admin-table-wrap"><table><thead><tr><th>عنوان</th><th>پیش‌نمایش</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{result.data.videos.map(row => <tr key={String(row.id)}><td>{String(row.title)}</td><td>{String(row.preview_seconds)} ثانیه</td><td>{row.is_published ? "منتشرشده" : "پیش‌نویس"}</td><td><button className="admin-text-action" onClick={() => editVideo(row)}>ویرایش</button><button className="admin-text-action danger" onClick={() => { if (confirm("این ویدیو حذف شود؟")) void mutate("DELETE", undefined, "?id=" + encodeURIComponent(String(row.id))); }}>حذف</button></td></tr>)}</tbody></table></div>}
          <p className="admin-hint">فایل‌ها مستقیماً و به‌صورت خصوصی در Cloudflare R2 ذخیره می‌شوند. برای جایگزینی فایل ویدیوی قبلی، فایل جدید انتخاب کن.</p>
        </section>

        <section className="admin-panel admin-wide">
          <div className="admin-panel-title"><h2>تنظیم پلن‌های اشتراک</h2><span>قیمت‌ها به کوچک‌ترین واحد ارز وارد شوند.</span></div>
          <div className="admin-table-wrap"><table><thead><tr><th>شناسه</th><th>عنوان</th><th>روز</th><th>قیمت</th><th>ارز</th><th>فعال</th><th></th></tr></thead><tbody>{result.data.plans.map(row => {
            const id = String(row.id); const p = planEdits[id]; if (!p) return null;
            return <tr key={id}><td>{id}</td><td><input value={p.title} onChange={e => setPlanEdits(old => ({ ...old, [id]: { ...p, title: e.target.value } }))}/></td><td><input type="number" min="1" value={p.duration_days} onChange={e => setPlanEdits(old => ({ ...old, [id]: { ...p, duration_days: e.target.value } }))}/></td><td><input type="number" min="0" value={p.price_minor} onChange={e => setPlanEdits(old => ({ ...old, [id]: { ...p, price_minor: e.target.value } }))}/></td><td><input value={p.currency} onChange={e => setPlanEdits(old => ({ ...old, [id]: { ...p, currency: e.target.value } }))}/></td><td><input type="checkbox" checked={p.is_active} onChange={e => setPlanEdits(old => ({ ...old, [id]: { ...p, is_active: e.target.checked } }))}/></td><td><button className="admin-text-action" onClick={() => void savePlan(id)} disabled={saving}>ذخیره</button></td></tr>;
          })}</tbody></table></div>
        </section>

        <div className="admin-sections">
          {(["users", "subscriptions"] as const).map(key => <section className="admin-panel" key={key}><div className="admin-panel-title"><h2>{labels[key]}</h2><span>{result.data[key].length} رکورد</span></div>
            {result.data[key].length === 0 ? <p className="admin-empty">هنوز موردی ثبت نشده است.</p> : <div className="admin-table-wrap"><table><thead><tr><th>{key === "users" ? "کاربر" : "پلن"}</th><th>{key === "users" ? "شناسه تلگرام" : "وضعیت"}</th>{key === "users" && <th>دسترسی</th>}</tr></thead><tbody>{result.data[key].map(row => <tr key={String(row.id)}><td>{key === "users" ? String(row.first_name || row.username || "کاربر") : String(row.plan_id)}</td><td>{key === "users" ? String(row.telegram_id) : String(row.status)}</td>{key === "users" && <td><button className="admin-text-action" onClick={() => void mutate("POST", { kind: "user", telegram_id: Number(row.telegram_id), is_blocked: row.is_blocked !== true })}>{row.is_blocked ? "رفع مسدودی" : "مسدود کردن"}</button></td>}</tr>)}</tbody></table></div>}
          </section>)}
        </div>
      </>}
    </section>
  </main>;
}
