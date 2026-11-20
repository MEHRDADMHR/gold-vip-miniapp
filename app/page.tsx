"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: { user?: { first_name?: string; username?: string } };
        ready: () => void;
        expand: () => void;
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

type Plan = { id: string; title: string; duration_days: number; price_minor: number; currency: string };
type PaymentOptions = { methods: { usdt: Array<{ network: string; label: string; address: string }>; native: Array<{ asset: "bnb" | "sol" | "pol"; label: string; address: string }>; card: { number: string; holder: string } | null } };
const planNotes = ["برای شروع عضویت", "انتخاب متعادل", "ارزش بیشتر در بلندمدت", "دسترسی بلندمدت"];

export default function Home() {
  const [telegramName, setTelegramName] = useState("");
  const [telegramState, setTelegramState] = useState<"checking" | "connected" | "browser">("checking");
  const [notice, setNotice] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions["methods"] | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"usdt" | "bnb" | "sol" | "pol" | "card">("usdt");
  const [paymentNetwork, setPaymentNetwork] = useState("bep20");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    fetch("/api/plans", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "بارگذاری پلن‌ها ناموفق بود");
        setPlans(Array.isArray(data.plans) ? data.plans : []);
      })
      .catch(() => setNotice("فعلاً امکان دریافت قیمت پلن‌ها وجود ندارد. لطفاً بعداً دوباره تلاش کن."))
      .finally(() => setPlansLoading(false));
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
      setTelegramState("browser");
      return;
    }
    tg.ready();
    tg.expand();
    const user = tg.initDataUnsafe?.user;
    if (user) setTelegramName(user.first_name || user.username || "عضو");
    if (tg.initData) {
      fetch("/api/auth/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
      })
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "اعتبارسنجی انجام نشد");
          setTelegramState("connected");
          if (data.user?.first_name) setTelegramName(data.user.first_name);
        })
        .catch((error: unknown) => {
          setTelegramState("browser");
          const message = error instanceof Error ? error.message : "خطای ناشناخته در اتصال";
          setNotice(`خطای ورود تلگرام: ${message}`);
        });
    } else {
      setTelegramState("browser");
    }
  }, []);

  async function selectPlan(plan: Plan) {
    setSelectedPlan(plan); setPaymentOptions(null); setPaymentReference("");
    setPaymentMethod("usdt"); setPaymentNetwork("bep20");
    try {
      const response = await fetch("/api/payment-options", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "دریافت روش‌های پرداخت ناموفق بود.");
      setPaymentOptions(data.methods);
      if (!data.methods.usdt?.length) {\n        if (data.methods.native?.length) setPaymentMethod(data.methods.native[0].asset);\n        else if (data.methods.card) setPaymentMethod("card");\n      }
    } catch (error) {
      setSelectedPlan(null);
      setNotice(error instanceof Error ? error.message : "خطا در دریافت روش‌های پرداخت.");
    }
  }

  async function submitPaymentOrder() {
    if (!selectedPlan) return;
    setPaymentLoading(true);
    try {
      const response = await fetch("/api/payment-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: selectedPlan.id, payment_method: paymentMethod,
          network: paymentMethod === "usdt" ? paymentNetwork : null, payment_reference: paymentReference }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ثبت سفارش ناموفق بود.");
      setSelectedPlan(null);
      setNotice("سفارش پرداخت ثبت شد و پس از بررسی مدیر، نتیجه اعلام می‌شود. اشتراک فقط پس از تأیید فعال خواهد شد.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ثبت سفارش ناموفق بود.");
    } finally { setPaymentLoading(false); }
  }

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar shell">
        <a className="brand" href="#" aria-label="صفحه اصلی">
          <span className="brand-mark">G</span>
          <span className="brand-name">لوتی پریمیوم<span> CLUB</span></span>
        </a>
        <div className="top-actions">
          <span className={telegramState === "connected" ? "status connected" : "status"}>
            <i /> {telegramState === "connected" ? "تلگرام متصل است" : "عضویت ویژه"}
          </span>
          <a className="admin-link" href="/library">کتابخانه ویدیوها <span>↗</span></a>
          <a className="admin-link" href="#membership">پلن‌ها <span>↗</span></a>
        </div>
      </header>

      <section className="hero shell">
        <div className="hero-copy">
          <div className="eyebrow"><span /> تجربه‌ای فراتر از معمول</div>
          <h1>دنیای ویژه،<br /><em>انتخاب شماست.</em></h1>
          <p className="hero-lead">به کلوب اختصاصی خود خوش آمدید؛ فضایی با دسترسی اعضا، تجربه‌ای یکپارچه و طراحی‌شده برای شما.</p>
          <div className="hero-actions">
            <a className="gold-button" href="#membership">مشاهده پلن‌های عضویت <span>←</span></a>
            <div className="secure-note"><span className="shield">✦</span><span>دسترسی امن و اختصاصی<br /><b>ویژه اعضای تأییدشده</b></span></div>
          </div>
          <div className="hero-footnote"><span className="tiny-dot" /> ورود سریع از طریق تلگرام، بدون فرم ثبت‌نام</div>
        </div>
        <div className="hero-art" aria-label="طرح گرافیکی طلایی انتزاعی">
          <div className="art-orbit orbit-a" />
          <div className="art-orbit orbit-b" />
          <div className="art-core"><span>G</span><small>THE PRIVATE CLUB</small></div>
          <div className="art-label label-top">EST. 2026</div>
          <div className="art-label label-bottom">EXCLUSIVE ACCESS</div>
          <div className="spark spark-a">✧</div><div className="spark spark-b">✦</div>
        </div>
      </section>

      <section className="trust-strip">
        <div className="shell trust-inner">
          <div><b>01</b><span>ورود با تلگرام</span></div>
          <div><b>02</b><span>عضویت زمان‌دار</span></div>
          <div><b>03</b><span>پخش کنترل‌شده</span></div>
          <div><b>04</b><span>حریم خصوصی اعضا</span></div>
        </div>
      </section>

      <section className="membership shell" id="membership">
        <div className="section-heading">
          <div><div className="eyebrow"><span /> سطح دسترسی شما</div><h2>عضویت <em>ویژه</em></h2></div>
          <p>پلن مناسب خود را انتخاب کنید.<br />تمام پلن‌ها دسترسی کامل در مدت اعتبار را فراهم می‌کنند.</p>
        </div>
        <div className="plan-grid">
          {plansLoading ? <p className="membership-note">در حال دریافت قیمت پلن‌ها…</p> : plans.length === 0 ? <p className="membership-note">در حال حاضر پلن فعالی برای نمایش وجود ندارد.</p> : plans.map((plan, index) => {
            const name = plan.title;
            const featured = index === 1;
            const price = (Number(plan.price_minor) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return (
              <article className={`plan-card ${featured ? "featured" : ""}`} key={plan.id}>
                {featured && <div className="popular">پیشنهاد ویژه</div>}
                <div className="plan-index">0{index + 1}</div>
                <h3>{name}</h3>
                <div className="plan-duration">{Number(plan.duration_days).toLocaleString("fa-IR")} روز دسترسی</div>
                <div className="plan-price">${price}<small>USD</small></div>
                <div className="plan-rule" />
                <p>{planNotes[index] || "دسترسی ویژه اعضا"}</p>
                <button className={featured ? "plan-button gold" : "plan-button"} onClick={() => selectPlan(plan)}>انتخاب این پلن <span>←</span></button>
              </article>
            );
          })}
        </div>
        <div className="membership-note"><span>✦</span> محتوای کامل فقط برای اعضای دارای اشتراک فعال قابل دسترسی خواهد بود.</div>
      </section>

      <section className="preview-section">
        <div className="shell preview-inner">
          <div className="preview-copy">
            <div className="eyebrow"><span /> پیش‌نمایش محتوا</div>
            <h2>قبل از عضویت،<br /><em>نگاهی کوتاه بیندازید.</em></h2>
            <p>برای بازدیدکنندگان فقط پیش‌نمایش ۳۰ ثانیه‌ای در نظر گرفته می‌شود. ادامه پخش نیازمند اشتراک فعال است.</p>
          </div>
          <div className="preview-frame">
            <div className="preview-lock"><span>G</span><i>✦</i></div>
            <div className="preview-overlay">
              <span className="play-icon">▶</span>
              <b>پیش‌نمایش ۳۰ ثانیه‌ای</b>
              <small>نمونه نمایشی — ویدیو هنوز بارگذاری نشده است</small>
            </div>
            <div className="preview-timeline"><span /><small>00:30</small></div>
          </div>
        </div>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#"><span className="brand-mark">G</span><span className="brand-name">لوتی پریمیوم<span> CLUB</span></span></a>
        <p>دسترسی ویژه، با احترام به حریم خصوصی.</p>
        <span className="copyright">© 2026 لوتی پریمیوم CLUB</span>
      </footer>

      {selectedPlan && <div className="payment-backdrop" role="presentation" onClick={() => !paymentLoading && setSelectedPlan(null)}>
        <section className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-title" onClick={(event) => event.stopPropagation()}>
          <button className="payment-close" onClick={() => setSelectedPlan(null)} aria-label="بستن">×</button>
          <div className="eyebrow"><span /> تکمیل سفارش عضویت</div>
          <h2 id="payment-title">{selectedPlan.title}</h2>
          <p className="payment-total">مبلغ قابل پرداخت: <b>${(Number(selectedPlan.price_minor) / 100).toFixed(2)} USD</b></p>
          {!paymentOptions ? <p className="membership-note">در حال دریافت روش‌های پرداخت…</p> : <>
            {!paymentOptions.usdt.length && !paymentOptions.native.length && !paymentOptions.card ? <p className="payment-error">مدیر هنوز هیچ روش پرداختی را فعال و تنظیم نکرده است.</p> : <>
              <label className="payment-label">روش پرداخت</label>
              <div className="payment-methods">
                {paymentOptions.usdt.length > 0 && <button className={paymentMethod === "usdt" ? "chosen" : ""} onClick={() => setPaymentMethod("usdt")}>تتر (USDT)</button>}
                {paymentOptions.native.map((item) => <button key={item.asset} className={paymentMethod === item.asset ? "chosen" : ""} onClick={() => setPaymentMethod(item.asset)}>{item.label}</button>)}\n                {paymentOptions.card && <button className={paymentMethod === "card" ? "chosen" : ""} onClick={() => setPaymentMethod("card")}>کارت‌به‌کارت</button>}
              </div>
              {paymentMethod === "usdt" && paymentOptions.usdt.length > 0 && <>
                <label className="payment-label" htmlFor="payment-network">شبکه انتقال</label>
                <select id="payment-network" value={paymentNetwork} onChange={(event) => setPaymentNetwork(event.target.value)}>
                  {paymentOptions.usdt.map((item) => <option key={item.network} value={item.network}>{item.label}</option>)}
                </select>
                <div className="payment-address"><small>آدرس کیف پول مقصد</small><code>{paymentOptions.usdt.find((item) => item.network === paymentNetwork)?.address}</code></div>
              </>}
              {paymentMethod !== "usdt" && paymentMethod !== "card" && paymentOptions.native.find((item) => item.asset === paymentMethod) && <div className="payment-address"><small>آدرس کیف پول مقصد ({paymentMethod.toUpperCase()})</small><code>{paymentOptions.native.find((item) => item.asset === paymentMethod)?.address}</code><small>مبلغ معادل را خودت محاسبه کن و دقیقاً همان توکن را به همین شبکه بفرست.</small></div>}\n              {paymentMethod === "card" && paymentOptions.card && <div className="payment-address"><small>شماره کارت مقصد</small><code>{paymentOptions.card.number}</code><small>به نام: {paymentOptions.card.holder || "ثبت نشده"}</small></div>}
              <label className="payment-label" htmlFor="payment-reference">{paymentMethod === "card" ? "شماره پیگیری یا توضیح رسید" : "شناسه تراکنش (TXID)"}</label>
              <textarea id="payment-reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder={paymentMethod === "card" ? "شماره پیگیری واریز را وارد کن…" : "شناسه تراکنش را وارد کن…"} rows={3} />
              <p className="payment-disclaimer">مبلغ معادل ارز دیجیتال را خودت محاسبه کن. فقط همان توکن و شبکه انتخاب‌شده را بفرست؛ سپس TXID را ثبت کن. سفارش دستی بررسی می‌شود و اشتراک فقط پس از تأیید فعال خواهد شد.</p>
              <button className="payment-submit" onClick={submitPaymentOrder} disabled={paymentLoading || paymentReference.trim().length < 5}>{paymentLoading ? "در حال ثبت سفارش…" : "ثبت اطلاعات پرداخت"}</button>
            </>}
          </>}
        </section>
      </div>}
      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      {telegramName && <div className="welcome-pill">خوش آمدی، {telegramName}</div>}
      <div className="age-note">ورود به این پلتفرم صرفاً برای افراد ۱۸ سال به بالا و مطابق قوانین محل فعالیت مجاز است.</div>
    </main>
  );
}
