import { Paths } from "expo-file-system";

/** Cache files are disposable and excluded from Android/iOS device backup. */
export const LOCAL_DATABASE_DIRECTORY: string | undefined = Paths.cache.uri;
