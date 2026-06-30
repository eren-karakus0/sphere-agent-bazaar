/**
 * Repo URL parsing with an SSRF guard (security requirement M2.1).
 *
 * Input arrives over untrusted DMs, and the analyzer turns it into outbound
 * HTTP requests — so we strictly allowlist GitHub and validate owner/repo
 * before any network call is made.
 */
export interface RepoRef {
  owner: string;
  repo: string;
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const ALLOWED_HOSTS = new Set(['github.com', 'www.github.com']);

export function parseRepoUrl(input: string): RepoRef {
  const raw = (input ?? '').trim();
  if (!raw) throw new Error('empty repo reference');

  let owner: string | undefined;
  let repo: string | undefined;

  // Shorthand: "owner/repo" (no scheme, exactly one slash).
  if (!raw.includes('://') && /^[^/\s]+\/[^/\s]+$/.test(raw)) {
    [owner, repo] = raw.split('/');
  } else {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new Error(`invalid repo URL: ${raw}`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error(`unsupported protocol: ${url.protocol}`);
    }
    const host = url.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(host)) {
      throw new Error(`host not allowed (only github.com): ${host}`);
    }
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) throw new Error(`not a repo path: ${url.pathname}`);
    [owner, repo] = parts;
  }

  repo = repo?.replace(/\.git$/, '');
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo)) {
    throw new Error(`invalid owner/repo: ${owner}/${repo}`);
  }
  return { owner, repo };
}
