"use client";

import { useEffect, useState } from "react";

type Video = { id: string; title: string; description?: string | null; thumbnail_url?: string | null; preview_seconds?: number };

export default function LibraryPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selected, setSelected] = useState<Video | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/videos", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "دریافت ویدیوها ناموفق بود");
        setVideos(Array.isArray(data.videos) ? data.videos : []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "خطای نامشخص"))
      .finally(() => setLoading(false));
  }, []);

  return <main dir="rtl" style={{ minHeight: "100vh", background: "#090909", color: "#f6f0df", padding: "32px 18px", fontFamily: "inherit" }}>
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <a href="/" style={{ color: "#d8b45c", textDecoration: "none" }}>← بازگشت</a>
        <h1 style={{ color: "#d8b45c", margin: 0 }}>کتابخانه لوتی پریمیوم</h1>
      </header>
      {loading && <p>در حال دریافت ویدیوها…</p>}
      {error && <p role="alert" style={{ color: "#ff8d8d" }}>{error}</p>}
      {!loading && !error && videos.length === 0 && <p style={{ color: "#b9b09b" }}>هنوز ویدیوی منتشرشده‌ای وجود ندارد.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 18 }}>
        {videos.map((video) => <article key={video.id} style={{ background: "#151515", border: "1px solid #493a1c", borderRadius: 14, overflow: "hidden" }}>
          {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover" }} /> : <div style={{ aspectRatio: "16/9", display: "grid", placeItems: "center", color: "#b99443", background: "linear-gradient(135deg,#211b0e,#090909)", fontSize: 42 }}>▶</div>}
          <div style={{ padding: 16 }}>
            <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>{video.title}</h2>
            {video.description && <p style={{ color: "#b9b09b", fontSize: 14, lineHeight: 1.8 }}>{video.description}</p>}
            <button onClick={() => setSelected(video)} style={{ width: "100%", border: 0, borderRadius: 8, padding: 12, background: "#c8a34d", color: "#17120a", fontWeight: 700, cursor: "pointer" }}>پخش ویدیو</button>
          </div>
        </article>)}
      </div>
      {selected && <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,.88)", display: "grid", placeItems: "center", padding: 18 }}>
        <div style={{ width: "min(900px,100%)", background: "#111", border: "1px solid #725a27", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <h2 style={{ color: "#d8b45c", fontSize: 18 }}>{selected.title}</h2>
            <button onClick={() => setSelected(null)} style={{ background: "transparent", border: 0, color: "white", fontSize: 24, cursor: "pointer" }} aria-label="بستن">×</button>
          </div>
          <video controls playsInline preload="metadata" style={{ width: "100%", maxHeight: "70vh", background: "#000" }} src={`/api/videos/${encodeURIComponent(selected.id)}/stream`} />
          <p style={{ color: "#b9b09b", fontSize: 13 }}>پخش کامل فقط با اشتراک فعال امکان‌پذیر است.</p>
        </div>
      </div>}
    </div>
  </main>;
}
