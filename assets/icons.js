/* 인라인 SVG 아이콘 — 이모지를 UI 요소로 쓰지 않기 위해.
   방 아이콘(🏠 등)은 사용자가 고르는 '내용'이므로 이모지 그대로 둔다. */
(function (global) {
  'use strict';

  var P = {
    search:   '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
    back:     '<path d="M15 19 8 12l7-7"/>',
    close:    '<path d="M18 6 6 18M6 6l12 12"/>',
    sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon:     '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>',
    paw:      '<ellipse cx="8" cy="8" rx="1.9" ry="2.5"/><ellipse cx="16" cy="8" rx="1.9" ry="2.5"/><ellipse cx="4.7" cy="13" rx="1.7" ry="2.2"/><ellipse cx="19.3" cy="13" rx="1.7" ry="2.2"/><path d="M12 12.5c2.8 0 5 2.2 5 4.6 0 1.7-1.3 2.9-3 2.9-1 0-1.4-.4-2-.4s-1 .4-2 .4c-1.7 0-3-1.2-3-2.9 0-2.4 2.2-4.6 5-4.6Z"/>',
    home:     '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1Z"/>',
    door:     '<path d="M5 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><circle cx="13" cy="12" r=".9"/>',
    grid:     '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    share:    '<path d="M12 15V4"/><path d="m8 7.5 4-3.5 4 3.5"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/>',
    download: '<path d="M12 4v11"/><path d="m8 11.5 4 3.5 4-3.5"/><path d="M5 20h14"/>',
    phone:    '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4 6.2 2 2 0 0 1 6 4Z"/>',
    chat:     '<path d="M20 12.2c0 3.8-3.6 6.8-8 6.8-.9 0-1.8-.1-2.6-.4L5 20l1-3.1A6.4 6.4 0 0 1 4 12.2C4 8.4 7.6 5.4 12 5.4s8 3 8 6.8Z"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    list:     '<path d="M4 6h16M4 12h16M4 18h10"/>',
    gear:     '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H2a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 3.3 7.9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V2a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.1Z"/>',
    camera:   '<path d="M4 8.5h3L8.5 6h7L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.4"/>',
    image:    '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4.5 17 4.2-4.2a1.5 1.5 0 0 1 2.1 0L16 17.5"/>',
    sparkle:  '<path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9Z"/><path d="M18.5 3.5 19 5l1.5.5L19 6l-.5 1.5L18 6l-1.5-.5L18 5Z"/>',
    lock:     '<rect x="4.5" y="10" width="15" height="10.5" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    trash:    '<path d="M4.5 7h15M9.5 7V5.2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7M6.5 7l.8 12.1a1 1 0 0 0 1 .9h7.4a1 1 0 0 0 1-.9L17.5 7"/>',
    check:    '<path d="m5 12.5 4.5 4.5L19 7"/>',
    heart:    '<path d="M12 20s-7.5-4.4-7.5-9.3A4.2 4.2 0 0 1 12 7.7a4.2 4.2 0 0 1 7.5 3C19.5 15.6 12 20 12 20Z"/>'
  };

  /** name 에 해당하는 SVG 문자열. cls 는 선택. */
  function Icon(name, cls) {
    var d = P[name];
    if (!d) return '';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' +
      (cls ? ' class="' + cls + '"' : '') + '>' + d + '</svg>';
  }

  Icon.filled = function (name, cls) {
    var d = P[name];
    if (!d) return '';
    return '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"' +
      (cls ? ' class="' + cls + '"' : '') + '>' + d + '</svg>';
  };

  global.Icon = Icon;
})(window);
