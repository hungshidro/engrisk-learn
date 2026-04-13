import { db } from "@/db";
import { users, friendships, exerciseAttempts, exercises } from "@/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

async function getProfileData(id: string, currentUserId?: string) {
  const profileUser = await db.query.users.findFirst({
    where: eq(users.id, id),
    with: {
      exercises: {
        where: eq(exercises.isPublished, true),
        orderBy: [desc(exercises.createdAt)],
      },
      attempts: {
        orderBy: [desc(exerciseAttempts.startedAt)],
        with: {
          exercise: true,
        },
        limit: 10,
      },
    },
  });

  if (!profileUser) return null;

  let friendshipStatus = "none";
  let friendshipId = null;

  if (currentUserId && currentUserId !== id) {
    const friendship = await db.query.friendships.findFirst({
      where: or(
        and(eq(friendships.requesterId, currentUserId), eq(friendships.receiverId, id)),
        and(eq(friendships.requesterId, id), eq(friendships.receiverId, currentUserId))
      ),
    });

    if (friendship) {
      friendshipId = friendship.id;
      if (friendship.status === "accepted") {
        friendshipStatus = "accepted";
      } else if (friendship.status === "pending") {
        friendshipStatus = friendship.requesterId === currentUserId ? "pending_sent" : "pending_received";
      }
    }
  } else if (currentUserId === id) {
    friendshipStatus = "self";
  }

  return { profileUser, friendshipStatus, friendshipId };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const data = await getProfileData(id, session?.user?.id);

  if (!data) {
    return notFound();
  }

  const { profileUser, friendshipStatus, friendshipId } = data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <div className="bg-card glass rounded-2xl p-8 mb-8 border border-border flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">{profileUser.name}</h1>
          <p className="text-muted text-sm font-mono">ID: {profileUser.id}</p>
        </div>
        
        {friendshipStatus === "none" && (
          <form action={async () => {
            "use server";
            // In a real app this would call an action or API
          }}>
            <button className="btn-primary" disabled>
              Add Friend (UI Only - View from /friends)
            </button>
          </form>
        )}
        {friendshipStatus === "pending_sent" && (
          <span className="text-amber-500 font-medium bg-amber-500/10 px-4 py-2 rounded-lg">Request Sent</span>
        )}
        {friendshipStatus === "pending_received" && (
          <span className="text-blue-500 font-medium bg-blue-500/10 px-4 py-2 rounded-lg">Pending Request</span>
        )}
        {friendshipStatus === "accepted" && (
          <span className="text-green-500 font-medium bg-green-500/10 px-4 py-2 rounded-lg">Friends</span>
        )}
        {friendshipStatus === "self" && (
          <span className="text-muted font-medium bg-foreground/5 px-4 py-2 rounded-lg">This is you</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-card glass rounded-xl p-6 border border-border">
          <h2 className="text-xl font-bold mb-6">Published Exercises</h2>
          {profileUser.exercises.length === 0 ? (
            <p className="text-muted text-sm">No published exercises yet.</p>
          ) : (
            <ul className="space-y-4">
              {profileUser.exercises.map(ex => (
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
          <h2 className="text-xl font-bold mb-6">Recent Activity</h2>
          {profileUser.attempts.length === 0 ? (
            <p className="text-muted text-sm">No recent activity.</p>
          ) : (
            <ul className="space-y-4">
              {profileUser.attempts.map(attempt => (
                <li key={attempt.id} className="p-4 rounded-lg bg-background/50 border border-border">
                  <div className="flex justify-between items-start mb-2">
                    <Link href={`/exercises/${attempt.exerciseId}${attempt.status === 'completed' ? `/attempt/${attempt.id}/result` : ''}`} className="font-medium hover:text-primary transition-colors">
                      {attempt.exercise.title}
                    </Link>
                    <span className="text-xs text-muted">
                      {formatDistanceToNow(attempt.completedAt || attempt.startedAt, { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${attempt.status === 'completed' ? 'gradient-text' : 'text-amber-500'}`}>
                      {attempt.status === 'completed' 
                        ? `Score: ${attempt.score}/${attempt.totalQuestions}` 
                        : `In Progress (${attempt.answers ? Object.keys(attempt.answers).length : 0}/${attempt.totalQuestions})`}
                    </span>
                    {attempt.status === 'completed' && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {Math.round(((attempt.score || 0) / (attempt.totalQuestions || 1)) * 100)}%
                    </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
