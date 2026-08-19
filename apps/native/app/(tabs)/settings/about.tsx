import ArrowOutwardIcon from "@expo/material-symbols/arrow_outward.xml";
import CodeIcon from "@expo/material-symbols/code.xml";
import ForumIcon from "@expo/material-symbols/forum.xml";
import MailIcon from "@expo/material-symbols/mail.xml";
import PublicIcon from "@expo/material-symbols/public.xml";
import { FieldGroup, Host, Icon, ListItem, Text as NativeText } from "@expo/ui";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { Image, Linking, useColorScheme } from "react-native";

const SOURCE_ICON = Icon.select({
  ios: "chevron.left.forwardslash.chevron.right",
  android: CodeIcon,
});
const WEBSITE_ICON = Icon.select({ ios: "globe", android: PublicIcon });
const EMAIL_ICON = Icon.select({ ios: "envelope", android: MailIcon });
const COMMUNITY_ICON = Icon.select({ ios: "person.3", android: ForumIcon });
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

export default function AboutScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const resolvedColorScheme = colorScheme === "dark" ? "dark" : "light";
  const version = Constants.expoConfig?.version ?? "0.0.0";

  return (
    <Host
      colorScheme={resolvedColorScheme}
      seedColor={resolvedColorScheme === "dark" ? "#18B7F2" : "#006F91"}
      style={{ flex: 1 }}
      useViewportSizeMeasurement
    >
      <FieldGroup>
        <FieldGroup.Section>
          <ListItem
            leading={
              <Image
                source={require("../../../assets/images/icon.png")}
                style={{ width: 64, height: 64, borderRadius: 14 }}
                resizeMode="contain"
                accessible={false}
              />
            }
            supportingText={`${t("settings.about.tagline")}\n${t(
              "common.version",
              { version },
            )}`}
          >
            ConPaws
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.about.resources")}>
          <ListItem
            leading={<NativeIcon name={SOURCE_ICON} />}
            supportingText="GitHub"
            trailing={<ExternalIndicator />}
            onPress={() =>
              WebBrowser.openBrowserAsync(
                "https://github.com/mrdemonwolf/conpaws",
              )
            }
          >
            {t("settings.about.sourceCode")}
          </ListItem>
          <ListItem
            leading={<NativeIcon name={WEBSITE_ICON} />}
            supportingText="mrdemonwolf.com"
            trailing={<ExternalIndicator />}
            onPress={() =>
              WebBrowser.openBrowserAsync("https://mrdemonwolf.com")
            }
          >
            {t("settings.about.website")}
          </ListItem>
        </FieldGroup.Section>

        <FieldGroup.Section title={t("settings.about.support")}>
          <ListItem
            leading={<NativeIcon name={EMAIL_ICON} />}
            supportingText="hello@conpaws.com"
            trailing={<ExternalIndicator />}
            onPress={() => Linking.openURL("mailto:hello@conpaws.com")}
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
          <FieldGroup.SectionFooter>
            <NativeText>
              {t("settings.about.copyright", {
                year: new Date().getFullYear(),
              })}
            </NativeText>
          </FieldGroup.SectionFooter>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
