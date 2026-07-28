/* 3:4 증명사진 크롭 — 외부 라이브러리 없음.
   한 손가락 드래그로 이동, 두 손가락 핀치로 확대, 마우스 휠/슬라이더도 지원. */
(function (global) {
  'use strict';

  var OUT_W = 900, OUT_H = 1200;   // 3:4
  var MAX_ZOOM = 4;

  function Cropper(frameEl, zoomInput) {
    this.frame = frameEl;
    this.zoomInput = zoomInput || null;
    this.img = null;
    this.natural = { w: 0, h: 0 };
    this.base = 1;     // 프레임을 꽉 채우는 배율
    this.zoom = 1;     // 사용자 확대 배율 (1 ~ MAX_ZOOM)
    this.ox = 0; this.oy = 0;
    this.pointers = {};
    this.pinch = null;
    this._bind();
  }

  Cropper.prototype._bind = function () {
    var self = this;
    var f = this.frame;
    f.style.touchAction = 'none';

    f.addEventListener('pointerdown', function (e) {
      if (!self.img) return;
      f.setPointerCapture(e.pointerId);
      self.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(self.pointers);
      if (ids.length === 2) self._startPinch(ids);
    });

    f.addEventListener('pointermove', function (e) {
      if (!self.img || !self.pointers[e.pointerId]) return;
      e.preventDefault();
      var prev = self.pointers[e.pointerId];
      self.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(self.pointers);

      if (ids.length >= 2 && self.pinch) {
        self._movePinch(ids);
      } else {
        self.ox += e.clientX - prev.x;
        self.oy += e.clientY - prev.y;
        self._apply();
      }
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
      f.addEventListener(type, function (e) {
        delete self.pointers[e.pointerId];
        if (Object.keys(self.pointers).length < 2) self.pinch = null;
      });
    });

    f.addEventListener('wheel', function (e) {
      if (!self.img) return;
      e.preventDefault();
      var r = f.getBoundingClientRect();
      self._zoomAt(self.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    if (this.zoomInput) {
      this.zoomInput.addEventListener('input', function () {
        if (!self.img) return;
        var r = f.getBoundingClientRect();
        self._zoomAt(parseFloat(self.zoomInput.value), r.width / 2, r.height / 2, true);
      });
    }
  };

  Cropper.prototype._startPinch = function (ids) {
    var a = this.pointers[ids[0]], b = this.pointers[ids[1]];
    this.pinch = { dist: dist(a, b), zoom: this.zoom };
  };

  Cropper.prototype._movePinch = function (ids) {
    var a = this.pointers[ids[0]], b = this.pointers[ids[1]];
    var d = dist(a, b);
    if (!this.pinch.dist) return;
    var r = this.frame.getBoundingClientRect();
    var cx = (a.x + b.x) / 2 - r.left;
    var cy = (a.y + b.y) / 2 - r.top;
    this._zoomAt(this.pinch.zoom * (d / this.pinch.dist), cx, cy);
  };

  /** (cx, cy) 지점을 고정한 채 확대/축소 */
  Cropper.prototype._zoomAt = function (nextZoom, cx, cy, skipSlider) {
    var z0 = this.zoom;
    var z1 = Math.min(MAX_ZOOM, Math.max(1, nextZoom));
    if (z1 === z0) return;
    var k = z1 / z0;
    this.ox = cx - (cx - this.ox) * k;
    this.oy = cy - (cy - this.oy) * k;
    this.zoom = z1;
    if (this.zoomInput && !skipSlider) this.zoomInput.value = String(z1);
    this._apply();
  };

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  Cropper.prototype.load = function (file) {
    var self = this;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('이미지 파일이 아닙니다.'));
        return;
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        self.clear();
        self.img = img;
        self.natural = { w: img.naturalWidth, h: img.naturalHeight };
        img.draggable = false;
        img.style.position = 'absolute';
        img.style.left = '0'; img.style.top = '0';
        img.style.transformOrigin = '0 0';
        img.style.userSelect = 'none';
        img.style.pointerEvents = 'none';
        img.style.willChange = 'transform';
        // base.css 의 img { max-width:100% } 가 확대 배율을 깎지 않도록 해제
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        self.frame.appendChild(img);
        self.reset();
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('이미지를 읽지 못했습니다.')); };
      img.src = url;
      self._objectUrl = url;
    });
  };

  Cropper.prototype.reset = function () {
    if (!this.img) return;
    var r = this.frame.getBoundingClientRect();
    this.base = Math.max(r.width / this.natural.w, r.height / this.natural.h);
    this.zoom = 1;
    if (this.zoomInput) { this.zoomInput.min = '1'; this.zoomInput.max = String(MAX_ZOOM); this.zoomInput.step = '0.01'; this.zoomInput.value = '1'; }
    var dw = this.natural.w * this.base, dh = this.natural.h * this.base;
    this.ox = (r.width - dw) / 2;
    this.oy = (r.height - dh) / 2;
    this._apply();
  };

  Cropper.prototype._apply = function () {
    if (!this.img) return;
    var r = this.frame.getBoundingClientRect();
    var s = this.base * this.zoom;
    var dw = this.natural.w * s, dh = this.natural.h * s;

    // 프레임 밖으로 빈 공간이 생기지 않도록 고정
    this.ox = Math.min(0, Math.max(r.width - dw, this.ox));
    this.oy = Math.min(0, Math.max(r.height - dh, this.oy));
    if (dw <= r.width) this.ox = (r.width - dw) / 2;
    if (dh <= r.height) this.oy = (r.height - dh) / 2;

    this.img.style.transform = 'translate(' + this.ox + 'px,' + this.oy + 'px) scale(' + s + ')';
    this.img.style.width = this.natural.w + 'px';
    this.img.style.height = this.natural.h + 'px';
  };

  Cropper.prototype.hasImage = function () { return !!this.img; };

  /** 현재 불러온 원본 이미지의 blob URL (미리보기용) */
  Cropper.prototype.sourceUrl = function () { return this._objectUrl || ''; };

  Cropper.prototype.clear = function () {
    if (this.img && this.img.parentNode) this.img.parentNode.removeChild(this.img);
    if (this._objectUrl) { URL.revokeObjectURL(this._objectUrl); this._objectUrl = null; }
    this.img = null;
    this.pointers = {};
    this.pinch = null;
  };

  /** 잘라낸 3:4 영역을 WebP(미지원 시 JPEG) Blob 으로 */
  Cropper.prototype.toBlob = function () {
    var self = this;
    if (!this.img) return Promise.reject(new Error('사진을 먼저 선택해 주세요.'));

    var r = this.frame.getBoundingClientRect();
    var s = this.base * this.zoom;

    // 프레임이 어떤 이유로든 3:4 가 아니게 되어도(짧은 화면 등) 중앙의 3:4 영역만 잘라
    // 결과물이 늘어나지 않게 한다.
    var tw = Math.min(r.width, r.height * 3 / 4);
    var th = tw * 4 / 3;
    var offX = (r.width - tw) / 2, offY = (r.height - th) / 2;

    var sx = (offX - this.ox) / s, sy = (offY - this.oy) / s;
    var sw = tw / s, sh = th / s;

    // 반올림 오차로 원본 밖을 참조하지 않도록 보정
    sx = Math.max(0, Math.min(sx, self.natural.w - 1));
    sy = Math.max(0, Math.min(sy, self.natural.h - 1));
    sw = Math.min(sw, self.natural.w - sx);
    sh = Math.min(sh, self.natural.h - sy);

    var cv = document.createElement('canvas');
    cv.width = OUT_W; cv.height = OUT_H;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, OUT_W, OUT_H);
    ctx.drawImage(this.img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);

    return encode(cv, 'image/webp', 0.82).then(function (blob) {
      if (blob && blob.type === 'image/webp') return { blob: blob, ext: 'webp' };
      return encode(cv, 'image/jpeg', 0.86).then(function (jpg) {
        return { blob: jpg, ext: 'jpg' };
      });
    });
  };

  function encode(cv, type, q) {
    return new Promise(function (resolve, reject) {
      cv.toBlob(function (b) { b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다.')); }, type, q);
    });
  }

  global.Cropper = Cropper;
})(window);
