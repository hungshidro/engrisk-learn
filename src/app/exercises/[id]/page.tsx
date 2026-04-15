"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useI18n } from "@/i18n";
import { smartSpeak } from "@/lib/tts";
import ExerciseFollowers from "@/components/ExerciseFollowers";

interface Option {
  id: string;
  content: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  type: "multiple_choice" | "fill_in_blank";
  content: string;
  correctAnswer: string | null;
  explanation: string | null;
  orderIndex: number;
  options: Option[];
}

interface Vocabulary {
  id: string;
  word: string;
  meaning: string;
  pronunciation: string | null;
  exampleSentence: string | null;
}

interface AudioEntry {
  id: string;
  title: string | null;
  audioUrl: string | null;
  ttsText: string | null;
  ttsType: string | null;
}

interface Exercise {
  id: string;
  title: string;
  description: string | null;
  type: "quiz" | "listening" | "mixed";
  audioUrl: string | null;
  ttsText: string | null;
  ttsType: string | null;
  questions: Question[];
  vocabularies: Vocabulary[];
  audios: AudioEntry[];
  author: { id: string; name: string };
}

export default function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const { data: session } = useSession();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [showVocab, setShowVocab] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startingVocab, setStartingVocab] = useState(false);

  useEffect(() => {
    fetchExercise();
  }, [id]);

  const fetchExercise = async () => {
    try {
      const res = await fetch(`/api/exercises/${id}`);
      if (res.ok) {
        const data = await res.json();
        setExercise(data);
      }
    } catch (error) {
      console.error("Failed to fetch exercise:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/exercises/${id}`);
      return;
    }

    setStarting(true);
    try {
      const res = await fetch(`/api/exercises/${id}/attempt`, {
        method: "POST",
      });
      if (res.ok) {
        const attempt = await res.json();
        router.push(`/exercises/${id}/attempt?attemptId=${attempt.id}`);
      }
    } catch (error) {
      console.error("Failed to start attempt:", error);
    } finally {
      setStarting(false);
    }
  };

  const handleStartVocab = async () => {
    if (!session) {
      router.push(`/login?callbackUrl=/exercises/${id}`);
      return;
    }

    setStartingVocab(true);
    try {
      const res = await fetch(`/api/exercises/${id}/vocab-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const attempt = await res.json();
        router.push(`/exercises/${id}/vocab?attemptId=${attempt.id}`);
      }
    } catch (error) {
      console.error("Failed to start vocab attempt:", error);
    } finally {
      setStartingVocab(false);
    }
  };

  const handleSpeak = (text: string, ttsType?: string | null) => {
    smartSpeak(text, ttsType);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="text-center py-20">
        <p className="text-muted text-lg">Exercise not found</p>
        <Link href="/exercises" className="btn-primary mt-4 inline-flex">
          {t.result.backToExercises}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back */}
      <Link
        href="/exercises"
        className="text-muted hover:text-foreground text-sm flex items-center gap-1 mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t.common.back}
      </Link>

      {/* Header */}
      <div className="glass p-8 mb-6 animate-fade-in-up">
        <div className="flex items-start justify-between mb-4">
          <span className={`badge ${exercise.type === "quiz" ? "badge-quiz" : exercise.type === "listening" ? "badge-listening" : "badge-quiz"}`}>
            {exercise.type === "quiz" ? t.exercise.quiz : exercise.type === "listening" ? t.exercise.listening : t.exercise.mixed}
          </span>
          <span className="text-xs text-muted">
            {t.exercise.by} {exercise.author.name}
          </span>
        </div>

        <h1 className="text-3xl font-bold mb-3">{exercise.title}</h1>
        {exercise.description && (
          <p className="text-muted mb-6">{exercise.description}</p>
        )}

        <div className="flex items-center gap-6 text-sm text-muted mb-6">
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {exercise.questions.length} {t.exercise.questionsCount}
          </span>
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {exercise.vocabularies.length} {t.exercise.vocabCount}
          </span>
        </div>

        {/* Audio Player or TTS */}
        {(exercise.type === "listening" || exercise.type === "mixed") && (
          <div className="space-y-3 mb-6">
            {/* New multi-audio entries */}
            {exercise.audios && exercise.audios.length > 0 ? (
              exercise.audios.map((audio, i) => (
                <div key={audio.id} className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {audio.title || (exercise.audios.length > 1 ? `Bài nghe ${i + 1}` : "Bài nghe")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {audio.audioUrl && (
                      <audio controls className="h-8" src={audio.audioUrl}>
                        Your browser does not support audio.
                      </audio>
                    )}
                    {audio.ttsText && (
                      <button
                        onClick={() => handleSpeak(audio.ttsText!, audio.ttsType)}
                        className="btn-secondary text-xs !py-1.5 !px-3"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        </svg>
                        {t.tts.speak}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              /* Legacy fallback */
              <div className="p-4 rounded-xl bg-surface/50 border border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <span className="text-sm font-medium">Bài nghe</span>
                </div>
                <div className="flex items-center gap-2">
                  {exercise.audioUrl && (
                    <audio controls className="h-8" src={exercise.audioUrl}>
                      Your browser does not support audio.
                    </audio>
                  )}
                  {exercise.ttsText && (
                    <button
                      onClick={() => handleSpeak(exercise.ttsText!, exercise.ttsType)}
                      className="btn-secondary text-xs !py-1.5 !px-3"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      </svg>
                      {t.tts.speak}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={starting}
          className="btn-primary text-lg !px-8 !py-3 glow"
        >
          {starting ? (
            <div className="spinner !w-5 !h-5 !border-2 !border-white/30 !border-t-white" />
          ) : (
            <>
              {t.exercise.startExercise}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>

        {/* Vocab Practice Button */}
        {exercise.vocabularies.length > 0 && (
          <button
            onClick={handleStartVocab}
            disabled={startingVocab}
            className="btn-secondary text-lg !px-8 !py-3 ml-3"
          >
            {startingVocab ? (
              <div className="spinner !w-5 !h-5 !border-2" />
            ) : (
              <>
                📚 {t.vocabPractice.startVocab}
              </>
            )}
          </button>
        )}
      </div>

      {/* Vocabulary Section */}
      {exercise.vocabularies.length > 0 && (
        <div className="glass p-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <button
            onClick={() => setShowVocab(!showVocab)}
            className="w-full flex items-center justify-between text-left"
          >
            <h2 className="text-lg font-semibold">
              📚 {t.exercise.vocabulary} ({exercise.vocabularies.length})
            </h2>
            <svg
              className={`w-5 h-5 text-muted transition-transform ${showVocab ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showVocab && (
            <div className="mt-4 space-y-3 animate-slide-in">
              {exercise.vocabularies.map((vocab) => (
                <div
                  key={vocab.id}
                  className="p-4 rounded-xl bg-surface/50 border border-border flex flex-col sm:flex-row sm:items-center gap-2"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-primary">{vocab.word}</span>
                      {vocab.pronunciation && (
                        <span className="text-xs text-muted">{vocab.pronunciation}</span>
                      )}
                      <button
                        onClick={() => handleSpeak(vocab.word)}
                        className="text-muted hover:text-primary transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-sm text-muted">{vocab.meaning}</div>
                  </div>
                  {vocab.exampleSentence && (
                    <div className="text-xs text-muted italic sm:text-right">
                      &ldquo;{vocab.exampleSentence}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {session && (
        <ExerciseFollowers exerciseId={exercise.id} />
      )}
    </div>
  );
}
