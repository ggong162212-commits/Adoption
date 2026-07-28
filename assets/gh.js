/* GitHub Contents API 래퍼 — 이 파일이 유일한 저장 계층이다.
   나중에 Supabase 등으로 옮기려면 이 파일만 같은 인터페이스로 갈아끼우면 된다. */
(function (global) {
  'use strict';

  var DEFAULT_OWNER = 'ggong162212-commits';
  var DEFAULT_REPO = 'Adoption';
  var BRANCH = 'main';
  var TOKEN_KEY = 'adoption.gh.token';
  var API = 'https://api.github.com';

  /* GitHub Pages 주소에서 owner/repo 를 추론하고, 실패하면 기본값을 쓴다. */
  function detectRepo() {
    var m = location.hostname.match(/^([\w-]+)\.github\.io$/i);
    if (m) {
      var seg = location.pathname.split('/').filter(Boolean)[0];
      return { owner: m[1], repo: seg || m[1] + '.github.io' };
    }
    return { owner: DEFAULT_OWNER, repo: DEFAULT_REPO };
  }

  var target = detectRepo();

  /* ── 토큰 ───────────────────────────────────── */
  function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; } }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, (t || '').trim()); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }
  function hasToken() { return !!getToken(); }

  /* ── base64 ↔ UTF-8 / 바이너리 ───────────────── */
  function bytesToBase64(bytes) {
    var out = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      out += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(out);
  }
  function textToBase64(str) { return bytesToBase64(new TextEncoder().encode(str)); }
  function base64ToText(b64) {
    var bin = atob((b64 || '').replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function blobToBase64(blob) {
    return blob.arrayBuffer().then(function (buf) { return bytesToBase64(new Uint8Array(buf)); });
  }

  /* ── 요청 ───────────────────────────────────── */
  function request(method, path, body) {
    var token = getToken();
    if (!token) return Promise.reject(err('GitHub 토큰이 등록되지 않았습니다.', 401));

    return fetch(API + path, {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (res.status === 204) return null;
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        throw err(friendly(res.status, data), res.status);
      });
    });
  }

  function err(msg, status) { var e = new Error(msg); e.status = status; return e; }

  function friendly(status, data) {
    var raw = (data && data.message) || '';
    if (status === 401) return '토큰이 만료되었거나 잘못되었습니다. 다시 등록해 주세요.';
    if (status === 403) return '권한이 없습니다. 토큰에 Contents: Read and write 권한이 있는지 확인해 주세요.';
    if (status === 404) return '저장소나 파일을 찾을 수 없습니다. 토큰이 ' + target.repo + ' 저장소에 접근 가능한지 확인해 주세요.';
    if (status === 409) return '다른 곳에서 먼저 수정되었습니다. 잠시 후 다시 시도해 주세요.';
    if (status === 422) return '저장할 수 없는 요청입니다. (' + raw + ')';
    return 'GitHub 오류 ' + status + (raw ? ': ' + raw : '');
  }

  function contentsPath(path) {
    return '/repos/' + target.owner + '/' + target.repo + '/contents/' +
      path.split('/').map(encodeURIComponent).join('/');
  }

  /* ── 파일 읽기/쓰기 ──────────────────────────── */

  /** 파일이 없으면 null. 있으면 { sha, text }. */
  function getFile(path) {
    return request('GET', contentsPath(path) + '?ref=' + encodeURIComponent(BRANCH))
      .then(function (data) { return { sha: data.sha, text: base64ToText(data.content) }; })
      .catch(function (e) { if (e.status === 404) return null; throw e; });
  }

  /** 내용을 내려받지 않고 sha 만 필요할 때 (바이너리 덮어쓰기용). 없으면 null. */
  function getSha(path) {
    return request('GET', contentsPath(path) + '?ref=' + encodeURIComponent(BRANCH))
      .then(function (data) { return data.sha; })
      .catch(function (e) { if (e.status === 404) return null; throw e; });
  }

  function getJSON(path) {
    return getFile(path).then(function (f) {
      if (!f) return null;
      try { return { sha: f.sha, data: JSON.parse(f.text) }; }
      catch (e) { throw new Error(path + ' 의 형식이 올바르지 않습니다.'); }
    });
  }

  /** base64 내용을 그대로 커밋. sha 를 주면 덮어쓰기, 없으면 새 파일. */
  function putBase64(path, base64, message, sha) {
    var body = { message: message, content: base64, branch: BRANCH };
    if (sha) body.sha = sha;
    return request('PUT', contentsPath(path), body);
  }

  function putBlob(path, blob, message, sha) {
    return blobToBase64(blob).then(function (b64) { return putBase64(path, b64, message, sha); });
  }

  /**
   * JSON 파일을 읽어 mutate() 로 바꾼 뒤 저장. sha 충돌(409/422)이면 한 번 재시도한다.
   * mutate(현재값) 는 저장할 새 값을 돌려준다.
   */
  function updateJSON(path, mutate, message, fallback) {
    function attempt(retriesLeft) {
      return getJSON(path).then(function (cur) {
        var base = cur ? cur.data : (fallback || {});
        var next = mutate(JSON.parse(JSON.stringify(base)));
        next.updatedAt = new Date().toISOString();
        var text = JSON.stringify(next, null, 2) + '\n';
        return putBase64(path, textToBase64(text), message, cur ? cur.sha : null)
          .then(function () { return next; })
          .catch(function (e) {
            if ((e.status === 409 || e.status === 422) && retriesLeft > 0) {
              return new Promise(function (r) { setTimeout(r, 700); }).then(function () {
                return attempt(retriesLeft - 1);
              });
            }
            throw e;
          });
      });
    }
    return attempt(2);
  }

  function deleteFile(path, message) {
    return getFile(path).then(function (f) {
      if (!f) return null; // 이미 없음
      return request('DELETE', contentsPath(path), { message: message, sha: f.sha, branch: BRANCH });
    });
  }

  /** 토큰이 이 저장소에 쓸 수 있는지 확인. { ok, login, canWrite, message } */
  function verify() {
    return request('GET', '/repos/' + target.owner + '/' + target.repo)
      .then(function (repo) {
        var canWrite = !!(repo.permissions && (repo.permissions.push || repo.permissions.admin));
        return {
          ok: canWrite,
          repo: repo.full_name,
          canWrite: canWrite,
          message: canWrite ? '연결되었습니다.' : '읽기 권한만 있습니다. Contents: Read and write 로 다시 발급해 주세요.'
        };
      });
  }

  global.GH = {
    target: target,
    getToken: getToken, setToken: setToken, clearToken: clearToken, hasToken: hasToken,
    getFile: getFile, getJSON: getJSON, getSha: getSha,
    putBase64: putBase64, putBlob: putBlob,
    updateJSON: updateJSON, deleteFile: deleteFile,
    verify: verify,
    textToBase64: textToBase64
  };
})(window);
