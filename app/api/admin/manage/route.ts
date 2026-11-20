import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function authOrResponse() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth;
  if (auth.role !== "admin") {
    return { error: NextResponse.json({ error: "فقط مدیر اصلی اجازه این تغییر را دارد." }, { status: 403 }) };
  }
  return auth;
}

async function supabaseRequest(url: string, key: string, path: string, method: string, body?: unknown, prefer?: string) {
  return fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
}

export async function POST(request: NextRequest) {
  const auth = await authOrResponse();
  if ("error" in auth) return auth.error;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  if (body.kind === "video") {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const storageKey = typeof body.storage_key === "string" ? body.storage_key.trim() : "";
    if (!title || !storageKey) return NextResponse.json({ error: "عنوان و مسیر فایل ویدیو الزامی است." }, { status: 400 });
    const payload = {
      title,
      description: typeof body.description === "string" ? body.description.trim() : null,
      thumbnail_url: typeof body.thumbnail_url === "string" && body.thumbnail_url.trim() ? body.thumbnail_url.trim() : null,
      storage_key: storageKey,
      preview_seconds: Math.max(0, Math.min(300, Number(body.preview_seconds) || 30)),
      is_published: body.is_published === true,
    };
    const response = await supabaseRequest(auth.url, auth.key, "videos", "POST", payload, "return=representation");
    if (!response.ok) return NextResponse.json({ error: "ذخیره ویدیو در دیتابیس ناموفق بود." }, { status: 502 });
    return NextResponse.json({ ok: true, data: await response.json() });
  }

  if (body.kind === "plan") {
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const duration = Number(body.duration_days);
    const price = Number(body.price_minor);
    if (!id || !title || !Number.isInteger(duration) || duration < 1 || !Number.isSafeInteger(price) || price < 0) {
      return NextResponse.json({ error: "اطلاعات پلن معتبر نیست." }, { status: 400 });
    }
    const response = await supabaseRequest(auth.url, auth.key, `plans?id=eq.${encodeURIComponent(id)}`, "PATCH", {
      title, duration_days: duration, price_minor: price,
      currency: typeof body.currency === "string" && body.currency.trim() ? body.currency.trim().toUpperCase() : "IRR",
      is_active: body.is_active !== false,
    }, "return=representation");
    if (!response.ok) return NextResponse.json({ error: "ویرایش پلن ناموفق بود." }, { status: 502 });
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "پلن پیدا نشد." }, { status: 404 });
    return NextResponse.json({ ok: true, data: rows });
  }

  if (body.kind === "user") {
    const telegramId = Number(body.telegram_id);
    if (!Number.isSafeInteger(telegramId) || telegramId <= 0 || typeof body.is_blocked !== "boolean") {
      return NextResponse.json({ error: "شناسه یا وضعیت کاربر معتبر نیست." }, { status: 400 });
    }
    const response = await supabaseRequest(auth.url, auth.key, `users?telegram_id=eq.${telegramId}`, "PATCH", {
      is_blocked: body.is_blocked, updated_at: new Date().toISOString(),
    }, "return=representation");
    if (!response.ok) return NextResponse.json({ error: "تغییر وضعیت کاربر ناموفق بود." }, { status: 502 });
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "کاربر پیدا نشد." }, { status: 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "نوع عملیات پشتیبانی نمی‌شود." }, { status: 400 });
}

export async function PATCH(request: NextRequest) {
  const auth = await authOrResponse();
  if ("error" in auth) return auth.error;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  if (body.kind !== "video" || typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "اطلاعات ویدیو معتبر نیست." }, { status: 400 });
  }
  const payload: Record<string, unknown> = {};
  for (const field of ["title", "description", "thumbnail_url", "storage_key", "preview_seconds", "is_published"]) {
    if (field in body) payload[field] = body[field];
  }
  if (typeof payload.title === "string") payload.title = payload.title.trim();
  if (typeof payload.storage_key === "string") payload.storage_key = payload.storage_key.trim();
  if ("preview_seconds" in payload) payload.preview_seconds = Math.max(0, Math.min(300, Number(payload.preview_seconds) || 0));
  const response = await supabaseRequest(auth.url, auth.key, `videos?id=eq.${encodeURIComponent(body.id)}`, "PATCH", payload, "return=representation");
  if (!response.ok) return NextResponse.json({ error: "ویرایش ویدیو ناموفق بود." }, { status: 502 });
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: "ویدیو پیدا نشد." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await authOrResponse();
  if ("error" in auth) return auth.error;
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "شناسه ویدیو الزامی است." }, { status: 400 });
  const response = await supabaseRequest(auth.url, auth.key, `videos?id=eq.${encodeURIComponent(id)}`, "DELETE");
  if (!response.ok) return NextResponse.json({ error: "حذف ویدیو ناموفق بود." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
