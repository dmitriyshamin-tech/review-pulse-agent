import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { MobileShell } from "@/components/mobile-shell";
import { SentimentBar } from "@/components/sentiment-bar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, AlertTriangle, ChevronRight, Globe2, Play, Sparkles } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/format";
import type { BrandSummary } from "@shared/schema";

function compactNumber(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value);
}

export default function BrandsPage() {
  const { toast } = useToast();
  const { data, isLoading, isError } = useQuery<BrandSummary[]>({
    queryKey: ["/api/brands"],
  });

  const collect = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/collect", {});
      return res.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      toast({
        title: "Сбор завершён",
        description: r?.run?.message ?? `Найдено упоминаний: ${r?.newReviews?.length ?? 0}`,
      });
    },
    onError: () =>
      toast({ title: "Не удалось запустить сбор", variant: "destructive" }),
  });

  return (
    <MobileShell
      title="Бренды"
      right={
        <Button
          size="sm"
          variant="default"
          onClick={() => collect.mutate()}
          disabled={collect.isPending}
          data-testid="button-collect-all"
          className="h-9"
        >
          {collect.isPending ? (
            <>
              <Sparkles className="h-4 w-4 mr-1.5 animate-pulse" />
              Сбор…
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1.5" />
              Собрать всё
            </>
          )}
        </Button>
      }
    >
      <p className="text-sm text-muted-foreground mb-4">
        Мониторинг упоминаний по ТМ: амеблі / amebli, Matrasroll, Sofino
      </p>

      {isLoading && (
        <div className="space-y-3" data-testid="loading-brands">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-5 w-1/2 mb-3" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </Card>
          ))}
        </div>
      )}

      {isError && (
        <Card className="p-6 text-center" data-testid="error-brands">
          <AlertTriangle className="h-6 w-6 mx-auto text-destructive mb-2" />
          <p className="text-sm">Ошибка загрузки брендов</p>
        </Card>
      )}

      {data && data.length === 0 && (
        <Card className="p-8 text-center" data-testid="empty-brands">
          <p className="text-sm text-muted-foreground">
            Пока нет добавленных брендов
          </p>
        </Card>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-3" data-testid="list-brands">
          {data.map((b) => (
            <li key={b.id}>
              <Link
                href={`/brand/${b.id}`}
                data-testid={`card-brand-${b.id}`}
                className="block"
              >
                <Card className="p-4 hover-elevate active-elevate-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: b.color }}
                        />
                        <span className="text-xs text-muted-foreground">{b.category}</span>
                      </div>
                      <h3
                        className="text-base font-semibold tracking-tight truncate"
                        data-testid={`text-brand-name-${b.id}`}
                      >
                        {b.name}
                      </h3>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Отзывов
                      </div>
                      <div
                        className="text-base font-semibold tabular-nums"
                        data-testid={`text-review-count-${b.id}`}
                      >
                        {compactNumber(b.siteReviewCount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Рейтинг
                      </div>
                      <div className="inline-flex items-center gap-1 text-base font-semibold tabular-nums">
                        <Star className="h-3.5 w-3.5 fill-current text-[hsl(var(--chart-4))]" />
                        <span data-testid={`text-avg-rating-${b.id}`}>
                          {b.siteRating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Просмотры
                      </div>
                      <div className="inline-flex items-center gap-1 text-base font-semibold tabular-nums">
                        <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span data-testid={`text-sources-count-${b.id}`}>
                          {compactNumber(b.siteViews)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3">
                    <SentimentBar
                      positive={b.sentimentPositive}
                      neutral={b.sentimentNeutral}
                      negative={b.sentimentNegative}
                      testId={`sentiment-bar-${b.id}`}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    {b.riskAlerts > 0 ? (
                      <Badge
                        variant="destructive"
                        className="gap-1"
                        data-testid={`badge-risk-${b.id}`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {b.riskAlerts} {pluralize(b.riskAlerts, ["риск", "риска", "рисков"])}
                      </Badge>
                    ) : (
                      <Badge variant="outline" data-testid={`badge-risk-${b.id}`}>
                        Без рисков
                      </Badge>
                    )}
                    <span className="text-muted-foreground">
                      Посл. упоминание · {timeAgo(b.lastReviewAt)}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </MobileShell>
  );
}

function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
