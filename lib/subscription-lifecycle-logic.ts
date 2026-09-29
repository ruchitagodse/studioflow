export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function formatter(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
}

export function zonedParts(date: Date, timezone: string): ZonedParts {
  const values = Object.fromEntries(formatter(timezone).formatToParts(date)
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

function offsetMilliseconds(date: Date, timezone: string) {
  const parts = zonedParts(date, timezone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

/** Converts a studio-local wall time to an instant. Inputs are produced from an existing valid instant. */
export function zonedTimeToUtc(parts: ZonedParts, timezone: string) {
  const wallTime = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  let candidate = new Date(wallTime - offsetMilliseconds(new Date(wallTime), timezone));
  candidate = new Date(wallTime - offsetMilliseconds(candidate, timezone));
  return candidate;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addCalendarMonths(date: Date, months: number, timezone: string) {
  const parts = zonedParts(date, timezone);
  const zeroBased = parts.month - 1 + months;
  const year = parts.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12 + 1;
  return zonedTimeToUtc({ ...parts, year, month, day: Math.min(parts.day, daysInMonth(year, month)) }, timezone);
}

export function addCalendarDays(date: Date, days: number, timezone: string) {
  const parts = zonedParts(date, timezone);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second));
  return zonedTimeToUtc({
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: parts.hour, minute: parts.minute, second: parts.second,
  }, timezone);
}

export function pauseAllowanceDays(durationMonths: number | undefined) {
  return durationMonths && Number.isInteger(durationMonths) && durationMonths > 0 ? durationMonths * 5 : 0;
}

export function effectiveExpiry(historicalEndsAt: Date, pausedDays: number, timezone: string) {
  return pausedDays > 0 ? addCalendarDays(historicalEndsAt, pausedDays, timezone) : historicalEndsAt;
}
