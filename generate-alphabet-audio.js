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
  // SUNETUL literei, nu numele ei (M = "Mmmâ", nu "em"). Punct la final ca să pronunțe corect.
  // m, a3 (Â), s2 (Ș) au fost făcute manual de Meli în ElevenLabs -> nu le regenera.
  a: 'Aaa ... de la avion.',      a2: 'Ăăă ... de la mătură.',   a3: 'Îîî ... de la fântână.',
  b: 'Bâ ... de la balon.',       c: 'Câ ... de la casă.',       d: 'Dâ ... de la delfin.',
  e: 'Eee ... de la elicopter.',  f: 'Fff ... de la fluture.',   g: 'Gâ ... de la gorilă.',
  h: 'Hhh ... de la hipopotam.',  i: 'Iii ... de la inimă.',     i2: 'Îîî ... de la înghețată.',
  j: 'Jjj ... de la jucărie.',    k: 'Kâ ... de la koala.',      l: 'Lllâ ... de la lebădă.',
  m: 'Mmmâ ... de la mașină.',    n: 'Nnnâ ... de la nor.',      o: 'Ooo ... de la ou.',
  p: 'Pâ ... de la pinguin.',     q: 'Kâ ... de la cuoca.',      r: 'Rrrâ ... de la robot.',
  s: 'Sss ... de la sanie.',      s2: 'Șș .... de la școală.',   t: 'Tâ ... de la tren.',
  t2: 'Țâ ... de la țestoasă.',   u: 'Uuu ... de la umbrelă.',   v: 'Vvv ... de la vapor.',
  w: 'Uuu ... de la uai-fai.',    x: 'Cs ... de la xilofon.',    y: 'Iii ... de la ioga.',
  z: 'Zzz ... de la zmeu.',
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
