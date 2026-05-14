export function timeAgo(unixSec: number | null | undefined): string {
  if (!unixSec) return "—";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - unixSec;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

export function formatReviewDate(unixSec: number | null | undefined): string {
  if (!unixSec) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(unixSec * 1000));
}

export const SENTIMENT_LABEL: Record<string, string> = {
  positive: "Позитив",
  neutral: "Нейтрал.",
  negative: "Негатив",
};

export const STATUS_LABEL: Record<string, string> = {
  idle: "Ожидание",
  running: "Сбор…",
  ok: "Готово",
  error: "Ошибка",
  paused: "Пауза",
};

export const FREQ_LABEL: Record<string, string> = {
  "15m": "Каждые 15 мин",
  "1h": "Каждый час",
  "6h": "Каждые 6 ч",
  "24h": "Раз в сутки",
};
