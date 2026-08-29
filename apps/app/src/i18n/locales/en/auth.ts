export const auth = {
	/** Serves as both the field's label and its placeholder. */
	fields: {
		name: "Name",
		email: "Email",
		password: "Password",
	},
	signIn: {
		title: "Welcome back",
		subtitle: "Sign in to continue.",
		submit: "Sign in",
		failed: "Could not sign in.",
		needAccount: "Need an account? Sign up",
	},
	signUp: {
		title: "Create account",
		subtitle: "Start tracking your wellbeing.",
		submit: "Sign up",
		failed: "Could not sign up.",
		haveAccount: "Already have an account? Sign in",
	},
} as const;
