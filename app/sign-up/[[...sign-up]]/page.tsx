import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignUp
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
        signInUrl="/sign-in"
      />
    </div>
  );
}
