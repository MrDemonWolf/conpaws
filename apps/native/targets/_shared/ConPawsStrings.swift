import Foundation

/// The languages ConPaws ships, as the app spells them.
///
/// These match `SUPPORTED_LANGUAGES` in `src/lib/supported-locales.ts`, which is
/// what ends up in a snapshot's `localeIdentifier`, and
/// `locales-swift-parity.test.ts` fails if the two lists drift apart. They did
/// drift once: the app grew to 23 languages while this enum still had 8, so
/// fifteen languages got English widgets, an English watch app and English
/// complications with nothing to indicate anything was wrong.
///
/// Regional pairs are kept apart rather than collapsed, because they disagree
/// in this vocabulary: es-419 says "Ahora mismo" where es-ES says "Ahora", and
/// pt-PT writes "ecrã" where pt-BR writes "tela".
enum ConPawsLanguage: String, CaseIterable, Sendable {
  case en
  case es419 = "es-419"
  case esES = "es-ES"
  case ptBR = "pt-BR"
  case ptPT = "pt-PT"
  case ja
  case zhTW = "zh-TW"
  case zhCN = "zh-CN"
  case ko
  case de
  case fr
  case pl
  case it
  case nl
  case ms
  case sv
  case da
  case nb
  case fi
  case cs
  case hu
  case uk
  case ru

  /// The language a snapshot's `localeIdentifier` names.
  ///
  /// Tolerant of spellings the app does not currently write -- `de_DE`, `PT-br`,
  /// a bare `pt` -- because the identifier crosses a process boundary and an
  /// unrecognised one must still render something rather than nothing.
  static func resolve(_ identifier: String) -> ConPawsLanguage {
    let normalized = identifier.replacingOccurrences(of: "_", with: "-").lowercased()
    if let exact = allCases.first(where: { $0.rawValue.lowercased() == normalized }) {
      return exact
    }
    let base = normalized.split(separator: "-").first.map(String.init) ?? normalized
    // Regionless spellings of a language that only ships with regions. Without
    // these a bare `es` or `zh` falls all the way through to English, which is
    // a worse answer than either variant.
    switch base {
    case "pt": return .ptBR
    case "es": return .es419
    case "zh":
      if ["zh-hant", "zh-hk", "zh-tw", "zh-mo"].contains(where: normalized.hasPrefix) { return .zhTW }
      return .zhCN
    default: break
    }
    return allCases.first { $0.rawValue.lowercased() == base } ?? .en
  }
}

/// Which of a language's plural forms a count selects.
///
/// `few` exists for the Slavic languages: Polish, Russian, Ukrainian and Czech
/// all inflect 2-4 differently from 5 and up, so "2 godziny" and "5 godzin" are
/// not the same word. Languages with the usual singular/plural pair leave `few`
/// equal to `other`, and the languages with no number agreement at all --
/// Japanese, Chinese, Korean, Malay -- set every form to the same string, so
/// which one is selected stops mattering.
enum ConPawsPluralForm: Sendable {
  case one
  case few
  case other
}

extension ConPawsLanguage {
  func pluralForm(_ count: Int) -> ConPawsPluralForm {
    let value = abs(count)
    let mod10 = value % 10
    let mod100 = value % 100

    switch self {
    case .cs:
      if value == 1 { return .one }
      return (2...4).contains(value) ? .few : .other

    // Polish: 2-4 take the `few` form except the teen numbers.
    case .pl:
      if value == 1 { return .one }
      if (2...4).contains(mod10), !(12...14).contains(mod100) { return .few }
      return .other

    // Russian and Ukrainian differ from Polish in the singular: 21 and 31 take
    // it too, while 11 does not. "21 час", not "21 часов".
    case .ru, .uk:
      if mod10 == 1, mod100 != 11 { return .one }
      if (2...4).contains(mod10), !(12...14).contains(mod100) { return .few }
      return .other

    default:
      return value == 1 ? .one : .other
    }
  }
}

/// One countable noun in every form these languages need.
///
/// The templates carry `%@` rather than `%d` so every substitution in this file
/// goes through the same string-only path: a numeric format specifier and a
/// Swift `Int` disagree about width, and mixing the two is how a format string
/// starts reading the wrong bytes.
struct ConPawsPluralUnit: Sendable {
  let one: String
  let few: String
  let other: String

  /// The same noun in whatever case the language's "in" preposition governs.
  ///
  /// German takes the dative, so a countdown says "In 3 Tagen" where the noun
  /// on its own is "3 Tage". Polish takes the accusative, so "Za 1 godzinę"
  /// where the noun on its own is "1 godzina". Languages that inflect neither
  /// leave these equal to the plain forms, which is the default.
  let obliqueOne: String
  let obliqueFew: String
  let obliqueOther: String

  init(
    one: String,
    few: String? = nil,
    other: String,
    obliqueOne: String? = nil,
    obliqueFew: String? = nil,
    obliqueOther: String? = nil
  ) {
    self.one = one
    self.few = few ?? other
    self.other = other
    self.obliqueOne = obliqueOne ?? one
    self.obliqueFew = obliqueFew ?? few ?? other
    self.obliqueOther = obliqueOther ?? other
  }

  func template(for form: ConPawsPluralForm, oblique: Bool) -> String {
    switch form {
    case .one: oblique ? obliqueOne : one
    case .few: oblique ? obliqueFew : few
    case .other: oblique ? obliqueOther : other
    }
  }
}

/// Every word these targets render, in the app's language rather than the
/// phone's.
///
/// This is a Swift table, not a `.strings` or `.xcstrings` resource, for two
/// reasons that both have to hold before resources would be an option:
///
/// - `@bacons/apple-targets` generates the Xcode project and has no
///   localization support at all. It writes no variant groups and no
///   `knownRegions`, and the project it produces is regenerated by prebuild, so
///   nothing checked in here can add a region to it.
/// - A widget or complication resolves `NSLocalizedString` against the *device*
///   language through `Bundle.main`. ConPaws' language is an in-app setting
///   that need not match the device, and it travels here as the snapshot's
///   `localeIdentifier`. Even with resources in place, rendering the app's
///   language would mean loading a specific `.lproj` bundle by that identifier
///   by hand -- which is this table, with a silent-fallback failure mode added.
///
/// The strings the *system* renders -- the widget gallery entry, the
/// configuration intent, `CFBundleDisplayName` -- are deliberately not here.
/// Those follow the device language by design and do need real resources.
struct ConPawsStrings: Sendable {
  let language: ConPawsLanguage

  // MARK: Countdown vocabulary

  let now: String
  let startingSoon: String
  let today: String
  let tomorrow: String
  /// Wraps a duration into a countdown, as in "In 3 hours".
  let inFormat: String
  let hoursUnit: ConPawsPluralUnit
  let daysUnit: ConPawsPluralUnit
  let monthsUnit: ConPawsPluralUnit
  let minutesUnit: ConPawsPluralUnit
  let eventsUnit: ConPawsPluralUnit
  let compactNow: String
  let compactSoon: String
  let compactHoursFormat: String
  let compactDaysFormat: String
  let compactMonthsFormat: String
  /// Wraps a duration for VoiceOver, as in "3 days, 4 hours remaining".
  let remainingFormat: String

  // MARK: Eyebrows, already in the case they are drawn in

  let comingUpCaps: String
  let startsInCaps: String

  // MARK: iPhone widget
  let startsIn: String
  let addConventionHint: String
  let startsForA11yFormat: String
  let nextA11yFormat: String
  let inlineStartsFormat: String
  /// Whether the countdown reads correctly lower-cased mid-sentence.
  ///
  /// False for German, where "In 3 Stunden" carries a capitalised noun that
  /// lower-casing would break. German phrases its inline leave line around a
  /// colon instead, so the countdown can keep its own capitals.
  let lowercasesInlineCountdown: Bool

  // MARK: Watch complication

  let syncFromPhone: String
  let comingUpA11yFormat: String
  let startsWithCurrentA11yFormat: String
  let startsA11yFormat: String
  let nextEventA11yFormat: String

  // MARK: Watch app

  let noScheduleTitle: String
  let noScheduleMessage: String
  let nothingUpcomingTitle: String
  let nothingUpcomingMessage: String
  let untilTheConvention: String
  let comingUpTitle: String
  let scheduleTitle: String
  let eventTitle: String
  let laterLabel: String
  let scheduledLabel: String
  let finishedComplication: String
  let noEventsTodayTitle: String
  let noEventsTodayMessage: String
  let minutesBeforeFormat: String

  // MARK: Widget redesign (2026-08)

  /// Whole minutes, as the leave countdown renders them: "18 min".
  let compactMinutesFormat: String
  /// Follows "Now · " on the running event's chip, as in "Now · ends 1:00 AM".
  let endsFormat: String
  /// The large widget's overflow footer, as in "+3 more today".
  let moreTodayFormat: String
  /// The pre-con footer, wrapping an already-pluralized "%@ events".
  let starredFormat: String
  let allDoneTitle: String
  /// "First event tomorrow: %1$@, %2$@." — title, then clock time.
  let firstTomorrowFormat: String
  /// The empty state's call to action when a convention exists but nothing
  /// is starred.
  let starHint: String
  let upNextCaps: String
  let happeningNowCaps: String
  let untilCapsFormat: String
  let reminderAtFormat: String
  let noLaterSavedEvents: String
  let noLaterSavedEventsShort: String
  let noPicksTitle: String
  let noPicksHint: String
  let noPicksWatchMessage: String
  let noPicksComplication: String
  let finishedTitle: String
  let finishedHint: String
  let lastEndedFormat: String
  let noConventionTitle: String
  let noConventionHint: String
  let noConventionComplication: String
  let openOnIphone: String
  let noConventionWatchMessage: String
  let planLastUpdatedFormat: String
  let lastUpdatedFormat: String
  let staleHint: String
  let staleHintShort: String
  let staleA11yFormat: String
}

// MARK: - Substitution

extension ConPawsStrings {
  /// The table for a snapshot's `localeIdentifier`.
  static func resolve(_ localeIdentifier: String) -> ConPawsStrings {
    table(for: ConPawsLanguage.resolve(localeIdentifier))
  }

  /// English, for previews and for the debug self-checks that assert on exact
  /// wording. Reading the device's language there would fail the assertions on
  /// a German Mac for the wrong reason.
  static let english = table(for: .en)

  private func substituting(_ template: String, _ arguments: [String]) -> String {
    String(format: template, arguments: arguments.map { $0 as CVarArg })
  }

  func text(_ template: String, _ arguments: String...) -> String {
    substituting(template, arguments)
  }

  private func count(
    _ unit: ConPawsPluralUnit,
    _ value: Int,
    oblique: Bool = false
  ) -> String {
    let template = unit.template(for: language.pluralForm(value), oblique: oblique)
    return substituting(template, [String(value)])
  }

  func hours(_ value: Int) -> String { count(hoursUnit, value) }
  func days(_ value: Int) -> String { count(daysUnit, value) }
  func months(_ value: Int) -> String { count(monthsUnit, value) }
  func minutes(_ value: Int) -> String { count(minutesUnit, value) }
  func events(_ value: Int) -> String { count(eventsUnit, value) }

  func inHours(_ value: Int) -> String {
    text(inFormat, count(hoursUnit, value, oblique: true))
  }

  func inDays(_ value: Int) -> String {
    text(inFormat, count(daysUnit, value, oblique: true))
  }

  func inMonths(_ value: Int) -> String {
    text(inFormat, count(monthsUnit, value, oblique: true))
  }

  func compactHours(_ value: Int) -> String { text(compactHoursFormat, String(value)) }
  func compactDays(_ value: Int) -> String { text(compactDaysFormat, String(value)) }
  func compactMonths(_ value: Int) -> String { text(compactMonthsFormat, String(value)) }

  /// Two units side by side, as VoiceOver reads a countdown.
  func duration(_ first: String, _ second: String) -> String {
    "\(first), \(second)"
  }

  /// The same pair, phrased as time left.
  func remaining(_ duration: String) -> String {
    text(remainingFormat, duration)
  }

  /// A countdown placed inside a sentence, cased so it still reads as one.
  func midSentenceCountdown(_ label: String) -> String {
    lowercasesInlineCountdown ? label.lowercased() : label
  }

  func compactMinutes(_ value: Int) -> String { text(compactMinutesFormat, String(value)) }
  func minutesBefore(_ value: Int) -> String { text(minutesBeforeFormat, minutes(value)) }
  func reminderAt(_ time: String, minutes: Int) -> String {
    text(reminderAtFormat, time, minutesBefore(minutes))
  }
  func moreToday(_ value: Int) -> String { text(moreTodayFormat, String(value)) }
  func starred(_ count: Int) -> String { text(starredFormat, events(count)) }
  func ends(_ time: String) -> String { text(endsFormat, time) }
  func firstTomorrow(_ title: String, _ time: String) -> String {
    text(firstTomorrowFormat, title, time)
  }
}

// MARK: - Translations

