(function () {
  var saved; try { saved = localStorage.getItem('sordex.lang'); } catch (e) {}
  var TITLES = { zh: 'SORDEX API 文档', en: 'SORDEX API Reference' };
  function set(lang) {
    document.body.classList.toggle('en', lang === 'en');
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
    document.title = TITLES[lang] || TITLES.zh;
    var btns = document.querySelectorAll('[data-lang-btn]');
    for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('on', btns[i].getAttribute('data-lang-btn') === lang);
    try { localStorage.setItem('sordex.lang', lang); } catch (e) {}
  }
  var btns = document.querySelectorAll('[data-lang-btn]');
  for (var i = 0; i < btns.length; i++) btns[i].onclick = function () { set(this.getAttribute('data-lang-btn')); };
  set(saved === 'en' ? 'en' : 'zh');
})();
