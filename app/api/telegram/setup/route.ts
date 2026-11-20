import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const setupKey = process.env.TELEGRAM_WEBHOOK_SETUP_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!setupKey || !botToken || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "Webhook setup environment variables are missing" }, { status: 503 });
  }

  const suppliedKey = request.nextUrl.searchParams.get("key") ?? "";
  if (suppliedKey.length !== setupKey.length || suppliedKey !== setupKey) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const webhookUrl = new URL("/api/telegram/webhook", request.nextUrl.origin).toString();
  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["channel_post"],
      drop_pending_updates: false,
    }),
    cache: "no-store",
  });

  const result = await telegramResponse.json() as { ok?: boolean; description?: string };
  if (!telegramResponse.ok || !result.ok) {
    return NextResponse.json({ ok: false, error: result.description ?? "Telegram rejected webhook setup" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, message: "Telegram channel webhook configured" });
}
