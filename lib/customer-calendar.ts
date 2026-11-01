/** Calendar arithmetic uses date-only studio values, never the browser timezone. */
export function shiftCalendarDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function calendarWeek(value: string) {
  const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
  const monday = shiftCalendarDate(value, -((weekday + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftCalendarDate(monday, index));
}

export function calendarLabel(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
