import { redirect } from "next/navigation";

// Explicit root redirect, per the Phase 0 validation note: "/dashboard" is
// the real dashboard route, and nothing should redirect to "/" as if it
// were a page in its own right. This file exists so "/" has a defined,
// intentional behavior instead of 404ing.
export default function RootPage() {
  redirect("/dashboard");
}
