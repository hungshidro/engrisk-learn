"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface FriendProgress {
  id: string;
  name: string;
  attempts?: { id: string; status: string; score: number; totalQuestions: number }[];
  vocabAttempts?: { id: string; status: string; score: number; totalItems: number }[];
}

export default function ExerciseFollowers({
  exerciseId,
}: {
  exerciseId: string;
}) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const { locale } = useI18n();
  const [followers, setFollowers] = useState<FriendProgress[]>([]);
  const [following, setFollowing] = useState<FriendProgress[]>([]);
  const [me, setMe] = useState<FriendProgress | null>(null);
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchFriendTerm, setSearchFriendTerm] = useState("");

  const fetchFollowerData = async () => {
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/followers`);
      if (res.ok) {
        const data = await res.json();
        setFollowers(data.followers);
        setFollowing(data.following);
        setMe(data.me);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch("/api/friends");
      if (res.ok) {
        const data = await res.json();
        const accepted = data.friendships
          .filter((f: { status: string }) => f.status === "accepted")
          .map(
            (f: {
              requesterId: string;
              receiver: { id: string };
              requester: { id: string };
            }) => (f.requesterId === currentUserId ? f.receiver : f.requester),
          );
        setFriends(accepted);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchFollowerData();
    fetchFriends();
  }, [exerciseId]);

  const addFollower = async (friendId: string) => {
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/followers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: friendId }),
      });
      if (res.ok) {
        fetchFollowerData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (isLoading) return null;

  return (
    <div
      className="mt-8 glass p-6 animate-fade-in-up"
      style={{ animationDelay: "0.2s" }}
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">
          {locale === "vi" ? "Cùng học với bạn bè" : "Learn with Friends"}
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="btn-secondary !py-1.5 text-sm"
        >
          {locale === "vi" ? "Chia sẻ / Thêm" : "Share / Add"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wider">
            {locale === "vi" ? "Tiến độ của bạn" : "Your progress"}
          </h3>
          {!me ? (
            <p className="text-sm text-muted italic">
              {locale === "vi" ? "Chưa có tiến độ" : "No progress yet"}
            </p>
          ) : (
            <ul className="space-y-3">
              <li className="p-3 rounded-lg bg-surface/50 border border-border hover:bg-surface/80 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                      {me.name[0]}
                    </div>
                    <span className="text-sm font-medium">{me.name} (Bạn)</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {me.attempts && me.attempts.length > 0 ? (
                      <Link
                        href={`/exercises/${exerciseId}/attempt/${me.attempts[0].id}/result`}
                        className={`text-xs px-2 py-0.5 rounded-full ${me.attempts[0].status === "completed" ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-500"}`}
                      >
                        {locale === "vi" ? "Bài tập" : "Exercise"}: {me.attempts[0].status === "completed"
                          ? `${me.attempts[0].score}/${me.attempts[0].totalQuestions}`
                          : locale === "vi" ? "Đang làm" : "In Progress"}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">
                        {locale === "vi" ? "Chưa làm bài" : "No exercise"}
                      </span>
                    )}
                    {me.vocabAttempts && me.vocabAttempts.length > 0 ? (
                      <Link
                        href={`/exercises/${exerciseId}/vocab/${me.vocabAttempts[0].id}/result`}
                        className={`text-xs px-2 py-0.5 rounded-full ${me.vocabAttempts[0].status === "completed" ? "bg-secondary/20 text-secondary" : "bg-amber-500/20 text-amber-500"}`}
                      >
                        {locale === "vi" ? "Từ vựng" : "Vocab"}: {me.vocabAttempts[0].status === "completed"
                          ? `${me.vocabAttempts[0].score}/${me.vocabAttempts[0].totalItems}`
                          : locale === "vi" ? "Đang làm" : "In Progress"}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wider">
            {locale === "vi" ? "Đang theo dõi bạn" : "Tracking your progress"}
          </h3>
          {followers.length === 0 ? (
            <p className="text-sm text-muted italic">
              {locale === "vi" ? "Chưa có ai" : "No one yet"}
            </p>
          ) : (
            <ul className="space-y-3">
              {followers.map((u) => {
                const latestAttempt =
                  u.attempts && u.attempts.length > 0 ? u.attempts[0] : null;
                const latestVocab =
                  u.vocabAttempts && u.vocabAttempts.length > 0 ? u.vocabAttempts[0] : null;
                return (
                  <li
                    key={u.id}
                    className="p-3 rounded-lg bg-surface/50 border border-border hover:bg-surface/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {u.name[0]}
                        </div>
                        <span className="text-sm font-medium">{u.name}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {/* Exercise attempt */}
                        {latestAttempt ? (
                          <Link
                            href={`/exercises/${exerciseId}/attempt/${latestAttempt.id}/result`}
                            className={`text-xs px-2 py-0.5 rounded-full ${latestAttempt.status === "completed" ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-500"}`}
                          >
                            {locale === "vi" ? "Bài tập" : "Exercise"}: {latestAttempt.status === "completed"
                              ? `${latestAttempt.score}/${latestAttempt.totalQuestions}`
                              : locale === "vi" ? "Đang làm" : "In Progress"}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">
                            {locale === "vi" ? "Chưa làm bài" : "No exercise"}
                          </span>
                        )}
                        {/* Vocab attempt */}
                        {latestVocab ? (
                          <Link
                            href={`/exercises/${exerciseId}/vocab/${latestVocab.id}/result`}
                            className={`text-xs px-2 py-0.5 rounded-full ${latestVocab.status === "completed" ? "bg-secondary/20 text-secondary" : "bg-amber-500/20 text-amber-500"}`}
                          >
                            {locale === "vi" ? "Từ vựng" : "Vocab"}: {latestVocab.status === "completed"
                              ? `${latestVocab.score}/${latestVocab.totalItems}`
                              : locale === "vi" ? "Đang làm" : "In Progress"}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wider">
            {locale === "vi" ? "Bạn đang theo dõi" : "You are tracking"}
          </h3>
          {following.length === 0 ? (
            <p className="text-sm text-muted italic">
              {locale === "vi" ? "Chưa theo dõi ai" : "Not tracking anyone"}
            </p>
          ) : (
            <ul className="space-y-3">
              {following.map((u) => {
                const latestAttempt =
                  u.attempts && u.attempts.length > 0 ? u.attempts[0] : null;
                const latestVocab =
                  u.vocabAttempts && u.vocabAttempts.length > 0 ? u.vocabAttempts[0] : null;
                return (
                  <li
                    key={u.id}
                    className="p-3 rounded-lg bg-surface/50 border border-border hover:bg-surface/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold text-sm">
                          {u.name[0]}
                        </div>
                        <span className="text-sm font-medium">{u.name}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {latestAttempt ? (
                          <Link
                            href={`/exercises/${exerciseId}/attempt/${latestAttempt.id}/result`}
                            className={`text-xs px-2 py-0.5 rounded-full ${latestAttempt.status === "completed" ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-500"}`}
                          >
                            {locale === "vi" ? "Bài tập" : "Exercise"}: {latestAttempt.status === "completed"
                              ? `${latestAttempt.score}/${latestAttempt.totalQuestions}`
                              : locale === "vi" ? "Đang làm" : "In Progress"}
                          </Link>
                        ) : (
                          <span className="text-xs text-muted">
                            {locale === "vi" ? "Chưa làm bài" : "No exercise"}
                          </span>
                        )}
                        {latestVocab ? (
                          <Link
                            href={`/exercises/${exerciseId}/vocab/${latestVocab.id}/result`}
                            className={`text-xs px-2 py-0.5 rounded-full ${latestVocab.status === "completed" ? "bg-secondary/20 text-secondary" : "bg-amber-500/20 text-amber-500"}`}
                          >
                            {locale === "vi" ? "Từ vựng" : "Vocab"}: {latestVocab.status === "completed"
                              ? `${latestVocab.score}/${latestVocab.totalItems}`
                              : locale === "vi" ? "Đang làm" : "In Progress"}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl p-6 animate-scale-in">
            <h3 className="text-xl font-bold mb-4">
              {locale === "vi" ? "Chọn bạn bè" : "Select Friends"}
            </h3>

            <div className="mb-4">
              <input
                type="text"
                placeholder={
                  locale === "vi" ? "Tìm kiếm bạn bè..." : "Search friends..."
                }
                value={searchFriendTerm}
                onChange={(e) => setSearchFriendTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
              {friends.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">
                  {locale === "vi" ? "Chưa có bạn bè nào." : "No friends yet."}
                </p>
              ) : (
                friends
                  .filter((f) =>
                    f.name
                      .toLowerCase()
                      .includes(searchFriendTerm.toLowerCase()),
                  )
                  .map((f) => {
                    const isFollowing = followers.some(
                      (fol) => fol.id === f.id,
                    );
                    return (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-background/50"
                      >
                        <span className="font-medium text-sm">{f.name}</span>
                        <button
                          onClick={() => addFollower(f.id)}
                          disabled={isFollowing}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            isFollowing
                              ? "bg-background text-muted cursor-not-allowed"
                              : "bg-primary/10 text-primary hover:bg-primary/20"
                          }`}
                        >
                          {isFollowing
                            ? locale === "vi"
                              ? "Đã thêm"
                              : "Added"
                            : locale === "vi"
                              ? "Thêm"
                              : "Add"}
                        </button>
                      </div>
                    );
                  })
              )}
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="w-full btn-secondary py-2"
            >
              {locale === "vi" ? "Đóng" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
