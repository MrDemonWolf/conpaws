import { useCallback } from "react";
import { Alert } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { useQueryClient } from "@tanstack/react-query";
import { exportAllData, serializeExportData } from "@/lib/data-export";
import {
  importData,
  validateExportData,
  type ImportSummary,
} from "@/lib/data-import";

export function useExportData() {
  const exportData = useCallback(async () => {
    try {
      const data = await exportAllData();
      const json = serializeExportData(data);
      const filename = `conpaws-backup-${new Date().toISOString().split("T")[0]}.json`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      await FileSystem.writeAsStringAsync(fileUri, json);
      await Sharing.shareAsync(fileUri, {
        mimeType: "application/json",
        dialogTitle: "Export ConPaws Data",
        UTI: "public.json",
      });
    } catch (err) {
      Alert.alert("Export Failed", "Could not export data. Please try again.");
    }
  }, []);

  return { exportData };
}

export function useImportData() {
  const queryClient = useQueryClient();

  const importDataFromFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      const content = await FileSystem.readAsStringAsync(file.uri);
      const data = JSON.parse(content);

      if (!validateExportData(data)) {
        Alert.alert("Invalid File", "This file is not a valid ConPaws backup.");
        return;
      }

      Alert.alert(
        "Import Data",
        `Found ${data.conventions.length} conventions and ${data.events.length} events. Duplicates will be skipped.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Import",
            onPress: async () => {
              const summary = await importData(data);
              queryClient.invalidateQueries({ queryKey: ["conventions"] });
              Alert.alert(
                "Import Complete",
                `Added ${summary.conventionsAdded} conventions and ${summary.eventsAdded} events. Skipped ${summary.conventionsSkipped} duplicate conventions and ${summary.eventsSkipped} duplicate events.`,
              );
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert("Import Failed", "Could not import data. Please try again.");
    }
  }, [queryClient]);

  return { importData: importDataFromFile };
}
