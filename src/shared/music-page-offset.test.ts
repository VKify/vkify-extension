import { expect, it } from 'vitest';
import { withMusicPageOffset, MUSIC_OFFSET_STATE } from './music-page-offset.js';
import { lyricsPreset } from './music-lyrics.js';
import { visualizerPreset } from './music-visualizer.js';
const json=JSON.stringify;
const apply=(state:Record<string,unknown>,patch:Record<string,unknown>)=>({...state,...withMusicPageOffset(state,patch)});
const start={page_offset_enabled:false,page_offset_value:50};
it.each(['disable','widget','automatic off'])('restores a centered page after %s', action=>{
 let s=apply(start,{music_lyrics:true,music_lyrics_settings:json(lyricsPreset('stage'))});
 expect(s.page_offset_value).toBe(0);expect(s.page_offset_enabled).toBe(true);
 const value=lyricsPreset('stage');
 s=apply(s,action==='disable'?{music_lyrics:false}:{music_lyrics_settings:json({...value,...(action==='widget'?{output:'widget'}:{lyricsAvoidContent:false})})});
 expect(s.page_offset_enabled).toBe(false);expect(s.page_offset_value).toBe(50);expect(s[MUSIC_OFFSET_STATE]).toBe('');
});
it('restores a saved manual position, including after serializing state',()=>{
 const baseline={page_offset_enabled:true,page_offset_value:73};
 const s=apply(baseline,{music_visualizer:true,music_visualizer_settings:json(visualizerPreset('portal'))});
 const restored=apply(JSON.parse(json(s)),{music_visualizer_settings:json(visualizerPreset('silk'))});
 expect(restored).toMatchObject(baseline);
});
it('keeps the other consumer active and restores only when both release',()=>{
 let s=apply(start,{music_lyrics:true,music_visualizer:true,music_lyrics_settings:json(lyricsPreset('stage')),music_visualizer_settings:json({...visualizerPreset('orbit'),offsetX:-20})});
 expect(s.page_offset_value).toBe(0);
 s=apply(s,{music_lyrics:false});expect(s.page_offset_value).toBe(100);expect(s.page_offset_enabled).toBe(true);
 s=apply(s,{music_visualizer:false});expect(s.page_offset_enabled).toBe(false);expect(s.page_offset_value).toBe(50);
});
it('respects manual Appearance changes and disables competing automation',()=>{
 let s=apply(start,{music_lyrics:true,music_lyrics_settings:json(lyricsPreset('stage'))});
 s=apply(s,{page_offset_value:65});
 expect(JSON.parse(String(s.music_lyrics_settings)).lyricsAvoidContent).toBe(false);
 s=apply(s,{music_lyrics:false});expect(s.page_offset_value).toBe(65);expect(s.page_offset_enabled).toBe(true);
});
it('does not move the page for a disabled feature or widget preset',()=>{
 expect(apply(start,{music_lyrics_settings:json(lyricsPreset('stage'))})).toMatchObject(start);
 expect(apply(start,{music_visualizer:true,music_visualizer_settings:json({...visualizerPreset('portal'),output:'widget'})})).toMatchObject(start);
});
it('does not undo an external manual writer when releasing ownership',()=>{
 const s=apply(start,{music_lyrics:true,music_lyrics_settings:json(lyricsPreset('stage'))});
 expect(apply({...s,page_offset_value:80},{music_lyrics:false}).page_offset_value).toBe(80);
});

it('releases the side column for bottom subtitles and reacquires it for centered lyrics',()=>{
 let s=apply(start,{music_lyrics:true,music_lyrics_settings:json(lyricsPreset('stage'))});
 s=apply(s,{music_lyrics_settings:json(lyricsPreset('cinema'))});
 expect(s).toMatchObject(start);
 s=apply(s,{music_lyrics_settings:json(lyricsPreset('minimal'))});
 expect(s.page_offset_value).toBe(0);expect(s.page_offset_enabled).toBe(true);
});
