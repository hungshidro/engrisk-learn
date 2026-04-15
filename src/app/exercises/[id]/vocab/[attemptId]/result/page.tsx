"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Vocabulary {
  id: string;
  word: string;
  meaning: string;
  pronunciation: string | null;
}

interface Exercise {
  id: string;
  title: string;
  vocabularies: Vocabulary[];
}

interface VocabAnswer {
  meaning: string;
  pronunciation: string;
}

interface VocabAttempt {
  id: string;
  answers: Record<string, VocabAnswer>;
  score: number;
  totalItems: number;
  status: string;
  completedAt: string;
}

export default function VocabResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = use(params);
  const { t } = useI18n();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [attempt, setAttempt] = useState<VocabAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchResult();
  }, [id, attemptId]);

  const fetchResult = async () => {
    try {
      const res = await fetch(
        `/api/exercises/${id}/vocab-attempt/${attemptId}`
      );
      if (res.ok) {
        const data = await res.json();
        setAttempt(data.attempt);
        setExercise(data.exercise);
      }
    } catch (error) {
      console.error("Failed to fetch vocab result:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !exercise || !attempt) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  const vocabs = exercise.vocabularies;
  const percentage =
    attempt.totalItems > 0
      ? Math.round((attempt.score / attempt.totalItems) * 100)
      : 0;

  // Calculate meaning and pronunciation scores separately
  let meaningScore = 0;
  let pronunciationScore = 0;
  for (const v of vocabs) {
    const a = attempt.answers[v.id];
    if (!a) continue;
    if (a.meaning === v.meaning) meaningScore++;
    if (a.pronunciation === "correct") pronunciationScore++;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Score Card */}
      <div className="glass p-8 text-center mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-bold mb-6">
          {t.vocabPractice.resultTitle}
        </h1>

        {/* Circular Score */}
        <div className="relative w-40 h-40 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="rgba(99,102,241,0.1)"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke={
                percentage >= 70
                  ? "#10b981"
                  : percentage >= 40
                  ? "#f59e0b"
                  : "#ef4444"
              }
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 339.3} 339.3`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold">{percentage}%</span>
            <span className="text-sm text-muted">
              {t.vocabPractice.totalScore}
            </span>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-light">
              {meaningScore}/{vocabs.length}
            </div>
            <div className="text-xs text-muted">
              {t.vocabPractice.meaningScore}
            </div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold text-secondary">
              {pronunciationScore}/{vocabs.length}
            </div>
            <div className="text-xs text-muted">
              {t.vocabPractice.pronunciationScore}
            </div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold text-success">
              {attempt.score}/{attempt.totalItems}
            </div>
            <div className="text-xs text-muted">
              {t.vocabPractice.totalScore}
            </div>
          </div>
        </div>
      </div>

      {/* Per-word breakdown */}
      <h2 className="text-xl font-bold mb-4">
        {t.vocabPractice.title}
      </h2>
      <div className="space-y-4">
        {vocabs.map((vocab, i) => {
          const answer = attempt.answers[vocab.id];
          const meaningCorrect = answer?.meaning === vocab.meaning;
          const pronCorrect = answer?.pronunciation === "correct";
          const pronSkipped = answer?.pronunciation === "skipped";

          return (
            <div
              key={vocab.id}
              className="glass p-5 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {/* Word header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-lg font-bold">{vocab.word}</span>
                  {vocab.pronunciation && (
                    <span className="text-xs text-muted">
                      {vocab.pronunciation}
                    </span>
                  )}
                </div>
              </div>

              {/* Meaning row */}
              <div className="flex items-center gap-3 mb-2 ml-10">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    meaningCorrect
                      ? "bg-success/20 text-success"
                      : "bg-error/20 text-error"
                  }`}
                >
                  {meaningCorrect ? "✓" : "✗"}
                </span>
                <div className="flex-1">
                  <span className="text-xs text-muted block">
                    {t.vocabPractice.meaningStep}
                  </span>
                  <span className="text-sm">
                    {answer?.meaning || "—"}
                  </span>
                  {!meaningCorrect && (
                    <span className="text-xs text-success ml-2">
                      → {vocab.meaning}
                    </span>
                  )}
                </div>
              </div>

              {/* Pronunciation row */}
              <div className="flex items-center gap-3 ml-10">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    pronCorrect
                      ? "bg-success/20 text-success"
                      : pronSkipped
                      ? "bg-warning/20 text-warning"
                      : "bg-error/20 text-error"
                  }`}
                >
                  {pronCorrect ? "✓" : pronSkipped ? "—" : "✗"}
                </span>
                <div className="flex-1">
                  <span className="text-xs text-muted block">
                    {t.vocabPractice.pronunciationStep}
                  </span>
                  <span
                    className={`text-sm ${
                      pronCorrect
                        ? "text-success"
                        : pronSkipped
                        ? "text-warning"
                        : "text-error"
                    }`}
                  >
                    {pronCorrect
                      ? t.vocabPractice.pronunciationCorrect
                      : pronSkipped
                      ? t.vocabPractice.skipPronunciation
                      : t.vocabPractice.pronunciationIncorrect}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
        <Link href={`/exercises/${id}`} className="btn-primary">
          {t.result.retry}
        </Link>
        <Link href="/exercises" className="btn-secondary">
          {t.result.backToExercises}
        </Link>
      </div>
    </div>
  );
}
