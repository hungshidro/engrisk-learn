import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { users, friendships } from "@/db/schema";
import { or, ilike, eq, and, ne } from "drizzle-orm";
import { validate as isUUID } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ users: [] });
    }

    const currentUserId = session.user.id;
    const isQueryUUID = isUUID(query);

    // Search for users
    const matchedUsers = await db.query.users.findMany({
      where: and(
        ne(users.id, currentUserId), // Exclude self
        isQueryUUID
          ? eq(users.id, query)
          : ilike(users.name, `%${query}%`)
      ),
      columns: {
        id: true,
        name: true,
      },
      limit: 10,
    });

    if (matchedUsers.length === 0) {
      return NextResponse.json({ users: [] });
    }

    const matchedUserIds = matchedUsers.map((u) => u.id);

    // Get friendship status for these users relative to the current user
    const existingFriendships = await db.query.friendships.findMany({
      where: or(
        and(
          eq(friendships.requesterId, currentUserId),
          or(...matchedUserIds.map((id) => eq(friendships.receiverId, id)))
        ),
        and(
          eq(friendships.receiverId, currentUserId),
          or(...matchedUserIds.map((id) => eq(friendships.requesterId, id)))
        )
      ),
    });

    const usersWithStatus = matchedUsers.map((user) => {
      const friendship = existingFriendships.find(
        (f) => f.requesterId === user.id || f.receiverId === user.id
      );

      let status = "none";
      if (friendship) {
        if (friendship.status === "accepted") {
          status = "accepted";
        } else if (friendship.status === "pending") {
          status =
            friendship.requesterId === currentUserId
              ? "pending_sent"
              : "pending_received";
        }
      }

      return {
        ...user,
        status, // none, pending_sent, pending_received, accepted
      };
    });

    return NextResponse.json({ users: usersWithStatus });
  } catch (error) {
    console.error("[USERS_SEARCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
