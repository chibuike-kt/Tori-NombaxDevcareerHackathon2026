"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    const isAuthPage = pathname === "/login" || pathname === "/signup";

    if (!token && !isAuthPage) {
      router.replace("/login");
      return;
    }

    if (token && isAuthPage) {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  return <>{children}</>;
}
