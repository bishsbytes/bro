import { useAuth } from "@bro/auth-app";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
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
		<View style={authStyles.container}>
			<Text style={authStyles.title}>Welcome back</Text>
			<Text style={authStyles.subtitle}>Sign in to continue.</Text>

			{error ? <Text style={authStyles.error}>{error}</Text> : null}

			<TextInput
				style={authStyles.input}
				placeholder="Email"
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				editable={!submitting}
			/>
			<TextInput
				style={authStyles.input}
				placeholder="Password"
				value={password}
				onChangeText={setPassword}
				autoCapitalize="none"
				autoComplete="current-password"
				secureTextEntry
				editable={!submitting}
			/>

			<TouchableOpacity
				style={[authStyles.button, submitting && authStyles.buttonDisabled]}
				onPress={onSubmit}
				disabled={submitting}
			>
				<Text style={authStyles.buttonText}>
					{submitting ? "Signing in…" : "Sign in"}
				</Text>
			</TouchableOpacity>

			{onShowSignUp ? (
				<TouchableOpacity
					style={authStyles.link}
					onPress={onShowSignUp}
					disabled={submitting}
				>
					<Text style={authStyles.linkText}>Need an account? Sign up</Text>
				</TouchableOpacity>
			) : null}
		</View>
	);
}
