import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Brands / trademarks being monitored
export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  color: text("color").notNull(), // accent color for brand chip (hex)
  description: text("description"),
});

export const insertBrandSchema = createInsertSchema(brands).omit({ id: true });
export type Brand = typeof brands.$inferSelect;
export type InsertBrand = z.infer<typeof insertBrandSchema>;

// Review source websites attached to a brand
export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  name: text("name").notNull(), // e.g. "Otzovik", "Yandex Maps"
  url: text("url").notNull(),
  frequency: text("frequency").notNull(), // "15m" | "1h" | "6h" | "24h"
  status: text("status").notNull(), // "idle" | "running" | "ok" | "error" | "paused"
  lastRunAt: integer("last_run_at"), // unix seconds
  lastError: text("last_error"),
});

export const insertSourceSchema = createInsertSchema(sources).omit({
  id: true,
  status: true,
  lastRunAt: true,
  lastError: true,
});
export type Source = typeof sources.$inferSelect;
export type InsertSource = z.infer<typeof insertSourceSchema>;

// Individual reviews collected from sources
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  brandId: text("brand_id").notNull(),
  sourceId: text("source_id").notNull(),
  author: text("author").notNull(),
  rating: integer("rating").notNull(), // 1..5
  sentiment: text("sentiment").notNull(), // "positive" | "neutral" | "negative"
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url"),
  collectedAt: integer("collected_at").notNull(), // unix seconds
  isNew: integer("is_new").notNull().default(0), // 0|1
});

export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true });
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

// Collection runs (history)
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  brandId: text("brand_id"), // null = all brands
  sourcesChecked: integer("sources_checked").notNull(),
  newReviews: integer("new_reviews").notNull(),
  errors: integer("errors").notNull(),
  durationMs: integer("duration_ms").notNull(),
  startedAt: integer("started_at").notNull(),
  status: text("status").notNull(), // "ok" | "partial" | "error"
  message: text("message"),
});

export const insertRunSchema = createInsertSchema(runs).omit({ id: true });
export type Run = typeof runs.$inferSelect;
export type InsertRun = z.infer<typeof insertRunSchema>;

// Aggregate types used by API
export type BrandSummary = Brand & {
  reviewCount: number;
  avgRating: number;
  siteRating: number;
  siteReviewCount: number;
  siteViews: number;
  sentimentPositive: number;
  sentimentNeutral: number;
  sentimentNegative: number;
  riskAlerts: number;
  sourcesCount: number;
  lastReviewAt: number | null;
};
