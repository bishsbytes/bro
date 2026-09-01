import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import { Icon } from "../../components/icon";
import {
	StyleSheet,
	stackScreenOptions,
	useUnistyles,
} from "../../theme/unistyles";

export default function NicotineLayout() {
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
					title: t("nicotine.index"),
					headerRight: () => (
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("nicotine.addA11y")}
							style={styles.headerAction}
							onPress={() => router.push("/nicotine/log")}
						>
							<Icon name="add" color={theme.colors.text} size={24} />
						</TouchableOpacity>
					),
				}}
			/>
			<Stack.Screen name="log" options={{ title: t("nicotine.log") }} />
			<Stack.Screen name="[localDay]" options={{ title: t("nicotine.day") }} />
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
