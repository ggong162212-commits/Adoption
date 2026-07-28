/* 천보금 입양 — 관리자 화면 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = IDCard.esc;

  var DOGS = 'data/dogs.json';
  var ROOMS = 'data/rooms.json';
  var SITE = 'data/site.json';

  var state = {
    rooms: [],
    dogs: [],
    site: { title: '천보금 입양', tagline: '가족을 기다리는 아이들', notice: '', contact: {} },
    editingId: null,
    listFilter: 'all',
    busy: false
  };

  var cropper = null;

  /* ── 아이콘 · 테마 ──────────────────────────── */
  $('gateMark').innerHTML = Icon('lock');
  $('gateWarn').insertAdjacentHTML('afterbegin', Icon('heart'));
  $('cropHint').innerHTML = Icon('image') +
    '<span>사진을 고르면 증명사진 규격으로 자를 수 있어요<br>손가락으로 옮기고, 두 손가락으로 확대</span>';
  $('pickCamera').innerHTML = Icon('camera') + '촬영';
  $('pickFile').innerHTML = Icon('image') + '앨범';
  $('copyPrompt').innerHTML = Icon('sparkle') + '증명사진 프롬프트 복사';
  $('siteLink').innerHTML = Icon('home');
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.insertAdjacentHTML('afterbegin', Icon(b.dataset.icon));
  });

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
  paintThemeButton();

  /* ── 공통 UI ────────────────────────────────── */
  var toastTimer;
  function toast(msg) {
    if (!msg) return;
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function status(msg, kind) {
    var el = $('statusBar');
    if (!msg) { el.hidden = true; return; }
    el.hidden = false;
    el.textContent = msg;
    el.className = 'status-bar' + (kind ? ' ' + kind : '');
  }

  function busy(on, msg) {
    state.busy = on;
    document.querySelectorAll('button').forEach(function (b) { b.disabled = on; });
    if (on) status(msg || '저장 중…', 'busy'); else status('');
  }

  function fail(e) {
    busy(false);
    status(e.message || '오류가 발생했습니다.', 'err');
    toast(e.message || '오류가 발생했습니다.');
    if (e.status === 401) { GH.clearToken(); setTimeout(showGate, 1200); }
  }

  /* ── 토큰 게이트 ────────────────────────────── */
  function showGate() {
    $('gate').hidden = false;
    $('app').hidden = true;
  }

  function showApp() {
    $('gate').hidden = true;
    $('app').hidden = false;
    $('adminSub').textContent = GH.target.owner + '/' + GH.target.repo;
    $('tokenInfo').innerHTML =
      '이 기기에 <b>' + esc(GH.target.owner + '/' + GH.target.repo) + '</b> 쓰기 토큰이 저장되어 있습니다.<br>' +
      '공용 기기라면 사용 후 반드시 지워 주세요. 토큰이 만료되면 다시 등록하면 됩니다.';
    loadAll();
  }

  $('connectBtn').addEventListener('click', function () {
    var t = $('tokenInput').value.trim();
    if (!t) { $('gateMsg').textContent = '토큰을 붙여넣어 주세요.'; return; }
    $('gateMsg').textContent = '확인 중…';
    GH.setToken(t);
    GH.verify().then(function (r) {
      if (!r.ok) { GH.clearToken(); $('gateMsg').textContent = r.message; return; }
      $('tokenInput').value = '';
      $('gateMsg').textContent = '';
      showApp();
      toast('연결되었습니다.');
    }).catch(function (e) {
      GH.clearToken();
      $('gateMsg').textContent = e.message;
    });
  });

  $('logoutBtn').addEventListener('click', function () {
    if (!confirm('이 기기에서 토큰을 지울까요?\n등록한 아이들 정보는 사라지지 않습니다.')) return;
    GH.clearToken();
    showGate();
  });

  /* ── 데이터 로드 (GitHub API 기준 — 항상 최신) ── */
  function loadAll() {
    status('불러오는 중…', 'busy');
    return Promise.all([
      GH.getJSON(ROOMS),
      GH.getJSON(DOGS),
      GH.getJSON(SITE)
    ]).then(function (r) {
      state.rooms = (r[0] && r[0].data.rooms ? r[0].data.rooms : []).slice()
        .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
      state.dogs = (r[1] && r[1].data.dogs) ? r[1].data.dogs : [];
      if (r[2] && r[2].data) state.site = Object.assign(state.site, r[2].data);
      status('');
      fillRoomSelect();
      renderList();
      renderRoomEditor();
      fillSiteForm();
      renderPreview();
    }).catch(fail);
  }

  /* ── 탭 ─────────────────────────────────────── */
  document.querySelectorAll('.tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (state.busy) return;
      document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.remove('on'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('on'); });
      btn.classList.add('on');
      $('panel-' + btn.dataset.tab).classList.add('on');
      window.scrollTo(0, 0);
    });
  });

  function goTab(name) {
    var btn = document.querySelector('.tabs button[data-tab="' + name + '"]');
    if (btn) btn.click();
  }

  /* ── 사진 선택 & 크롭 ───────────────────────── */
  cropper = new Cropper($('cropFrame'), $('zoomRange'));

  $('pickCamera').addEventListener('click', function () { $('fileCamera').click(); });
  $('pickFile').addEventListener('click', function () { $('fileAlbum').click(); });

  ['fileCamera', 'fileAlbum'].forEach(function (id) {
    $(id).addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      cropper.load(file).then(function () {
        $('cropFrame').classList.add('has-img');
        renderPreview();
      }).catch(function (err) { toast(err.message); });
    });
  });

  window.addEventListener('resize', function () { if (cropper.hasImage()) cropper.reset(); });

  /* ── 증명사진 프롬프트 복사 ─────────────────── */
  $('copyPrompt').addEventListener('click', function () {
    fetch('docs/id-photo-prompt.txt?v=' + Date.now()).then(function (r) {
      if (!r.ok) throw new Error('프롬프트 파일을 찾을 수 없습니다.');
      return r.text();
    }).then(function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () {
          toast('프롬프트를 복사했어요. 이미지 도구에 붙여넣으세요.');
        });
      }
      window.prompt('아래 프롬프트를 복사하세요', text);
    }).catch(function (e) { toast(e.message); });
  });

  /* ── 폼 ─────────────────────────────────────── */
  function fillRoomSelect() {
    var sel = $('fRoom');
    var cur = sel.value;
    sel.innerHTML = state.rooms.map(function (r) {
      return '<option value="' + esc(r.id) + '">' + esc((r.icon || '') + ' ' + r.id) + '</option>';
    }).join('');
    if (cur) sel.value = cur;
  }

  function formData() {
    return {
      name: $('fName').value.trim(),
      room: $('fRoom').value,
      gender: $('fGender').value,
      ageText: $('fAge').value.trim(),
      status: $('fStatus').value,
      note: $('fNote').value.trim()
    };
  }

  function renderPreview() {
    var d = formData();
    var dog = {
      name: d.name || '이름 미정',
      ageText: d.ageText, gender: d.gender, status: d.status,
      photoUrl: cropper.hasImage() ? cropper.sourceUrl() : (state.editingPhotoUrl || '')
    };
    $('previewCard').className = IDCard.cardClass(dog);
    $('previewCard').innerHTML = IDCard.innerHTML(dog);
  }

  ['fName', 'fAge', 'fGender', 'fStatus', 'fRoom'].forEach(function (id) {
    $(id).addEventListener('input', renderPreview);
    $(id).addEventListener('change', renderPreview);
  });

  function resetForm() {
    state.editingId = null;
    state.editingPhotoUrl = '';
    $('formTitle').textContent = '새 아이 등록';
    $('fName').value = ''; $('fAge').value = ''; $('fNote').value = '';
    $('fGender').value = '남'; $('fStatus').value = 'adoptable';
    if (state.rooms.length) $('fRoom').value = state.rooms[0].id;
    cropper.clear();
    $('cropFrame').classList.remove('has-img');
    $('zoomRange').value = '1';
    $('cancelEdit').hidden = true;
    $('saveBtn').textContent = '저장하기';
    if ($('deleteBtn')) $('deleteBtn').hidden = true;
    renderPreview();
  }

  $('cancelEdit').addEventListener('click', function () { resetForm(); toast('수정을 취소했어요.'); });

  function newId() {
    var d = new Date();
    var ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    var rnd = Math.random().toString(16).slice(2, 6);
    return 'd-' + ymd + '-' + rnd;
  }

  /* ── 저장 ───────────────────────────────────── */
  $('saveBtn').addEventListener('click', function () {
    var f = formData();
    if (!f.name) { toast('이름을 입력해 주세요.'); $('fName').focus(); return; }
    if (!f.room) { toast('방을 먼저 만들어 주세요. (방 탭)'); return; }

    var editing = state.editingId;
    var existing = editing ? state.dogs.filter(function (d) { return d.id === editing; })[0] : null;
    if (!editing && !cropper.hasImage()) {
      if (!confirm('사진 없이 등록할까요?\n나중에 목록에서 사진을 추가할 수 있습니다.')) return;
    }

    var id = editing || newId();
    var now = new Date().toISOString();

    busy(true, '사진을 올리는 중…');

    var photoStep = cropper.hasImage()
      ? cropper.toBlob().then(function (out) {
          var path = 'photos/' + id + '.' + out.ext;
          return GH.getSha(path).then(function (sha) {
            return GH.putBlob(path, out.blob, '사진 등록: ' + f.name, sha);
          }).then(function () {
            var old = existing && existing.photo;
            if (old && old !== path) {
              return GH.deleteFile(old, '이전 사진 정리: ' + f.name).catch(function () {}).then(function () { return path; });
            }
            return path;
          });
        })
      : Promise.resolve(existing ? existing.photo || '' : '');

    photoStep.then(function (photoPath) {
      status('정보를 저장하는 중…', 'busy');
      return GH.updateJSON(DOGS, function (data) {
        data.dogs = data.dogs || [];
        var idx = -1;
        for (var i = 0; i < data.dogs.length; i++) if (data.dogs[i].id === id) { idx = i; break; }
        var record = {
          id: id, name: f.name, room: f.room, gender: f.gender,
          ageText: f.ageText, note: f.note, status: f.status,
          photo: photoPath,
          createdAt: idx >= 0 ? (data.dogs[idx].createdAt || now) : now,
          updatedAt: now
        };
        if (idx >= 0) data.dogs[idx] = record; else data.dogs.unshift(record);
        return data;
      }, (editing ? '정보 수정: ' : '새 아이 등록: ') + f.name, { version: 1, dogs: [] });
    }).then(function (data) {
      state.dogs = data.dogs;
      busy(false);
      renderList();
      resetForm();
      status('저장했습니다. 사이트 반영까지 약 1분 걸립니다.', '');
      toast(f.name + ' 저장 완료 · 사이트 반영까지 약 1분');
    }).catch(fail);
  });

  /* ── 목록 ───────────────────────────────────── */
  function renderFilterBar() {
    var counts = { all: state.dogs.length };
    IDCard.STATUS_ORDER.forEach(function (s) {
      counts[s] = state.dogs.filter(function (d) { return d.status === s; }).length;
    });
    var items = [['all', '전체']].concat(IDCard.STATUS_ORDER.map(function (s) {
      return [s, IDCard.STATUS[s].label];
    }));
    $('listFilter').innerHTML = items.map(function (it) {
      return '<button data-filter="' + it[0] + '"' + (state.listFilter === it[0] ? ' class="on"' : '') + '>' +
        esc(it[1]) + ' ' + (counts[it[0]] || 0) + '</button>';
    }).join('');
  }

  function renderList() {
    renderFilterBar();
    var list = state.dogs.filter(function (d) {
      return state.listFilter === 'all' || d.status === state.listFilter;
    });

    if (!list.length) {
      $('dogList').innerHTML = '<div class="empty"><div class="mark">' + Icon('paw') + '</div>' +
        '<h3>' + (state.dogs.length ? '해당하는 아이가 없어요' : '아직 등록된 아이가 없어요') + '</h3>' +
        '<p>' + (state.dogs.length ? '다른 상태를 눌러보세요.' : '등록 탭에서 첫 아이를 추가해 보세요.') + '</p></div>';
      return;
    }

    $('dogList').innerHTML = list.map(function (d) {
      var st = IDCard.status(d);
      var thumb = d.photo
        ? '<img class="thumb" src="' + esc(d.photo) + '" alt="" loading="lazy">'
        : '<div class="thumb ph">' + Icon.filled('paw') + '</div>';
      var meta = [d.room, IDCard.metaLine(d)].filter(Boolean).join(' · ');
      return '<button class="dog-row" data-edit="' + esc(d.id) + '">' + thumb +
        '<div class="info"><div class="nm">' + esc(d.name) + '</div>' +
        '<div class="mt">' + esc(meta) + '</div></div>' +
        '<span class="badge ' + st.cls + '">' + st.label + '</span></button>';
    }).join('');
  }

  $('listFilter').addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (!b) return;
    state.listFilter = b.dataset.filter;
    renderList();
  });

  $('dogList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-edit]');
    if (!b) return;
    startEdit(b.dataset.edit);
  });

  function startEdit(id) {
    var d = state.dogs.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    state.editingId = id;
    // 방금 바꾼 사진이 캐시에 걸리지 않도록, 편집을 시작할 때 한 번만 버전을 붙인다
    state.editingPhotoUrl = d.photo ? d.photo + '?v=' + Date.now() : '';
    $('formTitle').textContent = d.name + ' 수정';
    $('fName').value = d.name || '';
    if (state.rooms.some(function (r) { return r.id === d.room; })) $('fRoom').value = d.room;
    $('fGender').value = d.gender || '남';
    $('fAge').value = d.ageText || '';
    $('fStatus').value = d.status || 'adoptable';
    $('fNote').value = d.note || '';
    cropper.clear();
    $('cropFrame').classList.remove('has-img');
    $('cancelEdit').hidden = false;
    $('saveBtn').textContent = '수정 저장';

    if (!$('deleteBtn')) {
      var del = document.createElement('button');
      del.id = 'deleteBtn';
      del.className = 'btn btn-danger btn-block';
      del.style.marginTop = '8px';
      del.innerHTML = Icon('trash') + '이 아이 삭제';
      del.addEventListener('click', removeDog);
      $('cancelEdit').after(del);
    }
    $('deleteBtn').hidden = false;
    renderPreview();
    goTab('add');
  }

  function removeDog() {
    var id = state.editingId;
    var d = state.dogs.filter(function (x) { return x.id === id; })[0];
    if (!d) return;
    if (!confirm('"' + d.name + '" 을(를) 삭제할까요?\n사진도 함께 지워지며 되돌릴 수 없습니다.')) return;

    busy(true, '삭제하는 중…');
    var step = d.photo ? GH.deleteFile(d.photo, '사진 삭제: ' + d.name).catch(function () {}) : Promise.resolve();
    step.then(function () {
      return GH.updateJSON(DOGS, function (data) {
        data.dogs = (data.dogs || []).filter(function (x) { return x.id !== id; });
        return data;
      }, '삭제: ' + d.name, { version: 1, dogs: [] });
    }).then(function (data) {
      state.dogs = data.dogs;
      busy(false);
      resetForm();
      if ($('deleteBtn')) $('deleteBtn').hidden = true;
      renderList();
      toast(d.name + ' 을(를) 삭제했어요.');
      goTab('list');
    }).catch(fail);
  }

  /* ── 방 관리 ────────────────────────────────── */
  function renderRoomEditor() {
    $('roomEditor').innerHTML = state.rooms.map(function (r, i) {
      var n = state.dogs.filter(function (d) { return d.room === r.id; }).length;
      return '<div class="room-row" data-i="' + i + '" data-orig="' + esc(r.id) + '">' +
        '<input class="input ic" type="text" value="' + esc(r.icon || '🏠') + '" maxlength="4" aria-label="아이콘">' +
        '<input class="input nm" type="text" value="' + esc(r.id) + '" maxlength="12" aria-label="방 이름">' +
        '<input class="co" type="color" value="' + esc(r.color || '#3E6B4C') + '" aria-label="색">' +
        '<button class="btn btn-danger del" data-del="' + i + '" aria-label="' + esc(r.id) + ' 삭제"' +
          ' title="' + n + '마리">' + Icon('trash') + '</button>' +
      '</div>';
    }).join('') || '<p class="hint">방이 없습니다. 아래에서 추가해 주세요.</p>';
  }

  $('addRoom').addEventListener('click', function () {
    state.rooms.push({ id: '새 방 ' + (state.rooms.length + 1), icon: '🏠', color: '#CFD8DC', order: state.rooms.length + 1 });
    renderRoomEditor();
  });

  $('roomEditor').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]');
    if (!b) return;
    var i = +b.dataset.del;
    var room = state.rooms[i];
    var n = state.dogs.filter(function (d) { return d.room === room.id; }).length;
    if (n > 0) { toast('"' + room.id + '"에 아이가 ' + n + '마리 있어 지울 수 없어요.'); return; }
    state.rooms.splice(i, 1);
    renderRoomEditor();
  });

  $('saveRooms').addEventListener('click', function () {
    var rows = Array.prototype.slice.call($('roomEditor').querySelectorAll('.room-row'));
    var renames = [];
    var next = [];
    var seen = {};

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var orig = row.dataset.orig;
      var icon = row.querySelector('.ic').value.trim() || '🏠';
      var name = row.querySelector('.nm').value.trim();
      var color = row.querySelector('.co').value;
      if (!name) { toast('방 이름은 비울 수 없어요.'); return; }
      if (seen[name]) { toast('방 이름 "' + name + '"이 중복됩니다.'); return; }
      seen[name] = true;
      if (orig && orig !== name) renames.push([orig, name]);
      next.push({ id: name, icon: icon, color: color, order: i + 1 });
    }

    busy(true, '방 정보를 저장하는 중…');
    GH.updateJSON(ROOMS, function (data) { data.rooms = next; return data; }, '방 정보 수정', { version: 1, rooms: [] })
      .then(function () {
        if (!renames.length) return null;
        return GH.updateJSON(DOGS, function (data) {
          (data.dogs || []).forEach(function (d) {
            renames.forEach(function (rn) { if (d.room === rn[0]) d.room = rn[1]; });
          });
          return data;
        }, '방 이름 변경 반영', { version: 1, dogs: [] });
      })
      .then(function (dogsData) {
        state.rooms = next;
        if (dogsData) state.dogs = dogsData.dogs;
        busy(false);
        fillRoomSelect();
        renderRoomEditor();
        renderList();
        toast('방 정보를 저장했어요.');
      }).catch(fail);
  });

  /* ── 사이트 설정 ────────────────────────────── */
  function fillSiteForm() {
    var s = state.site, c = s.contact || {};
    $('sTitle').value = s.title || '';
    $('sTagline').value = s.tagline || '';
    $('sNotice').value = s.notice || '';
    $('sSteps').value = (s.adoptionSteps || []).map(function (x) {
      return x.title + ' | ' + x.desc;
    }).join('\n');
    $('sPhone').value = c.phone || '';
    $('sKakao').value = c.kakaoUrl || '';
    $('sInsta').value = c.instagram || '';
  }

  $('saveSite').addEventListener('click', function () {
    var next = {
      version: 1,
      title: $('sTitle').value.trim() || '천보금 입양',
      tagline: $('sTagline').value.trim(),
      notice: $('sNotice').value.trim(),
      adoptionSteps: $('sSteps').value.split('\n').map(function (line) {
        var i = line.indexOf('|');
        if (i < 0) return { title: line.trim(), desc: '' };
        return { title: line.slice(0, i).trim(), desc: line.slice(i + 1).trim() };
      }).filter(function (s) { return s.title; }),
      contact: {
        phone: $('sPhone').value.trim(),
        kakaoUrl: $('sKakao').value.trim(),
        instagram: $('sInsta').value.trim()
      }
    };
    busy(true, '설정을 저장하는 중…');
    GH.updateJSON(SITE, function () { return next; }, '사이트 설정 수정', { version: 1 })
      .then(function (data) {
        state.site = data;
        busy(false);
        toast('설정을 저장했어요.');
      }).catch(fail);
  });

  /* ── 시작 ───────────────────────────────────── */
  if (GH.hasToken()) {
    GH.verify().then(function (r) {
      if (r.ok) showApp();
      else { GH.clearToken(); showGate(); }
    }).catch(function () { GH.clearToken(); showGate(); });
  } else {
    showGate();
  }
})();
