(function (global) {
  'use strict';

  var FT = (global.FT = global.FT || {});
  var FRAME_COLORS = { leaf: '#95d5b2', apple: '#ff8fa3', flower: '#ffc2d1', nest: '#c89f72' };
  var DISPLAY_FONT = '"Baloo 2", "Comic Sans MS", "Chalkboard SE", sans-serif';
  var EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = reject;
      image.src = src;
    });
  }

  function svgToImage(svgElement, width, height) {
    var clone = svgElement.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));
    var source = new XMLSerializer().serializeToString(clone);
    var blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    return loadImage(url).then(function (image) {
      URL.revokeObjectURL(url);
      return image;
    });
  }

  function roundRect(ctx, x, y, width, height, radius) {
    var r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function fitText(ctx, text, maxWidth) {
    var value = String(text == null ? '' : text);
    if (ctx.measureText(value).width <= maxWidth) return value;
    var chars = value.split('');
    while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) chars.pop();
    return chars.join('') + '…';
  }

  function fallbackBackground(ctx, world, groundY) {
    var sky = ctx.createLinearGradient(0, 0, 0, world.h);
    sky.addColorStop(0, '#c7e9ff');
    sky.addColorStop(0.6, '#e8f7ff');
    sky.addColorStop(1, '#f1fbf3');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, world.w, world.h);

    ctx.fillStyle = '#8fd6a2';
    ctx.fillRect(0, groundY, world.w, world.h - groundY);
    ctx.fillStyle = '#8b6343';
    ctx.fillRect(0, groundY + 8, world.w, world.h - groundY - 8);
  }

  function drawNode(ctx, person, node, model, photo) {
    var r = model.photoD / 2;
    var x = node.x;
    var y = node.y;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#2f3e46';
    ctx.beginPath();
    ctx.ellipse(x, y + r + 12, r * 0.75, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (photo) {
      ctx.drawImage(photo, x - r, y - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = '#f1f8f2';
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = '#2f3e46';
      ctx.font = Math.round(r * 0.95) + 'px ' + EMOJI_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(person.emoji || '🙂', x, y + r * 0.06);
    }
    ctx.restore();

    ctx.textBaseline = 'alphabetic';

    ctx.beginPath();
    ctx.arc(x, y, r + 5, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = FRAME_COLORS[person.frame] || FRAME_COLORS.leaf;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, r + 10.5, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.stroke();

    ctx.save();
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = Math.max(3, r * 0.09);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r * 0.44, y - r + 10);
    ctx.lineTo(x - r * 0.52, y - r - 12);
    ctx.stroke();

    ctx.fillStyle = '#7bd389';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.34, y - r - 10, r * 0.18, r * 0.09, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    var nameFont = Math.max(13, Math.round(model.photoD * 0.115));
    ctx.font = '800 ' + nameFont + 'px ' + DISPLAY_FONT;
    var nameWidth = ctx.measureText(person.name).width;

    var tagWidth = Math.min(model.metrics.nodeW, Math.max(120, nameWidth + 26));
    var tagHeight = Math.max(48, Math.round(model.photoD * 0.38));
    var tagX = x - tagWidth / 2;
    var tagY = y + r + 16;

    ctx.save();
    ctx.shadowColor = 'rgba(47,62,70,.18)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, tagX, tagY, tagWidth, tagHeight, 18);
    ctx.fillStyle = '#fffdf5';
    ctx.fill();
    ctx.restore();

    roundRect(ctx, tagX, tagY, tagWidth, tagHeight, 18);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#e8d9b8';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#2f3e46';
    ctx.font = '800 ' + nameFont + 'px ' + DISPLAY_FONT;
    ctx.fillText(fitText(ctx, person.name, tagWidth - 18), x, tagY + tagHeight * 0.46);

    if (person.relation) {
      ctx.fillStyle = '#7c8f86';
      ctx.font =
        '700 ' + Math.max(9, Math.round(model.photoD * 0.072)) + 'px ' + DISPLAY_FONT;
      ctx.fillText(
        fitText(ctx, String(person.relation).toUpperCase(), tagWidth - 18),
        x,
        tagY + tagHeight * 0.78
      );
    }

    (person.stickers || []).forEach(function (symbol, index) {
      ctx.textAlign = 'center';
      ctx.font = Math.round(model.photoD * 0.17) + 'px ' + EMOJI_FONT;
      ctx.fillText(symbol, x + r - 4 + index * 3, y - r - 4 + index * 11);
    });
  }

  async function draw(state, model) {
    var world = model.world;
    var scale = Math.min(2, 4096 / Math.max(world.w, world.h));

    var canvas = document.createElement('canvas');
    canvas.width = Math.round(world.w * scale);
    canvas.height = Math.round(world.h * scale);
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    var artElement = document.getElementById('art');
    if (artElement) {
      try {
        var artImage = await svgToImage(artElement, world.w, world.h);
        ctx.drawImage(artImage, 0, 0, world.w, world.h);
      } catch (error) {
        fallbackBackground(ctx, world, model.groundY);
      }
    } else {
      fallbackBackground(ctx, world, model.groundY);
    }

    var photos = {};
    await Promise.all(
      model.nodes.map(function (node) {
        var person = state.people[node.id];
        if (!person || !person.photo) return Promise.resolve();
        return loadImage(person.photo)
          .then(function (image) {
            photos[node.id] = image;
          })
          .catch(function () {
            /* skip broken photos */
          });
      })
    );

    ctx.textAlign = 'center';
    ctx.fillStyle = '#2f7d4f';
    ctx.font =
      '800 ' + Math.max(28, Math.round(model.photoD * 0.28)) + 'px ' + DISPLAY_FONT;
    ctx.fillText(state.meta && state.meta.title ? state.meta.title : 'Our Family Tree', world.w / 2, 78);

    model.nodes.forEach(function (node) {
      var person = state.people[node.id];
      if (person) drawNode(ctx, person, node, model, photos[node.id]);
    });

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = '600 18px ' + DISPLAY_FONT;
    ctx.fillText(new Date().toLocaleDateString(), world.w - 28, world.h - 28);

    return canvas;
  }

  function download(state, model) {
    return draw(state, model).then(function (canvas) {
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error('no-blob'));
            return;
          }
          var url = URL.createObjectURL(blob);
          var anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'family-tree-' + new Date().toISOString().slice(0, 10) + '.png';
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          global.setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 1500);
          resolve();
        }, 'image/png');
      });
    });
  }

  function printTree(state, model) {
    return draw(state, model).then(function (canvas) {
      var area = document.getElementById('printArea');
      if (!area) throw new Error('no-print-area');

      area.innerHTML = '';
      var image = new Image();
      var loaded = new Promise(function (resolve) {
        image.onload = resolve;
        image.onerror = resolve;
      });
      image.alt = '';
      image.src = canvas.toDataURL('image/png');
      area.appendChild(image);
      document.body.classList.add('printing');

      return loaded.then(function () {
        function cleanup() {
          document.body.classList.remove('printing');
          area.innerHTML = '';
          global.removeEventListener('afterprint', cleanup);
        }
        global.addEventListener('afterprint', cleanup);
        global.print();
      });
    });
  }

  FT.poster = { download: download, draw: draw, print: printTree };
})(typeof window !== 'undefined' ? window : globalThis);
