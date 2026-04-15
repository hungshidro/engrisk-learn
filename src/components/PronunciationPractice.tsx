"use client";

import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/i18n";
import { smartSpeak } from "@/lib/tts";

// Extend Window for SpeechRecognition
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface Vocabulary {
  id: string;
  word: string;
  meaning: string;
  pronunciation: string | null;
  exampleSentence: string | null;
}

interface PronunciationPracticeProps {
  vocabularies: Vocabulary[];
}

type RecordingState = "idle" | "recording" | "processing";
type ResultState = "none" | "correct" | "incorrect";

export default function PronunciationPractice({
  vocabularies,
}: PronunciationPracticeProps) {
  const { t } = useI18n();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [resultState, setResultState] = useState<ResultState>("none");
  const [spokenWord, setSpokenWord] = useState<string>("");
  const [isSupported, setIsSupported] = useState(() => {
    if (typeof window === "undefined") return true;
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  });
  const [error, setError] = useState<string>("");
  const [attemptedWords, setAttemptedWords] = useState<Set<string>>(new Set());
  const [correctWords, setCorrectWords] = useState<Set<string>>(new Set());
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const currentVocab = vocabularies[currentIndex];


  const normalize = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ");

  const startRecording = useCallback(() => {
    setError("");
    setResultState("none");
    setSpokenWord("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      setRecordingState("recording");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      setRecordingState("processing");
      const results = event.results[event.resultIndex];
      const targetNormalized = normalize(currentVocab.word);

      // Check all alternatives for a match
      let matched = false;
      let bestTranscript = "";

      for (let i = 0; i < results.length; i++) {
        const transcript = results[i].transcript;
        if (!bestTranscript) bestTranscript = transcript;
        const normalizedTranscript = normalize(transcript);

        if (
          normalizedTranscript === targetNormalized ||
          normalizedTranscript.includes(targetNormalized) ||
          targetNormalized.includes(normalizedTranscript)
        ) {
          matched = true;
          bestTranscript = transcript;
          break;
        }
      }

      setSpokenWord(bestTranscript);
      setAttemptedWords((prev) => new Set(prev).add(currentVocab.id));

      if (matched) {
        setResultState("correct");
        if (!correctWords.has(currentVocab.id)) {
          setCorrectWords((prev) => new Set(prev).add(currentVocab.id));
        }
      } else {
        setResultState("incorrect");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setRecordingState("idle");
      if (event.error === "not-allowed") {
        setError(t.pronunciation.micPermission);
      } else if (event.error !== "aborted") {
        setError(event.error);
      }
    };

    recognition.onend = () => {
      setRecordingState((prev) => (prev === "recording" ? "idle" : prev));
      setTimeout(() => setRecordingState("idle"), 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [currentVocab, correctWords, t]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const handleMicClick = () => {
    if (recordingState === "recording") {
      stopRecording();
    } else if (recordingState === "idle") {
      startRecording();
    }
  };

  const goNext = () => {
    if (currentIndex < vocabularies.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setResultState("none");
      setSpokenWord("");
      setError("");
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setResultState("none");
      setSpokenWord("");
      setError("");
    }
  };

  const handleTryAgain = () => {
    setResultState("none");
    setSpokenWord("");
    setError("");
  };

  const handleListen = () => {
    smartSpeak(currentVocab.word);
  };

  if (!isSupported) {
    return (
      <div className="glass p-6 animate-fade-in-up mt-6">
        <div className="flex items-center gap-3 text-warning">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <span className="text-sm">{t.pronunciation.notSupported}</span>
        </div>
      </div>
    );
  }

  const isCompleted =
    correctWords.size === vocabularies.length && vocabularies.length > 0;

  return (
    <div className="glass p-6 animate-fade-in-up mt-6" style={{ animationDelay: "0.2s" }}>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="text-2xl">🎤</span>
          {t.pronunciation.title}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1 rounded-full bg-primary/20 text-primary-light font-medium">
            {correctWords.size}/{vocabularies.length}
          </span>
        </div>
      </div>

      {/* Instruction */}
      <p className="text-sm text-muted mb-6 text-center">
        {t.pronunciation.instruction}
      </p>

      {/* Progress Dots */}
      <div className="flex items-center justify-center gap-1.5 mb-6">
        {vocabularies.map((v, i) => (
          <button
            key={v.id}
            onClick={() => {
              setCurrentIndex(i);
              setResultState("none");
              setSpokenWord("");
              setError("");
            }}
            className={`pronunciation-dot ${
              correctWords.has(v.id)
                ? "pronunciation-dot-correct"
                : attemptedWords.has(v.id)
                ? "pronunciation-dot-attempted"
                : ""
            } ${i === currentIndex ? "pronunciation-dot-active" : ""}`}
          />
        ))}
      </div>

      {/* Completed Banner */}
      {isCompleted && (
        <div className="pronunciation-completed mb-6">
          <span className="text-3xl mb-2">🏆</span>
          <span className="text-lg font-bold text-success">
            {t.pronunciation.completed}
          </span>
          <span className="text-sm text-muted">
            {t.pronunciation.score}: {correctWords.size}/{vocabularies.length}
          </span>
        </div>
      )}

      {/* Word Card */}
      <div className="pronunciation-word-card">
        {/* Word Counter */}
        <div className="text-xs text-muted text-center mb-3">
          {t.pronunciation.wordOf
            .replace("{current}", String(currentIndex + 1))
            .replace("{total}", String(vocabularies.length))}
        </div>

        {/* Target Word */}
        <div className="text-center mb-1">
          <span
            className={`pronunciation-target-word ${
              resultState === "correct"
                ? "pronunciation-target-correct"
                : resultState === "incorrect"
                ? "pronunciation-target-incorrect"
                : ""
            }`}
          >
            {currentVocab.word}
          </span>
        </div>

        {/* Pronunciation hint */}
        {currentVocab.pronunciation && (
          <div className="text-center text-sm text-muted mb-1">
            {currentVocab.pronunciation}
          </div>
        )}

        {/* Meaning */}
        <div className="text-center text-sm text-muted/80 mb-5">
          {currentVocab.meaning}
        </div>

        {/* Listen button */}
        <div className="flex justify-center mb-5">
          <button
            onClick={handleListen}
            className="pronunciation-listen-btn"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
            {t.pronunciation.listenFirst}
          </button>
        </div>

        {/* Microphone Button */}
        <div className="flex flex-col items-center gap-3 mb-4">
          <button
            onClick={handleMicClick}
            disabled={recordingState === "processing"}
            className={`pronunciation-mic-btn ${
              recordingState === "recording"
                ? "pronunciation-mic-recording"
                : recordingState === "processing"
                ? "pronunciation-mic-processing"
                : ""
            }`}
          >
            {recordingState === "processing" ? (
              <div className="spinner !w-6 !h-6 !border-2 !border-white/30 !border-t-white" />
            ) : (
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
                />
              </svg>
            )}
          </button>
          <span className="text-xs text-muted">
            {recordingState === "recording"
              ? t.pronunciation.recording
              : recordingState === "processing"
              ? t.pronunciation.processing
              : t.pronunciation.tapToRecord}
          </span>
        </div>

        {/* Result Feedback */}
        {resultState !== "none" && (
          <div
            className={`pronunciation-result ${
              resultState === "correct"
                ? "pronunciation-result-correct"
                : "pronunciation-result-incorrect"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {resultState === "correct" ? (
                <svg
                  className="w-5 h-5 text-success"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-error"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <span
                className={`text-sm font-semibold ${
                  resultState === "correct" ? "text-success" : "text-error"
                }`}
              >
                {resultState === "correct"
                  ? t.pronunciation.correct
                  : t.pronunciation.incorrect}
              </span>
            </div>
            {spokenWord && (
              <div className="text-xs text-muted">
                <span className="opacity-70">{t.pronunciation.yourSaid}:</span>{" "}
                <span className="font-medium text-foreground">
                  &ldquo;{spokenWord}&rdquo;
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3">
              {resultState === "incorrect" && (
                <button
                  onClick={handleTryAgain}
                  className="pronunciation-action-btn"
                >
                  {t.pronunciation.tryAgain}
                </button>
              )}
              {resultState === "correct" &&
                currentIndex < vocabularies.length - 1 && (
                  <button
                    onClick={goNext}
                    className="pronunciation-action-btn pronunciation-action-btn-success"
                  >
                    {t.pronunciation.next}
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-center text-xs text-error mt-2 animate-fade-in-up">
            {error}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="pronunciation-nav-btn"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          {t.pronunciation.prev}
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === vocabularies.length - 1}
          className="pronunciation-nav-btn"
        >
          {t.pronunciation.next}
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
