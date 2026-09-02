import { router, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { TouchableOpacity } from "react-native";
import { Icon } from "../../components/icon";
import {
	StyleSheet,
	stackScreenOptions,
	useUnistyles,
} from "../../theme/unistyles";

export default function NotesLayout() {
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
					title: t("notes.index"),
					headerRight: () => (
						<TouchableOpacity
							accessibilityRole="button"
							accessibilityLabel={t("notes.addA11y")}
							style={styles.headerAction}
							onPress={() => router.push("/notes/new")}
						>
							<Icon name="add" color={theme.colors.text} size={24} />
						</TouchableOpacity>
					),
				}}
			/>
			<Stack.Screen name="new" options={{ title: t("notes.new") }} />
			{/* The screen itself retitles this to the note's day once it loads. */}
			<Stack.Screen name="[id]" options={{ title: t("notes.edit") }} />
		</Stack>
	);
}

const styles = StyleSheet.create((theme) => ({
	headerAction: {
		width: theme.control.buttonMinHeight,
		height: theme.control.buttonMinHeight,
		alignItems: "center",
		justifyContent: "center",
	},
}));
