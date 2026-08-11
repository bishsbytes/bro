import { router } from "expo-router";
import { SignUpScreen } from "../screens/sign-up-screen";

export default function SignUpRoute() {
	return <SignUpScreen onShowSignIn={() => router.replace("/sign-in")} />;
}
