import { shiftCalendarDate } from "./customer-calendar";

export type SchedulePeriod = "day" | "week" | "month";

export function scheduleWindow(requestedDate: unknown, today: string, requestedView: unknown) {
  const date = typeof requestedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    Number.isFinite(Date.parse(`${requestedDate}T12:00:00Z`)) && new Date(`${requestedDate}T12:00:00Z`).toISOString().slice(0, 10) === requestedDate ? requestedDate : today;
  const view: SchedulePeriod = requestedView === "day" || requestedView === "week" ? requestedView : "month";
  if (view === "day") return { date, view, start: date, end: shiftCalendarDate(date, 1) };
  if (view === "week") {
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const start = shiftCalendarDate(date, -((weekday + 6) % 7));
    return { date, view, start, end: shiftCalendarDate(start, 7) };
  }
  const [year, month] = date.split("-").map(Number);
  return { date, view, start: `${date.slice(0, 7)}-01`, end: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10) };
}
