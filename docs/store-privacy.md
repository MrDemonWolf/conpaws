# ConPaws store privacy answers

These answers describe the current production app, not planned account, sync, or subscription features. Recheck before each store submission if Sentry configuration changes. Apple's labels follow [App Store privacy details](https://developer.apple.com/app-store/app-privacy-details/); Google Play answers follow [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469).

## Apple App Store privacy label

- **Data collected:** Diagnostics — Crash Data, Performance Data, Other Diagnostic Data.
- **Purpose:** App Functionality (diagnosing crashes and performance problems).
- **Linked to the user's identity:** No.
- **Used for tracking:** No.
- **Other data:** None collected by ConPaws servers from the mobile app. Convention schedules, saved choices, and settings remain on-device. Sentry is enabled only in configured production builds; `sendDefaultPii` is false.

## Google Play Data safety

- **Does the app collect or share user data?** Yes, when Sentry is configured in a production build.
- **Data collected:** App activity → Crash logs; App info and performance → Diagnostics.
- **Purpose:** App functionality (debugging and reliability).
- **Required or optional:** Collection is part of crash reporting when configured; the app's local schedule features work without an account or server sync.
- **Shared:** No. Sentry processes diagnostics as our service provider and is not used for advertising or profiling.
- **Encrypted in transit:** Yes (Sentry uses HTTPS).
- **Deletion request:** Contact legal@conpaws.com. Sentry data is retained according to the configured Sentry project retention.
- **Other data:** Convention schedules, reminders, and settings stay on-device. The app has no ads, behavioral analytics, or tracking. Planned cloud/account features are not included in these answers.
