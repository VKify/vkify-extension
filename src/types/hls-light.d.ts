// `hls.js/light` is the trimmed build (no alternate-audio / subtitles / EME —
// none of which VK audio download needs) but ships no separate .d.ts. Its public
// API is a strict subset of the full build, so we reuse the full type
// declarations for it. Runtime resolves to dist/hls.light.mjs via package exports.
declare module 'hls.js/light' {
  export * from 'hls.js';
  export { default } from 'hls.js';
}
