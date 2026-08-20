import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

// Phase 0 runtime fix: useSearchParams() forces this route to opt out of
// static prerendering unless the component using it is wrapped in
// Suspense. LoginForm holds useSearchParams(); this file just wraps it.
export default function LoginPage() {
  return (
    <div className="auth-shell">
      <Suspense fallback={<div className="auth-card">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
