// Times are stored in UTC and displayed in Asia/Dhaka. Never format dates without an explicit timeZone.

export const DISPLAY_TZ = "Asia/Dhaka";

const dateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: DISPLAY_TZ, day: "numeric", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "10 Nov 2026" in Dhaka time */
export function formatDhakaDate(d: Date): string {
  return dateFmt.format(d);
}

/** "10 Nov 2026, 3:16 pm" in Dhaka time */
export function formatDhakaDateTime(d: Date): string {
  return dateTimeFmt.format(d);
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** "Expires in 12 days" / "Expires in 5 hours" / "Expires in under an hour" / "Expired" */
export function expiresInLabel(expiresAt: Date, now: Date = new Date()): string {
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return "Expired";
  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    return `Expires in ${days} day${days === 1 ? "" : "s"}`;
  }
  if (ms >= HOUR) {
    const hours = Math.floor(ms / HOUR);
    return `Expires in ${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return "Expires in under an hour";
}

/** Remaining time split for a countdown; all zeros once expired. */
export function remainingParts(expiresAt: Date, now: Date = new Date()) {
  const ms = Math.max(0, expiresAt.getTime() - now.getTime());
  return {
    expired: ms === 0,
    days: Math.floor(ms / DAY),
    hours: Math.floor((ms % DAY) / HOUR),
    minutes: Math.floor((ms % HOUR) / 60_000),
    seconds: Math.floor((ms % 60_000) / 1000),
  };
}

// Asia/Dhaka is a fixed UTC+6 (no DST), so a constant offset is exact.
const DHAKA_OFFSET_MS = 6 * HOUR;

/** <input type="datetime-local"> value in Dhaka time ("2026-11-10T15:00") -> UTC ISO string, or null. */
export function dhakaInputToUtcIso(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+06:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** UTC Date -> "YYYY-MM-DDTHH:mm" in Dhaka time, for datetime-local inputs. */
export function toDhakaInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 16);
}

/** "2026-11-10" (a Dhaka calendar day) -> the UTC instant that day starts in Dhaka, or null. */
export function dhakaDayStart(date: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const d = new Date(`${date}T00:00:00+06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** UTC Date -> "YYYY-MM-DD" of its Dhaka calendar day (for <input type="date">). */
export function toDhakaDateInput(d: Date): string {
  return new Date(d.getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}
