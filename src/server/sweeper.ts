const globalState = globalThis as typeof globalThis & { __gzSweeper?: boolean };

export function startSweeper() {
  if (globalState.__gzSweeper) return;
  globalState.__gzSweeper = true;
  setInterval(() => {
    import("@/services/sweep-service")
      .then(({ sweepExpiredSessions }) => sweepExpiredSessions())
      .catch((error) => {
        console.error("Session sweep failed", error);
      });
  }, 30_000);
}
