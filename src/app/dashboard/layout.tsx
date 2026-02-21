"use client";

import DemoBanner from "@/components/demoBanner";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await apiFetch("/auth/me"); // if cookie/session invalid -> should 401
      } catch {
        // clear marker + bounce to login
        document.cookie = "ef_auth=; Path=/; Max-Age=0; SameSite=Lax";
        if (mounted) router.replace("/login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div>
      <DemoBanner />
      {children}
    </div>
  );
}
