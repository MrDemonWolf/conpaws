import Foundation

/// What the Watch app says under a plan button when the phone declined the
/// tap: one short line that the change did not happen, and why.
///
/// Watch-only wording, with no phone catalog to copy, written in every
/// language the app ships. A table of its own, beside `ConPawsStrings` and
/// resolved by the same `ConPawsLanguage`, so this feature's words do not
/// widen the shared table every Watch change edits. TapResultStringsTests
/// holds every language to the full set and to the wrist's width. Where a
/// language names the convention or the schedule elsewhere in the app, these
/// use the same word, and they address the wearer as the phone app does in
/// that language (formal in French, Ukrainian and Russian).
struct ConPawsTapResultStrings: Sendable {
  let language: ConPawsLanguage
  /// The phone changed the panel after the tap.
  let changedOnIphone: String
  /// An add of a panel the convention cancelled.
  let cancelled: String
  /// The panel is gone from the schedule.
  let offSchedule: String
  /// An add the Watch cannot make, such as a drop-in.
  let addOnIphone: String
  /// More than a day old.
  let tooOld: String
  /// The phone tried and gave up.
  let failed: String

  /// Every line, for the tests.
  var values: [String] {
    [changedOnIphone, cancelled, offSchedule, addOnIphone, tooOld, failed]
  }
}

extension ConPawsStrings {
  /// This language's reasons for a declined tap.
  var tapResultStrings: ConPawsTapResultStrings {
    ConPawsTapResultStrings.table(for: language)
  }

  /// The line for `decline`. A tap the phone declined without saying why
  /// gets the phone's own "could not be changed" wording.
  func declineText(_ decline: ConPawsWatchTapDecline) -> String {
    let reasons = tapResultStrings
    return switch decline {
    case .changedOnIphone: reasons.changedOnIphone
    case .cancelled: reasons.cancelled
    case .offSchedule: reasons.offSchedule
    case .addOnIphone: reasons.addOnIphone
    case .tooOld: reasons.tooOld
    case .failed: reasons.failed
    case .unknown: notChanged
    }
  }
}

// MARK: - Translations

