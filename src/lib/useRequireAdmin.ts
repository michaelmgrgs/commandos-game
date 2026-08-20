"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AdminInfo = { adminId: string; name: string; role: string };

/**
 * Client-side auth guard for admin pages: checks the session cookie via
 * /api/admin/me and bounces to the login page if it's missing/expired.
 */
export function useRequireAdmin() {
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) {
          setAdmin(data.admin);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/admin/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { admin, checking };
}