extension ConPawsStrings {
  static func table(for language: ConPawsLanguage) -> ConPawsStrings {
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

  private static let en = ConPawsStrings(
    language: .en,
    now: "Now",
    startingSoon: "Starting soon",
    today: "Today",
    tomorrow: "Tomorrow",
    inFormat: "In %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ hour", other: "%@ hours"),
    daysUnit: ConPawsPluralUnit(one: "%@ day", other: "%@ days"),
    monthsUnit: ConPawsPluralUnit(one: "%@ month", other: "%@ months"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minute", other: "%@ minutes"),
    eventsUnit: ConPawsPluralUnit(one: "%@ event", other: "%@ events"),
    compactNow: "Now",
    compactSoon: "Soon",
    compactHoursFormat: "%@h",
    compactDaysFormat: "%@d",
    compactMonthsFormat: "%@mo",
    remainingFormat: "%@ remaining",
    comingUpCaps: "COMING UP",
    startsInCaps: "STARTS IN",
    startsIn: "Starts in",
    addConventionHint: "Add a convention in ConPaws.",
    startsForA11yFormat: "Starts at %2$@ for %1$@",
    nextA11yFormat: "Next: %1$@, %2$@",
    inlineStartsFormat: "Starts %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sync a convention from iPhone",
    comingUpA11yFormat: "Coming up, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Starts in %1$@. Happening now: %2$@. Up next: %3$@, starts %4$@.",
    startsA11yFormat: "Starts in %1$@ for %2$@, at %3$@.",
    nextEventA11yFormat: "Next event: %1$@, starts %2$@",
    noScheduleTitle: "No schedule yet",
    noScheduleMessage: "Open ConPaws on your iPhone to sync a convention.",
    nothingUpcomingTitle: "Nothing upcoming",
    nothingUpcomingMessage: "Your saved conventions have ended.",
    untilTheConvention: "Until the convention",
    comingUpTitle: "Coming Up",
    scheduleTitle: "Schedule",
    eventTitle: "Event",
    laterLabel: "Later",
    scheduledLabel: "Scheduled",
    finishedComplication: "No more panels today",
    noEventsTodayTitle: "No events today",
    noEventsTodayMessage: "No saved events are scheduled for today.",
    minutesBeforeFormat: "%@ before",
    compactMinutesFormat: "%@ min",
    endsFormat: "ends %@",
    moreTodayFormat: "+%@ more today",
    starredFormat: "%@ starred",
    allDoneTitle: "All done for today",
    firstTomorrowFormat: "First event tomorrow: %1$@, %2$@.",
    starHint: "Star events in ConPaws to see them here.",
    upNextCaps: "UP NEXT",
    happeningNowCaps: "HAPPENING NOW",
    untilCapsFormat: "UNTIL %@",
    reminderAtFormat: "Reminder at %1$@ · %2$@",
    noLaterSavedEvents: "No later events in your saved plan",
    noLaterSavedEventsShort: "No later saved events",
    noPicksTitle: "No panels picked",
    noPicksHint: "Choose a panel in ConPaws on your phone",
    noPicksWatchMessage: "Choose panels in ConPaws on your iPhone to see them here.",
    noPicksComplication: "Add panels on iPhone",
    finishedTitle: "All the panels you picked have ended",
    finishedHint: "Browse the schedule in ConPaws to add more.",
    lastEndedFormat: "Your last panel ended at %@",
    noConventionTitle: "Open ConPaws",
    noConventionHint: "Choose a convention to show here.",
    noConventionComplication: "No plan yet",
    openOnIphone: "Open ConPaws on your iPhone",
    noConventionWatchMessage: "Choose a convention there to see your plan here.",
    planLastUpdatedFormat: "Plan last updated here · %@",
    lastUpdatedFormat: "Last updated · %@",
    staleHint: "Open ConPaws to check for changes",
    staleHintShort: "This plan may be out of date",
    staleA11yFormat: "Last updated %@. Open ConPaws to check for changes.",
  )

  private static let de = ConPawsStrings(
    language: .de,
    now: "Jetzt",
    startingSoon: "Beginnt bald",
    today: "Heute",
    tomorrow: "Morgen",
    inFormat: "In %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ Stunde", other: "%@ Stunden"),
    daysUnit: ConPawsPluralUnit(one: "%@ Tag", other: "%@ Tage", obliqueOther: "%@ Tagen"),
    monthsUnit: ConPawsPluralUnit(
      one: "%@ Monat",
      other: "%@ Monate",
      obliqueOther: "%@ Monaten"
    ),
    minutesUnit: ConPawsPluralUnit(one: "%@ Minute", other: "%@ Minuten"),
    eventsUnit: ConPawsPluralUnit(one: "%@ Event", other: "%@ Events"),
    compactNow: "Jetzt",
    compactSoon: "Bald",
    compactHoursFormat: "%@ Std.",
    compactDaysFormat: "%@ T",
    compactMonthsFormat: "%@ Mon.",
    remainingFormat: "noch %@",
    comingUpCaps: "DEMNÄCHST",
    startsInCaps: "BEGINNT IN",
    startsIn: "Beginnt in",
    addConventionHint: "Füge in ConPaws eine Convention hinzu.",
    startsForA11yFormat: "Beginnt um %2$@ für %1$@",
    nextA11yFormat: "Als Nächstes: %1$@, %2$@",
    inlineStartsFormat: "Beginnt %@",
    lowercasesInlineCountdown: false,
    syncFromPhone: "Convention vom iPhone synchronisieren",
    comingUpA11yFormat: "Demnächst, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Beginnt in %1$@. Gerade läuft: %2$@. Als Nächstes: %3$@, beginnt %4$@.",
    startsA11yFormat: "Beginnt in %1$@ für %2$@, um %3$@.",
    nextEventA11yFormat: "Nächstes Event: %1$@, beginnt %2$@",
    noScheduleTitle: "Noch kein Zeitplan",
    noScheduleMessage: "Öffne ConPaws auf deinem iPhone, um eine Convention zu synchronisieren.",
    nothingUpcomingTitle: "Nichts geplant",
    nothingUpcomingMessage: "Deine gespeicherten Conventions sind vorbei.",
    untilTheConvention: "Bis zur Convention",
    comingUpTitle: "Demnächst",
    scheduleTitle: "Zeitplan",
    eventTitle: "Event",
    laterLabel: "Später",
    scheduledLabel: "Geplant",
    finishedComplication: "Heute keine Panels mehr",
    noEventsTodayTitle: "Heute keine Events",
    noEventsTodayMessage: "Für heute sind keine gespeicherten Veranstaltungen geplant.",
    minutesBeforeFormat: "%@ vorher",
    compactMinutesFormat: "%@ Min.",
    endsFormat: "bis %@",
    moreTodayFormat: "+%@ weitere heute",
    starredFormat: "%@ vorgemerkt",
    allDoneTitle: "Für heute alles geschafft",
    firstTomorrowFormat: "Erstes Event morgen: %1$@, %2$@.",
    starHint: "Markiere Events in ConPaws, um sie hier zu sehen.",
    upNextCaps: "ALS NÄCHSTES",
    happeningNowCaps: "GERADE LÄUFT",
    untilCapsFormat: "BIS %@",
    reminderAtFormat: "Erinnerung um %1$@ · %2$@",
    noLaterSavedEvents: "Keine späteren Events in deinem gespeicherten Plan",
    noLaterSavedEventsShort: "Keine späteren gespeicherten Events",
    noPicksTitle: "Keine Panels ausgewählt",
    noPicksHint: "Wähle ein Panel in ConPaws auf deinem Smartphone",
    noPicksWatchMessage: "Wähle Panels in ConPaws auf deinem iPhone aus, um sie hier zu sehen.",
    noPicksComplication: "Panels auf dem iPhone hinzufügen",
    finishedTitle: "Alle ausgewählten Panels sind vorbei",
    finishedHint: "Durchsuche den Plan in ConPaws, um weitere hinzuzufügen.",
    lastEndedFormat: "Dein letztes Panel endete um %@",
    noConventionTitle: "ConPaws öffnen",
    noConventionHint: "Wähle eine Convention aus, die hier angezeigt werden soll.",
    noConventionComplication: "Noch kein Plan",
    openOnIphone: "ConPaws auf dem iPhone öffnen",
    noConventionWatchMessage: "Wähle dort eine Convention aus, um deinen Plan hier zu sehen.",
    planLastUpdatedFormat: "Plan hier zuletzt aktualisiert · %@",
    lastUpdatedFormat: "Zuletzt aktualisiert · %@",
    staleHint: "Öffne ConPaws, um nach Änderungen zu sehen",
    staleHintShort: "Dieser Plan ist möglicherweise nicht aktuell",
    staleA11yFormat: "Zuletzt aktualisiert %@. Öffne ConPaws, um nach Änderungen zu sehen.",
  )

  private static let esES = ConPawsStrings(
    language: .esES,
    now: "Ahora",
    startingSoon: "Empieza pronto",
    today: "Hoy",
    tomorrow: "Mañana",
    inFormat: "En %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ hora", other: "%@ horas"),
    daysUnit: ConPawsPluralUnit(one: "%@ día", other: "%@ días"),
    monthsUnit: ConPawsPluralUnit(one: "%@ mes", other: "%@ meses"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minuto", other: "%@ minutos"),
    eventsUnit: ConPawsPluralUnit(one: "%@ evento", other: "%@ eventos"),
    compactNow: "Ahora",
    compactSoon: "Pronto",
    compactHoursFormat: "%@ h",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ m",
    remainingFormat: "faltan %@",
    comingUpCaps: "PRÓXIMAMENTE",
    startsInCaps: "EMPIEZA EN",
    startsIn: "Empieza en",
    addConventionHint: "Añade una convención en ConPaws.",
    startsForA11yFormat: "Empieza a las %2$@ para %1$@",
    nextA11yFormat: "Siguiente: %1$@, %2$@",
    inlineStartsFormat: "Empieza %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincroniza una convención desde el iPhone",
    comingUpA11yFormat: "Próximamente, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Empieza en %1$@. En curso: %2$@. A continuación: %3$@, empieza %4$@.",
    startsA11yFormat: "Empieza en %1$@ para %2$@, a las %3$@.",
    nextEventA11yFormat: "Próximo evento: %1$@, empieza %2$@",
    noScheduleTitle: "Aún sin horario",
    noScheduleMessage: "Abre ConPaws en tu iPhone para sincronizar una convención.",
    nothingUpcomingTitle: "Nada próximo",
    nothingUpcomingMessage: "Tus convenciones guardadas han terminado.",
    untilTheConvention: "Hasta la convención",
    comingUpTitle: "Próximamente",
    scheduleTitle: "Horario",
    eventTitle: "Evento",
    laterLabel: "Más tarde",
    scheduledLabel: "Programado",
    finishedComplication: "Hoy no hay más paneles",
    noEventsTodayTitle: "Sin eventos hoy",
    noEventsTodayMessage: "No tienes eventos guardados para hoy.",
    minutesBeforeFormat: "%@ antes",
    compactMinutesFormat: "%@ min",
    endsFormat: "hasta %@",
    moreTodayFormat: "+%@ más hoy",
    starredFormat: "%@ guardados",
    allDoneTitle: "Todo listo por hoy",
    firstTomorrowFormat: "Primer evento mañana: %1$@, %2$@.",
    starHint: "Marca eventos en ConPaws para verlos aquí.",
    upNextCaps: "SIGUIENTE",
    happeningNowCaps: "EN CURSO",
    untilCapsFormat: "HASTA %@",
    reminderAtFormat: "Aviso a las %1$@ · %2$@",
    noLaterSavedEvents: "No hay más actividades en tu plan guardado",
    noLaterSavedEventsShort: "No hay más actividades guardadas",
    noPicksTitle: "No has elegido ningún panel",
    noPicksHint: "Elige un panel en ConPaws desde tu teléfono",
    noPicksWatchMessage: "Elige paneles en ConPaws en tu iPhone para verlos aquí.",
    noPicksComplication: "Añadir paneles en el iPhone",
    finishedTitle: "Han terminado todos los paneles que elegiste",
    finishedHint: "Consulta el programa en ConPaws para añadir más.",
    lastEndedFormat: "Tu último panel terminó a las %@",
    noConventionTitle: "Abrir ConPaws",
    noConventionHint: "Elige una convención para mostrarla aquí.",
    noConventionComplication: "Aún no hay plan",
    openOnIphone: "Abrir ConPaws en el iPhone",
    noConventionWatchMessage: "Elige allí una convención para ver tu plan aquí.",
    planLastUpdatedFormat: "Plan actualizado aquí por última vez · %@",
    lastUpdatedFormat: "Actualizado por última vez · %@",
    staleHint: "Abre ConPaws para comprobar si hay cambios",
    staleHintShort: "Puede que este plan esté desactualizado",
    staleA11yFormat: "Última actualización %@. Abre ConPaws para comprobar si hay cambios.",
  )

  private static let fr = ConPawsStrings(
    language: .fr,
    now: "Maintenant",
    startingSoon: "Commence bientôt",
    today: "Aujourd’hui",
    tomorrow: "Demain",
    inFormat: "Dans %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ heure", other: "%@ heures"),
    daysUnit: ConPawsPluralUnit(one: "%@ jour", other: "%@ jours"),
    monthsUnit: ConPawsPluralUnit(one: "%@ mois", other: "%@ mois"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minute", other: "%@ minutes"),
    eventsUnit: ConPawsPluralUnit(one: "%@ événement", other: "%@ événements"),
    compactNow: "Maint.",
    compactSoon: "Bientôt",
    compactHoursFormat: "%@ h",
    compactDaysFormat: "%@ j",
    compactMonthsFormat: "%@ mois",
    remainingFormat: "%@ restants",
    comingUpCaps: "À VENIR",
    startsInCaps: "COMMENCE DANS",
    startsIn: "Commence dans",
    addConventionHint: "Ajoutez une convention dans ConPaws.",
    startsForA11yFormat: "Commence à %2$@ pour %1$@",
    nextA11yFormat: "Suivant : %1$@, %2$@",
    inlineStartsFormat: "Commence %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synchronisez une convention depuis l’iPhone",
    comingUpA11yFormat: "À venir, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Commence dans %1$@. En cours : %2$@. Ensuite : %3$@, commence à %4$@.",
    startsA11yFormat: "Commence dans %1$@ pour %2$@, à %3$@.",
    nextEventA11yFormat: "Prochain événement : %1$@, commence %2$@",
    noScheduleTitle: "Pas encore de programme",
    noScheduleMessage: "Ouvrez ConPaws sur votre iPhone pour synchroniser une convention.",
    nothingUpcomingTitle: "Rien à venir",
    nothingUpcomingMessage: "Vos conventions enregistrées sont terminées.",
    untilTheConvention: "Avant la convention",
    comingUpTitle: "À venir",
    scheduleTitle: "Programme",
    eventTitle: "Événement",
    laterLabel: "Plus tard",
    scheduledLabel: "Programmé",
    finishedComplication: "Plus de panels aujourd’hui",
    noEventsTodayTitle: "Aucun événement aujourd’hui",
    noEventsTodayMessage: "Aucun événement enregistré n’est prévu aujourd’hui.",
    minutesBeforeFormat: "%@ avant",
    compactMinutesFormat: "%@ min",
    endsFormat: "jusqu’à %@",
    moreTodayFormat: "+%@ autres aujourd’hui",
    starredFormat: "%@ enregistrés",
    allDoneTitle: "Terminé pour aujourd’hui",
    firstTomorrowFormat: "Premier événement demain : %1$@, %2$@.",
    starHint: "Suivez des événements dans ConPaws pour les voir ici.",
    upNextCaps: "À SUIVRE",
    happeningNowCaps: "EN COURS",
    untilCapsFormat: "JUSQU’À %@",
    reminderAtFormat: "Rappel à %1$@ · %2$@",
    noLaterSavedEvents: "Aucun autre événement dans ton programme enregistré",
    noLaterSavedEventsShort: "Aucun autre événement enregistré",
    noPicksTitle: "Aucun panel choisi",
    noPicksHint: "Choisis un panel dans ConPaws sur ton téléphone",
    noPicksWatchMessage: "Choisis des panels dans ConPaws sur ton iPhone pour les voir ici.",
    noPicksComplication: "Ajouter des panels sur iPhone",
    finishedTitle: "Tous les panels choisis sont terminés",
    finishedHint: "Parcours le programme dans ConPaws pour en ajouter.",
    lastEndedFormat: "Ton dernier panel s’est terminé à %@",
    noConventionTitle: "Ouvrir ConPaws",
    noConventionHint: "Choisis une convention à afficher ici.",
    noConventionComplication: "Aucun programme",
    openOnIphone: "Ouvrir ConPaws sur iPhone",
    noConventionWatchMessage: "Choisis-y une convention pour afficher ton programme ici.",
    planLastUpdatedFormat: "Programme mis à jour ici · %@",
    lastUpdatedFormat: "Mis à jour · %@",
    staleHint: "Ouvre ConPaws pour vérifier les changements",
    staleHintShort: "Ce programme n’est peut-être plus à jour",
    staleA11yFormat: "Dernière mise à jour %@. Ouvre ConPaws pour vérifier les changements.",
  )

