import Foundation

/// A command sent to the phone and not yet shown by a snapshot.
struct PendingWatchCommand: Codable, Hashable, Sendable {
  let command: ConPawsWatchCommand
  /// False until `sendMessage` was answered or the command was handed to
  /// `transferUserInfo`, which the system then delivers on its own, and false
  /// again if that transfer fails. Anything still false is sent again at the
  /// next activation or when the phone comes back in reach.
  var isDelivered: Bool
}

/// The bookkeeping for saves and removes the Watch has sent and no snapshot
/// has shown yet: a table keyed by event id, so a newer tap on an event
/// replaces the one waiting on it.
///
/// The table functions return a new table and touch nothing else, and `load`
/// and `save` use only the `UserDefaults` they are handed. Foundation only,
/// so this compiles into swift-tests. `WatchScheduleStore` owns the published
/// table, the WatchConnectivity calls and the moment each change is stored.
enum ConPawsPendingCommands {
  typealias Table = [String: PendingWatchCommand]

  /// Where the table is kept across launches, as JSON `[eventId:
  /// PendingWatchCommand]`: a tap made with the phone out of reach must still
  /// be applied, and still show as waiting, after watchOS ends the app.
  /// Changing the key or the shape loses every tap waiting across an update.
  static let storageKey = "conpaws.watch.pendingCommands.v1"

  /// The action waiting on this event, if any. Expired entries read as none,
  /// so a button never stays disabled past the point the phone would apply it.
  static func action(
    for eventID: String,
    in pending: Table,
    at now: Date
  ) -> ConPawsWatchCommand.Action? {
    guard let entry = pending[eventID], !entry.command.hasExpired(at: now) else { return nil }
    return entry.command.action
  }

  /// `command` waiting, not yet delivered, in place of any earlier tap on
  /// its event.
  static func adding(_ command: ConPawsWatchCommand, to pending: Table) -> Table {
    var updated = pending
    updated[command.eventId] = PendingWatchCommand(command: command, isDelivered: false)
    return updated
  }

  /// What still has to be handed to WatchConnectivity: anything not marked
  /// delivered that the phone would still apply.
  static func undelivered(in pending: Table, at now: Date) -> [ConPawsWatchCommand] {
    pending.values
      .filter { !$0.isDelivered && !$0.command.hasExpired(at: now) }
      .map(\.command)
  }

  /// The command with this id marked delivered or not. Unchanged when no
  /// entry has the id, which is the case once a snapshot has settled it.
  static func markingDelivered(_ isDelivered: Bool, commandID: String, in pending: Table) -> Table {
    guard let key = pending.first(where: { $0.value.command.id == commandID })?.key else {
      return pending
    }
    var updated = pending
    updated[key]?.isDelivered = isDelivered
    return updated
  }

  /// Without what `snapshot` shows as done or lists as handled, and what the
  /// phone would now ignore as too old.
  static func settled(_ pending: Table, by snapshot: ConPawsSnapshot, at now: Date) -> Table {
    pending.filter { _, entry in
      !entry.command.isSettled(by: snapshot) && !entry.command.hasExpired(at: now)
    }
  }

  /// Without the commands `snapshot` lists as handled, and nothing else.
  ///
  /// For a snapshot that is not shown because the stored one is newer. Its
  /// receipts are still true, and may be the only ones: the phone keeps them
  /// in memory, so a phone app relaunched after declining a tap publishes a
  /// newer snapshot without it, and the older one that listed it arrives
  /// later as a replayed user info. Its saved events are not used, because
  /// they can predate a newer tap and would settle it early.
  static func settled(_ pending: Table, byReceiptsIn snapshot: ConPawsSnapshot) -> Table {
    guard let handled = snapshot.handledCommandIds.map(Set.init), !handled.isEmpty else {
      return pending
    }
    return pending.filter { _, entry in !handled.contains(entry.command.id) }
  }

  // MARK: Storage

  /// The table stored in `data`, without any entry filed under another
  /// event's id or holding a command the phone would reject. Empty when
  /// nothing readable is stored.
  static func decoded(from data: Data) -> Table {
    guard let stored = try? JSONDecoder().decode(Table.self, from: data) else { return [:] }
    return stored.filter { key, entry in key == entry.command.eventId && entry.command.isValid }
  }

  static func encoded(_ pending: Table) -> Data? {
    try? JSONEncoder().encode(pending)
  }

  static func load(from defaults: UserDefaults = .standard) -> Table {
    defaults.data(forKey: storageKey).map(decoded(from:)) ?? [:]
  }

  /// Stores `pending`, or clears the key once nothing is waiting.
  static func save(_ pending: Table, to defaults: UserDefaults = .standard) {
    if pending.isEmpty {
      defaults.removeObject(forKey: storageKey)
    } else if let data = encoded(pending) {
      defaults.set(data, forKey: storageKey)
    }
  }
}
