"use client";
import { SignInButton, useUser, UserButton } from "@clerk/nextjs";
import { Logo } from "./logo";
import { useFullURL } from "@/hooks/use-full-url";

const TopNavbar: React.FC = () => {
  const { user } = useUser();
  const [url] = useFullURL();

  return (
    <div className="flex h-12 w-full items-center justify-between border-b px-4 bg-slate-950 text-slate-100 shadow-sm">
      <div className="flex items-center gap-x-2.5">
        <Logo size={28} />
        <span className="text-sm font-bold tracking-wide bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 bg-clip-text text-transparent">AgileAI</span>
      </div>
      {user ? (
        <div className="flex items-center gap-x-2">
          <span className="text-sm font-medium text-gray-600">
            {user?.fullName ?? user?.emailAddresses[0]?.emailAddress ?? "Guest"}
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
      ) : (
        <div className="flex items-center gap-x-3">
          <div className="rounded-sm bg-inprogress px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-600 hover:cursor-pointer transition-colors">
            <SignInButton mode="modal" redirectUrl={url} />
          </div>
        </div>
      )}
    </div>
  );
};

export { TopNavbar };
