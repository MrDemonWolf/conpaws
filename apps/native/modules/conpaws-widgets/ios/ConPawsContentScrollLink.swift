#if os(iOS)
import ExpoModulesCore
import UIKit

/// Tells the screen's view controller which scroll view drives its navigation
/// bar, so a large title collapses and the bar's scroll-edge background changes
/// as an `@expo/ui` list scrolls.
///
/// UIKit finds a content scroll view on its own only along the first-subview
/// chain of the screen. The `UICollectionView` behind a SwiftUI `Form` or
/// `List` inside a `Host` is not on that chain, so the large title never
/// collapsed and rows slid under the title. `setContentScrollView(_:for:)`
/// (iOS 15) is the supported way to name the scroll view instead.
final class ConPawsContentScrollLinkView: ExpoView {
  private weak var linkedScrollView: UIScrollView?
  private var pendingAttempts = 0

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    // SwiftUI builds its collection view after the first layout pass, so keep
    // looking for a few run-loop turns rather than only once.
    pendingAttempts = 8
    linkWhenReady()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    link()
  }

  private func linkWhenReady() {
    guard pendingAttempts > 0, window != nil else { return }
    pendingAttempts -= 1
    if link() { pendingAttempts = 0; return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
      self?.linkWhenReady()
    }
  }

  @discardableResult
  private func link() -> Bool {
    guard window != nil,
      let controller = screenViewController(),
      let scrollView = firstScrollView(below: self)
    else { return false }
    if linkedScrollView !== scrollView
      || controller.contentScrollView(for: .top) !== scrollView
    {
      controller.setContentScrollView(scrollView, for: .top)
      linkedScrollView = scrollView
    }
    return true
  }

  /// Breadth first, so the list's own scroll view wins over any scroll view
  /// nested inside one of its rows.
  private func firstScrollView(below root: UIView) -> UIScrollView? {
    var queue = root.subviews
    var index = 0
    while index < queue.count {
      let view = queue[index]
      index += 1
      if let scrollView = view as? UIScrollView, scrollView.isScrollEnabled {
        return scrollView
      }
      queue.append(contentsOf: view.subviews)
    }
    return nil
  }

  /// The nearest view controller above this view that a navigation controller
  /// owns: the stack screen whose bar should follow the list.
  private func screenViewController() -> UIViewController? {
    var responder: UIResponder? = next
    while let current = responder {
      if let controller = current as? UIViewController,
        controller.navigationController != nil
      {
        return controller
      }
      responder = current.next
    }
    return nil
  }
}

public final class ConPawsContentScrollLinkModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ConPawsContentScrollLink")
    View(ConPawsContentScrollLinkView.self) {}
  }
}
#endif
