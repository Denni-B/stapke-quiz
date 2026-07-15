"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Models } from "appwrite";

import { Button } from "@/components/ui";
import { getCurrentUser, logout } from "@/lib/auth";

export function DashboardHeader() {
  const router = useRouter();
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  async function handleLogout() {
    await logout();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/dashboard" className="text-lg font-semibold text-primary">
          Stapke
        </Link>
        <div className="flex items-center gap-3">
          {user ? (
            <span className="hidden text-sm text-muted sm:inline">
              {user.name || user.email}
            </span>
          ) : null}
          <Button type="button" variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}
