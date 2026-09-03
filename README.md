# Jitsi Talk

A small, **accessibility-first wrapper around a self-hosted Jitsi Meet** for
family and friends. It turns a plain Jitsi room URL into a page that **announces
what is happening** — who joined, who left, who renamed themselves, and who wrote
in chat — for screen-reader users, with optional spoken (TTS) output and short
Web Audio chimes as a second cue.

Built for a family use case: casual group calls between a grandfather in Russia,
a father in Turkey and the rest of the family — where Telegram/WhatsApp voice
calls are unreliable or blocked, and the participants do not use (and cannot be
expected to install) heavy messengers.

The real Meet UI is embedded as-is in an iframe via the
[Jitsi Meet External API](https://github.com/jitsi/jitsi-meet/blob/master/doc/api.md).
No video/audio is re-implemented — this wrapper only adds the *event layer* on top.

## URL scheme

```
https://talk.denizsincar.ru/<room>?name=<Nickname>[&lang=ru|en|tr]
```

* `<room>` — taken from the URL path (`/family`, `/tr`, `/deniz`, or anything else).
* `name` — your display name. If omitted you join as “Guest”.
* `lang` — language of announcements and toolbar (`ru` default, `en`, `tr`).

Predefined rooms:

| Path        | Purpose                                   |
|-------------|-------------------------------------------|
| `/family`   | Russian-speaking family                    |
| `/tr`       | Father & relatives in Turkey (Turkish UI)  |
| `/deniz`    | Friends, and everything else               |

Visiting the bare root shows a small landing page with a room + name chooser
instead of dropping you straight into a call.

## What the wrapper adds

* **Participant events → announcements.** On join/leave/rename the page plays a
  distinct chime and pushes a human sentence into an off-screen `aria-live`
  region, so a screen reader (VoiceOver, TalkBack, NVDA) reads it aloud:
  * join — rising two-note chime, “Имя вошёл”
  * leave — falling two-note chime, “Имя вышел”
  * rename — “Имя теперь называется X”
  * message — soft ping, “Сообщение от Имя: текст” (long messages are truncated)
* **“Already in the room” recap** a moment after you join, so you are not
  dropped into a busy room in silence.
* **Optional spoken output (TTS)** — for people who are not screen-reader users
  but still want their hands/eyes free. Off by default, toggle with `P`.
* **Event sounds toggle** (`S`) — all chimes can be muted.
* **Accessible toolbar** above the call (tabbable buttons, translated labels)
  for microphone, camera, chat and leaving — so the essential controls are
  reachable without tabbing through the whole embedded Meet UI.

### Hotkeys

The wrapper adds global hotkeys that work while focus is on the page chrome
(buttons/heading). Inside the embedded Meet iframe, **Meet's own keyboard
shortcuts** take over — the wrapper does not fight the iframe for keystrokes.

| Key | Action (wrapper toolbar) |
|-----|--------------------------|
| `M` | toggle microphone        |
| `V` | toggle camera            |
| `C` | toggle chat panel        |
| `H` | leave the call           |
| `S` | toggle event sounds      |
| `P` | toggle spoken (TTS) output |

In-call hints: Meet defaults include `M` mute, `D` raise/lower hand, `Space`
push-to-talk (when enabled), and more — they are available once the iframe has
focus.

## Configuration

* `JITSI_DOMAIN` in `app.js` — the Meet instance to embed
  (here `voice.denizsincar.ru`).
* The external API script is loaded from `https://<JITSI_DOMAIN>/external_api.js`,
  which every Meet deployment serves.

## Deploy

The project is plain static files — no build step.

```
git clone https://github.com/denizsincar29/jitsi_talk.git
# …or copy index.html / app.js / style.css to your web root
```

Point a domain (e.g. `talk.denizsincar.ru`) at the folder and you are done.
The domain embedding the iframe and the Meet domain may differ; the wrapper
talks to Meet through the External API regardless.

## Notes & limitations

* A **ring on an incoming call** (phone-style “someone is calling you” with the
  app closed) is not possible for a plain web page/PWA — that last mile
  (CallKit/PushKit) is reserved for native store apps. This wrapper is for
  *scheduled / agreed* family calls: everyone opens the same room link at the
  agreed time, and the page tells you when people arrive.
* Announcements are event-driven: they reflect who is *currently connected*, not
  who merely has the page open in the background (Meet does not report that).

## License

MIT.
