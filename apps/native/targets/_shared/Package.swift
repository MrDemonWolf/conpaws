// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "ConPawsShared",
  platforms: [.macOS(.v14)],
  products: [.library(name: "ConPawsShared", targets: ["ConPawsShared"])],
  targets: [
    .target(
      name: "ConPawsShared",
      path: ".",
      exclude: ["Package.swift", "Tests", "ConPawsMark.swift"],
      sources: ["ConPawsCountdown.swift", "ConPawsSnapshot.swift", "ConPawsStrings.swift"]
    ),
    .testTarget(name: "ConPawsSharedTests", dependencies: ["ConPawsShared"], path: "Tests/ConPawsSharedTests")
  ]
)