  private static let nl = ConPawsStrings(
    language: .nl,
    now: "Nu",
    startingSoon: "Begint binnenkort",
    today: "Vandaag",
    tomorrow: "Morgen",
    inFormat: "Over %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ uur", other: "%@ uur"),
    daysUnit: ConPawsPluralUnit(one: "%@ dag", other: "%@ dagen"),
    monthsUnit: ConPawsPluralUnit(one: "%@ maand", other: "%@ maanden"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minuut", other: "%@ minuten"),
    eventsUnit: ConPawsPluralUnit(one: "%@ evenement", other: "%@ evenementen"),
    compactNow: "Nu",
    compactSoon: "Zo",
    compactHoursFormat: "%@ u",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ mnd",
    remainingFormat: "nog %@",
    comingUpCaps: "BINNENKORT",
    startsInCaps: "BEGINT OVER",
    startsIn: "Begint over",
    addConventionHint: "Voeg een conventie toe in ConPaws.",
    startsForA11yFormat: "Begint om %2$@ voor %1$@",
    nextA11yFormat: "Volgende: %1$@, %2$@",
    inlineStartsFormat: "Begint %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synchroniseer een conventie vanaf je iPhone",
    comingUpA11yFormat: "Binnenkort, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Begint over %1$@. Nu bezig: %2$@. Hierna: %3$@, begint om %4$@.",
    startsA11yFormat: "Begint over %1$@ voor %2$@, om %3$@.",
    nextEventA11yFormat: "Volgend evenement: %1$@, begint %2$@",
    noScheduleTitle: "Nog geen rooster",
    noScheduleMessage: "Open ConPaws op je iPhone om een conventie te synchroniseren.",
    nothingUpcomingTitle: "Niets aankomends",
    nothingUpcomingMessage: "Je opgeslagen conventies zijn afgelopen.",
    untilTheConvention: "Tot de conventie",
    comingUpTitle: "Binnenkort",
    scheduleTitle: "Rooster",
    eventTitle: "Evenement",
    laterLabel: "Later",
    scheduledLabel: "Gepland",
    finishedComplication: "Vandaag geen panels meer",
    noEventsTodayTitle: "Geen evenementen vandaag",
    noEventsTodayMessage: "Er zijn vandaag geen evenementen opgeslagen.",
    minutesBeforeFormat: "%@ geleden",
    compactMinutesFormat: "%@ min",
    endsFormat: "tot %@",
    moreTodayFormat: "+%@ meer vandaag",
    starredFormat: "%@ opgeslagen",
    allDoneTitle: "Klaar voor vandaag",
    firstTomorrowFormat: "Eerste evenement morgen: %1$@, %2$@.",
    starHint: "Markeer evenementen in ConPaws om ze hier te zien.",
    upNextCaps: "HIERNA",
    happeningNowCaps: "NU BEZIG",
    untilCapsFormat: "TOT %@",
    reminderAtFormat: "Herinnering om %1$@ · %2$@",
    noLaterSavedEvents: "Geen latere evenementen in je opgeslagen schema",
    noLaterSavedEventsShort: "Geen latere opgeslagen evenementen",
    noPicksTitle: "Geen panels gekozen",
    noPicksHint: "Kies een panel in ConPaws op je telefoon",
    noPicksWatchMessage: "Kies panels in ConPaws op je iPhone om ze hier te zien.",
    noPicksComplication: "Panels toevoegen op iPhone",
    finishedTitle: "Alle gekozen panels zijn afgelopen",
    finishedHint: "Bekijk het programma in ConPaws om meer toe te voegen.",
    lastEndedFormat: "Je laatste panel eindigde om %@",
    noConventionTitle: "Open ConPaws",
    noConventionHint: "Kies een conventie om hier te tonen.",
    noConventionComplication: "Nog geen schema",
    openOnIphone: "Open ConPaws op iPhone",
    noConventionWatchMessage: "Kies daar een conventie om je schema hier te zien.",
    planLastUpdatedFormat: "Schema hier voor het laatst bijgewerkt · %@",
    lastUpdatedFormat: "Laatst bijgewerkt · %@",
    staleHint: "Open ConPaws om wijzigingen te controleren",
    staleHintShort: "Dit schema is mogelijk verouderd",
    staleA11yFormat: "Laatst bijgewerkt %@. Open ConPaws om wijzigingen te controleren.",
  )

  private static let pl = ConPawsStrings(
    language: .pl,
    now: "Teraz",
    startingSoon: "Zaczyna się wkrótce",
    today: "Dzisiaj",
    tomorrow: "Jutro",
    inFormat: "Za %@",
    hoursUnit: ConPawsPluralUnit(
      one: "%@ godzina",
      few: "%@ godziny",
      other: "%@ godzin",
      obliqueOne: "%@ godzinę"
    ),
    daysUnit: ConPawsPluralUnit(one: "%@ dzień", few: "%@ dni", other: "%@ dni"),
    monthsUnit: ConPawsPluralUnit(one: "%@ miesiąc", few: "%@ miesiące", other: "%@ miesięcy"),
    minutesUnit: ConPawsPluralUnit(
      one: "%@ minuta",
      few: "%@ minuty",
      other: "%@ minut",
      obliqueOne: "%@ minutę"
    ),
    eventsUnit: ConPawsPluralUnit(one: "%@ wydarzenie", few: "%@ wydarzenia", other: "%@ wydarzeń"),
    compactNow: "Teraz",
    compactSoon: "Wkrótce",
    compactHoursFormat: "%@ godz.",
    compactDaysFormat: "%@ dn.",
    compactMonthsFormat: "%@ mies.",
    remainingFormat: "pozostało %@",
    comingUpCaps: "WKRÓTCE",
    startsInCaps: "ZACZYNA SIĘ ZA",
    startsIn: "Zaczyna się za",
    addConventionHint: "Dodaj konwent w ConPaws.",
    startsForA11yFormat: "Zaczyna się o %2$@ dla %1$@",
    nextA11yFormat: "Następne: %1$@, %2$@",
    inlineStartsFormat: "Zaczyna się %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Zsynchronizuj konwent z iPhone’a",
    comingUpA11yFormat: "Wkrótce, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Zaczyna się za %1$@. Teraz trwa: %2$@. Następnie: %3$@, zaczyna się %4$@.",
    startsA11yFormat: "Zaczyna się za %1$@ dla %2$@, o %3$@.",
    nextEventA11yFormat: "Następne wydarzenie: %1$@, zaczyna się %2$@",
    noScheduleTitle: "Brak harmonogramu",
    noScheduleMessage: "Otwórz ConPaws na iPhonie, aby zsynchronizować konwent.",
    nothingUpcomingTitle: "Nic nadchodzącego",
    nothingUpcomingMessage: "Twoje zapisane konwenty się zakończyły.",
    untilTheConvention: "Do konwentu",
    comingUpTitle: "Wkrótce",
    scheduleTitle: "Harmonogram",
    eventTitle: "Wydarzenie",
    laterLabel: "Później",
    scheduledLabel: "Zaplanowane",
    finishedComplication: "Na dziś koniec paneli",
    noEventsTodayTitle: "Brak wydarzeń dzisiaj",
    noEventsTodayMessage: "Na dziś nie masz zapisanych wydarzeń.",
    minutesBeforeFormat: "%@ wcześniej",
    compactMinutesFormat: "%@ min",
    endsFormat: "do %@",
    moreTodayFormat: "+%@ więcej dzisiaj",
    starredFormat: "Zapisane: %@",
    allDoneTitle: "Na dzisiaj to wszystko",
    firstTomorrowFormat: "Pierwsze wydarzenie jutro: %1$@, %2$@.",
    starHint: "Oznacz wydarzenia w ConPaws, aby zobaczyć je tutaj.",
    upNextCaps: "NASTĘPNIE",
    happeningNowCaps: "W TRAKCIE",
    untilCapsFormat: "DO %@",
    reminderAtFormat: "Przypomnienie o %1$@ · %2$@",
    noLaterSavedEvents: "Brak późniejszych wydarzeń w zapisanym planie",
    noLaterSavedEventsShort: "Brak późniejszych zapisanych wydarzeń",
    noPicksTitle: "Nie wybrano paneli",
    noPicksHint: "Wybierz panel w ConPaws na telefonie",
    noPicksWatchMessage: "Wybierz panele w ConPaws na iPhonie, aby zobaczyć je tutaj.",
    noPicksComplication: "Dodaj panele na iPhonie",
    finishedTitle: "Wszystkie wybrane panele już się skończyły",
    finishedHint: "Przejrzyj program w ConPaws, aby dodać kolejne.",
    lastEndedFormat: "Ostatni panel skończył się o %@",
    noConventionTitle: "Otwórz ConPaws",
    noConventionHint: "Wybierz konwent, który ma się tu wyświetlać.",
    noConventionComplication: "Brak planu",
    openOnIphone: "Otwórz ConPaws na iPhonie",
    noConventionWatchMessage: "Wybierz tam konwent, aby zobaczyć tu swój plan.",
    planLastUpdatedFormat: "Plan ostatnio zaktualizowano tutaj · %@",
    lastUpdatedFormat: "Ostatnia aktualizacja · %@",
    staleHint: "Otwórz ConPaws, aby sprawdzić zmiany",
    staleHintShort: "Plan może być nieaktualny",
    staleA11yFormat: "Ostatnia aktualizacja %@. Otwórz ConPaws, aby sprawdzić zmiany.",
  )

  private static let ptBR = ConPawsStrings(
    language: .ptBR,
    now: "Agora",
    startingSoon: "Começa em breve",
    today: "Hoje",
    tomorrow: "Amanhã",
    inFormat: "Em %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ hora", other: "%@ horas"),
    daysUnit: ConPawsPluralUnit(one: "%@ dia", other: "%@ dias"),
    monthsUnit: ConPawsPluralUnit(one: "%@ mês", other: "%@ meses"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minuto", other: "%@ minutos"),
    eventsUnit: ConPawsPluralUnit(one: "%@ evento", other: "%@ eventos"),
    compactNow: "Agora",
    compactSoon: "Em breve",
    compactHoursFormat: "%@ h",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ m",
    remainingFormat: "faltam %@",
    comingUpCaps: "EM BREVE",
    startsInCaps: "COMEÇA EM",
    startsIn: "Começa em",
    addConventionHint: "Adicione uma convenção no ConPaws.",
    startsForA11yFormat: "Começa às %2$@ para %1$@",
    nextA11yFormat: "A seguir: %1$@, %2$@",
    inlineStartsFormat: "Começa %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincronize uma convenção do iPhone",
    comingUpA11yFormat: "Em breve, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Começa em %1$@. Acontecendo agora: %2$@. A seguir: %3$@, começa às %4$@.",
    startsA11yFormat: "Começa em %1$@ para %2$@, às %3$@.",
    nextEventA11yFormat: "Próximo evento: %1$@, começa %2$@",
    noScheduleTitle: "Ainda sem programação",
    noScheduleMessage: "Abra o ConPaws no seu iPhone para sincronizar uma convenção.",
    nothingUpcomingTitle: "Nada a seguir",
    nothingUpcomingMessage: "Suas convenções salvas terminaram.",
    untilTheConvention: "Até a convenção",
    comingUpTitle: "Em breve",
    scheduleTitle: "Programação",
    eventTitle: "Evento",
    laterLabel: "Mais tarde",
    scheduledLabel: "Agendado",
    finishedComplication: "Não há mais painéis hoje",
    noEventsTodayTitle: "Nenhum evento hoje",
    noEventsTodayMessage: "Você não tem eventos salvos para hoje.",
    minutesBeforeFormat: "%@ antes",
    compactMinutesFormat: "%@ min",
    endsFormat: "até %@",
    moreTodayFormat: "+%@ mais hoje",
    starredFormat: "%@ salvos",
    allDoneTitle: "Tudo pronto por hoje",
    firstTomorrowFormat: "Primeiro evento amanhã: %1$@, %2$@.",
    starHint: "Marque eventos no ConPaws para vê-los aqui.",
    upNextCaps: "A SEGUIR",
    happeningNowCaps: "ACONTECENDO AGORA",
    untilCapsFormat: "ATÉ %@",
    reminderAtFormat: "Lembrete às %1$@ · %2$@",
    noLaterSavedEvents: "Não há mais eventos no seu plano salvo",
    noLaterSavedEventsShort: "Não há mais eventos salvos",
    noPicksTitle: "Nenhum painel escolhido",
    noPicksHint: "Escolha um painel no ConPaws do seu celular",
    noPicksWatchMessage: "Escolha painéis no ConPaws do seu iPhone para vê-los aqui.",
    noPicksComplication: "Adicionar painéis no iPhone",
    finishedTitle: "Todos os painéis escolhidos terminaram",
    finishedHint: "Consulte a programação no ConPaws para adicionar mais.",
    lastEndedFormat: "Seu último painel terminou às %@",
    noConventionTitle: "Abrir ConPaws",
    noConventionHint: "Escolha uma convenção para mostrar aqui.",
    noConventionComplication: "Nenhum plano ainda",
    openOnIphone: "Abrir ConPaws no iPhone",
    noConventionWatchMessage: "Escolha uma convenção lá para ver seu plano aqui.",
    planLastUpdatedFormat: "Plano atualizado aqui pela última vez · %@",
    lastUpdatedFormat: "Última atualização · %@",
    staleHint: "Abra o ConPaws para conferir se há mudanças",
    staleHintShort: "Este plano pode estar desatualizado",
    staleA11yFormat: "Última atualização %@. Abra o ConPaws para conferir se há mudanças.",
  )

