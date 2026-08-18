import { useLocalSearchParams } from "expo-router";
import { ChallengeScreen } from "../../../screens/challenges/challenge-screen";

export default function ChallengeRoute() {
	const { slug } = useLocalSearchParams<{ slug?: string | string[] }>();
	const challengeSlug = Array.isArray(slug) ? (slug[0] ?? "") : (slug ?? "");
	return <ChallengeScreen challengeSlug={challengeSlug} />;
}
