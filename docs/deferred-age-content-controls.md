# Deferred age and content controls

Decision recorded October 7, 2026. Implementation is deferred while build 208 goes to internal testing. ConPaws must remain unpublished.

## Intended product rules

- Local/offline features should support all ages without requiring an account.
- Future accounts require age 13 or older, subject to regional requirements. Accounts are not implemented.
- Mature event content should be hidden by default. Adults must separately enable it after neutral age screening.
- Unlabeled imported events are unknown, not verified child-safe.

These are proposed rules, not behavior implemented in build 208. Existing age badges and content warnings do not prevent access.

## Work before claiming support for children

- [ ] Define which age groups the app is actually designed for; broad availability alone does not justify selecting every store age group.
- [ ] Implement neutral age screening and restricted content settings, storing only the minimum necessary local information.
- [ ] Apply restrictions to schedules, search, event links, import previews, notifications, widgets, Watch, and exported data. Preserve hidden records and saved selections.
- [ ] Ensure backup import cannot enable mature content or bypass restrictions.
- [ ] Audit Sentry and other SDKs, permissions, network requests, and data handling for children and users of unknown age.
- [ ] Test cold starts, offline use, changes to restrictions, old notification/widget caches, and adult content in mislabeled imports.
- [ ] Update privacy text, store review notes, target audience declarations, and content questionnaires only after the implemented behavior is verified.
- [ ] Review regional account-age and parental-consent requirements before implementing accounts.

An age gate does not guarantee an Everyone or low age rating. Answer store questionnaires for the actual content and functionality; do not describe planned controls as present in build 208.

## Official references

- [Google Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en)
- [Google target audience settings](https://support.google.com/googleplay/android-developer/answer/9867159?hl=en)
- [Google content rating requirements](https://support.google.com/googleplay/android-developer/answer/9859655?hl=en)
- [Apple age rating settings](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating)
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/)

Google permits updates to target audience declarations and reviews their accuracy. Including children requires appropriate accessible content and compliance with Families policies, including SDK and data practices. Apple assigns a rating from questionnaire answers; its Kids category has additional requirements. Neither local-only operation nor a future 13+ account rule automatically makes the app suitable for children.
