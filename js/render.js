(function (global) {
  'use strict';

  var FT = (global.FT = global.FT || {});

  function create(options) {
    var stage = options.stage;
    var art = options.art;
    var nodesLayer = options.nodes;
    var chipsLayer = options.chips;
    var artKey = null;

    function ensureArt(model) {
      var key = [
        model.world.w,
        model.world.h,
        model.photoSize,
        model.peopleCount,
        model.groundY,
        model.connectors
          .map(function (c) {
            return c.d;
          })
          .join('|')
      ].join('~');

      if (key === artKey) return;
      artKey = key;
      art.innerHTML = FT.art.build(model);
    }

    function makeNode() {
      var el = document.createElement('div');
      el.className = 'node';
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.innerHTML = [
        '<div class="node-inner">',
        '<div class="photo-wrap">',
        '<span class="stem" aria-hidden="true"></span>',
        '<button class="node-photo" type="button" tabindex="-1"></button>',
        '<button class="edit-dot" type="button" title="Change photo" aria-label="Change photo">✎</button>',
        '<span class="frame-badge" aria-hidden="true"></span>',
        '<span class="stickers" aria-hidden="true"></span>',
        '</div>',
        '<div class="tag"><span class="name"></span><span class="relation"></span></div>',
        '</div>'
      ].join('');
      return el;
    }

    function updatePhoto(button, person) {
      var img = button.querySelector('img');
      var placeholder = button.querySelector('.ph');

      if (person.photo) {
        if (placeholder) placeholder.remove();
        if (!img) {
          img = document.createElement('img');
          img.alt = '';
          img.draggable = false;
          button.appendChild(img);
        }
        if (img.getAttribute('src') !== person.photo) img.setAttribute('src', person.photo);
      } else {
        if (img) img.remove();
        if (!placeholder) {
          placeholder = document.createElement('span');
          placeholder.className = 'ph';
          button.appendChild(placeholder);
        }
        placeholder.textContent = person.emoji || '🙂';
      }
    }

    function updateStickers(container, person) {
      var list = person.stickers || [];
      var key = list.join('');
      if (container.dataset.key === key) return;
      container.dataset.key = key;
      container.innerHTML = '';
      list.forEach(function (symbol) {
        var span = document.createElement('span');
        span.textContent = symbol;
        container.appendChild(span);
      });
    }

    function updateNode(el, node, person, selectedId, model) {
      el.style.left = node.x + 'px';
      el.style.top = node.y - model.photoD / 2 + 'px';
      el.style.width = model.metrics.nodeW + 'px';
      el.dataset.gen = node.gen;
      el.dataset.unit = node.unitId;
      el.dataset.frame = person.frame || 'leaf';
      el.classList.toggle('selected', node.id === selectedId);
      el.setAttribute('aria-label', person.name + (person.relation ? ', ' + person.relation : ''));
      el.setAttribute('title', person.name);

      updatePhoto(el.querySelector('.node-photo'), person);
      updateStickers(el.querySelector('.stickers'), person);

      el.querySelector('.name').textContent = person.name;
      el.querySelector('.relation').textContent = person.relation || '';
    }

    function renderNodes(model, state, selectedId, options2) {
      var opts = options2 || {};
      var existing = new Map();
      Array.prototype.forEach.call(nodesLayer.children, function (child) {
        existing.set(child.dataset.id, child);
      });

      var seen = new Set();

      model.nodes.forEach(function (node) {
        var person = state.people[node.id];
        if (!person) return;

        var el = existing.get(node.id);
        if (!el) {
          el = makeNode();
          el.dataset.id = node.id;
          nodesLayer.appendChild(el);
          el.classList.add('enter');
          global.setTimeout(function () {
            el.classList.remove('enter');
          }, 620);
        } else if (el._removeTimer) {
          // Re-used before its leaf-fall finished (e.g. undo after delete).
          global.clearTimeout(el._removeTimer);
          el._removeTimer = null;
          el.classList.remove('leaving');
        }

        updateNode(el, node, person, selectedId, model);
        seen.add(node.id);
      });

      existing.forEach(function (el, id) {
        if (seen.has(id)) return;
        el.classList.add('leaving');
        el._removeTimer = global.setTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
          el._removeTimer = null;
        }, 420);
      });
    }

    function renderChips(model) {
      var existing = new Map();
      Array.prototype.forEach.call(chipsLayer.children, function (child) {
        existing.set(child.dataset.unit, child);
      });

      model.units.forEach(function (unit) {
        if (!unit.hasChildren) return;

        var el = existing.get(unit.id);
        if (!el) {
          el = document.createElement('button');
          el.type = 'button';
          el.className = 'chip';
          el.dataset.unit = unit.id;
          chipsLayer.appendChild(el);
        }

        el.style.left = unit.centerX + 'px';
        el.style.top = unit.y - model.photoD / 2 - 24 + 'px';
        el.textContent = unit.collapsed ? '＋' + unit.hiddenCount : '−';
        el.classList.toggle('collapsed', unit.collapsed);
        el.setAttribute(
          'aria-label',
          unit.collapsed ? 'Show ' + unit.hiddenCount + ' more family members' : 'Hide this branch'
        );
        el.setAttribute('title', unit.collapsed ? 'Show ' + unit.hiddenCount + ' more' : 'Hide this branch');

        existing.delete(unit.id);
      });

      existing.forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
      });
    }

    function render(model, state, selectedId, options2) {
      stage.style.width = model.world.w + 'px';
      stage.style.height = model.world.h + 'px';
      stage.style.setProperty('--photo', model.photoD + 'px');
      stage.style.setProperty('--node-w', model.metrics.nodeW + 'px');
      stage.style.setProperty('--scale', '1');

      art.setAttribute('viewBox', '0 0 ' + model.world.w + ' ' + model.world.h);
      art.setAttribute('width', model.world.w);
      art.setAttribute('height', model.world.h);

      ensureArt(model);
      renderNodes(model, state, selectedId, options2);
      renderChips(model);
    }

    function invalidateArt() {
      artKey = null;
    }

    return { render: render, invalidateArt: invalidateArt };
  }

  FT.render = { create: create };
})(typeof window !== 'undefined' ? window : globalThis);
