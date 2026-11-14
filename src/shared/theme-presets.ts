export interface Theme {
  id: string;
  name: string;
  color: string;
  accent: string;
  category: string;
}

export const THEMES: readonly Theme[] = Object.freeze([
  { id: 'default', name: 'По умолчанию', color: '', accent: '', category: 'standard' },

  { id: 'github-dark', name: 'GitHub Dark', color: '#0d1117', accent: '#58a6ff', category: 'classic' },
  { id: 'vscode-dark', name: 'VS Code', color: '#1e1e1e', accent: '#007acc', category: 'classic' },
  { id: 'one-dark', name: 'One Dark', color: '#282c34', accent: '#61afef', category: 'classic' },
  { id: 'dracula', name: 'Dracula', color: '#282a36', accent: '#bd93f9', category: 'classic' },
  { id: 'monokai', name: 'Monokai', color: '#272822', accent: '#f92672', category: 'classic' },
  { id: 'nord', name: 'Nord', color: '#2e3440', accent: '#88c0d0', category: 'classic' },
  { id: 'tokyo-night', name: 'Tokyo Night', color: '#1a1b26', accent: '#7aa2f7', category: 'classic' },
  { id: 'material', name: 'Material', color: '#212121', accent: '#82aaff', category: 'classic' },
  { id: 'atom-one', name: 'Atom One Dark', color: '#21252b', accent: '#528bff', category: 'classic' },
  { id: 'sublime', name: 'Sublime Monokai', color: '#272822', accent: '#66d9ef', category: 'classic' },

  { id: 'mocha', name: 'Catppuccin Mocha', color: '#1e1e2e', accent: '#cba6f7', category: 'soft' },
  { id: 'macchiato', name: 'Catppuccin Macchiato', color: '#24273a', accent: '#c6a0f6', category: 'soft' },
  { id: 'frappe', name: 'Catppuccin Frappé', color: '#303446', accent: '#ca9ee6', category: 'soft' },
  { id: 'rose-pine', name: 'Rosé Pine', color: '#191724', accent: '#ebbcba', category: 'soft' },
  { id: 'rose-pine-moon', name: 'Rosé Pine Moon', color: '#232136', accent: '#ea9a97', category: 'soft' },
  { id: 'gruvbox', name: 'Gruvbox', color: '#282828', accent: '#fabd2f', category: 'soft' },
  { id: 'solarized', name: 'Solarized Dark', color: '#002b36', accent: '#268bd2', category: 'soft' },
  { id: 'everforest', name: 'Everforest', color: '#2d353b', accent: '#a7c080', category: 'soft' },
  { id: 'kanagawa', name: 'Kanagawa', color: '#1f1f28', accent: '#7e9cd8', category: 'soft' },
  { id: 'gruvbox-material', name: 'Gruvbox Material', color: '#1d2021', accent: '#d8a657', category: 'soft' },
  { id: 'seoul256', name: 'Seoul256', color: '#3a3a3a', accent: '#87afaf', category: 'soft' },
  { id: 'tender', name: 'Tender', color: '#282828', accent: '#b3deef', category: 'soft' },

  { id: 'amoled-white', name: 'AMOLED', color: '#000000', accent: '#ffffff', category: 'amoled' },
  { id: 'amoled-blue', name: 'AMOLED Blue', color: '#000000', accent: '#0077ff', category: 'amoled' },
  { id: 'amoled-purple', name: 'AMOLED Purple', color: '#000000', accent: '#a855f7', category: 'amoled' },
  { id: 'amoled-green', name: 'AMOLED Green', color: '#000000', accent: '#22c55e', category: 'amoled' },
  { id: 'amoled-red', name: 'AMOLED Red', color: '#000000', accent: '#ef4444', category: 'amoled' },
  { id: 'amoled-orange', name: 'AMOLED Orange', color: '#000000', accent: '#f97316', category: 'amoled' },
  { id: 'midnight', name: 'Midnight', color: '#0a0a0f', accent: '#6366f1', category: 'amoled' },
  { id: 'amoled-cyan', name: 'AMOLED Cyan', color: '#000000', accent: '#06b6d4', category: 'amoled' },
  { id: 'amoled-pink', name: 'AMOLED Pink', color: '#000000', accent: '#ec4899', category: 'amoled' },
  { id: 'amoled-gold', name: 'AMOLED Gold', color: '#000000', accent: '#fbbf24', category: 'amoled' },

  { id: 'night-owl', name: 'Night Owl', color: '#011627', accent: '#7fdbca', category: 'colored' },
  { id: 'cobalt2', name: 'Cobalt2', color: '#193549', accent: '#ffc600', category: 'colored' },
  { id: 'synthwave', name: 'Synthwave', color: '#262335', accent: '#ff7edb', category: 'colored' },
  { id: 'palenight', name: 'Palenight', color: '#292d3e', accent: '#c792ea', category: 'colored' },
  { id: 'ayu-dark', name: 'Ayu Dark', color: '#0a0e14', accent: '#ffb454', category: 'colored' },
  { id: 'ayu-mirage', name: 'Ayu Mirage', color: '#1f2430', accent: '#ffcc66', category: 'colored' },
  { id: 'shades-of-purple', name: 'Shades of Purple', color: '#2d2b55', accent: '#fad000', category: 'colored' },
  { id: 'horizon', name: 'Horizon', color: '#1c1e26', accent: '#e95678', category: 'colored' },
  { id: 'oceanic', name: 'Oceanic Next', color: '#1b2b34', accent: '#6699cc', category: 'colored' },
  { id: 'moonlight', name: 'Moonlight II', color: '#212337', accent: '#82aaff', category: 'colored' },
  { id: 'city-lights', name: 'City Lights', color: '#1d252c', accent: '#5ec4ff', category: 'colored' },

  { id: 'neon-pink', name: 'Neon Pink', color: '#1a0a1f', accent: '#ff00ff', category: 'neon' },
  { id: 'neon-cyan', name: 'Neon Cyan', color: '#0a1a1f', accent: '#00ffff', category: 'neon' },
  { id: 'neon-green', name: 'Neon Green', color: '#0f1a0a', accent: '#39ff14', category: 'neon' },
  { id: 'cyberpunk', name: 'Cyberpunk', color: '#0d0221', accent: '#f72585', category: 'neon' },
  { id: 'outrun', name: 'Outrun', color: '#2b1b3d', accent: '#f233c6', category: 'neon' },
  { id: 'vapor', name: 'Vaporwave', color: '#1a0933', accent: '#ff71ce', category: 'neon' },

  { id: 'forest', name: 'Forest', color: '#1a2421', accent: '#5fb381', category: 'nature' },
  { id: 'ocean', name: 'Ocean Deep', color: '#0c1e2e', accent: '#4a90e2', category: 'nature' },
  { id: 'sunset', name: 'Sunset', color: '#2a1a1f', accent: '#ff6b6b', category: 'nature' },
  { id: 'aurora', name: 'Aurora', color: '#0e1c26', accent: '#00d9ff', category: 'nature' },
  { id: 'desert', name: 'Desert Night', color: '#1f1a14', accent: '#e6a157', category: 'nature' },
  { id: 'sakura', name: 'Sakura', color: '#2a1f28', accent: '#ffb7d5', category: 'nature' },
  { id: 'moss', name: 'Moss', color: '#18251b', accent: '#a3c975', category: 'nature' },
  { id: 'lagoon', name: 'Lagoon', color: '#102727', accent: '#5ed6bc', category: 'nature' },

  { id: 'minimal-gray', name: 'Minimal Gray', color: '#1a1a1a', accent: '#e0e0e0', category: 'minimal' },
  { id: 'minimal-slate', name: 'Minimal Slate', color: '#1e293b', accent: '#94a3b8', category: 'minimal' },
  { id: 'minimal-zinc', name: 'Minimal Zinc', color: '#18181b', accent: '#a1a1aa', category: 'minimal' },
  { id: 'monochrome', name: 'Monochrome', color: '#0f0f0f', accent: '#d4d4d4', category: 'minimal' },

  { id: 'terminal-green', name: 'Terminal Green', color: '#0c0c0c', accent: '#33ff33', category: 'retro' },
  { id: 'terminal-amber', name: 'Terminal Amber', color: '#0c0c0c', accent: '#ffb000', category: 'retro' },
  { id: 'commodore-64', name: 'Commodore 64', color: '#3e31a2', accent: '#7a71f6', category: 'retro' },
  { id: 'apple-ii', name: 'Apple II', color: '#000000', accent: '#00ff00', category: 'retro' },
  { id: 'dos', name: 'MS-DOS', color: '#000000', accent: '#00aaaa', category: 'retro' },

  { id: 'warm-coffee', name: 'Coffee', color: '#1a1410', accent: '#c7956d', category: 'warm' },
  { id: 'warm-ember', name: 'Ember', color: '#1f1410', accent: '#ff6b35', category: 'warm' },
  { id: 'warm-honey', name: 'Honey', color: '#1a1510', accent: '#ffa94d', category: 'warm' },
  { id: 'warm-autumn', name: 'Autumn', color: '#1f1712', accent: '#d4722c', category: 'warm' },
  { id: 'warm-terracotta', name: 'Terracotta', color: '#291b18', accent: '#e99b7e', category: 'warm' },
  { id: 'warm-rose-gold', name: 'Rose Gold', color: '#291d23', accent: '#e8b4a0', category: 'warm' },

  { id: 'cool-ice', name: 'Ice', color: '#0f1419', accent: '#95e1d3', category: 'cool' },
  { id: 'cool-arctic', name: 'Arctic', color: '#0e1621', accent: '#88c0d0', category: 'cool' },
  { id: 'cool-frost', name: 'Frost', color: '#101820', accent: '#a8dadc', category: 'cool' },
  { id: 'cool-winter', name: 'Winter Night', color: '#0d1b2a', accent: '#8ecae6', category: 'cool' },
  { id: 'cool-glacier', name: 'Glacier', color: '#15232e', accent: '#a5d8ed', category: 'cool' },
  { id: 'cool-blueberry', name: 'Blueberry', color: '#201c35', accent: '#b4a0ed', category: 'cool' },
]);
