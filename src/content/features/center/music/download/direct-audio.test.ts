import { expect, it } from 'vitest';
import { detectAudioFile } from './direct-audio.js';

it.each([
  ['ID3\x04\0\0\0\0\0\0\xff\xfb\x90', 'mp3'],
  ['\xff\xfb\x90\0' + '\0'.repeat(12), 'mp3'],
  ['\xff\xf1\x50\0' + '\0'.repeat(12), 'aac'],
  ['\0\0\0\x18ftypM4A ' + '\0'.repeat(12), 'm4a'],
  ['RIFF\0\0\0\0WAVEdata', 'wav'],
  ['OggS' + '\0'.repeat(12), 'ogg'],
])('recognizes direct audio by its bytes (%s)', (data, ext) => {
  expect(detectAudioFile(Uint8Array.from(data, char => char.charCodeAt(0)))?.ext).toBe(ext);
});

it.each(['', '#EXTM3U\n#EXTINF:10,', '<!doctype html><html>Denied</html>', '{"error":"login required"}', '\xff\xff\xff\xff' + '\0'.repeat(12)])('does not treat non-audio as a downloadable file', data => {
  expect(detectAudioFile(Uint8Array.from(data, char => char.charCodeAt(0)))).toBeNull();
});
