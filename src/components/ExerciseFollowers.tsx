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
  totalQuestions,
}: {
  exerciseId: string;
  totalQuestions: number;
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
  const [expandedSection, setExpandedSection] = useState<"me" | "followers" | "following" | null>("me");

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

  const addAsFollower = async (friendId: string) => {
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/followers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: friendId, type: "add_follower" }),
      });
      if (res.ok) {
        fetchFollowerData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const followFriend = async (friendId: string) => {
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/followers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: friendId, type: "follow" }),
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">
          {locale === "vi" ? "Cùng học với bạn bè" : "Learn with Friends"}
        </h3>
        <button
          onClick={() => setShowModal(true)}
          className="btn-secondary !py-1 !px-2 text-xs"
        >
          {locale === "vi" ? "Thêm" : "Add"}
        </button>
      </div>

      <div className="space-y-3">
        {/* Accordion 1: Me */}
        <div className="border border-border rounded-xl bg-surface/30 overflow-hidden transition-all">
          <button
            onClick={() => setExpandedSection(expandedSection === "me" ? null : "me")}
            className="w-full flex items-center justify-between p-4 bg-surface/50 hover:bg-surface/80 transition-colors"
          >
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              ⭐ {locale === "vi" ? "Tiến độ của bạn" : "Your progress"}
              {me && me.attempts && me.attempts.length > 0 && (
                <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {me.attempts[0].score}/{totalQuestions}
                </span>
              )}
            </h3>
            <svg
              className={`w-5 h-5 text-muted transition-transform ${expandedSection === "me" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {expandedSection === "me" && (
            <div className="p-4 border-t border-border animate-slide-in">
              {!me ? (
                <p className="text-sm text-muted italic">
                  {locale === "vi" ? "Chưa có tiến độ" : "No progress yet"}
                </p>
              ) : (
                <ul className="space-y-3">
                  <li className="p-3 rounded-lg bg-surface flex items-center justify-between">
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
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Accordion 2: Followers */}
        <div className="border border-border rounded-xl bg-surface/30 overflow-hidden transition-all">
          <button
            onClick={() => setExpandedSection(expandedSection === "followers" ? null : "followers")}
            className="w-full flex items-center justify-between p-4 bg-surface/50 hover:bg-surface/80 transition-colors"
          >
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              👥 {locale === "vi" ? "Đang theo dõi bạn" : "Tracking your progress"}
              <span className="text-xs font-normal bg-surface px-2 py-0.5 rounded-full border border-border">
                {followers.length}
              </span>
            </h3>
            <svg
              className={`w-5 h-5 text-muted transition-transform ${expandedSection === "followers" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSection === "followers" && (
            <div className="p-4 border-t border-border animate-slide-in">
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
                        className="p-3 rounded-lg bg-surface flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
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
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Accordion 3: Following */}
        <div className="border border-border rounded-xl bg-surface/30 overflow-hidden transition-all">
          <button
            onClick={() => setExpandedSection(expandedSection === "following" ? null : "following")}
            className="w-full flex items-center justify-between p-4 bg-surface/50 hover:bg-surface/80 transition-colors"
          >
            <h3 className="font-semibold flex items-center gap-2 text-sm">
              🎯 {locale === "vi" ? "Bạn đang theo dõi" : "You are tracking"}
              <span className="text-xs font-normal bg-surface px-2 py-0.5 rounded-full border border-border">
                {following.length}
              </span>
            </h3>
            <svg
              className={`w-5 h-5 text-muted transition-transform ${expandedSection === "following" ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSection === "following" && (
            <div className="p-4 border-t border-border animate-slide-in">
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
                        className="p-3 rounded-lg bg-surface flex items-center justify-between"
                      >
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
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl p-6 animate-scale-in">
            <h3 className="text-xl font-bold mb-2">
              {locale === "vi" ? "Chọn bạn bè" : "Select Friends"}
            </h3>
            <p className="text-xs text-muted mb-4">
              {locale === "vi"
                ? "Thêm bạn bè theo dõi tiến độ của bạn hoặc theo dõi tiến độ bạn bè."
                : "Add friends to track your progress or follow theirs."}
            </p>

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

            <div className="max-h-72 overflow-y-auto space-y-3 mb-6 pr-1 custom-scrollbar">
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
                    const isAlreadyFollower = followers.some(
                      (fol) => fol.id === f.id,
                    );
                    const isAlreadyFollowing = following.some(
                      (fol) => fol.id === f.id,
                    );
                    return (
                      <div
                        key={f.id}
                        className="p-4 rounded-xl border border-border/50 bg-background/50 space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {f.name[0]}
                          </div>
                          <span className="font-medium text-sm">{f.name}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => addAsFollower(f.id)}
                            disabled={isAlreadyFollower}
                            className={`flex-1 text-xs px-3 py-2 rounded-lg font-medium transition-colors text-center ${
                              isAlreadyFollower
                                ? "bg-background text-muted cursor-not-allowed border border-border/50"
                                : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/20"
                            }`}
                          >
                            {isAlreadyFollower
                              ? `✓ ${locale === "vi" ? "Đã theo dõi bạn" : "Follower"}`
                              : `👥 ${locale === "vi" ? "Thêm người theo dõi" : "Add follower"}`}
                          </button>
                          <button
                            onClick={() => followFriend(f.id)}
                            disabled={isAlreadyFollowing}
                            className={`flex-1 text-xs px-3 py-2 rounded-lg font-medium transition-colors text-center ${
                              isAlreadyFollowing
                                ? "bg-background text-muted cursor-not-allowed border border-border/50"
                                : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                            }`}
                          >
                            {isAlreadyFollowing
                              ? `✓ ${locale === "vi" ? "Đang theo dõi" : "Following"}`
                              : `🎯 ${locale === "vi" ? "Theo dõi" : "Follow"}`}
                          </button>
                        </div>
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
