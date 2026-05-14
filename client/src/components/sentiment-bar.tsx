export function SentimentBar({
  positive,
  neutral,
  negative,
  showLegend = false,
  testId,
}: {
  positive: number;
  neutral: number;
  negative: number;
  showLegend?: boolean;
  testId?: string;
}) {
  const total = Math.max(positive + neutral + negative, 1);
  const p = (positive / total) * 100;
  const n = (neutral / total) * 100;
  const ng = (negative / total) * 100;
  return (
    <div data-testid={testId}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="bg-[hsl(var(--chart-3))]" style={{ width: `${p}%` }} />
        <div className="bg-[hsl(var(--chart-4))]" style={{ width: `${n}%` }} />
        <div className="bg-[hsl(var(--chart-5))]" style={{ width: `${ng}%` }} />
      </div>
      {showLegend && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-3))]" />
            Позитив <span className="tabular-nums text-foreground">{positive}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-4))]" />
            Нейтр. <span className="tabular-nums text-foreground">{neutral}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[hsl(var(--chart-5))]" />
            Негатив <span className="tabular-nums text-foreground">{negative}</span>
          </span>
        </div>
      )}
    </div>
  );
}
