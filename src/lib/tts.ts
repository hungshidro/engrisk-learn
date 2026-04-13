// TTS utility with conversation support (2 voices, content only)

interface SpeakOptions {
  rate?: number;
  lang?: string;
}

/**
 * Get 2 distinct English voices for conversation mode
 */
function getTwoVoices(): [SpeechSynthesisVoice | null, SpeechSynthesisVoice | null] {
  const allVoices = speechSynthesis.getVoices();
  const enVoices = allVoices.filter((v) => v.lang.startsWith("en"));

  if (enVoices.length === 0) return [null, null];

  // Try to find a male and female voice
  const female = enVoices.find(
    (v) =>
      v.name.toLowerCase().includes("female") ||
      v.name.toLowerCase().includes("samantha") ||
      v.name.toLowerCase().includes("karen") ||
      v.name.toLowerCase().includes("victoria") ||
      v.name.toLowerCase().includes("fiona")
  );
  const male = enVoices.find(
    (v) =>
      v.name.toLowerCase().includes("male") ||
      v.name.toLowerCase().includes("daniel") ||
      v.name.toLowerCase().includes("alex") ||
      v.name.toLowerCase().includes("fred") ||
      v.name.toLowerCase().includes("tom")
  );

  if (female && male) return [female, male];

  // Fallback: just use first two different voices
  if (enVoices.length >= 2) return [enVoices[0], enVoices[1]];

  return [enVoices[0], enVoices[0]];
}

/**
 * Parse conversation text into lines with speaker identification
 * Format: "A: Hello\nB: Hi there\nA: How are you?"
 * Returns array of { speaker: string, content: string }
 */
function parseConversation(text: string): { speaker: string; content: string }[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const parsed: { speaker: string; content: string }[] = [];

  for (const line of lines) {
    // Match patterns like "A:", "B:", "Speaker 1:", "Alice:", etc.
    const match = line.match(/^([A-Za-z0-9\s]+?):\s*(.+)$/);
    if (match) {
      parsed.push({ speaker: match[1].trim(), content: match[2].trim() });
    } else {
      // Line without speaker prefix - treat as continuation
      parsed.push({ speaker: "", content: line });
    }
  }

  return parsed;
}

/**
 * Speak text as a paragraph (single voice)
 */
export function speakParagraph(text: string, options?: SpeakOptions) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = options?.lang || "en-US";
  utterance.rate = options?.rate || 0.9;
  speechSynthesis.speak(utterance);
}

/**
 * Speak text as a conversation with 2 alternating voices.
 * Only reads content, not speaker names.
 */
export function speakConversation(text: string, options?: SpeakOptions) {
  speechSynthesis.cancel();

  const lines = parseConversation(text);
  if (lines.length === 0) return;

  // Identify unique speakers to assign voices
  const speakers = [...new Set(lines.filter((l) => l.speaker).map((l) => l.speaker))];
  const [voice1, voice2] = getTwoVoices();

  // Queue each line with appropriate voice
  lines.forEach((line, index) => {
    const utterance = new SpeechSynthesisUtterance(line.content);
    utterance.lang = options?.lang || "en-US";
    utterance.rate = options?.rate || 0.85;

    // Determine which voice to use
    const speakerIndex = speakers.indexOf(line.speaker);
    const isSecondSpeaker = speakerIndex % 2 === 1;

    if (isSecondSpeaker) {
      // Second speaker: different pitch + voice
      if (voice2) utterance.voice = voice2;
      utterance.pitch = 1.3; // Higher pitch
    } else {
      // First speaker (or no speaker): default voice
      if (voice1) utterance.voice = voice1;
      utterance.pitch = 0.9; // Lower pitch
    }

    // Small pause between lines
    if (index > 0) {
      const pause = new SpeechSynthesisUtterance("");
      pause.lang = options?.lang || "en-US";
      // Use a very short pause word
      pause.text = " ";
      pause.rate = 0.1;
      speechSynthesis.speak(pause);
    }

    speechSynthesis.speak(utterance);
  });
}

/**
 * Smart speak: auto-detects conversation or paragraph based on ttsType
 */
export function smartSpeak(
  text: string,
  ttsType?: string | null,
  options?: SpeakOptions
) {
  // Ensure voices are loaded
  if (speechSynthesis.getVoices().length === 0) {
    // Voices might not be loaded yet, wait for them
    speechSynthesis.onvoiceschanged = () => {
      if (ttsType === "conversation") {
        speakConversation(text, options);
      } else {
        speakParagraph(text, options);
      }
    };
    // Trigger voice loading
    speechSynthesis.getVoices();
    return;
  }

  if (ttsType === "conversation") {
    speakConversation(text, options);
  } else {
    speakParagraph(text, options);
  }
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking() {
  speechSynthesis.cancel();
}
