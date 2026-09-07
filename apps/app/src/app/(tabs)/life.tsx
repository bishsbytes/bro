import { TabScreen } from "../../components/tab-screen";
import { LifeScreen } from "../../screens/life/life-screen";

export default function LifeRoute() {
	return (
		<TabScreen tab="life">
			<LifeScreen />
		</TabScreen>
	);
}
