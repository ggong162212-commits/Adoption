/* 증명사진 카드 — 공개 사이트와 관리자 화면이 함께 쓰는 공용 모듈 */
(function (global) {
  'use strict';

  var STATUS = {
    adoptable: { label: '입양 가능', cls: 'badge-adoptable' },
    pending:   { label: '입양 진행중', cls: 'badge-pending' },
    foster:    { label: '임시보호중', cls: 'badge-foster' },
    adopted:   { label: '입양 완료', cls: 'badge-adopted' }
  };
  var STATUS_ORDER = ['adoptable', 'pending', 'foster', 'adopted'];

  function status(dog) {
    return STATUS[dog && dog.status] || STATUS.adoptable;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 캡션 두 번째 줄: "22년 4월생 · 남아" */
  function metaLine(dog) {
    var parts = [];
    if (dog.ageText) parts.push(dog.ageText);
    if (dog.gender === '남') parts.push('남아');
    else if (dog.gender === '여') parts.push('여아');
    else if (dog.gender) parts.push('성별 미상');
    return parts.join(' · ');
  }

  function paw() {
    return (global.Icon ? Icon.filled('paw') : '');
  }

  /**
   * 카드 내부 마크업. 바깥 요소(button/div)는 호출부가 만들고 .idcard 클래스를 붙인다.
   * '입양 가능'은 이 사이트의 기본 상태라 배지를 달지 않는다 — 예외일 때만 표시한다.
   */
  function innerHTML(dog, opts) {
    opts = opts || {};
    var src = dog.photoUrl || (dog.photo ? (opts.base || '') + dog.photo : '');
    var media = src
      ? '<img src="' + esc(src) + '" alt="' + esc(dog.name) + ' 증명사진"' +
        ' width="900" height="900" loading="lazy" decoding="async">'
      : '<div class="placeholder">' + paw() + '</div>';

    var badge = '';
    if (dog.status && dog.status !== 'adoptable') {
      var st = status(dog);
      badge = '<span class="badge ' + st.cls + '">' + st.label + '</span>';
    }

    var meta = metaLine(dog);
    return (
      '<div class="idcard-photo">' + media + badge + '</div>' +
      '<div class="idcard-caption">' +
        '<div class="idcard-name">' + esc(dog.name || '이름 미정') + '</div>' +
        '<div class="idcard-meta">' + (meta ? esc(meta) : '&nbsp;') + '</div>' +
      '</div>'
    );
  }

  function cardClass(dog) {
    return 'idcard' + (dog.status === 'adopted' ? ' is-adopted' : '');
  }

  /* ── 캔버스로 증명사진 PNG 합성 ─────────────────────── */
  var W = 900, PH = 900, CAP = 264, H = PH + CAP;
  var DISPLAY = "'Hahmlet', 'Nanum Myeongjo', serif";
  var BODY = "'IBM Plex Sans KR', -apple-system, 'Apple SD Gothic Neo', sans-serif";

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      if (!/^(blob|data):/.test(src)) img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('사진을 불러오지 못했습니다.')); };
      img.src = src;
    });
  }

  /** 웹폰트는 글자 단위로 늦게 로드되므로, 캔버스에 그리기 전에 필요한 글자를 명시적으로 불러온다. */
  function ensureFonts(texts) {
    if (!global.document || !document.fonts || !document.fonts.load) return Promise.resolve();
    var joined = texts.join(' ');
    return Promise.all([
      document.fonts.load('700 66px ' + DISPLAY, joined),
      document.fonts.load('500 36px ' + BODY, joined),
      document.fonts.load('600 27px ' + BODY, joined)
    ]).catch(function () {});
  }

  function drawCover(ctx, img, x, y, w, h) {
    var scale = Math.max(w / img.width, h / img.height);
    var dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  /** dog -> PNG Blob (정사각 사진 + 캡션 밴드) */
  function toBlob(dog, opts) {
    opts = opts || {};
    var src = dog.photoUrl || (dog.photo ? (opts.base || '') + dog.photo : '');
    if (!src) return Promise.reject(new Error('사진이 없습니다.'));

    var name = dog.name || '이름 미정';
    var meta = metaLine(dog);
    var st = status(dog);
    var foot = '천보금 유기견 보호소' + (dog.room ? '  ·  ' + dog.room : '') +
      (dog.status && dog.status !== 'adoptable' ? '  ·  ' + st.label : '');

    return Promise.all([loadImage(src), ensureFonts([name, meta, foot])]).then(function (r) {
      var img = r[0];
      var cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d');

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, PH);
      ctx.clip();
      drawCover(ctx, img, 0, 0, W, PH);
      ctx.restore();

      if (dog.status === 'adopted') {
        ctx.fillStyle = 'rgba(255,255,255,.34)';
        ctx.fillRect(0, 0, W, PH);
      }

      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = '#1C2119';
      ctx.font = '700 66px ' + DISPLAY;
      ctx.fillText(name, 56, PH + 94);

      if (meta) {
        ctx.fillStyle = '#59614F';
        ctx.font = '500 36px ' + BODY;
        ctx.fillText(meta, 56, PH + 150);
      }

      // 하단 표식 — 잎사귀색 점 하나로 출처를 표시
      ctx.fillStyle = '#3E6B4C';
      ctx.beginPath();
      ctx.arc(62, PH + 198, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#8B9382';
      ctx.font = '600 27px ' + BODY;
      ctx.fillText(foot, 82, PH + 207);

      return new Promise(function (resolve, reject) {
        cv.toBlob(function (b) {
          b ? resolve(b) : reject(new Error('이미지를 만들지 못했습니다.'));
        }, 'image/png');
      });
    });
  }

  /** 저장/공유. 파일 공유를 지원하면 공유 시트, 아니면 다운로드. */
  function saveOrShare(dog, opts) {
    return toBlob(dog, opts).then(function (blob) {
      var fname = (dog.name || 'dog') + '_증명사진.png';
      var file = null;
      try { file = new File([blob], fname, { type: 'image/png' }); } catch (e) { /* File 미지원 */ }

      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], title: dog.name + ' 증명사진' })
          .then(function () { return 'shared'; })
          .catch(function (err) {
            if (err && err.name === 'AbortError') return 'cancelled';
            return download(blob, fname);
          });
      }
      return download(blob, fname);
    });
  }

  function download(blob, fname) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return 'downloaded';
  }

  global.IDCard = {
    STATUS: STATUS,
    STATUS_ORDER: STATUS_ORDER,
    status: status,
    esc: esc,
    metaLine: metaLine,
    innerHTML: innerHTML,
    cardClass: cardClass,
    paw: paw,
    toBlob: toBlob,
    saveOrShare: saveOrShare
  };
})(window);
