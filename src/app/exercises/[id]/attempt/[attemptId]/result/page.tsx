"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Option {
  id: string;
  content: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  type: "multiple_choice" | "fill_in_blank" | "word_order";
  content: string;
  correctAnswer: string | null;
  explanation: string | null;
  options: Option[];
}

interface Exercise {
  id: string;
  title: string;
  questions: Question[];
}

interface Attempt {
  id: string;
  answers: Record<string, string>;
  score: number;
  totalQuestions: number;
  status: string;
  completedAt: string;
}

export default function ResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = use(params);
  const { t } = useI18n();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchResult = useCallback(async () => {
    try {
      const res = await fetch(`/api/exercises/${id}/attempt/${attemptId}`);
      if (res.ok) {
        const data = await res.json();
        setAttempt(data.attempt);
        setExercise(data.exercise);
      }
    } catch (error) {
      console.error("Failed to fetch result:", error);
    } finally {
      setLoading(false);
    }
  }, [id, attemptId]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  const isCorrect = (question: Question, userAnswer: string) => {
    if (question.type === "multiple_choice") {
      const correctOption = question.options.find((o) => o.isCorrect);
      return correctOption?.id === userAnswer;
    } else {
      return (
        userAnswer?.trim().toLowerCase() ===
        question.correctAnswer?.trim().toLowerCase()
      );
    }
  };

  if (loading || !exercise || !attempt) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  const percentage = attempt.totalQuestions > 0
    ? Math.round((attempt.score / attempt.totalQuestions) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Score Card */}
      <div className="glass p-8 text-center mb-8 animate-fade-in-up">
        <h1 className="text-2xl font-bold mb-6">{t.result.title}</h1>

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
              stroke={percentage >= 70 ? "#10b981" : percentage >= 40 ? "#f59e0b" : "#ef4444"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(percentage / 100) * 339.3} 339.3`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold">{percentage}%</span>
            <span className="text-sm text-muted">{t.result.score}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <div className="text-2xl font-bold text-success">{attempt.score}</div>
            <div className="text-xs text-muted">{t.result.correct}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold text-error">
              {attempt.totalQuestions - attempt.score}
            </div>
            <div className="text-xs text-muted">{t.result.incorrect}</div>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold">{attempt.totalQuestions}</div>
            <div className="text-xs text-muted">Tổng</div>
          </div>
        </div>
      </div>

      {/* Question Review */}
      <h2 className="text-xl font-bold mb-4">Chi tiết câu trả lời</h2>
      <div className="space-y-4">
        {exercise.questions.map((q, qIndex) => {
          const userAnswer = attempt.answers[q.id];
          const correct = isCorrect(q, userAnswer);

          return (
            <div
              key={q.id}
              className={`glass p-5 animate-fade-in-up border-l-4 ${
                correct ? "!border-l-success" : "!border-l-error"
              }`}
              style={{ animationDelay: `${qIndex * 0.05}s` }}
            >
              <div className="flex items-start gap-3 mb-3">
                <span
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                    correct
                      ? "bg-success/20 text-success"
                      : "bg-error/20 text-error"
                  }`}
                >
                  {correct ? "✓" : "✗"}
                </span>
                <p className="text-sm font-medium leading-relaxed pt-1">{q.content}</p>
              </div>

              {q.type === "multiple_choice" ? (
                <div className="space-y-2 ml-11">
                  {q.options.map((opt) => {
                    const isUserAnswer = userAnswer === opt.id;
                    const isCorrectOpt = opt.isCorrect;
                    return (
                      <div
                        key={opt.id}
                        className={`p-3 rounded-xl border text-sm ${
                          isCorrectOpt
                            ? "border-success bg-success/10 text-success"
                            : isUserAnswer && !isCorrectOpt
                            ? "border-error bg-error/10 text-error"
                            : "border-border text-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isCorrectOpt && <span>✓</span>}
                          {isUserAnswer && !isCorrectOpt && <span>✗</span>}
                          <span>{opt.content}</span>
                          {isUserAnswer && (
                            <span className="ml-auto text-xs">({t.result.yourAnswer})</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="ml-11 space-y-2">
                  <div className={`p-3 rounded-xl border text-sm ${
                    correct
                      ? "border-success bg-success/10 text-success"
                      : "border-error bg-error/10 text-error"
                  }`}>
                    <span className="text-xs text-muted block mb-1">{t.result.yourAnswer}:</span>
                    {userAnswer || t.result.noAnswer}
                  </div>
                  {!correct && (
                    <div className="p-3 rounded-xl border border-success bg-success/10 text-success text-sm">
                      <span className="text-xs block mb-1">{t.result.correctAnswer}:</span>
                      {q.correctAnswer}
                    </div>
                  )}
                </div>
              )}

              {q.explanation && (
                <div className="ml-11 mt-3 p-3 rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted">
                  <span className="text-xs font-medium text-primary block mb-1">{t.result.explanation}</span>
                  {q.explanation}
                </div>
              )}
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
