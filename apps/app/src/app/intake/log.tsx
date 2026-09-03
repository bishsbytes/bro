import { isConsumableKind } from "@bro/domain/consumable";
import { useLocalSearchParams } from "expo-router";
import { IntakeLogScreen } from "../../screens/intake/intake-log-screen";

export default function IntakeLogRoute() {
	const { kind } = useLocalSearchParams<{ kind?: string }>();
	return (
		<IntakeLogScreen initialKind={isConsumableKind(kind) ? kind : undefined} />
	);
}
