import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-white">
        <div className="h-10 w-10 rounded-full border-2 border-zinc-200 border-t-teal-600 animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  return (
    <div className="min-h-screen flex bg-white">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6 md:p-8 lg:p-12" data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
