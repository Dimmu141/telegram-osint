import {
  loadChannelsFromYaml,
  runScrape,
  type ChannelConfig,
} from "../lib/telegram-scraper";

function uniqueChannels(channels: ChannelConfig[]): ChannelConfig[] {
  const seen = new Set<string>();
  const merged: ChannelConfig[] = [];

  for (const channel of channels) {
    if (seen.has(channel.handle)) continue;
    seen.add(channel.handle);
    merged.push(channel);
  }

  return merged;
}

async function main() {
  const args = process.argv.slice(2);
  const triggeredByArg = args.find((a) => a.startsWith("--triggered-by="));
  const triggeredBy = triggeredByArg?.split("=")[1] ?? "cli";
  const baseChannels = loadChannelsFromYaml();
  const expansionChannels = loadChannelsFromYaml("config/russian-expansion.yaml");
  const channels = uniqueChannels([...baseChannels, ...expansionChannels]);

  console.log(`[scrape] Starting run, triggered by: ${triggeredBy}`);
  console.log(`[scrape] Loaded ${channels.length} channel(s) from base + expansion configs`);
  const result = await runScrape({ triggeredBy, channels });

  console.log(`[scrape] Run ${result.runId} complete`);
  console.log(`  duration:   ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`  attempted:  ${result.channelsAttempted}`);
  console.log(`  succeeded:  ${result.channelsSucceeded}`);
  console.log(`  failed:     ${result.channelsFailed}`);
  console.log(`  new msgs:   ${result.newMessages}`);

  const errors = result.perChannel.filter((r) => r.error);
  if (errors.length > 0) {
    console.log(`\n[scrape] Errors:`);
    for (const e of errors) {
      console.log(`  ${e.handle.padEnd(30)} ${e.error}`);
    }
  }

  const failureRate =
    result.channelsFailed / Math.max(1, result.channelsAttempted);
  if (failureRate > 0.33) {
    console.error(
      `\n[scrape] Failure rate ${(failureRate * 100).toFixed(0)}% — exiting with error`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[scrape] Fatal error:", err);
  process.exit(1);
});