  private static let sv = ConPawsStrings(
    language: .sv,
    now: "Nu",
    startingSoon: "Börjar snart",
    today: "I dag",
    tomorrow: "I morgon",
    inFormat: "Om %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ timme", other: "%@ timmar"),
    daysUnit: ConPawsPluralUnit(one: "%@ dag", other: "%@ dagar"),
    monthsUnit: ConPawsPluralUnit(one: "%@ månad", other: "%@ månader"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minut", other: "%@ minuter"),
    eventsUnit: ConPawsPluralUnit(one: "%@ evenemang", other: "%@ evenemang"),
    compactNow: "Nu",
    compactSoon: "Snart",
    compactHoursFormat: "%@ tim",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ mån",
    remainingFormat: "%@ kvar",
    comingUpCaps: "KOMMANDE",
    startsInCaps: "BÖRJAR OM",
    startsIn: "Börjar om",
    addConventionHint: "Lägg till ett konvent i ConPaws.",
    startsForA11yFormat: "Börjar kl. %2$@ för %1$@",
    nextA11yFormat: "Härnäst: %1$@, %2$@",
    inlineStartsFormat: "Börjar %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synka ett konvent från iPhone",
    comingUpA11yFormat: "Kommande, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Börjar om %1$@. Pågår nu: %2$@. Härnäst: %3$@, börjar %4$@.",
    startsA11yFormat: "Börjar om %1$@ för %2$@, kl. %3$@.",
    nextEventA11yFormat: "Nästa evenemang: %1$@, börjar %2$@",
    noScheduleTitle: "Inget schema ännu",
    noScheduleMessage: "Öppna ConPaws på din iPhone för att synka ett konvent.",
    nothingUpcomingTitle: "Inget kommande",
    nothingUpcomingMessage: "Dina sparade konvent är slut.",
    untilTheConvention: "Till konventet",
    comingUpTitle: "Kommande",
    scheduleTitle: "Schema",
    eventTitle: "Evenemang",
    laterLabel: "Senare",
    scheduledLabel: "Schemalagt",
    finishedComplication: "Inga fler paneler i dag",
    noEventsTodayTitle: "Inga evenemang i dag",
    noEventsTodayMessage: "Du har inga sparade evenemang för i dag.",
    minutesBeforeFormat: "%@ före",
    compactMinutesFormat: "%@ min",
    endsFormat: "till %@",
    moreTodayFormat: "+%@ till i dag",
    starredFormat: "%@ sparade",
    allDoneTitle: "Klart för i dag",
    firstTomorrowFormat: "Första evenemanget i morgon: %1$@, %2$@.",
    starHint: "Stjärnmärk evenemang i ConPaws för att se dem här.",
    upNextCaps: "NÄST PÅ TUR",
    happeningNowCaps: "PÅGÅR NU",
    untilCapsFormat: "TILL %@",
    reminderAtFormat: "Påminnelse kl. %1$@ · %2$@",
    noLaterSavedEvents: "Inga senare evenemang i din sparade plan",
    noLaterSavedEventsShort: "Inga senare sparade evenemang",
    noPicksTitle: "Inga paneler valda",
    noPicksHint: "Välj en panel i ConPaws på telefonen",
    noPicksWatchMessage: "Välj paneler i ConPaws på din iPhone för att se dem här.",
    noPicksComplication: "Lägg till paneler på iPhone",
    finishedTitle: "Alla paneler du valt har avslutats",
    finishedHint: "Bläddra i schemat i ConPaws för att lägga till fler.",
    lastEndedFormat: "Din senaste panel slutade kl. %@",
    noConventionTitle: "Öppna ConPaws",
    noConventionHint: "Välj ett konvent att visa här.",
    noConventionComplication: "Ingen plan ännu",
    openOnIphone: "Öppna ConPaws på iPhone",
    noConventionWatchMessage: "Välj ett konvent där för att se din plan här.",
    planLastUpdatedFormat: "Planen uppdaterades här senast · %@",
    lastUpdatedFormat: "Uppdaterad senast · %@",
    staleHint: "Öppna ConPaws för att söka efter ändringar",
    staleHintShort: "Planen kan vara inaktuell",
    staleA11yFormat: "Uppdaterad senast %@. Öppna ConPaws för att söka efter ändringar.",
  )

  private static let es419 = ConPawsStrings(
    language: .es419,
    now: "Ahora",
    startingSoon: "Empieza pronto",
    today: "Hoy",
    tomorrow: "Mañana",
    inFormat: "En %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ hora", other: "%@ horas"),
    daysUnit: ConPawsPluralUnit(one: "%@ día", other: "%@ días"),
    monthsUnit: ConPawsPluralUnit(one: "%@ mes", other: "%@ meses"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minuto", other: "%@ minutos"),
    eventsUnit: ConPawsPluralUnit(one: "%@ evento", other: "%@ eventos"),
    compactNow: "Ahora",
    compactSoon: "Pronto",
    compactHoursFormat: "%@ h",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ m",
    remainingFormat: "faltan %@",
    comingUpCaps: "PRÓXIMAMENTE",
    startsInCaps: "EMPIEZA EN",
    startsIn: "Empieza en",
    addConventionHint: "Agrega una convención en ConPaws.",
    startsForA11yFormat: "Empieza a las %2$@ para %1$@",
    nextA11yFormat: "Siguiente: %1$@, %2$@",
    inlineStartsFormat: "Empieza %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincroniza una convención desde el iPhone",
    comingUpA11yFormat: "Próximamente, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Empieza en %1$@. En curso: %2$@. Sigue: %3$@, empieza %4$@.",
    startsA11yFormat: "Empieza en %1$@ para %2$@, a las %3$@.",
    nextEventA11yFormat: "Próximo evento: %1$@, empieza %2$@",
    noScheduleTitle: "Aún sin horario",
    noScheduleMessage: "Abre ConPaws en tu iPhone para sincronizar una convención.",
    nothingUpcomingTitle: "Nada próximo",
    nothingUpcomingMessage: "Tus convenciones guardadas terminaron.",
    untilTheConvention: "Hasta la convención",
    comingUpTitle: "Próximamente",
    scheduleTitle: "Horario",
    eventTitle: "Evento",
    laterLabel: "Más tarde",
    scheduledLabel: "Programado",
    finishedComplication: "Hoy no hay más paneles",
    noEventsTodayTitle: "Sin eventos hoy",
    noEventsTodayMessage: "No tienes eventos guardados para hoy.",
    minutesBeforeFormat: "%@ antes",
    compactMinutesFormat: "%@ min",
    endsFormat: "hasta %@",
    moreTodayFormat: "+%@ más hoy",
    starredFormat: "%@ guardados",
    allDoneTitle: "Todo listo por hoy",
    firstTomorrowFormat: "Primer evento mañana: %1$@, %2$@.",
    starHint: "Marca eventos en ConPaws para verlos aquí.",
    upNextCaps: "SIGUIENTE",
    happeningNowCaps: "EN CURSO",
    untilCapsFormat: "HASTA %@",
    reminderAtFormat: "Recordatorio a las %1$@ · %2$@",
    noLaterSavedEvents: "No hay más actividades en tu plan guardado",
    noLaterSavedEventsShort: "No hay más actividades guardadas",
    noPicksTitle: "No elegiste ningún panel",
    noPicksHint: "Elige un panel en ConPaws desde tu teléfono",
    noPicksWatchMessage: "Elige paneles en ConPaws en tu iPhone para verlos aquí.",
    noPicksComplication: "Agregar paneles en iPhone",
    finishedTitle: "Ya terminaron todos los paneles que elegiste",
    finishedHint: "Explora el programa en ConPaws para agregar más.",
    lastEndedFormat: "Tu último panel terminó a las %@",
    noConventionTitle: "Abrir ConPaws",
    noConventionHint: "Elige una convención para mostrar aquí.",
    noConventionComplication: "Aún no hay plan",
    openOnIphone: "Abrir ConPaws en iPhone",
    noConventionWatchMessage: "Elige una convención allí para ver tu plan aquí.",
    planLastUpdatedFormat: "Plan actualizado aquí por última vez · %@",
    lastUpdatedFormat: "Última actualización · %@",
    staleHint: "Abre ConPaws para revisar si hay cambios",
    staleHintShort: "Puede que este plan esté desactualizado",
    staleA11yFormat: "Última actualización %@. Abre ConPaws para revisar si hay cambios.",
  )

  private static let ptPT = ConPawsStrings(
    language: .ptPT,
    now: "Agora",
    startingSoon: "Começa em breve",
    today: "Hoje",
    tomorrow: "Amanhã",
    inFormat: "Daqui a %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ hora", other: "%@ horas"),
    daysUnit: ConPawsPluralUnit(one: "%@ dia", other: "%@ dias"),
    monthsUnit: ConPawsPluralUnit(one: "%@ mês", other: "%@ meses"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minuto", other: "%@ minutos"),
    eventsUnit: ConPawsPluralUnit(one: "%@ evento", other: "%@ eventos"),
    compactNow: "Agora",
    compactSoon: "Breve",
    compactHoursFormat: "%@ h",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ m",
    remainingFormat: "faltam %@",
    comingUpCaps: "A SEGUIR",
    startsInCaps: "COMEÇA DENTRO DE",
    startsIn: "Começa dentro de",
    addConventionHint: "Adiciona uma convenção no ConPaws.",
    startsForA11yFormat: "Começa às %2$@ para %1$@",
    nextA11yFormat: "Seguinte: %1$@, %2$@",
    inlineStartsFormat: "Começa %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincroniza uma convenção a partir do iPhone",
    comingUpA11yFormat: "A seguir, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Começa dentro de %1$@. A decorrer: %2$@. A seguir: %3$@, começa às %4$@.",
    startsA11yFormat: "Começa dentro de %1$@ para %2$@, às %3$@.",
    nextEventA11yFormat: "Próximo evento: %1$@, começa %2$@",
    noScheduleTitle: "Ainda sem programa",
    noScheduleMessage: "Abre o ConPaws no teu iPhone para sincronizar uma convenção.",
    nothingUpcomingTitle: "Nada próximo",
    nothingUpcomingMessage: "As tuas convenções guardadas terminaram.",
    untilTheConvention: "Até à convenção",
    comingUpTitle: "A seguir",
    scheduleTitle: "Programa",
    eventTitle: "Evento",
    laterLabel: "Mais tarde",
    scheduledLabel: "Agendado",
    finishedComplication: "Hoje não há mais painéis",
    noEventsTodayTitle: "Sem eventos hoje",
    noEventsTodayMessage: "Não tens eventos guardados para hoje.",
    minutesBeforeFormat: "%@ antes",
    compactMinutesFormat: "%@ min",
    endsFormat: "até %@",
    moreTodayFormat: "+%@ hoje",
    starredFormat: "%@ guardados",
    allDoneTitle: "Tudo feito por hoje",
    firstTomorrowFormat: "Primeiro evento amanhã: %1$@, %2$@.",
    starHint: "Marca eventos no ConPaws para os veres aqui.",
    upNextCaps: "A SEGUIR",
    happeningNowCaps: "A DECORRER",
    untilCapsFormat: "ATÉ %@",
    reminderAtFormat: "Lembrete às %1$@ · %2$@",
    noLaterSavedEvents: "Não há mais eventos no teu plano guardado",
    noLaterSavedEventsShort: "Não há mais eventos guardados",
    noPicksTitle: "Não escolheste painéis",
    noPicksHint: "Escolhe um painel no ConPaws do teu telemóvel",
    noPicksWatchMessage: "Escolhe painéis no ConPaws no teu iPhone para os veres aqui.",
    noPicksComplication: "Adicionar painéis no iPhone",
    finishedTitle: "Todos os painéis que escolheste terminaram",
    finishedHint: "Consulta o programa no ConPaws para adicionares mais.",
    lastEndedFormat: "O teu último painel terminou às %@",
    noConventionTitle: "Abrir ConPaws",
    noConventionHint: "Escolhe uma convenção para mostrar aqui.",
    noConventionComplication: "Ainda sem plano",
    openOnIphone: "Abrir ConPaws no iPhone",
    noConventionWatchMessage: "Escolhe lá uma convenção para veres o teu plano aqui.",
    planLastUpdatedFormat: "Plano atualizado aqui pela última vez · %@",
    lastUpdatedFormat: "Última atualização · %@",
    staleHint: "Abre o ConPaws para verificar alterações",
    staleHintShort: "Este plano pode estar desatualizado",
    staleA11yFormat: "Última atualização %@. Abre o ConPaws para verificar alterações.",
  )

