import { SignIn } from "@clerk/nextjs";
import { hideSignUpElements } from "../../../lib/clerk-appearance";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignIn
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
        appearance={{ elements: hideSignUpElements }}
      />
    </div>
  );
}
