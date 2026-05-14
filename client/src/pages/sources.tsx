import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MobileShell } from "@/components/mobile-shell";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ExternalLink, Play, Plus, Pause, Loader2, RefreshCw } from "lucide-react";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertSourceSchema } from "@shared/schema";
import type { Source, Brand } from "@shared/schema";
import { FREQ_LABEL, timeAgo } from "@/lib/format";
import { SourceStatusBadge } from "./brand-detail";

const formSchema = insertSourceSchema.extend({
  url: z.string().url("Введите корректный URL"),
  name: z.string().min(2, "Минимум 2 символа"),
});

export default function SourcesPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [brandFilter, setBrandFilter] = useState<string>("all");

  const { data: brands } = useQuery<Brand[]>({ queryKey: ["/api/brands"] });
  const { data: sources, isLoading } = useQuery<Source[]>({
    queryKey: ["/api/sources"],
  });

  const filtered = (sources ?? []).filter(
    (s) => brandFilter === "all" || s.brandId === brandFilter
  );
  const brandMap = new Map((brands ?? []).map((b) => [b.id, b]));

  const collectOne = useMutation({
    mutationFn: async (sourceId: string) => {
      const r = await apiRequest("POST", "/api/collect", { sourceId });
      return r.json();
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/runs"] });
      toast({ title: "Сбор завершён", description: r?.run?.message ?? "" });
    },
  });

  const togglePause = useMutation({
    mutationFn: async (sourceId: string) => {
      const r = await apiRequest("POST", `/api/sources/${sourceId}/pause`, {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { brandId: "", name: "", url: "", frequency: "1h" },
  });

  const create = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const r = await apiRequest("POST", "/api/sources", values);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sources"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
      toast({ title: "Источник добавлен" });
      form.reset({ brandId: "", name: "", url: "", frequency: "1h" });
      setOpen(false);
    },
    onError: (e: any) =>
      toast({ title: "Не удалось добавить", description: String(e?.message ?? e), variant: "destructive" }),
  });

  return (
    <MobileShell
      title="Источники"
      right={
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" data-testid="button-add-source" className="h-9">
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-w-md mx-auto rounded-t-xl">
            <SheetHeader>
              <SheetTitle>Новый источник</SheetTitle>
            </SheetHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((v) => create.mutate(v))}
                className="space-y-3 mt-3"
              >
                <FormField
                  control={form.control}
                  name="brandId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Бренд</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-brand">
                            <SelectValue placeholder="Выберите бренд" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(brands ?? []).map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Forbes.ua, Rozetka, Trustpilot…"
                          data-testid="input-source-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://…"
                          data-testid="input-source-url"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Периодичность сбора</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-frequency">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="15m">Каждые 15 минут</SelectItem>
                          <SelectItem value="1h">Каждый час</SelectItem>
                          <SelectItem value="6h">Каждые 6 часов</SelectItem>
                          <SelectItem value="24h">Раз в сутки</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={create.isPending}
                  data-testid="button-save-source"
                >
                  {create.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                      Сохранение…
                    </>
                  ) : (
                    "Сохранить"
                  )}
                </Button>
              </form>
            </Form>
          </SheetContent>
        </Sheet>
      }
    >
      <div className="mb-3">
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger data-testid="select-brand-filter">
            <SelectValue placeholder="Все бренды" />
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
      </div>

      {isLoading && (
        <div className="space-y-2" data-testid="loading-sources">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card className="p-8 text-center" data-testid="empty-sources">
          <p className="text-sm text-muted-foreground mb-3">
            Источники не добавлены
          </p>
          <Button size="sm" onClick={() => setOpen(true)} data-testid="button-empty-add-source">
            <Plus className="h-4 w-4 mr-1" />
            Добавить источник
          </Button>
        </Card>
      )}

      {filtered.length > 0 && (
        <ul className="space-y-2" data-testid="list-sources">
          {filtered.map((s) => {
            const b = brandMap.get(s.brandId);
            const running = s.status === "running" || collectOne.isPending;
            return (
              <li key={s.id}>
                <Card className="p-3" data-testid={`card-source-${s.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        {b && (
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: b.color }}
                          />
                        )}
                        <span className="text-[11px] text-muted-foreground truncate">
                          {b?.name ?? s.brandId}
                        </span>
                      </div>
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
                        {FREQ_LABEL[s.frequency] ?? s.frequency} · посл. запуск {timeAgo(s.lastRunAt)}
                      </div>
                    </div>
                    <SourceStatusBadge status={s.status} />
                  </div>
                  {s.lastError && (
                    <div className="text-xs text-destructive mb-2">{s.lastError}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1"
                      disabled={running || s.status === "paused"}
                      onClick={() => collectOne.mutate(s.id)}
                      data-testid={`button-collect-source-${s.id}`}
                    >
                      {running ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          Сбор…
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 mr-1.5" />
                          Собрать
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePause.mutate(s.id)}
                      data-testid={`button-pause-source-${s.id}`}
                    >
                      {s.status === "paused" ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Возобновить
                        </>
                      ) : (
                        <>
                          <Pause className="h-3.5 w-3.5 mr-1.5" />
                          Пауза
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Card className="mt-6 p-4 border-dashed" data-testid="card-connector-note">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
          Заглушка коннектора
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Прототип использует имитацию сбора: новые упоминания генерируются из демо-данных.
          Сейчас прототип сфокусирован на Vidhuk.ua: для каждого бренда хранится
          отдельная страница отзывов. Кнопка сбора проверяет Vidhuk.ua по ключам
          «амеблі», «amebli», «Matrasroll», «Sofino» и сохраняет конкретные URL отзывов.
        </p>
      </Card>
    </MobileShell>
  );
}
