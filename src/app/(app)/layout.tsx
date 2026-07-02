import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { AppNav } from "@/components/AppNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  return (
    <div className="flex min-h-dvh">
      <AppNav />
      <main className="flex-1 min-w-0 px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8 max-w-6xl">
        {children}
      </main>
    </div>
  );
}
