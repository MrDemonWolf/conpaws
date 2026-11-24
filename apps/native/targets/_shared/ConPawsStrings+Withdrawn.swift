import Foundation

/// What the Watch app says about a saved panel the convention withdrew.
///
/// Every line is copied verbatim from the app catalogs (the keys are in
/// src/locales/watch-withdrawn-strings-parity.test.ts), so the wrist and the
/// phone describe the same panel in the same words: the phone's row badge for
/// the status, and its schedule-update banner for the Home notice.
///
/// A table of its own, beside `ConPawsStrings` and resolved by the same
/// `ConPawsLanguage`, so this feature's words do not widen the shared table
/// every Watch change edits.
struct ConPawsWithdrawnStrings: Sendable {
  let language: ConPawsLanguage
  /// `convention.feedStatus.cancelled`: the convention cancelled it.
  let cancelled: String
  /// `convention.feedStatus.removed`: the feed stopped listing it.
  let removed: String
  /// `convention.scheduleUpdate.goneOne`.
  let goneOne: String
  /// `convention.scheduleUpdate.goneMany`, its `{{count}}` as `%@`.
  let goneManyFormat: String
}

extension ConPawsWithdrawnStrings {
  /// The status as the phone's badge words it.
  func label(for status: ConPawsWithdrawnEvent.Status) -> String {
    switch status {
    case .cancelled: cancelled
    case .removed: removed
    }
  }

  /// The Home notice for `count` withdrawn panels, one or many as the
  /// phone's banner picks them. Every status counts: a cancelled panel is
  /// off the schedule too.
  func notice(count: Int) -> String {
    count == 1 ? goneOne : String(format: goneManyFormat, String(count))
  }
}

extension ConPawsStrings {
  /// This language's words for withdrawn panels.
  var withdrawnStrings: ConPawsWithdrawnStrings {
    ConPawsWithdrawnStrings.table(for: language)
  }
}

// MARK: - Translations

extension ConPawsWithdrawnStrings {
  static func table(for language: ConPawsLanguage) -> ConPawsWithdrawnStrings {
    switch language {
    case .en: en
    case .es419: es419
    case .esES: esES
    case .ptBR: ptBR
    case .ptPT: ptPT
    case .ja: ja
    case .zhTW: zhTW
    case .zhCN: zhCN
    case .ko: ko
    case .de: de
    case .fr: fr
    case .pl: pl
    case .it: it
    case .nl: nl
    case .ms: ms
    case .sv: sv
    case .da: da
    case .nb: nb
    case .fi: fi
    case .cs: cs
    case .hu: hu
    case .uk: uk
    case .ru: ru
    }
  }

  private static let en = ConPawsWithdrawnStrings(
    language: .en,
    cancelled: "Cancelled",
    removed: "Off the schedule",
    goneOne: "A saved panel is off the schedule",
    goneManyFormat: "%@ saved panels are off the schedule",
  )

  private static let es419 = ConPawsWithdrawnStrings(
    language: .es419,
    cancelled: "Cancelado",
    removed: "Fuera del programa",
    goneOne: "Un panel guardado ya no está en el programa",
    goneManyFormat: "%@ paneles guardados ya no están en el programa",
  )

  private static let esES = ConPawsWithdrawnStrings(
    language: .esES,
    cancelled: "Cancelado",
    removed: "Fuera del programa",
    goneOne: "Un panel guardado ya no está en el programa",
    goneManyFormat: "%@ paneles guardados ya no están en el programa",
  )

  private static let ptBR = ConPawsWithdrawnStrings(
    language: .ptBR,
    cancelled: "Cancelado",
    removed: "Fora da programação",
    goneOne: "Um painel salvo saiu da programação",
    goneManyFormat: "%@ painéis salvos saíram da programação",
  )

  private static let ptPT = ConPawsWithdrawnStrings(
    language: .ptPT,
    cancelled: "Cancelado",
    removed: "Fora do programa",
    goneOne: "Um painel guardado saiu do programa",
    goneManyFormat: "%@ painéis guardados saíram do programa",
  )

  private static let ja = ConPawsWithdrawnStrings(
    language: .ja,
    cancelled: "中止",
    removed: "スケジュール外",
    goneOne: "保存したパネルがスケジュールから外れました",
    goneManyFormat: "保存したパネル %@ 件がスケジュールから外れました",
  )

  private static let zhTW = ConPawsWithdrawnStrings(
    language: .zhTW,
    cancelled: "已取消",
    removed: "已不在行程中",
    goneOne: "一個已儲存的談話已不在行程中",
    goneManyFormat: "%@ 個已儲存的談話已不在行程中",
  )

