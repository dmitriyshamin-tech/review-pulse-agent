import { useQuery } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile-shell";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDown, ArrowUp, Circle, ExternalLink, Star } from "lucide-react";

type RankingRow = {
  id: string;
  name: string;
  group: "my" | "competitor";
  rating: number;
  reviews: number;
  views: number;
  trend: "up" | "down" | "flat";
  weeklyReviews: number;
  weeklyAvg: number | null;
  url: string;
  googleRating: number | null;
  googleReviews: number | null;
  googleName: string | null;
  googleUrl: string | null;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function TrendIcon({ trend }: { trend: RankingRow["trend"] }) {
  if (trend === "up") {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-500" data-testid="trend-up">
        <ArrowUp className="h-4 w-4" />
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500/12 text-red-500" data-testid="trend-down">
        <ArrowDown className="h-4 w-4" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/12 text-emerald-500" data-testid="trend-flat">
      <Circle className="h-3.5 w-3.5 fill-current" />
    </span>
  );
}

function trendLabel(row: RankingRow) {
  if (row.trend === "up") return `Растёт: ${row.weeklyReviews} отзыв. за неделю`;
  if (row.trend === "down") return `Падает: ${row.weeklyReviews} отзыв. за неделю`;
  return "Без изменений за неделю";
}

export default function RankingPage() {
  const { data, isLoading, isError } = useQuery<RankingRow[]>({
    queryKey: ["/api/ranking"],
  });

  return (
    <MobileShell title="Рейтинг">
      <div className="space-y-3">
        <Card className="p-4 border-primary/25 bg-primary/5" data-testid="card-ranking-summary">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Сводная таблица Vidhuk.ua + Google</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ваши сайты и топ-конкуренты: отдельные оценки Vidhuk.ua и Google, отзывы, просмотры и динамика за последнюю неделю.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              2026
            </Badge>
          </div>
        </Card>

        {isLoading && (
          <div className="space-y-2" data-testid="loading-ranking">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        )}

        {isError && (
          <Card className="p-6 text-center text-sm text-destructive" data-testid="error-ranking">
            Не удалось загрузить рейтинг.
          </Card>
        )}

        {data && (
          <div className="space-y-2" data-testid="table-ranking">
            {data.map((row, index) => (
              <Card key={row.id} className="p-3" data-testid={`row-ranking-${row.id}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold" data-testid={`text-ranking-name-${row.id}`}>
                            {row.name}
                          </p>
                          <Badge variant={row.group === "my" ? "default" : "secondary"} className="h-5 px-1.5 text-[10px]">
                            {row.group === "my" ? "мой" : "конкурент"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground" data-testid={`text-ranking-trend-${row.id}`}>
                          {trendLabel(row)}
                        </p>
                      </div>
                      <TrendIcon trend={row.trend} />
                    </div>

                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-lg border bg-background/60 p-2">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Vidhuk.ua</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Рейтинг</div>
                            <div className="mt-0.5 inline-flex items-center gap-1 font-semibold tabular-nums" data-testid={`text-ranking-rating-${row.id}`}>
                              <Star className="h-3.5 w-3.5 fill-current text-[hsl(var(--chart-4))]" />
                              {row.rating.toFixed(1)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Отзывы</div>
                            <div className="mt-0.5 font-semibold tabular-nums" data-testid={`text-ranking-reviews-${row.id}`}>
                              {formatNumber(row.reviews)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Просмотры</div>
                            <div className="mt-0.5 font-semibold tabular-nums" data-testid={`text-ranking-views-${row.id}`}>
                              {formatNumber(row.views)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border bg-background/60 p-2">
                        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Google</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Рейтинг</div>
                            <div className="mt-0.5 inline-flex items-center gap-1 font-semibold tabular-nums" data-testid={`text-ranking-google-rating-${row.id}`}>
                              <Star className="h-3.5 w-3.5 fill-current text-[hsl(var(--chart-4))]" />
                              {row.googleRating ? row.googleRating.toFixed(1) : "—"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Отзывы</div>
                            <div className="mt-0.5 font-semibold tabular-nums" data-testid={`text-ranking-google-reviews-${row.id}`}>
                              {row.googleReviews ? formatNumber(row.googleReviews) : "—"}
                            </div>
                          </div>
                        </div>
                        {row.googleName && (
                          <div className="mt-1 truncate text-[10px] text-muted-foreground" data-testid={`text-ranking-google-name-${row.id}`}>
                            {row.googleName}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <a
                        href={row.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          const opened = window.open(row.url, "_blank", "noopener,noreferrer");
                          if (!opened) window.location.href = row.url;
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        data-testid={`link-ranking-source-${row.id}`}
                      >
                        Открыть Vidhuk.ua
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      {row.googleUrl && (
                        <a
                          href={row.googleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            const opened = window.open(row.googleUrl!, "_blank", "noopener,noreferrer");
                            if (!opened) window.location.href = row.googleUrl!;
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          data-testid={`link-ranking-google-${row.id}`}
                        >
                          Открыть Google
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
