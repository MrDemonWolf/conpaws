"use client";

import { useEffect } from "react";
import { AuthScreen } from "./auth-screen";
import { Button } from "./ui";

/**
 * Sends a signed-out visitor to sign in, and back to the page they asked for
 * afterwards. A layout cannot see the request path on the server, so this
 * runs in the browser; without JavaScript the button still gets them there.
 */
export function SignInRedirect() {
  useEffect(() => {
    const here = `${window.location.pathname}${window.location.search}`;
    window.location.replace(
      here === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(here)}`,
    );
  }, []);
  return (
    <AuthScreen
      title="Sign in to continue"
      description="Your session has ended, or you haven't signed in on this device yet."
    >
      <Button href="/sign-in" className="w-full">
        Sign in
      </Button>
    </AuthScreen>
  );
}
