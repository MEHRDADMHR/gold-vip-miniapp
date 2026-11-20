import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") return NextResponse.json({ error: "فقط مدیر اصلی می‌تواند سفارش‌های پرداخت را بررسی کند." }, { status: 403 });

  const response = await fetch(
    `${auth.url}/rest/v1/payment_orders?select=id,user_id,plan_id,amount_minor,currency,payment_method,network,payment_reference,status,created_at,users(first_name,telegram_id,username),plans(title,duration_days)&order=created_at.desc&limit=100`,
    { headers: { apikey: auth.key, Authorization: `Bearer ${auth.key}` }, cache: "no-store" },
  );
  if (!response.ok) {
    const raw = await response.text();
    let detail = raw;
    try {
      const data = JSON.parse(raw);
      detail = [data.message, data.details, data.hint, data.code].filter(Boolean).join(" | ") || raw;
    } catch {}
    return NextResponse.json(
      { error: "دریافت سفارش‌های پرداخت ناموفق بود.", detail },
      { status: 502 },
    );
  }
  return NextResponse.json({ orders: await response.json() });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  if (auth.role !== "admin") return NextResponse.json({ error: "فقط مدیر اصلی می‌تواند پرداخت را تأیید یا رد کند." }, { status: 403 });

  let body: { order_id?: unknown; decision?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }
  if (typeof body.order_id !== "string" || !/^[a-f0-9-]{36}$/i.test(body.order_id) ||
      !["approved", "rejected"].includes(String(body.decision))) {
    return NextResponse.json({ error: "شناسه سفارش یا تصمیم معتبر نیست." }, { status: 400 });
  }

  const response = await fetch(`${auth.url}/rest/v1/rpc/review_payment_order`, {
    method: "POST",
    headers: {
      apikey: auth.key, Authorization: `Bearer ${auth.key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_order_id: body.order_id,
      p_admin_user_id: auth.session.uid,
      p_decision: body.decision,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    let message = "بررسی سفارش ناموفق بود.";
    try {
      const data = await response.json();
      if (typeof data.message === "string") message = data.message;
    } catch {}
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(await response.json());
}
