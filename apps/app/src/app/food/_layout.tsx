import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import {
	StyleSheet,
	stackScreenOptions,
	useUnistyles,
} from "../../theme/unistyles";

export default function FoodLayout() {
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
					title: t("food.index"),
					headerRight: () => (
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("food.addA11y")}
							style={styles.headerAction}
							onPress={() => router.push("/food/log")}
						>
							<MaterialIcons name="add" color={theme.colors.text} size={24} />
						</TouchableOpacity>
					),
				}}
			/>
			<Stack.Screen name="log" options={{ title: t("food.log") }} />
			<Stack.Screen name="custom" options={{ title: t("food.custom") }} />
			<Stack.Screen name="goals" options={{ title: t("food.goals") }} />
			<Stack.Screen name="[localDay]" options={{ title: t("food.day") }} />
		</Stack>
	);
}

const styles = StyleSheet.create((_theme) => ({
	headerAction: {
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
}));
