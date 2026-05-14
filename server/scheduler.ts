import { sendMessage, buildDailyReport, buildWeeklyAudit } from "./telegram";

function kyivNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kiev" }));
}

function msUntilKyivTime(hour: number, minute: number): number {
  const now = kyivNow();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function msUntilNextMonday(hour: number, minute: number): number {
  const now = kyivNow();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  // Days until next Monday (1); if today is Monday and time hasn't passed, fire today
  const daysToAdd = dayOfWeek === 1 && next > now ? 0 : (8 - dayOfWeek) % 7 || 7;
  next.setDate(next.getDate() + daysToAdd);
  return next.getTime() - now.getTime();
}

function scheduleDailyAt(hour: number, minute: number, task: () => Promise<void>) {
  const ms = msUntilKyivTime(hour, minute);
  console.log(`[scheduler] Daily report scheduled in ${Math.round(ms / 60000)} min`);
  setTimeout(async () => {
    try {
      await task();
    } catch (err) {
      console.error("[scheduler] Daily report error:", err);
    }
    scheduleDailyAt(hour, minute, task);
  }, ms);
}

function scheduleWeeklyOnMonday(hour: number, minute: number, task: () => Promise<void>) {
  const ms = msUntilNextMonday(hour, minute);
  console.log(`[scheduler] Weekly audit scheduled in ${Math.round(ms / 3600000)} h`);
  setTimeout(async () => {
    try {
      await task();
    } catch (err) {
      console.error("[scheduler] Weekly audit error:", err);
    }
    scheduleWeeklyOnMonday(hour, minute, task);
  }, ms);
}

export function startScheduler() {
  scheduleDailyAt(9, 0, async () => {
    console.log("[scheduler] Sending daily report");
    await sendMessage(buildDailyReport());
  });

  scheduleWeeklyOnMonday(9, 0, async () => {
    console.log("[scheduler] Sending weekly audit");
    await sendMessage(buildWeeklyAudit());
  });
}
