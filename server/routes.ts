import type { Express, Request, Response } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { getVidhukProfileStats, storage } from "./storage";
import { insertBrandSchema, insertSourceSchema } from "@shared/schema";
import { z } from "zod";
import { execFile } from "node:child_process";

// ----- Demo data pools for simulated collection -----
const DEMO_AUTHORS = [
  "Forbes.ua", "Mind.ua", "Liga.Business", "NV Business", "AIN.ua", "MC.today", "Retailers.ua",
  "Hotline.ua", "Rozetka", "Prom.ua", "Otzyvua.net", "Top20.ua", "Trustpilot",
];

type Sentiment = "positive" | "neutral" | "negative";

const POOLS: Record<Sentiment, Array<{ title: string; body: string; rating: number }>> = {
  positive: [
    { title: "Позитивное упоминание в подборке", body: "Источник отмечает бренд в контексте сильных e-commerce игроков и хорошего клиентского опыта.", rating: 5 },
    { title: "Бренд найден в рейтинге", body: "Упоминание выглядит полезным для PR: тональность позитивная, контекст связан с ростом и узнаваемостью.", rating: 4 },
    { title: "Хорошие отзывы покупателей", body: "В карточках и комментариях чаще встречаются положительные формулировки о качестве и ассортименте.", rating: 5 },
    { title: "Рекомендательный контекст", body: "Бренд появляется рядом с фразами «рекомендуют», «удобно заказать» и «быстрая консультация».", rating: 5 },
  ],
  neutral: [
    { title: "Нейтральное упоминание в статье", body: "Бренд указан в списке компаний без явной оценки, требуется ручная классификация контекста.", rating: 3 },
    { title: "Каталожная выдача", body: "Найдены товарные страницы и листинги, но без выраженной позитивной или негативной тональности.", rating: 3 },
    { title: "Нужно уточнить релевантность", body: "Совпадение найдено по ключевому слову, возможна проверка дублей и альтернативных написаний.", rating: 3 },
  ],
  negative: [
    { title: "Риск: жалоба на доставку", body: "Упоминание связано с задержкой доставки и ожиданием ответа менеджера.", rating: 2 },
    { title: "Негативный отзыв покупателя", body: "Пользователь пишет о проблеме с коммуникацией и просит публичный ответ бренда.", rating: 1 },
    { title: "Риск репутации", body: "Источник содержит критический комментарий, который стоит передать в поддержку или PR.", rating: 2 },
    { title: "Проблема с наличием товара", body: "Клиент сообщает, что товар был в каталоге, но менеджер позже уточнил отсутствие на складе.", rating: 2 },
  ],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function keywordsForBrand(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("amebli")) return ["амеблі", "amebli"];
  if (lower.includes("matrasroll")) return ["Matrasroll"];
  if (lower.includes("sofino")) return ["Sofino"];
  return [name];
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function googleMapsUrl(query: string, placeId: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${placeId}`;
}

function classifySentiment(text: string): { sentiment: Sentiment; rating: number } {
  const lower = text.toLowerCase();
  const negativeWords = ["жалоб", "проблем", "негатив", "затрим", "задерж", "плохо", "не рекоменд", "скам", "обман"];
  const positiveWords = ["рейтинг", "лучши", "кращ", "топ", "рекоменд", "рост", "успех", "успіш"];
  if (negativeWords.some((w) => lower.includes(w))) return { sentiment: "negative", rating: 2 };
  if (positiveWords.some((w) => lower.includes(w))) return { sentiment: "positive", rating: 4 };
  return { sentiment: "neutral", rating: 3 };
}

function hitMatchesBrand(hit: SearchHit, brandName: string) {
  const haystack = `${hit.url ?? ""} ${hit.title ?? ""}`.toLowerCase();
  return keywordsForBrand(brandName).some((keyword) => haystack.includes(keyword.toLowerCase()));
}

type SearchHit = {
  url?: string;
  title?: string;
  snippet?: string;
  summary?: string;
  domain?: string;
};

type VidhukReview = {
  title: string;
  url: string;
  author: string;
  body: string;
  date: string;
  timestamp: number;
};

type ParsedReview = VidhukReview & {
  rating?: number;
};

async function executePplxSearch(args: string[]) {
  const stdout = await new Promise<string>((resolve, reject) => {
    execFile("pplx", args, { timeout: 25_000, maxBuffer: 1024 * 1024 * 3 }, (error, out, err) => {
      if (error) {
        reject(new Error(err || error.message));
        return;
      }
      resolve(out);
    });
  });
  return JSON.parse(stdout) as { hits?: SearchHit[] };
}

function dateToTimestamp(date: string) {
  return Math.floor(new Date(`${date}T12:00:00Z`).getTime() / 1000);
}

function stripHtml(input: string) {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; ReviewPulseBot/0.1; +https://www.perplexity.ai/)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!response.ok) throw new Error(`Vidhuk.ua вернул HTTP ${response.status}`);
  return response.text();
}

function parseVidhukReviews(html: string): VidhukReview[] {
  const reviews: VidhukReview[] = [];
  const reviewRegex =
    /<h2>\s*<a href="([^"]+)">([\s\S]*?)<\/a>\s*<\/h2>[\s\S]*?<span class="reviewer">([\s\S]*?)<\/span>[\s\S]*?<span class="dtreviewed">[\s\S]*?<span class="value-title" title="(\d{4}-\d{2}-\d{2})"[\s\S]*?<\/span>[\s\S]*?<span class="review-snippet">([\s\S]*?)(?:<a href="[^"]+" onclick="return review_fulltext|<\/span>)/g;

  for (const match of Array.from(html.matchAll(reviewRegex))) {
    const [, url, titleHtml, authorHtml, date, snippetHtml] = match;
    reviews.push({
      title: stripHtml(titleHtml),
      url,
      author: stripHtml(authorHtml),
      body: stripHtml(snippetHtml),
      date,
      timestamp: dateToTimestamp(date),
    });
  }

  return reviews;
}

function parse048Date(rawDate: string) {
  const cleaned = rawDate.toLowerCase();
  const months: Record<string, number> = {
    "янв": 0,
    "січ": 0,
    "фев": 1,
    "февр": 1,
    "лют": 1,
    "мар": 2,
    "бер": 2,
    "апр": 3,
    "квіт": 3,
    "мая": 4,
    "трав": 4,
    "июн": 5,
    "черв": 5,
    "июл": 6,
    "лип": 6,
    "авг": 7,
    "серп": 7,
    "сен": 8,
    "сент": 8,
    "вер": 8,
    "окт": 9,
    "жовт": 9,
    "ноя": 10,
    "лист": 10,
    "дек": 11,
    "груд": 11,
  };
  const match = cleaned.match(/(\d{1,2})\s+([а-яіїє.]+)\s+(\d{4})/i);
  if (!match) return Math.floor(Date.now() / 1000);

  const day = Number(match[1]);
  const monthKey = match[2].replace(/\./g, "").slice(0, 4);
  const month =
    months[monthKey] ??
    months[monthKey.slice(0, 3)] ??
    new Date().getUTCMonth();
  const year = Number(match[3]);
  return Math.floor(Date.UTC(year, month, day, 12, 0, 0) / 1000);
}

function parse048Reviews(html: string, sourceUrl: string): ParsedReview[] {
  const parsed: ParsedReview[] = [];
  const chunks = html.split(/<div[^>]+class="comment comment--expert"[^>]+data-id="/g).slice(1);

  for (const chunk of chunks) {
    const id = chunk.match(/^([^"]+)"/)?.[1];
    if (!id) continue;

    const author = stripHtml(chunk.match(/comment__username[\s\S]*?>([\s\S]*?)<\/a>/)?.[1] ?? "048.ua");
    const rawDate = stripHtml(chunk.match(/comment__time[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? "");
    const body = stripHtml(
      chunk.match(/comment__text[^>]*>([\s\S]*?)<\/div>/)?.[1] ??
        chunk.match(/comment__body[^>]*>([\s\S]*?)<\/div>/)?.[1] ??
        ""
    );
    const activeDots = (chunk.match(/comment-rating-line__dot\s+active/g) ?? []).length;
    const rating = activeDots > 0 ? Math.max(1, Math.min(5, Math.round((activeDots / 6) * 5))) : undefined;

    parsed.push({
      title: `048.ua: отзыв от ${author || "пользователя"}`,
      url: `${sourceUrl}#comment-${id}`,
      author: author || "048.ua",
      body: body || `Комментарий на 048.ua от ${rawDate || "пользователя"}`,
      date: rawDate || new Date().toISOString().slice(0, 10),
      timestamp: parse048Date(rawDate),
      rating,
    });
  }

  return parsed;
}

