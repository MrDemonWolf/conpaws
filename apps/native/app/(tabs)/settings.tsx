import { View, ScrollView, Pressable, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { SafeView, Text, Separator } from '@/components/ui';
import { SectionHeader } from '@/components/SectionHeader';
import i18n, { type SupportedLanguage } from '@/lib/i18n';
import { useExportData } from '@/services/data-export';
import { useImportData } from '@/services/data-import';

interface SettingsRowProps {
  label: string;
  subtitle?: string;
  onPress?: () => void;
  destructive?: boolean;
  badge?: string;
  disabled?: boolean;
}

function SettingsRow({ label, subtitle, onPress, destructive = false, badge, disabled = false }: SettingsRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`px-4 py-3.5 flex-row items-center justify-between active:opacity-70 bg-card ${disabled ? 'opacity-50' : ''}`}
    >
      <View className="flex-1">
        <Text
          variant="body"
          className={destructive ? 'text-destructive' : 'text-foreground'}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text variant="caption" className="text-muted-foreground">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View className="bg-muted px-2 py-0.5 rounded-md mr-2">
          <Text variant="caption" className="text-muted-foreground">{badge}</Text>
        </View>
      ) : null}
      <Text className="text-muted-foreground text-lg">›</Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { exportData, isLoading: isExporting } = useExportData();
  const { importData, isLoading: isImporting } = useImportData();

  const version = Constants.expoConfig?.version ?? '0.0.0';

  async function handleResetOnboarding() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Warning);
    Alert.alert(
      'Reset Onboarding',
      'This will show the onboarding screens again next time you open the app.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('hasCompletedOnboarding');
            router.replace('/(onboarding)/welcome');
          },
        },
      ],
    );
  }

  function handleSignIn() {
    Alert.alert('Coming Soon', 'Account sync is coming in a future update.');
  }

  return (
    <SafeView edges={['top', 'bottom']}>
      <View className="px-4 py-3">
        <Text variant="h2">{t('settings.title')}</Text>
      </View>
      <ScrollView className="flex-1">
        {/* Account */}
        <SectionHeader title={t('settings.account.title')} />
        <SettingsRow
          label={t('settings.account.signIn')}
          badge="Coming Soon"
          onPress={handleSignIn}
        />

        {/* App */}
        <SectionHeader title={t('settings.app.title')} />
        <SettingsRow
          label={t('settings.app.language')}
          subtitle={t(`settings.languages.${i18n.language as SupportedLanguage}`, { defaultValue: 'English' })}
          onPress={() => router.push('/settings/language')}
        />
        <Separator />
        <SettingsRow
          label="Reset Onboarding"
          onPress={handleResetOnboarding}
        />
        <Separator />
        <SettingsRow
          label={t('settings.legal.about')}
          onPress={() => router.push('/settings/about')}
        />

        {/* Data */}
        <SectionHeader title={t('settings.data.title')} />
        <SettingsRow
          label={t('settings.data.exportData')}
          subtitle="Save a backup of all your data"
          onPress={() => exportData()}
          disabled={isExporting}
        />
        <Separator />
        <SettingsRow
          label={t('settings.data.importData')}
          subtitle="Restore from a backup file"
          onPress={() => importData()}
          disabled={isImporting}
        />

        {/* Legal */}
        <SectionHeader title={t('settings.legal.title')} />
        <SettingsRow
          label={t('settings.legal.privacyPolicy')}
          onPress={() => Linking.openURL('https://conpaws.com/privacy')}
        />
        <Separator />
        <SettingsRow
          label={t('settings.legal.termsOfService')}
          onPress={() => Linking.openURL('https://conpaws.com/terms')}
        />

        <View className="py-8 items-center">
          <Text variant="caption">{t('common.version', { version })}</Text>
        </View>
      </ScrollView>
    </SafeView>
  );
}
