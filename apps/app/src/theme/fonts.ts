import {
	Archivo_400Regular,
	Archivo_500Medium,
	Archivo_600SemiBold,
	Archivo_700Bold,
} from "@expo-google-fonts/archivo";
import {
	SourceSerif4_400Regular,
	SourceSerif4_400Regular_Italic,
	SourceSerif4_500Medium,
	SourceSerif4_600SemiBold,
} from "@expo-google-fonts/source-serif-4";
import { useFonts } from "expo-font";

export const baselineFonts = {
	Archivo_400Regular,
	Archivo_500Medium,
	Archivo_600SemiBold,
	Archivo_700Bold,
	SourceSerif4_400Regular,
	// Notes render as markdown, so the serif reading face needs real bold and
	// italic cuts. Without them the renderer slants and thickens the regular
	// face itself, which on a serif reads as a smudge rather than emphasis.
	SourceSerif4_400Regular_Italic,
	SourceSerif4_500Medium,
	SourceSerif4_600SemiBold,
};

export function useBaselineFonts() {
	return useFonts(baselineFonts);
}
