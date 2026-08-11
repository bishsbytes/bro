import { useContext } from "react";
import { AuthContext, type AuthContextValue } from "./auth-provider";

/** Session state and auth actions. Must be called inside an `AuthProvider`. */
export function useAuth(): AuthContextValue {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error("useAuth must be used within an AuthProvider.");
	}

	return context;
}
