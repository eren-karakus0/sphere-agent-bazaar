import type { RepoRef } from './repo-url.js';

/** Free, read-only metadata pulled from the public GitHub REST API. */
export interface RepoMeta {
  fullName: string;
  archived: boolean;
  disabled: boolean;
  pushedAt: string | null;
  createdAt: string | null;
  openIssues: number;
  stars: number;
  forks: number;
  license: string | null;
  defaultBranch: string;
  topics: string[];
}

interface GithubRepoResponse {
  full_name?: string;
  archived?: boolean;
  disabled?: boolean;
  pushed_at?: string;
  created_at?: string;
  open_issues_count?: number;
  stargazers_count?: number;
  forks_count?: number;
  license?: { spdx_id?: string } | null;
  default_branch?: string;
  topics?: string[];
}

export async function fetchRepoMeta(ref: RepoRef, token?: string): Promise<RepoMeta> {
  const res = await fetch(`https://api.github.com/repos/${ref.owner}/${ref.repo}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'sphere-agent-bazaar',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (res.status === 404) throw new Error(`repo not found: ${ref.owner}/${ref.repo}`);
  if (res.status === 403) throw new Error('github API rate-limited (set GITHUB_TOKEN to raise the limit)');
  if (!res.ok) throw new Error(`github API ${res.status}`);

  const j = (await res.json()) as GithubRepoResponse;
  return {
    fullName: j.full_name ?? `${ref.owner}/${ref.repo}`,
    archived: !!j.archived,
    disabled: !!j.disabled,
    pushedAt: j.pushed_at ?? null,
    createdAt: j.created_at ?? null,
    openIssues: j.open_issues_count ?? 0,
    stars: j.stargazers_count ?? 0,
    forks: j.forks_count ?? 0,
    license: j.license?.spdx_id && j.license.spdx_id !== 'NOASSERTION' ? j.license.spdx_id : null,
    defaultBranch: j.default_branch ?? 'main',
    topics: j.topics ?? [],
  };
}