  private static let ja = ConPawsStrings(
    language: .ja,
    now: "今",
    startingSoon: "まもなく開始",
    today: "今日",
    tomorrow: "明日",
    inFormat: "%@後",
    hoursUnit: ConPawsPluralUnit(one: "%@時間", other: "%@時間"),
    daysUnit: ConPawsPluralUnit(one: "%@日", other: "%@日"),
    monthsUnit: ConPawsPluralUnit(one: "%@か月", other: "%@か月"),
    minutesUnit: ConPawsPluralUnit(one: "%@分", other: "%@分"),
    eventsUnit: ConPawsPluralUnit(one: "%@件", other: "%@件"),
    compactNow: "今",
    compactSoon: "まもなく",
    compactHoursFormat: "%@時間",
    compactDaysFormat: "%@日",
    compactMonthsFormat: "%@か月",
    remainingFormat: "残り%@",
    comingUpCaps: "この後",
    startsInCaps: "開始まで",
    startsIn: "開始まで",
    addConventionHint: "ConPawsでコンベンションを追加してください。",
    startsForA11yFormat: "%1$@の開始は%2$@",
    nextA11yFormat: "次: %1$@、%2$@",
    inlineStartsFormat: "%@に開始",
    lowercasesInlineCountdown: false,
    syncFromPhone: "iPhoneからコンベンションを同期",
    comingUpA11yFormat: "この後、%1$@、%2$@",
    startsWithCurrentA11yFormat: "%1$@後に開始。現在進行中: %2$@。次は%3$@、開始時刻は%4$@。",
    startsA11yFormat: "%2$@の開始まで%1$@、時刻は%3$@。",
    nextEventA11yFormat: "次のイベント: %1$@、%2$@開始",
    noScheduleTitle: "スケジュールがありません",
    noScheduleMessage: "iPhoneでConPawsを開いてコンベンションを同期してください。",
    nothingUpcomingTitle: "予定なし",
    nothingUpcomingMessage: "保存したコンベンションは終了しました。",
    untilTheConvention: "コンベンションまで",
    comingUpTitle: "この後",
    scheduleTitle: "スケジュール",
    eventTitle: "イベント",
    laterLabel: "この後",
    scheduledLabel: "予定済み",
    finishedComplication: "今日のパネルは終了しました",
    noEventsTodayTitle: "今日の予定なし",
    noEventsTodayMessage: "今日の保存済みイベントはありません。",
    minutesBeforeFormat: "%@前",
    compactMinutesFormat: "%@分",
    endsFormat: "%@まで",
    moreTodayFormat: "他%@件",
    starredFormat: "%@をお気に入り",
    allDoneTitle: "今日はこれで終わりです",
    firstTomorrowFormat: "明日の最初のイベント: %1$@、%2$@。",
    starHint: "ConPawsでイベントをお気に入りに追加すると、ここに表示されます。",
    upNextCaps: "次の予定",
    happeningNowCaps: "開催中",
    untilCapsFormat: "終了 %@",
    reminderAtFormat: "%1$@にリマインダー · %2$@",
    noLaterSavedEvents: "保存した予定にこれ以降のイベントはありません",
    noLaterSavedEventsShort: "保存済みの後続イベントはありません",
    noPicksTitle: "パネルが選択されていません",
    noPicksHint: "スマートフォンのConPawsでパネルを選んでください",
    noPicksWatchMessage: "iPhoneのConPawsでパネルを選ぶと、ここに表示されます。",
    noPicksComplication: "iPhoneでパネルを追加",
    finishedTitle: "選択したパネルはすべて終了しました",
    finishedHint: "ConPawsのスケジュールから追加できます。",
    lastEndedFormat: "最後のパネルは%@に終了しました",
    noConventionTitle: "ConPawsを開く",
    noConventionHint: "ここに表示するコンベンションを選んでください。",
    noConventionComplication: "予定がありません",
    openOnIphone: "iPhoneでConPawsを開く",
    noConventionWatchMessage: "そちらでコンベンションを選ぶと、ここに予定が表示されます。",
    planLastUpdatedFormat: "このプランの最終更新 · %@",
    lastUpdatedFormat: "最終更新 · %@",
    staleHint: "ConPawsを開いて変更を確認",
    staleHintShort: "プランが古い可能性があります",
    staleA11yFormat: "最終更新%@。ConPawsを開いて変更を確認してください。",
  )

  private static let zhTW = ConPawsStrings(
    language: .zhTW,
    now: "現在",
    startingSoon: "即將開始",
    today: "今天",
    tomorrow: "明天",
    inFormat: "%@後",
    hoursUnit: ConPawsPluralUnit(one: "%@ 小時", other: "%@ 小時"),
    daysUnit: ConPawsPluralUnit(one: "%@ 天", other: "%@ 天"),
    monthsUnit: ConPawsPluralUnit(one: "%@ 個月", other: "%@ 個月"),
    minutesUnit: ConPawsPluralUnit(one: "%@ 分鐘", other: "%@ 分鐘"),
    eventsUnit: ConPawsPluralUnit(one: "%@ 個議程", other: "%@ 個議程"),
    compactNow: "現在",
    compactSoon: "即將",
    compactHoursFormat: "%@ 小時",
    compactDaysFormat: "%@ 天",
    compactMonthsFormat: "%@ 個月",
    remainingFormat: "剩餘 %@",
    comingUpCaps: "接下來",
    startsInCaps: "距開始",
    startsIn: "距開始",
    addConventionHint: "在 ConPaws 中新增一場展會。",
    startsForA11yFormat: "%1$@將於%2$@開始",
    nextA11yFormat: "下一個：%1$@，%2$@",
    inlineStartsFormat: "%@開始",
    lowercasesInlineCountdown: false,
    syncFromPhone: "從 iPhone 同步展會",
    comingUpA11yFormat: "接下來，%1$@，%2$@",
    startsWithCurrentA11yFormat: "%1$@後開始。進行中：%2$@。接下來：%3$@，開始時間%4$@。",
    startsA11yFormat: "%2$@將於%1$@後開始，時間為%3$@。",
    nextEventA11yFormat: "下個議程：%1$@，%2$@開始",
    noScheduleTitle: "尚無議程表",
    noScheduleMessage: "在 iPhone 上開啟 ConPaws 以同步展會。",
    nothingUpcomingTitle: "沒有接下來的安排",
    nothingUpcomingMessage: "你儲存的展會都已結束。",
    untilTheConvention: "距離展會",
    comingUpTitle: "接下來",
    scheduleTitle: "議程表",
    eventTitle: "議程",
    laterLabel: "稍後",
    scheduledLabel: "已排定",
    finishedComplication: "今天沒有更多活動",
    noEventsTodayTitle: "今天沒有議程",
    noEventsTodayMessage: "今天沒有已儲存的活動。",
    minutesBeforeFormat: "%@前",
    compactMinutesFormat: "%@ 分鐘",
    endsFormat: "至 %@",
    moreTodayFormat: "今天還有 %@ 個",
    starredFormat: "已收藏 %@",
    allDoneTitle: "今天的行程結束了",
    firstTomorrowFormat: "明天第一個議程：%1$@，%2$@。",
    starHint: "在 ConPaws 中收藏議程，就會顯示在這裡。",
    upNextCaps: "接下來",
    happeningNowCaps: "進行中",
    untilCapsFormat: "直到 %@",
    reminderAtFormat: "%1$@提醒 · %2$@",
    noLaterSavedEvents: "已儲存的計畫沒有後續活動",
    noLaterSavedEventsShort: "沒有其他已儲存活動",
    noPicksTitle: "尚未選擇活動",
    noPicksHint: "在手機上的 ConPaws 選擇一個活動",
    noPicksWatchMessage: "在 iPhone 的 ConPaws 選擇活動，就能在這裡查看。",
    noPicksComplication: "在 iPhone 新增活動",
    finishedTitle: "你選擇的活動都已結束",
    finishedHint: "前往 ConPaws 瀏覽時程並新增活動。",
    lastEndedFormat: "最後一個活動於 %@ 結束",
    noConventionTitle: "開啟 ConPaws",
    noConventionHint: "選擇要在這裡顯示的聚會。",
    noConventionComplication: "尚無計畫",
    openOnIphone: "在 iPhone 開啟 ConPaws",
    noConventionWatchMessage: "在那裡選擇聚會，就能在這裡查看計畫。",
    planLastUpdatedFormat: "計畫最後更新於此 · %@",
    lastUpdatedFormat: "最後更新 · %@",
    staleHint: "開啟 ConPaws 檢查是否有變更",
    staleHintShort: "計畫可能已過時",
    staleA11yFormat: "最後更新於%@。開啟 ConPaws 檢查是否有變更。",
  )

  private static let zhCN = ConPawsStrings(
    language: .zhCN,
    now: "现在",
    startingSoon: "即将开始",
    today: "今天",
    tomorrow: "明天",
    inFormat: "%@后",
    hoursUnit: ConPawsPluralUnit(one: "%@ 小时", other: "%@ 小时"),
    daysUnit: ConPawsPluralUnit(one: "%@ 天", other: "%@ 天"),
    monthsUnit: ConPawsPluralUnit(one: "%@ 个月", other: "%@ 个月"),
    minutesUnit: ConPawsPluralUnit(one: "%@ 分钟", other: "%@ 分钟"),
    eventsUnit: ConPawsPluralUnit(one: "%@ 个活动", other: "%@ 个活动"),
    compactNow: "现在",
    compactSoon: "即将",
    compactHoursFormat: "%@ 小时",
    compactDaysFormat: "%@ 天",
    compactMonthsFormat: "%@ 个月",
    remainingFormat: "剩余 %@",
    comingUpCaps: "接下来",
    startsInCaps: "距离开始",
    startsIn: "距离开始",
    addConventionHint: "在 ConPaws 中添加一场展会。",
    startsForA11yFormat: "%1$@将于%2$@开始",
    nextA11yFormat: "下一个：%1$@，%2$@",
    inlineStartsFormat: "%@开始",
    lowercasesInlineCountdown: false,
    syncFromPhone: "从 iPhone 同步展会",
    comingUpA11yFormat: "接下来，%1$@，%2$@",
    startsWithCurrentA11yFormat: "%1$@后开始。正在进行：%2$@。接下来：%3$@，开始时间%4$@。",
    startsA11yFormat: "%2$@将于%1$@后开始，时间为%3$@。",
    nextEventA11yFormat: "下个活动：%1$@，%2$@开始",
    noScheduleTitle: "还没有日程",
    noScheduleMessage: "在 iPhone 上打开 ConPaws 以同步展会。",
    nothingUpcomingTitle: "没有接下来的安排",
    nothingUpcomingMessage: "你保存的展会都已结束。",
    untilTheConvention: "距离展会",
    comingUpTitle: "接下来",
    scheduleTitle: "日程",
    eventTitle: "活动",
    laterLabel: "稍后",
    scheduledLabel: "已安排",
    finishedComplication: "今天没有更多活动",
    noEventsTodayTitle: "今天没有活动",
    noEventsTodayMessage: "今天没有已保存的活动。",
    minutesBeforeFormat: "%@前",
    compactMinutesFormat: "%@ 分钟",
    endsFormat: "至 %@",
    moreTodayFormat: "今天还有 %@ 个",
    starredFormat: "已收藏 %@",
    allDoneTitle: "今天的行程结束了",
    firstTomorrowFormat: "明天第一个活动：%1$@，%2$@。",
    starHint: "在 ConPaws 中收藏活动，就会显示在这里。",
    upNextCaps: "接下来",
    happeningNowCaps: "进行中",
    untilCapsFormat: "直到 %@",
    reminderAtFormat: "%1$@提醒 · %2$@",
    noLaterSavedEvents: "已保存的计划没有后续活动",
    noLaterSavedEventsShort: "没有其他已保存活动",
    noPicksTitle: "尚未选择活动",
    noPicksHint: "在手机上的 ConPaws 选择一个活动",
    noPicksWatchMessage: "在 iPhone 的 ConPaws 选择活动，即可在这里查看。",
    noPicksComplication: "在 iPhone 添加活动",
    finishedTitle: "你选择的活动都已结束",
    finishedHint: "前往 ConPaws 浏览日程并添加活动。",
    lastEndedFormat: "最后一个活动于 %@ 结束",
    noConventionTitle: "打开 ConPaws",
    noConventionHint: "选择要在这里显示的展会。",
    noConventionComplication: "还没有计划",
    openOnIphone: "在 iPhone 打开 ConPaws",
    noConventionWatchMessage: "在那里选择展会，即可在这里查看计划。",
    planLastUpdatedFormat: "计划最后更新于此 · %@",
    lastUpdatedFormat: "最后更新 · %@",
    staleHint: "打开 ConPaws 检查更改",
    staleHintShort: "此计划可能已过时",
    staleA11yFormat: "最后更新于%@。打开 ConPaws 检查更改。",
  )

  private static let ko = ConPawsStrings(
    language: .ko,
    now: "지금",
    startingSoon: "곧 시작",
    today: "오늘",
    tomorrow: "내일",
    inFormat: "%@ 후",
    hoursUnit: ConPawsPluralUnit(one: "%@시간", other: "%@시간"),
    daysUnit: ConPawsPluralUnit(one: "%@일", other: "%@일"),
    monthsUnit: ConPawsPluralUnit(one: "%@개월", other: "%@개월"),
    minutesUnit: ConPawsPluralUnit(one: "%@분", other: "%@분"),
    eventsUnit: ConPawsPluralUnit(one: "%@개", other: "%@개"),
    compactNow: "지금",
    compactSoon: "곧",
    compactHoursFormat: "%@시간",
    compactDaysFormat: "%@일",
    compactMonthsFormat: "%@개월",
    remainingFormat: "%@ 남음",
    comingUpCaps: "다음 일정",
    startsInCaps: "시작까지",
    startsIn: "시작까지",
    addConventionHint: "ConPaws에서 컨벤션을 추가하세요.",
    startsForA11yFormat: "%1$@ 시작 시간은 %2$@",
    nextA11yFormat: "다음: %1$@, %2$@",
    inlineStartsFormat: "%@ 시작",
    lowercasesInlineCountdown: false,
    syncFromPhone: "iPhone에서 컨벤션 동기화",
    comingUpA11yFormat: "다음 일정, %1$@, %2$@",
    startsWithCurrentA11yFormat: "%1$@ 후 시작. 진행 중: %2$@. 다음: %3$@, 시작 %4$@.",
    startsA11yFormat: "%1$@ 후 %2$@ 시작, 시간은 %3$@.",
    nextEventA11yFormat: "다음 일정: %1$@, %2$@ 시작",
    noScheduleTitle: "아직 일정이 없습니다",
    noScheduleMessage: "iPhone에서 ConPaws를 열어 컨벤션을 동기화하세요.",
    nothingUpcomingTitle: "예정된 일정 없음",
    nothingUpcomingMessage: "저장한 컨벤션이 모두 끝났습니다.",
    untilTheConvention: "컨벤션까지",
    comingUpTitle: "다음 일정",
    scheduleTitle: "일정",
    eventTitle: "이벤트",
    laterLabel: "나중에",
    scheduledLabel: "예정됨",
    finishedComplication: "오늘은 더 이상 패널이 없습니다",
    noEventsTodayTitle: "오늘 일정 없음",
    noEventsTodayMessage: "오늘 저장된 일정이 없습니다.",
    minutesBeforeFormat: "%@ 전",
    compactMinutesFormat: "%@분",
    endsFormat: "%@까지",
    moreTodayFormat: "오늘 %@개 더",
    starredFormat: "%@ 즐겨찾기",
    allDoneTitle: "오늘 일정을 모두 마쳤습니다",
    firstTomorrowFormat: "내일 첫 일정: %1$@, %2$@.",
    starHint: "ConPaws에서 일정을 즐겨찾기하면 여기에 표시됩니다.",
    upNextCaps: "다음 일정",
    happeningNowCaps: "진행 중",
    untilCapsFormat: "종료 %@",
    reminderAtFormat: "%1$@ 알림 · %2$@",
    noLaterSavedEvents: "저장한 일정에 이후 이벤트가 없습니다",
    noLaterSavedEventsShort: "저장된 이후 이벤트 없음",
    noPicksTitle: "선택한 패널 없음",
    noPicksHint: "휴대폰의 ConPaws에서 패널을 선택하세요",
    noPicksWatchMessage: "iPhone의 ConPaws에서 패널을 선택하면 여기에 표시됩니다.",
    noPicksComplication: "iPhone에서 패널 추가",
    finishedTitle: "선택한 패널이 모두 끝났습니다",
    finishedHint: "ConPaws에서 일정을 둘러보고 더 추가하세요.",
    lastEndedFormat: "마지막 패널 종료 시각: %@",
    noConventionTitle: "ConPaws 열기",
    noConventionHint: "여기에 표시할 컨벤션을 선택하세요.",
    noConventionComplication: "아직 일정 없음",
    openOnIphone: "iPhone에서 ConPaws 열기",
    noConventionWatchMessage: "그곳에서 컨벤션을 선택하면 여기에 일정이 표시됩니다.",
    planLastUpdatedFormat: "여기에 표시된 일정 마지막 업데이트 · %@",
    lastUpdatedFormat: "마지막 업데이트 · %@",
    staleHint: "ConPaws를 열어 변경 사항 확인",
    staleHintShort: "일정이 최신이 아닐 수 있습니다",
    staleA11yFormat: "마지막 업데이트 %@. ConPaws를 열어 변경 사항을 확인하세요.",
  )

