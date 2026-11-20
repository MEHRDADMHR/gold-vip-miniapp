import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

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
    return typeof session.uid === "string" && Number.isSafeInteger(session.tid) &&
      typeof session.exp === "number" && session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch { return null; }
}

export async function GET(_request: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) return NextResponse.json({ error: "تنظیمات سرور کامل نیست." }, { status: 503 });

  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("gc_session")?.value, secret);
  if (!session) return NextResponse.json({ error: "ابتدا از طریق تلگرام وارد شوید." }, { status: 401 });

  const response = await fetch(
    `${url}/rest/v1/videos?select=id,title,description,thumbnail_url,preview_seconds,created_at&is_published=eq.true&order=created_at.desc`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!response.ok) return NextResponse.json({ error: "دریافت فهرست ویدیوها ناموفق بود." }, { status: 502 });
  const videos = await response.json();
  return NextResponse.json({ videos });
}
