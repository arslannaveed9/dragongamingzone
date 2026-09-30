export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startSweeper } = await import("@/server/sweeper");
  startSweeper();
}