extension ConPawsTapResultStrings {
  static func table(for language: ConPawsLanguage) -> ConPawsTapResultStrings {
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

  private static let en = ConPawsTapResultStrings(
    language: .en,
    changedOnIphone: "Not changed: edited on iPhone",
    cancelled: "Not added: the convention cancelled it",
    offSchedule: "Not changed: no longer on the schedule",
    addOnIphone: "Not added: add this one on iPhone",
    tooOld: "Not changed: over a day old",
    failed: "Not changed: try again",
  )

  private static let es419 = ConPawsTapResultStrings(
    language: .es419,
    changedOnIphone: "Sin cambios: se editó en el iPhone",
    cancelled: "No se agregó: la convención lo canceló",
    offSchedule: "Sin cambios: ya no está en el programa",
    addOnIphone: "No se agregó: agrégalo en el iPhone",
    tooOld: "Sin cambios: pasó más de un día",
    failed: "Sin cambios: inténtalo de nuevo",
  )

  private static let esES = ConPawsTapResultStrings(
    language: .esES,
    changedOnIphone: "Sin cambios: se ha editado en el iPhone",
    cancelled: "No añadido: la convención lo ha cancelado",
    offSchedule: "Sin cambios: ya no está en el programa",
    addOnIphone: "No añadido: añádelo en el iPhone",
    tooOld: "Sin cambios: ha pasado más de un día",
    failed: "Sin cambios: inténtalo de nuevo",
  )

  private static let ptBR = ConPawsTapResultStrings(
    language: .ptBR,
    changedOnIphone: "Sem alterações: editado no iPhone",
    cancelled: "Não adicionado: cancelado pela convenção",
    offSchedule: "Sem alterações: saiu da programação",
    addOnIphone: "Não adicionado: adicione no iPhone",
    tooOld: "Sem alterações: passou mais de um dia",
    failed: "Sem alterações: tente de novo",
  )

  private static let ptPT = ConPawsTapResultStrings(
    language: .ptPT,
    changedOnIphone: "Sem alterações: editado no iPhone",
    cancelled: "Não adicionado: cancelado pela convenção",
    offSchedule: "Sem alterações: saiu do programa",
    addOnIphone: "Não adicionado: adiciona-o no iPhone",
    tooOld: "Sem alterações: passou mais de um dia",
    failed: "Sem alterações: tenta novamente",
  )

  private static let ja = ConPawsTapResultStrings(
    language: .ja,
    changedOnIphone: "変更なし：iPhoneで編集済み",
    cancelled: "追加できません：コンベンション側で中止されました",
    offSchedule: "変更なし：スケジュールにありません",
    addOnIphone: "追加できません：iPhoneで追加してください",
    tooOld: "変更なし：1日以上前の操作です",
    failed: "変更なし：もう一度お試しください",
  )

  private static let zhTW = ConPawsTapResultStrings(
    language: .zhTW,
    changedOnIphone: "未變更：已在 iPhone 上編輯",
    cancelled: "未加入：已被展會取消",
    offSchedule: "未變更：已不在行程中",
    addOnIphone: "未加入：請在 iPhone 上加入",
    tooOld: "未變更：已超過一天",
    failed: "未變更：請再試一次",
  )

  private static let zhCN = ConPawsTapResultStrings(
    language: .zhCN,
    changedOnIphone: "未更改：已在 iPhone 上编辑",
    cancelled: "未添加：已被展会取消",
    offSchedule: "未更改：已不在日程中",
    addOnIphone: "未添加：请在 iPhone 上添加",
    tooOld: "未更改：已超过一天",
    failed: "未更改：请重试",
  )

  private static let ko = ConPawsTapResultStrings(
    language: .ko,
    changedOnIphone: "변경 안 됨: iPhone에서 수정됨",
    cancelled: "추가 안 됨: 컨벤션에서 취소됨",
    offSchedule: "변경 안 됨: 일정에서 제외됨",
    addOnIphone: "추가 안 됨: iPhone에서 추가하세요",
    tooOld: "변경 안 됨: 하루가 지남",
    failed: "변경 안 됨: 다시 시도하세요",
  )

  private static let de = ConPawsTapResultStrings(
    language: .de,
    changedOnIphone: "Nicht geändert: auf dem iPhone bearbeitet",
    cancelled: "Nicht hinzugefügt: von der Convention abgesagt",
    offSchedule: "Nicht geändert: nicht mehr im Programm",
    addOnIphone: "Nicht hinzugefügt: auf dem iPhone hinzufügen",
    tooOld: "Nicht geändert: älter als ein Tag",
    failed: "Nicht geändert: versuch es noch mal",
  )

  private static let fr = ConPawsTapResultStrings(
    language: .fr,
    changedOnIphone: "Inchangé : modifié sur l'iPhone",
    cancelled: "Non ajouté : annulé par la convention",
    offSchedule: "Inchangé : retiré du programme",
    addOnIphone: "Non ajouté : ajoutez-le sur l'iPhone",
    tooOld: "Inchangé : plus d'un jour s'est écoulé",
    failed: "Inchangé : réessayez",
  )

  private static let pl = ConPawsTapResultStrings(
    language: .pl,
    changedOnIphone: "Bez zmian: edytowano na iPhonie",
    cancelled: "Nie dodano: organizator to odwołał",
    offSchedule: "Bez zmian: poza harmonogramem",
    addOnIphone: "Nie dodano: dodaj na iPhonie",
    tooOld: "Bez zmian: minęła ponad doba",
    failed: "Bez zmian: spróbuj ponownie",
  )

  private static let it = ConPawsTapResultStrings(
    language: .it,
    changedOnIphone: "Nessuna modifica: modificato su iPhone",
    cancelled: "Non aggiunto: annullato dalla convention",
    offSchedule: "Nessuna modifica: fuori dal programma",
    addOnIphone: "Non aggiunto: aggiungilo su iPhone",
    tooOld: "Nessuna modifica: più di un giorno fa",
    failed: "Nessuna modifica: riprova",
  )

  private static let nl = ConPawsTapResultStrings(
    language: .nl,
    changedOnIphone: "Niet gewijzigd: bewerkt op iPhone",
    cancelled: "Niet toegevoegd: geannuleerd door de conventie",
    offSchedule: "Niet gewijzigd: niet meer op het programma",
    addOnIphone: "Niet toegevoegd: voeg het toe op iPhone",
    tooOld: "Niet gewijzigd: ouder dan een dag",
    failed: "Niet gewijzigd: probeer het opnieuw",
  )

  private static let ms = ConPawsTapResultStrings(
    language: .ms,
    changedOnIphone: "Tiada perubahan: disunting pada iPhone",
    cancelled: "Tidak ditambah: dibatalkan oleh konvensyen",
    offSchedule: "Tiada perubahan: tiada dalam jadual",
    addOnIphone: "Tidak ditambah: tambah pada iPhone",
    tooOld: "Tiada perubahan: lebih sehari lalu",
    failed: "Tiada perubahan: cuba lagi",
  )

  private static let sv = ConPawsTapResultStrings(
    language: .sv,
    changedOnIphone: "Inte ändrat: redigerat på iPhone",
    cancelled: "Inte tillagt: inställt av konventet",
    offSchedule: "Inte ändrat: borta ur programmet",
    addOnIphone: "Inte tillagt: lägg till på iPhone",
    tooOld: "Inte ändrat: äldre än ett dygn",
    failed: "Inte ändrat: försök igen",
  )

  private static let da = ConPawsTapResultStrings(
    language: .da,
    changedOnIphone: "Ikke ændret: redigeret på iPhone",
    cancelled: "Ikke tilføjet: aflyst af konventet",
    offSchedule: "Ikke ændret: ikke længere på programmet",
    addOnIphone: "Ikke tilføjet: tilføj på iPhone",
    tooOld: "Ikke ændret: ældre end et døgn",
    failed: "Ikke ændret: prøv igen",
  )

  private static let nb = ConPawsTapResultStrings(
    language: .nb,
    changedOnIphone: "Ikke endret: redigert på iPhone",
    cancelled: "Ikke lagt til: avlyst av konventet",
    offSchedule: "Ikke endret: ute av programmet",
    addOnIphone: "Ikke lagt til: legg til på iPhone",
    tooOld: "Ikke endret: eldre enn ett døgn",
    failed: "Ikke endret: prøv igjen",
  )

  private static let fi = ConPawsTapResultStrings(
    language: .fi,
    changedOnIphone: "Ei muutettu: muokattu iPhonessa",
    cancelled: "Ei lisätty: tapahtuma peruttiin",
    offSchedule: "Ei muutettu: poissa ohjelmasta",
    addOnIphone: "Ei lisätty: lisää iPhonella",
    tooOld: "Ei muutettu: yli vuorokauden vanha",
    failed: "Ei muutettu: yritä uudelleen",
  )

  private static let cs = ConPawsTapResultStrings(
    language: .cs,
    changedOnIphone: "Beze změny: upraveno na iPhonu",
    cancelled: "Nepřidáno: pořadatel to zrušil",
    offSchedule: "Beze změny: mimo program",
    addOnIphone: "Nepřidáno: přidej na iPhonu",
    tooOld: "Beze změny: starší než den",
    failed: "Beze změny: zkus to znovu",
  )

  private static let hu = ConPawsTapResultStrings(
    language: .hu,
    changedOnIphone: "Nem változott: iPhone-on szerkesztve",
    cancelled: "Nincs hozzáadva: a con törölte",
    offSchedule: "Nem változott: lekerült a programról",
    addOnIphone: "Nincs hozzáadva: add hozzá iPhone-on",
    tooOld: "Nem változott: egy napnál régebbi",
    failed: "Nem változott: próbáld újra",
  )

  private static let uk = ConPawsTapResultStrings(
    language: .uk,
    changedOnIphone: "Без змін: змінено на iPhone",
    cancelled: "Не додано: організатори скасували",
    offSchedule: "Без змін: немає в розкладі",
    addOnIphone: "Не додано: додайте на iPhone",
    tooOld: "Без змін: минуло понад добу",
    failed: "Без змін: спробуйте ще раз",
  )

  private static let ru = ConPawsTapResultStrings(
    language: .ru,
    changedOnIphone: "Без изменений: изменено на iPhone",
    cancelled: "Не добавлено: организаторы отменили",
    offSchedule: "Без изменений: нет в расписании",
    addOnIphone: "Не добавлено: добавьте на iPhone",
    tooOld: "Без изменений: прошло больше суток",
    failed: "Без изменений: попробуйте ещё раз",
  )
}
