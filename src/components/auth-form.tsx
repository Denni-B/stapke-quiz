"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Button, Card, ErrorMessage, Input, Label } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { loginUser, registerUser } from "@/lib/auth";

interface AuthFormProps {
  mode: "login" | "register";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        router.replace("/dashboard");
      }
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        await registerUser(email, password, name);
      } else {
        await loginUser(email, password);
      }

      window.location.assign("/dashboard");
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
      <h1 className="text-2xl font-semibold">
        {mode === "register" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {mode === "register"
          ? "Sign up to create and manage quizzes."
          : "Log in to manage your quizzes."}
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {mode === "register" ? (
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
            />
          </div>
        ) : null}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            minLength={8}
            required
          />
        </div>

        <ErrorMessage message={error} />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "register"
              ? "Create account"
              : "Log in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        {mode === "register" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary">
              Log in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/register" className="font-medium text-primary">
              Create an account
            </Link>
          </>
        )}
      </p>
    </Card>
  );
}
