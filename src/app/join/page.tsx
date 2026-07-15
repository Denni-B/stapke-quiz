import Link from "next/link";

import { JoinForm } from "@/components/join-form";
import { SiteHeader } from "@/components/site-header";

export default function JoinPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <JoinForm />
        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/">Back to home</Link>
        </p>
      </main>
    </div>
  );
}
