import { useAuth } from "@bro/auth-app";
import { useState } from "react";
import { AppText } from "../../components/app-text";
import { Button } from "../../components/button";
import { FormField } from "../../components/form-field";
import { StackScreen as Screen } from "../../components/screen";
import { authStyles } from "./auth-styles";

export type SignUpScreenProps = {
	onShowSignIn: () => void;
	onSuccess?: () => Promise<void> | void;
};

export function SignUpScreen({ onShowSignIn, onSuccess }: SignUpScreenProps) {
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
			setError(caught instanceof Error ? caught.message : "Could not sign up.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Screen padded centered contentContainerStyle={authStyles.container}>
			<AppText variant="title">Create account</AppText>
			<AppText color="subtle" style={authStyles.subtitle}>
				Start tracking your wellbeing.
			</AppText>

			{error ? <AppText color="danger">{error}</AppText> : null}

			<FormField
				label="Name"
				showLabel={false}
				placeholder="Name"
				value={name}
				onChangeText={setName}
				autoComplete="name"
				editable={!submitting}
			/>
			<FormField
				label="Email"
				showLabel={false}
				placeholder="Email"
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				editable={!submitting}
			/>
			<FormField
				label="Password"
				showLabel={false}
				placeholder="Password"
				value={password}
				onChangeText={setPassword}
				autoCapitalize="none"
				autoComplete="new-password"
				secureTextEntry
				editable={!submitting}
			/>

			<Button
				label="Sign up"
				loading={submitting}
				style={authStyles.submit}
				onPress={() => void onSubmit()}
			/>

			<Button
				label="Already have an account? Sign in"
				variant="text"
				style={authStyles.link}
				onPress={onShowSignIn}
				disabled={submitting}
			/>
		</Screen>
	);
}
