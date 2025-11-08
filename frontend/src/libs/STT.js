import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import 'dotenv/config';
import fs from 'fs/promises';

const client = new ElevenLabsClient();

/**
 * Transcribe a WAV file and optionally return only one speaker's combined text.
 * @param {string} wavPath Path to wav file.
 * @param {object} opts Options.
 * @param {string} [opts.modelId='scribe_v1'] ElevenLabs STT model.
 * @param {boolean} [opts.diarize=true] Enable diarization.
 * @param {string|null} [opts.languageCode='eng'] Language or null for auto.
 * @param {string} [opts.speakerFilter] Speaker id like 'speaker_0'. If provided, returns only that speaker combined text.
 * @returns {Promise<{raw:any,text:string,speakerTexts?:Record<string,string>}>)}}
 */
export async function transcribe(wavPath, opts = {}) {
  const {
    modelId = 'scribe_v1',
    diarize = true,
    languageCode = 'eng',
    speakerFilter,
  } = opts;

  const wavBuffer = await fs.readFile(wavPath);
  const audioBlob = new Blob([wavBuffer], { type: 'audio/wav' });

  const t = await client.speechToText.convert({
    file: audioBlob,
    modelId,
    tagAudioEvents: true,
    languageCode,
    diarize,
  });

  // Build speaker texts map if utterances exist.
  const speakerTexts = {};
  if (t.utterances?.length) {
    for (const u of t.utterances) {
      const sp = u.speakerId ?? u.speaker ?? t.speakerId ?? 'unknown';
      if (!speakerTexts[sp]) speakerTexts[sp] = '';
      speakerTexts[sp] += (speakerTexts[sp] ? ' ' : '') + u.text.trim();
    }
  } else if (t.words?.length) {
    // Fallback grouping by words
    for (const w of t.words) {
      const sp = w.speakerId ?? w.speaker ?? t.speakerId ?? 'unknown';
      if (!speakerTexts[sp]) speakerTexts[sp] = '';
      speakerTexts[sp] += w.text;
    }
    for (const sp of Object.keys(speakerTexts)) {
      speakerTexts[sp] = speakerTexts[sp].replace(/\s+([.,!?;:])/g, '$1').trim();
    }
  } else {
    const sp = t.speakerId ?? 'unknown';
    speakerTexts[sp] = (t.text ?? '').trim();
  }

  let text;
  if (speakerFilter) {
    text = speakerTexts[speakerFilter] ?? '';
  } else {
    // Combine all speakers with labels
    text = Object.entries(speakerTexts)
      .map(([sp, tx]) => `${sp}: ${tx}`)
      .join('\n');
  }

  return { raw: t, text, speakerTexts };
}

// CLI usage when run directly: node src/libs/stt.js mic.wav speaker_0
if (import.meta.url === `file://${process.argv[1]}`) {
  const wav = process.argv[2] || 'src/libs/mic.wav';
  const speaker = process.argv[3];
  transcribe(wav, { speakerFilter: speaker }).then(r => {
    console.log(r.text);
  }).catch(e => {
    console.error(e);
    process.exit(1);
  });
}