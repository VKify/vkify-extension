/** Shared by the playlist downloader and catalog downloads. */
export function selectVideoDownloadFile(files: Record<string, unknown>, requested: number | 'best' = 'best'): { url: string; label: string } | null {
  const choices = Object.entries(files).flatMap(([key, url]) => /^mp4_\d+$/.test(key) && typeof url === 'string' && url
    ? [{ height: Number(key.slice(4)), url }] : []).sort((a, b) => b.height - a.height);
  const choice = requested === 'best' ? choices[0] : choices.find(file => file.height <= requested) || choices[choices.length - 1];
  return choice ? { url: choice.url, label: `${choice.height}p` } : null;
}
