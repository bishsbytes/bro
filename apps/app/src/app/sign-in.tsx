import { router } from "expo-router";
import { SignInScreen } from "../screens/sign-in-screen";

export default function SignInRoute() {
	return <SignInScreen onShowSignUp={() => router.push("/sign-up")} />;
}
