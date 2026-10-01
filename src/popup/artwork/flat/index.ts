import ads from './ads-hero.svg?raw';
import appearance from './appearance-hero.svg?raw';
import automation from './automation-hero.svg?raw';
import center from './center-hero.svg?raw';
import css from './css-hero.svg?raw';
import hiding from './hiding-hero.svg?raw';
import more from './more-hero.svg?raw';
import notes from './notes-hero.svg?raw';
import privacy from './privacy-hero.svg?raw';
import spy from './spy-hero.svg?raw';
import widgets from './widgets-hero.svg?raw';

export const dashboardArtworks = {
  ads, appearance, automation, center, css, hiding, more, notes, privacy, spy, widgets,
} as const;

export type DashboardArtworkName = keyof typeof dashboardArtworks;
