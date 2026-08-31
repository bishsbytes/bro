import {
	Archivo_400Regular,
	Archivo_500Medium,
	Archivo_600SemiBold,
	Archivo_700Bold,
} from "@expo-google-fonts/archivo";
import {
	SourceSerif4_400Regular,
	SourceSerif4_500Medium,
} from "@expo-google-fonts/source-serif-4";
import { useFonts } from "expo-font";

export const baselineFonts = {
	Archivo_400Regular,
	Archivo_500Medium,
	Archivo_600SemiBold,
	Archivo_700Bold,
	SourceSerif4_400Regular,
	SourceSerif4_500Medium,
};

export function useBaselineFonts() {
	return useFonts(baselineFonts);
}
