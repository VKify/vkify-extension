(function() {
  'use strict';
  
  try {
    // Пытаемся получить тему из localStorage (кэш)
    var cached = localStorage.getItem('vkify_theme_cache');
    var theme = 'light';
    
    if (cached === 'dark') {
      theme = 'dark';
    } else if (cached === 'light') {
      theme = 'light';
    } else if (cached === 'auto' || !cached) {
      // Auto или первый запуск - проверяем системную тему
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = prefersDark ? 'dark' : 'light';
    }
    
    // Применяем тему
    document.documentElement.setAttribute('data-theme', theme);
    
  } catch (e) {
    // Fallback на светлую тему
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();