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
    case "es": return .esES
    case "zh": return .zhCN
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
    // Polish and Czech: 1 alone is singular, 2-4 take the `few` form.
    case .pl, .cs:
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
  let nextCaps: String
  let whereCaps: String
  let nowCaps: String
  let leaveCaps: String
  let leaveInCaps: String
  let forCaps: String
  let noEventsCaps: String

  // MARK: iPhone widget

  let locationNotSet: String
  let nowEventFormat: String
  let leaveIn: String
  let freeNow: String
  let noUpcomingEvents: String
  let addConventionHint: String
  let addScheduleHint: String
  let addConvention: String
  let leaveForA11yFormat: String
  let nextA11yFormat: String
  let inlineLeaveFormat: String
  /// Whether the countdown reads correctly lower-cased mid-sentence.
  ///
  /// False for German, where "In 3 Stunden" carries a capitalised noun that
  /// lower-casing would break. German phrases its inline leave line around a
  /// colon instead, so the countdown can keep its own capitals.
  let lowercasesInlineCountdown: Bool

  // MARK: Watch complication

  let syncFromPhone: String
  let comingUpA11yFormat: String
  let leaveWithCurrentA11yFormat: String
  let leaveA11yFormat: String
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
  let noMoreEventsToday: String
  let noEventsTodayTitle: String
  let noEventsTodayMessage: String
  let minutesBeforeFormat: String
  let leaveReminderFormat: String
  let savedSchedule: String
  let savedScheduleA11y: String

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
    nextCaps: "NEXT",
    whereCaps: "WHERE",
    nowCaps: "NOW",
    leaveCaps: "LEAVE",
    leaveInCaps: "LEAVE IN",
    forCaps: "FOR",
    noEventsCaps: "NO EVENTS",
    locationNotSet: "Location not set",
    nowEventFormat: "Now: %@",
    leaveIn: "Leave in",
    freeNow: "Free now",
    noUpcomingEvents: "No upcoming events",
    addConventionHint: "Add a convention in ConPaws.",
    addScheduleHint: "Add or import a schedule in ConPaws.",
    addConvention: "Add a convention",
    leaveForA11yFormat: "Leave for %1$@, %2$@",
    nextA11yFormat: "Next: %1$@, %2$@",
    inlineLeaveFormat: "Leave %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sync a convention from iPhone",
    comingUpA11yFormat: "Coming up, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Leave in %1$@. Current event: %2$@. Next event: %3$@, starts %4$@.",
    leaveA11yFormat: "Leave in %1$@ for %2$@, starts %3$@.",
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
    noMoreEventsToday: "No more events today",
    noEventsTodayTitle: "No events today",
    noEventsTodayMessage: "Your next saved event is on another day.",
    minutesBeforeFormat: "%@ min before",
    leaveReminderFormat: "Leave reminder %@",
    savedSchedule: "Saved schedule",
    savedScheduleA11y: "Showing the latest schedule saved from your iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "ends %@",
    moreTodayFormat: "+%@ more today",
    starredFormat: "%@ starred",
    allDoneTitle: "All done for today",
    firstTomorrowFormat: "First event tomorrow: %1$@, %2$@.",
    starHint: "Star events in ConPaws to see them here."
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
    nextCaps: "NÄCHSTES",
    whereCaps: "WO",
    nowCaps: "JETZT",
    leaveCaps: "LOS",
    leaveInCaps: "LOS IN",
    forCaps: "FÜR",
    noEventsCaps: "KEINE EVENTS",
    locationNotSet: "Kein Ort angegeben",
    nowEventFormat: "Jetzt: %@",
    leaveIn: "Losgehen in",
    freeNow: "Gerade frei",
    noUpcomingEvents: "Keine anstehenden Events",
    addConventionHint: "Füge in ConPaws eine Convention hinzu.",
    addScheduleHint: "Füge in ConPaws einen Zeitplan hinzu oder importiere einen.",
    addConvention: "Convention hinzufügen",
    leaveForA11yFormat: "Losgehen zu %1$@, %2$@",
    nextA11yFormat: "Als Nächstes: %1$@, %2$@",
    inlineLeaveFormat: "Losgehen: %@",
    lowercasesInlineCountdown: false,
    syncFromPhone: "Convention vom iPhone synchronisieren",
    comingUpA11yFormat: "Demnächst, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Losgehen in %1$@. Aktuelles Event: %2$@. Nächstes Event: %3$@, beginnt %4$@.",
    leaveA11yFormat: "Losgehen in %1$@ zu %2$@, beginnt %3$@.",
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
    noMoreEventsToday: "Heute keine weiteren Events",
    noEventsTodayTitle: "Heute keine Events",
    noEventsTodayMessage: "Dein nächstes gespeichertes Event ist an einem anderen Tag.",
    minutesBeforeFormat: "%@ Min. vorher",
    leaveReminderFormat: "Erinnerung: %@",
    savedSchedule: "Gespeicherter Zeitplan",
    savedScheduleA11y: "Zeigt den zuletzt von deinem iPhone gespeicherten Zeitplan",
    compactMinutesFormat: "%@ Min.",
    endsFormat: "bis %@",
    moreTodayFormat: "+%@ weitere heute",
    starredFormat: "%@ vorgemerkt",
    allDoneTitle: "Für heute alles geschafft",
    firstTomorrowFormat: "Erstes Event morgen: %1$@, %2$@.",
    starHint: "Markiere Events in ConPaws, um sie hier zu sehen."
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
    nextCaps: "SIGUIENTE",
    whereCaps: "DÓNDE",
    nowCaps: "AHORA",
    leaveCaps: "SALIR",
    leaveInCaps: "SALIR EN",
    forCaps: "PARA",
    noEventsCaps: "SIN EVENTOS",
    locationNotSet: "Sin ubicación",
    nowEventFormat: "Ahora: %@",
    leaveIn: "Salir en",
    freeNow: "Ahora libre",
    noUpcomingEvents: "Sin eventos próximos",
    addConventionHint: "Añade una convención en ConPaws.",
    addScheduleHint: "Añade o importa un horario en ConPaws.",
    addConvention: "Añadir una convención",
    leaveForA11yFormat: "Salir hacia %1$@, %2$@",
    nextA11yFormat: "Siguiente: %1$@, %2$@",
    inlineLeaveFormat: "Salir %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincroniza una convención desde el iPhone",
    comingUpA11yFormat: "Próximamente, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Salir en %1$@. Evento actual: %2$@. Próximo evento: %3$@, empieza %4$@.",
    leaveA11yFormat: "Salir en %1$@ hacia %2$@, empieza %3$@.",
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
    noMoreEventsToday: "No hay más eventos hoy",
    noEventsTodayTitle: "Sin eventos hoy",
    noEventsTodayMessage: "Tu próximo evento guardado es otro día.",
    minutesBeforeFormat: "%@ min antes",
    leaveReminderFormat: "Recordatorio de salida %@",
    savedSchedule: "Horario guardado",
    savedScheduleA11y: "Mostrando el último horario guardado desde tu iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "hasta %@",
    moreTodayFormat: "+%@ más hoy",
    starredFormat: "%@ guardados",
    allDoneTitle: "Todo listo por hoy",
    firstTomorrowFormat: "Primer evento mañana: %1$@, %2$@.",
    starHint: "Marca eventos en ConPaws para verlos aquí."
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
    nextCaps: "SUIVANT",
    whereCaps: "OÙ",
    nowCaps: "MAINTENANT",
    leaveCaps: "PARTIR",
    leaveInCaps: "PARTIR DANS",
    forCaps: "POUR",
    noEventsCaps: "AUCUN ÉVÉNEMENT",
    locationNotSet: "Lieu non défini",
    nowEventFormat: "Maintenant : %@",
    leaveIn: "Partir dans",
    freeNow: "Libre maintenant",
    noUpcomingEvents: "Aucun événement à venir",
    addConventionHint: "Ajoutez une convention dans ConPaws.",
    addScheduleHint: "Ajoutez ou importez un programme dans ConPaws.",
    addConvention: "Ajouter une convention",
    leaveForA11yFormat: "Partir pour %1$@, %2$@",
    nextA11yFormat: "Suivant : %1$@, %2$@",
    inlineLeaveFormat: "Partir %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synchronisez une convention depuis l’iPhone",
    comingUpA11yFormat: "À venir, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Partir dans %1$@. Événement en cours : %2$@. Prochain événement : %3$@, commence %4$@.",
    leaveA11yFormat: "Partir dans %1$@ pour %2$@, commence %3$@.",
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
    noMoreEventsToday: "Plus d’événements aujourd’hui",
    noEventsTodayTitle: "Aucun événement aujourd’hui",
    noEventsTodayMessage: "Votre prochain événement enregistré a lieu un autre jour.",
    minutesBeforeFormat: "%@ min avant",
    leaveReminderFormat: "Rappel de départ %@",
    savedSchedule: "Programme enregistré",
    savedScheduleA11y: "Affiche le dernier programme enregistré depuis votre iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "jusqu’à %@",
    moreTodayFormat: "+%@ autres aujourd’hui",
    starredFormat: "%@ enregistrés",
    allDoneTitle: "Terminé pour aujourd’hui",
    firstTomorrowFormat: "Premier événement demain : %1$@, %2$@.",
    starHint: "Suivez des événements dans ConPaws pour les voir ici."
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
    nextCaps: "VOLGENDE",
    whereCaps: "WAAR",
    nowCaps: "NU",
    leaveCaps: "VERTREK",
    leaveInCaps: "VERTREK OVER",
    forCaps: "VOOR",
    noEventsCaps: "GEEN EVENEMENTEN",
    locationNotSet: "Geen locatie",
    nowEventFormat: "Nu: %@",
    leaveIn: "Vertrekken over",
    freeNow: "Nu vrij",
    noUpcomingEvents: "Geen aankomende evenementen",
    addConventionHint: "Voeg een conventie toe in ConPaws.",
    addScheduleHint: "Voeg een rooster toe of importeer er een in ConPaws.",
    addConvention: "Conventie toevoegen",
    leaveForA11yFormat: "Vertrekken naar %1$@, %2$@",
    nextA11yFormat: "Volgende: %1$@, %2$@",
    inlineLeaveFormat: "Vertrekken %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synchroniseer een conventie vanaf je iPhone",
    comingUpA11yFormat: "Binnenkort, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Vertrekken over %1$@. Huidig evenement: %2$@. Volgend evenement: %3$@, begint %4$@.",
    leaveA11yFormat: "Vertrekken over %1$@ naar %2$@, begint %3$@.",
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
    noMoreEventsToday: "Geen evenementen meer vandaag",
    noEventsTodayTitle: "Geen evenementen vandaag",
    noEventsTodayMessage: "Je volgende opgeslagen evenement is op een andere dag.",
    minutesBeforeFormat: "%@ min van tevoren",
    leaveReminderFormat: "Vertrekherinnering %@",
    savedSchedule: "Opgeslagen rooster",
    savedScheduleA11y: "Toont het laatste rooster dat vanaf je iPhone is opgeslagen",
    compactMinutesFormat: "%@ min",
    endsFormat: "tot %@",
    moreTodayFormat: "+%@ meer vandaag",
    starredFormat: "%@ opgeslagen",
    allDoneTitle: "Klaar voor vandaag",
    firstTomorrowFormat: "Eerste evenement morgen: %1$@, %2$@.",
    starHint: "Markeer evenementen in ConPaws om ze hier te zien."
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
    nextCaps: "NASTĘPNE",
    whereCaps: "GDZIE",
    nowCaps: "TERAZ",
    leaveCaps: "WYJŚCIE",
    leaveInCaps: "WYJŚCIE ZA",
    forCaps: "NA",
    noEventsCaps: "BRAK WYDARZEŃ",
    locationNotSet: "Brak lokalizacji",
    nowEventFormat: "Teraz: %@",
    leaveIn: "Wyjście za",
    freeNow: "Teraz wolne",
    noUpcomingEvents: "Brak nadchodzących wydarzeń",
    addConventionHint: "Dodaj konwent w ConPaws.",
    addScheduleHint: "Dodaj lub zaimportuj harmonogram w ConPaws.",
    addConvention: "Dodaj konwent",
    leaveForA11yFormat: "Wyjście na %1$@, %2$@",
    nextA11yFormat: "Następne: %1$@, %2$@",
    inlineLeaveFormat: "Wyjście %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Zsynchronizuj konwent z iPhone’a",
    comingUpA11yFormat: "Wkrótce, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Wyjście za %1$@. Bieżące wydarzenie: %2$@. Następne wydarzenie: %3$@, zaczyna się %4$@.",
    leaveA11yFormat: "Wyjście za %1$@ na %2$@, zaczyna się %3$@.",
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
    noMoreEventsToday: "Brak dalszych wydarzeń dzisiaj",
    noEventsTodayTitle: "Brak wydarzeń dzisiaj",
    noEventsTodayMessage: "Twoje następne zapisane wydarzenie jest innego dnia.",
    minutesBeforeFormat: "%@ min wcześniej",
    leaveReminderFormat: "Przypomnienie o wyjściu %@",
    savedSchedule: "Zapisany harmonogram",
    savedScheduleA11y: "Pokazuje ostatni harmonogram zapisany z iPhone’a",
    compactMinutesFormat: "%@ min",
    endsFormat: "do %@",
    moreTodayFormat: "+%@ więcej dzisiaj",
    starredFormat: "Zapisane: %@",
    allDoneTitle: "Na dzisiaj to wszystko",
    firstTomorrowFormat: "Pierwsze wydarzenie jutro: %1$@, %2$@.",
    starHint: "Oznacz wydarzenia w ConPaws, aby zobaczyć je tutaj."
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
    nextCaps: "A SEGUIR",
    whereCaps: "ONDE",
    nowCaps: "AGORA",
    leaveCaps: "SAIR",
    leaveInCaps: "SAIR EM",
    forCaps: "PARA",
    noEventsCaps: "SEM EVENTOS",
    locationNotSet: "Local não definido",
    nowEventFormat: "Agora: %@",
    leaveIn: "Sair em",
    freeNow: "Livre agora",
    noUpcomingEvents: "Nenhum evento a seguir",
    addConventionHint: "Adicione uma convenção no ConPaws.",
    addScheduleHint: "Adicione ou importe uma programação no ConPaws.",
    addConvention: "Adicionar uma convenção",
    leaveForA11yFormat: "Sair para %1$@, %2$@",
    nextA11yFormat: "A seguir: %1$@, %2$@",
    inlineLeaveFormat: "Sair %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincronize uma convenção do iPhone",
    comingUpA11yFormat: "Em breve, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Sair em %1$@. Evento atual: %2$@. Próximo evento: %3$@, começa %4$@.",
    leaveA11yFormat: "Sair em %1$@ para %2$@, começa %3$@.",
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
    noMoreEventsToday: "Sem mais eventos hoje",
    noEventsTodayTitle: "Nenhum evento hoje",
    noEventsTodayMessage: "Seu próximo evento salvo é em outro dia.",
    minutesBeforeFormat: "%@ min antes",
    leaveReminderFormat: "Lembrete de saída %@",
    savedSchedule: "Programação salva",
    savedScheduleA11y: "Mostrando a última programação salva do seu iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "até %@",
    moreTodayFormat: "+%@ mais hoje",
    starredFormat: "%@ salvos",
    allDoneTitle: "Tudo pronto por hoje",
    firstTomorrowFormat: "Primeiro evento amanhã: %1$@, %2$@.",
    starHint: "Marque eventos no ConPaws para vê-los aqui."
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
    nextCaps: "HÄRNÄST",
    whereCaps: "VAR",
    nowCaps: "NU",
    leaveCaps: "GÅ",
    leaveInCaps: "GÅ OM",
    forCaps: "TILL",
    noEventsCaps: "INGA EVENEMANG",
    locationNotSet: "Ingen plats angiven",
    nowEventFormat: "Nu: %@",
    leaveIn: "Gå om",
    freeNow: "Ledig nu",
    noUpcomingEvents: "Inga kommande evenemang",
    addConventionHint: "Lägg till ett konvent i ConPaws.",
    addScheduleHint: "Lägg till eller importera ett schema i ConPaws.",
    addConvention: "Lägg till ett konvent",
    leaveForA11yFormat: "Gå till %1$@, %2$@",
    nextA11yFormat: "Härnäst: %1$@, %2$@",
    inlineLeaveFormat: "Gå %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synka ett konvent från iPhone",
    comingUpA11yFormat: "Kommande, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Gå om %1$@. Aktuellt evenemang: %2$@. Nästa evenemang: %3$@, börjar %4$@.",
    leaveA11yFormat: "Gå om %1$@ till %2$@, börjar %3$@.",
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
    noMoreEventsToday: "Inga fler evenemang i dag",
    noEventsTodayTitle: "Inga evenemang i dag",
    noEventsTodayMessage: "Ditt nästa sparade evenemang är en annan dag.",
    minutesBeforeFormat: "%@ min innan",
    leaveReminderFormat: "Påminnelse om att gå %@",
    savedSchedule: "Sparat schema",
    savedScheduleA11y: "Visar det senaste schemat som sparats från din iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "till %@",
    moreTodayFormat: "+%@ till i dag",
    starredFormat: "%@ sparade",
    allDoneTitle: "Klart för i dag",
    firstTomorrowFormat: "Första evenemanget i morgon: %1$@, %2$@.",
    starHint: "Stjärnmärk evenemang i ConPaws för att se dem här."
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
    nextCaps: "SIGUIENTE",
    whereCaps: "DÓNDE",
    nowCaps: "AHORA",
    leaveCaps: "SALIR",
    leaveInCaps: "SALIR EN",
    forCaps: "PARA",
    noEventsCaps: "SIN EVENTOS",
    locationNotSet: "Sin ubicación",
    nowEventFormat: "Ahora: %@",
    leaveIn: "Salir en",
    freeNow: "Ahora libre",
    noUpcomingEvents: "Sin eventos próximos",
    addConventionHint: "Agrega una convención en ConPaws.",
    addScheduleHint: "Agrega o importa un horario en ConPaws.",
    addConvention: "Agregar una convención",
    leaveForA11yFormat: "Salir hacia %1$@, %2$@",
    nextA11yFormat: "Siguiente: %1$@, %2$@",
    inlineLeaveFormat: "Salir %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincroniza una convención desde el iPhone",
    comingUpA11yFormat: "Próximamente, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Salir en %1$@. Evento actual: %2$@. Próximo evento: %3$@, empieza %4$@.",
    leaveA11yFormat: "Salir en %1$@ hacia %2$@, empieza %3$@.",
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
    noMoreEventsToday: "No hay más eventos hoy",
    noEventsTodayTitle: "Sin eventos hoy",
    noEventsTodayMessage: "Tu próximo evento guardado es otro día.",
    minutesBeforeFormat: "%@ min antes",
    leaveReminderFormat: "Recordatorio de salida %@",
    savedSchedule: "Horario guardado",
    savedScheduleA11y: "Mostrando el último horario guardado desde tu iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "hasta %@",
    moreTodayFormat: "+%@ más hoy",
    starredFormat: "%@ guardados",
    allDoneTitle: "Todo listo por hoy",
    firstTomorrowFormat: "Primer evento mañana: %1$@, %2$@.",
    starHint: "Marca eventos en ConPaws para verlos aquí."
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
    nextCaps: "SEGUINTE",
    whereCaps: "ONDE",
    nowCaps: "AGORA",
    leaveCaps: "SAIR",
    leaveInCaps: "SAIR DAQUI A",
    forCaps: "PARA",
    noEventsCaps: "SEM EVENTOS",
    locationNotSet: "Sem localização",
    nowEventFormat: "Agora: %@",
    leaveIn: "Sair daqui a",
    freeNow: "Livre agora",
    noUpcomingEvents: "Sem eventos próximos",
    addConventionHint: "Adiciona uma convenção no ConPaws.",
    addScheduleHint: "Adiciona ou importa um programa no ConPaws.",
    addConvention: "Adicionar uma convenção",
    leaveForA11yFormat: "Sair para %1$@, %2$@",
    nextA11yFormat: "Seguinte: %1$@, %2$@",
    inlineLeaveFormat: "Sair %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincroniza uma convenção a partir do iPhone",
    comingUpA11yFormat: "A seguir, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Sair daqui a %1$@. Evento atual: %2$@. Próximo evento: %3$@, começa %4$@.",
    leaveA11yFormat: "Sair daqui a %1$@ para %2$@, começa %3$@.",
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
    noMoreEventsToday: "Não há mais eventos hoje",
    noEventsTodayTitle: "Sem eventos hoje",
    noEventsTodayMessage: "O teu próximo evento guardado é noutro dia.",
    minutesBeforeFormat: "%@ min antes",
    leaveReminderFormat: "Lembrete de saída %@",
    savedSchedule: "Programa guardado",
    savedScheduleA11y: "A mostrar o último programa guardado do teu iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "até %@",
    moreTodayFormat: "+%@ hoje",
    starredFormat: "%@ guardados",
    allDoneTitle: "Tudo feito por hoje",
    firstTomorrowFormat: "Primeiro evento amanhã: %1$@, %2$@.",
    starHint: "Marca eventos no ConPaws para os veres aqui."
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
    nextCaps: "次",
    whereCaps: "場所",
    nowCaps: "現在",
    leaveCaps: "出発",
    leaveInCaps: "出発まで",
    forCaps: "行き先",
    noEventsCaps: "イベントなし",
    locationNotSet: "場所未設定",
    nowEventFormat: "現在: %@",
    leaveIn: "出発まで",
    freeNow: "今は空いています",
    noUpcomingEvents: "予定はありません",
    addConventionHint: "ConPawsでコンベンションを追加してください。",
    addScheduleHint: "ConPawsでスケジュールを追加またはインポートしてください。",
    addConvention: "コンベンションを追加",
    leaveForA11yFormat: "%1$@へ出発、%2$@",
    nextA11yFormat: "次: %1$@、%2$@",
    inlineLeaveFormat: "%@に出発",
    lowercasesInlineCountdown: false,
    syncFromPhone: "iPhoneからコンベンションを同期",
    comingUpA11yFormat: "この後、%1$@、%2$@",
    leaveWithCurrentA11yFormat: "%1$@後に出発。現在のイベント: %2$@。次のイベント: %3$@、%4$@開始。",
    leaveA11yFormat: "%2$@のため%1$@後に出発、%3$@開始。",
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
    noMoreEventsToday: "今日の予定は以上です",
    noEventsTodayTitle: "今日の予定なし",
    noEventsTodayMessage: "次に保存したイベントは別の日です。",
    minutesBeforeFormat: "%@分前",
    leaveReminderFormat: "出発リマインダー %@",
    savedSchedule: "保存済みスケジュール",
    savedScheduleA11y: "iPhoneから保存した最新のスケジュールを表示しています",
    compactMinutesFormat: "%@分",
    endsFormat: "%@まで",
    moreTodayFormat: "他%@件",
    starredFormat: "%@をお気に入り",
    allDoneTitle: "今日はこれで終わりです",
    firstTomorrowFormat: "明日の最初のイベント: %1$@、%2$@。",
    starHint: "ConPawsでイベントをお気に入りに追加すると、ここに表示されます。"
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
    nextCaps: "下一個",
    whereCaps: "地點",
    nowCaps: "現在",
    leaveCaps: "出發",
    leaveInCaps: "出發倒數",
    forCaps: "前往",
    noEventsCaps: "沒有議程",
    locationNotSet: "未設定地點",
    nowEventFormat: "現在：%@",
    leaveIn: "出發倒數",
    freeNow: "現在有空",
    noUpcomingEvents: "沒有接下來的議程",
    addConventionHint: "在 ConPaws 中新增一場展會。",
    addScheduleHint: "在 ConPaws 中新增或匯入議程表。",
    addConvention: "新增展會",
    leaveForA11yFormat: "前往 %1$@ 出發，%2$@",
    nextA11yFormat: "下一個：%1$@，%2$@",
    inlineLeaveFormat: "%@出發",
    lowercasesInlineCountdown: false,
    syncFromPhone: "從 iPhone 同步展會",
    comingUpA11yFormat: "接下來，%1$@，%2$@",
    leaveWithCurrentA11yFormat: "%1$@後出發。目前議程：%2$@。下個議程：%3$@，%4$@開始。",
    leaveA11yFormat: "%1$@後出發前往 %2$@，%3$@開始。",
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
    noMoreEventsToday: "今天沒有其他議程了",
    noEventsTodayTitle: "今天沒有議程",
    noEventsTodayMessage: "你下一個儲存的議程在其他日子。",
    minutesBeforeFormat: "提前 %@ 分鐘",
    leaveReminderFormat: "出發提醒 %@",
    savedSchedule: "已儲存的議程表",
    savedScheduleA11y: "顯示從 iPhone 儲存的最新議程表",
    compactMinutesFormat: "%@ 分鐘",
    endsFormat: "至 %@",
    moreTodayFormat: "今天還有 %@ 個",
    starredFormat: "已收藏 %@",
    allDoneTitle: "今天的行程結束了",
    firstTomorrowFormat: "明天第一個議程：%1$@，%2$@。",
    starHint: "在 ConPaws 中收藏議程，就會顯示在這裡。"
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
    nextCaps: "下一个",
    whereCaps: "地点",
    nowCaps: "现在",
    leaveCaps: "出发",
    leaveInCaps: "出发倒计时",
    forCaps: "前往",
    noEventsCaps: "没有活动",
    locationNotSet: "未设置地点",
    nowEventFormat: "现在：%@",
    leaveIn: "出发倒计时",
    freeNow: "现在有空",
    noUpcomingEvents: "没有接下来的活动",
    addConventionHint: "在 ConPaws 中添加一场展会。",
    addScheduleHint: "在 ConPaws 中添加或导入日程。",
    addConvention: "添加展会",
    leaveForA11yFormat: "前往 %1$@ 出发，%2$@",
    nextA11yFormat: "下一个：%1$@，%2$@",
    inlineLeaveFormat: "%@出发",
    lowercasesInlineCountdown: false,
    syncFromPhone: "从 iPhone 同步展会",
    comingUpA11yFormat: "接下来，%1$@，%2$@",
    leaveWithCurrentA11yFormat: "%1$@后出发。当前活动：%2$@。下个活动：%3$@，%4$@开始。",
    leaveA11yFormat: "%1$@后出发前往 %2$@，%3$@开始。",
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
    noMoreEventsToday: "今天没有其他活动了",
    noEventsTodayTitle: "今天没有活动",
    noEventsTodayMessage: "你下一个保存的活动在其他日子。",
    minutesBeforeFormat: "提前 %@ 分钟",
    leaveReminderFormat: "出发提醒 %@",
    savedSchedule: "已保存的日程",
    savedScheduleA11y: "显示从 iPhone 保存的最新日程",
    compactMinutesFormat: "%@ 分钟",
    endsFormat: "至 %@",
    moreTodayFormat: "今天还有 %@ 个",
    starredFormat: "已收藏 %@",
    allDoneTitle: "今天的行程结束了",
    firstTomorrowFormat: "明天第一个活动：%1$@，%2$@。",
    starHint: "在 ConPaws 中收藏活动，就会显示在这里。"
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
    nextCaps: "다음",
    whereCaps: "장소",
    nowCaps: "현재",
    leaveCaps: "출발",
    leaveInCaps: "출발까지",
    forCaps: "목적지",
    noEventsCaps: "일정 없음",
    locationNotSet: "장소 미설정",
    nowEventFormat: "현재: %@",
    leaveIn: "출발까지",
    freeNow: "지금은 비어 있음",
    noUpcomingEvents: "예정된 일정 없음",
    addConventionHint: "ConPaws에서 컨벤션을 추가하세요.",
    addScheduleHint: "ConPaws에서 일정을 추가하거나 가져오세요.",
    addConvention: "컨벤션 추가",
    leaveForA11yFormat: "%1$@(으)로 출발, %2$@",
    nextA11yFormat: "다음: %1$@, %2$@",
    inlineLeaveFormat: "%@ 출발",
    lowercasesInlineCountdown: false,
    syncFromPhone: "iPhone에서 컨벤션 동기화",
    comingUpA11yFormat: "다음 일정, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "%1$@ 후 출발. 현재 일정: %2$@. 다음 일정: %3$@, %4$@ 시작.",
    leaveA11yFormat: "%2$@을(를) 위해 %1$@ 후 출발, %3$@ 시작.",
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
    noMoreEventsToday: "오늘 남은 일정이 없습니다",
    noEventsTodayTitle: "오늘 일정 없음",
    noEventsTodayMessage: "다음에 저장한 일정은 다른 날입니다.",
    minutesBeforeFormat: "%@분 전",
    leaveReminderFormat: "출발 알림 %@",
    savedSchedule: "저장된 일정",
    savedScheduleA11y: "iPhone에서 저장한 최신 일정을 표시하고 있습니다",
    compactMinutesFormat: "%@분",
    endsFormat: "%@까지",
    moreTodayFormat: "오늘 %@개 더",
    starredFormat: "%@ 즐겨찾기",
    allDoneTitle: "오늘 일정을 모두 마쳤습니다",
    firstTomorrowFormat: "내일 첫 일정: %1$@, %2$@.",
    starHint: "ConPaws에서 일정을 즐겨찾기하면 여기에 표시됩니다."
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
    nextCaps: "PROSSIMO",
    whereCaps: "DOVE",
    nowCaps: "ADESSO",
    leaveCaps: "PARTIRE",
    leaveInCaps: "PARTIRE TRA",
    forCaps: "PER",
    noEventsCaps: "NESSUN EVENTO",
    locationNotSet: "Luogo non impostato",
    nowEventFormat: "Adesso: %@",
    leaveIn: "Partire tra",
    freeNow: "Libero adesso",
    noUpcomingEvents: "Nessun evento in arrivo",
    addConventionHint: "Aggiungi una convention in ConPaws.",
    addScheduleHint: "Aggiungi o importa un programma in ConPaws.",
    addConvention: "Aggiungi una convention",
    leaveForA11yFormat: "Partire per %1$@, %2$@",
    nextA11yFormat: "Prossimo: %1$@, %2$@",
    inlineLeaveFormat: "Partire %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Sincronizza una convention da iPhone",
    comingUpA11yFormat: "In arrivo, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Partire tra %1$@. Evento attuale: %2$@. Prossimo evento: %3$@, inizia %4$@.",
    leaveA11yFormat: "Partire tra %1$@ per %2$@, inizia %3$@.",
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
    noMoreEventsToday: "Nessun altro evento oggi",
    noEventsTodayTitle: "Nessun evento oggi",
    noEventsTodayMessage: "Il tuo prossimo evento salvato è un altro giorno.",
    minutesBeforeFormat: "%@ min prima",
    leaveReminderFormat: "Promemoria di partenza %@",
    savedSchedule: "Programma salvato",
    savedScheduleA11y: "Mostra l'ultimo programma salvato dal tuo iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "fino alle %@",
    moreTodayFormat: "+%@ oggi",
    starredFormat: "%@ preferiti",
    allDoneTitle: "Tutto fatto per oggi",
    firstTomorrowFormat: "Primo evento domani: %1$@, %2$@.",
    starHint: "Aggiungi eventi ai preferiti in ConPaws per vederli qui."
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
    nextCaps: "SETERUSNYA",
    whereCaps: "DI MANA",
    nowCaps: "SEKARANG",
    leaveCaps: "BERTOLAK",
    leaveInCaps: "BERTOLAK DALAM",
    forCaps: "UNTUK",
    noEventsCaps: "TIADA ACARA",
    locationNotSet: "Lokasi tidak ditetapkan",
    nowEventFormat: "Sekarang: %@",
    leaveIn: "Bertolak dalam",
    freeNow: "Lapang sekarang",
    noUpcomingEvents: "Tiada acara akan datang",
    addConventionHint: "Tambah konvensyen dalam ConPaws.",
    addScheduleHint: "Tambah atau import jadual dalam ConPaws.",
    addConvention: "Tambah konvensyen",
    leaveForA11yFormat: "Bertolak ke %1$@, %2$@",
    nextA11yFormat: "Seterusnya: %1$@, %2$@",
    inlineLeaveFormat: "Bertolak %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Segerakkan konvensyen dari iPhone",
    comingUpA11yFormat: "Akan datang, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Bertolak dalam %1$@. Acara semasa: %2$@. Acara seterusnya: %3$@, bermula %4$@.",
    leaveA11yFormat: "Bertolak dalam %1$@ ke %2$@, bermula %3$@.",
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
    noMoreEventsToday: "Tiada acara lagi hari ini",
    noEventsTodayTitle: "Tiada acara hari ini",
    noEventsTodayMessage: "Acara tersimpan anda yang seterusnya pada hari lain.",
    minutesBeforeFormat: "%@ min sebelum",
    leaveReminderFormat: "Peringatan bertolak %@",
    savedSchedule: "Jadual tersimpan",
    savedScheduleA11y: "Memaparkan jadual terkini yang disimpan dari iPhone anda",
    compactMinutesFormat: "%@ min",
    endsFormat: "hingga %@",
    moreTodayFormat: "+%@ lagi hari ini",
    starredFormat: "%@ dibintangi",
    allDoneTitle: "Selesai untuk hari ini",
    firstTomorrowFormat: "Acara pertama esok: %1$@, %2$@.",
    starHint: "Bintangkan acara dalam ConPaws untuk melihatnya di sini."
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
    nextCaps: "NÆSTE",
    whereCaps: "HVOR",
    nowCaps: "NU",
    leaveCaps: "GÅ",
    leaveInCaps: "GÅ OM",
    forCaps: "TIL",
    noEventsCaps: "INGEN BEGIVENHEDER",
    locationNotSet: "Sted ikke angivet",
    nowEventFormat: "Nu: %@",
    leaveIn: "Gå om",
    freeNow: "Fri nu",
    noUpcomingEvents: "Ingen kommende begivenheder",
    addConventionHint: "Tilføj et stævne i ConPaws.",
    addScheduleHint: "Tilføj eller importér et program i ConPaws.",
    addConvention: "Tilføj et stævne",
    leaveForA11yFormat: "Gå til %1$@, %2$@",
    nextA11yFormat: "Næste: %1$@, %2$@",
    inlineLeaveFormat: "Gå %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synkronisér et stævne fra iPhone",
    comingUpA11yFormat: "Næste, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Gå om %1$@. Nuværende begivenhed: %2$@. Næste begivenhed: %3$@, starter %4$@.",
    leaveA11yFormat: "Gå om %1$@ til %2$@, starter %3$@.",
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
    noMoreEventsToday: "Ikke flere begivenheder i dag",
    noEventsTodayTitle: "Ingen begivenheder i dag",
    noEventsTodayMessage: "Din næste gemte begivenhed er en anden dag.",
    minutesBeforeFormat: "%@ min før",
    leaveReminderFormat: "Afgangspåmindelse %@",
    savedSchedule: "Gemt program",
    savedScheduleA11y: "Viser det seneste program gemt fra din iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "til %@",
    moreTodayFormat: "+%@ mere i dag",
    starredFormat: "%@ markeret",
    allDoneTitle: "Færdig for i dag",
    firstTomorrowFormat: "Første begivenhed i morgen: %1$@, %2$@.",
    starHint: "Markér begivenheder i ConPaws for at se dem her."
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
    nextCaps: "NESTE",
    whereCaps: "HVOR",
    nowCaps: "NÅ",
    leaveCaps: "DRA",
    leaveInCaps: "DRA OM",
    forCaps: "TIL",
    noEventsCaps: "INGEN HENDELSER",
    locationNotSet: "Sted ikke angitt",
    nowEventFormat: "Nå: %@",
    leaveIn: "Dra om",
    freeNow: "Ledig nå",
    noUpcomingEvents: "Ingen kommende hendelser",
    addConventionHint: "Legg til et arrangement i ConPaws.",
    addScheduleHint: "Legg til eller importer et program i ConPaws.",
    addConvention: "Legg til et arrangement",
    leaveForA11yFormat: "Dra til %1$@, %2$@",
    nextA11yFormat: "Neste: %1$@, %2$@",
    inlineLeaveFormat: "Dra %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synkroniser et arrangement fra iPhone",
    comingUpA11yFormat: "Neste, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Dra om %1$@. Nåværende hendelse: %2$@. Neste hendelse: %3$@, starter %4$@.",
    leaveA11yFormat: "Dra om %1$@ til %2$@, starter %3$@.",
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
    noMoreEventsToday: "Ingen flere hendelser i dag",
    noEventsTodayTitle: "Ingen hendelser i dag",
    noEventsTodayMessage: "Neste lagrede hendelse er en annen dag.",
    minutesBeforeFormat: "%@ min før",
    leaveReminderFormat: "Avreisepåminnelse %@",
    savedSchedule: "Lagret program",
    savedScheduleA11y: "Viser det siste programmet lagret fra iPhone",
    compactMinutesFormat: "%@ min",
    endsFormat: "til %@",
    moreTodayFormat: "+%@ til i dag",
    starredFormat: "%@ stjernemerket",
    allDoneTitle: "Ferdig for i dag",
    firstTomorrowFormat: "Første hendelse i morgen: %1$@, %2$@.",
    starHint: "Stjernemerk hendelser i ConPaws for å se dem her."
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
    nextCaps: "SEURAAVA",
    whereCaps: "MISSÄ",
    nowCaps: "NYT",
    leaveCaps: "LÄHDE",
    leaveInCaps: "LÄHDE",
    forCaps: "KOHDE",
    noEventsCaps: "EI TAPAHTUMIA",
    locationNotSet: "Sijaintia ei asetettu",
    nowEventFormat: "Nyt: %@",
    leaveIn: "Lähde",
    freeNow: "Vapaana nyt",
    noUpcomingEvents: "Ei tulevia tapahtumia",
    addConventionHint: "Lisää tapahtuma ConPawsissa.",
    addScheduleHint: "Lisää tai tuo ohjelma ConPawsissa.",
    addConvention: "Lisää tapahtuma",
    leaveForA11yFormat: "Lähde kohteeseen %1$@, %2$@",
    nextA11yFormat: "Seuraava: %1$@, %2$@",
    inlineLeaveFormat: "Lähde %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synkronoi tapahtuma iPhonesta",
    comingUpA11yFormat: "Seuraavaksi, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Lähde %1$@ kuluttua. Nykyinen tapahtuma: %2$@. Seuraava tapahtuma: %3$@, alkaa %4$@.",
    leaveA11yFormat: "Lähde %1$@ kuluttua kohteeseen %2$@, alkaa %3$@.",
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
    noMoreEventsToday: "Ei enempää tapahtumia tänään",
    noEventsTodayTitle: "Ei tapahtumia tänään",
    noEventsTodayMessage: "Seuraava tallentamasi tapahtuma on toisena päivänä.",
    minutesBeforeFormat: "%@ min ennen",
    leaveReminderFormat: "Lähtömuistutus %@",
    savedSchedule: "Tallennettu ohjelma",
    savedScheduleA11y: "Näytetään viimeisin iPhonesta tallennettu ohjelma",
    compactMinutesFormat: "%@ min",
    endsFormat: "%@ asti",
    moreTodayFormat: "+%@ tänään",
    starredFormat: "%@ tähdellä",
    allDoneTitle: "Tämä päivä on hoidettu",
    firstTomorrowFormat: "Huomisen ensimmäinen tapahtuma: %1$@, %2$@.",
    starHint: "Merkitse tapahtumia tähdellä ConPawsissa nähdäksesi ne täällä."
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
    nextCaps: "DALŠÍ",
    whereCaps: "KDE",
    nowCaps: "TEĎ",
    leaveCaps: "ODEJÍT",
    leaveInCaps: "ODEJÍT ZA",
    forCaps: "NA",
    noEventsCaps: "ŽÁDNÉ UDÁLOSTI",
    locationNotSet: "Místo nenastaveno",
    nowEventFormat: "Teď: %@",
    leaveIn: "Odejít za",
    freeNow: "Teď volno",
    noUpcomingEvents: "Žádné nadcházející události",
    addConventionHint: "Přidej con v ConPaws.",
    addScheduleHint: "Přidej nebo importuj program v ConPaws.",
    addConvention: "Přidat con",
    leaveForA11yFormat: "Odejít na %1$@, %2$@",
    nextA11yFormat: "Další: %1$@, %2$@",
    inlineLeaveFormat: "Odejít %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Synchronizuj con z iPhonu",
    comingUpA11yFormat: "Následuje, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Odejít za %1$@. Aktuální událost: %2$@. Další událost: %3$@, začíná %4$@.",
    leaveA11yFormat: "Odejít za %1$@ na %2$@, začíná %3$@.",
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
    noMoreEventsToday: "Dnes už žádné události",
    noEventsTodayTitle: "Dnes žádné události",
    noEventsTodayMessage: "Tvá další uložená událost je jiný den.",
    minutesBeforeFormat: "%@ min předem",
    leaveReminderFormat: "Připomenutí odchodu %@",
    savedSchedule: "Uložený program",
    savedScheduleA11y: "Zobrazuje se poslední program uložený z tvého iPhonu",
    compactMinutesFormat: "%@ min",
    endsFormat: "do %@",
    moreTodayFormat: "+%@ dnes",
    starredFormat: "%@ s hvězdičkou",
    allDoneTitle: "Pro dnešek hotovo",
    firstTomorrowFormat: "První zítřejší událost: %1$@, %2$@.",
    starHint: "Označ události hvězdičkou v ConPaws a uvidíš je tady."
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
    nextCaps: "KÖVETKEZŐ",
    whereCaps: "HOL",
    nowCaps: "MOST",
    leaveCaps: "INDULÁS",
    leaveInCaps: "INDULÁS",
    forCaps: "IDE",
    noEventsCaps: "NINCS PROGRAM",
    locationNotSet: "Nincs megadva helyszín",
    nowEventFormat: "Most: %@",
    leaveIn: "Indulás",
    freeNow: "Most szabad",
    noUpcomingEvents: "Nincs közelgő program",
    addConventionHint: "Adj hozzá egy convent a ConPawsban.",
    addScheduleHint: "Adj hozzá vagy importálj programot a ConPawsban.",
    addConvention: "Convent hozzáadása",
    leaveForA11yFormat: "Indulás ide: %1$@, %2$@",
    nextA11yFormat: "Következő: %1$@, %2$@",
    inlineLeaveFormat: "Indulás %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Convent szinkronizálása iPhone-ról",
    comingUpA11yFormat: "Következik, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Indulás %1$@ múlva. Jelenlegi program: %2$@. Következő program: %3$@, kezdés: %4$@.",
    leaveA11yFormat: "Indulás %1$@ múlva ide: %2$@, kezdés: %3$@.",
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
    noMoreEventsToday: "Ma nincs több program",
    noEventsTodayTitle: "Ma nincs program",
    noEventsTodayMessage: "A következő mentett programod másik napon van.",
    minutesBeforeFormat: "%@ perccel előtte",
    leaveReminderFormat: "Indulási emlékeztető %@",
    savedSchedule: "Mentett program",
    savedScheduleA11y: "Az iPhone-odról mentett legutóbbi program látható",
    compactMinutesFormat: "%@ perc",
    endsFormat: "eddig: %@",
    moreTodayFormat: "+%@ ma",
    starredFormat: "%@ csillagozva",
    allDoneTitle: "Mára minden megvolt",
    firstTomorrowFormat: "Holnapi első program: %1$@, %2$@.",
    starHint: "Csillagozz programokat a ConPawsban, és itt látod őket."
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
    nextCaps: "НАСТУПНА",
    whereCaps: "ДЕ",
    nowCaps: "ЗАРАЗ",
    leaveCaps: "ВИХОДИТИ",
    leaveInCaps: "ВИХОДИТИ ЗА",
    forCaps: "НА",
    noEventsCaps: "НЕМАЄ ПОДІЙ",
    locationNotSet: "Місце не вказано",
    nowEventFormat: "Зараз: %@",
    leaveIn: "Виходити за",
    freeNow: "Зараз вільно",
    noUpcomingEvents: "Немає найближчих подій",
    addConventionHint: "Додай конвент у ConPaws.",
    addScheduleHint: "Додай або імпортуй розклад у ConPaws.",
    addConvention: "Додати конвент",
    leaveForA11yFormat: "Виходити на %1$@, %2$@",
    nextA11yFormat: "Наступна: %1$@, %2$@",
    inlineLeaveFormat: "Виходити %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Синхронізуй конвент з iPhone",
    comingUpA11yFormat: "Далі, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Виходити за %1$@. Поточна подія: %2$@. Наступна подія: %3$@, починається %4$@.",
    leaveA11yFormat: "Виходити за %1$@ на %2$@, починається %3$@.",
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
    noMoreEventsToday: "Сьогодні більше подій немає",
    noEventsTodayTitle: "Сьогодні немає подій",
    noEventsTodayMessage: "Твоя наступна збережена подія іншого дня.",
    minutesBeforeFormat: "за %@ хв",
    leaveReminderFormat: "Нагадування про вихід %@",
    savedSchedule: "Збережений розклад",
    savedScheduleA11y: "Показано останній розклад, збережений з твого iPhone",
    compactMinutesFormat: "%@ хв",
    endsFormat: "до %@",
    moreTodayFormat: "+%@ сьогодні",
    starredFormat: "%@ у вибраному",
    allDoneTitle: "На сьогодні все",
    firstTomorrowFormat: "Перша подія завтра: %1$@, %2$@.",
    starHint: "Познач події зірочкою в ConPaws, щоб бачити їх тут."
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
    nextCaps: "СЛЕДУЮЩЕЕ",
    whereCaps: "ГДЕ",
    nowCaps: "СЕЙЧАС",
    leaveCaps: "ВЫХОДИТЬ",
    leaveInCaps: "ВЫХОДИТЬ ЧЕРЕЗ",
    forCaps: "НА",
    noEventsCaps: "НЕТ СОБЫТИЙ",
    locationNotSet: "Место не указано",
    nowEventFormat: "Сейчас: %@",
    leaveIn: "Выходить через",
    freeNow: "Сейчас свободно",
    noUpcomingEvents: "Нет ближайших событий",
    addConventionHint: "Добавь конвент в ConPaws.",
    addScheduleHint: "Добавь или импортируй расписание в ConPaws.",
    addConvention: "Добавить конвент",
    leaveForA11yFormat: "Выходить на %1$@, %2$@",
    nextA11yFormat: "Следующее: %1$@, %2$@",
    inlineLeaveFormat: "Выходить %@",
    lowercasesInlineCountdown: true,
    syncFromPhone: "Синхронизируй конвент с iPhone",
    comingUpA11yFormat: "Далее, %1$@, %2$@",
    leaveWithCurrentA11yFormat: "Выходить через %1$@. Текущее событие: %2$@. Следующее событие: %3$@, начало %4$@.",
    leaveA11yFormat: "Выходить через %1$@ на %2$@, начало %3$@.",
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
    noMoreEventsToday: "Сегодня событий больше нет",
    noEventsTodayTitle: "Сегодня событий нет",
    noEventsTodayMessage: "Твоё следующее сохранённое событие в другой день.",
    minutesBeforeFormat: "за %@ мин",
    leaveReminderFormat: "Напоминание о выходе %@",
    savedSchedule: "Сохранённое расписание",
    savedScheduleA11y: "Показано последнее расписание, сохранённое с твоего iPhone",
    compactMinutesFormat: "%@ мин",
    endsFormat: "до %@",
    moreTodayFormat: "+%@ сегодня",
    starredFormat: "%@ в избранном",
    allDoneTitle: "На сегодня всё",
    firstTomorrowFormat: "Первое событие завтра: %1$@, %2$@.",
    starHint: "Отмечай события звёздочкой в ConPaws, чтобы видеть их здесь."
  )
}
