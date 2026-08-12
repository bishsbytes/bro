export {
	assertRemoteAuthConfigured,
	authClient,
	type Session,
} from "./client";
export {
	AuthContext,
	type AuthContextValue,
	AuthProvider,
	type AuthProviderProps,
} from "./hooks/auth-provider";
export { useAuth } from "./hooks/use-auth";
