(function (global) {
  'use strict';

  var FT = (global.FT = global.FT || {});

  var FRAME_META = [
    { id: 'leaf', icon: '🍃', label: 'Leaf' },
    { id: 'apple', icon: '🍎', label: 'Apple' },
    { id: 'flower', icon: '🌸', label: 'Flower' },
    { id: 'nest', icon: '🪺', label: 'Nest' }
  ];
  var STICKERS = ['🦋', '🌼', '⭐', '🐞', '🍀', '🌈', '🐝', '🍓', '🐿️'];
  var HINT_KEY = 'familyTree.hintSeen';
  var CONFETTI_COLORS = ['#FFD166', '#FF8FA3', '#8ECAE6', '#95D5B2', '#C9A7F5', '#FFB4A2'];

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  FT.createUI = function (initialState) {
    var state = initialState;
    var model = null;
    var selectedId = null;
    var photoTarget = null;
    var lightboxId = null;
    var filling = false;
    var started = false;
    var lastFit = null;
    var lastFitMode = 'photos';
    var undoStack = [];
    var saveTimer = null;
    var toastTimer = null;
    var confirmAction = null;
    var camera = null;
    var renderer = null;
    var panTracker = null;
    var story = { active: false, index: 0, order: [] };
    var audio = null;
    var confettiParts = [];
    var confettiRaf = null;
    var reduced =
      global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var el = {
      viewport: document.getElementById('viewport'),
      stage: document.getElementById('stage'),
      art: document.getElementById('art'),
      nodes: document.getElementById('nodes'),
      chips: document.getElementById('chips'),
      zoomLabel: document.getElementById('zoomLabel'),
      zoomIn: document.getElementById('zoomIn'),
      zoomOut: document.getElementById('zoomOut'),
      zoomFit: document.getElementById('zoomFit'),
      hint: document.getElementById('hint'),
      hintClose: document.getElementById('hintClose'),
      panel: document.getElementById('panel'),
      panelClose: document.getElementById('panelClose'),
      panelAvatar: document.getElementById('panelAvatar'),
      panelTitle: document.getElementById('panelTitle'),
      panelSub: document.getElementById('panelSub'),
      panelUpload: document.getElementById('panelUpload'),
      fName: document.getElementById('fName'),
      fRelation: document.getElementById('fRelation'),
      fFun: document.getElementById('fFun'),
      frameTray: document.getElementById('frameTray'),
      stickerTray: document.getElementById('stickerTray'),
      addChild: document.getElementById('addChild'),
      addPartner: document.getElementById('addPartner'),
      addSibling: document.getElementById('addSibling'),
      deletePerson: document.getElementById('deletePerson'),
      storyBtn: document.getElementById('storyBtn'),
      addRootBtn: document.getElementById('addRootBtn'),
      collapseAllBtn: document.getElementById('collapseAllBtn'),
      expandAllBtn: document.getElementById('expandAllBtn'),
      muteBtn: document.getElementById('muteBtn'),
      posterBtn: document.getElementById('posterBtn'),
      menuBtn: document.getElementById('menuBtn'),
      menu: document.getElementById('menu'),
      exportBtn: document.getElementById('exportBtn'),
      importBtn: document.getElementById('importBtn'),
      importFile: document.getElementById('importFile'),
      photoFile: document.getElementById('photoFile'),
      printBtn: document.getElementById('printBtn'),
      menuPosterBtn: document.getElementById('menuPosterBtn'),
      menuSizeBtn: document.getElementById('menuSizeBtn'),
      menuCollapseBtn: document.getElementById('menuCollapseBtn'),
      menuExpandBtn: document.getElementById('menuExpandBtn'),
      menuMuteBtn: document.getElementById('menuMuteBtn'),
      helpBtn: document.getElementById('helpBtn'),
      resetBtn: document.getElementById('resetBtn'),
      storyCard: document.getElementById('storyCard'),
      storyAvatar: document.getElementById('storyAvatar'),
      storyStep: document.getElementById('storyStep'),
      storyName: document.getElementById('storyName'),
      storyText: document.getElementById('storyText'),
      storyBack: document.getElementById('storyBack'),
      storyNext: document.getElementById('storyNext'),
      storyStop: document.getElementById('storyStop'),
      lightbox: document.getElementById('lightbox'),
      lightboxPhoto: document.getElementById('lightboxPhoto'),
      lightboxName: document.getElementById('lightboxName'),
      lightboxRelation: document.getElementById('lightboxRelation'),
      lightboxFact: document.getElementById('lightboxFact'),
      lightboxPrev: document.getElementById('lightboxPrev'),
      lightboxNext: document.getElementById('lightboxNext'),
      lightboxClose: document.getElementById('lightboxClose'),
      toast: document.getElementById('toast'),
      toastText: document.getElementById('toastText'),
      toastAction: document.getElementById('toastAction'),
      confirm: document.getElementById('confirm'),
      confirmTitle: document.getElementById('confirmTitle'),
      confirmText: document.getElementById('confirmText'),
      confirmOk: document.getElementById('confirmOk'),
      confirmCancel: document.getElementById('confirmCancel'),
      help: document.getElementById('help'),
      helpClose: document.getElementById('helpClose'),
      confetti: document.getElementById('confetti')
    };

    camera = FT.camera.create({
      viewport: el.viewport,
      stage: el.stage,
      onChange: function (cam) {
        el.zoomLabel.textContent = Math.round(cam.scale * 100) + '%';
        state.view.scale = cam.scale;
        state.view.tx = cam.tx;
        state.view.ty = cam.ty;
        if (started) scheduleSave();
      }
    });

    renderer = FT.render.create({
      stage: el.stage,
      art: el.art,
      nodes: el.nodes,
      chips: el.chips
    });

    /* ------------------------------------------------------------------ */
    /* layout + persistence                                               */
    /* ------------------------------------------------------------------ */

    function rebuild(options) {
      var opts = options || {};
      model = FT.layout.layoutTree(state, { photoSize: state.view.photoSize });
      renderer.render(model, state, selectedId);
      camera.setWorld(model.world.w, model.world.h);
      if (opts.fit) doFit(opts.fit === 'all' ? 'all' : undefined);
    }

    function doFit(mode) {
      if (!model) return;
      var wantAll = mode === 'all';
      var fit = camera.fitScale(54);

      if (wantAll || fit >= 0.62) {
        camera.fit();
      } else {
        var vw = el.viewport.clientWidth;
        var vh = el.viewport.clientHeight;
        var widthFit = (vw - 108) / model.world.w;
        var scale = clamp(Math.max(widthFit, fit), 0.62, 1);

        if (model.world.h * scale <= vh - 24) {
          camera.centerOn(model.world.w / 2, model.world.h / 2, scale);
        } else {
          // Lead with the newest generation so the kid's own leaf is on screen.
          var youngest = -1;
          model.nodes.forEach(function (node) {
            if (node.gen > youngest) youngest = node.gen;
          });
          var topNodes = model.nodes.filter(function (node) {
            return node.gen === youngest;
          });
          var focusX = model.world.w / 2;
          var fitsAcross = model.world.w * scale <= vw;
          if (!fitsAcross && topNodes.length) {
            var sum = 0;
            topNodes.forEach(function (node) {
              sum += node.x;
            });
            focusX = sum / topNodes.length;
          }
          var anchorY = model.topY + (vh / 2 - 104) / scale;
          camera.centerOn(focusX, anchorY, scale);
        }
      }

      lastFitMode = wantAll ? 'all' : 'photos';
      lastFit = camera.get().scale;
    }

    function scheduleSave() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 400);
    }

    function persist() {
      var result = FT.data.save(state);
      if (result.ok) return;
      if (result.error === 'quota') {
        toast('The tree is full! Export a backup, then remove a photo or two.', null, 7000);
      } else {
        toast('I could not save just now. Export a backup to be safe.', null, 6000);
      }
    }

    function snapshot() {
      return JSON.stringify({ people: state.people, collapsed: state.collapsed });
    }

    function commit(mutator, options) {
      var opts = options || {};
      var before = snapshot();
      mutator();
      if (snapshot() === before) return false;

      if (opts.undo !== false) {
        undoStack.push(before);
        if (undoStack.length > 25) undoStack.shift();
      }

      persist();
      rebuild();
      if (opts.fit) doFit();
      if (opts.select !== undefined) selectPerson(opts.select);

      if (opts.message) {
        toast(
          opts.message,
          opts.undo === false ? null : 'Undo',
          opts.undo === false ? null : undo
        );
      }
      if (opts.confetti) confettiBurst(opts.confetti);
      if (opts.sfx !== false) playSound('pop');
      return true;
    }

    function undo() {
      var previous = undoStack.pop();
      if (!previous) return;
      try {
        var parsed = JSON.parse(previous);
        state.people = parsed.people;
        state.collapsed = parsed.collapsed || [];
      } catch (e) {
        return;
      }
      selectedId = null;
      closePanel();
      persist();
      rebuild();
      toast('Back to how it was.');
    }

    /* ------------------------------------------------------------------ */
    /* selection + panel                                                  */
    /* ------------------------------------------------------------------ */

    function findNodeEl(id) {
      for (var i = 0; i < el.nodes.children.length; i++) {
        if (el.nodes.children[i].dataset.id === id) return el.nodes.children[i];
      }
      return null;
    }

    function unitForPerson(id) {
      for (var i = 0; i < model.units.length; i++) {
        if (model.units[i].members.indexOf(id) !== -1) return model.units[i];
      }
      return null;
    }

    function setAvatar(container, person) {
      container.innerHTML = '';
      if (person.photo) {
        var img = document.createElement('img');
        img.alt = '';
        img.src = person.photo;
        container.appendChild(img);
      } else {
        var span = document.createElement('span');
        span.textContent = person.emoji || '🙂';
        container.appendChild(span);
      }
    }

    function selectPerson(id) {
      selectedId = id;
      renderer.render(model, state, selectedId);
      if (id) fillPanel(id);
      else closePanel();
    }

    function deselect() {
      if (!selectedId) return;
      selectedId = null;
      renderer.render(model, state, null);
      closePanel();
    }

    function fillPanel(id) {
      var person = state.people[id];
      if (!person) {
        closePanel();
        return;
      }
      el.panel.hidden = false;
      filling = true;
      el.fName.value = person.name;
      el.fRelation.value = person.relation || '';
      el.fFun.value = person.funFact || '';
      filling = false;
      el.panelTitle.textContent = person.name;
      el.panelSub.textContent = person.relation || 'Family member';
      setAvatar(el.panelAvatar, person);
      renderFrameTray(person);
      renderStickerTray(person);
      el.addPartner.disabled = (person.partnerIds || []).length > 0;
    }

    function closePanel() {
      el.panel.hidden = true;
    }

    function renderFrameTray(person) {
      el.frameTray.innerHTML = '';
      FRAME_META.forEach(function (frame) {
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = frame.icon;
        button.title = frame.label;
        button.setAttribute('aria-label', 'Use the ' + frame.label + ' frame');
        button.setAttribute('aria-pressed', person.frame === frame.id ? 'true' : 'false');
        if (person.frame === frame.id) button.className = 'is-active';
        button.addEventListener('click', function () {
          setFrame(frame.id);
        });
        el.frameTray.appendChild(button);
      });
    }

    function renderStickerTray(person) {
      el.stickerTray.innerHTML = '';
      STICKERS.forEach(function (symbol) {
        var active = (person.stickers || []).indexOf(symbol) !== -1;
        var button = document.createElement('button');
        button.type = 'button';
        button.textContent = symbol;
        button.setAttribute('aria-label', 'Sticker ' + symbol);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (active) button.className = 'is-active';
        button.addEventListener('click', function () {
          toggleSticker(symbol);
        });
        el.stickerTray.appendChild(button);
      });
    }

    function setFrame(frame) {
      var person = state.people[selectedId];
      if (!person || person.frame === frame) return;
      person.frame = frame;
      renderer.render(model, state, selectedId);
      fillPanel(selectedId);
      persist();
      playSound('blip');
    }

    function toggleSticker(symbol) {
      var person = state.people[selectedId];
      if (!person) return;
      var list = (person.stickers || []).slice();
      var index = list.indexOf(symbol);
      if (index !== -1) list.splice(index, 1);
      else {
        if (list.length >= 3) list.shift();
        list.push(symbol);
      }
      person.stickers = list;
      renderer.render(model, state, selectedId);
      fillPanel(selectedId);
      persist();
      playSound('blip');
    }

    function focusNameField() {
      global.setTimeout(function () {
        el.fName.focus();
        el.fName.select();
      }, 90);
    }

    /* ------------------------------------------------------------------ */
    /* growing the tree                                                   */
    /* ------------------------------------------------------------------ */

    function nextOrder(parentIds) {
      var highest = -1;
      Object.keys(state.people).forEach(function (id) {
        var person = state.people[id];
        var parents = person.parentIds || [];
        if (parents.length !== parentIds.length) return;
        var same = parentIds.every(function (pid) {
          return parents.indexOf(pid) !== -1;
        });
        if (same) highest = Math.max(highest, person.order || 0);
      });
      return highest + 1;
    }

    function addPerson(kind) {
      if (!selectedId || !state.people[selectedId]) return;
      var anchor = state.people[selectedId];
      var unit = unitForPerson(selectedId);
      var id = FT.data.uid();
      var name = kind === 'child' ? 'New kid' : kind === 'partner' ? 'New grown-up' : 'New sibling';
      var relation = kind === 'child' ? 'Child' : kind === 'partner' ? 'Partner' : 'Sibling';
      var parentIds = [];
      var partnerIds = [];
      var order = 0;

      if (kind === 'child') {
        parentIds = unit ? unit.members.slice() : [selectedId];
        order = nextOrder(parentIds);
      } else if (kind === 'sibling') {
        parentIds = (anchor.parentIds || []).slice();
        order = Math.max(nextOrder(parentIds), (anchor.order || 0) + 1);
      } else if (kind === 'partner') {
        partnerIds = [selectedId];
        order = (anchor.order || 0) + 1;
      }

      var added = commit(
        function () {
          state.collapsed = state.collapsed.filter(function (cid) {
            return cid.split(/[:+]/).indexOf(selectedId) === -1;
          });
          state.people[id] = FT.data.person(id, name, relation, {
            emoji: kind === 'partner' ? '🧑' : '🙂',
            parentIds: parentIds,
            partnerIds: partnerIds,
            order: order
          });
          if (kind === 'partner') {
            anchor.partnerIds = (anchor.partnerIds || []).concat(id);
          }
        },
        { message: name + ' joined the tree!', confetti: id, select: id, sfx: false }
      );

      if (added) {
        playSound('chime');
        focusNameField();
      }
    }

    function addRoot() {
      var id = FT.data.uid();
      var added = commit(
        function () {
          var highest = 0;
          Object.keys(state.people).forEach(function (key) {
            var person = state.people[key];
            if (!(person.parentIds || []).length) highest = Math.max(highest, person.order || 0);
          });
          state.people[id] = FT.data.person(id, 'New grown-up', 'Grown-up', {
            emoji: '🧑',
            order: highest + 1
          });
        },
        { message: 'A new grown-up joined the roots!', confetti: id, select: id, sfx: false }
      );
      if (added) {
        playSound('chime');
        doFit('all');
        focusNameField();
      }
    }

    function askDelete() {
      if (!selectedId || !state.people[selectedId]) return;
      var targetId = selectedId;
      var person = state.people[targetId];

      askConfirm(
        'Remove ' + person.name + '?',
        'Their photo and fun fact will leave the tree. You can undo this.',
        'Yes, remove',
        function () {
          var name = person.name;
          selectedId = null;
          closePanel();
          commit(
            function () {
              delete state.people[targetId];
              Object.keys(state.people).forEach(function (key) {
                var person2 = state.people[key];
                person2.parentIds = (person2.parentIds || []).filter(function (pid) {
                  return pid !== targetId;
                });
                person2.partnerIds = (person2.partnerIds || []).filter(function (pid) {
                  return pid !== targetId;
                });
              });
              state.collapsed = state.collapsed.filter(function (cid) {
                return cid.split(/[:+]/).indexOf(targetId) === -1;
              });
            },
            { message: name + ' left the tree.' }
          );
        }
      );
    }

    function toggleCollapse(unitId) {
      var before = null;
      var unit = model.unitById[unitId];
      if (unit) {
        var screen = camera.worldToScreen(unit.centerX, unit.y);
        before = { x: screen.x, y: screen.y };
      }

      var index = state.collapsed.indexOf(unitId);
      if (index === -1) state.collapsed.push(unitId);
      else state.collapsed.splice(index, 1);

      rebuild();

      if (before) {
        var unitAfter = model.unitById[unitId];
        if (unitAfter) {
          var after = camera.worldToScreen(unitAfter.centerX, unitAfter.y);
          camera.panBy(before.x - after.x, before.y - after.y);
          lastFit = null;
        }
      }

      persist();
      playSound(index === -1 ? 'blip' : 'pop');
    }

    function collapseAll() {
      var full = FT.layout.layoutTree(
        { people: state.people, view: state.view, collapsed: [] },
        { photoSize: state.view.photoSize }
      );
      state.collapsed = full.units
        .filter(function (unit) {
          return unit.hasChildren;
        })
        .map(function (unit) {
          return unit.id;
        });
      rebuild({ fit: 'all' });
      persist();
      toast('Every branch folded away. Tap ＋ numbers to open them.');
    }

    function expandAll() {
      if (!state.collapsed.length) return;
      state.collapsed = [];
      rebuild({ fit: 'all' });
      persist();
      toast('All the branches are open again. 🌿');
    }

    /* ------------------------------------------------------------------ */
    /* photos                                                             */
    /* ------------------------------------------------------------------ */

    function shrinkImage(file, size) {
      return new Promise(function (resolve, reject) {
        if (!file.type || file.type.indexOf('image/') !== 0) {
          reject(new Error('not-image'));
          return;
        }
        var reader = new FileReader();
        reader.onerror = function () {
          reject(new Error('read'));
        };
        reader.onload = function () {
          var image = new Image();
          image.onerror = function () {
            reject(new Error('decode'));
          };
          image.onload = function () {
            var canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');
            var side = Math.min(image.width, image.height);
            ctx.drawImage(
              image,
              (image.width - side) / 2,
              (image.height - side) / 2,
              side,
              side,
              0,
              0,
              size,
              size
            );
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          image.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    function handlePhotoFile() {
      var file = el.photoFile.files && el.photoFile.files[0];
      el.photoFile.value = '';
      var target = photoTarget;
      photoTarget = null;
      if (!file || !target) return;

      toast('Adding the photo…', null, null, 2500);
      shrinkImage(file, 640)
        .then(function (dataUrl) {
          if (!state.people[target]) return;
          commit(
            function () {
              state.people[target].photo = dataUrl;
            },
            { message: 'Photo added! 📸', sfx: false }
          );
          playSound('chime');
          if (selectedId === target) fillPanel(target);
        })
        .catch(function (error) {
          toast(
            error && error.message === 'not-image'
              ? 'Please pick a picture file.'
              : 'That picture would not open. Try a JPG or PNG.',
            null,
            5200
          );
        });
    }

    /* ------------------------------------------------------------------ */
    /* lightbox                                                           */
    /* ------------------------------------------------------------------ */

    function lightboxList() {
      return Object.keys(state.people).slice().sort(function (a, b) {
        var ga = model.gens[a] || 0;
        var gb = model.gens[b] || 0;
        if (ga !== gb) return ga - gb;
        return String(state.people[a].name).localeCompare(String(state.people[b].name));
      });
    }

    function fillLightbox() {
      var person = state.people[lightboxId];
      if (!person) return;
      setAvatar(el.lightboxPhoto, person);
      el.lightboxName.textContent = person.name;
      el.lightboxRelation.textContent = person.relation || '';
      el.lightboxFact.textContent = person.funFact || '';
    }

    function openLightbox(id) {
      if (!state.people[id]) return;
      lightboxId = id;
      fillLightbox();
      el.lightbox.hidden = false;
      el.lightboxClose.focus();
    }

    function closeLightbox() {
      el.lightbox.hidden = true;
      lightboxId = null;
    }

    function stepLightbox(direction) {
      var list = lightboxList();
      if (!list.length) return;
      var index = list.indexOf(lightboxId);
      if (index === -1) index = 0;
      lightboxId = list[(index + direction + list.length) % list.length];
      fillLightbox();
      playSound('blip');
    }

    /* ------------------------------------------------------------------ */
    /* story mode                                                         */
    /* ------------------------------------------------------------------ */

    function namesOf(people) {
      var names = people.map(function (person) {
        return person.name;
      });
      if (!names.length) return '';
      if (names.length === 1) return names[0];
      return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
    }

    function describe(person) {
      if (person.funFact) return person.funFact;
      var parents = (person.parentIds || [])
        .map(function (id) {
          return state.people[id];
        })
        .filter(Boolean);
      if (parents.length) return 'A branch growing out of ' + namesOf(parents) + '.';
      var partners = (person.partnerIds || [])
        .map(function (id) {
          return state.people[id];
        })
        .filter(Boolean);
      if (partners.length) return 'One of the roots, married to ' + namesOf(partners) + '.';
      return 'One of the deep roots of our family tree.';
    }

    function clearStoryFocus() {
      Array.prototype.forEach.call(el.nodes.children, function (node) {
        node.classList.remove('story-focus');
      });
    }

    function startStory() {
      if (!Object.keys(state.people).length) return;
      state.collapsed = [];
      rebuild({ fit: true });
      persist();
      closePanel();
      selectedId = null;
      renderer.render(model, state, null);

      story.order = Object.keys(state.people).slice().sort(function (a, b) {
        var ga = model.gens[a] || 0;
        var gb = model.gens[b] || 0;
        if (ga !== gb) return ga - gb;
        var na = model.nodeById[a];
        var nb = model.nodeById[b];
        return (na ? na.x : 0) - (nb ? nb.x : 0);
      });
      story.active = true;
      story.index = 0;
      el.storyCard.hidden = false;
      el.hint.hidden = true;
      showStoryStep(0);
    }

    function showStoryStep(index) {
      if (!story.active) return;
      story.index = clamp(index, 0, story.order.length - 1);
      var id = story.order[story.index];
      var person = state.people[id];
      var node = model.nodeById[id];
      if (!person) return;

      clearStoryFocus();
      var nodeEl = findNodeEl(id);
      if (nodeEl) nodeEl.classList.add('story-focus');

      if (node) {
        camera.animateTo(
          node.x,
          node.y + 70,
          Math.max(0.9, Math.min(1.25, camera.get().scale)),
          620
        );
        lastFit = null;
      }

      el.storyStep.textContent = story.index + 1 + ' of ' + story.order.length;
      el.storyName.textContent = person.name;
      el.storyText.textContent = describe(person);
      setAvatar(el.storyAvatar, person);
      el.storyBack.disabled = story.index === 0;
      el.storyNext.textContent =
        story.index === story.order.length - 1 ? 'Finish 🎉' : 'Next →';
      playSound(story.index === 0 ? 'chime' : 'blip');
    }

    function stopStory() {
      story.active = false;
      el.storyCard.hidden = true;
      clearStoryFocus();
    }

    function finishStory() {
      stopStory();
      confettiBurst(null);
      playSound('chime');
      toast('That is the whole family — all the way to the newest leaf! 🌳');
    }

    function nextStory() {
      if (!story.active) return;
      if (story.index >= story.order.length - 1) finishStory();
      else showStoryStep(story.index + 1);
    }

    function prevStory() {
      if (!story.active) return;
      showStoryStep(story.index - 1);
    }

    /* ------------------------------------------------------------------ */
    /* sound                                                              */
    /* ------------------------------------------------------------------ */

    function playSound(kind) {
      if (state.view.muted) return;
      try {
        var Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return;
        audio = audio || new Ctx();
        if (audio.state === 'suspended') audio.resume();

        var notes =
          kind === 'chime' ? [523.25, 659.25, 783.99] : kind === 'pop' ? [440, 587.33] : [392];
        var now = audio.currentTime;

        notes.forEach(function (frequency, index) {
          var oscillator = audio.createOscillator();
          var gain = audio.createGain();
          oscillator.type = kind === 'pop' ? 'sine' : 'triangle';
          oscillator.frequency.value = frequency;
          var start = now + index * 0.075;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
          oscillator.connect(gain);
          gain.connect(audio.destination);
          oscillator.start(start);
          oscillator.stop(start + 0.46);
        });
      } catch (e) {
        /* audio is a nice-to-have */
      }
    }

    function refreshMute() {
      el.muteBtn.textContent = state.view.muted ? '🔇' : '🔊';
      el.muteBtn.setAttribute('aria-pressed', state.view.muted ? 'true' : 'false');
      el.muteBtn.title = state.view.muted ? 'Sound is off' : 'Sound is on';
      el.menuMuteBtn.textContent = 'Sound: ' + (state.view.muted ? 'off' : 'on');
    }

    /* ------------------------------------------------------------------ */
    /* confetti                                                           */
    /* ------------------------------------------------------------------ */

    function confettiBurst(nodeId) {
      if (reduced) return;
      var node = nodeId ? model.nodeById[nodeId] : null;
      var rect = el.viewport.getBoundingClientRect();
      var origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      if (node) {
        var point = camera.worldToScreen(node.x, node.y);
        origin = { x: rect.left + point.x, y: rect.top + point.y };
      }

      for (var i = 0; i < 110; i++) {
        var angle = Math.random() * Math.PI * 2;
        var speed = 3 + Math.random() * 9;
        confettiParts.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          r: 3 + Math.random() * 5,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          life: 1
        });
      }

      if (!confettiRaf) confettiRaf = global.requestAnimationFrame(confettiTick);
    }

    function confettiTick() {
      var canvas = el.confetti;
      var ctx = canvas.getContext('2d');
      var dpr = Math.min(2, global.devicePixelRatio || 1);
      var w = global.innerWidth;
      var h = global.innerHeight;

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var alive = [];
      for (var i = 0; i < confettiParts.length; i++) {
        var particle = confettiParts[i];
        particle.vy += 0.28;
        particle.vx *= 0.99;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rot += particle.vr;
        particle.life -= 0.008;
        if (particle.life <= 0 || particle.y > h + 40) continue;

        alive.push(particle);
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rot);
        ctx.globalAlpha = clamp(particle.life, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.r, -particle.r * 0.6, particle.r * 2, particle.r * 1.2);
        ctx.restore();
      }

      confettiParts = alive;
      if (alive.length) {
        confettiRaf = global.requestAnimationFrame(confettiTick);
      } else {
        confettiRaf = null;
        ctx.clearRect(0, 0, w, h);
      }
    }

    /* ------------------------------------------------------------------ */
    /* toasts + dialogs                                                   */
    /* ------------------------------------------------------------------ */

    function toast(message, actionLabel, action, duration) {
      clearTimeout(toastTimer);
      el.toastText.textContent = message;

      if (action) {
        el.toastAction.hidden = false;
        el.toastAction.textContent = actionLabel || 'Undo';
        el.toastAction.onclick = function () {
          clearTimeout(toastTimer);
          el.toast.hidden = true;
          action();
        };
      } else {
        el.toastAction.hidden = true;
        el.toastAction.onclick = null;
      }

      el.toast.hidden = false;
      toastTimer = global.setTimeout(function () {
        el.toast.hidden = true;
      }, duration || 4200);
    }

    function askConfirm(title, text, okLabel, action) {
      el.confirmTitle.textContent = title;
      el.confirmText.textContent = text;
      el.confirmOk.textContent = okLabel || 'Yes';
      confirmAction = action;
      el.confirm.hidden = false;
      el.confirmOk.focus();
    }

    function closeConfirm() {
      el.confirm.hidden = true;
      confirmAction = null;
    }

    /* ------------------------------------------------------------------ */
    /* backups                                                            */
    /* ------------------------------------------------------------------ */

    function exportBackup() {
      var blob = new Blob([FT.data.exportPayload(state)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'family-tree-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      global.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 1500);
      toast('Backup saved to your downloads.');
    }

    function importBackup(file) {
      var reader = new FileReader();
      reader.onerror = function () {
        toast('That file would not open.', null, 4200);
      };
      reader.onload = function () {
        var next = FT.data.parseImport(String(reader.result));
        if (!next) {
          toast('That file does not look like a family tree backup.', null, 5200);
          return;
        }
        askConfirm('Load this backup?', 'It will replace the tree on this page.', 'Load it', function () {
          state = next;
          selectedId = null;
          closePanel();
          FT.data.save(state);
          rebuild({ fit: true });
          toast('Backup loaded! 🌳');
        });
      };
      reader.readAsText(file);
    }

    /* ------------------------------------------------------------------ */
    /* menu + help                                                        */
    /* ------------------------------------------------------------------ */

    function toggleMenu(open) {
      var next = typeof open === 'boolean' ? open : el.menu.hidden;
      el.menu.hidden = !next;
      el.menuBtn.setAttribute('aria-expanded', next ? 'true' : 'false');
    }

    function syncSizeButtons() {
      Array.prototype.forEach.call(document.querySelectorAll('.size-btn'), function (button) {
        var active = button.dataset.size === state.view.photoSize;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      el.menuSizeBtn.textContent = 'Photo size: ' + state.view.photoSize.toUpperCase();
    }

    /* ------------------------------------------------------------------ */
    /* wiring                                                             */
    /* ------------------------------------------------------------------ */

    function bind() {
      // nodes
      el.nodes.addEventListener('click', function (event) {
        var node = event.target.closest('.node');
        if (!node) return;
        if (story.active) stopStory();
        var id = node.dataset.id;

        if (event.target.closest('.edit-dot')) {
          photoTarget = id;
          el.photoFile.click();
          return;
        }
        if (event.target.closest('.node-photo')) {
          openLightbox(id);
          return;
        }
        selectPerson(id);
      });

      el.nodes.addEventListener('keydown', function (event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        var node = event.target.closest('.node');
        if (!node) return;
        event.preventDefault();
        if (story.active) stopStory();
        selectPerson(node.dataset.id);
      });

      el.chips.addEventListener('click', function (event) {
        var chip = event.target.closest('.chip');
        if (!chip) return;
        toggleCollapse(chip.dataset.unit);
      });

      // background click clears the selection
      el.viewport.addEventListener('click', function (event) {
        if (event.target.closest('.node, .chip, button, .panel, .zoom-dock, .story-card')) return;
        if (panTracker && panTracker.wasPanning()) return;
        if (selectedId) deselect();
      });

      // zoom
      el.zoomIn.addEventListener('click', function () {
        camera.zoomCenter(1.25);
      });
      el.zoomOut.addEventListener('click', function () {
        camera.zoomCenter(0.8);
      });
      el.zoomFit.addEventListener('click', function () {
        doFit('all');
      });

      // panel fields
      el.fName.addEventListener('input', function () {
        if (filling || !selectedId) return;
        var person = state.people[selectedId];
        if (!person) return;
        person.name = el.fName.value.slice(0, 28) || 'Someone';
        el.panelTitle.textContent = person.name;
        renderer.render(model, state, selectedId);
        scheduleSave();
      });

      el.fRelation.addEventListener('input', function () {
        if (filling || !selectedId) return;
        var person = state.people[selectedId];
        if (!person) return;
        person.relation = el.fRelation.value.slice(0, 24);
        el.panelSub.textContent = person.relation || 'Family member';
        renderer.render(model, state, selectedId);
        scheduleSave();
      });

      el.fFun.addEventListener('input', function () {
        if (filling || !selectedId) return;
        var person = state.people[selectedId];
        if (!person) return;
        person.funFact = el.fFun.value.slice(0, 140);
        scheduleSave();
      });

      el.panelClose.addEventListener('click', deselect);
      el.panelUpload.addEventListener('click', function () {
        if (!selectedId) return;
        photoTarget = selectedId;
        el.photoFile.click();
      });
      el.addChild.addEventListener('click', function () {
        addPerson('child');
      });
      el.addPartner.addEventListener('click', function () {
        addPerson('partner');
      });
      el.addSibling.addEventListener('click', function () {
        addPerson('sibling');
      });
      el.deletePerson.addEventListener('click', askDelete);
      el.photoFile.addEventListener('change', handlePhotoFile);

      // toolbar
      el.storyBtn.addEventListener('click', startStory);
      el.addRootBtn.addEventListener('click', addRoot);
      el.collapseAllBtn.addEventListener('click', collapseAll);
      el.expandAllBtn.addEventListener('click', expandAll);

      function makePoster() {
        playSound('blip');
        toast('Making your poster…', null, null, 8000);
        FT.poster
          .download(state, model)
          .then(function () {
            toast('Poster saved! 🖼');
          })
          .catch(function () {
            toast('Poster failed. Try Print instead.', null, 5000);
          });
      }

      function toggleMute() {
        state.view.muted = !state.view.muted;
        refreshMute();
        persist();
        if (!state.view.muted) playSound('chime');
      }

      function setPhotoSize(size) {
        if (!size || state.view.photoSize === size) return;
        state.view.photoSize = size;
        syncSizeButtons();
        rebuild();
        doFit();
        persist();
        playSound('blip');
      }

      function cyclePhotoSize() {
        var order = ['s', 'm', 'l'];
        setPhotoSize(order[(order.indexOf(state.view.photoSize) + 1) % order.length]);
      }

      el.posterBtn.addEventListener('click', makePoster);
      el.muteBtn.addEventListener('click', toggleMute);

      Array.prototype.forEach.call(document.querySelectorAll('.size-btn'), function (button) {
        button.addEventListener('click', function () {
          setPhotoSize(button.dataset.size);
        });
      });

      el.menuPosterBtn.addEventListener('click', function () {
        toggleMenu(false);
        makePoster();
      });
      el.menuSizeBtn.addEventListener('click', function () {
        toggleMenu(false);
        cyclePhotoSize();
      });
      el.menuCollapseBtn.addEventListener('click', function () {
        toggleMenu(false);
        collapseAll();
      });
      el.menuExpandBtn.addEventListener('click', function () {
        toggleMenu(false);
        expandAll();
      });
      el.menuMuteBtn.addEventListener('click', function () {
        toggleMenu(false);
        toggleMute();
      });

      // story controls
      el.storyNext.addEventListener('click', nextStory);
      el.storyBack.addEventListener('click', prevStory);
      el.storyStop.addEventListener('click', stopStory);

      // lightbox
      el.lightboxClose.addEventListener('click', closeLightbox);
      el.lightboxPrev.addEventListener('click', function () {
        stepLightbox(-1);
      });
      el.lightboxNext.addEventListener('click', function () {
        stepLightbox(1);
      });
      el.lightbox.addEventListener('click', function (event) {
        if (event.target === el.lightbox) closeLightbox();
      });

      // menu
      el.menuBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        toggleMenu();
      });
      document.addEventListener('click', function (event) {
        if (!el.menu.hidden && !event.target.closest('.menu-wrap')) toggleMenu(false);
      });

      el.exportBtn.addEventListener('click', function () {
        toggleMenu(false);
        exportBackup();
      });
      el.importBtn.addEventListener('click', function () {
        toggleMenu(false);
        el.importFile.click();
      });
      el.importFile.addEventListener('change', function () {
        var file = el.importFile.files && el.importFile.files[0];
        el.importFile.value = '';
        if (file) importBackup(file);
      });
      el.printBtn.addEventListener('click', function () {
        toggleMenu(false);
        toast('Getting the poster ready to print…', null, null, 8000);
        FT.poster
          .print(state, model)
          .then(function () {
            toast('Print dialog opened 🖨');
          })
          .catch(function () {
            toast('Printing did not work. Try the poster button instead.', null, 5000);
          });
      });
      el.helpBtn.addEventListener('click', function () {
        toggleMenu(false);
        el.help.hidden = false;
      });
      el.helpClose.addEventListener('click', function () {
        el.help.hidden = true;
      });
      el.help.addEventListener('click', function (event) {
        if (event.target === el.help) el.help.hidden = true;
      });
      el.resetBtn.addEventListener('click', function () {
        toggleMenu(false);
        askConfirm(
          'Start from the sample family?',
          'Your names, photos and fun facts on this page will be replaced.',
          'Yes, start fresh',
          function () {
            state = FT.data.seedState();
            FT.data.clear();
            FT.data.save(state);
            selectedId = null;
            closePanel();
            syncSizeButtons();
            rebuild({ fit: true });
            toast('A fresh little tree! 🌱');
          }
        );
      });

      // confirm
      el.confirmCancel.addEventListener('click', closeConfirm);
      el.confirmOk.addEventListener('click', function () {
        var action = confirmAction;
        closeConfirm();
        if (action) action();
      });

      // hint
      el.hintClose.addEventListener('click', function () {
        el.hint.hidden = true;
        try {
          global.localStorage.setItem(HINT_KEY, '1');
        } catch (e) {
          /* ignore */
        }
      });

      // keyboard
      document.addEventListener('keydown', function (event) {
        var tag = (event.target.tagName || '').toLowerCase();
        var typing = tag === 'input' || tag === 'textarea' || event.target.isContentEditable;

        if (event.key === 'Escape') {
          if (!el.lightbox.hidden) return closeLightbox();
          if (!el.confirm.hidden) return closeConfirm();
          if (!el.help.hidden) {
            el.help.hidden = true;
            return;
          }
          if (story.active) return stopStory();
          if (!el.menu.hidden) return toggleMenu(false);
          if (selectedId) return deselect();
          return;
        }

        if (typing) return;

        if (event.key === '+' || event.key === '=') {
          event.preventDefault();
          camera.zoomCenter(1.25);
        } else if (event.key === '-' || event.key === '_') {
          event.preventDefault();
          camera.zoomCenter(0.8);
        } else if (event.key === '0') {
          event.preventDefault();
          doFit('all');
        } else if (story.active && event.key === 'ArrowRight') {
          nextStory();
        } else if (story.active && event.key === 'ArrowLeft') {
          prevStory();
        } else if (document.activeElement === el.viewport) {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            camera.panBy(70, 0);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            camera.panBy(-70, 0);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            camera.panBy(0, 70);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            camera.panBy(0, -70);
          }
        }
      });

      global.addEventListener('resize', function () {
        if (!model) return;
        if (lastFit != null && Math.abs(camera.get().scale - lastFit) < 0.003) {
          doFit(lastFitMode);
        } else {
          camera.setWorld(model.world.w, model.world.h);
        }
      });
    }

    function start() {
      var savedScale = Number.isFinite(state.view.scale) ? state.view.scale : null;
      var savedTx = state.view.tx;
      var savedTy = state.view.ty;

      panTracker = camera.bind();
      bind();
      refreshMute();
      syncSizeButtons();
      rebuild();

      // Read the saved camera before rebuilding: setWorld already reports the
      // neutral 100% transform through onChange, which would overwrite it.
      if (global.location && /[?&]fit=all/.test(global.location.search)) {
        doFit('all');
      } else if (savedScale != null) {
        camera.set({ scale: savedScale, tx: savedTx, ty: savedTy });
        lastFit = null;
      } else {
        doFit();
      }

      var hintSeen = false;
      try {
        hintSeen = global.localStorage.getItem(HINT_KEY) === '1';
      } catch (e) {
        /* ignore */
      }
      el.hint.hidden = hintSeen;

      started = true;
    }

    return { start: start };
  };
})(typeof window !== 'undefined' ? window : globalThis);
