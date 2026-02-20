# ConPaws - Legal Documents

Templates for Privacy Policy and Terms of Service. These must be hosted at `conpaws.com/privacy` and `conpaws.com/terms` before App Store submission.

**Important:** These are templates — review with a lawyer before publishing. Replace all `[PLACEHOLDER]` values before going live.

---

## TL;DR

- **Privacy:** Free users = zero data collected. Account users = email + profile only. No ads, no tracking, no data sales.
- **Terms:** Standard acceptable use. Subscription via Apple/Google. 30-day grace on cancel. Self-service account deletion.
- **Compliance:** GDPR, CCPA, COPPA (not directed at under-13). App Store checklist at the bottom.
- **Hosted at:** `conpaws.com/privacy` and `conpaws.com/terms` (must be live before App Store submission).

---

## Privacy Policy

**Last updated:** June 30, 2026

### The Short Version

ConPaws is built with privacy at its core. If you use the app without an account, **we collect nothing** — zero data leaves your device. If you create an account or subscribe to ConPaws+, we only collect what's needed to provide those features. We don't run ads. We don't sell your data. We don't use third-party analytics.

---

### 1. Who We Are

ConPaws ("we", "our", "us") is operated by MrDemonWolf, Inc., located at 645 3rd St, Beloit, WI, USA. Contact us at legal@mrdemonwolf.com.

This Privacy Policy explains how we collect, use, and protect your information when you use the ConPaws mobile application ("the App").

### 2. What We Collect

#### Free (No Account)

When you use ConPaws without creating an account:

- **We collect nothing.** All data (conventions, events, settings) is stored locally on your device.
- No analytics, no tracking, no cookies, no device fingerprinting.
- No data is transmitted to any server.

#### Free Account

When you create an account, we collect:

| Data | Purpose | Stored Where |
|------|---------|-------------|
| Email address | Account identification (via Apple/Google OAuth) | Supabase Auth (self-hosted) |
| Display name | Shown on your profile | Supabase Database (self-hosted) |
| Username | Unique identifier (@username) | Supabase Database (self-hosted) |
| Pronouns | Shown on your profile (optional) | Supabase Database (self-hosted) |
| Bio | Shown on your profile (optional) | Supabase Database (self-hosted) |
| Profile avatar | Shown on your profile (optional) | Cloudflare R2 |

#### ConPaws+ Subscribers

In addition to the above, ConPaws+ subscribers' data includes:

| Data | Purpose | Stored Where |
|------|---------|-------------|
| Convention names and dates | Cloud sync and sharing | Supabase Database (self-hosted) |
| Event schedules | Cloud sync and sharing | Supabase Database (self-hosted) |
| Subscription status | Feature access | RevenueCat |
| Name effect preference | Display name styling | Supabase Database (self-hosted) |

### 3. How We Use Your Data

We use your data **only** to provide the features you've opted into:

- **Account features:** Display your profile to other users
- **ConPaws+ features:** Sync your convention data to the cloud, share your schedule publicly
- **Subscription management:** Verify your ConPaws+ subscription status

We do **not** use your data for:
- Advertising or ad targeting
- Selling to third parties
- Behavioral analytics or tracking
- Training AI or machine learning models

### 4. Third-Party Services

We use the following third-party services:

