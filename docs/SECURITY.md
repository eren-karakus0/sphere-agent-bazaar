# Security

Sphere Agent Bazaar runs **autonomous agents that hold a wallet and move value**
on their own. That makes a few threat classes first-order concerns, so we treat
security as part of the design rather than an afterthought.

## Current posture (M1)

- **No secrets in the repository.** `.env` and `data/` (wallets, mnemonics,
  tokens) are gitignored. `.env.example` contains only the **public** testnet2
  gateway key, which the SDK documents as non-secret.
- **No dangerous sinks.** The first-party code contains no `eval`, `new Function`,
  `child_process`, or shell execution.
- **Safe money math.** All amounts are handled as smallest-unit strings / `BigInt`
  (via `parseTokenAmount` / `toHumanReadable`) — never JS floats.
- **Isolated identities.** Each agent uses its own wallet data directory and
  `deviceId`.
- **Known issue (low, upstream):** `npm audit` reports one low-severity advisory
  for `elliptic`, a transitive dependency of `@unicitylabs/sphere-sdk`. No patched
  version is published; it is outside our control and tracked for the SDK to fix.
- **Operational note:** a freshly generated mnemonic is printed once to the
  console so the operator can save it. Console logs are gitignored (`*.log`); do
  not ship raw agent logs to a public sink.

## Hardening requirements for the economy (M2)

These MUST be implemented alongside the fetch and payment logic, because that is
where untrusted input meets value transfer.

1. **Untrusted `repoUrl` → SSRF guard (high).** The analyst fetches data based on a
   `repoUrl` received over DM. Requests must be **host-allowlisted** to
   `github.com` / `api.github.com` and the `owner/repo` path strictly validated.
   Reject anything else (internal hosts, IPs, redirects).
2. **Treasury safety (high).** AlphaScout pays from a budget, so it must enforce:
   - a hard **total budget cap** and a **max price per job**;
   - **quote validation** — never pay a quote above the expected price;
   - **idempotency** — a job is paid at most once;
   - settlement only against a job it actually requested.
3. **Message validation (medium).** `parseBazaarMessage` currently checks only the
   `kind` discriminator. Before acting, every field must be validated (job id
   shape, positive numeric amounts, known service id).
4. **LLM prompt-injection containment (medium).** Repo-controlled text flows into
   the Gemini prompt. The model's output is used **only** as summary prose — it
   never drives payments, tool calls, or control flow.

## Reporting

This is a testnet hackathon project. For anything sensitive, open a private
report rather than a public issue.
