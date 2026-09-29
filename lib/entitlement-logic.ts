export function canAssignSubscription(activeSubscriptionCount: number) {
  return activeSubscriptionCount === 0;
}

export function usableCredits(status: string, endsAt: Date, availableCredits: number, now = new Date()) {
  return status === "active" && endsAt.getTime() > now.getTime() ? availableCredits : 0;
}

export function isSubscriptionExpired(endsAt: Date) {
  return endsAt.getTime() <= Date.now();
}

export function adjustedBalance(balance: number, amount: number) {
  const nextBalance = balance + amount;
  if (nextBalance < 0) throw new Error("NEGATIVE_CREDIT_BALANCE");
  return nextBalance;
}
