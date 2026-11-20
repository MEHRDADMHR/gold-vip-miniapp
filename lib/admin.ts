import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

type Session = { uid: string; tid: number; exp: number };

function safeSignature(payload: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function requireAdmin() {
  const secret = process.env.SESSION_SECRET;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret || !url || !key) {
    return { error: NextResponse.json({ error: "Server configuration is incomplete" }, { status: 503 }) } as const;
  }

  const cookieStore = await cookies();
  const value = cookieStore.get("gc_session")?.value;
  const [payload, signature, extra] = value?.split(".") ?? [];
  if (!payload || !signature || extra || !safeSignature(payload, signature, secret)) {
    return { error: NextResponse.json({ error: "Please sign in with Telegram" }, { status: 401 }) } as const;
  }

  let session: Session;
  try {
    session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session;
  } catch {
    return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) } as const;
  }

  if (typeof session.uid !== "string" || !Number.isSafeInteger(session.tid) ||
      typeof session.exp !== "number" || session.exp <= Math.floor(Date.now() / 1000)) {
    return { error: NextResponse.json({ error: "Session expired" }, { status: 401 }) } as const;
  }

  const response = await fetch(
    `${url}/rest/v1/admins?select=role&user_id=eq.${encodeURIComponent(session.uid)}&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    return { error: NextResponse.json({ error: "Could not verify administrator access" }, { status: 502 }) } as const;
  }

  const admins = await response.json() as Array<{ role: string }>;
  if (!Array.isArray(admins) || admins.length === 0 || !["admin", "editor"].includes(admins[0].role)) {
    return { error: NextResponse.json({ error: "Administrator access required" }, { status: 403 }) } as const;
  }

  return { session, role: admins[0].role, url, key } as const;
}
