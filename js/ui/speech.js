// Dictation through the browser's speech recognition (Chrome on Android, Safari on iPhone). When it is missing
// or refused, the keyboard's own microphone works in the text field just as well.

const Recognition = globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition ?? null;

export const speechSupported = () => Recognition !== null;

const ERRORS = {
  'not-allowed': 'Mikrofonen er ikke tilladt. Giv adgang i browserens indstillinger, eller brug mikrofonen på tastaturet.',
  'service-not-allowed': 'Talegenkendelse er slået fra i denne browser. Brug mikrofonen på tastaturet.',
  network: 'Talegenkendelsen kræver netværk her. Brug mikrofonen på tastaturet, den virker også offline.',
  'no-speech': 'Jeg hørte ikke noget. Prøv igen, lidt tættere på telefonen.',
  'audio-capture': 'Der blev ikke fundet nogen mikrofon.',
  'language-not-supported': 'Dansk talegenkendelse findes ikke i denne browser. Brug mikrofonen på tastaturet.',
};

// Errors where starting again would only fail again.
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'network']);

const RESTART_DELAY_MS = 300;
const STORM_COUNT = 5; // this many automatic restarts …
const STORM_WINDOW_MS = 3000; // … within this time means something is wrong: stop instead of looping

// Each pause in speech gives one final phrase. Phrases go on separate lines, which the parser treats as
// separate items – so "sofa … to lamper" becomes two items even without commas.
//
// keepAlive: browsers end a listening session on their own after some silence. For a walk through the house the
// microphone should stay on, so a session that ends by itself is started again until the returned stop() is called.
export function listen({ onPhrase, onInterim = () => {}, onEnd, onError, keepAlive = false }) {
  let stopped = false;
  let fatal = false;
  let finished = false;
  let rec = null;
  let restarts = [];

  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd();
  };

  const begin = () => {
    rec = new Recognition();
    rec.lang = 'da-DK';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onPhrase(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      if (FATAL.has(e.error)) fatal = true;
      if (keepAlive && e.error === 'no-speech') return; // just silence: the restart below takes care of it
      onError(ERRORS[e.error] ?? `Talegenkendelsen stoppede (${e.error}).`);
    };
    rec.onend = () => {
      onInterim('');
      if (!keepAlive || stopped || fatal) return finish();
      const now = Date.now();
      restarts = [...restarts.filter((t) => now - t < STORM_WINDOW_MS), now];
      if (restarts.length >= STORM_COUNT) {
        onError('Mikrofonen blev ved med at stoppe. Tryk på Start igen, eller brug mikrofonen på tastaturet.');
        return finish();
      }
      setTimeout(() => {
        if (stopped) return finish();
        try {
          begin();
        } catch {
          onError('Talegenkendelsen kunne ikke starte igen. Tryk på Start.');
          finish();
        }
      }, RESTART_DELAY_MS);
    };
    rec.start();
  };

  try {
    begin();
  } catch {
    onError('Talegenkendelsen kunne ikke starte. Brug mikrofonen på tastaturet.');
    finish();
  }

  return () => {
    stopped = true;
    try {
      rec?.stop();
    } catch { /* already stopped */ }
  };
}
