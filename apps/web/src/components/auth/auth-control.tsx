import Link from "next/link";
import { auth } from "@/auth";
import { LoginDialog } from "@/components/auth/login-dialog";
import { Button } from "@/components/ui/button";
import { homeContent } from "@/data/home";

export async function AuthControl() {
  const session = await auth();

  if (!session?.user) return <LoginDialog />;

  return (
    <Button asChild className="h-11 rounded-md px-4 text-base shadow-none">
      <Link href="/home">{homeContent.sidebar.home.label}</Link>
    </Button>
  );
}
