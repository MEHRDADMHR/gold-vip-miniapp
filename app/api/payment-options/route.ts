import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "تنظیمات سرور کامل نیست." }, { status: 503 });

  const response = await fetch(
    `${url}/rest/v1/payment_settings?id=eq.1&select=usdt_bep20_address,usdt_solana_address,usdt_polygon_address,bnb_address,sol_address,pol_address,card_number,card_holder,usdt_enabled,bnb_enabled,sol_enabled,pol_enabled,card_enabled`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  if (!response.ok) return NextResponse.json({ error: "دریافت روش‌های پرداخت ناموفق بود." }, { status: 502 });
  const rows = await response.json();
  const settings = rows[0];
  if (!settings) return NextResponse.json({ methods: { usdt: [], native: [], card: null } });

  const usdt = settings.usdt_enabled ? [
    settings.usdt_bep20_address ? { network: "bep20", label: "BNB Smart Chain (BEP20)", address: settings.usdt_bep20_address } : null,
    settings.usdt_solana_address ? { network: "solana", label: "Solana", address: settings.usdt_solana_address } : null,
    settings.usdt_polygon_address ? { network: "polygon", label: "Polygon", address: settings.usdt_polygon_address } : null,
  ].filter(Boolean) : [];

  const native = [
    settings.bnb_enabled && settings.bnb_address ? { asset: "bnb", label: "BNB", address: settings.bnb_address } : null,
    settings.sol_enabled && settings.sol_address ? { asset: "sol", label: "SOL", address: settings.sol_address } : null,
    settings.pol_enabled && settings.pol_address ? { asset: "pol", label: "POL", address: settings.pol_address } : null,
  ].filter(Boolean);

  const card = settings.card_enabled && settings.card_number
    ? { number: settings.card_number, holder: settings.card_holder || "" }
    : null;

  return NextResponse.json({ methods: { usdt, native, card } });
}
