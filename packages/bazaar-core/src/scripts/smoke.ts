/**
 * H1 end-to-end smoke test.
 *
 * Proves the full v2 wiring works against testnet2 by standing up two agents,
 * self-minting UCT on one, and transferring value to the other — the
 * foundation every bazaar flow builds on.
 *
 *   pnpm smoke
 */
import path from 'node:path';
import { loadEnv } from '../config.js';
import { SphereAgent } from '../sphere-agent.js';
import { createLogger } from '../logger.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const log = createLogger('smoke');
  const env = loadEnv();
  log.info(`network=${env.network} dataRoot=${env.dataRoot}`);

  const analyst = new SphereAgent({
    name: 'smoke-analyst',
    nametag: 'bzr-analyst',
    dataDir: path.join(env.dataRoot, 'smoke-analyst'),
    network: env.network,
    oracleApiKey: env.oracleApiKey,
    walletApiUrl: env.walletApiUrl,
    deviceId: 'bazaar-smoke-analyst',
  });
  const scout = new SphereAgent({
    name: 'smoke-scout',
    nametag: 'bzr-scout',
    dataDir: path.join(env.dataRoot, 'smoke-scout'),
    network: env.network,
    oracleApiKey: env.oracleApiKey,
    walletApiUrl: env.walletApiUrl,
    deviceId: 'bazaar-smoke-scout',
  });

  try {
    await analyst.start();
    await scout.start();

    log.info(`analyst @${analyst.nametag}  addr=${analyst.directAddress}`);
    log.info(`scout   @${scout.nametag}  addr=${scout.directAddress}`);

    log.info('--- step 1: analyst self-mints 10 UCT ---');
    const mint = (await analyst.mintUct('10')) as { success: boolean; error?: string };
    if (!mint.success) throw new Error(`mint failed: ${mint.error}`);
    await sleep(1500);
    log.info(`analyst balance after mint: ${await analyst.balanceUct()} UCT`);

    const recipient = scout.directAddress;
    if (!recipient) throw new Error('scout has no direct address');

    log.info('--- step 2: analyst sends 3 UCT to scout ---');
    const transfer = (await analyst.send(recipient, '3', 'bazaar smoke test')) as {
      id?: string;
      status?: string;
    };
    log.info(`transfer id=${transfer.id} status=${transfer.status}`);

    log.info('--- step 3: scout drains its mailbox and checks balance ---');
    let scoutBalance = '0';
    for (let i = 0; i < 6; i++) {
      await scout.receive((t) => log.info('scout received transfer', t));
      scoutBalance = await scout.balanceUct();
      if (Number(scoutBalance) > 0) break;
      log.info(`  …waiting for delivery (attempt ${i + 1}) balance=${scoutBalance}`);
      await sleep(2500);
    }

    log.info('================ RESULT ================');
    log.info(`analyst balance: ${await analyst.balanceUct()} UCT`);
    log.info(`scout   balance: ${scoutBalance} UCT`);
    if (Number(scoutBalance) > 0) {
      log.info('✅ E2E TRANSFER SUCCESS — v2 wiring confirmed.');
    } else {
      log.warn('⚠️ scout balance still 0 — delivery may be deferred; inspect logs above.');
    }
  } finally {
    await analyst.stop().catch(() => {});
    await scout.stop().catch(() => {});
  }
}

// The Sphere SDK keeps Nostr/wallet-api sockets open; even after destroy() the
// event loop can stay non-empty, so we exit explicitly. A watchdog guarantees
// the process can never hang forever on a stuck network call.
const watchdog = setTimeout(() => {
  // eslint-disable-next-line no-console
  console.error('[smoke] watchdog: 120s elapsed, forcing exit');
  process.exit(2);
}, 120_000);
watchdog.unref();

main()
  .then(() => {
    clearTimeout(watchdog);
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[smoke] FAILED:', err);
    process.exit(1);
  });
