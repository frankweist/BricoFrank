// Tema antes del primer pintado
(function bootstrapTheme(){
  try {
    const key = 'gr_dark';
    if (localStorage.getItem(key) == null) localStorage.setItem(key,'1'); // default oscuro
    const dark = localStorage.getItem(key) === '1';
    const root = document.documentElement;
    if (dark) root.classList.add('dark'); else root.classList.remove('dark');
  } catch {}
})();

