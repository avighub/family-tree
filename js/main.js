(function (global) {
  'use strict';

  function boot() {
    var FT = global.FT;
    if (!FT || !FT.createUI) return;

    var state = FT.data.load();
    var ui = FT.createUI(state);
    ui.start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
