import { TabScreen } from "../../components/tab-screen";
import { IntakeScreen } from "../../screens/intake/intake-screen";

export default function IntakeRoute() {
	return (
		<TabScreen tab="intake">
			<IntakeScreen />
		</TabScreen>
	);
}
