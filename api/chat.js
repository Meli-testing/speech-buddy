export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'ElevenLabs API key not configured' });

  // Language-specific voices for natural accents
  const VOICES = {
    'ro-RO': 'urzoE6aZYmSRdFQ6215h', // Ana Maria - Romanian
    'en-GB': 'EXAVITQu4vr4xnSDxMaL', // Sarah - English
    'nl-NL': 'EXAVITQu4vr4xnSDxMaL', // Sarah - Dutch (replace later)
  };

  const voiceId = VOICES[lang] || VOICES['en-GB'];

  try {
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
          model_id: 'eleven_multilingual_v2',
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
      return res.status(response.status).json({ error: 'ElevenLabs API error' });
    }

    const audioBuffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('speak.js error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
