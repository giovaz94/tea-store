export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function calculateSleepTime(mcl: number, delay?: number): number {
  const definedDelay = delay || 1;
  return definedDelay / mcl;
}
