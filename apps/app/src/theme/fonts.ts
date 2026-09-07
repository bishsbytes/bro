import { Caladea_400Regular } from "@expo-google-fonts/caladea/400Regular";
import { Caladea_400Regular_Italic } from "@expo-google-fonts/caladea/400Regular_Italic";
import { Caladea_700Bold } from "@expo-google-fonts/caladea/700Bold";
import { useFonts } from "expo-font";

export const appFonts = {
	Caladea_400Regular,
	Caladea_400Regular_Italic,
	Caladea_700Bold,
};

export function useAppFonts() {
	return useFonts(appFonts);
}
