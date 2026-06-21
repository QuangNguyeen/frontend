const RECONNECT_MAX_MS = 30_000;

export function getRecommendationReconnectDelay(attempt: number) {
  const exponential = Math.min(3_000 * 2 ** attempt, RECONNECT_MAX_MS);
  return Math.min(exponential + Math.random() * exponential * 0.2, RECONNECT_MAX_MS);
}
