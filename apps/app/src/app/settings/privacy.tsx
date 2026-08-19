import { StackScreen as Screen } from "../../components/screen";
import { PrivacyContent } from "../../screens/privacy/privacy-content";

export default function PrivacyRoute() {
	return (
		<Screen scroll padded>
			<PrivacyContent />
		</Screen>
	);
}
