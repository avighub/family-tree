(function (global) {
  'use strict';

  var FT = (global.FT = global.FT || {});

  var STORAGE_KEY = 'familyTree.v2';
  var VERSION = 2;
  var PHOTO_SIZES = { s: 110, m: 150, l: 200 };
  var FRAMES = ['leaf', 'apple', 'flower', 'nest'];

  function uid(prefix) {
    return (prefix || 'p_') + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-4);
  }

  function person(id, name, relation, extra) {
    return Object.assign(
      {
        id: id,
        name: name,
        relation: relation,
        emoji: '🙂',
        photo: null,
        frame: 'leaf',
        stickers: [],
        funFact: '',
        parentIds: [],
        partnerIds: [],
        order: 0
      },
      extra || {}
    );
  }

  function seedState() {
    var people = {};
    function add(p) {
      people[p.id] = p;
    }

    add(person('ggpa', 'Great-Grandpa', 'Great-Grandpa', {
      emoji: '🧓',
      partnerIds: ['ggma'],
      order: 0,
      funFact: 'He built the little red bench down by the pond.'
    }));
    add(person('ggma', 'Great-Grandma', 'Great-Grandma', {
      emoji: '👵',
      partnerIds: ['ggpa'],
      order: 1,
      funFact: 'She made jam from the berries behind the tree.'
    }));
    add(person('gpa', 'Grandpa', 'Grandpa', {
      emoji: '👴',
      parentIds: ['ggpa', 'ggma'],
      partnerIds: ['gma'],
      order: 0,
      funFact: 'He tells the best pirate stories, with voices.'
    }));
    add(person('rosa', 'Great-Aunt Rosa', 'Great-Aunt', {
      emoji: '👩‍🦰',
      parentIds: ['ggpa', 'ggma'],
      order: 2,
      funFact: 'She keeps bees and sends honey in tiny jars.'
    }));
    add(person('gma', 'Grandma', 'Grandma', {
      emoji: '👵',
      partnerIds: ['gpa'],
      order: 1,
      funFact: 'She grows the tallest sunflowers in the garden.'
    }));
    add(person('mom', 'Mom', 'Mom', {
      emoji: '👩',
      parentIds: ['gpa', 'gma'],
      partnerIds: ['dad'],
      order: 0,
      funFact: 'She can juggle three oranges. Sometimes four.'
    }));
    add(person('dad', 'Dad', 'Dad', {
      emoji: '👨',
      partnerIds: ['mom'],
      order: 1,
      funFact: 'He makes pancake faces every Sunday morning.'
    }));
    add(person('leo', 'Uncle Leo', 'Uncle', {
      emoji: '🧔',
      parentIds: ['gpa', 'gma'],
      partnerIds: ['priya'],
      order: 1,
      funFact: 'He can whistle with two fingers, and it is LOUD.'
    }));
    add(person('priya', 'Aunt Priya', 'Aunt', {
      emoji: '👩🏽',
      partnerIds: ['leo'],
      order: 2,
      funFact: 'She paints tiny pictures of the garden.'
    }));
    add(person('you', 'You', 'Kid', {
      emoji: '🧒',
      parentIds: ['mom', 'dad'],
      order: 0,
      funFact: 'That is you — the newest leaf on the whole tree!'
    }));
    add(person('sam', 'Sam', 'Little sibling', {
      emoji: '👶',
      parentIds: ['mom', 'dad'],
      order: 1,
      funFact: 'Loves mud puddles and singing very loud.'
    }));
    add(person('mia', 'Mia', 'Cousin', {
      emoji: '👧🏽',
      parentIds: ['leo', 'priya'],
      order: 0,
      funFact: 'Your cousin. She is not scared of spiders at all.'
    }));

    return {
      version: VERSION,
      meta: { title: 'Our Family Tree', updatedAt: Date.now() },
      view: { photoSize: 'm', scale: null, tx: 0, ty: 0, muted: false },
      collapsed: [],
      people: people
    };
  }

  function isObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function str(v, max, fallback) {
    if (typeof v !== 'string') return fallback;
    return v.slice(0, max);
  }

  function unique(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (out.indexOf(list[i]) === -1) out.push(list[i]);
    }
    return out;
  }

  function validate(raw) {
    if (!isObject(raw) || !isObject(raw.people)) return null;

    var people = {};
    var ids = Object.keys(raw.people);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var p = raw.people[id];
      if (!isObject(p)) continue;
      people[id] = person(
        id,
        str(p.name, 40, 'Someone') || 'Someone',
        str(p.relation, 40, ''),
        {
          emoji: str(p.emoji, 8, '🙂') || '🙂',
          photo: typeof p.photo === 'string' && /^data:image\//.test(p.photo) ? p.photo : null,
          frame: FRAMES.indexOf(p.frame) !== -1 ? p.frame : 'leaf',
          stickers: Array.isArray(p.stickers)
            ? p.stickers.filter(function (s) { return typeof s === 'string' && s.length <= 8; }).slice(0, 3)
            : [],
          funFact: str(p.funFact, 200, ''),
          order: Number.isFinite(p.order) ? p.order : 0
        }
      );
    }

    if (!Object.keys(people).length) return null;

    Object.keys(people).forEach(function (id) {
      var source = raw.people[id];
      var target = people[id];
      target.parentIds = unique(
        (Array.isArray(source.parentIds) ? source.parentIds : [])
          .filter(function (pid) { return typeof pid === 'string' && pid !== id && people[pid]; })
      ).slice(0, 2);
      target.partnerIds = unique(
        (Array.isArray(source.partnerIds) ? source.partnerIds : [])
          .filter(function (pid) { return typeof pid === 'string' && pid !== id && people[pid]; })
      ).slice(0, 2);
    });

    Object.keys(people).forEach(function (id) {
      people[id].partnerIds.forEach(function (pid) {
        if (people[pid].partnerIds.indexOf(id) === -1) people[pid].partnerIds.push(id);
      });
    });

    var view = isObject(raw.view) ? raw.view : {};
    var collapsed = Array.isArray(raw.collapsed)
      ? raw.collapsed.filter(function (c) { return typeof c === 'string'; })
      : [];

    return {
      version: VERSION,
      meta: {
        title: str(isObject(raw.meta) ? raw.meta.title : '', 60, 'Our Family Tree') || 'Our Family Tree',
        updatedAt: Date.now()
      },
      view: {
        photoSize: PHOTO_SIZES[view.photoSize] ? view.photoSize : 'm',
        scale: Number.isFinite(view.scale) ? view.scale : null,
        tx: Number.isFinite(view.tx) ? view.tx : 0,
        ty: Number.isFinite(view.ty) ? view.ty : 0,
        muted: !!view.muted
      },
      collapsed: collapsed,
      people: people
    };
  }

  var memory = { json: null };

  function load() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        var loaded = validate(JSON.parse(raw));
        if (loaded) return loaded;
      }
    } catch (e) {
      /* fall through */
    }
    if (memory.json) {
      try {
        var remembered = validate(JSON.parse(memory.json));
        if (remembered) return remembered;
      } catch (e2) {
        /* fall through */
      }
    }
    return seedState();
  }

  function save(state) {
    if (state.meta) state.meta.updatedAt = Date.now();
    try {
      var json = JSON.stringify(state);
      if (!global.localStorage) throw new Error('no-storage');
      global.localStorage.setItem(STORAGE_KEY, json);
      memory.json = null;
      return { ok: true };
    } catch (e) {
      memory.json = JSON.stringify(state);
      return { ok: false, error: e && e.name === 'QuotaExceededError' ? 'quota' : 'unknown' };
    }
  }

  function clear() {
    memory.json = null;
    try {
      if (global.localStorage) global.localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function exportPayload(state) {
    return JSON.stringify(
      { version: VERSION, exportedAt: new Date().toISOString(), state: state },
      null,
      2
    );
  }

  function parseImport(text) {
    try {
      var parsed = JSON.parse(text);
      var candidate = isObject(parsed) && isObject(parsed.state) ? parsed.state : parsed;
      return validate(candidate);
    } catch (e) {
      return null;
    }
  }

  FT.data = {
    STORAGE_KEY: STORAGE_KEY,
    VERSION: VERSION,
    PHOTO_SIZES: PHOTO_SIZES,
    FRAMES: FRAMES,
    uid: uid,
    person: person,
    seedState: seedState,
    validate: validate,
    load: load,
    save: save,
    clear: clear,
    exportPayload: exportPayload,
    parseImport: parseImport
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FT.data;
})(typeof window !== 'undefined' ? window : globalThis);
