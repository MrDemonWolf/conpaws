// swift-tools-version: 6.0
// Foundation-only logic shared by the widget, watch app and watch widget,
// tested on the Mac with `swift test --package-path apps/native/swift-tests`.
// Sources are symlinks into targets/_shared: @bacons/apple-targets adds that
// whole folder to every Apple target, so no package files may live there.
import PackageDescription

let package = Package(
  name: "ConPawsShared",
  platforms: [.macOS(.v14)],
  products: [.library(name: "ConPawsShared", targets: ["ConPawsShared"])],
  targets: [
    .target(name: "ConPawsShared"),
    .testTarget(name: "ConPawsSharedTests", dependencies: ["ConPawsShared"]),
  ]
)
