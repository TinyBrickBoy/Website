// Läuft im <head>, bevor gezeichnet wird: JS-Klasse und gespeichertes Farbschema setzen.
(function () {
  var root = document.documentElement, theme = null;
  root.classList.add('js');
  try { theme = localStorage.getItem('theme'); } catch (e) {}
  if (theme === 'dark' || (!theme && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)) {
    root.classList.add('dark');
  }
})();
