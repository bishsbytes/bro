import { useAuth } from "@bro/auth-app";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FormField } from "../../components/form-field";
import { StackScreen as Screen } from "../../components/screen";
import { toMessage } from "../../lib/errors";
import { authStyles } from "./auth-styles";

export type SignInScreenProps = {
	onShowSignUp?: () => void;
	onSuccess?: () => Promise<void> | void;
};

export function SignInScreen({ onShowSignUp, onSuccess }: SignInScreenProps) {
	const { t } = useTranslation("auth");
	const { signIn } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const onSubmit = async () => {
		setError(null);
		setSubmitting(true);

		try {
			await signIn(email.trim(), password);
			await onSuccess?.();
		} catch (caught) {
			setError(toMessage(caught, t("signIn.failed")));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Screen padded centered contentContainerStyle={authStyles.container}>
			<AppText variant="title">{t("signIn.title")}</AppText>
			<AppText color="subtle" style={authStyles.subtitle}>
				{t("signIn.subtitle")}
			</AppText>

			{error ? <AppText color="danger">{error}</AppText> : null}

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
				autoComplete="current-password"
				secureTextEntry
				editable={!submitting}
			/>

			<Button
				label={t("signIn.submit")}
				loading={submitting}
				style={authStyles.submit}
				onPress={() => void onSubmit()}
			/>

			{onShowSignUp ? (
				<Button
					label={t("signIn.needAccount")}
					variant="text"
					style={authStyles.link}
					onPress={onShowSignUp}
					disabled={submitting}
				/>
			) : null}
		</Screen>
	);
}
