/**
 * dev-auth.ts  —  LOCAL DEVELOPMENT ONLY
 *
 * Drop-in replacement for Clerk's getAuth() and ratelimit.
 * Pass the header  X-Dev-User-Id: <any-string>  in Postman.
 * Remove this file (and swap imports back) before deploying.
 */
import { type NextRequest } from "next/server";

export const DEV_USER_HEADER = "x-dev-user-id";

/**
 * Reads the X-Dev-User-Id header.
 * Returns { userId: string } to match Clerk's getAuth() shape.
 */
export function getDevAuth(req: NextRequest): { userId: string | null } {
  const userId = req.headers.get(DEV_USER_HEADER) ?? null;
  return { userId };
}

/**
 * No-op ratelimit — always allows the request through.
 * Same call signature as Upstash ratelimit so imports stay identical.
 */
export const devRatelimit = {
  limit: async (_identifier: string) => ({ success: true }),
};
