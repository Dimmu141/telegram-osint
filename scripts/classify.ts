import { runClassification } from "../lib/classifier";

async function main() {
  console.log("[classify] Starting classification run");

  const result = await runClassification();

  console.log(`[classify] Done`);
  console.log(`  processed:  ${result.processed}`);
  console.log(`  failed:     ${result.failed}`);
  console.log(`  duration:   ${(result.durationMs / 1000).toFixed(1)}s`);

  if (result.failed > 0) {
    console.warn(`[classify] ${result.failed} messages failed — will retry next run`);
  }
}

main().catch((err) => {
  console.error("[classify] Fatal error:", err);
  process.exit(1);
});