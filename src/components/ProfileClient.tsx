"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { useI18n } from "@/i18n";

interface ExerciseItem {
  id: string;
  title: string;
  type: string;
}

interface AttemptItem {
  id: string;
  exerciseId: string;
  status: string;
  score: number | null;
  totalQuestions: number;
  startedAt: string | Date;
  completedAt: string | Date | null;
  updatedAt: string | Date;
  answers: Record<string, string> | null;
  exercise: { title: string };
}

interface VocabAttemptItem {
  id: string;
  exerciseId: string;
  status: string;
  score: number | null;
  totalItems: number;
  startedAt: string | Date;
  completedAt: string | Date | null;
  updatedAt: string | Date;
  exercise: { title: string };
}

interface ProfileUserData {
  id: string;
  name: string;
  exercises: ExerciseItem[];
  attempts: AttemptItem[];
  vocabAttempts: VocabAttemptItem[];
}

export default function ProfileClient({
  profileUser,
  friendshipStatus,
}: {
  profileUser: ProfileUserData;
  friendshipStatus: string;
}) {
  const { locale } = useI18n();
  const [visibleCount, setVisibleCount] = useState(5);

  const activities = [
    ...profileUser.attempts.map((attempt) => ({
      kind: "attempt" as const,
      id: attempt.id,
      exerciseId: attempt.exerciseId,
      status: attempt.status,
      score: attempt.score,
      total: attempt.totalQuestions,
      answersCount: attempt.answers ? Object.keys(attempt.answers).length : 0,
      activityAt: new Date(attempt.updatedAt),
      title: attempt.exercise.title,
    })),
    ...profileUser.vocabAttempts.map((attempt) => ({
      kind: "vocab" as const,
      id: attempt.id,
      exerciseId: attempt.exerciseId,
      status: attempt.status,
      score: attempt.score,
      total: attempt.totalItems,
      answersCount: 0,
      activityAt: new Date(attempt.updatedAt),
      title: attempt.exercise.title,
    })),
  ].sort((a, b) => b.activityAt.getTime() - a.activityAt.getTime());

  const text =
    locale === "vi"
      ? {
          addFriend: "Thêm bạn (chỉ giao diện - xem ở /friends)",
          requestSent: "Đã gửi lời mời",
          pendingRequest: "Lời mời đang chờ",
          friends: "Bạn bè",
          thisIsYou: "Đây là bạn",
          publishedExercises: "Bài tập đã xuất bản",
          noPublishedExercises: "Chưa có bài tập nào được xuất bản.",
          recentActivity: "Hoạt động gần đây",
          noRecentActivity: "Chưa có hoạt động gần đây.",
          score: "Điểm",
          inProgress: "Đang làm",
          vocab: "Từ vựng",
          vocabProgress: "Tiến độ từ vựng",
          showMore: "Xem thêm",
        }
      : {
          addFriend: "Add Friend (UI Only - View from /friends)",
          requestSent: "Request Sent",
          pendingRequest: "Pending Request",
          friends: "Friends",
          thisIsYou: "This is you",
          publishedExercises: "Published Exercises",
          noPublishedExercises: "No published exercises yet.",
          recentActivity: "Recent Activity",
          noRecentActivity: "No recent activity.",
          score: "Score",
          inProgress: "In Progress",
          vocab: "Vocab",
          vocabInProgress: "Vocab In Progress",
          vocabProgress: "Vocab Progress",
          showMore: "Show More",
        };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="bg-card glass rounded-2xl p-8 mb-8 border border-border flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">{profileUser.name}</h1>
          <p className="text-muted text-sm font-mono">ID: {profileUser.id}</p>
        </div>

        {friendshipStatus === "none" && (
          <button className="btn-primary" disabled>
            {text.addFriend}
          </button>
        )}
        {friendshipStatus === "pending_sent" && (
          <span className="text-amber-500 font-medium bg-amber-500/10 px-4 py-2 rounded-lg">{text.requestSent}</span>
        )}
        {friendshipStatus === "pending_received" && (
          <span className="text-blue-500 font-medium bg-blue-500/10 px-4 py-2 rounded-lg">{text.pendingRequest}</span>
        )}
        {friendshipStatus === "accepted" && (
          <span className="text-green-500 font-medium bg-green-500/10 px-4 py-2 rounded-lg">{text.friends}</span>
        )}
        {friendshipStatus === "self" && (
          <span className="text-muted font-medium bg-foreground/5 px-4 py-2 rounded-lg">{text.thisIsYou}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card glass rounded-xl p-6 border border-border">
          <h2 className="text-xl font-bold mb-6">{text.publishedExercises}</h2>
          {profileUser.exercises.length === 0 ? (
            <p className="text-muted text-sm">{text.noPublishedExercises}</p>
          ) : (
            <ul className="space-y-4">
              {profileUser.exercises.map((ex) => (
                <li key={ex.id}>
                  <Link href={`/exercises/${ex.id}`} className="block p-4 rounded-lg bg-background/50 hover:bg-background/80 transition-colors border border-border">
                    <h3 className="font-semibold text-foreground mb-1">{ex.title}</h3>
                    <p className="text-xs text-muted">{ex.type.toUpperCase()}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-card glass rounded-xl p-6 border border-border">
          <h2 className="text-xl font-bold mb-6">{text.recentActivity}</h2>
          {activities.length === 0 ? (
            <p className="text-muted text-sm">{text.noRecentActivity}</p>
          ) : (
            <ul className="space-y-4">
              {activities.slice(0, visibleCount).map((activity) => {
                const isCompleted = activity.status === "completed";
                const exerciseUrl = `/exercises/${activity.exerciseId}`;
                const resultUrl = isCompleted
                  ? (activity.kind === "attempt" 
                      ? `${exerciseUrl}/attempt/${activity.id}/result` 
                      : `${exerciseUrl}/vocab/${activity.id}/result`)
                  : (activity.kind === "attempt"
                      ? `${exerciseUrl}/attempt?attemptId=${activity.id}`
                      : `${exerciseUrl}/vocab?attemptId=${activity.id}`);

                return (
                  <li key={`${activity.kind}-${activity.id}`} className="p-4 rounded-lg bg-background/50 border border-border">
                    <div className="flex justify-between items-start mb-2">
                      <Link
                        href={exerciseUrl}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {activity.kind === "vocab" ? "📚 " : ""}{activity.title}
                      </Link>
                      <span className="text-xs text-muted">
                        {formatDistanceToNow(activity.activityAt, { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link 
                        href={resultUrl}
                        className={`text-sm font-semibold hover:underline decoration-white/20 transition-all ${isCompleted ? "gradient-text" : "text-amber-500"}`}
                      >
                        {isCompleted
                          ? `${activity.kind === "vocab" ? text.vocab : text.score}: ${activity.score}/${activity.total}`
                          : activity.kind === "vocab"
                          ? text.vocabInProgress
                          : `${text.inProgress} (${activity.answersCount}/${activity.total})`}
                      </Link>
                      {isCompleted && activity.total > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {Math.round(((activity.score || 0) / (activity.total || 1)) * 100)}%
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
              {visibleCount < activities.length && (
                <li className="pt-2">
                  <button
                    onClick={() => setVisibleCount(visibleCount + 5)}
                    className="w-full py-2.5 rounded-lg border border-dashed border-border text-xs text-muted hover:text-foreground hover:border-primary/50 transition-all font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    {text.showMore} ({activities.length - visibleCount})
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
