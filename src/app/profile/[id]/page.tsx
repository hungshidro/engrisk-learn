import { db } from "@/db";
import { users, friendships, exerciseAttempts, exercises, vocabularyAttempts } from "@/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import ProfileClient from "@/components/ProfileClient";

async function getProfileData(id: string, currentUserId?: string) {
  const profileUser = await db.query.users.findFirst({
    where: eq(users.id, id),
    with: {
      exercises: {
        where: eq(exercises.isPublished, true),
        orderBy: [desc(exercises.createdAt)],
      },
      attempts: {
        orderBy: [desc(exerciseAttempts.updatedAt)],
        with: {
          exercise: true,
        },
        limit: 20,
      },
      vocabAttempts: {
        orderBy: [desc(vocabularyAttempts.updatedAt)],
        with: {
          exercise: true,
        },
        limit: 20,
      },
    },
  });

  if (!profileUser) return null;

  let friendshipStatus = "none";

  if (currentUserId && currentUserId !== id) {
    const friendship = await db.query.friendships.findFirst({
      where: or(
        and(eq(friendships.requesterId, currentUserId), eq(friendships.receiverId, id)),
        and(eq(friendships.requesterId, id), eq(friendships.receiverId, currentUserId))
      ),
    });

    if (friendship) {
      if (friendship.status === "accepted") {
        friendshipStatus = "accepted";
      } else if (friendship.status === "pending") {
        friendshipStatus = friendship.requesterId === currentUserId ? "pending_sent" : "pending_received";
      }
    }
  } else if (currentUserId === id) {
    friendshipStatus = "self";
  }

  return { profileUser, friendshipStatus };
}

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const { id } = await params;

  const data = await getProfileData(id, session?.user?.id);

  if (!data) {
    return notFound();
  }

  const { profileUser, friendshipStatus } = data;

  return <ProfileClient profileUser={profileUser} friendshipStatus={friendshipStatus} />;
}
