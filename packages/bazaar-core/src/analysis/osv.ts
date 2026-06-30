import type { RepoRef } from './repo-url.js';

/**
 * Free dependency-vulnerability scanning via OSV.dev (no API key required).
 * We read the repo's npm manifest from GitHub, then batch-query OSV for known
 * advisories affecting those dependency versions.
 */
export interface NpmDep {
  name: string;
  version: string;
}

export interface OsvResult {
  vulnerableCount: number;
  totalQueried: number;
  sampleIds: string[];
}

/** Extract a concrete-ish semver from an npm range (`^1.2.3` -> `1.2.3`). */
export function cleanVersion(range: string): string | null {
  const m = range.match(/\d+\.\d+\.\d+/);
  return m ? m[0] : null;
}

export function parseNpmManifest(pkgJson: string): NpmDep[] {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(pkgJson) as Record<string, unknown>;
  } catch {
    return [];
  }
  const deps: NpmDep[] = [];
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const obj = json[field];
    if (obj && typeof obj === 'object') {
      for (const [name, range] of Object.entries(obj as Record<string, string>)) {
        const version = cleanVersion(String(range));
        if (version) deps.push({ name, version });
      }
    }
  }
  return deps;
}

export async function fetchNpmManifest(ref: RepoRef, token?: string): Promise<NpmDep[] | null> {
  const res = await fetch(
    `https://api.github.com/repos/${ref.owner}/${ref.repo}/contents/package.json`,
    {
      headers: {
        Accept: 'application/vnd.github.raw+json',
        'User-Agent': 'sphere-agent-bazaar',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!res.ok) return null; // no manifest at repo root (non-npm or monorepo)
  return parseNpmManifest(await res.text());
}

export async function queryOsvNpm(deps: NpmDep[]): Promise<OsvResult> {
  const queries = deps.slice(0, 200).map((d) => ({
    package: { name: d.name, ecosystem: 'npm' },
    version: d.version,
  }));
  if (queries.length === 0) return { vulnerableCount: 0, totalQueried: 0, sampleIds: [] };

  const res = await fetch('https://api.osv.dev/v1/querybatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) return { vulnerableCount: 0, totalQueried: queries.length, sampleIds: [] };

  const data = (await res.json()) as { results?: Array<{ vulns?: Array<{ id: string }> }> };
  let vulnerableCount = 0;
  const sampleIds: string[] = [];
  for (const r of data.results ?? []) {
    if (r.vulns && r.vulns.length > 0) {
      vulnerableCount++;
      for (const v of r.vulns) if (sampleIds.length < 8) sampleIds.push(v.id);
    }
  }
  return { vulnerableCount, totalQueried: queries.length, sampleIds };
}

/** Best-effort end-to-end CVE scan; returns null when no npm manifest is found. */
export async function scanDependencies(ref: RepoRef, token?: string): Promise<OsvResult | null> {
  const manifest = await fetchNpmManifest(ref, token);
  if (!manifest || manifest.length === 0) return null;
  return queryOsvNpm(manifest);
}
