/* 천보금 입양 — 공개 사이트 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = IDCard.esc;

  var state = {
    site: null,
    rooms: [],
    dogs: [],
    query: '',
    onlyAdoptable: false,
    loaded: false,
    error: null
  };

  /* ── 데이터 로드 ─────────────────────────────── */
  function getJSON(path) {
    return fetch(path + '?v=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' (' + r.status + ')');
      return r.json();
    });
  }

  function load() {
    return Promise.all([
      getJSON('data/site.json').catch(function () { return null; }),
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

  /* ── 필터 ───────────────────────────────────── */
  function visible(list) {
    return list.filter(function (d) {
      return !state.onlyAdoptable || d.status === 'adoptable';
    });
  }

  function inRoom(roomId) {
    return state.dogs.filter(function (d) { return d.room === roomId; });
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
    return { view: 'home' };
  }

  function go(hash) {
    if (('#' + hash) === location.hash) return;
    location.hash = hash;
  }

  /* ── 렌더링 ─────────────────────────────────── */
  function dogCardHTML(dog) {
    return '<button class="' + IDCard.cardClass(dog) + '" data-dog="' + esc(dog.id) + '">' +
      IDCard.innerHTML(dog) + '</button>';
  }

  function gridHTML(list) {
    return '<div class="dog-grid">' + list.map(dogCardHTML).join('') + '</div>';
  }

  function emptyHTML(emoji, title, desc) {
    return '<div class="empty"><div class="emoji">' + emoji + '</div>' +
      '<h3>' + esc(title) + '</h3><p>' + desc + '</p></div>';
  }

  function renderHome() {
    var all = state.dogs;
    var adoptable = all.filter(function (d) { return d.status === 'adoptable'; });
    var html = '';

    if (state.site && state.site.notice) {
      html += '<div class="notice">' + esc(state.site.notice) + '</div>';
    }

    html += '<div class="summary">' +
      '<div class="stat"><b>' + all.length + '</b><span>전체 아이들</span></div>' +
      '<div class="stat accent"><b>' + adoptable.length + '</b><span>입양 가능</span></div>' +
      '<div class="stat"><b>' + state.rooms.length + '</b><span>방</span></div>' +
    '</div>';

    if (!all.length) {
      html += emptyHTML('🐾', '아직 등록된 아이가 없어요',
        '보호소 관리자가 증명사진을 등록하면<br>이곳에 방별로 아이들이 나타납니다.');
      $('content').innerHTML = html;
      return;
    }

    html += '<div class="section-title">방을 골라 아이들을 만나보세요</div>';
    html += '<div class="room-grid">' + state.rooms.map(function (room) {
      var list = inRoom(room.id);
      var ok = list.filter(function (d) { return d.status === 'adoptable'; }).length;
      return '<button class="room-btn" data-room="' + esc(room.id) + '" style="--room-color:' + esc(room.color || '#DDD') + '">' +
        '<div class="top"><span class="icon">' + esc(room.icon || '🏠') + '</span>' +
        '<span class="name">' + esc(room.id) + '</span></div>' +
        '<div class="count">' + list.length + '마리' +
          (ok ? ' · <em>입양 가능 ' + ok + '</em>' : '') + '</div>' +
      '</button>';
    }).join('') + '</div>';

    $('content').innerHTML = html;
  }

  function renderRoom(roomId) {
    var room = state.rooms.filter(function (r) { return r.id === roomId; })[0];
    var list = visible(inRoom(roomId));
    var html = '<div class="room-chip">' + esc(room ? (room.icon + ' ' + room.id) : roomId) +
      ' · ' + list.length + '마리</div>';

    if (!list.length) {
      html += emptyHTML('🫧', state.onlyAdoptable ? '입양 가능한 아이가 없어요' : '이 방에는 아직 아이가 없어요',
        state.onlyAdoptable ? '필터를 끄면 다른 아이들도 볼 수 있어요.' : '곧 등록될 예정입니다.');
    } else {
      html += gridHTML(list);
    }
    $('content').innerHTML = html;
  }

  function renderSearch() {
    var list = visible(search(state.query));
    var html = '<div class="room-chip">🔎 "' + esc(state.query.trim()) + '" · ' + list.length + '마리</div>';
    if (!list.length) {
      html += emptyHTML('🔍', '찾는 아이가 없어요', '이름 일부만 입력해도 찾을 수 있어요.');
    } else {
      html += gridHTML(list);
    }
    $('content').innerHTML = html;
  }

  function render() {
    if (!state.loaded) {
      $('content').innerHTML = '<div class="dog-grid">' +
        '<div class="skeleton" style="aspect-ratio:3/4"></div>'.repeat(4) + '</div>';
      return;
    }
    if (state.error) {
      $('content').innerHTML = emptyHTML('⚠️', '정보를 불러오지 못했어요',
        '잠시 후 새로고침해 주세요.<br><span style="font-size:12px;color:#9CA3AF">' + esc(state.error) + '</span>');
      return;
    }

    var r = route();

    if (state.query.trim()) {
      setTitle('검색', '이름·특징으로 찾기');
      $('backBtn').hidden = false;
      renderSearch();
    } else if (r.view === 'room') {
      var room = state.rooms.filter(function (x) { return x.id === r.room; })[0];
      setTitle(r.room, room ? '이 방의 아이들' : '알 수 없는 방');
      $('backBtn').hidden = false;
      renderRoom(r.room);
    } else {
      setTitle(state.site.title || '천보금 입양', state.site.tagline || '가족을 기다리는 아이들');
      $('backBtn').hidden = true;
      renderHome();
    }

    if (r.view === 'dog') openSheet(r.id);
    else closeSheet();
  }

  function setTitle(t, s) {
    $('pageTitle').textContent = t;
    $('pageSub').textContent = s;
  }

  /* ── 상세 시트 ──────────────────────────────── */
  var sheetOpenId = null;

  function openSheet(id) {
    var dog = state.dogs.filter(function (d) { return d.id === id; })[0];
    if (!dog) { toast('해당 아이를 찾을 수 없어요.'); history.replaceState(null, '', '#'); return; }
    if (sheetOpenId === id) return;
    sheetOpenId = id;

    var st = IDCard.status(dog);
    var src = dog.photo || '';
    var facts = [
      ['방', dog.room],
      ['성별', dog.gender === '남' ? '남아' : dog.gender === '여' ? '여아' : '미상'],
      ['추정 나이', dog.ageText]
    ].filter(function (f) { return f[1]; });

    var contact = (state.site && state.site.contact) || {};
    var actions = '';
    if (contact.phone) actions += '<a class="btn" href="tel:' + esc(contact.phone) + '">📞 전화 문의</a>';
    if (contact.kakaoUrl) actions += '<a class="btn" href="' + esc(contact.kakaoUrl) + '" target="_blank" rel="noopener">💬 카톡 문의</a>';

    $('sheetBody').innerHTML =
      '<div class="detail-photo">' +
        (src ? '<img src="' + esc(src) + '" alt="' + esc(dog.name) + ' 증명사진">' : '<div class="placeholder">🐾</div>') +
      '</div>' +
      '<div class="detail-head"><h2>' + esc(dog.name || '이름 미정') + '</h2>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span></div>' +
      '<dl class="facts">' + facts.map(function (f) {
        return '<div class="fact"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>';
      }).join('') + '</dl>' +
      (dog.note ? '<div class="note-box">' + esc(dog.note) + '</div>' : '') +
      '<div class="sheet-actions">' +
        '<button class="btn" id="saveCard">🖼️ 증명사진 저장</button>' +
        '<button class="btn" id="shareLink">🔗 링크 공유</button>' +
        (actions ? '<div class="btn-block" style="display:grid;grid-template-columns:repeat(' +
          (contact.phone && contact.kakaoUrl ? 2 : 1) + ',1fr);gap:8px">' + actions + '</div>' : '') +
        '<button class="btn btn-primary btn-block" id="closeSheet">닫기</button>' +
      '</div>';

    $('backdrop').hidden = false;
    $('sheet').hidden = false;
    requestAnimationFrame(function () {
      $('backdrop').classList.add('show');
      $('sheet').classList.add('show');
    });
    document.body.style.overflow = 'hidden';

    $('saveCard').onclick = function () {
      var btn = this;
      btn.disabled = true; btn.textContent = '만드는 중…';
      IDCard.saveOrShare(dog).then(function (how) {
        toast(how === 'shared' ? '공유했어요.' : how === 'cancelled' ? '' : '증명사진을 저장했어요.');
      }).catch(function (e) {
        toast(e.message || '저장에 실패했어요.');
      }).then(function () {
        btn.disabled = false; btn.textContent = '🖼️ 증명사진 저장';
      });
    };
    $('shareLink').onclick = function () {
      var url = location.origin + location.pathname + '#dog/' + encodeURIComponent(dog.id);
      var text = dog.name + ' — 천보금 입양';
      if (navigator.share) {
        navigator.share({ title: text, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function () { toast('링크를 복사했어요.'); });
      } else {
        prompt('링크를 복사하세요', url);
      }
    };
    $('closeSheet').onclick = function () { history.back(); };
  }

  function closeSheet() {
    if (sheetOpenId === null) return;
    sheetOpenId = null;
    $('backdrop').classList.remove('show');
    $('sheet').classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (sheetOpenId === null) { $('backdrop').hidden = true; $('sheet').hidden = true; }
    }, 280);
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
    var roomBtn = e.target.closest('[data-room]');
    if (roomBtn) { go('room/' + encodeURIComponent(roomBtn.dataset.room)); return; }
    var dogBtn = e.target.closest('[data-dog]');
    if (dogBtn) { go('dog/' + encodeURIComponent(dogBtn.dataset.dog)); return; }
  });

  $('backdrop').addEventListener('click', function () { history.back(); });

  $('backBtn').addEventListener('click', function () {
    if (state.query.trim()) {
      state.query = '';
      $('searchInput').value = '';
      $('searchBar').hidden = true;
      render();
    } else {
      go('');
    }
  });

  $('searchBtn').addEventListener('click', function () {
    var bar = $('searchBar');
    bar.hidden = !bar.hidden;
    if (!bar.hidden) $('searchInput').focus();
    else if (state.query) { state.query = ''; $('searchInput').value = ''; render(); }
  });

  var searchTimer;
  $('searchInput').addEventListener('input', function (e) {
    var v = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () { state.query = v; render(); }, 180);
  });

  $('onlyAdoptable').addEventListener('change', function (e) {
    state.onlyAdoptable = e.target.checked;
    render();
  });

  window.addEventListener('hashchange', render);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheetOpenId) history.back();
  });

  /* ── 시작 ───────────────────────────────────── */
  render();
  load().then(function () {
    document.title = (state.site.title || '천보금 입양') + ' — ' + (state.site.tagline || '가족을 기다리는 아이들');
    var c = (state.site && state.site.contact) || {};
    var bits = [];
    if (c.phone) bits.push('<a href="tel:' + esc(c.phone) + '" style="color:inherit">' + esc(c.phone) + '</a>');
    if (c.instagram) bits.push('<a href="' + esc(c.instagram) + '" target="_blank" rel="noopener" style="color:inherit">인스타그램</a>');
    $('footContact').innerHTML = bits.join(' · ');
    render();
  });
})();
