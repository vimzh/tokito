import { auth } from "@/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarFooter } from "@/components/ui/sidebar";
import { homeContent } from "@/data/home";
import { signOutFromAccount } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { authContent } from "@/data/auth";

export async function SidebarProfileCard() {
  const user = (await auth())?.user;
  const name =
    user?.name ?? user?.email ?? homeContent.sidebar.profile.accountLabel;
  const detail = user
    ? (user.email ?? homeContent.sidebar.profile.signedInLabel)
    : homeContent.sidebar.profile.signedOutLabel;

  return (
    <SidebarFooter>
      <div className="flex min-w-0 items-center gap-3 rounded-lg bg-sidebar-accent p-2.5">
        <Avatar>
          <AvatarImage alt="" src={user?.image ?? undefined} />
          <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      <form action={signOutFromAccount}>
        <Button className="w-full" variant="ghost" type="submit">
          {authContent.signOut}
        </Button>
      </form>
    </SidebarFooter>
  );
}
