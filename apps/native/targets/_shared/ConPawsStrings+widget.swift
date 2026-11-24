import Foundation

/// Words only the watch's smaller complication families draw, in the app's
/// language, the same way `ConPawsStrings` holds the rest (see there for why
/// this is a Swift table and not a string catalog).
///
/// A table of its own so these families' words can change without touching
/// the shared one. Every language needs its own entry, and
/// ComplicationStringsTests checks each is translated and fits its slot.
struct ConPawsComplicationStrings: Sendable {
  let language: ConPawsLanguage

  // MARK: Inline status (2026-11)
  //
  // The inline slot above the time holds about 18 characters on a 41 mm
  // face, and two status headings run past that in many languages
  // ("Panels auf dem iPhone hinzufügen"). The line falls back to these.

  /// No saved panels in the convention: "No panels yet".
  let inlineNoPicks: String
  /// Every saved panel has ended: "Done for today".
  let inlineFinished: String
}

extension ConPawsStrings {
  /// The complication families' own words, in this table's language.
  var complication: ConPawsComplicationStrings { .table(for: language) }
}

// MARK: - Translations

extension ConPawsComplicationStrings {
  static func table(for language: ConPawsLanguage) -> ConPawsComplicationStrings {
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

  private static let en = ConPawsComplicationStrings(
    language: .en,
    inlineNoPicks: "No panels yet",
    inlineFinished: "Done for today"
  )

  private static let es419 = ConPawsComplicationStrings(
    language: .es419,
    inlineNoPicks: "Sin paneles aún",
    inlineFinished: "Listo por hoy"
  )

  private static let esES = ConPawsComplicationStrings(
    language: .esES,
    inlineNoPicks: "Sin paneles aún",
    inlineFinished: "Fin por hoy"
  )

  private static let ptBR = ConPawsComplicationStrings(
    language: .ptBR,
    inlineNoPicks: "Sem painéis",
    inlineFinished: "Fim por hoje"
  )

  private static let ptPT = ConPawsComplicationStrings(
    language: .ptPT,
    inlineNoPicks: "Sem painéis",
    inlineFinished: "Fim por hoje"
  )

  private static let ja = ConPawsComplicationStrings(
    language: .ja,
    inlineNoPicks: "パネル未選択",
    inlineFinished: "今日は終了"
  )

  private static let zhTW = ConPawsComplicationStrings(
    language: .zhTW,
    inlineNoPicks: "尚未選擇活動",
    inlineFinished: "今日活動已結束"
  )

  private static let zhCN = ConPawsComplicationStrings(
    language: .zhCN,
    inlineNoPicks: "尚未选择活动",
    inlineFinished: "今日活动已结束"
  )

  private static let ko = ConPawsComplicationStrings(
    language: .ko,
    inlineNoPicks: "선택한 패널 없음",
    inlineFinished: "오늘 일정 끝"
  )

  private static let de = ConPawsComplicationStrings(
    language: .de,
    inlineNoPicks: "Noch keine Panels",
    inlineFinished: "Für heute fertig"
  )

  private static let fr = ConPawsComplicationStrings(
    language: .fr,
    inlineNoPicks: "Aucun panel",
    inlineFinished: "Journée terminée"
  )

  private static let pl = ConPawsComplicationStrings(
    language: .pl,
    inlineNoPicks: "Brak paneli",
    inlineFinished: "Koniec na dziś"
  )

  private static let it = ConPawsComplicationStrings(
    language: .it,
    inlineNoPicks: "Nessun panel",
    inlineFinished: "Fine per oggi"
  )

  private static let nl = ConPawsComplicationStrings(
    language: .nl,
    inlineNoPicks: "Nog geen panels",
    inlineFinished: "Klaar voor vandaag"
  )

  private static let ms = ConPawsComplicationStrings(
    language: .ms,
    inlineNoPicks: "Tiada panel",
    inlineFinished: "Selesai hari ini"
  )

  private static let sv = ConPawsComplicationStrings(
    language: .sv,
    inlineNoPicks: "Inga paneler",
    inlineFinished: "Klart för i dag"
  )

  private static let da = ConPawsComplicationStrings(
    language: .da,
    inlineNoPicks: "Ingen paneler",
    inlineFinished: "Færdig for i dag"
  )

  private static let nb = ConPawsComplicationStrings(
    language: .nb,
    inlineNoPicks: "Ingen paneler",
    inlineFinished: "Ferdig for i dag"
  )

  private static let fi = ConPawsComplicationStrings(
    language: .fi,
    inlineNoPicks: "Ei paneeleja",
    inlineFinished: "Ei enää tänään"
  )

  private static let cs = ConPawsComplicationStrings(
    language: .cs,
    inlineNoPicks: "Žádné panely",
    inlineFinished: "Pro dnešek hotovo"
  )

  private static let hu = ConPawsComplicationStrings(
    language: .hu,
    inlineNoPicks: "Nincs panel",
    inlineFinished: "Mára ennyi"
  )

  private static let uk = ConPawsComplicationStrings(
    language: .uk,
    inlineNoPicks: "Немає панелей",
    inlineFinished: "На сьогодні все"
  )

  private static let ru = ConPawsComplicationStrings(
    language: .ru,
    inlineNoPicks: "Нет панелей",
    inlineFinished: "На сегодня всё"
  )
}
