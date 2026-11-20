import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function getAdmin() {
  const auth = await requireAdmin();
  if ("error" in auth) return { response: auth.error };
  if (auth.role !== "admin") {
    return { response: NextResponse.json({ error: "فقط مدیر اصلی اجازه تنظیم روش‌های پرداخت را دارد." }, { status: 403 }) };
  }
  return { auth };
}

export async function GET() {
  const result = await getAdmin();
  if ("response" in result) return result.response;
  const { auth } = result;
  const response = await fetch(`${auth.url}/rest/v1/payment_settings?id=eq.1&select=usdt_bep20_address,usdt_solana_address,usdt_polygon_address,bnb_address,sol_address,pol_address,card_number,card_holder,usdt_enabled,bnb_enabled,sol_enabled,pol_enabled,card_enabled`, {
    headers: { apikey: auth.key, Authorization: `Bearer ${auth.key}` },
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ error: "خواندن تنظیمات پرداخت ناموفق بود. ابتدا دستور ساخت جدول را در Supabase اجرا کن." }, { status: 502 });
  const rows = await response.json();
  return NextResponse.json({ settings: Array.isArray(rows) && rows[0] ? rows[0] : {
    usdt_bep20_address: "", usdt_solana_address: "", usdt_polygon_address: "", bnb_address: "", sol_address: "", pol_address: "", card_number: "", card_holder: "", usdt_enabled: true, bnb_enabled: false, sol_enabled: false, pol_enabled: false, card_enabled: true,
  } });
}

export async function POST(request: NextRequest) {
  const result = await getAdmin();
  if ("response" in result) return result.response;
  const { auth } = result;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const usdtAddress = typeof body.usdt_bep20_address === "string" ? body.usdt_bep20_address.trim() : "";
  const solanaAddress = typeof body.usdt_solana_address === "string" ? body.usdt_solana_address.trim() : "";
  const polygonAddress = typeof body.usdt_polygon_address === "string" ? body.usdt_polygon_address.trim() : "";
  const bnbAddress = typeof body.bnb_address === "string" ? body.bnb_address.trim() : "";
  const solAddress = typeof body.sol_address === "string" ? body.sol_address.trim() : "";
  const polAddress = typeof body.pol_address === "string" ? body.pol_address.trim() : "";
  const cardNumber = typeof body.card_number === "string" ? body.card_number.replace(/[\s-]/g, "") : "";
  const cardHolder = typeof body.card_holder === "string" ? body.card_holder.trim() : "";
  if (usdtAddress && !/^0x[a-fA-F0-9]{40}$/.test(usdtAddress)) {
    return NextResponse.json({ error: "آدرس کیف پول BEP20 باید یک آدرس معتبر ۴۲ کاراکتری با 0x باشد." }, { status: 400 });
  }
  if (solanaAddress && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solanaAddress)) {
    return NextResponse.json({ error: "آدرس سولانا معتبر نیست." }, { status: 400 });
  }
  if (polygonAddress && !/^0x[a-fA-F0-9]{40}$/.test(polygonAddress)) {
    return NextResponse.json({ error: "آدرس Polygon باید یک آدرس معتبر ۴۲ کاراکتری با 0x باشد." }, { status: 400 });
  }
  if (bnbAddress && !/^0x[a-fA-F0-9]{40}$/.test(bnbAddress)) return NextResponse.json({ error: "آدرس BNB معتبر نیست." }, { status: 400 });
  if (solAddress && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solAddress)) return NextResponse.json({ error: "آدرس SOL معتبر نیست." }, { status: 400 });
  if (polAddress && !/^0x[a-fA-F0-9]{40}$/.test(polAddress)) return NextResponse.json({ error: "آدرس POL معتبر نیست." }, { status: 400 });
  if (cardNumber && !/^\d{16}$/.test(cardNumber)) {
    return NextResponse.json({ error: "شماره کارت باید ۱۶ رقم باشد." }, { status: 400 });
  }
  if (cardHolder.length > 100) return NextResponse.json({ error: "نام صاحب کارت بیش از حد طولانی است." }, { status: 400 });

  const payload = {
    id: 1,
    usdt_bep20_address: usdtAddress,
    usdt_solana_address: solanaAddress,
    usdt_polygon_address: polygonAddress,
    bnb_address: bnbAddress,
    sol_address: solAddress,
    pol_address: polAddress,
    card_number: cardNumber,
    card_holder: cardHolder,
    usdt_enabled: body.usdt_enabled !== false,
    bnb_enabled: body.bnb_enabled === true,
    sol_enabled: body.sol_enabled === true,
    pol_enabled: body.pol_enabled === true,
    card_enabled: body.card_enabled !== false,
    updated_at: new Date().toISOString(),
  };
  const response = await fetch(`${auth.url}/rest/v1/payment_settings?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: auth.key,
      Authorization: `Bearer ${auth.key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ error: "ذخیره تنظیمات پرداخت ناموفق بود." }, { status: 502 });
  return NextResponse.json({ ok: true });
}
