import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TelegramMedia = {
  file_id: string;
  file_name?: string;
  mime_type?: string;
};

type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string; title?: string };
  caption?: string;
  video?: TelegramMedia;
  document?: TelegramMedia;
};

type TelegramUpdate = { channel_post?: TelegramMessage };

export async function POST(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!botToken || !supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });
  }

  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (receivedSecret.length !== webhookSecret.length || receivedSecret !== webhookSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json() as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = update.channel_post;
  if (!message || message.chat.type !== "channel") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const media = message.video ??
    (message.document?.mime_type?.startsWith("video/") ? message.document : undefined);
  if (!media?.file_id) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const storageKey = `telegram:${media.file_id}`;
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  // Telegram may retry webhook deliveries; avoid inserting the same file twice.
  const existing = await fetch(
    `${baseUrl}/rest/v1/videos?select=id&storage_key=eq.${encodeURIComponent(storageKey)}&limit=1`,
    { headers, cache: "no-store" },
  );
  if (!existing.ok) {
    return NextResponse.json({ ok: false, error: "Could not check existing video" }, { status: 502 });
  }
  const existingRows = await existing.json() as Array<{ id: string }>;
  if (existingRows.length > 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const caption = message.caption?.trim() ?? "";
  const title = caption.split("\n")[0]?.slice(0, 180) ||
    media.file_name?.replace(/\.[^.]+$/, "").slice(0, 180) ||
    `ویدیوی تلگرام ${message.message_id}`;

  const saved = await fetch(`${baseUrl}/rest/v1/videos`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({
      title,
      description: caption || null,
      storage_key: storageKey,
      preview_seconds: 30,
      is_published: false,
    }),
    cache: "no-store",
  });

  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: "Could not save video record" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, saved: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "Loti Premium Telegram webhook" });
}
