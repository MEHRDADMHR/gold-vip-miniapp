import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string };

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "Telegram bot token is not configured" }, { status: 503 });
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
  if (!safeEqual(calculatedHash, receivedHash.toLowerCase())) {
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

  if (!user || !Number.isSafeInteger(user.id)) {
    return NextResponse.json({ error: "Telegram user not found" }, { status: 400 });
  }

  // Identity is verified here. Persisting accounts and subscription state requires a database.
  return NextResponse.json({
    verified: true,
    user: { id: user.id, first_name: user.first_name ?? "", username: user.username ?? "" },
    subscription: { active: false },
  });
}
