import { TabScreen } from "../../components/tab-screen";
import { HomeScreen } from "../../screens/home/home-screen";

export default function HomeRoute() {
	return (
		<TabScreen tab="journal">
			<HomeScreen />
		</TabScreen>
	);
}
