export const FIREFOX_INSTALL_URL = 'https://vkify.ru/firefox';
export const RELEASE_API_URL = 'https://api.github.com/repos/VKify/vkify-extension/releases/latest';

export interface ExtensionUpdate {
  currentVersion: string;
  latestVersion: string;
  available: boolean;
  checkedAt: number;
}

export function parseVersion(value: string): number[] | null {
  const version = value.replace(/^v/i, '');
  return /^\d+(?:\.\d+){0,3}$/.test(version) ? version.split('.').map(Number) : null;
}

export function isNewerVersion(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export function readReleaseVersion(value: unknown): string {
  const release = value as { tag_name?: unknown; draft?: boolean; prerelease?: boolean; assets?: { name?: string }[] } | null;
  if (!release || release.draft || release.prerelease || typeof release.tag_name !== 'string'
    || !parseVersion(release.tag_name) || !Array.isArray(release.assets)
    || !release.assets.some(asset => typeof asset.name === 'string' && asset.name.endsWith('.xpi'))) {
    throw new Error('No installable Firefox release');
  }
  return release.tag_name.replace(/^v/i, '');
}
