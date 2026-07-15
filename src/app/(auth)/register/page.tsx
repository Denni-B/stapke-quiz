import Link from "next/link";

import { AuthForm } from "@/components/auth-form";
import { SiteHeader } from "@/components/site-header";

export default function RegisterPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <AuthForm mode="register" />
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/">Back to home</Link>
        </p>
      </main>
    </div>
  );
}