async function collectVidhukYear(src: ReturnType<typeof storage.listSources>[number], year = 2026) {
  const brand = storage.getBrand(src.brandId);
  if (!brand || !src.url.includes("vidhuk.ua")) return null;

  const html = await fetchText(src.url);
  const parsed = parseVidhukReviews(html)
    .filter((review) => review.date.startsWith(`${year}-`))
    .filter((review) => hitMatchesBrand({ url: review.url, title: review.title }, brand.name));

  const created = [];
  for (const review of parsed) {
    if (storage.reviewUrlExists(brand.id, review.url)) continue;
    const { sentiment, rating } = classifySentiment(`${review.title} ${review.body}`);
    created.push(
      storage.insertReview({
        brandId: brand.id,
        sourceId: src.id,
        author: review.author || "Vidhuk.ua",
        rating,
        sentiment,
        title: review.title,
        body: review.body || `Отзыв от ${review.date}`,
        url: review.url,
        collectedAt: review.timestamp,
        isNew: 1,
      })
    );
  }

  return { created, checked: 1, errors: 0, foundForYear: parsed.length };
}

async function collect048Reviews(src: ReturnType<typeof storage.listSources>[number]) {
  const brand = storage.getBrand(src.brandId);
  if (!brand || !src.url.includes("048.ua")) return null;

  const html = await fetchText(src.url);
  const parsed = parse048Reviews(html, src.url);

  const created = [];
  for (const review of parsed) {
    if (storage.reviewUrlExists(brand.id, review.url)) continue;
    const classified = classifySentiment(`${review.title} ${review.body}`);
    const rating = review.rating ?? classified.rating;
    created.push(
      storage.insertReview({
        brandId: brand.id,
        sourceId: src.id,
        author: review.author || "048.ua",
        rating,
        sentiment: rating <= 2 ? "negative" : rating >= 4 ? "positive" : classified.sentiment,
        title: review.title,
        body: review.body || `Отзыв на 048.ua от ${review.date}`,
        url: review.url,
        collectedAt: review.timestamp,
        isNew: 1,
      })
    );
  }

  return { created, checked: 1, errors: 0, found: parsed.length };
}

