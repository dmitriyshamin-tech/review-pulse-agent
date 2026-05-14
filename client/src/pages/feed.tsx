import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarDays, ExternalLink, Search, Star, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { formatReviewDate, timeAgo } from "@/lib/format";
import { SentimentChip } from "./brand-detail";
import type { Source, Brand, Review } from "@shared/schema";

type ReviewRow = Review & { brandName: string; sourceName: string; sourceUrl: string; mentionUrl: string };

export default function FeedPage() {
  const [brandId, setBrandId] = useState("all");
  const [sourceId, setSourceId] = useState("all");
  const [sentiment, setSentiment] = useState("all");
  const [minRating, setMinRating] = useState("0");
  const [search, setSearch] = useState("");
  const [year2026Only, setYear2026Only] = useState(true);

  const { data: brands } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });
  const { data: sources } = useQuery<Source[]>({ queryKey: ["/api/sources"] });

  const visibleSources = useMemo(
    () => (brandId === "all" ? sources ?? [] : (sources ?? []).filter((s) => s.brandId === brandId)),
    [sources, brandId]
  );

  const params = new URLSearchParams();
  if (brandId !== "all") params.set("brandId", brandId);
  if (sourceId !== "all") params.set("sourceId", sourceId);
  if (sentiment !== "all") params.set("sentiment", sentiment);
  if (minRating !== "0") params.set("minRating", minRating);
  if (search.trim()) params.set("search", search.trim());
  if (year2026Only) params.set("year", "2026");
  params.set("limit", "100");

  const queryUrl = `/api/reviews?${params.toString()}`;
  const { data, isLoading } = useQuery<ReviewRow[]>({
    queryKey: ["/api/reviews", { brandId, sourceId, sentiment, minRating, search, year2026Only }],
    queryFn: async () => {
      const r = await apiRequest("GET", queryUrl);
      return r.json();
    },
  });

  const clearFilters = () => {
    setBrandId("all");
    setSourceId("all");
    setSentiment("all");
    setMinRating("0");
    setSearch("");
    setYear2026Only(false);
  };

  const filtersActive =
    brandId !== "all" || sourceId !== "all" || sentiment !== "all" || minRating !== "0" || !!search.trim() || year2026Only;

  return (
    <MobileShell title="Лента упоминаний">
      <div className="space-y-2 mb-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Поиск по тексту, автору…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-reviews"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={brandId} onValueChange={(v) => { setBrandId(v); setSourceId("all"); }}>
            <SelectTrigger data-testid="select-feed-brand">
              <SelectValue placeholder="Бренд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все бренды</SelectItem>
              {(brands ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sourceId} onValueChange={setSourceId}>
            <SelectTrigger data-testid="select-feed-source">
              <SelectValue placeholder="Источник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все источники</SelectItem>
              {visibleSources.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sentiment} onValueChange={setSentiment}>
            <SelectTrigger data-testid="select-feed-sentiment">
              <SelectValue placeholder="Тональность" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Любая тональность</SelectItem>
              <SelectItem value="positive">Позитивные</SelectItem>
              <SelectItem value="neutral">Нейтральные</SelectItem>
              <SelectItem value="negative">Негативные</SelectItem>
            </SelectContent>
          </Select>

          <Select value={minRating} onValueChange={setMinRating}>
            <SelectTrigger data-testid="select-feed-rating">
              <SelectValue placeholder="Рейтинг" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Любой рейтинг</SelectItem>
              <SelectItem value="4">≥ 4 звезды</SelectItem>
              <SelectItem value="3">≥ 3 звезды</SelectItem>
              <SelectItem value="2">≥ 2 звезды</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant={year2026Only ? "default" : "outline"}
          size="sm"
          className="w-full justify-center"
          onClick={() => setYear2026Only((v) => !v)}
          data-testid="button-toggle-year-2026"
        >
          <CalendarDays className="h-4 w-4 mr-1.5" />
          {year2026Only ? "Показаны отзывы за 2026 год" : "Показать только 2026 год"}
        </Button>

        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-muted-foreground"
            onClick={clearFilters}
            data-testid="button-clear-filters"
          >
            <X className="h-3 w-3 mr-1" />
            Сбросить фильтры
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-2" data-testid="loading-reviews">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <Card className="p-8 text-center" data-testid="empty-reviews">
          <Filter className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {year2026Only
              ? "За 2026 год в подключённых источниках отзывов по выбранным фильтрам нет"
              : "Нет упоминаний под текущие фильтры"}
          </p>
        </Card>
      )}

      {!isLoading && data && data.length > 0 && (
        <>
          <div className="text-xs text-muted-foreground mb-2" data-testid="text-results-count">
            Найдено: <span className="text-foreground tabular-nums">{data.length}</span>
          </div>
          <ul className="space-y-2" data-testid="list-reviews">
            {data.map((r) => (
              <li key={r.id}>
                <Card
                  className={`p-3 ${r.isNew ? "border-primary/50 bg-primary/[0.04]" : ""}`}
                  data-testid={`card-review-${r.id}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="inline-flex items-center gap-1.5 text-xs min-w-0">
                      <Star className="h-3 w-3 fill-current text-[hsl(var(--chart-4))] shrink-0" />
                      <span className="tabular-nums font-medium">{r.rating}</span>
                      <span className="text-muted-foreground truncate">
                        · {r.brandName} · {r.sourceName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.isNew ? (
                        <span
                          className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-primary/40 text-primary"
                          data-testid={`chip-new-${r.id}`}
                        >
                          Новое
                        </span>
                      ) : null}
                      <SentimentChip sentiment={r.sentiment} />
                    </div>
                  </div>
                  <div className="text-sm font-medium" data-testid={`text-review-title-${r.id}`}>
                    {r.title}
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid={`text-review-body-${r.id}`}>
                    {r.body}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>
                      {r.author} · {formatReviewDate(r.collectedAt)} · {timeAgo(r.collectedAt)}
                    </span>
                  </div>
                  {(r.mentionUrl || r.sourceUrl) && (
                    <a
                      href={r.mentionUrl || r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = r.mentionUrl || r.sourceUrl;
                        const opened = window.open(url, "_blank", "noopener,noreferrer");
                        if (!opened) window.location.href = url;
                      }}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/15 active:bg-primary/20"
                      data-testid={`link-review-source-${r.id}`}
                    >
                      {r.sourceName === "Vidhuk.ua" ? "Открыть отзыв на Vidhuk.ua" : "Открыть отзыв / страницу источника"}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </MobileShell>
  );
}
