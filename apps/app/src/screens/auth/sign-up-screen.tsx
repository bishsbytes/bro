import { useAuth } from "@bro/auth-app";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FormField } from "../../components/form-field";
import { StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
import { authStyles } from "./auth-styles";

export type SignUpScreenProps = {
	onShowSignIn: () => void;
	onSuccess?: () => Promise<void> | void;
};

export function SignUpScreen({ onShowSignIn, onSuccess }: SignUpScreenProps) {
	const { t } = useTranslation("auth");
	const { signUp } = useAuth();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async () => {
		setError(null);
		setSubmitting(true);

		try {
			await signUp(name.trim(), email.trim(), password);
			await onSuccess?.();
		} catch (caught) {
			setError(toMessage(caught, t("signUp.failed")));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Screen padded centered contentContainerStyle={authStyles.container}>
			<AppText variant="title">{t("signUp.title")}</AppText>
			<AppText color="subtle" style={authStyles.subtitle}>
				{t("signUp.subtitle")}
			</AppText>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<FormField
				label={t("fields.name")}
				showLabel={false}
				placeholder={t("fields.name")}
				value={name}
				onChangeText={setName}
				autoComplete="name"
				editable={!submitting}
			/>
			<FormField
				label={t("fields.email")}
				showLabel={false}
				placeholder={t("fields.email")}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				editable={!submitting}
			/>
			<FormField
				label={t("fields.password")}
				showLabel={false}
				placeholder={t("fields.password")}
				value={password}
				onChangeText={setPassword}
				autoCapitalize="none"
				autoComplete="new-password"
				secureTextEntry
				editable={!submitting}
			/>

			<Button
				label={t("signUp.submit")}
				loading={submitting}
				style={authStyles.submit}
				onPress={() => void onSubmit()}
			/>

			<Button
				label={t("signUp.haveAccount")}
				variant="text"
				style={authStyles.link}
				onPress={onShowSignIn}
				disabled={submitting}
			/>
		</Screen>
	);
}
