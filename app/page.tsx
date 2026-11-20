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

const plans = [
  { name: "ماهانه", duration: "۳۰ روز", price: "—", note: "برای شروع عضویت", featured: false },
  { name: "سه‌ماهه", duration: "۹۰ روز", price: "—", note: "انتخاب متعادل", featured: true },
  { name: "شش‌ماهه", duration: "۱۸۰ روز", price: "—", note: "ارزش بیشتر در بلندمدت", featured: false },
  { name: "سالانه", duration: "۳۶۵ روز", price: "—", note: "دسترسی یک‌ساله", featured: false },
];

export default function Home() {
  const [telegramName, setTelegramName] = useState("");
  const [telegramState, setTelegramState] = useState<"checking" | "connected" | "browser">("checking");
  const [notice, setNotice] = useState("");

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

  function selectPlan(name: string) {
    setNotice(`پلن «${name}» انتخاب شد. برای فعال‌سازی، درگاه پرداخت باید پیکربندی شود.`);
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
          {plans.map((plan, index) => (
            <article className={`plan-card ${plan.featured ? "featured" : ""}`} key={plan.name}>
              {plan.featured && <div className="popular">پیشنهاد ویژه</div>}
              <div className="plan-index">0{index + 1}</div>
              <h3>{plan.name}</h3>
              <div className="plan-duration">{plan.duration} دسترسی</div>
              <div className="plan-price">{plan.price}<small>قیمت پس از تنظیم درگاه</small></div>
              <div className="plan-rule" />
              <p>{plan.note}</p>
              <button className={plan.featured ? "plan-button gold" : "plan-button"} onClick={() => selectPlan(plan.name)}>انتخاب این پلن <span>←</span></button>
            </article>
          ))}
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

      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")}>×</button></div>}
      {telegramName && <div className="welcome-pill">خوش آمدی، {telegramName}</div>}
      <div className="age-note">ورود به این پلتفرم صرفاً برای افراد ۱۸ سال به بالا و مطابق قوانین محل فعالیت مجاز است.</div>
    </main>
  );
}
