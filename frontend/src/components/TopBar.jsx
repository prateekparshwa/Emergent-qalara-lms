import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const initials = (user.name || user.email || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    // Navigate BEFORE clearing user; otherwise AppShell will redirect to /sign-in
    // the moment `user` becomes null, pre-empting our /signed-out navigation.
    navigate("/signed-out", { replace: true });
    await logout();
  };

  const roleClass =
    user.role === "editor"
      ? "bg-teal-50 text-teal-800 border-teal-200"
      : "bg-amber-50 text-amber-800 border-amber-200";

  return (
    <header
      data-testid="topbar"
      className="sticky top-0 z-40 h-16 flex items-center justify-between px-6 md:px-8 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md"
    >
      <div className="flex items-center gap-3">
        <div className="hidden md:block text-[10px] uppercase tracking-[0.22em] font-bold text-zinc-400">
          Workspace
        </div>
        <div className="hidden md:block h-3 w-px bg-zinc-200" />
        <div className="text-sm text-zinc-600">Qalara internal · Buyer Intelligence</div>
      </div>

      <div className="flex items-center gap-3">
        <span
          data-testid="role-badge"
          className={`text-[10px] font-bold uppercase tracking-[0.2em] rounded-full px-3 py-1 border ${roleClass}`}
        >
          {user.role}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              data-testid="user-menu-trigger"
              className="flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 hover:bg-zinc-100 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.picture} alt={user.name} />
                <AvatarFallback className="bg-teal-600 text-white text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <span data-testid="user-name" className="hidden sm:inline text-sm font-medium text-zinc-800">
                {user.name || user.email}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-zinc-900">{user.name}</span>
                <span className="text-xs text-zinc-500">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              data-testid="sign-out-btn"
              onClick={handleSignOut}
              className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
