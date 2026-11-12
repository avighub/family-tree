(function (global) {
  'use strict';

  var FT = (global.FT = global.FT || {});

  var PHOTO = { s: 110, m: 150, l: 200 };
  var NODE_EXTRA_W = 56;
  var LABEL_H = 64;
  var COUPLE_GAP = 28;
  var SIBLING_GAP = 54;
  var LEVEL_EXTRA = 192;
  var PAD_X = 120;
  var PAD_TOP = 150;
  var ROOT_SPACE = 320;

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function computeGenerations(people) {
    var gen = {};
    var visiting = {};
    var ids = Object.keys(people);

    function visit(id) {
      if (Object.prototype.hasOwnProperty.call(gen, id)) return gen[id];
      if (visiting[id]) return 0;
      visiting[id] = true;
      var p = people[id];
      var g = 0;
      var parents = (p && p.parentIds) || [];
      for (var i = 0; i < parents.length; i++) {
        var pid = parents[i];
        if (people[pid]) {
          var pg = visit(pid);
          if (pg + 1 > g) g = pg + 1;
        }
      }
      visiting[id] = false;
      gen[id] = g;
      return g;
    }

    for (var i = 0; i < ids.length; i++) visit(ids[i]);

    // People who married into the family have no parents, so give them their
    // partner's generation instead of dumping them at the roots.
    var changed = true;
    var guard = 0;
    while (changed && guard < 24) {
      changed = false;
      guard++;
      for (var k = 0; k < ids.length; k++) {
        var id = ids[k];
        var person = people[id];
        if (person.parentIds && person.parentIds.length) continue;
        var partners = person.partnerIds || [];
        for (var j = 0; j < partners.length; j++) {
          var other = partners[j];
          if (people[other] && gen[other] !== undefined && gen[other] !== gen[id]) {
            gen[id] = gen[other];
            changed = true;
          }
        }
      }
    }

    return gen;
  }

  function collectDescendantPeople(unit) {
    var out = {};
    var seen = {};
    seen[unit.id] = true;
    var stack = (unit.childUnits || []).slice();
    while (stack.length) {
      var u = stack.pop();
      if (!u || seen[u.id]) continue;
      seen[u.id] = true;
      for (var i = 0; i < u.members.length; i++) out[u.members[i]] = true;
      for (var j = 0; j < (u.childUnits || []).length; j++) stack.push(u.childUnits[j]);
    }
    return Object.keys(out);
  }

  function buildUnits(people, gens) {
    var ids = Object.keys(people);
    var unitByPerson = Object.create(null);
    var units = [];

    var ordered = ids.slice().sort(function (a, b) {
      var ga = gens[a] || 0;
      var gb = gens[b] || 0;
      if (ga !== gb) return ga - gb;
      var oa = people[a].order || 0;
      var ob = people[b].order || 0;
      if (oa !== ob) return oa - ob;
      return a < b ? -1 : a > b ? 1 : 0;
    });

    for (var i = 0; i < ordered.length; i++) {
      var id = ordered[i];
      if (unitByPerson[id]) continue;
      var p = people[id];
      var partners = (p.partnerIds || []).filter(function (pid) {
        return people[pid] && !unitByPerson[pid];
      });
      var members = [id];
      if (partners.length) members.push(partners[0]);

      var unit = {
        id: 'u:' + members.join('+'),
        members: members,
        gen: Math.max.apply(null, members.map(function (mid) { return gens[mid] || 0; })),
        children: [],
        childUnits: [],
        parentUnit: null,
        width: 0,
        centerX: 0
      };

      for (var m = 0; m < members.length; m++) unitByPerson[members[m]] = unit;
      units.push(unit);
    }

    var assigned = {};
    for (var c = 0; c < ordered.length; c++) {
      var childId = ordered[c];
      var child = people[childId];
      var parents = (child.parentIds || []).filter(function (pid) {
        return people[pid] && pid !== childId;
      });
      if (!parents.length) continue;

      var parentUnits = [];
      for (var pi = 0; pi < parents.length; pi++) {
        var pu = unitByPerson[parents[pi]];
        if (pu && parentUnits.indexOf(pu) === -1) parentUnits.push(pu);
      }
      if (!parentUnits.length) continue;

      var ownUnit = unitByPerson[childId];
      if (ownUnit && ownUnit.members.indexOf(childId) !== -1) {
        // A person is never their own parent; skip self-referencing junk.
        var selfParent = parents.some(function (pid) { return ownUnit.members.indexOf(pid) !== -1; });
        if (selfParent) continue;
      }

      var target = null;
      for (var t = 0; t < parentUnits.length; t++) {
        var unit2 = parentUnits[t];
        var coversAll = parents.every(function (pid) { return unit2.members.indexOf(pid) !== -1; });
        if (coversAll) {
          target = unit2;
          break;
        }
      }
      if (!target) target = parentUnits[0];
      if (target.members.indexOf(childId) !== -1) continue;

      var key = ownUnit ? ownUnit.id : childId;
      if (assigned[key]) continue;
      assigned[key] = true;
      target.children.push(childId);
    }

    for (var u = 0; u < units.length; u++) {
      var unit3 = units[u];
      unit3.children.sort(function (a, b) {
        var oa = people[a].order || 0;
        var ob = people[b].order || 0;
        if (oa !== ob) return oa - ob;
        return a < b ? -1 : a > b ? 1 : 0;
      });
      for (var ci = 0; ci < unit3.children.length; ci++) {
        var childUnit = unitByPerson[unit3.children[ci]];
        if (!childUnit || childUnit === unit3) continue;
        if (childUnit.parentUnit && childUnit.parentUnit !== unit3) continue;
        childUnit.parentUnit = unit3;
        if (unit3.childUnits.indexOf(childUnit) === -1) unit3.childUnits.push(childUnit);
      }
    }

    return { units: units, unitByPerson: unitByPerson };
  }

  function metrics(photoD) {
    return {
      photoD: photoD,
      nodeW: photoD + NODE_EXTRA_W,
      nodeH: photoD + LABEL_H,
      coupleGap: COUPLE_GAP,
      siblingGap: SIBLING_GAP,
      levelGap: photoD + LEVEL_EXTRA
    };
  }

  function layoutTree(state, options) {
    var opts = options || {};
    var photoSize = opts.photoSize || (state.view && state.view.photoSize) || 'm';
    var photoD = PHOTO[photoSize] || PHOTO.m;
    var m = metrics(photoD);
    var people = state.people || {};
    var gens = computeGenerations(people);
    var built = buildUnits(people, gens);
    var units = built.units;
    var i, u;

    var collapsed = {};
    (state.collapsed || []).forEach(function (id) { collapsed[id] = true; });

    for (i = 0; i < units.length; i++) {
      u = units[i];
      u.collapsed = !!collapsed[u.id];
      u.width = u.members.length === 2 ? m.nodeW * 2 + m.coupleGap : m.nodeW;
      u.hasChildren = (u.childUnits || []).length > 0;
      u.hiddenCount = u.collapsed ? collectDescendantPeople(u).length : 0;
      u.visibleChildren = u.collapsed ? [] : (u.childUnits || []).slice();
    }

    var visible = {};
    var roots = units.filter(function (x) { return !x.parentUnit; });
    var stack = roots.slice();
    while (stack.length) {
      var cur = stack.pop();
      if (visible[cur.id]) continue;
      visible[cur.id] = cur;
      for (var sc = 0; sc < cur.visibleChildren.length; sc++) stack.push(cur.visibleChildren[sc]);
    }

    var cursor = 0;
    var placing = {};

    function shiftTree(unit, dx) {
      var list = [unit];
      var seen = {};
      while (list.length) {
        var item = list.pop();
        if (!item || seen[item.id]) continue;
        seen[item.id] = true;
        item.centerX += dx;
        for (var k = 0; k < item.visibleChildren.length; k++) list.push(item.visibleChildren[k]);
      }
    }

    function place(unit) {
      if (placing[unit.id]) {
        unit.centerX = cursor + unit.width / 2;
        cursor = unit.centerX + unit.width / 2 + m.siblingGap;
        return;
      }
      placing[unit.id] = true;
      var start = cursor;

      if (!unit.visibleChildren.length) {
        unit.centerX = start + unit.width / 2;
        cursor = unit.centerX + unit.width / 2 + m.siblingGap;
        placing[unit.id] = false;
        return;
      }

      for (var k = 0; k < unit.visibleChildren.length; k++) place(unit.visibleChildren[k]);

      var first = unit.visibleChildren[0];
      var last = unit.visibleChildren[unit.visibleChildren.length - 1];
      unit.centerX = (first.centerX + last.centerX) / 2;

      var deficit = start - (unit.centerX - unit.width / 2);
      if (deficit > 0) {
        shiftTree(unit, deficit);
        cursor += deficit;
      }

      var right = unit.centerX + unit.width / 2 + m.siblingGap;
      if (right > cursor) cursor = right;
      placing[unit.id] = false;
    }

    var visibleRoots = roots.filter(function (r) { return visible[r.id]; });
    for (i = 0; i < visibleRoots.length; i++) place(visibleRoots[i]);

    var visibleUnits = [];
    Object.keys(visible).forEach(function (id) { visibleUnits.push(visible[id]); });
    if (!visibleUnits.length) visibleUnits = units.slice(0, 1);

    var minLeft = Infinity;
    var maxRight = -Infinity;
    for (i = 0; i < visibleUnits.length; i++) {
      u = visibleUnits[i];
      if (u.left === undefined) u.left = u.centerX - u.width / 2;
      if (u.right === undefined) u.right = u.centerX + u.width / 2;
      if (u.left < minLeft) minLeft = u.left;
      if (u.right > maxRight) maxRight = u.right;
    }
    if (!isFinite(minLeft)) {
      minLeft = 0;
      maxRight = m.nodeW;
    }

    var shiftX = PAD_X - minLeft;
    var maxGen = 0;
    for (i = 0; i < visibleUnits.length; i++) {
      if (visibleUnits[i].gen > maxGen) maxGen = visibleUnits[i].gen;
    }

    var topY = PAD_TOP + photoD / 2;
    var gen0Y = topY + maxGen * m.levelGap;
    var groundY = gen0Y - photoD / 2 - 34;
    var worldW = maxRight - minLeft + PAD_X * 2;
    var worldH = gen0Y + photoD / 2 + ROOT_SPACE;

    function yForGen(g) {
      return gen0Y - g * m.levelGap;
    }

    var nodes = [];
    var unitViews = [];
    var unitById = {};

    for (i = 0; i < visibleUnits.length; i++) {
      u = visibleUnits[i];
      u.centerX += shiftX;
      u.left = u.centerX - u.width / 2;
      u.right = u.centerX + u.width / 2;

      var count = u.members.length;
      var step = m.nodeW + m.coupleGap;
      var y = yForGen(u.gen);

      for (var k = 0; k < count; k++) {
        nodes.push({
          id: u.members[k],
          unitId: u.id,
          x: u.centerX + (k - (count - 1) / 2) * step,
          y: y,
          gen: u.gen
        });
      }

      var view = {
        id: u.id,
        centerX: u.centerX,
        y: y,
        gen: u.gen,
        width: u.width,
        members: u.members.slice(),
        collapsed: u.collapsed,
        hiddenCount: u.hiddenCount,
        hasChildren: u.hasChildren
      };
      unitViews.push(view);
      unitById[u.id] = view;
    }

    var connectors = [];
    for (i = 0; i < visibleUnits.length; i++) {
      u = visibleUnits[i];
      if (!u.visibleChildren.length) continue;

      var px = u.centerX;
      var py = yForGen(u.gen) - photoD / 2 - 2;
      var kids = u.visibleChildren.map(function (c) {
        return { x: c.centerX, y: yForGen(c.gen) + photoD / 2 + 2 };
      });
      var railY = (py + kids[0].y) / 2;
      var width = Math.max(4, 10 - u.gen * 1.1);
      var d;

      if (kids.length === 1) {
        var only = kids[0];
        d = 'M ' + px + ' ' + py +
            ' C ' + px + ' ' + (py - 46) + ', ' + only.x + ' ' + (only.y + 46) + ', ' + only.x + ' ' + only.y;
      } else {
        var left = Math.min.apply(null, kids.map(function (k) { return k.x; }));
        var right = Math.max.apply(null, kids.map(function (k) { return k.x; }));
        var wobble = (hash(u.id) % 15) - 7;

        d = 'M ' + px + ' ' + py +
            ' C ' + px + ' ' + (py - 34) + ', ' + px + ' ' + (railY + 34) + ', ' + px + ' ' + railY +
            ' M ' + left + ' ' + railY +
            ' Q ' + ((left + right) / 2) + ' ' + (railY - 14 + wobble) + ' ' + right + ' ' + railY;

        for (var ck = 0; ck < kids.length; ck++) {
          var kid = kids[ck];
          d += ' M ' + kid.x + ' ' + railY +
               ' C ' + kid.x + ' ' + (railY - 40) + ', ' + kid.x + ' ' + (kid.y + 40) + ', ' + kid.x + ' ' + kid.y;
        }
      }

      connectors.push({ unitId: u.id, d: d, width: width });
    }

    var nodeById = {};
    for (i = 0; i < nodes.length; i++) nodeById[nodes[i].id] = nodes[i];

    return {
      photoSize: photoSize,
      photoD: photoD,
      metrics: m,
      nodes: nodes,
      nodeById: nodeById,
      units: unitViews,
      unitById: unitById,
      connectors: connectors,
      world: { w: worldW, h: worldH },
      groundY: groundY,
      topY: topY,
      gen0Y: gen0Y,
      maxGen: maxGen,
      yForGen: yForGen,
      gens: gens,
      peopleCount: Object.keys(people).length
    };
  }

  FT.layout = {
    PHOTO: PHOTO,
    hash: hash,
    metrics: metrics,
    computeGenerations: computeGenerations,
    buildUnits: buildUnits,
    layoutTree: layoutTree,
    collectDescendantPeople: collectDescendantPeople
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FT.layout;
})(typeof window !== 'undefined' ? window : globalThis);
