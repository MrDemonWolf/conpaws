import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { SafeView, Text, Button } from '@/components/ui';
import { parseIcs, type ParsedEvent, type CategoryMeta } from '@/lib/ical-parser';
import { fetchSchedIcs, InvalidSchedUrlError, NetworkError, InvalidResponseError } from '@/lib/sched-extractor';
import { useImportSchedule } from '@/hooks/useImportSchedule';
import { FileX, WifiOff, CalendarX, ChevronLeft } from 'lucide-react-native';

type Tab = 'file' | 'url';

interface ErrorState {
  type: 'file-type' | 'network' | 'no-events' | 'parse';
  message: string;
}

interface PreviewState {
  events: ParsedEvent[];
  categories: CategoryMeta[];
  selectedCategories: Set<string>;
}

export default function ImportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const importMutation = useImportSchedule();

  const [activeTab, setActiveTab] = useState<Tab>('file');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  function clearState() {
    setError(null);
    setPreview(null);
  }

  function processIcs(icsContent: string) {
    const result = parseIcs(icsContent);

    if (result.events.length === 0) {
      setError({ type: 'no-events', message: 'No events found in this calendar file.' });
      return;
    }

    const allCategories = new Set(result.categories.map((c) => c.name));
    setPreview({
      events: result.events,
      categories: result.categories,
      selectedCategories: allCategories,
    });
  }

  async function handleFilePick() {
    clearState();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/calendar', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file.name.endsWith('.ics')) {
        setError({ type: 'file-type', message: 'Please select a .ics calendar file.' });
        return;
      }

      setLoading(true);
      const content = await FileSystem.readAsStringAsync(file.uri);
      processIcs(content);
    } catch {
      setError({ type: 'parse', message: 'Failed to read the file.' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUrlFetch() {
    clearState();
    if (!url.trim()) return;
    setLoading(true);

    try {
      const content = await fetchSchedIcs(url.trim());
      processIcs(content);
    } catch (err) {
      if (err instanceof InvalidSchedUrlError) {
        setError({ type: 'file-type', message: 'Enter a valid Sched URL (e.g. https://yourcon.sched.com).' });
      } else if (err instanceof NetworkError) {
        setError({ type: 'network', message: 'Network error. Check your connection and try again.' });
      } else if (err instanceof InvalidResponseError) {
        setError({ type: 'no-events', message: 'URL did not return a valid calendar file.' });
      } else {
        setError({ type: 'parse', message: 'Something went wrong. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(name: string) {
    if (!preview) return;
    const next = new Set(preview.selectedCategories);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setPreview({ ...preview, selectedCategories: next });
  }

  async function handleImport() {
    if (!preview || !id) return;

    const eventsToImport = preview.selectedCategories.size === preview.categories.length
      ? preview.events
      : preview.events.filter((e) =>
          e.category === null || preview.selectedCategories.has(e.category),
        );

    try {
      const result = await importMutation.mutateAsync({
        parsedEvents: eventsToImport,
        conventionId: id,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert(
        'Import Complete',
        `${result.added} added, ${result.updated} updated`,
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('Import Failed', 'Something went wrong. Please try again.');
    }
  }

  const selectedCount = preview
    ? preview.events.filter(
        (e) => e.category === null || preview.selectedCategories.has(e.category),
      ).length
    : 0;

  return (
    <SafeView>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <Pressable onPress={() => router.back()} className="active:opacity-70">
          <ChevronLeft size={24} color="#94A3B8" />
        </Pressable>
        <Text variant="h2">Import Schedule</Text>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 gap-2 mb-4">
        {(['file', 'url'] as Tab[]).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => { setActiveTab(tab); clearState(); }}
            className={`flex-1 py-2 rounded-lg items-center ${
              activeTab === tab ? 'bg-primary' : 'bg-card'
            }`}
          >
            <Text
              variant="label"
              className={activeTab === tab ? 'text-primary-foreground' : 'text-muted-foreground'}
            >
              {tab === 'file' ? 'From File' : 'From URL'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        {/* Tab content */}
        {activeTab === 'file' ? (
          <Button variant="outline" onPress={handleFilePick} className="mb-4">
            Choose .ics File
          </Button>
        ) : (
          <View className="gap-3 mb-4">
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="https://yourcon.sched.com"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              className="bg-card text-foreground px-4 py-3 rounded-xl text-base border border-border"
            />
            <Button onPress={handleUrlFetch} disabled={!url.trim() || loading}>
              Fetch Schedule
            </Button>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View className="items-center py-8">
            <ActivityIndicator color="#0FACED" />
            <Text variant="caption" className="mt-2">Loading...</Text>
          </View>
        )}

        {/* Error state */}
        {error && !loading && (
          <View className="items-center py-8 gap-3">
            {error.type === 'network' ? (
              <WifiOff size={40} color="#94A3B8" />
            ) : error.type === 'no-events' ? (
              <CalendarX size={40} color="#94A3B8" />
            ) : (
              <FileX size={40} color="#94A3B8" />
            )}
            <Text variant="body" className="text-center text-muted-foreground">
              {error.message}
            </Text>
            <Button
              variant="outline"
              onPress={() => {
                setError(null);
                if (activeTab === 'url') handleUrlFetch();
              }}
            >
              Retry
            </Button>
          </View>
        )}

        {/* Preview */}
        {preview && !loading && !error && (
          <View className="gap-4">
            <Text variant="h3">{preview.events.length} events found</Text>

            {/* Category checkboxes */}
            {preview.categories.map((cat) => {
              const checked = preview.selectedCategories.has(cat.name);
              return (
                <Pressable
                  key={cat.name}
                  onPress={() => toggleCategory(cat.name)}
                  className="flex-row items-center gap-3 py-2"
                >
                  <View
                    className={`w-5 h-5 rounded border-2 items-center justify-center ${
                      checked ? 'bg-primary border-primary' : 'border-border'
                    }`}
                  >
                    {checked && <Text className="text-primary-foreground text-xs font-bold">✓</Text>}
                  </View>
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <Text variant="body" className="flex-1">{cat.name}</Text>
                  <Text variant="caption">{cat.count}</Text>
                </Pressable>
              );
            })}

            <View className="pt-2 pb-8 gap-3">
              <Button
                onPress={handleImport}
                disabled={importMutation.isPending || selectedCount === 0}
              >
                {importMutation.isPending
                  ? 'Importing...'
                  : `Import ${selectedCount} Event${selectedCount !== 1 ? 's' : ''}`}
              </Button>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeView>
  );
}
