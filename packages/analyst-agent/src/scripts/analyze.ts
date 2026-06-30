/**
 * Standalone demo of the analyst's brain — no wallet, no network economy.
 * Analyzes a real GitHub repo and prints the risk report.
 *
 *   pnpm --filter @bazaar/analyst-agent analyze <owner/repo | github url>
 */
import 'dotenv/config';
import { loadEnv, analyzeRepo } from '@bazaar/core';

async function main(): Promise<void> {
  const target = process.argv[2] ?? 'unicitynetwork/state-transition-sdk-js';
  const env = loadEnv();
   
  console.log(`Analyzing ${target}…`);
  const report = await analyzeRepo(target, { githubToken: env.githubToken, gemini: env.gemini });
   
  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
     
    console.error('analyze failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
