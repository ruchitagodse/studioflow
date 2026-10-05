/** Presentation-only format for a studio-local date stored as YYYY-MM-DD. */
export function displayCustomerDate(localDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return localDate || "—";
  const [, year, month, day] = match;
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1];
  return monthName ? `${day} ${monthName} ${year.slice(-2)}` : localDate;
}
