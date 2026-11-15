import { build as esbuildBuild, type BuildOptions, type BuildResult } from 'esbuild';

/** Match Vite's production environment when bundling isolated browser fixtures. */
export function build<T extends BuildOptions>(options: T): Promise<BuildResult<T>> {
  return esbuildBuild({ ...options, define: { 'import.meta.env.DEV': 'false', ...options.define } }) as Promise<BuildResult<T>>;
}
