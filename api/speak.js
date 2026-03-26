export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'No API key' });

  const VOICES = {
    'ro-RO': 'EXAVITQu4vr4xnSDxMaL', // Sarah
    'en-GB': 'EXAVITQu4vr4xnSDxMaL', // Sarah
    'nl-NL': 'EXAVITQu4vr4xnSDxMaL', // Sarah
  };

  const voiceId = VOICES[lang] || VOICES['en-GB'];
  const langCode = lang ? lang.split('-')[0] : 'en';

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        language_code: langCode,
        voice_settings: {
          stability: 0.55,
          similarity_boost: 0.75,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('ElevenLabs error:', err);
    return res.status(500).json({ error: err });
  }

  const audioBuffer = await response.arrayBuffer();
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(audioBuffer));
}
