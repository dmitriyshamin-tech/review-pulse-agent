import { storage, getVidhukProfileStats } from "./storage";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

const GOOGLE_RATINGS: Record<string, { rating: number; reviews: number }> = {
  brand_sofino: { rating: 3.9, reviews: 563 },
  brand_matrasroll: { rating: 3.7, reviews: 143 },
  brand_amebli: { rating: 4.1, reviews: 74 },
};

export async function sendMessage(text: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log("[telegram] Not configured, skipping message");
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    console.error(`[telegram] Error ${res.status}: ${await res.text()}`);
  }
}

export function buildDailyReport(): string {
  const brandList = storage.listBrandSummaries();
  const date = new Date().toLocaleDateString("ru-RU", {
    timeZone: "Europe/Kiev",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  let msg = `<b>📊 Монитор отзывов — ${date}</b>`;

  for (const brand of brandList) {
    const vidhuk = getVidhukProfileStats(brand.id);
    const google = GOOGLE_RATINGS[brand.id];
    const negatives = storage.listReviews({ brandId: brand.id, sentiment: "negative", today: true, limit: 5 });

    msg += `\n\n<b>${brand.name}</b>\n`;
    msg += `⭐ Vidhuk: ${vidhuk.rating} (${vidhuk.reviewCount})`;
    if (google) msg += ` | Google: ${google.rating} (${google.reviews})`;
    msg += ` 🟢\n`;

    if (negatives.length === 0) {
      msg += `✅ Негатив: новых негативных отзывов нет`;
    } else {
      msg += `🔴 Новых негативных: ${negatives.length}\n`;
      for (const r of negatives) {
        const link = r.mentionUrl ? `<a href="${r.mentionUrl}">${r.title}</a>` : r.title;
        msg += `— ${link}\n`;
      }
    }
  }

  return msg;
}

export function buildWeeklyAudit(): string {
  const brandList = storage.listBrandSummaries();
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;

  const fromStr = new Date(weekAgo * 1000).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  const toStr = new Date().toLocaleDateString("ru-RU", { timeZone: "Europe/Kiev", day: "2-digit", month: "2-digit" });

  let totalNew = 0;
  let totalPos = 0;
  let totalNeg = 0;
  const perBrand: Array<{ name: string; vidhukRating: number; count: number; pos: number; neg: number; topNeg: Array<{ title: string; url: string }> }> = [];

  for (const brand of brandList) {
    const all = storage.listReviews({ brandId: brand.id, limit: 500 }).filter((r) => r.collectedAt >= weekAgo);
    const pos = all.filter((r) => r.sentiment === "positive").length;
    const neg = all.filter((r) => r.sentiment === "negative");
    totalNew += all.length;
    totalPos += pos;
    totalNeg += neg.length;
    perBrand.push({
      name: brand.name,
      vidhukRating: getVidhukProfileStats(brand.id).rating,
      count: all.length,
      pos,
      neg: neg.length,
      topNeg: neg.slice(0, 3).map((r) => ({ title: r.title, url: r.mentionUrl })),
    });
  }

  let msg = `<b>📋 Еженедельный аудит — ${fromStr}–${toStr}</b>\n`;
  msg += `\n<b>Итого за 7 дней:</b>\n`;
  msg += `• Новых упоминаний: ${totalNew}\n`;
  msg += `• 🟢 Позитивных: ${totalPos} | 🔴 Негативных: ${totalNeg}`;

  for (const b of perBrand) {
    msg += `\n\n<b>${b.name}</b> — Vidhuk ⭐ ${b.vidhukRating}\n`;
    msg += `Упоминаний: ${b.count} (🟢 ${b.pos} / 🔴 ${b.neg})\n`;
    if (b.topNeg.length === 0) {
      msg += `✅ Негативных отзывов нет`;
    } else {
      msg += `🔴 Топ негативных:\n`;
      for (const r of b.topNeg) {
        const link = r.url ? `<a href="${r.url}">${r.title}</a>` : r.title;
        msg += `— ${link}\n`;
      }
    }
  }

  return msg;
}
