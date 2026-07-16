import Link from "next/link";

import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex w-full max-w-sm flex-col gap-3">
        <Link href="/login">
          <Button className="w-full">Creator login</Button>
        </Link>
        <Link href="/join">
          <Button variant="secondary" className="w-full">
            Join a quiz
          </Button>
        </Link>
      </div>
    </div>
  );
}
