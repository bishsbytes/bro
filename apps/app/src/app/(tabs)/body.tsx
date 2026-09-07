import { TabScreen } from "../../components/tab-screen";
import { BodyScreen } from "../../screens/body/body-screen";

export default function BodyRoute() {
	return (
		<TabScreen tab="body">
			<BodyScreen />
		</TabScreen>
	);
}