| Service | Purpose | Their Privacy Policy |
|---------|---------|---------------------|
| Apple Sign-In | Authentication | [apple.com/legal/privacy](https://www.apple.com/legal/privacy/) |
| Google Sign-In | Authentication | [policies.google.com/privacy](https://policies.google.com/privacy) |
| RevenueCat | Subscription management | [revenuecat.com/privacy](https://www.revenuecat.com/privacy/) |
| Cloudflare R2 | Avatar file storage | [cloudflare.com/privacypolicy](https://www.cloudflare.com/privacypolicy/) |

**Note:** Our backend (Supabase) is self-hosted on infrastructure we control. Your data is not stored on Supabase's cloud platform.

### 5. Data Sharing

We do **not** share your personal data with any third party, except:

- **Apple/Google:** For authentication (OAuth sign-in) and subscription billing
- **RevenueCat:** For subscription management (receives your anonymous user ID and subscription status only)
- **Law enforcement:** If required by law (court order, subpoena)

We do **not** sell, rent, or trade your personal information. Ever.

### 6. Data Retention

| Scenario | What Happens |
|----------|-------------|
| **Free (no account)** | All data on your device. We have nothing to retain. |
| **Account exists** | Profile data kept until you delete your account. |
| **ConPaws+ cancelled** | Cloud data retained for 30 days, then permanently deleted. Local data stays on your device. |
| **Account deleted** | All cloud data (profile, conventions, events, avatar) permanently deleted immediately. |

### 7. Your Rights

You have the right to:

- **Access** your data — View your profile and synced data in the app at any time
- **Correct** your data — Edit your profile information in the app
- **Delete** your data — Self-service account deletion in Settings (immediate, no support ticket needed)
- **Export** your data — Download your cloud data to your device when cancelling ConPaws+
- **Withdraw consent** — Sign out or delete your account at any time

These rights apply to all users, regardless of location. We comply with:
- **GDPR** (European Union)
- **CCPA/CPRA** (California, USA)
- **PIPEDA** (Canada)

### 8. Data Security

- All data in transit is encrypted via TLS/HTTPS
- Database access is controlled via Row Level Security (RLS) — users can only access their own data
- Authentication is handled by industry-standard OAuth providers (Apple, Google)
- Avatar storage uses signed URLs with limited validity
- Our backend is self-hosted on infrastructure we control

### 9. Children's Privacy

ConPaws is not directed at children under 13 (or under 16 in the EU). We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us at legal@mrdemonwolf.com and we will delete it.

### 10. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of significant changes by:
- Displaying a notice in the app
- Updating the "Last updated" date above

Continued use of the app after changes constitutes acceptance of the updated policy.

### 11. Contact Us

For privacy questions, data requests, or concerns:

- **Email:** legal@mrdemonwolf.com
- **Website:** conpaws.com/privacy

---

## Terms of Service

**Last updated:** June 30, 2026

### The Short Version

ConPaws is a convention companion app. Use it to plan your convention schedule. Be respectful. Don't abuse the platform. If you subscribe to ConPaws+, you get cloud features — cancel anytime.

---

### 1. Agreement

By using ConPaws ("the App"), you agree to these Terms of Service ("Terms"). If you don't agree, don't use the app.

These Terms are between you and MrDemonWolf, Inc. ("we", "our", "us").

### 2. Using ConPaws

#### Without an Account

You can use ConPaws without creating an account. All features work locally on your device. No terms beyond standard app usage apply.

#### With an Account

By creating an account, you agree to:

- Provide accurate information
- Keep your credentials secure
- Not impersonate others
- Follow the community guidelines below

### 3. Accounts

#### Creation

- You must be at least 13 years old (16 in the EU) to create an account
- One account per person
- Accounts are created via Apple Sign-In or Google Sign-In

#### Usernames

- 3-20 characters, lowercase letters, numbers, and underscores only
- Must be unique
- Must not violate our blocklist (profanity, reserved words, impersonation)
- **Username changes require contacting support** to prevent abuse and impersonation
- We reserve the right to reclaim usernames that violate these rules

#### Account Deletion

- You can delete your account at any time from Settings > Delete Account
- Deletion is immediate and permanent
- All cloud data (profile, conventions, events, avatar) is permanently removed
- Local data on your device is not affected
- Active subscriptions must be cancelled separately through Apple/Google

### 4. Community Guidelines

When using ConPaws social features (profiles, shared schedules), you agree not to:

- Harass, bully, threaten, or intimidate other users
- Post illegal, harmful, or sexually explicit content in profiles or bios
- Impersonate other people, convention staff, or ConPaws team members
- Use the platform for spam, scams, or commercial solicitation
- Attempt to access other users' data or accounts
- Reverse engineer, exploit, or attack the app or its infrastructure

We reserve the right to suspend or terminate accounts that violate these guidelines.

### 5. ConPaws+ Subscription

#### Pricing

- **Monthly:** $3.99/month
- **Yearly:** $24.99/year

Prices may change with notice. Existing subscribers keep their current price until their next renewal after the change.

#### Billing

- Subscriptions are billed through Apple App Store or Google Play Store
- Payment is charged to your Apple ID or Google account
- Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period

#### Cancellation

- Cancel anytime through your Apple or Google subscription settings
- You keep ConPaws+ features until the end of your current billing period
- After expiry, your cloud data is retained for 30 days
- After 30 days, cloud data is permanently deleted
- Your account and profile remain active (free tier)
- Local data on your device is never affected

#### No Free Trial

ConPaws+ does not offer a free trial.

#### Refunds

Refunds are handled by Apple or Google according to their respective refund policies. We do not process refunds directly.

### 6. Badges

#### ConPaws+ Badge (Gold Paw)

- Automatically applied to active ConPaws+ subscribers
- Removed when subscription expires

#### Verified Badge (Blue Checkmark)

- Admin-assigned only, for notable community members
- Not available for purchase
- Can be revoked at our discretion

#### Developer Badge (Gold Checkmark)

- Reserved for the creator of ConPaws
- Not available for purchase

Badges are a privilege, not a right. Misrepresenting badge status is a violation of these Terms.

### 7. Name Effects

- Pride flag name effects are available to ConPaws+ subscribers
- Effect selection is preserved if you cancel, but stops displaying until you re-subscribe
- We may add new flag options over time

### 8. Convention Directory

- ConPaws maintains an admin-curated directory of conventions
- We make reasonable efforts to keep information accurate but do not guarantee accuracy
- Convention dates, locations, and schedules may change — always verify with the convention directly
- ConPaws is not affiliated with any convention unless explicitly stated

### 9. Intellectual Property

- ConPaws, the ConPaws logo, and ConPaws+ are the property of MrDemonWolf, Inc.
- You retain ownership of all content you create (profile information, convention data)
- By using social features, you grant us a limited, non-exclusive license to display your public profile and shared schedule data to other users
- This license ends when you delete your account or make your data private

### 10. Disclaimer of Warranties

ConPaws is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to:

- Fitness for a particular purpose
- Uninterrupted or error-free operation
- Accuracy of convention data

### 11. Limitation of Liability

To the maximum extent permitted by law, MrDemonWolf, Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to:

- Loss of data (local device failures, etc.)
- Missed convention events due to app errors
- Subscription billing disputes (handled by Apple/Google)

Our total liability shall not exceed the amount you paid us in the 12 months prior to the claim.

### 12. Changes to These Terms

We may update these Terms from time to time. We will notify you of significant changes by:
- Displaying a notice in the app
- Updating the "Last updated" date above

Continued use of the app after changes constitutes acceptance of the updated Terms.

### 13. Governing Law

These Terms are governed by the laws of the State of Wisconsin, USA. Any disputes will be resolved in the courts of Rock County, Wisconsin, USA.

### 14. Contact Us

For questions about these Terms:

- **Email:** legal@mrdemonwolf.com
- **Website:** conpaws.com/terms

---

## App Store Compliance Checklist

Both Apple and Google have specific requirements. This checklist ensures we pass review.

### Apple App Store Requirements

- [x] **Privacy Policy URL** — Required in App Store Connect metadata (`conpaws.com/privacy`)
- [x] **Account deletion** — Required since June 2022 for any app with account creation (self-service in Settings)
- [x] **Subscription terms visible** — Pricing, renewal, and cancellation info shown on paywall before purchase
- [ ] **App Privacy Nutrition Labels** — Fill out in App Store Connect:
  - Data Not Collected (free tier, no account)
  - Data Linked to You: email, name, user ID, purchases (account + premium)
  - Data Not Used to Track You
- [ ] **Purpose strings** — If requesting permissions (camera for avatar, notifications): explain why in Info.plist
- [ ] **Restore Purchases button** — Required on paywall (already in mockup)
- [ ] **Sign in with Apple** — Required if offering any third-party sign-in (we have it)
- [ ] **Auto-renewal language** — Must show near subscribe button:
  "Subscription automatically renews unless auto-renew is turned off at least 24-hours before the end of the current period. Payment will be charged to your Apple ID account. Manage subscriptions in Settings."

### Google Play Store Requirements

- [x] **Privacy Policy URL** — Required in Play Console (`conpaws.com/privacy`)
- [x] **Account deletion** — Required since December 2023 (self-service in Settings)
- [ ] **Data Safety section** — Fill out in Play Console:
  - Data collected: email, name, profile photo, app activity
  - Data shared: none
  - Security: encrypted in transit, request deletion available
- [ ] **Subscription disclosure** — Must show pricing, billing period, and cancellation terms before purchase
- [ ] **Target audience** — Declare app is not designed for children (avoid COPPA/COPPA-like review)

### Both Stores

- [ ] Legal pages accessible **without logging in** (public URLs)
- [ ] Legal links in app: Settings screen, sign-up flow, paywall
- [ ] Terms and Privacy links in App Store / Play Store listing description
- [ ] Contact email visible in both legal documents and store listings
- [ ] GDPR-compliant data deletion (immediate, self-service)

---

*Replace all [PLACEHOLDER] values before publishing. Consider having a lawyer review these documents.*
