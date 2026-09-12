"use client";

import { useId, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authContent } from "@/data/auth";
export function LoginDialog() {
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: form.get("email"),
        password: form.get("password"),
        redirect: false,
      });
      if (!result?.ok || result.error) {
        setError(
          result?.error === "CredentialsSignin"
            ? authContent.invalidCredentials
            : authContent.loginUnavailable
        );
        setPending(false);
        return;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError(authContent.loginUnavailable);
      setPending(false);
    }
  }

  return (
    <Dialog onOpenChange={() => setError(null)}>
      <DialogTrigger asChild>
        <Button
          className="h-11 w-full rounded-md px-4 text-base shadow-none sm:w-fit"
        >
          {authContent.login}
        </Button>
      </DialogTrigger>
      <DialogContent className="font-sans">
        <DialogHeader>
          <DialogTitle>{authContent.loginTitle}</DialogTitle>
          <DialogDescription>{authContent.loginDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-lg border p-3 text-sm">
          <p>{authContent.demoDescription}</p>
          <dl className="space-y-1">
            <div>
              <dt className="inline text-muted-foreground">{authContent.email}: </dt>
              <dd className="inline break-all">{authContent.demoEmail}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">{authContent.password}: </dt>
              <dd className="inline">{authContent.demoPassword}</dd>
            </div>
          </dl>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit} aria-busy={pending}>
          <div className="space-y-2">
            <Label htmlFor={`${id}-email`}>{authContent.email}</Label>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="username"
              required
              disabled={pending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${id}-password`}>{authContent.password}</Label>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
          <Button className="w-full" type="submit" disabled={pending}>
            {pending ? authContent.loggingIn : authContent.login}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
