import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { exerciseFollowers, exerciseAttempts, vocabularyAttempts, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: exerciseId } = await params;
    const currentUserId = session.user.id;

    // Get people who are following ME on this exercise, AND people who I AM following on this exercise
    const followersData = await db.query.exerciseFollowers.findMany({
      where: and(
        eq(exerciseFollowers.exerciseId, exerciseId),
        eq(exerciseFollowers.followedUserId, currentUserId)
      ),
      with: {
        user: {
          columns: {
            id: true,
            name: true,
          },
          with: {
            attempts: {
              where: eq(exerciseAttempts.exerciseId, exerciseId),
              limit: 1,
              orderBy: [desc(exerciseAttempts.startedAt)],
            },
            vocabAttempts: {
              where: eq(vocabularyAttempts.exerciseId, exerciseId),
              limit: 1,
              orderBy: [desc(vocabularyAttempts.startedAt)],
            }
          }
        },
      },
    });

    const followingData = await db.query.exerciseFollowers.findMany({
      where: and(
        eq(exerciseFollowers.exerciseId, exerciseId),
        eq(exerciseFollowers.userId, currentUserId)
      ),
      with: {
        followedUser: {
          columns: {
            id: true,
            name: true,
          },
          with: {
            attempts: {
              where: eq(exerciseAttempts.exerciseId, exerciseId),
              limit: 1,
              orderBy: [desc(exerciseAttempts.startedAt)],
            },
            vocabAttempts: {
              where: eq(vocabularyAttempts.exerciseId, exerciseId),
              limit: 1,
              orderBy: [desc(vocabularyAttempts.startedAt)],
            }
          }
        },
      },
    });

    const meData = await db.query.users.findFirst({
      where: eq(users.id, currentUserId),
      columns: {
        id: true,
        name: true,
      },
      with: {
        attempts: {
          where: eq(exerciseAttempts.exerciseId, exerciseId),
          limit: 1,
          orderBy: [desc(exerciseAttempts.startedAt)],
        },
        vocabAttempts: {
          where: eq(vocabularyAttempts.exerciseId, exerciseId),
          limit: 1,
          orderBy: [desc(vocabularyAttempts.startedAt)],
        }
      }
    });

    return NextResponse.json({
      me: meData,
      followers: followersData.map((f) => f.user), // People tracking my progress
      following: followingData.map((f) => f.followedUser), // People whose progress I am tracking
    });
  } catch (error) {
    console.error("[EXERCISE_FOLLOWERS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, type } = body; // type: "add_follower" | "follow"

    if (!userId) {
      return new NextResponse("User ID is required", { status: 400 });
    }

    const currentUserId = session.user.id;
    const { id: exerciseId } = await params;

    if (type === "add_follower") {
      // Friend (userId) follows ME => they track my progress
      const existing = await db.query.exerciseFollowers.findFirst({
        where: and(
          eq(exerciseFollowers.exerciseId, exerciseId),
          eq(exerciseFollowers.userId, userId),
          eq(exerciseFollowers.followedUserId, currentUserId)
        ),
      });
      if (existing) {
        return new NextResponse("Already a follower", { status: 400 });
      }
      await db.insert(exerciseFollowers).values({
        exerciseId,
        userId, // friend
        followedUserId: currentUserId, // me
      });
    } else if (type === "follow") {
      // I follow friend (userId) => I track their progress
      const existing = await db.query.exerciseFollowers.findFirst({
        where: and(
          eq(exerciseFollowers.exerciseId, exerciseId),
          eq(exerciseFollowers.userId, currentUserId),
          eq(exerciseFollowers.followedUserId, userId)
        ),
      });
      if (existing) {
        return new NextResponse("Already following", { status: 400 });
      }
      await db.insert(exerciseFollowers).values({
        exerciseId,
        userId: currentUserId, // me
        followedUserId: userId, // friend
      });
    } else {
      return new NextResponse("Invalid type. Use 'add_follower' or 'follow'.", { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[EXERCISE_FOLLOWERS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId"); // The friend we are removing

    if (!userId) {
      return new NextResponse("User ID is required", { status: 400 });
    }

    const currentUserId = session.user.id;
    const { id: exerciseId } = await params;

    await db
      .delete(exerciseFollowers)
      .where(
        and(
          eq(exerciseFollowers.exerciseId, exerciseId),
          eq(exerciseFollowers.userId, userId),
          eq(exerciseFollowers.followedUserId, currentUserId)
        )
      );

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[EXERCISE_FOLLOWERS_DELETE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
