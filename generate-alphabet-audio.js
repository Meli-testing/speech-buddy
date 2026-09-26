// ================================================
// SpeechBuddy - Alfabet audio generator (RO)
// Run: node --env-file=.env generate-alphabet-audio.js [--force]
// Writes audio/alfabet-<key>-ro.mp3 ("Be, de la balon.") for the ALPHABET section.
// Text uses letter NAMES spelled out so the voice says them correctly.
// ================================================

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error('Set ELEVENLABS_API_KEY (use --env-file=.env).'); process.exit(1); }

const VOICE = { id: 'urzoE6aZYmSRdFQ6215h', settings: { stability: 0.87, similarity_boost: 0, speed: 0.92 } };
const MODEL = 'eleven_multilingual_v2';
const OUT_DIR = path.join(__dirname, 'audio');

// key -> text rostit
const LETTERS = {
  a: 'A, de la avion.',        a2: 'Ă, de la mătură.',     a3: 'Â, de la fântână.',
  b: 'Be, de la balon.',       c: 'Ce, de la casă.',       d: 'De, de la delfin.',
  e: 'E, de la elicopter.',    f: 'Ef, de la fluture.',    g: 'Ge, de la gorilă.',
  h: 'Haș, de la hipopotam.',  i: 'I, de la inimă.',       i2: 'Î, de la înghețată.',
  j: 'Je, de la jucărie.',     k: 'Ca, de la koala.',      l: 'El, de la lebădă.',
  m: 'Em, de la mașină.',      n: 'En, de la nor.',        o: 'O, de la ou.',
  p: 'Pe, de la pinguin.',     q: 'Chiu, de la cvad.',     r: 'Er, de la robot.',
  s: 'Es, de la sanie.',       s2: 'Șe, de la școală.',    t: 'Te, de la tren.',
  t2: 'Țe, de la țestoasă.',   u: 'U, de la umbrelă.',     v: 'Ve, de la vapor.',
  w: 'Dublu ve, de la uai-fai.', x: 'Ics, de la xilofon.', y: 'I grec, de la io-io.',
  z: 'Zet, de la zmeu.',
};

function tts(text) {
  const body = JSON.stringify({ text, model_id: MODEL, language_code: 'ro', voice_settings: VOICE.settings });
  return new Promise((resolve, reject) => {
    const req = https.request(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.id}`,
      { method: 'POST', headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg', 'Content-Length': Buffer.byteLength(body) } },
      (res) => {
        if (res.statusCode !== 200) { let e = ''; res.on('data', c => e += c); res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${e}`))); return; }
        const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve(Buffer.concat(chunks)));
      });
    req.on('error', reject); req.write(body); req.end();
  });
}

async function main() {
  const force = process.argv.includes('--force');
  const only = process.argv.slice(2).filter(a => !a.startsWith('--')); // ex: node ... generate-alphabet-audio.js q w --force
  let ok = 0, fail = 0;
  for (const [key, text] of Object.entries(LETTERS)) {
    if (only.length && !only.includes(key)) continue;
    const file = path.join(OUT_DIR, `alfabet-${key}-ro.mp3`);
    if (!force && fs.existsSync(file)) continue;
    try { fs.writeFileSync(file, await tts(text)); ok++; console.log(`OK   ${path.basename(file)}  "${text}"`); }
    catch (e) { fail++; console.error(`FAIL ${path.basename(file)}: ${e.message}`); }
  }
  console.log(`\nDone. ${ok} generated, ${fail} failed.`);
  if (fail) process.exit(1);
}
main();
