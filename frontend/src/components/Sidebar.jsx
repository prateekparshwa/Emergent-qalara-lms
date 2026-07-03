import { NavLink } from "react-router-dom";
import { LayoutDashboard, Compass, Send, Sparkles, Settings } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/discover", label: "Discover", icon: Compass, testid: "nav-discover" },
  { to: "/outreach", label: "Outreach", icon: Send, testid: "nav-outreach" },
  { to: "/impact", label: "Impact", icon: Sparkles, testid: "nav-impact" },
  { to: "/settings", label: "Settings", icon: Settings, testid: "nav-settings" },
];

export default function Sidebar() {
  return (
    <aside
      data-testid="sidebar"
      className="q-grain hidden md:flex md:flex-col md:w-64 shrink-0 border-r border-zinc-200 bg-[#fafafa] min-h-screen"
    >
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-teal-600 grid place-items-center text-white font-display font-bold text-lg">Q</div>
          <div>
            <div className="font-display text-lg font-bold tracking-tight leading-none">
              Qalara <span className="text-teal-700">LMS</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-400 font-bold mt-1">
              Lead Management
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-zinc-400 px-3 mb-2">Workspace</div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, testid }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testid}
              className={({ isActive }) =>
                [
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-teal-50 text-teal-800 border-r-2 border-teal-600"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                ].join(" ")
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-auto px-6 pb-6 pt-8">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-[10px] uppercase tracking-[0.22em] font-bold text-amber-700">v0.1 Foundation</p>
          <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
            Auth, shell &amp; data models are live. Modules coming next.
          </p>
        </div>
      </div>
    </aside>
  );
}
