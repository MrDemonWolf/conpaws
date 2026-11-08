import { LAUNCH } from "@/content/launch";
import type { Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/index";
import { localeHref } from "@/i18n/routing";
import { AppearancePicker } from "./appearance-picker";
import { CompassPaw } from "./compass-paw";
import { LanguageSwitcher } from "./language-switcher";
import styles from "./site-header.module.css";
import { SiteHeaderMenu } from "./site-header-menu";
import { SitePreferences } from "./site-preferences";

type SiteHeaderProps = {
  locale: Locale;
  messages: Messages;
  homePage?: boolean;
  showWaitlist?: boolean;
};

/** Render outside the page's constrained shell so the opaque header spans it. */
export function SiteHeader({
  locale,
  messages,
  homePage = false,
  showWaitlist,
}: SiteHeaderProps) {
  const showCta = showWaitlist ?? LAUNCH.mode === "waitlist";
  const home = localeHref(locale);
  const anchor = (id: string) => `${homePage ? "" : home}#${id}`;
  const links = [
    { href: anchor("inside"), label: messages.nav.inside },
    { href: anchor("features"), label: messages.nav.features },
    { href: anchor("faq"), label: messages.nav.faq },
    { href: "/updates", label: messages.nav.updates },
  ];
  const brand = (
    <a className={styles.brand} href={home}>
      <CompassPaw className={styles.mark} />
      <span>ConPaws</span>
    </a>
  );
  const navigation = (mobile = false) => (
    <nav
      aria-label={messages.nav.primaryLabel}
      className={mobile ? styles.mobileNav : styles.desktopNav}
    >
      {links.map((link) => (
        <a key={link.href} href={link.href}>
          {link.label}
        </a>
      ))}
    </nav>
  );
  const waitlist = showCta ? (
    <a className={styles.waitlist} href={anchor("waitlist")}>
      {messages.nav.joinWaitlist}
    </a>
  ) : null;
  const mobileContent = (
    <>
      {navigation(true)}
      <div className={styles.mobileLanguage}>
        <LanguageSwitcher
          current={locale}
          label={messages.nav.languageLabel}
          presentation="inline"
        />
      </div>
      <AppearancePicker labels={messages.appearance} />
      {waitlist}
    </>
  );

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {brand}
        <div className={styles.desktop}>
          {navigation()}
          <SitePreferences
            label={`${messages.nav.languageLabel} / ${messages.appearance.label}`}
          >
            <LanguageSwitcher
              current={locale}
              label={messages.nav.languageLabel}
              presentation="inline"
            />
            <AppearancePicker labels={messages.appearance} />
          </SitePreferences>
          {waitlist}
        </div>
        <SiteHeaderMenu
          brand={brand}
          menuLabel={messages.nav.menu}
          openLabel={messages.nav.openMenu}
          closeLabel={messages.nav.closeMenu}
        >
          {mobileContent}
        </SiteHeaderMenu>
      </div>
      <noscript>
        <div className={styles.noScript}>{mobileContent}</div>
      </noscript>
    </header>
  );
}
