import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useRoute } from "wouter";
import { MobileShell } from "@/components/mobile-shell";
import { SentimentBar } from "@/components/sentiment-bar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Star,
  ChevronLeft,
  Globe2,
  Play,
  CircleCheck,
  CircleAlert,
  CirclePause,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FREQ_LABEL, STATUS_LABEL, formatReviewDate, timeAgo } from "@/lib/format";
import type { Source, Review } from "@shared/schema";

type BrandDetail = {
  id: string;
  name: string;
  category: string;
  color: string;
  description: string | null;
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
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export default function BrandDetailPage() {
  const [, params] = useRoute("/brand/:id");
  const brandId = params?.id;
  const { toast } = useToast();

  const { data: brand, isLoading } = useQuery<BrandDetail>({
    queryKey: ["/api/brands", brandId],
    enabled: !!brandId,
  });
  const { data: sources } = useQuery<Source[]>({
    queryKey: ["/api/sources", { brandId }],
    enabled: !!brandId,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/sources?brandId=${brandId}`);
      return r.json();
    },
  });
  const { data: reviews } = useQuery<(Review & { brandName: string; sourceName: string; sourceUrl: string; mentionUrl: string })[]>({
    queryKey: ["/api/reviews", { brandId, year: 2026, limit: 100 }],
    enabled: !!brandId,
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/reviews?brandId=${brandId}&year=2026&limit=100`);
      return r.json();
    },
  });

  const collect = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/collect", { brandId });
      return r.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands", brandId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sources", { brandId }] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews", { brandId, year: 2026, limit: 100 }] });
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      toast({
        title: "Сбор завершён",
        description: r?.run?.message ?? `Найдено: ${r?.newReviews?.length ?? 0}`,
      });
    },
  });

  return (
    <MobileShell
      title={brand?.name ?? ""}
      right={
        <Link
          href="/"
          className="inline-flex items-center justify-center h-9 w-9 rounded-md text-muted-foreground hover:text-foreground hover-elevate"
          data-testid="link-back-brands"
          aria-label="Назад к брендам"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      }
    >
      {isLoading || !brand ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <Card className="p-4" data-testid={`card-brand-detail-${brand.id}`}>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: brand.color }}
              />
              <span className="text-xs text-muted-foreground">{brand.category}</span>
            </div>
            {brand.description && (
              <p className="text-sm text-muted-foreground mb-3">{brand.description}</p>
            )}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <Stat label="Отзывов" value={formatNumber(brand.siteReviewCount)} testId="stat-reviews" />
              <Stat
                label="Рейтинг"
                value={brand.siteRating.toFixed(1)}
                icon={<Star className="h-3.5 w-3.5 fill-current text-[hsl(var(--chart-4))]" />}
                testId="stat-rating"
              />
              <Stat
                label="Просмотры"
                value={formatNumber(brand.siteViews)}
                icon={<Globe2 className="h-3.5 w-3.5 text-muted-foreground" />}
                testId="stat-sources"
              />
            </div>
            <SentimentBar
              positive={brand.sentimentPositive}
              neutral={brand.sentimentNeutral}
              negative={brand.sentimentNegative}
              showLegend
              testId="sentiment-bar-detail"
            />
            <div className="mt-4 flex items-center gap-2">
              <Button
                onClick={() => collect.mutate()}
                disabled={collect.isPending}
                className="flex-1"
                data-testid="button-collect-brand"
              >
                {collect.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Сбор по бренду…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1.5" />
                    Запустить сбор по бренду
                  </>
                )}
              </Button>
              {brand.riskAlerts > 0 && (
                <Badge variant="destructive" className="gap-1" data-testid="badge-risk-detail">
                  <AlertTriangle className="h-3 w-3" />
                  {brand.riskAlerts}
                </Badge>
              )}
            </div>
          </Card>

          <h2 className="mt-6 mb-2 text-sm font-semibold tracking-tight uppercase text-muted-foreground">
            Источники
          </h2>
          {!sources && (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          )}
          {sources && sources.length === 0 && (
            <Card className="p-6 text-center" data-testid="empty-sources-detail">
              <p className="text-sm text-muted-foreground mb-3">
                Источники не подключены
              </p>
              <Link href="/sources">
                <Button size="sm" variant="outline">Добавить источник</Button>
              </Link>
            </Card>
          )}
          {sources && sources.length > 0 && (
            <ul className="space-y-2" data-testid="list-sources-detail">
              {sources.map((s) => (
                <li key={s.id}>
                  <Card className="p-3" data-testid={`card-source-${s.id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{s.name}</div>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            const opened = window.open(s.url, "_blank", "noopener,noreferrer");
                            if (!opened) window.location.href = s.url;
                          }}
                          className="inline-flex max-w-full items-center gap-1 text-xs text-primary hover:underline"
                          data-testid={`link-source-url-${s.id}`}
                        >
                          <span className="truncate">{s.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {FREQ_LABEL[s.frequency] ?? s.frequency} · последний запуск {timeAgo(s.lastRunAt)}
                        </div>
                      </div>
                      <SourceStatusBadge status={s.status} />
                    </div>
                    {s.lastError && (
                      <div className="mt-2 text-xs text-destructive">{s.lastError}</div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-6 mb-2 text-sm font-semibold tracking-tight uppercase text-muted-foreground">
            Отзывы за 2026 год
          </h2>
          {!reviews && <Skeleton className="h-24 w-full" />}
          {reviews && reviews.length === 0 && (
            <Card className="p-6 text-center" data-testid="empty-reviews-detail">
              <p className="text-sm text-muted-foreground">
                За 2026 год на Vidhuk.ua отзывов по этому бренду пока нет. Запустите сбор, чтобы проверить страницу ещё раз.
              </p>
            </Card>
          )}
          {reviews && reviews.length > 0 && (
            <ul className="space-y-2" data-testid="list-reviews-detail">
              {reviews.map((r) => (
                <li key={r.id}>
                  <Card className="p-3" data-testid={`card-review-${r.id}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="inline-flex items-center gap-1 text-xs">
                        <Star className="h-3 w-3 fill-current text-[hsl(var(--chart-4))]" />
                        <span className="tabular-nums font-medium">{r.rating}</span>
                        <span className="text-muted-foreground">· {r.sourceName}</span>
                      </div>
                      <SentimentChip sentiment={r.sentiment} />
                    </div>
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{r.body}</div>
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
                        data-testid={`link-latest-mention-${r.id}`}
                      >
                        Открыть отзыв на Vidhuk.ua
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </MobileShell>
  );
}

function Stat({
  label,
  value,
  icon,
  testId,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="inline-flex items-center gap-1 text-base font-semibold tabular-nums">
        {icon}
        {value}
      </div>
    </div>
  );
}

export function SourceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { v: any; icon: any; cls?: string }> = {
    ok: { v: "outline", icon: CircleCheck, cls: "text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3))]/40" },
    running: { v: "outline", icon: Loader2, cls: "text-primary border-primary/40 animate-pulse" },
    error: { v: "destructive", icon: CircleAlert },
    paused: { v: "secondary", icon: CirclePause },
    idle: { v: "outline", icon: CircleCheck, cls: "text-muted-foreground" },
  };
  const meta = map[status] ?? map.idle;
  const Icon = meta.icon;
  return (
    <Badge variant={meta.v} className={`gap-1 ${meta.cls ?? ""}`} data-testid={`badge-status-${status}`}>
      <Icon className={`h-3 w-3 ${status === "running" ? "animate-spin" : ""}`} />
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function SentimentChip({ sentiment }: { sentiment: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    positive: {
      label: "Позитив",
      cls: "bg-[hsl(var(--chart-3))]/15 text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3))]/30",
    },
    neutral: {
      label: "Нейтр.",
      cls: "bg-[hsl(var(--chart-4))]/15 text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4))]/30",
    },
    negative: {
      label: "Негатив",
      cls: "bg-[hsl(var(--chart-5))]/15 text-[hsl(var(--chart-5))] border-[hsl(var(--chart-5))]/30",
    },
  };
  const m = map[sentiment] ?? map.neutral;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${m.cls}`}
      data-testid={`chip-sentiment-${sentiment}`}
    >
      {m.label}
    </span>
  );
}

export { SentimentChip };
