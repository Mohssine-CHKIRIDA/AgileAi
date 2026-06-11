import { ClerkProvider } from "@clerk/nextjs/app-beta";
import { type Metadata } from "next";
import { siteConfig } from "@/config/site";
import "@/styles/globals.css";
import Toaster from "@/components/toast";
import QueryProvider from "@/utils/provider";
import { AuthModalProvider } from "@/context/use-auth-modal";
import { AuthModal } from "@/components/modals/auth";
import { ClerkAuthSync } from "@/components/clerk-auth-sync";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "Jira",
    "Next.js",
    "React",
    "Tailwind CSS",
    "Server Components",
    "Radix UI",
    "Clerk",
    "TanStack",
  ],
  authors: [
    {
      name: "Sebastian Fernandez",
      url: "https://sebastianfdz.com",
    },
  ],
  creator: "Sebastian Fernandez",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
};

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en">
      <head />
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorBackground: "#0f172a",
              colorText: "#f1f5f9",
              colorTextSecondary: "#94a3b8",
              colorInputBackground: "#1e293b",
              colorInputText: "#f1f5f9",
            },
            elements: {
              userButtonPopoverCard:
                "bg-slate-900 shadow-xl border border-slate-700",
              userButtonPopoverMain: "bg-slate-900",
              userButtonPopoverActions: "bg-slate-900 border-slate-800",
              userButtonPopoverActionButton:
                "text-slate-100 hover:bg-slate-800",
              userButtonPopoverActionButtonText: "text-slate-100",
              userButtonPopoverActionButtonIcon: "text-slate-300",
              userButtonPopoverFooter: "bg-slate-900 border-t border-slate-800",
              userPreviewMainIdentifier: "text-slate-100 font-semibold",
              userPreviewSecondaryIdentifier: "text-slate-400",
              userPreviewTextContainer: "text-slate-100",
            },
          }}
        >
          <QueryProvider>
            <ClerkAuthSync />
            <AuthModalProvider>
              <AuthModal />
              <Toaster
                position="bottom-left"
                reverseOrder={false}
                containerStyle={{
                  height: "92vh",
                  marginLeft: "3vw",
                }}
              />
              {children}
            </AuthModalProvider>
          </QueryProvider>
        </ClerkProvider>
      </body>
    </html>
  );
};

export default RootLayout;
