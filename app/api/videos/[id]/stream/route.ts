import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";
import { getR2Config } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Session = { uid: string; tid: number; exp: number };

function verifySession(value: string | undefined, secret: string): Session | null {
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return null; }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
    if (typeof session.uid !== "string" || !Number.isSafeInteger(session.tid) ||
        typeof session.exp !== "number" || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch { return null; }
}

async function dbGet(url: string, key: string, path: string) {
  return fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const secret = process.env.SESSION_SECRET;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) {
    return NextResponse.json({ error: "تنظیمات ورود و دیتابیس سرور کامل نیست." }, { status: 503 });
  }

  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("gc_session")?.value, secret);
  if (!session) return NextResponse.json({ error: "ابتدا از طریق تلگرام وارد شوید." }, { status: 401 });

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "شناسه ویدیو معتبر نیست." }, { status: 400 });

  const videoResponse = await dbGet(url, key, `videos?select=id,storage_key,is_published&id=eq.${encodeURIComponent(id)}&limit=1`);
  if (!videoResponse.ok) return NextResponse.json({ error: "دریافت اطلاعات ویدیو ناموفق بود." }, { status: 502 });
  const videos = await videoResponse.json() as Array<{ id: string; storage_key: string; is_published: boolean }>;
  const video = videos[0];
  if (!video || !video.is_published || typeof video.storage_key !== "string" || !video.storage_key.startsWith("videos/")) {
    return NextResponse.json({ error: "این ویدیو در دسترس نیست." }, { status: 404 });
  }

  const adminResponse = await dbGet(url, key, `admins?select=role&user_id=eq.${encodeURIComponent(session.uid)}&limit=1`);
  if (!adminResponse.ok) return NextResponse.json({ error: "بررسی دسترسی ناموفق بود." }, { status: 502 });
  const admins = await adminResponse.json() as Array<{ role: string }>;
  const isAdmin = Array.isArray(admins) && admins.some((admin) => ["admin", "editor"].includes(admin.role));

  if (!isAdmin) {
    const userResponse = await dbGet(url, key, `users?select=id,is_blocked&id=eq.${encodeURIComponent(session.uid)}&limit=1`);
    if (!userResponse.ok) return NextResponse.json({ error: "بررسی حساب کاربری ناموفق بود." }, { status: 502 });
    const users = await userResponse.json() as Array<{ id: string; is_blocked?: boolean }>;
    if (!users[0] || users[0].is_blocked) return NextResponse.json({ error: "حساب کاربری مجاز نیست." }, { status: 403 });

    const activeAfter = encodeURIComponent(new Date().toISOString());
    const subResponse = await dbGet(url, key, `subscriptions?select=id&user_id=eq.${encodeURIComponent(session.uid)}&status=eq.active&expires_at=gt.${activeAfter}&limit=1`);
    if (!subResponse.ok) return NextResponse.json({ error: "بررسی اشتراک ناموفق بود." }, { status: 502 });
    const subscriptions = await subResponse.json() as unknown[];
    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      return NextResponse.json({ error: "برای پخش کامل ویدیو به اشتراک فعال نیاز دارید." }, { status: 403 });
    }
  }

  try {
    const { client, bucket } = getR2Config();
    const range = request.headers.get("range") || undefined;
    const object = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: video.storage_key,
      ...(range ? { Range: range } : {}),
    }));
    if (!object.Body) return NextResponse.json({ error: "فایل ویدیو پیدا نشد." }, { status: 404 });

    const headers = new Headers({
      "Content-Type": object.ContentType || "video/mp4",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    });
    if (object.ContentLength !== undefined) headers.set("Content-Length", String(object.ContentLength));
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange);
    return new Response(object.Body.transformToWebStream(), {
      status: range ? 206 : 200,
      headers,
    });
  } catch (error) {
    console.error("Protected video stream failed", error);
    return NextResponse.json({ error: "پخش ویدیو در حال حاضر ممکن نیست." }, { status: 502 });
  }
}
