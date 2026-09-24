# ConPaws 1.0.0 build 208 store screenshots

Source: `ee18f59` (`chore(release): prepare 1.0.0 build 208`). Captures come from the production APK on a Pixel 10a Android 17 emulator. The emulator display was set to 1080 × 2160 for the captures; every PNG is 1080 × 2160 with no alpha channel. No overlays or compositing were added.

| File | App screen | Input |
| --- | --- | --- |
| `android-01-onboarding.png` | Welcome | Fresh install |
| `android-02-features.png` | Planning and offline features | Fresh install |
| `android-03-get-started.png` | Import prompt | Fresh install |
| `android-04-imported-schedule.png` | Imported Friday schedule | `conpaws-demo.ics`, 17 events |
| `android-05-overlap-going.png` | Eight simultaneous events, Going | `conpaws-demo.ics` |
| `android-06-planned-leave-at.png` | Going plans and 6:30 PM personal leave time | `conpaws-demo.ics` |
| `android-07-my-schedule.png` | My Schedule with overlap warning | `conpaws-demo.ics` |
| `android-08-now-next.png` | Two current and one upcoming planned event | `conpaws-night-owl.ics`, four events |

The original demo calendar is in the release worktree at `apps/native/build/store/release-208/conpaws-demo.ics`. The local `conpaws-night-owl.ics` fixture places a few events on the capture date so Now and Next shows live schedule data. Both calendars were imported through ConPaws' file picker.

## Remaining App Store captures

- **6.9-inch iPhone:** Required. Accepted portrait sizes include 1260 × 2736, 1290 × 2796, and 1320 × 2868. Build 208 launched on an iPhone 18 Pro Max iOS 27.0 simulator, then exited before onboarding appeared. Crash: `EXC_BREAKPOINT` in `___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption_block_invoke`.
- **13-inch iPad:** Required because the app supports iPad. Accepted portrait sizes: 2064 × 2752 or 2048 × 2732. The same build exited on a separate iPad Air 13-inch iOS 27.0 simulator. The existing SonaPin iPad simulator was untouched.
- **Apple Watch:** Required because this release includes a watch app. An upload image needs a supported watch size, such as 416 × 496 for Series 12. No Watch simulator screenshot has been captured yet.

The iPhone, iPad, and Watch sets remain incomplete. Do not substitute the Android screenshots for Apple device screenshots.

Sources: [Apple screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications), [Google Play preview asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en).
