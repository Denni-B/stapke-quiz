"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { getCurrentUser } from "@/lib/auth";

export function useRequireAuth() {
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user) {
        router.replace("/login");
      }
    });
  }, [router]);
}
