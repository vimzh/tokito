"use server";

import { signIn, signOut } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutFromGoogle() {
  await signOut({ redirectTo: "/" });
}

export async function signOutFromAccount() {
  await signOut({ redirectTo: "/" });
}
