export const MINI_PLAYER_CSS = `
.vkify-mini {
  --mp-accent:var(--vkui--color_background_accent,#597cff);
  --mp-secondary:var(--vkui--color_text_secondary,#818c99);
  --mp-line:color-mix(in srgb,currentColor 9%,transparent);
  --mp-surface:color-mix(in srgb,currentColor 5%,transparent);
  box-sizing:border-box; container:mini-player / size;
  min-width:min(280px,100vw)!important; max-width:min(1200px,100vw)!important;
  border:1px solid var(--mp-line); border-radius:22px;
  background:color-mix(in srgb,var(--vkui--color_background_modal,#fff) 92%,transparent);
  backdrop-filter:blur(32px) saturate(1.3);
  box-shadow:0 24px 80px #0003,0 4px 14px #0001,inset 0 1px 0 #ffffff18;
}
.vkify-mini *, .vkify-mini *::before,.vkify-mini *::after { box-sizing:border-box; }
.vkify-mini .vkify-fw__body { padding:0 18px 16px; scrollbar-width:thin; position:relative; overflow:auto; }
.vkify-mini button:not(.vkify-fw__btn) { display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; cursor:pointer; color:inherit; border:0; padding:0; border-radius:10px; background:transparent; width:34px; height:34px; transition:background .16s,color .16s,transform .16s; }
.vkify-mini button:not(.vkify-fw__btn) svg { width:20px; height:20px; display:block; flex-shrink:0; }
.vkify-mini button:not(.vkify-fw__btn):hover { background:var(--mp-surface); }
.vkify-mini button:not(.vkify-fw__btn):active { transform:scale(.94); }
.vkify-mini button:not(.vkify-fw__btn):disabled { opacity:.28; cursor:default; transform:none; }
.vkify-mini button:not(.vkify-fw__btn).is-unavailable { opacity:.38; cursor:help; }
.vkify-mini button:not(.vkify-fw__btn)[aria-pressed=true]:not(.mp-play) { color:var(--mp-accent); background:color-mix(in srgb,var(--mp-accent) 12%,transparent); }
.vkify-mini :focus-visible { outline:2px solid var(--mp-accent); outline-offset:3px; }
.vkify-mini [hidden] { display:none!important; }
.vkify-mini a { color:inherit; text-decoration:none; }
.vkify-mini a:hover { color:var(--mp-accent); }
.vkify-mini .mp-content { position:relative; display:grid; grid-template-rows:minmax(64px,1fr) auto; gap:16px; height:100%; min-height:0; }
.vkify-mini .mp-art { position:relative; height:100%; width:auto; max-width:100%; aspect-ratio:1; justify-self:center; min-height:0; display:grid; place-items:center; border-radius:14px; overflow:hidden; isolation:isolate; background:radial-gradient(ellipse at 20% 10%,#8193c1,transparent 65%),linear-gradient(145deg,#616dab,#2b3157); box-shadow:0 10px 26px #0002,inset 0 0 0 1px #ffffff20; }
.vkify-mini .mp-art > svg { width:30%; height:30%; color:#ffffffb0; }
.vkify-mini .mp-art img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.vkify-mini .mp-glow { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; filter:blur(60px); opacity:.1; pointer-events:none; }
.vkify-mini .mp-main { min-width:0; align-self:center; width:100%; }
.vkify-mini .mp-metadata { margin-bottom:14px; min-width:0; }
.vkify-mini .mp-title { display:block; font-size:19px; line-height:1.3; letter-spacing:-.4px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vkify-mini .mp-artist { display:block; font-size:12px; line-height:1.5; color:var(--mp-secondary); margin-top:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vkify-mini input[type=range] { accent-color:var(--mp-accent); width:100%; height:16px; margin:0; cursor:pointer; display:block; }
.vkify-mini .mp-time { display:flex; justify-content:space-between; font-size:10px; line-height:16px; color:var(--mp-secondary); font-variant-numeric:tabular-nums; }
.vkify-mini .mp-transport { display:flex; justify-content:space-between; align-items:center; gap:6px; margin:10px 0; }
.vkify-mini .mp-transport button { width:36px; height:36px; }
.vkify-mini .mp-transport button svg { width:24px; height:24px; }
.vkify-mini .mp-transport .mp-play { width:52px; height:52px; border-radius:50%; background:var(--mp-accent); color:white; box-shadow:0 5px 14px color-mix(in srgb,var(--mp-accent) 25%,transparent); }
.vkify-mini .mp-play:hover { filter:brightness(1.08); }
.vkify-mini .mp-row { display:flex; gap:6px; align-items:center; padding:5px 0; }
.vkify-mini .mp-row input { min-width:25px; flex:1; margin-right:6px; }
.vkify-mini select { font:600 11px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; border:1px solid var(--mp-line); border-radius:8px; padding:5px 4px; color:inherit; background:var(--vkui--color_background_secondary,#eee); width:59px; flex-shrink:0; cursor:pointer; }
.vkify-mini .mp-tools { display:flex; align-items:center; justify-content:space-evenly; gap:6px; border-top:1px solid var(--mp-line); margin-top:8px; padding-top:8px; }
.vkify-mini .mp-tools button { width:36px; height:34px; }
.vkify-mini canvas { display:block; width:100%; height:20px; margin-top:8px; opacity:.6; }
.vkify-mini .mp-empty { height:100%; min-height:180px; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:16px; }
.vkify-mini .mp-empty > svg { width:56px; height:56px; color:var(--mp-accent); }
.vkify-mini .mp-empty strong { font-size:17px; }
.vkify-mini .mp-empty a { border-radius:10px; padding:9px 14px; background:var(--mp-surface); font-size:12px; }
.vkify-mini .mp-footer { margin-top:8px; max-height:150px; overflow:auto; scrollbar-width:thin; }
.vkify-mini .mp-next { display:flex; gap:10px; align-items:center; padding:10px; border-radius:12px; background:var(--mp-surface); }
.vkify-mini .mp-next > svg { color:var(--mp-secondary); width:20px; height:20px; flex-shrink:0; }
.vkify-mini .mp-next > div { min-width:0; }
.vkify-mini .mp-eyebrow { display:block; font-size:9px; line-height:14px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:var(--mp-secondary); }
.vkify-mini .mp-next-title,.vkify-mini .mp-next-artist { display:block; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
.vkify-mini .mp-next-title { font-size:12px; line-height:18px; font-weight:600; }
.vkify-mini .mp-next-artist { font-size:10px; line-height:16px; color:var(--mp-secondary); }
.vkify-mini .mp-history { font-size:11px; color:var(--mp-secondary); }
.vkify-mini .mp-history summary { cursor:pointer; padding:8px 2px; display:flex; align-items:center; gap:7px; list-style:none; }
.vkify-mini .mp-history summary svg { width:15px; height:15px; }
.vkify-mini .mp-history a { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; padding:6px 4px; }
.vkify-mini .mp-compact { display:none; align-items:center; gap:10px; min-width:0; flex:1; }
.vkify-mini .mp-thumb-box { width:48px; height:48px; flex-shrink:0; display:grid; place-items:center; position:relative; border-radius:11px; overflow:hidden; background:linear-gradient(135deg,#6479af,#38254e); color:white; }
.vkify-mini .mp-thumb { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.vkify-mini .mp-copy { flex:1; min-width:0; overflow:hidden; font-size:12px; line-height:18px; }
.vkify-mini .mp-copy span { display:block; white-space:nowrap; width:max-content; }
.vkify-mini .mp-copy small { color:var(--mp-secondary); display:block; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
.vkify-mini .mp-compact-controls { display:flex; align-items:center; gap:2px; flex-shrink:0; }
.vkify-mini .mp-compact-controls button { width:32px; height:32px; }
.vkify-mini .mp-compact-controls button svg { width:18px; height:18px; }
.vkify-mini.is-collapsed { container-type:inline-size; max-width:min(420px,100vw)!important; }
.vkify-mini.is-collapsed .mp-copy.is-overflow span { animation:mp-marquee 8s linear infinite alternate; }
.vkify-mini.is-collapsed .mp-compact { display:flex; }
.vkify-mini.is-collapsed .vkify-fw__title,.vkify-mini.is-collapsed .vkify-fw__grip { display:none; }
.vkify-mini.is-collapsed .vkify-fw__aux { margin:0; flex:1; }
.vkify-mini.is-collapsed .mp-pin,.vkify-mini.is-collapsed .mp-mode { display:none; }
.vkify-mini .mp-thin { display:none; height:3px; width:100%; position:absolute; bottom:0; left:0; accent-color:var(--mp-accent); border:0; }
.vkify-mini.is-collapsed .mp-thin { display:block; }
.vkify-mini.is-pill.is-collapsed { width:240px!important; min-width:240px!important; border-radius:36px; }
.vkify-mini.is-pill.is-collapsed .mp-copy { display:none; }
.vkify-mini.is-pinned { z-index:2147483647!important; }
.vkify-mini .vkify-dl-status { font-size:10px; margin:6px 0 0; }
@container mini-player (min-width:520px) {
  .vkify-mini .mp-content { grid-template-columns:minmax(140px,1fr) minmax(250px,1fr); grid-template-rows:1fr; gap:24px; align-items:center; }
  .vkify-mini .mp-art { width:100%; height:auto; max-height:100%; }
  .vkify-mini .mp-title { font-size:22px; }
}
@container mini-player (max-height:480px) {
  .vkify-mini .mp-content { grid-template-columns:minmax(64px,.65fr) minmax(220px,1fr); grid-template-rows:1fr; gap:16px; align-items:center; }
  .vkify-mini .mp-art { width:100%; height:auto; max-height:100%; }
  .vkify-mini .mp-footer,.vkify-mini canvas { display:none; }
  .vkify-mini .mp-title { font-size:17px; }
}
@container mini-player (max-width:420px) and (max-height:480px) {
  .vkify-mini .mp-content { display:block; }
  .vkify-mini .mp-art { width:48px; height:48px; float:left; margin:0 12px 12px 0; border-radius:10px; }
  .vkify-mini .mp-main { display:contents; }
  .vkify-mini .mp-metadata { height:48px; padding-top:4px; margin-bottom:12px; }
  .vkify-mini .mp-timeline { clear:both; }
}
@container mini-player (min-height:800px) and (min-width:520px) {
  .vkify-mini .mp-content { grid-template-columns:1fr; grid-template-rows:minmax(120px,1fr) auto; }
  .vkify-mini .mp-art { height:100%; width:auto; }
  .vkify-mini .mp-main { max-width:580px; justify-self:center; }
}
@container mini-player (max-height:340px) {
  .vkify-mini .mp-metadata { margin-bottom:8px; }
  .vkify-mini .mp-transport { margin:6px 0; }
  .vkify-mini .mp-transport .mp-play { width:44px; height:44px; }
  .vkify-mini .mp-row { padding:0; }
  .vkify-mini .mp-tools { margin-top:4px; padding-top:4px; }
  .vkify-mini .mp-tools button { height:30px; }
}
.vkify-mini input[type=range] { appearance:none; -webkit-appearance:none; background:transparent; }
.vkify-mini input[type=range]::-webkit-slider-runnable-track { height:3px; border-radius:9px; background:linear-gradient(to right,var(--mp-accent) var(--mp-progress,0%),var(--mp-line) var(--mp-progress,0%)); }
.vkify-mini input[type=range]::-moz-range-track { height:3px; border-radius:9px; background:var(--mp-line); }
.vkify-mini input[type=range]::-moz-range-progress { height:3px; background:var(--mp-accent); }
.vkify-mini input[type=range]::-webkit-slider-thumb { appearance:none; width:9px; height:9px; margin-top:-3px; border-radius:50%; background:var(--mp-accent); }
.vkify-mini input[type=range]::-moz-range-thumb { width:9px; height:9px; border:0; border-radius:50%; background:var(--mp-accent); }
@keyframes mp-marquee { to { transform:translateX(-35%); } }
@media(prefers-reduced-motion:reduce) { .vkify-mini,.vkify-mini * { animation:none!important; transition:none!important; } }
`;
