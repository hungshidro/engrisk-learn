"use client";

import { useState, useEffect, use, useCallback, useRef, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Locale, useI18n } from "@/i18n";
import { smartSpeak } from "@/lib/tts";

// ─── Speech Recognition Types ───
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent {
  error: string;
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

// ─── Data Types ───
interface Vocabulary {
  id: string;
  word: string;
  meaning: string;
  pronunciation: string | null;
  exampleSentence: string | null;
}
interface Exercise {
  id: string;
  title: string;
  vocabularies: Vocabulary[];
}
interface VocabAnswer {
  meaning: string;
  meaningVocabId: string | null;
  pronunciation: string; // "correct" | "incorrect" | "skipped" | ""
}

interface VocabOption {
  text: string;
  vocabId: string | null;
}

// ─── Helpers ───
const FALLBACK_MEANINGS = [
  "tạo ra", "thấu hiểu", "khám phá", "cảm xúc", "to lớn",
  "ghi nhớ", "phương pháp", "tin tưởng", "quan trọng", "so sánh",
  "xinh đẹp", "khó khăn", "cải thiện", "kết quả", "xem xét",
  "ví dụ", "cẩn thận", "giải thích", "quy trình", "cần thiết",
];

const cleanMeaning = (m: string) => {
  if (!m) return "";
  // Take only the part before " / ", " - ", or " ("
  return m.split(" / ")[0].split(" - ")[0].split(" (")[0].trim();
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FALLBACK_WORDS = [
  "create", "understand", "discover", "emotion", "huge",
  "remember", "method", "believe", "important", "compare",
  "beautiful", "difficult", "improve", "result", "review",
  "example", "careful", "explain", "process", "necessary",
];

function generateOptions(
  correctVocab: Vocabulary,
  allVocabs: Vocabulary[],
  locale: Locale
): VocabOption[] {
  const getOptionText = (v: Vocabulary) =>
    locale === "vi" ? cleanMeaning(v.meaning) : v.word;
  const cleanCorrect = getOptionText(correctVocab);
  
  // Get 3 wrong from sibling vocabs
  const otherVocabs = allVocabs.filter((v) => v.id !== correctVocab.id);
  const wrongOptions: VocabOption[] = otherVocabs.map(v => ({
    text: getOptionText(v),
    vocabId: v.id
  }));

  // Unique by text to avoid identical options
  const uniqueWrongMap = new Map<string, VocabOption>();
  wrongOptions.forEach(opt => {
    if (opt.text !== cleanCorrect && !uniqueWrongMap.has(opt.text)) {
      uniqueWrongMap.set(opt.text, opt);
    }
  });

  const picked = shuffle(Array.from(uniqueWrongMap.values())).slice(0, 3);
  
  // Fill remaining with fallbacks if needed
  const fallbackSource = locale === "vi" ? FALLBACK_MEANINGS : FALLBACK_WORDS;
  while (picked.length < 3) {
    const fb = fallbackSource.find(
      (f) => cleanMeaning(f) !== cleanCorrect && !picked.some(p => p.text === cleanMeaning(f))
    );
    if (fb) {
      picked.push({ text: cleanMeaning(fb), vocabId: null });
    } else break;
  }

  const correctOption: VocabOption = { text: cleanCorrect, vocabId: correctVocab.id };
  return shuffle([correctOption, ...picked]);
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");

// ─── Main page wrapper ───
export default function VocabPracticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      }
    >
      <VocabPracticeContent params={params} />
    </Suspense>
  );
}

