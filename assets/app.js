/* 천보금 입양 — 공개 사이트 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = IDCard.esc;

  var state = {
    site: {},
    rooms: [],
    dogs: [],
    query: '',
    onlyAdoptable: false,
    loaded: false,
    error: null
  };

  /* ── 테마 ───────────────────────────────────── */
  var THEME_KEY = 'adoption.theme';

  function currentTheme() {
    var saved = null;
    try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (saved === 'light' || saved === 'dark') return saved;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function paintThemeButton() {
    var dark = currentTheme() === 'dark';
    $('themeBtn').innerHTML = Icon(dark ? 'sun' : 'moon');
    $('themeBtn').setAttribute('aria-label', dark ? '밝은 화면으로' : '어두운 화면으로');
  }

  $('themeBtn').addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
    paintThemeButton();
  });

  /* ── 데이터 ─────────────────────────────────── */
  function getJSON(path) {
    return fetch(path + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' (' + r.status + ')');
      return r.json();
    });
  }

  function load() {
    return Promise.all([
      getJSON('data/site.json').catch(function () { return {}; }),
      getJSON('data/rooms.json'),
      getJSON('data/dogs.json')
    ]).then(function (r) {
      state.site = r[0] || {};
      state.rooms = (r[1].rooms || []).slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      state.dogs = r[2].dogs || [];
      state.loaded = true;
    }).catch(function (e) {
      state.error = e.message;
      state.loaded = true;
    });
  }

  /* ── 조회 헬퍼 ──────────────────────────────── */
  function hasNonAdoptable() {
    return state.dogs.some(function (d) { return d.status && d.status !== 'adoptable'; });
  }
  function visible(list) {
    return state.onlyAdoptable
      ? list.filter(function (d) { return (d.status || 'adoptable') === 'adoptable'; })
      : list;
  }
  function inRoom(id) {
    return state.dogs.filter(function (d) { return d.room === id; });
  }
  function roomOf(id) {
    return state.rooms.filter(function (r) { return r.id === id; })[0];
  }
  function search(q) {
    var k = q.trim().toLowerCase();
    if (!k) return [];
    return state.dogs.filter(function (d) {
      return [d.name, d.note, d.room, d.ageText].some(function (v) {
        return v && String(v).toLowerCase().indexOf(k) !== -1;
      });
    });
  }

  /* ── 라우팅 ─────────────────────────────────── */
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (h.indexOf('room/') === 0) return { view: 'room', room: h.slice(5) };
    if (h.indexOf('dog/') === 0) return { view: 'dog', id: h.slice(4) };
    if (h === 'rooms') return { view: 'rooms' };
    return { view: 'all' };
  }
  function go(hash) {
    if (('#' + hash) === location.hash) return;
    location.hash = hash;
  }

  /* ── 조각 ───────────────────────────────────── */
  function dogCard(dog) {
    return '<button class="' + IDCard.cardClass(dog) + '" data-dog="' + esc(dog.id) + '">' +
      IDCard.innerHTML(dog) + '</button>';
  }
  function grid(list) {
    return '<div class="dog-grid">' + list.map(dogCard).join('') + '</div>';
  }
  function empty(icon, title, desc) {
    return '<div class="empty"><div class="mark">' + Icon(icon) + '</div>' +
      '<h3>' + esc(title) + '</h3><p>' + desc + '</p></div>';
  }
  function faces(list) {
    if (!list.length) return '';
    var shown = list.slice(0, 4);
    var rest = list.length - shown.length;
    var html = shown.map(function (d) {
      return d.photo
        ? '<img class="face" src="' + esc(d.photo) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="face">' + Icon.filled('paw') + '</span>';
    }).join('');
    if (rest > 0) html += '<span class="more">+' + rest + '</span>';
    return '<div class="faces">' + html + '</div>';
  }
  /** 입양 절차 — 문의 전에 무엇을 하게 되는지 몰라 망설이는 걸 줄인다 */
  function guideHTML() {
    var steps = state.site.adoptionSteps;
    if (!steps || !steps.length) return '';
    return '<section class="guide">' +
      '<div class="eyebrow">입양 안내</div>' +
      '<h3>입양은 이렇게 진행돼요</h3>' +
      '<ol class="flow">' + steps.map(function (s) {
        return '<li><b>' + esc(s.title) + '</b><span>' + esc(s.desc) + '</span></li>';
      }).join('') + '</ol>' +
      '<a class="guide-link" href="guide.html">입양 문의 · 봉사 신청하기' + Icon('back') + '</a>' +
    '</section>';
  }

  function filterLine() {
    if (!hasNonAdoptable()) return '';
    return '<label class="filterline"><input type="checkbox" id="onlyAdoptable"' +
      (state.onlyAdoptable ? ' checked' : '') + '> 가족을 기다리는 아이만 보기</label>';
  }

  /* ── 화면 ───────────────────────────────────── */
  function renderAll() {
    var list = visible(state.dogs);
    var waiting = state.dogs.filter(function (d) { return (d.status || 'adoptable') === 'adoptable'; }).length;
    var html = '';

    if (state.site.notice) {
      html += '<div class="notice">' + Icon('heart') + '<span>' + esc(state.site.notice) + '</span></div>';
    }

    if (!state.dogs.length) {
      $('content').innerHTML = html + empty('paw', '아직 등록된 아이가 없어요',
        '보호소에서 증명사진을 등록하면<br>이곳에 아이들이 한 명씩 나타납니다.');
      return;
    }

    html += '<p class="lead">지금 <b class="accent num">' + waiting + '</b>마리가<br>가족을 기다리고 있어요.</p>';
    html += filterLine();
    html += list.length ? grid(list)
      : empty('paw', '해당하는 아이가 없어요', '필터를 끄면 다른 아이들도 볼 수 있어요.');
    html += guideHTML();
    $('content').innerHTML = html;
  }

  function renderRooms() {
    var html = '';
    if (state.site.notice) {
      html += '<div class="notice">' + Icon('heart') + '<span>' + esc(state.site.notice) + '</span></div>';
    }
    html += '<p class="lead">아이들이 지내는 <b>' + state.rooms.length + '</b>개의 방이에요.</p>';
    html += '<div class="room-list">' + state.rooms.map(function (room) {
      var list = inRoom(room.id);
      return '<button class="room-card' + (list.length ? '' : ' is-empty') + '"' +
        ' data-room="' + esc(room.id) + '" style="--room-color:' + esc(room.color || '#3E6B4C') + '">' +
        '<span class="glyph">' + esc(room.icon || '🏠') + '</span>' +
        '<span class="body">' +
          '<span class="name">' + esc(room.id) + '</span>' +
          '<span class="count">' + (list.length ? list.length + '마리가 지내요' : '아직 비어 있어요') + '</span>' +
        '</span>' +
        faces(list) +
      '</button>';
    }).join('') + '</div>';
    html += guideHTML();
    $('content').innerHTML = html;
  }

  function renderRoom(id) {
    var room = roomOf(id);
    var list = visible(inRoom(id));
    var html = '<div class="crumb" style="--room-color:' + esc(room ? (room.color || '#3E6B4C') : '#3E6B4C') + '">' +
      '<span class="glyph">' + esc(room ? (room.icon || '🏠') : '🏠') + '</span>' +
      '<span><span class="t">' + esc(id) + '</span><br>' +
      '<span class="n">' + list.length + '마리</span></span></div>';
    html += filterLine();
    html += list.length ? grid(list)
      : empty('door', '이 방에는 아직 아이가 없어요', '곧 등록될 예정입니다.');
    $('content').innerHTML = html;
  }

  function renderSearch() {
    var list = visible(search(state.query));
    var html = '<p class="lead">"' + esc(state.query.trim()) + '" 검색 결과 <b class="num">' + list.length + '</b>마리</p>';
    html += list.length ? grid(list)
      : empty('search', '찾는 아이가 없어요', '이름 일부만 입력해도 찾을 수 있어요.');
    $('content').innerHTML = html;
  }

  function setSegment(index) {
    var seg = $('viewSeg');
    seg.dataset.index = String(index);
    seg.querySelectorAll('button').forEach(function (b, i) {
      b.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
  }

  function setHead(title, sub) {
    $('pageTitle').textContent = title;
    $('pageSub').textContent = sub;
  }

  var bgRoute = { view: 'all' };

  function render() {
    if (!state.loaded) {
      $('content').innerHTML = '<div class="dog-grid" style="padding-top:12px">' +
        '<div class="skeleton" style="aspect-ratio:1/1"></div>'.repeat(4) + '</div>';
      return;
    }
    if (state.error) {
      $('content').innerHTML = empty('paw', '정보를 불러오지 못했어요',
        '잠시 후 새로고침해 주세요.<br><span style="font-size:11.5px">' + esc(state.error) + '</span>');
      return;
    }

    var r = route();
    var searching = !!state.query.trim();

    // 상세 시트가 열려 있는 동안에는 뒤 화면을 그대로 둔다
    // (방에서 열었는데 뒤가 '전체 보기'로 바뀌어 버리지 않도록)
    if (r.view !== 'dog') bgRoute = r;
    var bg = r.view === 'dog' ? bgRoute : r;

    $('viewSeg').hidden = searching;

    if (searching) {
      setHead('검색', '이름 · 특징으로 찾기');
      $('backBtn').hidden = false;
      renderSearch();
    } else if (bg.view === 'room') {
      setSegment(1);
      setHead(bg.room, roomOf(bg.room) ? '이 방의 아이들' : '알 수 없는 방');
      $('backBtn').hidden = false;
      renderRoom(bg.room);
    } else if (bg.view === 'rooms') {
      setSegment(1);
      setHead(state.site.title || '천보금 입양', state.site.tagline || '가족을 기다리는 아이들');
      $('backBtn').hidden = true;
      renderRooms();
    } else {
      setSegment(0);
      setHead(state.site.title || '천보금 입양', state.site.tagline || '가족을 기다리는 아이들');
      $('backBtn').hidden = true;
      renderAll();
    }

    if (r.view === 'dog') openSheet(r.id); else closeSheet();
  }

  /* ── 상세 시트 ──────────────────────────────── */
  var sheetOpenId = null;

  /** 지금 보고 있던 목록 — 이전·다음은 이 순서를 따른다 */
  function currentList() {
    if (state.query.trim()) return visible(search(state.query));
    if (bgRoute.view === 'room') return visible(inRoom(bgRoute.room));
    return visible(state.dogs);
  }

  function openSheet(id) {
    var dog = state.dogs.filter(function (d) { return d.id === id; })[0];
    if (!dog) { toast('해당 아이를 찾을 수 없어요.'); history.replaceState(null, '', '#'); return; }
    if (sheetOpenId === id) return;
    var isFirstOpen = sheetOpenId === null;
    sheetOpenId = id;

    // 이전·다음
    var list = currentList();
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; break; }
    $('prevDog').disabled = idx <= 0;
    $('nextDog').disabled = idx < 0 || idx >= list.length - 1;
    $('dogPos').textContent = idx >= 0 ? (idx + 1) + ' / ' + list.length : '';
    $('prevDog').dataset.go = idx > 0 ? list[idx - 1].id : '';
    $('nextDog').dataset.go = (idx >= 0 && idx < list.length - 1) ? list[idx + 1].id : '';

    var st = IDCard.status(dog);
    var facts = [['방', dog.room], ['성별', dog.gender === '남' ? '남아' : dog.gender === '여' ? '여아' : '미상']]
      .filter(function (f) { return f[1]; });

    var c = state.site.contact || {};
    var cta = '';
    if (c.kakaoUrl) cta += '<a class="btn btn-primary" href="' + esc(c.kakaoUrl) + '" target="_blank" rel="noopener">' + Icon('chat') + esc(dog.name) + ' 문의하기</a>';
    if (c.phone) cta += '<a class="btn" href="tel:' + esc(c.phone) + '">' + Icon('phone') + '전화</a>';
    if (!cta) cta = '<button class="btn btn-primary" id="closeSheet2">닫기</button>';

    var subBits = [];
    if (dog.ageText) subBits.push(dog.ageText);
    if (dog.status && dog.status !== 'adoptable') subBits.push(st.label);

    $('sheetBody').innerHTML =
      '<div class="detail-photo">' +
        (dog.photo ? '<img src="' + esc(dog.photo) + '" alt="' + esc(dog.name) + ' 증명사진">'
                   : '<div class="placeholder">' + Icon.filled('paw') + '</div>') +
      '</div>' +
      '<div class="detail-head"><h2>' + esc(dog.name || '이름 미정') + '</h2>' +
        (dog.status && dog.status !== 'adoptable'
          ? '<span class="badge ' + st.cls + '">' + st.label + '</span>' : '') +
      '</div>' +
      '<div class="detail-sub">' + esc(subBits.join(' · ')) + '</div>' +
      '<dl class="facts">' + facts.map(function (f) {
        return '<div class="fact"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>';
      }).join('') + '</dl>' +
      (dog.note ? '<div class="note-box">' + esc(dog.note) + '</div>' : '') +
      '<div class="sheet-actions">' +
        '<button class="btn" id="saveCard">' + Icon('download') + '증명사진 저장</button>' +
        '<button class="btn" id="shareLink">' + Icon('share') + '링크 공유</button>' +
      '</div>' +
      '<div class="sheet-cta' + (c.kakaoUrl && c.phone ? ' two' : '') + '">' + cta + '</div>';

    $('sheet').scrollTop = 0;
    if ($('closeSheet2')) $('closeSheet2').onclick = function () { history.back(); };

    $('backdrop').hidden = false;
    $('sheet').hidden = false;
    if (isFirstOpen) {
      requestAnimationFrame(function () {
        $('backdrop').classList.add('show');
        $('sheet').classList.add('show');
      });
    }
    document.body.style.overflow = 'hidden';

    $('saveCard').onclick = function () {
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '만드는 중…';
      IDCard.saveOrShare(dog).then(function (how) {
        toast(how === 'shared' ? '공유했어요.' : how === 'cancelled' ? '' : '증명사진을 저장했어요.');
      }).catch(function (e) {
        toast(e.message || '저장하지 못했어요.');
      }).then(function () {
        btn.disabled = false;
        btn.innerHTML = Icon('download') + '증명사진 저장';
      });
    };
    $('shareLink').onclick = function () {
      var url = location.origin + location.pathname + '#dog/' + encodeURIComponent(dog.id);
      if (navigator.share) {
        navigator.share({ title: dog.name + ' — 천보금 입양', url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast('링크를 복사했어요.'); });
      } else {
        prompt('링크를 복사하세요', url);
      }
    };
  }

  function closeSheet() {
    if (sheetOpenId === null) return;
    sheetOpenId = null;
    $('backdrop').classList.remove('show');
    $('sheet').classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (sheetOpenId === null) { $('backdrop').hidden = true; $('sheet').hidden = true; }
    }, 300);
  }

  /* ── 토스트 ─────────────────────────────────── */
  var toastTimer;
  function toast(msg) {
    if (!msg) return;
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ── 이벤트 ─────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var room = e.target.closest('[data-room]');
    if (room) { go('room/' + encodeURIComponent(room.dataset.room)); return; }
    var dog = e.target.closest('[data-dog]');
    if (dog) { go('dog/' + encodeURIComponent(dog.dataset.dog)); return; }
    var seg = e.target.closest('[data-view]');
    if (seg) { go(seg.dataset.view === 'rooms' ? 'rooms' : ''); return; }
  });

  document.addEventListener('change', function (e) {
    if (e.target.id === 'onlyAdoptable') {
      state.onlyAdoptable = e.target.checked;
      render();
    }
  });

  $('backdrop').addEventListener('click', function () { history.back(); });

  $('backBtn').addEventListener('click', function () {
    if (state.query.trim()) { clearSearch(); return; }
    go('rooms');
  });

  function clearSearch() {
    state.query = '';
    $('searchInput').value = '';
    $('searchwrap').hidden = true;
    render();
  }

  $('searchBtn').addEventListener('click', function () {
    var w = $('searchwrap');
    if (w.hidden) { w.hidden = false; $('searchInput').focus(); }
    else if (state.query) clearSearch();
    else w.hidden = true;
  });

  var searchTimer;
  $('searchInput').addEventListener('input', function (e) {
    var v = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { state.query = v; render(); }, 180);
  });

  window.addEventListener('hashchange', render);

  /* 시트 상단 고정 버튼 (내용이 바뀌어도 유지되므로 한 번만 연결) */
  $('closeSheet').addEventListener('click', function () { history.back(); });
  ['prevDog', 'nextDog'].forEach(function (id) {
    $(id).addEventListener('click', function () {
      var next = this.dataset.go;
      if (next) go('dog/' + encodeURIComponent(next));
    });
  });

  document.addEventListener('keydown', function (e) {
    if (!sheetOpenId) return;
    if (e.key === 'Escape') history.back();
    if (e.key === 'ArrowLeft' && !$('prevDog').disabled) $('prevDog').click();
    if (e.key === 'ArrowRight' && !$('nextDog').disabled) $('nextDog').click();
  });

  /* ── 시작 ───────────────────────────────────── */
  $('backBtn').innerHTML = Icon('back');
  $('searchBtn').innerHTML = Icon('search');
  $('prevDog').innerHTML = Icon('back');
  $('nextDog').innerHTML = Icon('back');
  $('closeSheet').innerHTML = Icon('close');
  paintThemeButton();
  render();

  load().then(function () {
    var title = state.site.title || '천보금 입양';
    var tagline = state.site.tagline || '가족을 기다리는 아이들';
    document.title = title + ' — ' + tagline;

    var c = state.site.contact || {};
    var bits = [];
    if (c.phone) bits.push('<a href="tel:' + esc(c.phone) + '">' + esc(c.phone) + '</a>');
    if (c.instagram) bits.push('<a href="' + esc(c.instagram) + '" target="_blank" rel="noopener">인스타그램</a>');
    $('footContact').innerHTML = bits.join(' · ');

    render();
  });
})();