async function runWebSearchForSource(src: ReturnType<typeof storage.listSources>[number]) {
  const brand = storage.getBrand(src.brandId);
  if (!brand) return [];

  const yearFromVidhuk = await collectVidhukYear(src, 2026);
  if (yearFromVidhuk) return yearFromVidhuk.created;

  const reviewsFrom048 = await collect048Reviews(src);
  if (reviewsFrom048) return reviewsFrom048.created;

  const domain = domainFromUrl(src.url);
  if (!domain) return [];

  const queries = keywordsForBrand(brand.name).slice(0, 5);
  let parsed = await executePplxSearch(["search", "web", ...queries, "--domains", domain]);
  let hits = (parsed.hits ?? [])
    .filter((hit) => hit.url && hit.title && hitMatchesBrand(hit, brand.name))
    .slice(0, 2);

  if (hits.length === 0) {
    const broadQueries = queries.map((query) => `${query} ${src.name}`).slice(0, 5);
    parsed = await executePplxSearch(["search", "web", ...broadQueries]);
    hits = (parsed.hits ?? [])
      .filter((hit) => hit.url && hit.title && hitMatchesBrand(hit, brand.name))
      .slice(0, 2);
  }

  const created = [];

  for (const hit of hits) {
    const url = hit.url!;
    if (storage.reviewUrlExists(brand.id, url)) continue;
    const text = `${hit.title ?? ""} ${hit.snippet ?? ""} ${hit.summary ?? ""}`;
    const { sentiment, rating } = classifySentiment(text);
    created.push(
      storage.insertReview({
        brandId: brand.id,
        sourceId: src.id,
        author: hit.domain || src.name,
        rating,
        sentiment,
        title: hit.title || `Найдено упоминание ${brand.name}`,
        body: hit.snippet || hit.summary || `Найден результат по ${brand.name} на ${src.name}`,
        url,
        collectedAt: Math.floor(Date.now() / 1000),
        isNew: 1,
      })
    );
  }

  return created;
}

