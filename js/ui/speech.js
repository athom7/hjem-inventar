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

// Each pause in speech gives one final phrase. Phrases go on separate lines, which the parser treats as
// separate items – so "sofa … to lamper" becomes two items even without commas.
export function listen({ onPhrase, onInterim, onEnd, onError }) {
  const rec = new Recognition();
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
    if (e.error !== 'aborted') onError(ERRORS[e.error] ?? `Talegenkendelsen stoppede (${e.error}).`);
  };
  rec.onend = () => onEnd();
  try {
    rec.start();
  } catch {
    onError('Talegenkendelsen kunne ikke starte. Brug mikrofonen på tastaturet.');
    onEnd();
  }
  return () => rec.stop();
}
