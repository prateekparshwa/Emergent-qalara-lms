import { Link } from "react-router-dom";

export default function SignedOut() {
  return (
    <div className="min-h-screen grid place-items-center bg-white q-grain px-6" data-testid="signed-out-page">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-12 w-12 rounded-xl bg-teal-600 grid place-items-center text-white font-display font-bold text-xl mb-6">Q</div>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700 mb-3">Session ended</p>
        <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-zinc-900">
          You&apos;re signed out.
        </h1>
        <p className="mt-3 text-zinc-600">Thanks for using Qalara LMS. Sign in again to continue.</p>
        <Link
          to="/sign-in"
          data-testid="return-signin-link"
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 transition-colors text-white font-medium px-5 py-3"
        >
          Return to sign in
        </Link>
      </div>
    </div>
  );
}
