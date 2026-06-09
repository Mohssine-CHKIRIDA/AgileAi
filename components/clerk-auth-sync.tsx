"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";

/** Keeps sessionStorage in sync with Clerk for API header fallback. */
export function ClerkAuthSync() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;
    if (user?.id) {
      sessionStorage.setItem("devUserId", user.id);
    } else {
      sessionStorage.removeItem("devUserId");
    }
  }, [user?.id, isLoaded]);

  return null;
}