async function collectRealMentions(targets: ReturnType<typeof storage.listSources>) {
  const grouped = new Map<string, typeof targets>();
  for (const src of targets) {
    const list = grouped.get(src.brandId) ?? [];
    list.push(src);
    grouped.set(src.brandId, list);
  }

  const priorityTargets =
    grouped.size > 1
      ? Array.from(grouped.values()).flatMap((items) => items.slice(0, 5))
      : targets.slice(0, 12);

  const created: any[] = [];
  let errors = 0;

  for (const src of priorityTargets) {
    try {
      storage.updateSourceStatus(src.id, "running", src.lastRunAt, null);
      const found = await runWebSearchForSource(src);
      created.push(...found);
      storage.updateSourceStatus(src.id, "ok", Math.floor(Date.now() / 1000), null);
    } catch (error: any) {
      errors++;
      storage.updateSourceStatus(
        src.id,
        "error",
        Math.floor(Date.now() / 1000),
        `Поиск недоступен: ${String(error?.message ?? error).slice(0, 140)}`
      );
    }
  }

  return { created, checked: priorityTargets.length, errors };
}

async function simulateCollection(opts: { brandId?: string; sourceId?: string }) {
  const startedAt = Math.floor(Date.now() / 1000);
  const t0 = Date.now();

  // Choose sources
  let allSources = storage.listSources(opts.brandId);
  if (opts.sourceId) allSources = allSources.filter((s) => s.id === opts.sourceId);
  // skip paused sources
  const targets = allSources.filter((s) => s.status !== "paused");

  if (targets.length === 0) {
    const run = storage.createRun({
      brandId: opts.brandId ?? null,
      sourcesChecked: 0,
      newReviews: 0,
      errors: 0,
      durationMs: 80,
      startedAt,
      status: "ok",
      message: "Нет активных источников",
    });
    return { run, newReviews: [] };
  }

  let errors = 0;
  let sourcesChecked = targets.length;
  let newReviews: any[] = [];

  const realSearchEnabled = process.env.DISABLE_REAL_SEARCH !== "1";
  if (realSearchEnabled) {
    const result = await collectRealMentions(targets);
    newReviews = result.created;
    sourcesChecked = result.checked;
    errors = result.errors;
  } else {
    // Mark all as running
    for (const s of targets) {
      storage.updateSourceStatus(s.id, "running", s.lastRunAt, null);
    }

    // small artificial delay
    await new Promise((r) => setTimeout(r, 400));

    for (const src of targets) {
    // 12% chance of error per source
      if (Math.random() < 0.12) {
        errors++;
        storage.updateSourceStatus(src.id, "error", Math.floor(Date.now() / 1000), "Источник вернул HTTP 503");
        continue;
      }
      // 0..3 new reviews per source
      const count = Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i++) {
        const sentRoll = Math.random();
        const sentiment: Sentiment =
          sentRoll < 0.55 ? "positive" : sentRoll < 0.8 ? "neutral" : "negative";
        const tpl = pick(POOLS[sentiment]);
        const brand = storage.getBrand(src.brandId);
        const created = storage.insertReview({
          brandId: src.brandId,
          sourceId: src.id,
          author: pick(DEMO_AUTHORS),
          rating: tpl.rating,
          sentiment,
          title: tpl.title,
          body: `${brand?.name ?? "Бренд"} · ${tpl.body}`,
          url: src.url,
          collectedAt: Math.floor(Date.now() / 1000),
          isNew: 1,
        });
        newReviews.push(created);
      }
      storage.updateSourceStatus(src.id, "ok", Math.floor(Date.now() / 1000), null);
    }
  }

  const durationMs = Date.now() - t0;
  const status: "ok" | "partial" | "error" =
    errors === 0 ? "ok" : errors === targets.length ? "error" : "partial";

  const run = storage.createRun({
    brandId: opts.brandId ?? null,
    sourcesChecked,
    newReviews: newReviews.length,
    errors,
    durationMs,
    startedAt,
    status,
    message:
      status === "ok"
        ? `Собрано ${newReviews.length} новых упоминаний`
        : status === "partial"
          ? `Собрано ${newReviews.length} новых упоминаний; ошибок: ${errors}`
          : `Все источники вернули ошибку`,
  });
  return { run, newReviews };
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ----- Brands -----
  app.get("/api/brands", (_req: Request, res: Response) => {
    res.json(storage.listBrandSummaries());
  });
  app.get("/api/brands/:id", (req: Request, res: Response) => {
    const b = storage.getBrand(String(req.params.id));
    if (!b) return res.status(404).json({ error: "Not found" });
    const counts = storage.countByBrand(b.id);
    const siteStats = getVidhukProfileStats(b.id);
    const srcs = storage.listSources(b.id);
    res.json({
      ...b,
      reviewCount: counts.total,
      avgRating: counts.avg,
      siteRating: siteStats.rating,
      siteReviewCount: siteStats.reviewCount,
      siteViews: siteStats.views,
      sentimentPositive: counts.positive,
      sentimentNeutral: counts.neutral,
      sentimentNegative: counts.negative,
      riskAlerts: counts.negative,
      sourcesCount: srcs.length,
    });
  });
  app.post("/api/brands", (req: Request, res: Response) => {
    const parsed = insertBrandSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createBrand(parsed.data));
  });

  app.get("/api/ranking", (_req: Request, res: Response) => {
    const rows = [
      {
        id: "brand_sofino",
        name: "Sofino",
        group: "my",
        rating: 4.1,
        reviews: 2625,
        views: 119087,
        trend: "flat",
        weeklyReviews: 0,
        weeklyAvg: null,
        url: "https://www.vidhuk.ua/uk/internet-magazina-mebeli-sofinoua",
        googleRating: 3.9,
        googleReviews: 563,
        googleName: "Магазин меблів",
        googleUrl: googleMapsUrl("Sofino.ua", "ChIJ83h9VwTj20ARqg9vjUwNjrQ"),
      },
      {
        id: "competitor_mebelok",
        name: "Интернет-магазин mebelok",
        group: "competitor",
        rating: 4.2,
        reviews: 195,
        views: 16149,
        trend: "flat",
        weeklyReviews: 0,
        weeklyAvg: null,
        url: "https://www.vidhuk.ua/internet-magazin-mebelok-mebelok",
        googleRating: 3.9,
        googleReviews: 930,
        googleName: "МебельОК",
        googleUrl: googleMapsUrl("МебельОК mebelok", "ChIJQ2ff9DzM1EAR_DDTtOULAK4"),
      },
      {
        id: "competitor_matroluxe",
        name: "Матрасы Matroluxe",
        group: "competitor",
        rating: 4.0,
        reviews: 147,
        views: 29338,
        trend: "flat",
        weeklyReviews: 0,
        weeklyAvg: null,
        url: "https://www.vidhuk.ua/matrasy-matroluxe.html",
        googleRating: 3.8,
        googleReviews: 90,
        googleName: "MatroLuxe",
        googleUrl: googleMapsUrl("MatroLuxe", "ChIJR5DFsq_a1EARLEdjB-iwsg0"),
      },
      {
        id: "brand_matrasroll",
        name: "Matrasroll",
        group: "my",
        rating: 3.9,
        reviews: 153,
        views: 4121,
        trend: "up",
        weeklyReviews: 2,
        weeklyAvg: 5.0,
        url: "https://www.vidhuk.ua/internet-magazin-matrasroll",
        googleRating: 3.7,
        googleReviews: 143,
        googleName: "MatrasRoll",
        googleUrl: googleMapsUrl("MatrasRoll", "ChIJ116jiRLb1EARi8yUEHPU8qA"),
      },
      {
        id: "competitor_expert",
        name: "Магазин матрасов Expert-Matras.ua",
        group: "competitor",
        rating: 3.7,
        reviews: 10,
        views: 842,
        trend: "flat",
        weeklyReviews: 0,
        weeklyAvg: null,
        url: "https://www.vidhuk.ua/magazin-matrasov-expert-matrasua",
        googleRating: 4.7,
        googleReviews: 163,
        googleName: "EXPERT-MATRAS",
        googleUrl: googleMapsUrl("EXPERT-MATRAS Expert-Matras.ua", "ChIJh2tJMUDj20ARzSiIDp-fuLI"),
      },
      {
        id: "competitor_svit_matratsiv",
        name: "Интернет-магазин Світ Матраців",
        group: "competitor",
        rating: 3.6,
        reviews: 94,
        views: 11376,
        trend: "up",
        weeklyReviews: 1,
        weeklyAvg: 5.0,
        url: "https://www.vidhuk.ua/internet-magazin-svit-matratsiv",
        googleRating: 4.5,
        googleReviews: 148,
        googleName: "Світ Матраців",
        googleUrl: googleMapsUrl("Світ Матраців", "ChIJpdkLVJLL1EARk49o4Ajl1_A"),
      },
      {
        id: "brand_amebli",
        name: "Amebli",
        group: "my",
        rating: 3.5,
        reviews: 49,
        views: 1104,
        trend: "up",
        weeklyReviews: 4,
        weeklyAvg: 5.0,
        url: "https://www.vidhuk.ua/ameblicomua",
        googleRating: 4.1,
        googleReviews: 74,
        googleName: "Amebli.com.ua",
        googleUrl: googleMapsUrl("Amebli.com.ua", "ChIJf1Up_9zb1EARXpwEHhfJZ1w"),
      },
      {
        id: "competitor_dubok",
        name: "Магазин мебели Дубок",
        group: "competitor",
        rating: 3.5,
        reviews: 607,
        views: 23962,
        trend: "flat",
        weeklyReviews: 0,
        weeklyAvg: null,
        url: "https://www.vidhuk.ua/uk/internet-magazin-mebeli-dybok",
        googleRating: 4.0,
        googleReviews: 217,
        googleName: "ДУБОК",
        googleUrl: googleMapsUrl("ДУБОК Дубок мебель", "ChIJ-dpXhR3dOkcRUx1ZjWC_L4k"),
      },
    ];

    res.json(rows.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews));
  });

  // ----- Sources -----
  app.get("/api/sources", (req: Request, res: Response) => {
    const brandId = typeof req.query.brandId === "string" ? req.query.brandId : undefined;
    res.json(storage.listSources(brandId));
  });
  app.post("/api/sources", (req: Request, res: Response) => {
    const parsed = insertSourceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(storage.createSource(parsed.data));
  });
  app.post("/api/sources/:id/pause", (req: Request, res: Response) => {
    const s = storage.getSource(String(req.params.id));
    if (!s) return res.status(404).json({ error: "Not found" });
    storage.updateSourceStatus(s.id, s.status === "paused" ? "idle" : "paused", s.lastRunAt, null);
    res.json(storage.getSource(s.id));
  });

  // ----- Reviews -----
  app.get("/api/reviews", (req: Request, res: Response) => {
    const filters = {
      brandId: typeof req.query.brandId === "string" ? req.query.brandId : undefined,
      sourceId: typeof req.query.sourceId === "string" ? req.query.sourceId : undefined,
      sentiment: typeof req.query.sentiment === "string" ? req.query.sentiment : undefined,
      minRating: req.query.minRating ? Number(req.query.minRating) : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      today: req.query.today === "1" || req.query.today === "true",
      year: req.query.year ? Number(req.query.year) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    };
    res.json(storage.listReviews(filters));
  });

  // ----- Collection -----
  const collectSchema = z.object({
    brandId: z.string().optional(),
    sourceId: z.string().optional(),
  });
  app.post("/api/collect", async (req: Request, res: Response) => {
    const parsed = collectSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const result = await simulateCollection(parsed.data);
    res.json(result);
  });

  app.post("/api/reviews/clear-new", (_req: Request, res: Response) => {
    storage.clearNewFlags();
    res.json({ ok: true });
  });

  // ----- Runs -----
  app.get("/api/runs", (_req: Request, res: Response) => {
    res.json(storage.listRuns(30));
  });

  return httpServer;
}
