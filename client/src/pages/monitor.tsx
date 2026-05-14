import { useQuery, useMutation } from "@tanstack/react-query";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Activity,
  CircleCheck,
  CircleAlert,
  AlertTriangle,
  Loader2,
  Clock,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { timeAgo, STATUS_LABEL } from "@/lib/format";
import { SourceStatusBadge } from "./brand-detail";
import type { Run, Source } from "@shared/schema";

export default function MonitorPage() {
  const { toast } = useToast();
  const { data: runs, isLoading } = useQuery<Run[]>({ queryKey: ["/api/runs"] });
  const { data: sources } = useQuery<Source[]>({ queryKey: ["/api/sources"] });

  const collect = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/collect", {});
      return r.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      toast({ title: "Сбор завершён", description: r?.run?.message ?? "" });
    },
  });

  const lastRun = runs?.[0];
  const totalSources = sources?.length ?? 0;
  const okSources = sources?.filter((s) => s.status === "ok").length ?? 0;
  const errSources = sources?.filter((s) => s.status === "error").length ?? 0;
  const pausedSources = sources?.filter((s) => s.status === "paused").length ?? 0;
  const runningSources = sources?.filter((s) => s.status === "running").length ?? 0;

  return (
    <MobileShell
      title="Мониторинг сбора"
      right={
        <Button
          size="sm"
          onClick={() => collect.mutate()}
          disabled={collect.isPending}
          data-testid="button-monitor-run-now"
          className="h-9"
        >
          {collect.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Запуск…
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1.5" />
              Запустить сейчас
            </>
          )}
        </Button>
      }
    >
      {/* Last run summary */}
      {isLoading && <Skeleton className="h-32 w-full mb-4" />}
      {!isLoading && (
        <Card className="p-4 mb-4" data-testid="card-last-run">
          <div className="flex items-center justify-between mb-2">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5" />
              Последний запуск
            </div>
            {lastRun && <RunStatusBadge status={lastRun.status} />}
          </div>

          {!lastRun ? (
            <p className="text-sm text-muted-foreground">Сборы пока не запускались</p>
          ) : (
            <>
              <div className="text-xs text-muted-foreground inline-flex items-center gap-1 mb-3">
                <Clock className="h-3 w-3" />
                {timeAgo(lastRun.startedAt)} · {(lastRun.durationMs / 1000).toFixed(1)} с
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MonitorStat
                  label="Источников"
                  value={lastRun.sourcesChecked}
                  testId="stat-last-sources"
                />
                <MonitorStat
                  label="Новых упоминаний"
                  value={lastRun.newReviews}
                  testId="stat-last-new"
                  accent
                />
                <MonitorStat
                  label="Ошибок"
                  value={lastRun.errors}
                  testId="stat-last-errors"
                  warn={lastRun.errors > 0}
                />
              </div>
              {lastRun.message && (
                <div className="mt-3 text-xs text-muted-foreground" data-testid="text-last-message">
                  {lastRun.message}
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {/* Sources health */}
      <h2 className="mb-2 text-sm font-semibold tracking-tight uppercase text-muted-foreground">
        Состояние источников
      </h2>
      <Card className="p-4 mb-4" data-testid="card-sources-health">
        <div className="grid grid-cols-4 gap-2 text-center">
          <HealthTile label="Всего" value={totalSources} testId="health-total" />
          <HealthTile label="OK" value={okSources} accent testId="health-ok" />
          <HealthTile label="Ошибки" value={errSources} warn={errSources > 0} testId="health-errors" />
          <HealthTile label="Пауза" value={pausedSources} testId="health-paused" />
        </div>
        {runningSources > 0 && (
          <div className="mt-3 text-xs text-primary inline-flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Идёт сбор по {runningSources} источникам…
          </div>
        )}
      </Card>

      {/* Per-source statuses */}
      {sources && sources.length > 0 && (
        <ul className="space-y-2 mb-6" data-testid="list-sources-monitor">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-md border border-card-border bg-card"
              data-testid={`row-source-${s.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{s.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{s.url}</div>
              </div>
              <div className="text-right">
                <SourceStatusBadge status={s.status} />
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {timeAgo(s.lastRunAt)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* History */}
      <h2 className="mb-2 text-sm font-semibold tracking-tight uppercase text-muted-foreground">
        История запусков
      </h2>
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      )}
      {!isLoading && (!runs || runs.length === 0) && (
        <Card className="p-6 text-center" data-testid="empty-runs">
          <p className="text-sm text-muted-foreground">История пуста</p>
        </Card>
      )}
      {runs && runs.length > 0 && (
        <ul className="space-y-2" data-testid="list-runs">
          {runs.map((r) => (
            <li key={r.id}>
              <Card className="p-3" data-testid={`card-run-${r.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo(r.startedAt)} · {(r.durationMs / 1000).toFixed(1)} с
                    </div>
                    <div className="text-sm mt-0.5 truncate">
                      Проверено: <span className="tabular-nums">{r.sourcesChecked}</span> · Новых:{" "}
                      <span className="tabular-nums text-primary font-medium">{r.newReviews}</span>
                      {r.errors > 0 && (
                        <>
                          {" "}
                          · Ошибок:{" "}
                          <span className="tabular-nums text-destructive font-medium">
                            {r.errors}
                          </span>
                        </>
                      )}
                    </div>
                    {r.message && (
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {r.message}
                      </div>
                    )}
                  </div>
                  <RunStatusBadge status={r.status} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </MobileShell>
  );
}

function MonitorStat({
  label,
  value,
  testId,
  accent,
  warn,
}: {
  label: string;
  value: number;
  testId?: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div data-testid={testId}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`text-2xl font-semibold tabular-nums ${
          accent ? "text-primary" : warn ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function HealthTile({
  label,
  value,
  accent,
  warn,
  testId,
}: {
  label: string;
  value: number;
  accent?: boolean;
  warn?: boolean;
  testId?: string;
}) {
  return (
    <div data-testid={testId}>
      <div
        className={`text-xl font-semibold tabular-nums ${
          accent ? "text-[hsl(var(--chart-3))]" : warn ? "text-destructive" : ""
        }`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  if (status === "ok")
    return (
      <Badge
        variant="outline"
        className="gap-1 text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3))]/40"
        data-testid={`badge-run-${status}`}
      >
        <CircleCheck className="h-3 w-3" />
        OK
      </Badge>
    );
  if (status === "partial")
    return (
      <Badge
        variant="outline"
        className="gap-1 text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4))]/40"
        data-testid={`badge-run-${status}`}
      >
        <AlertTriangle className="h-3 w-3" />
        Частично
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1" data-testid={`badge-run-${status}`}>
      <CircleAlert className="h-3 w-3" />
      Ошибка
    </Badge>
  );
}