  private static let it = ConPawsStrings(
    language: .it,
    now: "Adesso",
    startingSoon: "Inizia a breve",
    today: "Oggi",
    tomorrow: "Domani",
    inFormat: "Tra %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ ora", other: "%@ ore"),
    daysUnit: ConPawsPluralUnit(one: "%@ giorno", other: "%@ giorni"),
    monthsUnit: ConPawsPluralUnit(one: "%@ mese", other: "%@ mesi"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minuto", other: "%@ minuti"),
    eventsUnit: ConPawsPluralUnit(one: "%@ evento", other: "%@ eventi"),
    compactNow: "Adesso",
    compactSoon: "A breve",
    compactHoursFormat: "%@ h",
    compactDaysFormat: "%@ g",
    compactMonthsFormat: "%@ mesi",
    remainingFormat: "%@ rimanenti",
    comingUpCaps: "IN ARRIVO",
    startsInCaps: "INIZIA TRA",
    startsIn: "Inizia tra",
    addConventionHint: "Aggiungi una convention in ConPaws.",
    startsForA11yFormat: "Inizia alle %2$@ per %1$@",
    nextA11yFormat: "Prossimo: %1$@, %2$@",
    inlineStartsFormat: "Inizia %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincronizza una convention da iPhone",
    comingUpA11yFormat: "In arrivo, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Inizia tra %1$@. In corso: %2$@. Poi: %3$@, inizia alle %4$@.",
    startsA11yFormat: "Inizia tra %1$@ per %2$@, alle %3$@.",
    nextEventA11yFormat: "Prossimo evento: %1$@, inizia %2$@",
    noScheduleTitle: "Ancora nessun programma",
    noScheduleMessage: "Apri ConPaws sul tuo iPhone per sincronizzare una convention.",
    nothingUpcomingTitle: "Niente in arrivo",
    nothingUpcomingMessage: "Le convention salvate sono terminate.",
    untilTheConvention: "Alla convention",
    comingUpTitle: "In arrivo",
    scheduleTitle: "Programma",
    eventTitle: "Evento",
    laterLabel: "Più tardi",
    scheduledLabel: "In programma",
    finishedComplication: "Oggi non ci sono altri panel",
    noEventsTodayTitle: "Nessun evento oggi",
    noEventsTodayMessage: "Non hai eventi salvati per oggi.",
    minutesBeforeFormat: "%@ prima",
    compactMinutesFormat: "%@ min",
    endsFormat: "fino alle %@",
    moreTodayFormat: "+%@ oggi",
    starredFormat: "%@ preferiti",
    allDoneTitle: "Tutto fatto per oggi",
    firstTomorrowFormat: "Primo evento domani: %1$@, %2$@.",
    starHint: "Aggiungi eventi ai preferiti in ConPaws per vederli qui.",
    upNextCaps: "PROSSIMO",
    happeningNowCaps: "IN CORSO",
    untilCapsFormat: "FINO ALLE %@",
    reminderAtFormat: "Promemoria alle %1$@ · %2$@",
    noLaterSavedEvents: "Non ci sono altri eventi nel piano salvato",
    noLaterSavedEventsShort: "Nessun altro evento salvato",
    noPicksTitle: "Nessun panel scelto",
    noPicksHint: "Scegli un panel in ConPaws sul telefono",
    noPicksWatchMessage: "Scegli i panel in ConPaws sul tuo iPhone per vederli qui.",
    noPicksComplication: "Aggiungi panel su iPhone",
    finishedTitle: "Tutti i panel scelti sono terminati",
    finishedHint: "Sfoglia il programma in ConPaws per aggiungerne altri.",
    lastEndedFormat: "L’ultimo panel è terminato alle %@",
    noConventionTitle: "Apri ConPaws",
    noConventionHint: "Scegli una convention da mostrare qui.",
    noConventionComplication: "Nessun piano",
    openOnIphone: "Apri ConPaws su iPhone",
    noConventionWatchMessage: "Scegli una convention lì per vedere qui il tuo piano.",
    planLastUpdatedFormat: "Piano aggiornato qui l’ultima volta · %@",
    lastUpdatedFormat: "Ultimo aggiornamento · %@",
    staleHint: "Apri ConPaws per controllare gli aggiornamenti",
    staleHintShort: "Il piano potrebbe non essere aggiornato",
    staleA11yFormat: "Ultimo aggiornamento %@. Apri ConPaws per controllare gli aggiornamenti.",
  )

  private static let ms = ConPawsStrings(
    language: .ms,
    now: "Sekarang",
    startingSoon: "Bermula sebentar lagi",
    today: "Hari ini",
    tomorrow: "Esok",
    inFormat: "Dalam %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ jam", other: "%@ jam"),
    daysUnit: ConPawsPluralUnit(one: "%@ hari", other: "%@ hari"),
    monthsUnit: ConPawsPluralUnit(one: "%@ bulan", other: "%@ bulan"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minit", other: "%@ minit"),
    eventsUnit: ConPawsPluralUnit(one: "%@ acara", other: "%@ acara"),
    compactNow: "Sekarang",
    compactSoon: "Sebentar lagi",
    compactHoursFormat: "%@ j",
    compactDaysFormat: "%@ h",
    compactMonthsFormat: "%@ bln",
    remainingFormat: "%@ lagi",
    comingUpCaps: "AKAN DATANG",
    startsInCaps: "BERMULA DALAM",
    startsIn: "Bermula dalam",
    addConventionHint: "Tambah konvensyen dalam ConPaws.",
    startsForA11yFormat: "Bermula pada %2$@ untuk %1$@",
    nextA11yFormat: "Seterusnya: %1$@, %2$@",
    inlineStartsFormat: "Bermula %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Segerakkan konvensyen dari iPhone",
    comingUpA11yFormat: "Akan datang, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Bermula dalam %1$@. Sedang berlangsung: %2$@. Seterusnya: %3$@, bermula %4$@.",
    startsA11yFormat: "Bermula dalam %1$@ untuk %2$@, pada %3$@.",
    nextEventA11yFormat: "Acara seterusnya: %1$@, bermula %2$@",
    noScheduleTitle: "Belum ada jadual",
    noScheduleMessage: "Buka ConPaws pada iPhone anda untuk menyegerakkan konvensyen.",
    nothingUpcomingTitle: "Tiada yang akan datang",
    nothingUpcomingMessage: "Konvensyen yang anda simpan telah tamat.",
    untilTheConvention: "Sehingga konvensyen",
    comingUpTitle: "Akan datang",
    scheduleTitle: "Jadual",
    eventTitle: "Acara",
    laterLabel: "Kemudian",
    scheduledLabel: "Dijadualkan",
    finishedComplication: "Tiada lagi panel hari ini",
    noEventsTodayTitle: "Tiada acara hari ini",
    noEventsTodayMessage: "Tiada acara tersimpan untuk hari ini.",
    minutesBeforeFormat: "%@ sebelum",
    compactMinutesFormat: "%@ min",
    endsFormat: "hingga %@",
    moreTodayFormat: "+%@ lagi hari ini",
    starredFormat: "%@ dibintangi",
    allDoneTitle: "Selesai untuk hari ini",
    firstTomorrowFormat: "Acara pertama esok: %1$@, %2$@.",
    starHint: "Bintangkan acara dalam ConPaws untuk melihatnya di sini.",
    upNextCaps: "SETERUSNYA",
    happeningNowCaps: "SEDANG BERLANGSUNG",
    untilCapsFormat: "HINGGA %@",
    reminderAtFormat: "Peringatan pada %1$@ · %2$@",
    noLaterSavedEvents: "Tiada acara seterusnya dalam pelan simpanan anda",
    noLaterSavedEventsShort: "Tiada acara simpanan yang seterusnya",
    noPicksTitle: "Tiada panel dipilih",
    noPicksHint: "Pilih panel dalam ConPaws pada telefon anda",
    noPicksWatchMessage: "Pilih panel dalam ConPaws pada iPhone anda untuk melihatnya di sini.",
    noPicksComplication: "Tambah panel pada iPhone",
    finishedTitle: "Semua panel pilihan anda telah tamat",
    finishedHint: "Lihat jadual dalam ConPaws untuk menambah lagi.",
    lastEndedFormat: "Panel terakhir anda tamat pada %@",
    noConventionTitle: "Buka ConPaws",
    noConventionHint: "Pilih konvensyen untuk dipaparkan di sini.",
    noConventionComplication: "Belum ada pelan",
    openOnIphone: "Buka ConPaws pada iPhone",
    noConventionWatchMessage: "Pilih konvensyen di sana untuk melihat pelan anda di sini.",
    planLastUpdatedFormat: "Pelan kali terakhir dikemas kini di sini · %@",
    lastUpdatedFormat: "Kemas kini terakhir · %@",
    staleHint: "Buka ConPaws untuk menyemak perubahan",
    staleHintShort: "Pelan ini mungkin sudah lapuk",
    staleA11yFormat: "Kemas kini terakhir %@. Buka ConPaws untuk menyemak perubahan.",
  )

  private static let da = ConPawsStrings(
    language: .da,
    now: "Nu",
    startingSoon: "Starter snart",
    today: "I dag",
    tomorrow: "I morgen",
    inFormat: "Om %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ time", other: "%@ timer"),
    daysUnit: ConPawsPluralUnit(one: "%@ dag", other: "%@ dage"),
    monthsUnit: ConPawsPluralUnit(one: "%@ måned", other: "%@ måneder"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minut", other: "%@ minutter"),
    eventsUnit: ConPawsPluralUnit(one: "%@ begivenhed", other: "%@ begivenheder"),
    compactNow: "Nu",
    compactSoon: "Snart",
    compactHoursFormat: "%@ t",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ mdr",
    remainingFormat: "%@ tilbage",
    comingUpCaps: "NÆSTE",
    startsInCaps: "STARTER OM",
    startsIn: "Starter om",
    addConventionHint: "Tilføj et stævne i ConPaws.",
    startsForA11yFormat: "Starter kl. %2$@ for %1$@",
    nextA11yFormat: "Næste: %1$@, %2$@",
    inlineStartsFormat: "Starter %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synkronisér et stævne fra iPhone",
    comingUpA11yFormat: "Næste, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Starter om %1$@. I gang nu: %2$@. Næste: %3$@, starter %4$@.",
    startsA11yFormat: "Starter om %1$@ for %2$@, kl. %3$@.",
    nextEventA11yFormat: "Næste begivenhed: %1$@, starter %2$@",
    noScheduleTitle: "Endnu intet program",
    noScheduleMessage: "Åbn ConPaws på din iPhone for at synkronisere et stævne.",
    nothingUpcomingTitle: "Intet kommende",
    nothingUpcomingMessage: "Dine gemte stævner er slut.",
    untilTheConvention: "Til stævnet",
    comingUpTitle: "Næste",
    scheduleTitle: "Program",
    eventTitle: "Begivenhed",
    laterLabel: "Senere",
    scheduledLabel: "Planlagt",
    finishedComplication: "Ingen flere paneler i dag",
    noEventsTodayTitle: "Ingen begivenheder i dag",
    noEventsTodayMessage: "Der er ingen gemte begivenheder i dag.",
    minutesBeforeFormat: "%@ før",
    compactMinutesFormat: "%@ min",
    endsFormat: "til %@",
    moreTodayFormat: "+%@ mere i dag",
    starredFormat: "%@ markeret",
    allDoneTitle: "Færdig for i dag",
    firstTomorrowFormat: "Første begivenhed i morgen: %1$@, %2$@.",
    starHint: "Markér begivenheder i ConPaws for at se dem her.",
    upNextCaps: "NÆSTE",
    happeningNowCaps: "I GANG NU",
    untilCapsFormat: "TIL %@",
    reminderAtFormat: "Påmindelse kl. %1$@ · %2$@",
    noLaterSavedEvents: "Ingen senere begivenheder i din gemte plan",
    noLaterSavedEventsShort: "Ingen senere gemte begivenheder",
    noPicksTitle: "Ingen paneler valgt",
    noPicksHint: "Vælg et panel i ConPaws på din telefon",
    noPicksWatchMessage: "Vælg paneler i ConPaws på din iPhone for at se dem her.",
    noPicksComplication: "Tilføj paneler på iPhone",
    finishedTitle: "Alle de valgte paneler er afsluttet",
    finishedHint: "Gennemse programmet i ConPaws for at tilføje flere.",
    lastEndedFormat: "Dit sidste panel sluttede kl. %@",
    noConventionTitle: "Åbn ConPaws",
    noConventionHint: "Vælg et stævne, der skal vises her.",
    noConventionComplication: "Ingen plan endnu",
    openOnIphone: "Åbn ConPaws på iPhone",
    noConventionWatchMessage: "Vælg et stævne der for at se din plan her.",
    planLastUpdatedFormat: "Planen blev sidst opdateret her · %@",
    lastUpdatedFormat: "Sidst opdateret · %@",
    staleHint: "Åbn ConPaws for at tjekke for ændringer",
    staleHintShort: "Planen kan være forældet",
    staleA11yFormat: "Sidst opdateret %@. Åbn ConPaws for at tjekke for ændringer.",
  )

