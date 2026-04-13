import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { friendships } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUserId = session.user.id;

    const allFriendships = await db.query.friendships.findMany({
      where: or(
        eq(friendships.requesterId, currentUserId),
        eq(friendships.receiverId, currentUserId)
      ),
      with: {
        requester: {
          columns: {
            id: true,
            name: true,
          },
        },
        receiver: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ friendships: allFriendships });
  } catch (error) {
    console.error("[FRIENDS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { receiverId } = body;

    if (!receiverId) {
      return new NextResponse("Receiver ID is required", { status: 400 });
    }

    const currentUserId = session.user.id;

    if (currentUserId === receiverId) {
      return new NextResponse("Cannot send friend request to yourself", { status: 400 });
    }

    // Check if friendship already exists
    const existing = await db.query.friendships.findFirst({
      where: or(
        and(eq(friendships.requesterId, currentUserId), eq(friendships.receiverId, receiverId)),
        and(eq(friendships.requesterId, receiverId), eq(friendships.receiverId, currentUserId))
      ),
    });

    if (existing) {
      return new NextResponse("Friendship already exists", { status: 400 });
    }

    const [newFriendship] = await db.insert(friendships).values({
      requesterId: currentUserId,
      receiverId,
      status: "pending",
    }).returning();

    return NextResponse.json(newFriendship);
  } catch (error) {
    console.error("[FRIENDS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { friendshipId, action } = body; // action: "accept" or "reject"

    if (!friendshipId || !action || !["accept", "reject"].includes(action)) {
      return new NextResponse("Invalid body", { status: 400 });
    }

    const currentUserId = session.user.id;

    const friendship = await db.query.friendships.findFirst({
      where: eq(friendships.id, friendshipId),
    });

    if (!friendship) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Only receiver can accept/reject
    if (friendship.receiverId !== currentUserId) {
      return new NextResponse("Unauthorized to update this request", { status: 401 });
    }

    if (friendship.status !== "pending") {
      return new NextResponse("Request already processed", { status: 400 });
    }

    const newStatus = action === "accept" ? "accepted" : "rejected";

    const [updatedFriendship] = await db
      .update(friendships)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(friendships.id, friendshipId))
      .returning();

    return NextResponse.json(updatedFriendship);
  } catch (error) {
    console.error("[FRIENDS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
