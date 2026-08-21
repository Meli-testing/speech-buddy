// ================================================
// SpeechBuddy - Mouth Exercise Tips Audio Generator
// Run: node --env-file=.env generate-mouth-audio.js
// Pre-generates audio for every MOUTH_EXERCISES tip, matching the
// SOUNDS/WORDS/INSTRUCTIONS pattern instead of live TTS — the tips were
// never wired to pre-generated audio, which caused the mouth-exercise
// screen's playback delay.
// ================================================

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('Set ELEVENLABS_API_KEY in the environment before running this script.');
  process.exit(1);
}

const VOICE_PROFILES = {
  ro: { id: 'urzoE6aZYmSRdFQ6215h', settings: { stability: 0.87, similarity_boost: 0, speed: 0.92 } },
  nl: { id: 'ANHrhmaFeVN0QJaa0PhL', settings: { stability: 0.83, similarity_boost: 0.41, speed: 0.85, use_speaker_boost: true } },
  en: { id: 'EXAVITQu4vr4xnSDxMaL', settings: { stability: 0.83, speed: 0.85 } },
};

const MODEL = 'eleven_multilingual_v2';
const LANG_CODE = { RO: 'ro', EN: 'en', NL: 'nl' };
const OUT_DIR = path.join(__dirname, 'audio');

function parseHtml() {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  const mouthBlock = html.match(/const MOUTH_EXERCISES = \{([\s\S]*?)\n\};/)[1];
  const MOUTH_EXERCISES = {};
  for (const [, lang, body] of mouthBlock.matchAll(/(RO|EN|NL):\s*\[([\s\S]*?)\n  \],/g)) {
    const tips = [...body.matchAll(/tip:'([^']+)'/g)].map(m => m[1]);
    MOUTH_EXERCISES[lang] = tips;
  }

  const slugsBlock = html.match(/const AUDIO_SLUGS = \{([\s\S]*?)\n\};/)[1];
  const AUDIO_SLUGS = {};
  for (const m of slugsBlock.matchAll(/'([^']+)'\s*:\s*'([a-zA-Z0-9-]+)'/g)) AUDIO_SLUGS[m[1]] = m[2];

  return { MOUTH_EXERCISES, AUDIO_SLUGS };
}

function ttsRequest(text, lang) {
  const profile = VOICE_PROFILES[lang];
  const body = JSON.stringify({ text, model_id: MODEL, language_code: lang, voice_settings: profile.settings });
  return new Promise((resolve, reject) => {
    const req = https.request(
      `https://api.elevenlabs.io/v1/text-to-speech/${profile.id}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let err = '';
          res.on('data', (c) => (err += c));
          res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${err}`)));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const force = process.argv.includes('--force');
  const { MOUTH_EXERCISES, AUDIO_SLUGS } = parseHtml();

  const jobs = [];
  for (const lang of ['RO', 'EN', 'NL']) {
    const lc = LANG_CODE[lang];
    for (const tip of MOUTH_EXERCISES[lang]) {
      const slug = AUDIO_SLUGS[tip];
      if (!slug) { console.warn(`Skip: no AUDIO_SLUGS entry for "${tip}" (${lang})`); continue; }
      const file = path.join(OUT_DIR, `${slug}-${lc}.mp3`);
      if (!force && fs.existsSync(file)) continue;
      const text = /[.!?]$/.test(tip) ? tip : tip + '.';
      jobs.push({ lang: lc, text, file });
    }
  }

  console.log(`${jobs.length} file(s) to generate.`);
  let ok = 0, failed = [];
  for (const job of jobs) {
    try {
      const audio = await ttsRequest(job.text, job.lang);
      fs.writeFileSync(job.file, audio);
      ok++;
      console.log(`OK  ${path.basename(job.file)}`);
    } catch (e) {
      failed.push({ ...job, error: e.message });
      console.error(`FAIL ${path.basename(job.file)}: ${e.message}`);
    }
  }

  console.log(`\nDone. ${ok}/${jobs.length} generated.`);
  if (failed.length) {
    console.log('Failed:');
    failed.forEach(f => console.log(` - ${f.text} (${f.lang}): ${f.error}`));
    process.exit(1);
  }
}

main();
