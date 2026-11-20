import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string };

function safeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function signSession(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!botToken || !supabaseUrl || !serviceRoleKey || !sessionSecret) {
    return NextResponse.json({ error: "Server authentication and database settings are incomplete" }, { status: 503 });
  }

  let body: { initData?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof body.initData !== "string" || body.initData.length > 10_000) {
    return NextResponse.json({ error: "Missing Telegram initData" }, { status: 400 });
  }

  const params = new URLSearchParams(body.initData);
  const receivedHash = params.get("hash");
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    return NextResponse.json({ error: "Invalid Telegram signature" }, { status: 401 });
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(calculatedHash, receivedHash)) {
    return NextResponse.json({ error: "Telegram verification failed" }, { status: 401 });
  }

  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate > now + 30 || now - authDate > 60 * 60 * 24) {
    return NextResponse.json({ error: "Telegram session expired" }, { status: 401 });
  }

  let user: TelegramUser | null = null;
  try {
    user = JSON.parse(params.get("user") || "null") as TelegramUser | null;
  } catch {
    return NextResponse.json({ error: "Invalid Telegram user data" }, { status: 400 });
  }

  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0) {
    return NextResponse.json({ error: "Telegram user not found" }, { status: 400 });
  }

  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  const upsertResponse = await fetch(`${baseUrl}/rest/v1/users?on_conflict=telegram_id`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      telegram_id: user.id,
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      username: user.username ?? null,
      updated_at: new Date().toISOString(),
    }),
    cache: "no-store",
  });

  if (!upsertResponse.ok) {
    return NextResponse.json({ error: "Could not save Telegram account" }, { status: 502 });
  }

  const savedUsers = await upsertResponse.json();
  const savedUser = Array.isArray(savedUsers) ? savedUsers[0] : null;
  if (!savedUser?.id || savedUser.is_blocked) {
    return NextResponse.json({ error: savedUser?.is_blocked ? "This account is blocked" : "Account record unavailable" }, { status: 403 });
  }

  const subscriptionResponse = await fetch(
    `${baseUrl}/rest/v1/subscriptions?select=id,plan_id,expires_at,status&user_id=eq.${encodeURIComponent(savedUser.id)}&status=eq.active&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&order=expires_at.desc&limit=1`,
    { headers, cache: "no-store" },
  );

  if (!subscriptionResponse.ok) {
    return NextResponse.json({ error: "Could not check membership status" }, { status: 502 });
  }

  const subscriptions = await subscriptionResponse.json();
  const subscription = Array.isArray(subscriptions) ? subscriptions[0] ?? null : null;
  const sessionPayload = Buffer.from(JSON.stringify({
    uid: savedUser.id,
    tid: user.id,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  })).toString("base64url");
  const sessionValue = `${sessionPayload}.${signSession(sessionPayload, sessionSecret)}`;

  const response = NextResponse.json({
    verified: true,
    user: { id: user.id, first_name: user.first_name ?? "", username: user.username ?? "" },
    subscription: subscription
      ? { active: true, plan_id: subscription.plan_id, expires_at: subscription.expires_at }
      : { active: false },
  });

  response.cookies.set("gc_session", sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
