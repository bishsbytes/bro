import { useAuth } from "@bro/auth-app";
import { useState } from "react";
import { AppText } from "../components/app-text";
import { Button } from "../components/button";
import { FormField } from "../components/form-field";
import { StackScreen as Screen } from "../components/screen";
import { authStyles } from "./auth-styles";

export type SignInScreenProps = {
	onShowSignUp?: () => void;
	onSuccess?: () => Promise<void> | void;
};

export function SignInScreen({ onShowSignUp, onSuccess }: SignInScreenProps) {
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
			setError(caught instanceof Error ? caught.message : "Could not sign in.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Screen padded centered contentContainerStyle={authStyles.container}>
			<AppText variant="title">Welcome back</AppText>
			<AppText color="subtle" style={authStyles.subtitle}>
				Sign in to continue.
			</AppText>

			{error ? <AppText color="danger">{error}</AppText> : null}

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
				autoComplete="current-password"
				secureTextEntry
				editable={!submitting}
			/>

			<Button
				label="Sign in"
				loading={submitting}
				style={authStyles.submit}
				onPress={() => void onSubmit()}
			/>

			{onShowSignUp ? (
				<Button
					label="Need an account? Sign up"
					variant="text"
					style={authStyles.link}
					onPress={onShowSignUp}
					disabled={submitting}
				/>
			) : null}
		</Screen>
	);
}
