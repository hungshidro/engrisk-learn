"use client";

import { useState, useEffect, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n";
import { smartSpeak } from "@/lib/tts";

interface Option {
  id: string;
  content: string;
}

interface Question {
  id: string;
  type: "multiple_choice" | "fill_in_blank";
  audioIndex: number | null;
  content: string;
  options: Option[];
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
  type: "quiz" | "listening" | "mixed";
  audioUrl: string | null;
  ttsText: string | null;
  ttsType: string | null;
  questions: Question[];
  audios: AudioEntry[];
}

export default function AttemptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="spinner" /></div>}>
      <AttemptContent params={params} />
    </Suspense>
  );
}

function AttemptContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attemptId");

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetchData();
  }, [id, attemptId]);

  const fetchData = async () => {
    try {
      // Fetch exercise
      const exRes = await fetch(`/api/exercises/${id}`);
      if (exRes.ok) {
        const exData = await exRes.json();
        setExercise(exData);
      }

      // Fetch existing attempt answers
      if (attemptId) {
        const atRes = await fetch(`/api/exercises/${id}/attempt/${attemptId}`);
        if (atRes.ok) {
          const atData = await atRes.json();
          if (atData.attempt?.answers) {
            setAnswers(atData.attempt.answers as Record<string, string>);
          }
          // Redirect to result if already completed
          if (atData.attempt?.status === "completed") {
            router.push(`/exercises/${id}/attempt/${attemptId}/result`);
            return;
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSave = async () => {
    if (!attemptId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/exercises/${id}/attempt`, {
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
      const res = await fetch(`/api/exercises/${id}/attempt`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, answers }),
      });
      if (res.ok) {
        router.push(`/exercises/${id}/attempt/${attemptId}/result`);
      }
    } catch (error) {
      console.error("Failed to submit:", error);
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const handleSpeak = (text: string, ttsType?: string | null) => {
    smartSpeak(text, ttsType);
  };

  if (loading || !exercise) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  const answered = Object.keys(answers).filter((k) => answers[k]).length;
  const total = exercise.questions.length;
  const progress = total > 0 ? (answered / total) * 100 : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="glass p-6 mb-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">{exercise.title}</h1>
          <span className={`badge ${exercise.type === "quiz" ? "badge-quiz" : exercise.type === "listening" ? "badge-listening" : "badge-quiz"}`}>
            {exercise.type === "quiz" ? t.exercise.quiz : exercise.type === "listening" ? t.exercise.listening : t.exercise.mixed}
          </span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm text-muted">{t.attempt.progress}</span>
          <div className="flex-1 progress-bar">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-medium">{answered}/{total}</span>
        </div>

      </div>

      {/* Questions */}
      <div className="space-y-4">
        {exercise.questions.map((q, qIndex) => (
          <div key={q.id} className="space-y-3">
            {q.audioIndex != null &&
              (qIndex === 0 || exercise.questions[qIndex - 1].audioIndex !== q.audioIndex) && (
                <div
                  className="glass p-4 animate-fade-in-up border border-secondary/30"
                  style={{ animationDelay: `${qIndex * 0.05}s` }}
                >
                  <h4 className="text-sm font-semibold text-secondary mb-2">
                    🎧 {exercise.audios?.[q.audioIndex]?.title || `Bài nghe ${q.audioIndex + 1}`}
                  </h4>
                  {exercise.audios?.[q.audioIndex]?.audioUrl && (
                    <audio controls className="w-full mb-2" src={exercise.audios[q.audioIndex].audioUrl!}>
                      Your browser does not support audio.
                    </audio>
                  )}
                  {exercise.audios?.[q.audioIndex]?.ttsText && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleSpeak(
                            exercise.audios[q.audioIndex].ttsText!,
                            exercise.audios[q.audioIndex].ttsType
                          )
                        }
                        className="btn-secondary text-xs"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        {t.tts.speak}
                      </button>
                      <span className="text-xs text-muted">Click để nghe</span>
                    </div>
                  )}
                </div>
              )}

            <div
              className="glass p-6 animate-fade-in-up"
              style={{ animationDelay: `${qIndex * 0.05}s` }}
            >
              <div className="flex items-start gap-3 mb-4">
                <span className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                  {qIndex + 1}
                </span>
                <p className="text-base font-medium leading-relaxed pt-1">{q.content}</p>
              </div>

              {q.type === "multiple_choice" ? (
                <div className="space-y-2 ml-11">
                  {q.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setAnswer(q.id, opt.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        answers[q.id] === opt.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-surface/30 text-muted hover:border-primary/40 hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            answers[q.id] === opt.id
                              ? "border-primary bg-primary"
                              : "border-border"
                          }`}
                        >
                          {answers[q.id] === opt.id && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <span className="text-sm">{opt.content}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="ml-11">
                  <input
                    type="text"
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswer(q.id, e.target.value)}
                    className="w-full"
                    placeholder={t.attempt.fillInPlaceholder}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="sticky bottom-4 mt-6">
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
