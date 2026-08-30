import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import {
	StyleSheet,
	stackScreenOptions,
	useUnistyles,
} from "../../theme/unistyles";

export default function DrinksLayout() {
	const { theme } = useUnistyles();
	const { t } = useTranslation("navigation");

	return (
		<Stack
			screenOptions={{
				...stackScreenOptions(theme),
				animation: process.env.NODE_ENV === "test" ? "none" : "default",
			}}
		>
			<Stack.Screen
				name="index"
				options={{
					title: t("drinks.index"),
					headerRight: () => (
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("drinks.addA11y")}
							style={styles.headerAction}
							onPress={() => router.push("/drinks/log")}
						>
							<MaterialIcons name="add" color={theme.colors.text} size={24} />
						</TouchableOpacity>
					),
				}}
			/>
			<Stack.Screen name="log" options={{ title: t("drinks.log") }} />
			<Stack.Screen name="custom" options={{ title: t("drinks.custom") }} />
			<Stack.Screen name="goals" options={{ title: t("drinks.goals") }} />
			<Stack.Screen name="[localDay]" options={{ title: t("drinks.day") }} />
		</Stack>
	);
}

const styles = StyleSheet.create(() => ({
	headerAction: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
}));