// ─── Content ───
function VocabPracticeContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId");

  // State
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [answers, setAnswers] = useState<Record<string, VocabAnswer>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<"meaning" | "pronunciation">("meaning");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState("");

  // Pronunciation state
  const [recordingState, setRecordingState] = useState<
    "idle" | "recording" | "processing"
  >("idle");
  const [pronunciationResult, setPronunciationResult] = useState<
    "none" | "correct" | "incorrect"
  >("none");
  const [spokenWord, setSpokenWord] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const currentVocab = exercise?.vocabularies[currentIndex];
  const optionsMap = useMemo(() => {
    if (!exercise) return {};
    const map: Record<string, VocabOption[]> = {};
    for (const v of exercise.vocabularies) {
      map[v.id] = generateOptions(v, exercise.vocabularies, locale);
    }
    return map;
  }, [exercise, locale]);

  // ─── Data loading ───
  useEffect(() => {
    fetchData();
  }, [id, attemptId]);

  const fetchData = async () => {
    try {
      const exRes = await fetch(`/api/exercises/${id}`);
      if (exRes.ok) {
        const exData = await exRes.json();
        setExercise(exData);
      }

      if (attemptId) {
        const atRes = await fetch(
          `/api/exercises/${id}/vocab-attempt/${attemptId}`
        );
        if (atRes.ok) {
          const atData = await atRes.json();
          if (atData.attempt?.answers) {
            setAnswers(atData.attempt.answers as Record<string, VocabAnswer>);
            // Resume position: find first unanswered
            if (atData.attempt.status === "completed") {
              router.push(
                `/exercises/${id}/vocab/${attemptId}/result`
              );
              return;
            }
            if (atData.exercise) {
              const vocabs = (atData.exercise as Exercise).vocabularies;
              const idx = vocabs.findIndex(
                (v: Vocabulary) => !atData.attempt.answers[v.id]
              );
              if (idx >= 0) setCurrentIndex(idx);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Meaning selection ───
  const selectMeaning = (option: VocabOption) => {
    if (!currentVocab) return;
    const prev = answers[currentVocab.id] || { meaning: "", meaningVocabId: null, pronunciation: "" };
    const updated = { 
      ...answers, 
      [currentVocab.id]: { 
        ...prev, 
        meaning: option.text,
        meaningVocabId: option.vocabId
      } 
    };
    setAnswers(updated);
    // REMOVED: Auto-advance to pronunciation. User must click "Continue"
  };

  // ─── Pronunciation ───
  const startRecording = useCallback(() => {
    if (!currentVocab) return;
    setPronunciationResult("none");
    setSpokenWord("");

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => setRecordingState("recording");

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      setRecordingState("processing");
      const results = event.results[event.resultIndex];
      const targetNormalized = normalize(currentVocab.word);

      let matched = false;
      let bestTranscript = "";

      for (let i = 0; i < results.length; i++) {
        const transcript = results[i].transcript;
        if (!bestTranscript) bestTranscript = transcript;
        const n = normalize(transcript);
        if (n === targetNormalized || n.includes(targetNormalized) || targetNormalized.includes(n)) {
          matched = true;
          bestTranscript = transcript;
          break;
        }
      }

      setSpokenWord(bestTranscript);

      const result = matched ? "correct" : "incorrect";
      setPronunciationResult(result);

      // Save answer
      const prev = answers[currentVocab.id] || { meaning: "", pronunciation: "" };
      setAnswers((a) => ({
        ...a,
        [currentVocab.id]: { ...prev, pronunciation: result },
      }));
    };

    recognition.onerror = () => setRecordingState("idle");
    recognition.onend = () => {
      setRecordingState((prev) => (prev === "recording" ? "idle" : prev));
      setTimeout(() => setRecordingState("idle"), 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [currentVocab, answers]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const handleMicClick = () => {
    if (recordingState === "recording") stopRecording();
    else if (recordingState === "idle") startRecording();
  };

  const skipPronunciation = () => {
    if (!currentVocab) return;
    const prev = answers[currentVocab.id] || { meaning: "", pronunciation: "" };
    setAnswers((a) => ({
      ...a,
      [currentVocab.id]: { ...prev, pronunciation: "skipped" },
    }));
    goNext();
  };

  // ─── Navigation ───
  const goNext = () => {
    if (!exercise) return;
    if (currentIndex < exercise.vocabularies.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetWordState();
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      resetWordState();
    }
  };

  const resetWordState = () => {
    setStep("meaning");
    setPronunciationResult("none");
    setSpokenWord("");
    setRecordingState("idle");
  };

  const jumpToWord = (idx: number) => {
    setCurrentIndex(idx);
    resetWordState();
  };

  // ─── Save / Submit ───
  const handleSave = async () => {
    if (!attemptId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/exercises/${id}/vocab-attempt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers }),
      });
      if (res.ok) {
        setToast(t.attempt.saved);
        setTimeout(() => setToast(""), 3000);
      }
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!attemptId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exercises/${id}/vocab-attempt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers }),
      });
      if (res.ok) {
        router.push(`/exercises/${id}/vocab/${attemptId}/result`);
      }
    } catch (error) {
      console.error("Failed to submit:", error);
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  // ─── Render ───
  if (loading || !exercise) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  const vocabs = exercise.vocabularies;
  const answeredCount = vocabs.filter(
    (v) => answers[v.id]?.meaning && answers[v.id]?.pronunciation
  ).length;
  const progress = vocabs.length > 0 ? (answeredCount / vocabs.length) * 100 : 0;
  const options = currentVocab ? optionsMap[currentVocab.id] || [] : [];

  // Check if current word already has answers
  const currentAnswer = currentVocab ? answers[currentVocab.id] : undefined;
  const meaningDone = !!(currentAnswer?.meaning);
  const pronDone = !!(currentAnswer?.pronunciation);
  const meaningCorrect = currentAnswer?.meaningVocabId === currentVocab?.id;
  const effectiveStep = meaningDone && step === "meaning" && pronDone ? "pronunciation" : step;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="glass p-6 mb-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/exercises/${id}`}
              className="text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold">{exercise.title}</h1>
          </div>
          <span className="badge badge-quiz">
            📚 {t.vocabPractice.title}
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm text-muted">{t.attempt.progress}</span>
          <div className="flex-1 progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium">
            {answeredCount}/{vocabs.length}
          </span>
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-6 flex-wrap">
        {vocabs.map((v, i) => {
          const a = answers[v.id];
          const meaningDone = !!a?.meaning;
          const pronDone = !!a?.pronunciation;
          
          const meaningCorrect = a?.meaningVocabId === v.id;
          const pronCorrect = a?.pronunciation === "correct";
          
          const isWrong = (meaningDone && !meaningCorrect) || (pronDone && a?.pronunciation === "incorrect");
          const isCorrect = meaningDone && meaningCorrect && pronDone && pronCorrect;
          const isPartial = (meaningDone || pronDone) && !isWrong && !isCorrect;

          return (
            <button
              key={v.id}
              onClick={() => jumpToWord(i)}
              className={`pronunciation-dot ${
                isCorrect
                  ? "pronunciation-dot-correct"
                  : isWrong
                  ? "pronunciation-dot-incorrect"
                  : isPartial
                  ? "pronunciation-dot-partial"
                  : ""
              } ${i === currentIndex ? "pronunciation-dot-active" : ""}`}
            />
          );
        })}
      </div>

      {/* Word Card */}
      {currentVocab && (
        <div className="glass p-6 mb-6 animate-fade-in-up relative">
          {/* Word counter */}
          <div className="text-center text-sm text-muted mb-4">
            {t.vocabPractice.wordProgress
              .replace("{current}", String(currentIndex + 1))
              .replace("{total}", String(vocabs.length))}
          </div>

          {/* Step tabs */}
          <div className="flex items-center justify-center gap-1 mb-6">
            <button
              onClick={() => setStep("meaning")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                effectiveStep === "meaning"
                  ? "bg-primary/20 text-primary-light border border-primary/30"
                  : "text-muted hover:text-foreground"
              }`}
            >
              1. {t.vocabPractice.meaningStep}
              {meaningDone && (
                <span className={`ml-1.5 ${meaningCorrect ? "text-success" : "text-error"}`}>
                  {meaningCorrect ? "✓" : "✗"}
                </span>
              )}
            </button>
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <button
              onClick={() => setStep("pronunciation")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                effectiveStep === "pronunciation"
                  ? "bg-primary/20 text-primary-light border border-primary/30"
                  : "text-muted hover:text-foreground"
              }`}
            >
              2. {t.vocabPractice.pronunciationStep}
              {pronDone && (
                <span className="ml-1.5 text-success">✓</span>
              )}
            </button>
          </div>

          {/* Target word display */}
          <div className="text-center mb-1">
            <span className="text-3xl font-bold">
              {locale === "vi" ? currentVocab.word : cleanMeaning(currentVocab.meaning)}
            </span>
          </div>
          {locale === "vi" && currentVocab.pronunciation && (
            <div className="text-center text-sm text-muted mb-1">
              {currentVocab.pronunciation}
            </div>
          )}

          {/* Listen button */}
          <div className="flex justify-center mb-6">
            <button
              onClick={() => smartSpeak(currentVocab.word)}
              className="pronunciation-listen-btn"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* ═══ STEP 1: Meaning Quiz ═══ */}
          {effectiveStep === "meaning" && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-muted text-center mb-4">
                {t.vocabPractice.chooseMeaning}
              </p>
              <div className="space-y-2 max-w-md mx-auto">
                {options.map((opt, i) => {
                  const selected =
                    currentAnswer?.meaningVocabId != null
                      ? currentAnswer.meaningVocabId === opt.vocabId
                      : currentAnswer?.meaning === opt.text;
                  const isCorrectOpt = opt.vocabId === currentVocab.id;
                  const showResult = meaningDone;

                  return (
                    <button
                      key={i}
                      onClick={() => !meaningDone && selectMeaning(opt)}
                      disabled={meaningDone}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-sm ${
                        showResult && selected && isCorrectOpt
                          ? "border-success bg-success/10 text-success"
                          : showResult && selected && !isCorrectOpt
                          ? "border-error bg-error/10 text-error"
                          : showResult && isCorrectOpt
                          ? "border-success/50 bg-success/5 text-success/80"
                          : selected
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-surface/30 text-muted hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            showResult && selected && isCorrectOpt
                              ? "border-success bg-success"
                              : showResult && selected && !isCorrectOpt
                              ? "border-error bg-error"
                              : selected
                              ? "border-primary bg-primary"
                              : "border-border"
                          }`}
                        >
                          {selected && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <span>{opt.text}</span>
                        {showResult && isCorrectOpt && (
                          <span className="ml-auto text-xs">✓</span>
                        )}
                        {showResult && selected && !isCorrectOpt && (
                          <span className="ml-auto text-xs">✗</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              {meaningDone && !pronDone && (
                <div className="mt-6 flex justify-center animate-fade-in-up">
                  <button
                    onClick={() => setStep("pronunciation")}
                    className="btn-primary"
                  >
                    {t.vocabPractice.pronunciationStep}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══ STEP 2: Pronunciation ═══ */}
          {effectiveStep === "pronunciation" && (
            <div className="animate-fade-in-up">
              <p className="text-sm text-muted text-center mb-4">
                {t.vocabPractice.pronounceWord}
              </p>

              {/* Meaning result summary */}
              {meaningDone && (
                <div
                  className={`text-center text-xs mb-4 px-3 py-1.5 rounded-full inline-flex items-center gap-1 mx-auto ${
                    currentAnswer?.meaningVocabId === currentVocab.id
                      ? "bg-success/10 text-success"
                      : "bg-error/10 text-error"
                  }`}
                  style={{ display: "flex", width: "fit-content", margin: "0 auto 16px" }}
                >
                  {currentAnswer?.meaningVocabId === currentVocab.id ? "✓" : "✗"}{" "}
                  {currentAnswer?.meaningVocabId === currentVocab.id
                    ? t.vocabPractice.meaningCorrect
                    : t.vocabPractice.meaningIncorrect}
                </div>
              )}

              {/* Mic button */}
              <div className="flex flex-col items-center gap-3 mb-4">
                <button
                  onClick={handleMicClick}
                  disabled={recordingState === "processing" || pronDone}
                  className={`pronunciation-mic-btn ${
                    recordingState === "recording"
                      ? "pronunciation-mic-recording"
                      : recordingState === "processing"
                      ? "pronunciation-mic-processing"
                      : pronDone
                      ? "!opacity-50"
                      : ""
                  }`}
                >
                  {recordingState === "processing" ? (
                    <div className="spinner !w-6 !h-6 !border-2 !border-white/30 !border-t-white" />
                  ) : (
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 15a3 3 0 003-3V5a3 3 0 00-6 0v7a3 3 0 003 3z"
                      />
                    </svg>
                  )}
                </button>

                {/* Show spoken word prominently */}
                {spokenWord && (
                  <div className="text-center animate-fade-in-up">
                    <span className="text-xs text-muted block mb-1">{t.pronunciation.yourSaid}:</span>
                    <span className={`text-lg font-bold ${
                      pronunciationResult === "correct" ? "text-success"
                        : pronunciationResult === "incorrect" ? "text-error"
                        : "text-foreground"
                    }`}>
                      &ldquo;{spokenWord}&rdquo;
                    </span>
                  </div>
                )}

                <span className="text-xs text-muted">
                  {pronDone
                    ? currentAnswer?.pronunciation === "correct"
                      ? t.vocabPractice.pronunciationCorrect
                      : currentAnswer?.pronunciation === "skipped"
                      ? t.vocabPractice.skipPronunciation
                      : t.vocabPractice.pronunciationIncorrect
                    : recordingState === "recording"
                    ? t.pronunciation.recording
                    : recordingState === "processing"
                    ? t.pronunciation.processing
                    : t.pronunciation.tapToRecord}
                </span>
              </div>

              {/* Pronunciation result */}
              {pronunciationResult !== "none" && (
                <div
                  className={`pronunciation-result max-w-md mx-auto ${
                    pronunciationResult === "correct"
                      ? "pronunciation-result-correct"
                      : "pronunciation-result-incorrect"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {pronunciationResult === "correct" ? (
                      <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    <span className={`text-sm font-semibold ${pronunciationResult === "correct" ? "text-success" : "text-error"}`}>
                      {pronunciationResult === "correct"
                        ? t.pronunciation.correct
                        : t.pronunciation.incorrect}
                    </span>
                  </div>
                  {spokenWord && (
                    <div className="text-xs text-muted">
                      {t.pronunciation.yourSaid}: &ldquo;{spokenWord}&rdquo;
                    </div>
                  )}
                </div>
              )}

              {/* Skip / Next buttons */}
              <div className="flex items-center justify-center gap-3 mt-4">
                {!pronDone && (
                  <button
                    onClick={skipPronunciation}
                    className="pronunciation-action-btn text-xs"
                  >
                    {t.vocabPractice.skipPronunciation}
                  </button>
                )}
                {pronDone && currentIndex < vocabs.length - 1 && (
                  <button
                    onClick={goNext}
                    className="pronunciation-action-btn pronunciation-action-btn-success"
                  >
                    {t.vocabPractice.nextWord}
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Side Navigation (desktop) */}
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="hidden md:flex items-center justify-center absolute left-3 top-1/2 -translate-y-1/2 pronunciation-nav-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goNext}
            disabled={currentIndex === vocabs.length - 1}
            className="hidden md:flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2 pronunciation-nav-btn"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Navigation (mobile) */}
      <div className="md:hidden flex items-center justify-between mb-6">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="pronunciation-nav-btn"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t.pronunciation.prev}
        </button>
        <button
          onClick={goNext}
          disabled={currentIndex === vocabs.length - 1}
          className="pronunciation-nav-btn"
        >
          {t.pronunciation.next}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Actions (desktop: fixed right) */}
      <div className="hidden md:block fixed right-6 top-24 z-40">
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-secondary h-10 w-10 justify-center !px-0"
            title={t.attempt.saveProgress}
            aria-label={t.attempt.saveProgress}
          >
            {saving ? (
              <div className="spinner !w-4 !h-4 !border-2" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="btn-success h-10 inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none"
          >
            {t.attempt.submit}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Actions (mobile: bottom) */}
      <div className="md:hidden sticky bottom-4">
        <div className="glass p-4 flex items-center justify-between">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-secondary"
          >
            {saving ? (
              <div className="spinner !w-4 !h-4 !border-2" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                {t.attempt.saveProgress}
              </>
            )}
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="btn-success"
          >
            {t.attempt.submit}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          </div>
        </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass p-6 max-w-md w-full mx-4 animate-fade-in-up">
            <h3 className="text-lg font-bold mb-3">{t.attempt.submit}</h3>
            <p className="text-sm text-muted mb-6">{t.attempt.confirmSubmit}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary">
                {t.attempt.cancel}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-success"
              >
                {submitting ? (
                  <div className="spinner !w-4 !h-4 !border-2 !border-white/30 !border-t-white" />
                ) : (
                  t.attempt.confirm
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast glass px-4 py-3 flex items-center gap-2 text-sm text-success">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}
