"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button, Card, ErrorMessage, Input, Label } from "@/components/ui";
import { apiUrl } from "@/lib/api-url";
import { GUEST_SESSION_KEY } from "@/lib/types";

export function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(apiUrl("/api/join"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, displayName }),
      });

      const data = (await response.json()) as {
        error?: string;
        quizId?: string;
        displayName?: string;
        sessionToken?: string;
        quizTitle?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not join quiz.");
      }

      if (!data.quizId || !data.displayName || !data.sessionToken) {
        throw new Error("Invalid response from server.");
      }

      sessionStorage.setItem(
        GUEST_SESSION_KEY,
        JSON.stringify({
          quizId: data.quizId,
          displayName: data.displayName,
          sessionToken: data.sessionToken,
          quizTitle: data.quizTitle,
        }),
      );

      router.push(`/play/${data.quizId}`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <h1 className="text-2xl font-semibold">Join a quiz</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the quiz code from your friend and pick a display name.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="code">Quiz code</Label>
          <Input
            id="code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="AB3K9X"
            maxLength={8}
            required
          />
        </div>

        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your nickname"
            maxLength={100}
            required
          />
        </div>

        <ErrorMessage message={error} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Joining..." : "Join quiz"}
        </Button>
      </form>
    </Card>
  );
}
