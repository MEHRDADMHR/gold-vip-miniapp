import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type Session = { uid: string; tid: number; exp: number };

function validSignature(payload: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "base64url"); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function getContext() {
  const secret = process.env.SESSION_SECRET;
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !url || !key) return { error: NextResponse.json({ error: "تنظیمات سرور کامل نیست." }, { status: 503 }) };

  const value = (await cookies()).get("gc_session")?.value;
  const [payload, signature, extra] = value?.split(".") ?? [];
  if (!payload || !signature || extra || !validSignature(payload, signature, secret)) {
    return { error: NextResponse.json({ error: "ابتدا از طریق تلگرام وارد شو." }, { status: 401 }) };
  }
  let session: Session;
  try { session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session; }
  catch { return { error: NextResponse.json({ error: "نشست نامعتبر است." }, { status: 401 }) }; }
  if (typeof session.uid !== "string" || !Number.isSafeInteger(session.tid) ||
      typeof session.exp !== "number" || session.exp <= Math.floor(Date.now() / 1000)) {
    return { error: NextResponse.json({ error: "نشست منقضی شده است. دوباره وارد شو." }, { status: 401 }) };
  }
  return { url, key, session };
}

export async function POST(request: NextRequest) {
  const context = await getContext();
  if ("error" in context) return context.error;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "اطلاعات ارسالی نامعتبر است." }, { status: 400 }); }

  const planId = typeof body.plan_id === "string" ? body.plan_id.trim() : "";
  const method = body.payment_method;
  const network = body.network;
  const reference = typeof body.payment_reference === "string" ? body.payment_reference.trim() : "";
  if (!planId || !["usdt", "bnb", "sol", "pol", "card"].includes(String(method))) {
    return NextResponse.json({ error: "پلن یا روش پرداخت معتبر نیست." }, { status: 400 });
  }
  if (reference.length < 5 || reference.length > 500) {
    return NextResponse.json({ error: "شناسه تراکنش یا توضیح رسید را وارد کن (حداقل ۵ کاراکتر)." }, { status: 400 });
  }
  if (method === "usdt" && !["bep20", "solana", "polygon"].includes(String(network))) {
    return NextResponse.json({ error: "شبکه تتر معتبر نیست." }, { status: 400 });
  }
  if (method !== "usdt" && network !== null && network !== undefined && network !== "") {
    return NextResponse.json({ error: "برای این روش پرداخت نباید شبکه جداگانه ارسال شود." }, { status: 400 });
  }

  const headers = { apikey: context.key, Authorization: `Bearer ${context.key}`, "Content-Type": "application/json" };
  const userResponse = await fetch(`${context.url}/rest/v1/users?select=id,is_blocked&id=eq.${encodeURIComponent(context.session.uid)}&limit=1`, { headers, cache: "no-store" });
  if (!userResponse.ok) return NextResponse.json({ error: "بررسی حساب کاربری ناموفق بود." }, { status: 502 });
  const users = await userResponse.json() as Array<{ id: string; is_blocked: boolean }>;
  if (!users[0] || users[0].is_blocked) return NextResponse.json({ error: "حساب کاربری مجاز به ثبت سفارش نیست." }, { status: 403 });

  const planResponse = await fetch(`${context.url}/rest/v1/plans?select=id,price_minor,currency&id=eq.${encodeURIComponent(planId)}&is_active=eq.true&limit=1`, { headers, cache: "no-store" });
  if (!planResponse.ok) return NextResponse.json({ error: "دریافت اطلاعات پلن ناموفق بود." }, { status: 502 });
  const plans = await planResponse.json() as Array<{ id: string; price_minor: number; currency: string }>;
  const plan = plans[0];
  if (!plan || plan.currency !== "USD" || !Number.isSafeInteger(Number(plan.price_minor)) || Number(plan.price_minor) <= 0) {
    return NextResponse.json({ error: "این پلن در حال حاضر قابل خرید نیست." }, { status: 400 });
  }

  const settingsResponse = await fetch(`${context.url}/rest/v1/payment_settings?id=eq.1&select=usdt_bep20_address,usdt_solana_address,usdt_polygon_address,bnb_address,sol_address,pol_address,card_number,card_holder,usdt_enabled,bnb_enabled,sol_enabled,pol_enabled,card_enabled`, { headers, cache: "no-store" });
  if (!settingsResponse.ok) return NextResponse.json({ error: "خواندن تنظیمات پرداخت ناموفق بود." }, { status: 502 });
  const settingsRows = await settingsResponse.json();
  const settings = settingsRows[0];
  if (!settings) return NextResponse.json({ error: "روش‌های پرداخت هنوز توسط مدیر تنظیم نشده‌اند." }, { status: 400 });

  if (method === "usdt") {
    const address = network === "bep20" ? settings.usdt_bep20_address : network === "solana" ? settings.usdt_solana_address : settings.usdt_polygon_address;
    if (!settings.usdt_enabled || !address) return NextResponse.json({ error: "این شبکه تتر هنوز توسط مدیر فعال و تنظیم نشده است." }, { status: 400 });
  } else if (method === "bnb" && (!settings.bnb_enabled || !settings.bnb_address)) {
    return NextResponse.json({ error: "پرداخت BNB هنوز توسط مدیر فعال و تنظیم نشده است." }, { status: 400 });
  } else if (method === "sol" && (!settings.sol_enabled || !settings.sol_address)) {
    return NextResponse.json({ error: "پرداخت SOL هنوز توسط مدیر فعال و تنظیم نشده است." }, { status: 400 });
  } else if (method === "pol" && (!settings.pol_enabled || !settings.pol_address)) {
    return NextResponse.json({ error: "پرداخت POL هنوز توسط مدیر فعال و تنظیم نشده است." }, { status: 400 });
  } else if (method === "card" && (!settings.card_enabled || !settings.card_number)) {
    return NextResponse.json({ error: "پرداخت کارت‌به‌کارت هنوز توسط مدیر فعال و تنظیم نشده است." }, { status: 400 });
  }

  const insertResponse = await fetch(`${context.url}/rest/v1/payment_orders`, {
    method: "POST",
    headers: { ...headers, Prefer: "return=representation" },
    body: JSON.stringify({
      user_id: users[0].id,
      plan_id: plan.id,
      amount_minor: Number(plan.price_minor),
      currency: "USD",
      payment_method: method,
      network: method === "usdt" ? network : null,
      payment_reference: reference,
    }),
    cache: "no-store",
  });
  if (!insertResponse.ok) {
    return NextResponse.json({ error: "ثبت سفارش انجام نشد. مطمئن شو جدول payment_orders را ساخته‌ای." }, { status: 502 });
  }
  const orders = await insertResponse.json();
  return NextResponse.json({ ok: true, order: { id: orders[0]?.id, status: "pending" } }, { status: 201 });
}
