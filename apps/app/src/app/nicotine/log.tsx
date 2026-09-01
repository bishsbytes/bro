import { nicotineKgFromMg } from "@bro/domain/nicotine-catalogue";
import { SubstanceLogScreen } from "../../screens/substances/substance-log-screen";
import { NICOTINE_DESCRIPTOR } from "../../substances/nicotine";

export default function NicotineLogRoute() {
	return (
		<SubstanceLogScreen
			descriptor={NICOTINE_DESCRIPTOR}
			amountFromInput={nicotineKgFromMg}
		/>
	);
}
