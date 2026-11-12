(function (global) {
  'use strict';

  var FT = (global.FT = global.FT || {});

  var LEAF_COLORS = ['#52B788', '#74C69D', '#95D5B2', '#40916C', '#A7D8B4'];

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function defs() {
    return [
      '<defs>',
      '<linearGradient id="ft-sky" x1="0" y1="0" x2="0" y2="1">',
      '<stop offset="0" stop-color="#C7E9FF"/><stop offset="0.55" stop-color="#E4F6FF"/>',
      '<stop offset="1" stop-color="#F1FBF3"/></linearGradient>',
      '<linearGradient id="ft-soil" x1="0" y1="0" x2="0" y2="1">',
      '<stop offset="0" stop-color="#8B6343"/><stop offset="0.45" stop-color="#6B4A2F"/>',
      '<stop offset="1" stop-color="#42291A"/></linearGradient>',
      '<linearGradient id="ft-bark" x1="0" y1="0" x2="1" y2="0">',
      '<stop offset="0" stop-color="#6A4127"/><stop offset="0.42" stop-color="#B07B4E"/>',
      '<stop offset="1" stop-color="#57331D"/></linearGradient>',
      '<radialGradient id="ft-glow" cx="0.5" cy="0.5" r="0.5">',
      '<stop offset="0" stop-color="#FFF6C9" stop-opacity="0.75"/>',
      '<stop offset="1" stop-color="#FFF6C9" stop-opacity="0"/></radialGradient>',
      '</defs>'
    ].join('');
  }

  function sun(x, y) {
    var rays = '';
    for (var i = 0; i < 12; i++) {
      var angle = (i * Math.PI * 2) / 12;
      var x1 = x + Math.cos(angle) * 54;
      var y1 = y + Math.sin(angle) * 54;
      var x2 = x + Math.cos(angle) * 74;
      var y2 = y + Math.sin(angle) * 74;
      rays +=
        '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) +
        '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
        '" stroke="#FFD166" stroke-width="7" stroke-linecap="round"/>';
    }
    return (
      '<g class="sun">' +
      '<circle cx="' + x + '" cy="' + y + '" r="92" fill="url(#ft-glow)"/>' +
      '<g class="sun-rays" style="transform-origin:' + x + 'px ' + y + 'px">' + rays + '</g>' +
      '<circle cx="' + x + '" cy="' + y + '" r="46" fill="#FFD166"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="46" fill="none" stroke="#F4B942" stroke-width="4"/>' +
      '<circle cx="' + (x - 14) + '" cy="' + (y - 6) + '" r="5" fill="#F4A73A" opacity=".55"/>' +
      '<circle cx="' + (x + 12) + '" cy="' + (y + 12) + '" r="4" fill="#F4A73A" opacity=".45"/>' +
      '</g>'
    );
  }

  function cloud(x, y, s, className) {
    return (
      '<g class="cloud ' + className + '" opacity=".9">' +
      '<ellipse cx="' + x + '" cy="' + y + '" rx="' + 58 * s + '" ry="' + 30 * s + '" fill="#FFFFFF"/>' +
      '<ellipse cx="' + (x + 44 * s) + '" cy="' + (y + 8 * s) + '" rx="' + 40 * s + '" ry="' + 24 * s + '" fill="#FFFFFF"/>' +
      '<ellipse cx="' + (x - 46 * s) + '" cy="' + (y + 10 * s) + '" rx="' + 34 * s + '" ry="' + 20 * s + '" fill="#FFFFFF"/>' +
      '</g>'
    );
  }

  function clouds(W) {
    return [
      cloud(W * 0.14, 130, 1.1, 'c1'),
      cloud(W * 0.42, 78, 0.75, 'c2'),
      cloud(W * 0.66, 168, 0.95, 'c3')
    ].join('');
  }

  function birds(W) {
    function bird(x, y, s, cls) {
      return (
        '<path class="bird ' + cls + '" d="M ' + x + ' ' + y +
        ' q ' + 12 * s + ' ' + -10 * s + ' ' + 24 * s + ' 0' +
        ' q ' + 12 * s + ' ' + -10 * s + ' ' + 24 * s + ' 0"' +
        ' fill="none" stroke="#4A6B5C" stroke-width="' + (2.4 * s).toFixed(1) +
        '" stroke-linecap="round" opacity=".7"/>'
      );
    }
    return bird(W * 0.24, 240, 1, 'b1') + bird(W * 0.29, 210, 0.8, 'b2') + bird(W * 0.58, 300, 0.9, 'b3');
  }

  function hills(W, groundY) {
    return [
      '<path d="M -60 ' + groundY +
        ' C ' + W * 0.14 + ' ' + (groundY - 110) + ', ' + W * 0.34 + ' ' + (groundY - 30) +
        ', ' + W * 0.54 + ' ' + (groundY - 74) +
        ' S ' + W * 0.84 + ' ' + (groundY - 130) + ', ' + (W + 60) + ' ' + (groundY - 34) +
        ' L ' + (W + 60) + ' ' + (groundY + 80) + ' L -60 ' + (groundY + 80) + ' Z"' +
        ' fill="#C3E9C9" opacity=".85"/>',
      '<path d="M -60 ' + (groundY + 4) +
        ' C ' + W * 0.2 + ' ' + (groundY - 44) + ', ' + W * 0.46 + ' ' + (groundY + 10) +
        ', ' + W * 0.68 + ' ' + (groundY - 26) +
        ' S ' + W * 0.92 + ' ' + (groundY - 6) + ', ' + (W + 60) + ' ' + (groundY - 2) +
        ' L ' + (W + 60) + ' ' + (groundY + 70) + ' L -60 ' + (groundY + 70) + ' Z"' +
        ' fill="#8FD6A2"/>'
    ].join('');
  }

  function soil(W, groundY, H, seed) {
    var rnd = mulberry32(seed);
    var EXTRA = 2600;
    var pebbles = '';
    for (var i = 0; i < 34; i++) {
      var x = rnd() * W;
      var y = groundY + 40 + rnd() * (H - groundY - 50);
      var r = 2 + rnd() * 5;
      pebbles +=
        '<ellipse cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="' + r.toFixed(1) +
        '" ry="' + (r * 0.65).toFixed(1) + '" fill="#A67C57" opacity="' +
        (0.18 + rnd() * 0.22).toFixed(2) + '"/>';
    }
    return (
      '<rect x="' + -EXTRA + '" y="' + groundY + '" width="' + (W + EXTRA * 2) +
      '" height="' + (H - groundY) + '" fill="url(#ft-soil)"/>' +
      '<rect x="' + -EXTRA + '" y="' + groundY + '" width="' + (W + EXTRA * 2) +
      '" height="10" fill="#3F7F52" opacity=".55"/>' +
      '<line x1="' + -EXTRA + '" y1="' + groundY + '" x2="' + (W + EXTRA) + '" y2="' + groundY +
      '" stroke="#2F6B45" stroke-width="3" stroke-dasharray="14 10" opacity=".35"/>' +
      '<ellipse cx="' + W * 0.5 + '" cy="' + (groundY + 26) + '" rx="' + W * 0.32 + '" ry="22" fill="#7A5638" opacity=".35"/>' +
      pebbles
    );
  }

  function trunk(cx, groundY, topY, photoD) {
    var top = topY - photoD * 0.55;
    var baseHalf = 50;
    var topHalf = 18;
    var d =
      'M ' + (cx - baseHalf) + ' ' + (groundY + 12) +
      ' C ' + (cx - baseHalf - 8) + ' ' + (groundY - 150) +
      ', ' + (cx - topHalf - 46) + ' ' + (top + 240) +
      ', ' + (cx - topHalf) + ' ' + top +
      ' L ' + (cx + topHalf) + ' ' + top +
      ' C ' + (cx + topHalf + 46) + ' ' + (top + 240) +
      ', ' + (cx + baseHalf + 8) + ' ' + (groundY - 150) +
      ', ' + (cx + baseHalf) + ' ' + (groundY + 12) + ' Z';

    var bark = '';
    for (var i = 0; i < 7; i++) {
      var off = -baseHalf + 12 + i * ((baseHalf * 2 - 24) / 6);
      var sway = (i % 2 === 0 ? 1 : -1) * (8 + i * 1.6);
      bark +=
        '<path d="M ' + (cx + off) + ' ' + (groundY - 30) +
        ' C ' + (cx + off + sway) + ' ' + (groundY - 220) +
        ', ' + (cx + off * 0.55 + sway) + ' ' + (top + 190) +
        ', ' + (cx + off * 0.5) + ' ' + (top + 60) + '"' +
        ' fill="none" stroke="#4E3018" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>';
    }

    var twigs =
      '<path d="M ' + cx + ' ' + (top + 30) +
      ' C ' + (cx - 60) + ' ' + (top - 10) + ', ' + (cx - 120) + ' ' + (top + 10) +
      ', ' + (cx - 168) + ' ' + (top + 56) + '" fill="none" stroke="#7A4E2E" stroke-width="13" stroke-linecap="round"/>' +
      '<path d="M ' + cx + ' ' + (top + 42) +
      ' C ' + (cx + 70) + ' ' + (top + 6) + ', ' + (cx + 132) + ' ' + (top + 26) +
      ', ' + (cx + 178) + ' ' + (top + 74) + '" fill="none" stroke="#7A4E2E" stroke-width="12" stroke-linecap="round"/>' +
      '<path d="M ' + cx + ' ' + (top + 70) +
      ' C ' + (cx - 10) + ' ' + (top + 10) + ', ' + (cx + 26) + ' ' + (top - 20) +
      ', ' + (cx + 6) + ' ' + (top - 64) + '" fill="none" stroke="#7A4E2E" stroke-width="10" stroke-linecap="round"/>';

    return (
      '<g class="trunk">' +
      '<path d="' + d + '" fill="url(#ft-bark)" stroke="#4E3018" stroke-width="3"/>' +
      bark +
      '<ellipse cx="' + (cx + 18) + '" cy="' + (groundY - 210) + '" rx="9" ry="15" fill="#4E3018" opacity=".55"/>' +
      '<ellipse cx="' + (cx - 24) + '" cy="' + (groundY - 380) + '" rx="7" ry="12" fill="#4E3018" opacity=".45"/>' +
      twigs +
      '</g>'
    );
  }

  function roots(cx, groundY, H) {
    var spread = [-1.05, -0.78, -0.52, -0.26, 0.04, 0.3, 0.56, 0.82, 1.08];
    var out = '<g class="roots" fill="#5A3B23" opacity=".92">';
    for (var i = 0; i < spread.length; i++) {
      var a = spread[i];
      var depth = 90 + ((i * 47) % 110);
      var reach = 90 + ((i * 61) % 130);
      var x1 = cx + a * reach;
      var y1 = groundY + depth;
      var x2 = cx + a * reach * 1.9;
      var y2 = Math.min(H - 26, groundY + depth + 80 + (i % 3) * 26);
      var w = Math.max(2.5, 10 - (i % 4) * 1.8);

      out +=
        '<path d="M ' + cx + ' ' + (groundY - 2) +
        ' C ' + (cx + a * 34) + ' ' + (groundY + 34) +
        ', ' + (x1 - a * 24) + ' ' + (y1 - 26) +
        ', ' + x1 + ' ' + y1 +
        ' C ' + (x1 + a * 26) + ' ' + (y1 + 18) +
        ', ' + (x2 - a * 12) + ' ' + (y2 - 30) +
        ', ' + x2 + ' ' + y2 +
        ' L ' + (x2 + w) + ' ' + (y2 - 5) +
        ' C ' + (x1 + a * 26 + w) + ' ' + (y1 + 8) +
        ', ' + (cx + a * 34 + w) + ' ' + (groundY + 20) +
        ', ' + (cx + w) + ' ' + groundY + ' Z"/>';
    }
    out += '</g>';

    out +=
      '<g fill="none" stroke="#7A5638" stroke-opacity=".45" stroke-linecap="round">' +
      '<path d="M ' + (cx - 8) + ' ' + (groundY + 60) + ' q -40 26 -78 34" stroke-width="3"/>' +
      '<path d="M ' + (cx + 6) + ' ' + (groundY + 80) + ' q 46 30 92 34" stroke-width="3"/>' +
      '<path d="M ' + (cx - 2) + ' ' + (groundY + 100) + ' q 8 40 2 84" stroke-width="2.5"/>' +
      '</g>';

    return out;
  }

  function connectors(list) {
    if (!list.length) return '';
    var out = '<g class="limbs" fill="none" stroke-linecap="round" stroke-linejoin="round">';
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      out +=
        '<path d="' + c.d + '" stroke="#8A5A35" stroke-width="' + (c.width + 3.5).toFixed(1) +
        '" stroke-opacity=".28"/>' +
        '<path d="' + c.d + '" stroke="#7A4E2E" stroke-width="' + c.width.toFixed(1) + '"/>';
    }
    out += '</g>';
    return out;
  }

  function leafCluster(x, y, scale, rotate, color, opacity) {
    return (
      '<path d="M0 0 C 8 -15, 27 -17, 35 -5 C 27 7, 8 9, 0 0 Z" fill="' + color + '" opacity="' + opacity +
      '" transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rotate.toFixed(1) +
      ') scale(' + scale.toFixed(2) + ')"/>'
    );
  }

  function leaves(model) {
    var W = model.world.w;
    var photoD = model.photoD;
    var boxW = model.metrics.nodeW / 2 + 30;
    var boxH = photoD / 2 + 86;
    var rnd = mulberry32(FT.layout.hash('leaves:' + model.peopleCount + ':' + model.world.w));
    var bandTop = model.topY - 150;
    var bandBottom = model.groundY - 20;
    var area = Math.max(1, W * Math.max(1, bandBottom - bandTop));
    var count = Math.max(36, Math.min(260, Math.round(area / 9000)));
    var boxes = model.nodes.map(function (n) {
      return { x: n.x, y: n.y, w: boxW, h: boxH };
    });

    var out = '<g class="leafbed">';
    for (var i = 0; i < count; i++) {
      var x = 40 + rnd() * (W - 80);
      var y = bandTop + rnd() * (bandBottom - bandTop);
      var blocked = false;
      for (var b = 0; b < boxes.length; b++) {
        var box = boxes[b];
        if (Math.abs(x - box.x) < box.w && Math.abs(y - box.y) < box.h) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;

      out += leafCluster(
        x,
        y,
        0.55 + rnd() * 1.1,
        rnd() * 360,
        LEAF_COLORS[Math.floor(rnd() * LEAF_COLORS.length)],
        (0.3 + rnd() * 0.3).toFixed(2)
      );
    }
    out += '</g>';
    return out;
  }

  function groundDetail(W, groundY, seed) {
    var rnd = mulberry32(seed);
    var out = '<g class="ground-detail">';

    for (var i = 0; i < 46; i++) {
      var x = 20 + rnd() * (W - 40);
      var h = 8 + rnd() * 16;
      out +=
        '<path d="M ' + x.toFixed(1) + ' ' + groundY + ' q ' + (3 + rnd() * 4).toFixed(1) + ' ' + (-h).toFixed(1) +
        ' ' + (7 + rnd() * 5).toFixed(1) + ' 0" fill="none" stroke="#3E9E5C" stroke-width="2" stroke-linecap="round" opacity=".55"/>';
    }

    for (var f = 0; f < 7; f++) {
      var fx = 40 + rnd() * (W - 80);
      var fy = groundY - 4;
      var petal = ['#FF8FA3', '#FFD166', '#C9A7F5', '#8ECAE6'][Math.floor(rnd() * 4)];
      out +=
        '<g transform="translate(' + fx.toFixed(1) + ' ' + fy.toFixed(1) + ')" opacity=".9">' +
        '<path d="M0 0 L0 -18" stroke="#3E9E5C" stroke-width="2"/>' +
        '<circle cx="0" cy="-20" r="4" fill="' + petal + '"/>' +
        '<circle cx="6" cy="-22" r="3.4" fill="' + petal + '"/>' +
        '<circle cx="-6" cy="-22" r="3.4" fill="' + petal + '"/>' +
        '<circle cx="0" cy="-25" r="3.2" fill="' + petal + '"/>' +
        '<circle cx="0" cy="-22" r="2" fill="#F4A73A"/>' +
        '</g>';
    }

    out += '</g>';
    return out;
  }

  function build(model) {
    var W = model.world.w;
    var H = model.world.h;
    var groundY = model.groundY;
    var seed = FT.layout.hash('art:' + model.photoSize + ':' + model.peopleCount);

    var rootUnit = null;
    for (var i = 0; i < model.units.length; i++) {
      if (model.units[i].gen === 0) {
        rootUnit = model.units[i];
        break;
      }
    }
    var cx = rootUnit ? rootUnit.centerX : W / 2;

    return [
      defs(),
      '<rect x="-2600" y="0" width="' + (W + 5200) + '" height="' + H + '" fill="url(#ft-sky)"/>',
      sun(Math.min(W - 140, W * 0.87), 122),
      clouds(W),
      birds(W),
      hills(W, groundY),
      soil(W, groundY, H, seed),
      roots(cx, groundY, H),
      trunk(cx, groundY, model.topY, model.photoD),
      connectors(model.connectors),
      leaves(model),
      groundDetail(W, groundY, seed + 7)
    ].join('');
  }

  FT.art = { build: build };
})(typeof window !== 'undefined' ? window : globalThis);
