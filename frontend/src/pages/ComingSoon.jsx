import { Hammer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/AuthContext";

export default function ComingSoon({ title, description, kicker }) {
  const { user } = useAuth();
  const isViewer = user?.role === "viewer";

  return (
    <div className="max-w-5xl" data-testid={`coming-soon-${title.toLowerCase()}`}>
      <div className="flex items-center gap-3 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-teal-700">{kicker || "Module"}</p>
        {isViewer && (
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] rounded-full px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200">
            Demo mode
          </span>
        )}
      </div>
      <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight text-zinc-900">
        {title}
      </h1>
      <p className="mt-4 text-zinc-600 text-base sm:text-lg max-w-2xl leading-relaxed">
        {description}
      </p>

      <div className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-[#fafafa] p-14 md:p-16 text-center">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-teal-100 grid place-items-center text-teal-700 mb-6">
          <Hammer className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl font-bold text-zinc-900 tracking-tight">Coming Soon</h2>
        <p className="mt-2 text-zinc-500 max-w-md mx-auto">
          We are currently forging this tool. Check back soon.
        </p>

        <TooltipProvider delayDuration={100}>
          <div className="mt-8 flex items-center justify-center gap-3">
            {isViewer ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <button
                      disabled
                      data-testid="disabled-primary-action"
                      className="opacity-50 cursor-not-allowed rounded-xl bg-teal-600 text-white font-medium px-5 py-2.5"
                    >
                      Get notified
                    </button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">Demo mode — read only</TooltipContent>
              </Tooltip>
            ) : (
              <button
                data-testid="primary-action"
                className="rounded-xl bg-teal-600 hover:bg-teal-700 transition-colors text-white font-medium px-5 py-2.5"
              >
                Get notified
              </button>
            )}
          </div>
        </TooltipProvider>
      </div>
    </div>
  );
}
