import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-primary">
          Stapke
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/join" className="text-muted hover:text-foreground">
            Join quiz
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary-hover"
          >
            Creator login
          </Link>
        </nav>
      </div>
    </header>
  );
}
