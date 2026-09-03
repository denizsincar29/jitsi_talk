/* Jitsi Talk — accessible wrapper around Jitsi Meet.
 * Rooms are taken from the URL path, the nickname from ?name=.
 * Announcements (participant join/leave/rename, chat messages) go to an
 * aria-live region (screen readers) plus optional speechSynthesis, and are
 * accompanied by short Web Audio chimes.
 */
(() => {
  'use strict';

  const JITSI_DOMAIN = 'voice.denizsincar.ru'; // the self-hosted Meet we wrap

  /* ---------------- i18n ---------------- */
  const L10N = {
    ru: {
      youJoined: 'Вы вошли в комнату %s',
      joined: '%s вошёл',
      left: '%s вышел',
      renamed: '%s теперь называется %s',
      alreadyIn: 'Уже в комнате: %s',
      message: 'Сообщение от %s: %s',
      participant: 'Участник',
      roomCount: 'В комнате %s',
      initError: 'Не удалось запустить звонок. Проверь соединение и обнови страницу.',
      mic: 'Микрофон', cam: 'Камера', chat: 'Чат', leave: 'Покинуть',
      soundsOn: 'Звуки: вкл', soundsOff: 'Звуки: выкл',
      speechOn: 'Озвучка: вкл', speechOff: 'Озвучка: выкл',
      guest: 'Гость',
    },
    en: {
      youJoined: 'You joined the room %s',
      joined: '%s joined',
      left: '%s left',
      renamed: '%s is now known as %s',
      alreadyIn: 'Already in the room: %s',
      message: 'Message from %s: %s',
      participant: 'Participant',
      roomCount: 'In the room: %s',
      initError: 'Could not start the call. Check your connection and reload the page.',
      mic: 'Microphone', cam: 'Camera', chat: 'Chat', leave: 'Leave',
      soundsOn: 'Sounds: on', soundsOff: 'Sounds: off',
      speechOn: 'Speech: on', speechOff: 'Speech: off',
      guest: 'Guest',
    },
    tr: {
      youJoined: '%s odasına katıldınız',
      joined: '%s katıldı',
      left: '%s ayrıldı',
      renamed: '%s artık %s olarak biliniyor',
      alreadyIn: 'Odada zaten: %s',
      message: '%s mesajı: %s',
      participant: 'Katılımcı',
      roomCount: 'Odada: %s',
      initError: 'Arama başlatılamadı. Bağlantını kontrol et ve sayfayı yenile.',
      mic: 'Mikrofon', cam: 'Kamera', chat: 'Sohbet', leave: 'Çık',
      soundsOn: 'Sesler: açık', soundsOff: 'Sesler: kapalı',
      speechOn: 'Seslendirme: açık', speechOff: 'Seslendirme: kapalı',
      guest: 'Misafir',
    },
  };

  const urlp = new URLSearchParams(location.search);
  let lang = urlp.get('lang');
  if (!L10N[lang]) lang = (navigator.language || 'ru').slice(0, 2);
  if (!L10N[lang]) lang = 'ru';
  const t = (k) => (L10N[lang] && L10N[lang][k]) || L10N.ru[k] || k;
  const fmt = (s, ...a) => { let i = 0; return s.replace(/%s/g, () => (i < a.length ? a[i++] : '')); };

  const $ = (id) => document.getElementById(id);

  /* ---------------- sound engine (Web Audio) ---------------- */
  let ac = null;
  let soundsOn = true;
  function tone(freq, dur, when, type, vol) {
    if (!soundsOn) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      const t0 = ac.currentTime + (when || 0);
      const v = vol == null ? 0.18 : vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) { /* audio is best-effort */ }
  }
  const snd = {
    join()  { tone(523, 0.13, 0); tone(784, 0.17, 0.10); },
    leave() { tone(440, 0.13, 0); tone(311, 0.20, 0.10); },
    msg()   { tone(988, 0.09, 0, 'sine', 0.12); tone(1319, 0.13, 0.09, 'sine', 0.10); },
    self()  { tone(392, 0.14, 0); tone(523, 0.14, 0.11); tone(659, 0.22, 0.22); },
  };

  /* ---------------- announce (aria-live + optional TTS) ---------------- */
  const live = $('live');
  let speechOn = false;
  function announce(text) {
    if (!text) return;
    live.textContent = '';               // clear to force re-announcement
    requestAnimationFrame(() => { live.textContent = text; });
    if (speechOn && 'speechSynthesis' in window) {
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang === 'tr' ? 'tr-TR' : lang === 'en' ? 'en-US' : 'ru-RU';
        speechSynthesis.speak(u);
      } catch (e) {}
    }
  }

  /* ---------------- page modes ---------------- */
  const pathRoom = (() => {
    let p = decodeURIComponent(location.pathname).replace(/\/+$/, '');
    if (!p || p === '/') return null;
    return p.replace(/^\//, '');
  })();

  if (pathRoom) initConference(pathRoom);
  else initLanding();

  function initLanding() {
    const sel = $('room'), cust = $('room-custom'), nameI = $('name'), langI = $('langsel');
    langI.value = lang;
    sel.addEventListener('change', () => { cust.hidden = sel.value !== '__custom'; });
    $('join-form').addEventListener('submit', (e) => {
      e.preventDefault();
      let r = sel.value === '__custom' ? cust.value.trim() : sel.value;
      if (!r) return;
      const q = new URLSearchParams();
      if (nameI.value.trim()) q.set('name', nameI.value.trim());
      const l = langI.value;
      if (l && l !== 'ru') q.set('lang', l);
      location.href = '/' + encodeURIComponent(r) + (q.toString() ? '?' + q : '');
    });
  }

  /* ---------------- conference ---------------- */
  function initConference(roomRaw) {
    document.title = roomRaw + ' — Jitsi Talk';
    $('appbar').hidden = false;
    $('landing').hidden = true;
    $('conference').hidden = false;
    $('roomname').textContent = '/' + roomRaw;
    const guest = t('guest');
    const myName = (urlp.get('name') || '').trim() || guest;

    buildToolbar();

    /* Build toolbar with translated labels + state toggles. */
    function buildToolbar() {
      const bar = $('toolbar');
      const mk = (key, cmd, danger, kbd) => {
        const b = document.createElement('button');
        b.dataset.cmd = cmd;
        if (kbd) b.dataset.key = kbd; // hotkey letter, used to rebuild the accessible name
        if (danger) b.className = 'danger';
        const span = document.createElement('span');
        span.className = 'lbl'; span.textContent = t(key);
        b.appendChild(span);
        // Accessible name spells the label and the hotkey separately ("Камера (V)"),
        // so screen readers never glue a stray Latin letter onto the word.
        b.setAttribute('aria-label', t(key) + (kbd ? ' (' + kbd + ')' : ''));
        if (kbd) { const k = document.createElement('kbd'); k.textContent = kbd; k.setAttribute('aria-hidden', 'true'); b.appendChild(k); }
        b.setAttribute('aria-pressed', 'false');
        bar.appendChild(b);
        return b;
      };
      const bMic = mk('mic', 'toggleAudio', false, 'M');
      const bCam = mk('cam', 'toggleVideo', false, 'V');
      const bChat = mk('chat', 'toggleChat', false, 'C');
      const bSnd = mk('soundsOn', 'toggleSounds', false, 'S');
      bSnd.dataset.stateKey = 'sounds'; bSnd.setAttribute('aria-pressed', 'true');
      const bSp = mk('speechOn', 'toggleSpeech', false, 'P');
      bSp.dataset.stateKey = 'speech'; bSp.setAttribute('aria-pressed', 'true');
      const bHang = mk('leave', 'hangup', true, 'H');
      return { bMic, bCam, bChat, bSnd, bSp, bHang };
    }

    function loadScript(src) {
      return new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = () => rej(new Error('load ' + src));
        document.head.appendChild(s);
      });
    }

    loadScript('https://' + JITSI_DOMAIN + '/external_api.js')
      .then(() => {
        const options = {
          roomName: roomRaw,
          parentNode: $('container'),
          width: '100%', height: '100%',
          userInfo: { displayName: myName },
          configOverwrite: {
            enableWelcomePage: false,
            disableDeepLinking: true,
            prejoinConfig: { enabled: false },
            defaultLanguage: L10N[lang] ? lang : 'en',
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            DEFAULT_REMOTE_DISPLAY_NAME: guest,
          },
        };
        let api;
        try { api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options); }
        catch (e) { announce(t('initError')); return; }

        let localId = null;
        const participants = new Map(); // participantId -> displayName

        const label = (p) => (p && p.displayName && p.displayName.trim()) ? p.displayName.trim() : guest;

        const setStatus = () => {
          const n = participants.size;
          $('statusline').textContent = n ? fmt(t('roomCount'), String(n)) : '';
        };

        api.addListener('videoConferenceJoined', (info) => {
          announce(fmt(t('youJoined'), roomRaw));
          snd.self();
          localId = (info && (info.localParticipantId || info.participantId || info.id)) || null;
          setTimeout(listExisting, 1500);
        });

        api.addListener('participantJoined', (p) => {
          if (p && localId && p.id === localId) return;
          if (p) participants.set(p.id, label(p));
          snd.join();
          announce(fmt(t('joined'), label(p)));
          setStatus();
        });

        api.addListener('participantLeft', (p) => {
          if (p && localId && p.id === localId) return;
          const n = (p && participants.get(p.id)) || label(p);
          if (p) participants.delete(p.id);
          snd.leave();
          announce(fmt(t('left'), n));
          setStatus();
        });

        api.addListener('displayNameChange', (info) => {
          if (!info || !info.id) return;
          const old = participants.get(info.id);
          const next = label(info);
          if (old && next && old !== next) announce(fmt(t('renamed'), old, next));
          participants.set(info.id, next);
        });

        /* 'incomingMessage' payload differs across Meet versions; accept both shapes. */
        api.addListener('incomingMessage', (a, b) => {
          const data = (b && typeof b === 'object') ? b : a;
          const isObj = data && typeof data === 'object';
          const text = isObj ? (data.message != null ? data.message : data.text) : (typeof a === 'string' ? a : '');
          if (!text) return;
          const senderId = isObj ? (data.senderId || data.id) : null;
          if (localId && senderId && senderId === localId) return; // own echo
          const who = isObj ? (data.displayName || data.senderDisplayName) : null;
          const name = who || participants.get(senderId) || guest;
          const short = String(text).length > 160 ? String(text).slice(0, 160) + '…' : String(text);
          snd.msg();
          announce(fmt(t('message'), name, short));
        });

        function listExisting() {
          try {
            const list = api.getParticipantsInfo();
            if (!Array.isArray(list)) return;
            const others = list.filter((x) => !x.isLocal);
            if (others.length) {
              const names = others.map(label).join(', ');
              announce(fmt(t('alreadyIn'), names));
            }
          } catch (e) { /* fine */ }
        }

        /* ---------------- toolbar + hotkeys ---------------- */
        const cmds = {
          toggleAudio() { api.executeCommand('toggleAudio'); },
          toggleVideo() { api.executeCommand('toggleVideo'); },
          toggleChat()  { api.executeCommand('toggleChat'); },
          hangup()      { api.executeCommand('hangup'); },
        };
        const stateBtns = {
          toggleSounds: { get: () => soundsOn, set: (v) => { soundsOn = v; } },
          toggleSpeech: { get: () => speechOn, set: (v) => { speechOn = v; } },
        };
        const labelKeys = {
          toggleSounds: ['soundsOn', 'soundsOff'],
          toggleSpeech: ['speechOn', 'speechOff'],
        };

        $('toolbar').addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-cmd]');
          if (!btn) return;
          const cmd = btn.dataset.cmd;
          if (stateBtns[cmd]) {
            const st = stateBtns[cmd];
            st.set(!st.get());
            btn.setAttribute('aria-pressed', String(st.get()));
            const lk = labelKeys[cmd][st.get() ? 0 : 1];
            btn.querySelector('.lbl').textContent = t(lk);
            const key = btn.dataset.key || '';
            btn.setAttribute('aria-label', t(lk) + (key ? ' (' + key + ')' : ''));
          } else if (cmds[cmd]) {
            cmds[cmd]();
          }
        });

        /* Global hotkeys fire while focus is on the wrapper chrome (outside the
         * Meet iframe). Inside the iframe Meet's own shortcuts take over. */
        window.addEventListener('keydown', (e) => {
          if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
          const map = { m: 'toggleAudio', v: 'toggleVideo', c: 'toggleChat', h: 'hangup', s: 'toggleSounds', p: 'toggleSpeech' };
          const cmd = map[e.key.toLowerCase()];
          if (!cmd) return;
          e.preventDefault();
          const btn = document.querySelector('#toolbar button[data-cmd="' + cmd + '"]');
          if (btn) btn.click(); else if (cmds[cmd]) cmds[cmd]();
        });
      })
      .catch(() => announce(t('initError')));
  }
})();
