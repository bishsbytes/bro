import { localDayAt } from "@bro/logic";
import { File, Paths } from "expo-file-system";
import { StorageAccessFramework } from "expo-file-system/legacy";
import { Platform, Share } from "react-native";

export type ExportShareResult = {
	message: string;
	uri: string | null;
};

function systemTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function exportFileName(
	now = new Date(),
	timeZone = systemTimeZone(),
): string {
	return `bro-export-${localDayAt(now.getTime(), timeZone)}.json`;
}

export async function shareExport(
	payload: string,
	fileName: string,
): Promise<ExportShareResult> {
	if (Platform.OS === "android") {
		const permission =
			await StorageAccessFramework.requestDirectoryPermissionsAsync();
		if (!permission.granted) {
			return {
				message: "Saving closed. Your data stayed on this device.",
				uri: null,
			};
		}
		const uri = await StorageAccessFramework.createFileAsync(
			permission.directoryUri,
			fileName.replace(/\.json$/, ""),
			"application/json",
		);
		await StorageAccessFramework.writeAsStringAsync(uri, payload);
		return { message: "Export saved to the folder you chose.", uri };
	}

	if (Platform.OS === "ios") {
		const file = new File(Paths.cache, fileName);
		file.create({ overwrite: true });
		file.write(payload);
		try {
			const result = await Share.share(
				{ url: file.uri, title: "bro data export" },
				{ subject: "bro data export" },
			);
			if (result.action === Share.dismissedAction) {
				return {
					message: "Sharing closed. Your data stayed on this device.",
					uri: null,
				};
			}
			return {
				message: result.activityType
					? `Export shared with ${result.activityType}.`
					: "Export handed to the app you chose.",
				uri: null,
			};
		} finally {
			// The share sheet has consumed the file by the time Share resolves;
			// leaving it in the cache would outlive the "stays on this device" promise.
			try {
				file.delete();
			} catch {
				// A failed cleanup must not mask the share outcome.
			}
		}
	}

	throw new Error("Data export is available on iOS and Android.");
}
