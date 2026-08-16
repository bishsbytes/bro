import {
	CHALLENGE_CATALOGUE,
	challengeForArea,
	resolveChallenge,
} from "./content/challenge-catalogue";
import { LIFE_AREA_CATALOGUE } from "./content/life-area-catalogue";

describe("starter challenge catalogue", () => {
	it("provides one complete authored template for every default life area", () => {
		const defaultAreas = LIFE_AREA_CATALOGUE.filter(
			(area) => area.defaultEnabled,
		);
		expect(CHALLENGE_CATALOGUE).toHaveLength(defaultAreas.length);
		expect(new Set(CHALLENGE_CATALOGUE.map(({ slug }) => slug)).size).toBe(
			CHALLENGE_CATALOGUE.length,
		);

		for (const area of defaultAreas) {
			const challenge = challengeForArea(area.slug);
			expect(challenge).not.toBeNull();
			if (!challenge) {
				throw new Error(`Missing challenge for ${area.slug}`);
			}
			expect(challenge.days).toHaveLength(challenge.durationDays);
			expect(challenge.days.map(({ day }) => day)).toEqual(
				Array.from({ length: challenge.durationDays }, (_, index) => index + 1),
			);
			expect(resolveChallenge(challenge.slug)).toBe(challenge);
		}
	});

	it("resolves content by permanent area slug and tolerates unknown areas", () => {
		expect(challengeForArea("wheel:career")?.title).toBe(
			"A clearer working week",
		);
		expect(challengeForArea("wheel:future")).toBeNull();
		expect(resolveChallenge("challenge:future")).toBeNull();
	});
});
