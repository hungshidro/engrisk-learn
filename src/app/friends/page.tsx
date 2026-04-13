"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useI18n } from "@/i18n";

export default function FriendsPage() {
  const { data: session } = useSession();
  const { locale } = useI18n();
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">("friends");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; status: string }[]>([]);
  const [friendships, setFriendships] = useState<{
    id: string;
    requesterId: string;
    receiverId: string;
    status: string;
    requester: { id: string; name: string };
    receiver: { id: string; name: string };
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchFriendships();
    }
  }, [session?.user?.id]);

  const fetchFriendships = async () => {
    try {
      const res = await fetch("/api/friends");
      const data = await res.json();
      if (res.ok) {
        setFriendships(data.friendships);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.users);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId }),
      });
      if (res.ok) {
        // Update local state to reflect pending
        setSearchResults((prev) =>
          prev.map((u) => (u.id === receiverId ? { ...u, status: "pending_sent" } : u))
        );
        fetchFriendships();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const respondToRequest = async (friendshipId: string, action: "accept" | "reject") => {
    try {
      const res = await fetch(`/api/friends`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendshipId, action }),
      });
      if (res.ok) {
        fetchFriendships();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!session?.user) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
        Please log in to view friends.
      </div>
    );
  }

  const currentUserId = session.user.id;

  const friendsList = friendships.filter((f) => f.status === "accepted");
  const pendingReceived = friendships.filter(
    (f) => f.status === "pending" && f.receiverId === currentUserId
  );
  const pendingSent = friendships.filter(
    (f) => f.status === "pending" && f.requesterId === currentUserId
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <h1 className="text-3xl font-bold gradient-text mb-8">
        {locale === "vi" ? "Bạn bè" : "Friends"}
      </h1>

      <div className="flex space-x-4 border-b border-border mb-6">
        {["friends", "requests", "search"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as "friends" | "requests" | "search")}
            className={`pb-2 px-2 capitalize font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {locale === "vi"
              ? tab === "friends"
                ? "Danh sách"
                : tab === "requests"
                ? `Yêu cầu (${pendingReceived.length})`
                : "Tìm kiếm"
              : tab === "requests"
              ? `Requests (${pendingReceived.length})`
              : tab}
          </button>
        ))}
      </div>

      <div className="bg-card glass rounded-xl p-6">
        {activeTab === "friends" && (
          <div>
            {friendsList.length === 0 ? (
              <p className="text-muted text-center py-8">
                {locale === "vi" ? "Chưa có bạn bè nào." : "No friends yet."}
              </p>
            ) : (
              <div className="space-y-4">
                {friendsList.map((f) => {
                  const friend = f.requesterId === currentUserId ? f.receiver : f.requester;
                  return (
                    <div key={f.id} className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border">
                      <Link href={`/profile/${friend.id}`} className="font-semibold hover:text-primary transition-colors">
                        {friend.name}
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "requests" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold mb-4">
                {locale === "vi" ? "Yêu cầu đến" : "Incoming Requests"}
              </h2>
              {pendingReceived.length === 0 ? (
                <p className="text-muted text-sm">{locale === "vi" ? "Không có yêu cầu nào." : "No incoming requests."}</p>
              ) : (
                <div className="space-y-3">
                  {pendingReceived.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border">
                      <span className="font-medium">{req.requester.name}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => respondToRequest(req.id, "accept")}
                          className="px-3 py-1.5 text-sm bg-primary/20 text-primary hover:bg-primary/30 rounded-md transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => respondToRequest(req.id, "reject")}
                          className="px-3 py-1.5 text-sm bg-destructive/20 text-destructive hover:bg-destructive/30 rounded-md transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4 text-muted">
                {locale === "vi" ? "Yêu cầu đã gửi" : "Sent Requests"}
              </h2>
              {pendingSent.length === 0 ? (
                <p className="text-muted text-sm">{locale === "vi" ? "Không có yêu cầu nào." : "No sent requests."}</p>
              ) : (
                <div className="space-y-3">
                  {pendingSent.map((req) => (
                    <div key={req.id} className="flex items-center justify-between p-4 rounded-lg bg-background/30 border border-border opacity-75">
                      <span className="font-medium">{req.receiver.name}</span>
                      <span className="text-sm text-amber-500">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "search" && (
          <div>
            <form onSubmit={handleSearch} className="flex gap-3 mb-6">
              <input
                type="text"
                placeholder={locale === "vi" ? "Tìm theo tên hoặc UUID..." : "Search by name or UUID..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading ? "..." : (locale === "vi" ? "Tìm" : "Search")}
              </button>
            </form>

            <div className="space-y-4">
              {searchResults.length === 0 && searchQuery && !isLoading && (
                <p className="text-muted text-center py-4">No resuls found.</p>
              )}
              {searchResults.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <Link href={`/profile/${user.id}`} className="font-semibold hover:text-primary transition-colors block">
                      {user.name}
                    </Link>
                    <span className="text-xs text-muted font-mono">{user.id.substring(0, 8)}...</span>
                  </div>
                  <div>
                    {user.status === "none" && (
                      <button
                        onClick={() => sendFriendRequest(user.id)}
                        className="px-4 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                      >
                        Add Friend
                      </button>
                    )}
                    {user.status === "pending_sent" && (
                      <span className="text-sm text-amber-500 px-2">Request Sent</span>
                    )}
                    {user.status === "pending_received" && (
                      <span className="text-sm text-blue-500 px-2">Has sent you a request</span>
                    )}
                    {user.status === "accepted" && (
                      <span className="text-sm text-green-500 px-2">Friends</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
