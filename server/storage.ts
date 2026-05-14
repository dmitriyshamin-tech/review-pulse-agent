import {
  brands,
  sources,
  reviews,
  runs,
  type Brand,
  type InsertBrand,
  type Source,
  type InsertSource,
  type Review,
  type InsertReview,
  type Run,
  type InsertRun,
  type BrandSummary,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Bootstrap tables (lightweight ad-hoc migration so we don't require drizzle-kit at runtime)
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS brands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS sources (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    frequency TEXT NOT NULL,
    status TEXT NOT NULL,
    last_run_at INTEGER,
    last_error TEXT
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    brand_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    author TEXT NOT NULL,
    rating INTEGER NOT NULL,
    sentiment TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT,
    collected_at INTEGER NOT NULL,
    is_new INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    brand_id TEXT,
    sources_checked INTEGER NOT NULL,
    new_reviews INTEGER NOT NULL,
    errors INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    message TEXT
  );
`);

const reviewColumns = sqlite.prepare("PRAGMA table_info(reviews)").all() as Array<{ name: string }>;
if (!reviewColumns.some((c) => c.name === "url")) {
  sqlite.exec("ALTER TABLE reviews ADD COLUMN url TEXT");
}

const now = () => Math.floor(Date.now() / 1000);

// ----- Seed -----
function seedIfEmpty() {
  const cnt = sqlite.prepare("SELECT COUNT(*) as c FROM brands").get() as { c: number };
  if (cnt.c > 0) return;

  const seedBrands: Brand[] = [
    {
      id: "brand_amebli",
      name: "Amebli",
      category: "Мебель / e-commerce",
      color: "#0ea5a4",
      description: "Поиск упоминаний: амеблі, amebli",
    },
    {
      id: "brand_matrasroll",
      name: "Matrasroll",
      category: "Матрасы / e-commerce",
      color: "#22d3ee",
      description: "Поиск упоминаний: Matrasroll",
    },
    {
      id: "brand_sofino",
      name: "Sofino",
      category: "Мебель / retail",
      color: "#f59e0b",
      description: "Поиск упоминаний: Sofino",
    },
  ];

  const insertBrand = sqlite.prepare(
    "INSERT INTO brands (id, name, category, color, description) VALUES (?, ?, ?, ?, ?)"
  );
  for (const b of seedBrands) {
    insertBrand.run(b.id, b.name, b.category, b.color, b.description ?? null);
  }

  const vidhukProfiles: Record<string, string> = {
    brand_amebli: "https://www.vidhuk.ua/ameblicomua",
    brand_matrasroll: "https://www.vidhuk.ua/internet-magazin-matrasroll",
    brand_sofino: "https://www.vidhuk.ua/uk/internet-magazina-mebeli-sofinoua",
  };

  const seedSources: Source[] = seedBrands.map((brand) => ({
    id: `src_${brand.id.replace("brand_", "")}_vidhuk`,
    brandId: brand.id,
    name: "Vidhuk.ua",
    url: vidhukProfiles[brand.id],
    frequency: "1h",
    status: "ok",
    lastRunAt: now() - 900,
    lastError: null,
  }));
  const insertSrc = sqlite.prepare(
    "INSERT INTO sources (id, brand_id, name, url, frequency, status, last_run_at, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  for (const s of seedSources) {
    insertSrc.run(s.id, s.brandId, s.name, s.url, s.frequency, s.status, s.lastRunAt, s.lastError);
  }

  // Seed mentions
  const reviewTemplates: Array<Omit<Review, "id" | "collectedAt" | "isNew" | "url"> & { url?: string | null }> = [
    { brandId: "brand_amebli", sourceId: "src_amebli_vidhuk", author: "Vidhuk.ua", rating: 3, sentiment: "negative", title: "amebli.com.ua отзывы - Мебель", body: "На Vidhuk.ua найдена отдельная страница amebli.com.ua с рейтингом, отзывами клиентов и переходом к полному списку отзывов.", url: "https://www.vidhuk.ua/ameblicomua" },
    { brandId: "brand_matrasroll", sourceId: "src_matrasroll_vidhuk", author: "Vidhuk.ua", rating: 4, sentiment: "positive", title: "Интернет-магазин MatrasRoll отзывы", body: "На Vidhuk.ua найдена отдельная страница MatrasRoll с отзывами клиентов и публичными ответами представителя.", url: "https://www.vidhuk.ua/internet-magazin-matrasroll" },
    { brandId: "brand_sofino", sourceId: "src_sofino_vidhuk", author: "Vidhuk.ua", rating: 3, sentiment: "neutral", title: "Інтернет-магазин меблів Sofino.ua відгуки", body: "На Vidhuk.ua найдена отдельная страница Sofino.ua с отзывами и клиентскими комментариями.", url: "https://www.vidhuk.ua/uk/internet-magazina-mebeli-sofinoua" },
  ];

  const insertRev = sqlite.prepare(
    "INSERT INTO reviews (id, brand_id, source_id, author, rating, sentiment, title, body, url, collected_at, is_new) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  reviewTemplates.forEach((r, i) => {
    insertRev.run(
      `rev_seed_${i}`,
      r.brandId,
      r.sourceId,
      r.author,
      r.rating,
      r.sentiment,
      r.title,
      r.body,
      r.url ?? null,
      seedReviewDate(r.brandId),
      0
    );
  });

  // Seed an initial run
  const insertRun = sqlite.prepare(
    "INSERT INTO runs (id, brand_id, sources_checked, new_reviews, errors, duration_ms, started_at, status, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  insertRun.run(randomUUID(), null, seedSources.length, 3, 0, 1320, now() - 1800, "ok", "Загружены страницы Vidhuk.ua для трёх брендов");
}

seedIfEmpty();

function ensureSource(source: Source) {
  const existing = sqlite.prepare("SELECT COUNT(*) as c FROM sources WHERE id = ?").get(source.id) as { c: number };
  if (existing.c > 0) return;

  const brandExists = sqlite.prepare("SELECT COUNT(*) as c FROM brands WHERE id = ?").get(source.brandId) as { c: number };
  if (brandExists.c === 0) return;

  sqlite
    .prepare(
      "INSERT INTO sources (id, brand_id, name, url, frequency, status, last_run_at, last_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      source.id,
      source.brandId,
      source.name,
      source.url,
      source.frequency,
      source.status,
      source.lastRunAt,
      source.lastError
    );
}

function ensureDefaultSources() {
  const lastRunAt = now() - 900;
  const extraSources: Source[] = [
    {
      id: "src_amebli_048",
      brandId: "brand_amebli",
      name: "048.ua",
      url: "https://www.048.ua/ru/catalog/index/995514/amebli-amebli-internet-magazin-matrasov/comments",
      frequency: "24h",
      status: "ok",
      lastRunAt,
      lastError: null,
    },
    {
      id: "src_matrasroll_048",
      brandId: "brand_matrasroll",
      name: "048.ua",
      url: "https://www.048.ua/ru/catalog/index/1434838/internet-magazin-matrasov-matrasroll/comments",
      frequency: "24h",
      status: "ok",
      lastRunAt,
      lastError: null,
    },
    {
      id: "src_amebli_komentar",
      brandId: "brand_amebli",
      name: "Komentar.in.ua",
      url: "https://www.komentar.in.ua/company/ameblicomua",
      frequency: "24h",
      status: "ok",
      lastRunAt,
      lastError: null,
    },
    {
      id: "src_matrasroll_komentar",
      brandId: "brand_matrasroll",
      name: "Komentar.in.ua",
      url: "https://www.komentar.in.ua/company/internet-mahazyn-matrasroll",
      frequency: "24h",
      status: "ok",
      lastRunAt,
      lastError: null,
    },
    {
      id: "src_sofino_komentar",
      brandId: "brand_sofino",
      name: "Komentar.in.ua",
      url: "https://www.komentar.in.ua/company/internet-mahazyn-mebliv-sofinoua",
      frequency: "24h",
      status: "ok",
      lastRunAt,
      lastError: null,
    },
  ];

  for (const source of extraSources) ensureSource(source);
}

ensureDefaultSources();

// ----- Storage interface -----

export interface IStorage {
  // brands
  listBrandSummaries(): BrandSummary[];
  getBrand(id: string): Brand | undefined;
  createBrand(b: InsertBrand): Brand;
  // sources
  listSources(brandId?: string): Source[];
  getSource(id: string): Source | undefined;
  createSource(s: InsertSource): Source;
  updateSourceStatus(id: string, status: string, lastRunAt: number | null, lastError: string | null): Source | undefined;
  // reviews
  listReviews(filters: {
    brandId?: string;
    sourceId?: string;
    sentiment?: string;
    minRating?: number;
    search?: string;
    today?: boolean;
    year?: number;
    limit?: number;
  }): Array<Review & { brandName: string; sourceName: string; sourceUrl: string; mentionUrl: string }>;
  insertReview(r: InsertReview): Review;
  reviewUrlExists(brandId: string, url: string): boolean;
  countByBrand(brandId: string): { total: number; positive: number; neutral: number; negative: number; avg: number };
  // runs
  listRuns(limit?: number): Run[];
  createRun(r: InsertRun): Run;
  clearNewFlags(): void;
}

class DbStorage implements IStorage {
  listBrandSummaries(): BrandSummary[] {
    const all = db.select().from(brands).all();
    return all.map((b) => {
      const counts = this.countByBrand(b.id);
      const siteStats = getVidhukProfileStats(b.id);
      const srcCount = db
        .select({ c: sql<number>`count(*)` })
        .from(sources)
        .where(eq(sources.brandId, b.id))
        .get() as { c: number };
      const last = db
        .select({ ts: sql<number>`max(${reviews.collectedAt})` })
        .from(reviews)
        .where(eq(reviews.brandId, b.id))
        .get() as { ts: number | null };
      // risk alerts = recent negative count
      const riskRow = db
        .select({ c: sql<number>`count(*)` })
        .from(reviews)
        .where(and(eq(reviews.brandId, b.id), eq(reviews.sentiment, "negative")))
        .get() as { c: number };
      return {
        ...b,
        reviewCount: counts.total,
        avgRating: counts.avg,
        siteRating: siteStats.rating,
        siteReviewCount: siteStats.reviewCount,
        siteViews: siteStats.views,
        sentimentPositive: counts.positive,
        sentimentNeutral: counts.neutral,
        sentimentNegative: counts.negative,
        riskAlerts: riskRow.c,
        sourcesCount: srcCount.c,
        lastReviewAt: last.ts,
      };
    });
  }
  getBrand(id: string) {
    return db.select().from(brands).where(eq(brands.id, id)).get();
  }
  createBrand(b: InsertBrand) {
    const id = `brand_${randomUUID().slice(0, 8)}`;
    db.insert(brands).values({ ...b, id }).run();
    return this.getBrand(id)!;
  }
  listSources(brandId?: string) {
    if (brandId) return db.select().from(sources).where(eq(sources.brandId, brandId)).all();
    return db.select().from(sources).all();
  }
  getSource(id: string) {
    return db.select().from(sources).where(eq(sources.id, id)).get();
  }
  createSource(s: InsertSource) {
    const id = `src_${randomUUID().slice(0, 8)}`;
    db.insert(sources).values({ ...s, id, status: "idle", lastRunAt: null, lastError: null }).run();
    return this.getSource(id)!;
  }
  updateSourceStatus(id: string, status: string, lastRunAt: number | null, lastError: string | null) {
    db.update(sources)
      .set({ status, lastRunAt, lastError })
      .where(eq(sources.id, id))
      .run();
    return this.getSource(id);
  }
  listReviews(filters: {
    brandId?: string;
    sourceId?: string;
    sentiment?: string;
    minRating?: number;
    search?: string;
    today?: boolean;
    year?: number;
    limit?: number;
  }) {
    const conds: any[] = [];
    if (filters.brandId) conds.push(eq(reviews.brandId, filters.brandId));
    if (filters.sourceId) conds.push(eq(reviews.sourceId, filters.sourceId));
    if (filters.sentiment && filters.sentiment !== "all")
      conds.push(eq(reviews.sentiment, filters.sentiment));
    if (filters.minRating && filters.minRating > 0)
      conds.push(sql`${reviews.rating} >= ${filters.minRating}`);
    if (filters.search) {
      const term = `%${filters.search.toLowerCase()}%`;
      conds.push(sql`(lower(${reviews.title}) like ${term} or lower(${reviews.body}) like ${term} or lower(${reviews.author}) like ${term})`);
    }
    if (filters.today) {
      const start = startOfTodayKyiv();
      const end = start + 86400;
      conds.push(sql`${reviews.collectedAt} >= ${start} and ${reviews.collectedAt} < ${end}`);
    }
    if (filters.year) {
      const start = Math.floor(new Date(`${filters.year}-01-01T00:00:00Z`).getTime() / 1000);
      const end = Math.floor(new Date(`${filters.year + 1}-01-01T00:00:00Z`).getTime() / 1000);
      conds.push(sql`${reviews.collectedAt} >= ${start} and ${reviews.collectedAt} < ${end}`);
    }
    let q = db.select().from(reviews).$dynamic();
    if (conds.length) q = q.where(and(...conds));
    q = q.orderBy(desc(reviews.collectedAt));
    if (filters.limit) q = q.limit(filters.limit);
    const rows = q.all();
    // join brand + source names cheaply
    const brandMap = new Map<string, string>(
      db.select().from(brands).all().map((b) => [b.id, b.name])
    );
    const srcRows = db.select().from(sources).all();
    const srcNameMap = new Map<string, string>(
      srcRows.map((s) => [s.id, s.name])
    );
    const srcUrlMap = new Map<string, string>(
      srcRows.map((s) => [s.id, s.url])
    );
    return rows.map((r) => ({
      ...r,
      brandName: brandMap.get(r.brandId) ?? "",
      sourceName: srcNameMap.get(r.sourceId) ?? "",
      sourceUrl: srcUrlMap.get(r.sourceId) ?? "",
      mentionUrl: r.url ?? srcUrlMap.get(r.sourceId) ?? "",
    }));
  }
  insertReview(r: InsertReview) {
    const id = `rev_${randomUUID().slice(0, 10)}`;
    db.insert(reviews).values({ ...r, id }).run();
    return db.select().from(reviews).where(eq(reviews.id, id)).get()!;
  }
  reviewUrlExists(brandId: string, url: string) {
    const row = db
      .select({ c: sql<number>`count(*)` })
      .from(reviews)
      .where(and(eq(reviews.brandId, brandId), eq(reviews.url, url)))
      .get() as { c: number };
    return row.c > 0;
  }
  countByBrand(brandId: string) {
    const row = db
      .select({
        total: sql<number>`count(*)`,
        positive: sql<number>`sum(case when sentiment='positive' then 1 else 0 end)`,
        neutral: sql<number>`sum(case when sentiment='neutral' then 1 else 0 end)`,
        negative: sql<number>`sum(case when sentiment='negative' then 1 else 0 end)`,
        avg: sql<number>`coalesce(avg(rating), 0)`,
      })
      .from(reviews)
      .where(eq(reviews.brandId, brandId))
      .get() as any;
    return {
      total: row.total || 0,
      positive: row.positive || 0,
      neutral: row.neutral || 0,
      negative: row.negative || 0,
      avg: Number((row.avg || 0).toFixed(2)),
    };
  }
  listRuns(limit = 20) {
    return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit).all();
  }
  createRun(r: InsertRun) {
    const id = `run_${randomUUID().slice(0, 10)}`;
    db.insert(runs).values({ ...r, id }).run();
    return db.select().from(runs).where(eq(runs.id, id)).get()!;
  }
  clearNewFlags() {
    db.update(reviews).set({ isNew: 0 }).run();
  }
}

export const storage: IStorage = new DbStorage();

export function getVidhukProfileStats(brandId: string) {
  const stats: Record<string, { rating: number; reviewCount: number; views: number }> = {
    brand_matrasroll: { rating: 3.9, reviewCount: 153, views: 4121 },
    brand_amebli: { rating: 3.5, reviewCount: 49, views: 1104 },
    brand_sofino: { rating: 4.1, reviewCount: 2625, views: 119086 },
  };
  return stats[brandId] ?? { rating: 0, reviewCount: 0, views: 0 };
}

function startOfTodayKyiv() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kiev",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0) / 1000);
}

function seedReviewDate(brandId: string) {
  const dates: Record<string, string> = {
    brand_amebli: "2025-07-18",
    brand_matrasroll: "2025-01-07",
    brand_sofino: "2015-10-22",
  };
  const date = dates[brandId] ?? "2025-01-01";
  return Math.floor(new Date(`${date}T12:00:00Z`).getTime() / 1000);
}
