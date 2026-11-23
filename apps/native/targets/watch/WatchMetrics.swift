import Foundation

/// Shared measurements, so the header, the section labels and the text inside
/// the cards start at one leading edge.
enum WatchMetrics {
  /// A card's inner horizontal padding, and the inset of every label between
  /// cards.
  static let cardInset: CGFloat = 10
  static let cardSpacing: CGFloat = 10
  static let cornerRadius: CGFloat = 12
}
