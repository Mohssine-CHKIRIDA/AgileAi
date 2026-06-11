/**
 * Clerk webhook — syncs users into the database.
 * Configure in Clerk Dashboard: /api/webhooks/clerk
 */
import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ email_address: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    username?: string;
  };
};

type ClerkSessionEvent = {
  type: string;
  data: {
    user_id: string;
  };
};

async function ensureUserInDb(
  userId: string,
  userData?: {
    email?: string;
    name?: string;
    avatar?: string;
  }
) {
  const email = userData?.email ?? `${userId}@users.clerk.dev`;
  const name = userData?.name ?? userId;

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      ...(userData?.name && { name: userData.name }),
      ...(userData?.avatar && { avatar: userData.avatar }),
    },
    create: {
      id: userId,
      email,
      name,
      avatar: userData?.avatar,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const payload = await req.json();
    const event = payload as ClerkUserEvent | ClerkSessionEvent;

    if (event.type === "user.created" || event.type === "user.updated") {
      const userEvent = event as ClerkUserEvent;
      const { id, email_addresses, first_name, last_name, image_url, username } =
        userEvent.data;

      const email = email_addresses?.[0]?.email_address;
      const name =
        [first_name, last_name].filter(Boolean).join(" ") || username || id;

      await ensureUserInDb(id, { email, name, avatar: image_url });
      return NextResponse.json({ message: "User synced" });
    }

    if (event.type === "session.created") {
      const sessionEvent = event as ClerkSessionEvent;
      await ensureUserInDb(sessionEvent.data.user_id);
      return NextResponse.json({ message: "Session user synced" });
    }

    return NextResponse.json({ message: "Event ignored" });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Webhook processing failed", { status: 500 });
  }
}
