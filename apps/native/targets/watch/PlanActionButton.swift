import SwiftUI

/// "Add to my plan" straight away; "Remove from my plan" after a
/// confirmation, since it also drops the reminder and any visit.
///
/// While the phone has not confirmed, the label is a spinner and the button
/// is disabled, so a second tap cannot send a second command. A line under it
/// says what a long wait needs and when the phone did not make the change
/// (see `WatchPlanNote`).
struct PlanActionButton: View {
  @Environment(\.redactionReasons) private var redactionReasons
  @Environment(\.isLuminanceReduced) private var isLuminanceReduced
  let action: WatchPlanAction
  let eventTitle: String
  let strings: ConPawsStrings
  @State private var isConfirmingRemoval = false
  @State private var note = WatchPlanNote.none

  private var actionTitle: String {
    action.kind == .add ? strings.addToPlan : strings.removeFromPlan
  }

  /// A dialog title cannot be marked `privacySensitive`, so wrist-down it
  /// names the action instead of the panel, the way every other title on
  /// these screens is hidden.
  private var dialogTitle: String {
    redactionReasons.contains(.privacy) || isLuminanceReduced
      ? strings.removeFromPlan
      : eventTitle
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Button(role: action.kind == .remove ? .destructive : nil) {
        switch action.kind {
        case .add: action.perform()
        case .remove: isConfirmingRemoval = true
        }
      } label: {
        if action.isPending {
          ProgressView()
            // Alone it read the system's "In progress", in the watch's
            // language rather than the app's, and named no action.
            .accessibilityLabel(actionTitle)
        } else {
          Text(actionTitle)
        }
      }
      .disabled(action.isPending)
      .confirmationDialog(dialogTitle, isPresented: $isConfirmingRemoval, titleVisibility: .visible) {
        Button(strings.remove, role: .destructive, action: action.perform)
      }

      if let text = note.text(strings) {
        Text(text)
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
    .onChange(of: action.isPending) { wasPending, isPending in
      let next = note.after(wasPending: wasPending, isPending: isPending)
      if next == .notChanged, note != .notChanged {
        AccessibilityNotification.Announcement(strings.notChanged).post()
      }
      note = next
    }
    .task(id: action.isPending) {
      // Named only once the wait outlasts a running phone app; a new task
      // replaces this one, cancelling the sleep, whenever the wait ends.
      guard action.isPending else { return }
      guard (try? await Task.sleep(for: .seconds(WatchPlanNote.waitingDelay))) != nil else { return }
      note = .waiting
    }
  }
}
