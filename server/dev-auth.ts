/**
 * Request authentication — Clerk session first, X-Dev-User-Id header for API testing.
 */
import { auth, currentUser } from "@clerk/nextjs";
import { type NextRequest } from "next/server";
import { prisma } from "./db";

export const DEV_USER_HEADER = "x-dev-user-id";

export async function getRequestAuth(
  req: NextRequest
): Promise<{ userId: string | null }> {
  const { userId } = auth();
  if (userId) return { userId };

  const headerUserId = req.headers.get(DEV_USER_HEADER);
  if (headerUserId) return { userId: headerUserId };

  return { userId: null };
}

/** @deprecated Use getRequestAuth — kept for gradual migration */
export const getDevAuth = getRequestAuth;

export async function ensureUserSynced(userId: string): Promise<void> {
  const clerkUser = await currentUser();

  if (clerkUser?.id === userId) {
    const email =
      clerkUser.emailAddresses[0]?.emailAddress ?? `${userId}@users.clerk.dev`;
    const name =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
      clerkUser.username ||
      userId;

    await prisma.user.upsert({
      where: { id: userId },
      update: { name, email, avatar: clerkUser.imageUrl },
      create: {
        id: userId,
        email,
        name,
        avatar: clerkUser.imageUrl,
      },
    });
    return;
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      name: userId,
      email: `${userId}@localhost.dev`,
    },
  });
}

export const devRatelimit = {
  limit: async (_identifier: string) => ({ success: true }),
};
