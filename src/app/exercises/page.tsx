"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n";

interface Exercise {
  id: string;
  title: string;
  description: string | null;
  type: "quiz" | "listening" | "mixed";
  questionCount: number;
  vocabCount: number;
  createdAt: string;
}

export default function ExercisesPage() {
  const { t } = useI18n();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    try {
      const res = await fetch("/api/exercises");
      if (res.ok) {
        const data = await res.json();
        setExercises(data);
      }
    } catch (error) {
      console.error("Failed to fetch exercises:", error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = exercises.filter((e) => {
    const matchesType = filter === "all" || e.type === filter;
    const matchesSearch =
      !search ||
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.description?.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text">{t.nav.exercises}</h1>
          <p className="text-muted mt-1">{t.hero.subtitle}</p>
        </div>
        <Link href="/exercises/create" className="btn-primary">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t.exercise.create}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.exercise.searchPlaceholder}
            className="w-full !pl-10"
          />
        </div>
        <div className="flex gap-2">
          {["all", "quiz", "listening", "mixed"].map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === type
                  ? "bg-primary text-white"
                  : "bg-surface border border-border text-muted hover:text-foreground hover:border-primary/40"
              }`}
            >
              {type === "all"
                ? t.exercise.allTypes
                : type === "quiz"
                ? t.exercise.quiz
                : type === "listening"
                ? t.exercise.listening
                : t.exercise.mixed}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <svg className="w-16 h-16 text-muted/30 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-muted text-lg">{t.exercise.noExercises}</p>
          <Link href="/exercises/create" className="btn-primary mt-4 inline-flex">
            {t.exercise.create}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((exercise, i) => (
            <Link
              key={exercise.id}
              href={`/exercises/${exercise.id}`}
              className="glass-card p-6 block animate-fade-in-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`badge ${exercise.type === "quiz" ? "badge-quiz" : exercise.type === "listening" ? "badge-listening" : "badge-quiz"}`}>
                  {exercise.type === "quiz"
                    ? t.exercise.quiz
                    : exercise.type === "listening"
                    ? t.exercise.listening
                    : t.exercise.mixed}
                </span>
                <span className="text-xs text-muted">
                  {new Date(exercise.createdAt).toLocaleDateString("vi-VN")}
                </span>
              </div>
              <h3 className="text-lg font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                {exercise.title}
              </h3>
              {exercise.description && (
                <p className="text-sm text-muted mb-4 line-clamp-2">
                  {exercise.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-muted mt-auto pt-3 border-t border-border">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {exercise.questionCount} {t.exercise.questionsCount}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  {exercise.vocabCount} {t.exercise.vocabCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
