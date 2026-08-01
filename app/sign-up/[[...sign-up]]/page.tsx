import { redirect } from "next/navigation";

/** Self-registration is disabled — invite / admin provisioning only. */
export default function SignUpPage() {
  redirect("/sign-in");
}
