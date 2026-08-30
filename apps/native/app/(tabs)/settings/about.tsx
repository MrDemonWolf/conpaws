import ArrowOutwardIcon from "@expo/material-symbols/arrow_outward.xml";
import ChevronRightIcon from "@expo/material-symbols/chevron_right.xml";
import DescriptionIcon from "@expo/material-symbols/description.xml";
import ForumIcon from "@expo/material-symbols/forum.xml";
import HelpIcon from "@expo/material-symbols/help.xml";
import MailIcon from "@expo/material-symbols/mail.xml";
import PublicIcon from "@expo/material-symbols/public.xml";
import {
  Column,
  FieldGroup,
  Host,
  Icon,
  ListItem,
  Text as NativeText,
  RNHostView,
} from "@expo/ui";
import { font } from "@expo/ui/swift-ui/modifiers";
import { router } from "expo-router";
import { useTheme } from "expo-router/react-navigation";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { Image, Linking, useWindowDimensions, View } from "react-native";

import { Text } from "@/components/ui";
import licenses from "@/generated/open-source-licenses.json";
import { useResolvedColorScheme } from "@/hooks/useResolvedColorScheme";
import { useVersionLabel } from "@/hooks/useVersionLabel";

const LICENSE_ICON = Icon.select({ ios: "doc.text", android: DescriptionIcon });
const CHEVRON_ICON = Icon.select({
  ios: "chevron.right",
  android: ChevronRightIcon,
});
const WEBSITE_ICON = Icon.select({ ios: "globe", android: PublicIcon });
const EMAIL_ICON = Icon.select({ ios: "envelope", android: MailIcon });
const COMMUNITY_ICON = Icon.select({ ios: "person.3", android: ForumIcon });
const HELP_ICON = Icon.select({
  ios: "questionmark.circle",
  android: HelpIcon,
});
const EXTERNAL_ICON = Icon.select({
  ios: "arrow.up.right",
  android: ArrowOutwardIcon,
});

function NativeIcon({ name }: { name: ReturnType<typeof Icon.select> }) {
  return <Icon name={name} size={22} />;
}

function ExternalIndicator() {
  return <Icon name={EXTERNAL_ICON} size={15} />;
}

function NavigationIndicator() {
  return <Icon name={CHEVRON_ICON} size={15} />;
}

export default function AboutScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const resolvedColorScheme = useResolvedColorScheme();
  const versionLabel = useVersionLabel();
  const heroWidth = Math.min(520, Math.max(260, width - 64));

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={colors.primary}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section>
          <Column alignment="center" style={{ paddingVertical: 24 }}>
            <RNHostView matchContents>
              <View
                accessible
                accessibilityLabel={`ConPaws. ${t("settings.about.tagline")} ${versionLabel}.`}
                accessibilityRole="summary"
                style={{
                  width: heroWidth,
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 16,
                }}
              >
                <Image
                  source={require("../../../assets/images/icon.png")}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  resizeMode="contain"
                  accessible={false}
                  accessibilityIgnoresInvertColors
                />
                {/* Design-system variants, not inline fontSize: these three
                    lines were the only text in the app that opted out of the
                    Dynamic Type ramp `ui/Text` applies. */}
                <Text variant="h1" className="text-center">
                  ConPaws
                </Text>
                <Text
                  variant="body"
                  className="text-center text-muted-foreground"
                >
                  {t("settings.about.tagline")}
                </Text>
                <Text selectable variant="caption" className="tabular-nums">
                  {versionLabel}
                </Text>
              </View>
            </RNHostView>
          </Column>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.about.support")}>
          <ListItem
            leading={<NativeIcon name={HELP_ICON} />}
            supportingText="conpaws.com/support"
            trailing={<ExternalIndicator />}
            onPress={() =>
              WebBrowser.openBrowserAsync("https://conpaws.com/support")
            }
          >
            {t("settings.about.helpCenter")}
          </ListItem>
          <ListItem
            leading={<NativeIcon name={EMAIL_ICON} />}
            supportingText="legal@conpaws.com"
            trailing={<ExternalIndicator />}
            onPress={() => Linking.openURL("mailto:legal@conpaws.com")}
          >
            {t("settings.about.email")}
          </ListItem>
          <ListItem
            leading={<NativeIcon name={COMMUNITY_ICON} />}
            supportingText={t("settings.about.discordDescription")}
            trailing={<ExternalIndicator />}
            onPress={() =>
              WebBrowser.openBrowserAsync("https://discord.gg/conpaws")
            }
          >
            Discord
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.about.resources")}>
          <ListItem
            leading={<NativeIcon name={WEBSITE_ICON} />}
            supportingText="conpaws.com"
            trailing={<ExternalIndicator />}
            onPress={() => WebBrowser.openBrowserAsync("https://conpaws.com")}
          >
            {t("settings.about.website")}
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.about.builtWith")}>
          <ListItem
            leading={<NativeIcon name={LICENSE_ICON} />}
            supportingText={t("settings.about.licenseDescription", {
              count: licenses.packages.length,
            })}
            trailing={<NavigationIndicator />}
            onPress={() => router.push("/settings/licenses")}
          >
            {t("settings.legal.openSourceLicenses")}
          </ListItem>
          <FieldGroup.SectionFooter>
            <NativeText
              textStyle={{ fontSize: 13 }}
              modifiers={[font({ textStyle: "footnote" })]}
            >
              {t("settings.about.copyright")}
            </NativeText>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