  private static let nb = ConPawsStrings(
    language: .nb,
    now: "Nå",
    startingSoon: "Starter snart",
    today: "I dag",
    tomorrow: "I morgen",
    inFormat: "Om %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ time", other: "%@ timer"),
    daysUnit: ConPawsPluralUnit(one: "%@ dag", other: "%@ dager"),
    monthsUnit: ConPawsPluralUnit(one: "%@ måned", other: "%@ måneder"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minutt", other: "%@ minutter"),
    eventsUnit: ConPawsPluralUnit(one: "%@ hendelse", other: "%@ hendelser"),
    compactNow: "Nå",
    compactSoon: "Snart",
    compactHoursFormat: "%@ t",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ mnd",
    remainingFormat: "%@ igjen",
    comingUpCaps: "NESTE",
    startsInCaps: "STARTER OM",
    startsIn: "Starter om",
    addConventionHint: "Legg til et arrangement i ConPaws.",
    startsForA11yFormat: "Starter kl. %2$@ for %1$@",
    nextA11yFormat: "Neste: %1$@, %2$@",
    inlineStartsFormat: "Starter %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synkroniser et arrangement fra iPhone",
    comingUpA11yFormat: "Neste, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Starter om %1$@. Pågår nå: %2$@. Neste: %3$@, starter %4$@.",
    startsA11yFormat: "Starter om %1$@ for %2$@, kl. %3$@.",
    nextEventA11yFormat: "Neste hendelse: %1$@, starter %2$@",
    noScheduleTitle: "Ingen program ennå",
    noScheduleMessage: "Åpne ConPaws på iPhone for å synkronisere et arrangement.",
    nothingUpcomingTitle: "Ingenting på gang",
    nothingUpcomingMessage: "De lagrede arrangementene dine er over.",
    untilTheConvention: "Til arrangementet",
    comingUpTitle: "Neste",
    scheduleTitle: "Program",
    eventTitle: "Hendelse",
    laterLabel: "Senere",
    scheduledLabel: "Planlagt",
    finishedComplication: "Ingen flere paneler i dag",
    noEventsTodayTitle: "Ingen hendelser i dag",
    noEventsTodayMessage: "Ingen hendelser er lagret for i dag.",
    minutesBeforeFormat: "%@ før",
    compactMinutesFormat: "%@ min",
    endsFormat: "til %@",
    moreTodayFormat: "+%@ til i dag",
    starredFormat: "%@ stjernemerket",
    allDoneTitle: "Ferdig for i dag",
    firstTomorrowFormat: "Første hendelse i morgen: %1$@, %2$@.",
    starHint: "Stjernemerk hendelser i ConPaws for å se dem her.",
    upNextCaps: "NESTE",
    happeningNowCaps: "PÅGÅR NÅ",
    untilCapsFormat: "TIL %@",
    reminderAtFormat: "Påminnelse kl. %1$@ · %2$@",
    noLaterSavedEvents: "Ingen senere hendelser i den lagrede planen din",
    noLaterSavedEventsShort: "Ingen senere lagrede hendelser",
    noPicksTitle: "Ingen paneler valgt",
    noPicksHint: "Velg et panel i ConPaws på telefonen",
    noPicksWatchMessage: "Velg paneler i ConPaws på iPhone for å se dem her.",
    noPicksComplication: "Legg til paneler på iPhone",
    finishedTitle: "Alle panelene du valgte, er ferdige",
    finishedHint: "Bla gjennom programmet i ConPaws for å legge til flere.",
    lastEndedFormat: "Det siste panelet ditt sluttet kl. %@",
    noConventionTitle: "Åpne ConPaws",
    noConventionHint: "Velg en convention som skal vises her.",
    noConventionComplication: "Ingen plan ennå",
    openOnIphone: "Åpne ConPaws på iPhone",
    noConventionWatchMessage: "Velg en convention der for å se planen din her.",
    planLastUpdatedFormat: "Planen ble sist oppdatert her · %@",
    lastUpdatedFormat: "Sist oppdatert · %@",
    staleHint: "Åpne ConPaws for å se etter endringer",
    staleHintShort: "Planen kan være utdatert",
    staleA11yFormat: "Sist oppdatert %@. Åpne ConPaws for å se etter endringer.",
  )

  private static let fi = ConPawsStrings(
    language: .fi,
    now: "Nyt",
    startingSoon: "Alkaa pian",
    today: "Tänään",
    tomorrow: "Huomenna",
    inFormat: "%@ kuluttua",
    hoursUnit: ConPawsPluralUnit(one: "%@ tunti", other: "%@ tuntia", obliqueOne: "%@ tunnin", obliqueOther: "%@ tunnin"),
    daysUnit: ConPawsPluralUnit(one: "%@ päivä", other: "%@ päivää", obliqueOne: "%@ päivän", obliqueOther: "%@ päivän"),
    monthsUnit: ConPawsPluralUnit(one: "%@ kuukausi", other: "%@ kuukautta", obliqueOne: "%@ kuukauden", obliqueOther: "%@ kuukauden"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minuutti", other: "%@ minuuttia", obliqueOne: "%@ minuutin", obliqueOther: "%@ minuutin"),
    eventsUnit: ConPawsPluralUnit(one: "%@ tapahtuma", other: "%@ tapahtumaa"),
    compactNow: "Nyt",
    compactSoon: "Pian",
    compactHoursFormat: "%@ t",
    compactDaysFormat: "%@ pv",
    compactMonthsFormat: "%@ kk",
    remainingFormat: "%@ jäljellä",
    comingUpCaps: "SEURAAVAKSI",
    startsInCaps: "AIKAA ALKUUN",
    startsIn: "Aikaa alkuun:",
    addConventionHint: "Lisää tapahtuma ConPawsissa.",
    startsForA11yFormat: "Alkaa klo %2$@ — %1$@",
    nextA11yFormat: "Seuraava: %1$@, %2$@",
    inlineStartsFormat: "Alkaa %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synkronoi tapahtuma iPhonesta",
    comingUpA11yFormat: "Seuraavaksi, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Alkaa %1$@ kuluttua. Käynnissä nyt: %2$@. Seuraavaksi: %3$@, alkaa %4$@.",
    startsA11yFormat: "Alkaa %1$@ kuluttua: %2$@, klo %3$@.",
    nextEventA11yFormat: "Seuraava tapahtuma: %1$@, alkaa %2$@",
    noScheduleTitle: "Ei vielä ohjelmaa",
    noScheduleMessage: "Avaa ConPaws iPhonessa synkronoidaksesi tapahtuman.",
    nothingUpcomingTitle: "Ei tulossa",
    nothingUpcomingMessage: "Tallentamasi tapahtumat ovat päättyneet.",
    untilTheConvention: "Tapahtumaan",
    comingUpTitle: "Seuraavaksi",
    scheduleTitle: "Ohjelma",
    eventTitle: "Tapahtuma",
    laterLabel: "Myöhemmin",
    scheduledLabel: "Ajoitettu",
    finishedComplication: "Ei enempää paneeleja tänään",
    noEventsTodayTitle: "Ei tapahtumia tänään",
    noEventsTodayMessage: "Tälle päivälle ei ole tallennettuja tapahtumia.",
    minutesBeforeFormat: "%@ ennen",
    compactMinutesFormat: "%@ min",
    endsFormat: "%@ asti",
    moreTodayFormat: "+%@ tänään",
    starredFormat: "%@ tähdellä",
    allDoneTitle: "Tämä päivä on hoidettu",
    firstTomorrowFormat: "Huomisen ensimmäinen tapahtuma: %1$@, %2$@.",
    starHint: "Merkitse tapahtumia tähdellä ConPawsissa nähdäksesi ne täällä.",
    upNextCaps: "SEURAAVAKSI",
    happeningNowCaps: "KÄYNNISSÄ NYT",
    untilCapsFormat: "ASTI %@",
    reminderAtFormat: "Muistutus klo %1$@ · %2$@",
    noLaterSavedEvents: "Tallennetussa suunnitelmassasi ei ole myöhempiä tapahtumia",
    noLaterSavedEventsShort: "Ei myöhempiä tallennettuja tapahtumia",
    noPicksTitle: "Paneeleja ei ole valittu",
    noPicksHint: "Valitse paneeli puhelimesi ConPaws-sovelluksessa",
    noPicksWatchMessage: "Valitse paneeleja iPhonen ConPaws-sovelluksessa nähdäksesi ne täällä.",
    noPicksComplication: "Lisää paneeleja iPhonella",
    finishedTitle: "Kaikki valitsemasi paneelit ovat päättyneet",
    finishedHint: "Selaa aikataulua ConPawsissa lisätäksesi paneeleja.",
    lastEndedFormat: "Viimeinen paneelisi päättyi klo %@",
    noConventionTitle: "Avaa ConPaws",
    noConventionHint: "Valitse tässä näytettävä tapahtuma.",
    noConventionComplication: "Ei suunnitelmaa vielä",
    openOnIphone: "Avaa ConPaws iPhonessa",
    noConventionWatchMessage: "Valitse siellä tapahtuma nähdäksesi suunnitelmasi täällä.",
    planLastUpdatedFormat: "Suunnitelma päivitetty täällä viimeksi · %@",
    lastUpdatedFormat: "Päivitetty viimeksi · %@",
    staleHint: "Avaa ConPaws ja tarkista muutokset",
    staleHintShort: "Suunnitelma ei ehkä ole ajan tasalla",
    staleA11yFormat: "Päivitetty viimeksi %@. Avaa ConPaws ja tarkista muutokset.",
  )

  private static let cs = ConPawsStrings(
    language: .cs,
    now: "Teď",
    startingSoon: "Brzy začíná",
    today: "Dnes",
    tomorrow: "Zítra",
    inFormat: "Za %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ hodina", few: "%@ hodiny", other: "%@ hodin", obliqueOne: "%@ hodinu", obliqueFew: "%@ hodiny", obliqueOther: "%@ hodin"),
    daysUnit: ConPawsPluralUnit(one: "%@ den", few: "%@ dny", other: "%@ dní"),
    monthsUnit: ConPawsPluralUnit(one: "%@ měsíc", few: "%@ měsíce", other: "%@ měsíců"),
    minutesUnit: ConPawsPluralUnit(one: "%@ minuta", few: "%@ minuty", other: "%@ minut", obliqueOne: "%@ minutu", obliqueFew: "%@ minuty", obliqueOther: "%@ minut"),
    eventsUnit: ConPawsPluralUnit(one: "%@ událost", few: "%@ události", other: "%@ událostí"),
    compactNow: "Teď",
    compactSoon: "Brzy",
    compactHoursFormat: "%@ h",
    compactDaysFormat: "%@ d",
    compactMonthsFormat: "%@ měs",
    remainingFormat: "zbývá %@",
    comingUpCaps: "NÁSLEDUJE",
    startsInCaps: "ZAČÍNÁ ZA",
    startsIn: "Začíná za",
    addConventionHint: "Přidej con v ConPaws.",
    startsForA11yFormat: "Začíná v %2$@ pro %1$@",
    nextA11yFormat: "Další: %1$@, %2$@",
    inlineStartsFormat: "Začíná %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synchronizuj con z iPhonu",
    comingUpA11yFormat: "Následuje, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Začíná za %1$@. Právě probíhá: %2$@. Další: %3$@, začíná %4$@.",
    startsA11yFormat: "Začíná za %1$@ pro %2$@, v %3$@.",
    nextEventA11yFormat: "Další událost: %1$@, začíná %2$@",
    noScheduleTitle: "Zatím žádný program",
    noScheduleMessage: "Otevři ConPaws na iPhonu a synchronizuj con.",
    nothingUpcomingTitle: "Nic nadcházejícího",
    nothingUpcomingMessage: "Tvé uložené cony skončily.",
    untilTheConvention: "Do conu",
    comingUpTitle: "Následuje",
    scheduleTitle: "Program",
    eventTitle: "Událost",
    laterLabel: "Později",
    scheduledLabel: "Naplánováno",
    finishedComplication: "Dnes už žádné panely",
    noEventsTodayTitle: "Dnes žádné události",
    noEventsTodayMessage: "Na dnešek nemáš uložené žádné události.",
    minutesBeforeFormat: "%@ před",
    compactMinutesFormat: "%@ min",
    endsFormat: "do %@",
    moreTodayFormat: "+%@ dnes",
    starredFormat: "%@ s hvězdičkou",
    allDoneTitle: "Pro dnešek hotovo",
    firstTomorrowFormat: "První zítřejší událost: %1$@, %2$@.",
    starHint: "Označ události hvězdičkou v ConPaws a uvidíš je tady.",
    upNextCaps: "DALŠÍ",
    happeningNowCaps: "PRÁVĚ PROBÍHÁ",
    untilCapsFormat: "DO %@",
    reminderAtFormat: "Připomenutí v %1$@ · %2$@",
    noLaterSavedEvents: "V uloženém plánu už nejsou další události",
    noLaterSavedEventsShort: "Žádné další uložené události",
    noPicksTitle: "Nejsou vybrané žádné panely",
    noPicksHint: "Vyber panel v ConPaws v telefonu",
    noPicksWatchMessage: "Vyber panely v ConPaws na iPhonu a zobrazí se tady.",
    noPicksComplication: "Přidat panely na iPhonu",
    finishedTitle: "Všechny vybrané panely skončily",
    finishedHint: "Procházej program v ConPaws a přidej další.",
    lastEndedFormat: "Poslední panel skončil v %@",
    noConventionTitle: "Otevřít ConPaws",
    noConventionHint: "Vyber con, který se má zobrazit zde.",
    noConventionComplication: "Zatím žádný plán",
    openOnIphone: "Otevřít ConPaws na iPhonu",
    noConventionWatchMessage: "Vyber tam con a zobraz svůj plán zde.",
    planLastUpdatedFormat: "Plán zde naposledy aktualizován · %@",
    lastUpdatedFormat: "Naposledy aktualizováno · %@",
    staleHint: "Otevři ConPaws a zkontroluj změny",
    staleHintShort: "Plán může být zastaralý",
    staleA11yFormat: "Naposledy aktualizováno %@. Otevři ConPaws a zkontroluj změny.",
  )

