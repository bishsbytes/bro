import { useAuth } from "@bro/auth-app";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { authStyles } from "./auth-styles";

export type SignUpScreenProps = {
	onShowSignIn: () => void;
};

export function SignUpScreen({ onShowSignIn }: SignUpScreenProps) {
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
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not sign up.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<View style={authStyles.container}>
			<Text style={authStyles.title}>Create account</Text>
			<Text style={authStyles.subtitle}>Start tracking your wellbeing.</Text>

			{error ? <Text style={authStyles.error}>{error}</Text> : null}

			<TextInput
				style={authStyles.input}
				placeholder="Name"
				value={name}
				onChangeText={setName}
				autoComplete="name"
				editable={!submitting}
			/>
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
				autoComplete="new-password"
				secureTextEntry
				editable={!submitting}
			/>

			<TouchableOpacity
				style={[authStyles.button, submitting && authStyles.buttonDisabled]}
				onPress={onSubmit}
				disabled={submitting}
			>
				<Text style={authStyles.buttonText}>
					{submitting ? "Creating account…" : "Sign up"}
				</Text>
			</TouchableOpacity>

			<TouchableOpacity
				style={authStyles.link}
				onPress={onShowSignIn}
				disabled={submitting}
			>
				<Text style={authStyles.linkText}>
					Already have an account? Sign in
				</Text>
			</TouchableOpacity>
		</View>
	);
}
