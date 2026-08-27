import { initErrorReporting } from "./error-reporting";

// This module exists only so the root layout can start Sentry from a bare
// side-effect import placed above its other imports. ES imports are evaluated
// before the importing module's body, so an init statement written in
// `_layout.tsx` runs *after* `@/db` has already opened and migrated SQLite --
// which is exactly the failure that most needs to be reported.
initErrorReporting(__DEV__, process.env.EXPO_PUBLIC_SENTRY_DSN);