  private static let hu = ConPawsStrings(
    language: .hu,
    now: "Most",
    startingSoon: "Hamarosan kezdődik",
    today: "Ma",
    tomorrow: "Holnap",
    inFormat: "%@ múlva",
    hoursUnit: ConPawsPluralUnit(one: "%@ óra", other: "%@ óra"),
    daysUnit: ConPawsPluralUnit(one: "%@ nap", other: "%@ nap"),
    monthsUnit: ConPawsPluralUnit(one: "%@ hónap", other: "%@ hónap"),
    minutesUnit: ConPawsPluralUnit(one: "%@ perc", other: "%@ perc"),
    eventsUnit: ConPawsPluralUnit(one: "%@ program", other: "%@ program"),
    compactNow: "Most",
    compactSoon: "Hamarosan",
    compactHoursFormat: "%@ ó",
    compactDaysFormat: "%@ n",
    compactMonthsFormat: "%@ hó",
    remainingFormat: "%@ van hátra",
    comingUpCaps: "KÖVETKEZIK",
    startsInCaps: "KEZDÉSIG",
    startsIn: "Kezdésig:",
    addConventionHint: "Adj hozzá egy convent a ConPawsban.",
    startsForA11yFormat: "Kezdés: %2$@, %1$@",
    nextA11yFormat: "Következő: %1$@, %2$@",
    inlineStartsFormat: "Kezdés %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Convent szinkronizálása iPhone-ról",
    comingUpA11yFormat: "Következik, %1$@, %2$@",
    startsWithCurrentA11yFormat: "%1$@ múlva kezdődik. Most zajlik: %2$@. Következő: %3$@, kezdés %4$@.",
    startsA11yFormat: "%1$@ múlva kezdődik: %2$@, %3$@.",
    nextEventA11yFormat: "Következő program: %1$@, kezdés: %2$@",
    noScheduleTitle: "Még nincs program",
    noScheduleMessage: "Nyisd meg a ConPawst az iPhone-odon a convent szinkronizálásához.",
    nothingUpcomingTitle: "Nincs közelgő",
    nothingUpcomingMessage: "A mentett conventjeid véget értek.",
    untilTheConvention: "A conventig",
    comingUpTitle: "Következik",
    scheduleTitle: "Program",
    eventTitle: "Program",
    laterLabel: "Később",
    scheduledLabel: "Ütemezve",
    finishedComplication: "Mára nincs több panel",
    noEventsTodayTitle: "Ma nincs program",
    noEventsTodayMessage: "Mára nincs mentett programod.",
    minutesBeforeFormat: "%@ előtt",
    compactMinutesFormat: "%@ perc",
    endsFormat: "eddig: %@",
    moreTodayFormat: "+%@ ma",
    starredFormat: "%@ csillagozva",
    allDoneTitle: "Mára minden megvolt",
    firstTomorrowFormat: "Holnapi első program: %1$@, %2$@.",
    starHint: "Csillagozz programokat a ConPawsban, és itt látod őket.",
    upNextCaps: "KÖVETKEZIK",
    happeningNowCaps: "MOST ZAJLIK",
    untilCapsFormat: "EDDIG: %@",
    reminderAtFormat: "Emlékeztető: %1$@ · %2$@",
    noLaterSavedEvents: "Nincs későbbi esemény a mentett tervedben",
    noLaterSavedEventsShort: "Nincs későbbi mentett esemény",
    noPicksTitle: "Nincs kiválasztott panel",
    noPicksHint: "Válassz panelt a telefonodon lévő ConPawsban",
    noPicksWatchMessage: "Válassz paneleket az iPhone-on lévő ConPawsban, hogy itt lásd őket.",
    noPicksComplication: "Panelek hozzáadása iPhone-on",
    finishedTitle: "Az összes kiválasztott panel véget ért",
    finishedHint: "Böngészd a műsort a ConPawsban, és adj hozzá továbbiakat.",
    lastEndedFormat: "Az utolsó paneled %@ időpontban ért véget",
    noConventionTitle: "ConPaws megnyitása",
    noConventionHint: "Válassz egy találkozót, amely itt jelenjen meg.",
    noConventionComplication: "Még nincs terv",
    openOnIphone: "ConPaws megnyitása iPhone-on",
    noConventionWatchMessage: "Válassz ott egy találkozót, hogy itt lásd a tervedet.",
    planLastUpdatedFormat: "A terv utolsó frissítése itt · %@",
    lastUpdatedFormat: "Utolsó frissítés · %@",
    staleHint: "Nyisd meg a ConPawst a változások ellenőrzéséhez",
    staleHintShort: "Lehet, hogy ez a terv elavult",
    staleA11yFormat: "Utolsó frissítés %@. Nyisd meg a ConPawst a változások ellenőrzéséhez.",
  )

  private static let uk = ConPawsStrings(
    language: .uk,
    now: "Зараз",
    startingSoon: "Скоро почнеться",
    today: "Сьогодні",
    tomorrow: "Завтра",
    inFormat: "За %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ година", few: "%@ години", other: "%@ годин", obliqueOne: "%@ годину", obliqueFew: "%@ години", obliqueOther: "%@ годин"),
    daysUnit: ConPawsPluralUnit(one: "%@ день", few: "%@ дні", other: "%@ днів"),
    monthsUnit: ConPawsPluralUnit(one: "%@ місяць", few: "%@ місяці", other: "%@ місяців"),
    minutesUnit: ConPawsPluralUnit(one: "%@ хвилина", few: "%@ хвилини", other: "%@ хвилин", obliqueOne: "%@ хвилину", obliqueFew: "%@ хвилини", obliqueOther: "%@ хвилин"),
    eventsUnit: ConPawsPluralUnit(one: "%@ подія", few: "%@ події", other: "%@ подій"),
    compactNow: "Зараз",
    compactSoon: "Скоро",
    compactHoursFormat: "%@ год",
    compactDaysFormat: "%@ дн",
    compactMonthsFormat: "%@ міс",
    remainingFormat: "залишилось %@",
    comingUpCaps: "ДАЛІ",
    startsInCaps: "ПОЧАТОК ЗА",
    startsIn: "Початок за",
    addConventionHint: "Додай конвент у ConPaws.",
    startsForA11yFormat: "Початок о %2$@ для %1$@",
    nextA11yFormat: "Наступна: %1$@, %2$@",
    inlineStartsFormat: "Початок %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Синхронізуй конвент з iPhone",
    comingUpA11yFormat: "Далі, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Початок за %1$@. Зараз триває: %2$@. Далі: %3$@, початок %4$@.",
    startsA11yFormat: "Початок за %1$@ для %2$@, о %3$@.",
    nextEventA11yFormat: "Наступна подія: %1$@, починається %2$@",
    noScheduleTitle: "Ще немає розкладу",
    noScheduleMessage: "Відкрий ConPaws на своєму iPhone, щоб синхронізувати конвент.",
    nothingUpcomingTitle: "Нічого попереду",
    nothingUpcomingMessage: "Твої збережені конвенти завершилися.",
    untilTheConvention: "До конвенту",
    comingUpTitle: "Далі",
    scheduleTitle: "Розклад",
    eventTitle: "Подія",
    laterLabel: "Пізніше",
    scheduledLabel: "Заплановано",
    finishedComplication: "Сьогодні панелей більше немає",
    noEventsTodayTitle: "Сьогодні немає подій",
    noEventsTodayMessage: "На сьогодні не збережено жодних подій.",
    minutesBeforeFormat: "%@ тому",
    compactMinutesFormat: "%@ хв",
    endsFormat: "до %@",
    moreTodayFormat: "+%@ сьогодні",
    starredFormat: "%@ у вибраному",
    allDoneTitle: "На сьогодні все",
    firstTomorrowFormat: "Перша подія завтра: %1$@, %2$@.",
    starHint: "Познач події зірочкою в ConPaws, щоб бачити їх тут.",
    upNextCaps: "ДАЛІ",
    happeningNowCaps: "ТРИВАЄ ЗАРАЗ",
    untilCapsFormat: "ДО %@",
    reminderAtFormat: "Нагадування о %1$@ · %2$@",
    noLaterSavedEvents: "У збереженому плані більше немає подій",
    noLaterSavedEventsShort: "Більше немає збережених подій",
    noPicksTitle: "Панелі не вибрано",
    noPicksHint: "Вибери панель у ConPaws на телефоні",
    noPicksWatchMessage: "Вибери панелі в ConPaws на iPhone, щоб побачити їх тут.",
    noPicksComplication: "Додати панелі на iPhone",
    finishedTitle: "Усі вибрані панелі завершилися",
    finishedHint: "Переглянь розклад у ConPaws, щоб додати інші.",
    lastEndedFormat: "Остання панель завершилася о %@",
    noConventionTitle: "Відкрити ConPaws",
    noConventionHint: "Вибери конвенцію, яку показувати тут.",
    noConventionComplication: "Плану ще немає",
    openOnIphone: "Відкрити ConPaws на iPhone",
    noConventionWatchMessage: "Вибери там конвенцію, щоб побачити план тут.",
    planLastUpdatedFormat: "План востаннє оновлено тут · %@",
    lastUpdatedFormat: "Востаннє оновлено · %@",
    staleHint: "Відкрий ConPaws, щоб перевірити зміни",
    staleHintShort: "План може бути застарілим",
    staleA11yFormat: "Востаннє оновлено %@. Відкрий ConPaws, щоб перевірити зміни.",
  )

  private static let ru = ConPawsStrings(
    language: .ru,
    now: "Сейчас",
    startingSoon: "Скоро начнётся",
    today: "Сегодня",
    tomorrow: "Завтра",
    inFormat: "Через %@",
    hoursUnit: ConPawsPluralUnit(one: "%@ час", few: "%@ часа", other: "%@ часов"),
    daysUnit: ConPawsPluralUnit(one: "%@ день", few: "%@ дня", other: "%@ дней"),
    monthsUnit: ConPawsPluralUnit(one: "%@ месяц", few: "%@ месяца", other: "%@ месяцев"),
    minutesUnit: ConPawsPluralUnit(one: "%@ минута", few: "%@ минуты", other: "%@ минут", obliqueOne: "%@ минуту", obliqueFew: "%@ минуты", obliqueOther: "%@ минут"),
    eventsUnit: ConPawsPluralUnit(one: "%@ событие", few: "%@ события", other: "%@ событий"),
    compactNow: "Сейчас",
    compactSoon: "Скоро",
    compactHoursFormat: "%@ ч",
    compactDaysFormat: "%@ дн",
    compactMonthsFormat: "%@ мес",
    remainingFormat: "осталось %@",
    comingUpCaps: "ДАЛЕЕ",
    startsInCaps: "НАЧАЛО ЧЕРЕЗ",
    startsIn: "Начало через",
    addConventionHint: "Добавь конвент в ConPaws.",
    startsForA11yFormat: "Начало в %2$@ для %1$@",
    nextA11yFormat: "Следующее: %1$@, %2$@",
    inlineStartsFormat: "Начало %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Синхронизируй конвент с iPhone",
    comingUpA11yFormat: "Далее, %1$@, %2$@",
    startsWithCurrentA11yFormat: "Начало через %1$@. Сейчас проходит: %2$@. Далее: %3$@, начало %4$@.",
    startsA11yFormat: "Начало через %1$@ для %2$@, в %3$@.",
    nextEventA11yFormat: "Следующее событие: %1$@, начало %2$@",
    noScheduleTitle: "Расписания пока нет",
    noScheduleMessage: "Открой ConPaws на iPhone, чтобы синхронизировать конвент.",
    nothingUpcomingTitle: "Ничего впереди",
    nothingUpcomingMessage: "Сохранённые конвенты закончились.",
    untilTheConvention: "До конвента",
    comingUpTitle: "Далее",
    scheduleTitle: "Расписание",
    eventTitle: "Событие",
    laterLabel: "Позже",
    scheduledLabel: "Запланировано",
    finishedComplication: "Сегодня панелей больше нет",
    noEventsTodayTitle: "Сегодня событий нет",
    noEventsTodayMessage: "На сегодня нет сохранённых событий.",
    minutesBeforeFormat: "%@ назад",
    compactMinutesFormat: "%@ мин",
    endsFormat: "до %@",
    moreTodayFormat: "+%@ сегодня",
    starredFormat: "%@ в избранном",
    allDoneTitle: "На сегодня всё",
    firstTomorrowFormat: "Первое событие завтра: %1$@, %2$@.",
    starHint: "Отмечай события звёздочкой в ConPaws, чтобы видеть их здесь.",
    upNextCaps: "ДАЛЕЕ",
    happeningNowCaps: "СЕЙЧАС ИДЁТ",
    untilCapsFormat: "ДО %@",
    reminderAtFormat: "Напоминание в %1$@ · %2$@",
    noLaterSavedEvents: "В сохранённом плане больше нет событий",
    noLaterSavedEventsShort: "Больше нет сохранённых событий",
    noPicksTitle: "Панели не выбраны",
    noPicksHint: "Выбери панель в ConPaws на телефоне",
    noPicksWatchMessage: "Выбери панели в ConPaws на iPhone, чтобы увидеть их здесь.",
    noPicksComplication: "Добавить панели на iPhone",
    finishedTitle: "Все выбранные панели завершились",
    finishedHint: "Открой расписание в ConPaws, чтобы добавить панели.",
    lastEndedFormat: "Последняя панель завершилась в %@",
    noConventionTitle: "Открыть ConPaws",
    noConventionHint: "Выбери конвенцию, которую показывать здесь.",
    noConventionComplication: "Плана пока нет",
    openOnIphone: "Открыть ConPaws на iPhone",
    noConventionWatchMessage: "Выбери там конвенцию, чтобы увидеть план здесь.",
    planLastUpdatedFormat: "План в последний раз обновлён здесь · %@",
    lastUpdatedFormat: "Последнее обновление · %@",
    staleHint: "Открой ConPaws, чтобы проверить изменения",
    staleHintShort: "План может быть неактуальным",
    staleA11yFormat: "Последнее обновление %@. Открой ConPaws, чтобы проверить изменения.",
  )
}