  private static let zhCN = ConPawsWithdrawnStrings(
    language: .zhCN,
    cancelled: "已取消",
    removed: "已不在日程中",
    goneOne: "一个已保存的论坛已不在日程中",
    goneManyFormat: "%@ 个已保存的论坛已不在日程中",
  )

  private static let ko = ConPawsWithdrawnStrings(
    language: .ko,
    cancelled: "취소됨",
    removed: "일정에서 제외됨",
    goneOne: "저장한 패널이 일정에서 빠졌습니다",
    goneManyFormat: "저장한 패널 %@개가 일정에서 빠졌습니다",
  )

  private static let de = ConPawsWithdrawnStrings(
    language: .de,
    cancelled: "Abgesagt",
    removed: "Nicht mehr im Programm",
    goneOne: "Ein gemerktes Panel ist nicht mehr im Programm",
    goneManyFormat: "%@ gemerkte Panels sind nicht mehr im Programm",
  )

  private static let fr = ConPawsWithdrawnStrings(
    language: .fr,
    cancelled: "Annulé",
    removed: "Retiré du programme",
    goneOne: "Un panel enregistré a été retiré du programme",
    goneManyFormat: "%@ panels enregistrés ont été retirés du programme",
  )

  private static let pl = ConPawsWithdrawnStrings(
    language: .pl,
    cancelled: "Odwołane",
    removed: "Poza harmonogramem",
    goneOne: "Zapisany panel wypadł z harmonogramu",
    goneManyFormat: "Z harmonogramu wypadły zapisane panele: %@",
  )

  private static let it = ConPawsWithdrawnStrings(
    language: .it,
    cancelled: "Annullato",
    removed: "Fuori dal programma",
    goneOne: "Un panel salvato non è più in programma",
    goneManyFormat: "%@ panel salvati non sono più in programma",
  )

  private static let nl = ConPawsWithdrawnStrings(
    language: .nl,
    cancelled: "Geannuleerd",
    removed: "Niet meer op het programma",
    goneOne: "Een opgeslagen panel staat niet meer op het programma",
    goneManyFormat: "%@ opgeslagen panels staan niet meer op het programma",
  )

  private static let ms = ConPawsWithdrawnStrings(
    language: .ms,
    cancelled: "Dibatalkan",
    removed: "Tiada dalam jadual",
    goneOne: "Satu panel tersimpan tiada lagi dalam jadual",
    goneManyFormat: "%@ panel tersimpan tiada lagi dalam jadual",
  )

  private static let sv = ConPawsWithdrawnStrings(
    language: .sv,
    cancelled: "Inställt",
    removed: "Borta ur programmet",
    goneOne: "En sparad panel är borta ur programmet",
    goneManyFormat: "%@ sparade paneler är borta ur programmet",
  )

  private static let da = ConPawsWithdrawnStrings(
    language: .da,
    cancelled: "Aflyst",
    removed: "Ikke længere på programmet",
    goneOne: "Et gemt panel er ikke længere på programmet",
    goneManyFormat: "%@ gemte paneler er ikke længere på programmet",
  )

  private static let nb = ConPawsWithdrawnStrings(
    language: .nb,
    cancelled: "Avlyst",
    removed: "Ute av programmet",
    goneOne: "Et lagret panel er ute av programmet",
    goneManyFormat: "%@ lagrede paneler er ute av programmet",
  )

  private static let fi = ConPawsWithdrawnStrings(
    language: .fi,
    cancelled: "Peruttu",
    removed: "Poissa ohjelmasta",
    goneOne: "Tallennettu paneeli on poissa ohjelmasta",
    goneManyFormat: "%@ tallennettua paneelia on poissa ohjelmasta",
  )

  private static let cs = ConPawsWithdrawnStrings(
    language: .cs,
    cancelled: "Zrušeno",
    removed: "Mimo program",
    goneOne: "Uložený panel je mimo program",
    goneManyFormat: "Mimo program jsou uložené panely: %@",
  )

  private static let hu = ConPawsWithdrawnStrings(
    language: .hu,
    cancelled: "Törölve",
    removed: "Lekerült a programról",
    goneOne: "Egy mentett panel lekerült a programról",
    goneManyFormat: "%@ mentett panel lekerült a programról",
  )

  private static let uk = ConPawsWithdrawnStrings(
    language: .uk,
    cancelled: "Скасовано",
    removed: "Немає в розкладі",
    goneOne: "Збережена панель вибула з розкладу",
    goneManyFormat: "З розкладу вибуло збережених панелей: %@",
  )

  private static let ru = ConPawsWithdrawnStrings(
    language: .ru,
    cancelled: "Отменено",
    removed: "Нет в расписании",
    goneOne: "Сохранённая панель выбыла из расписания",
    goneManyFormat: "Из расписания выбыло сохранённых панелей: %@",
  )
}
