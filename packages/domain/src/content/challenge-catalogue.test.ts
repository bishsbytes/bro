import {
	CHALLENGE_CATALOGUE,
	challengeForArea,
	resolveChallenge,
} from "./challenge-catalogue";
import { LIFE_AREA_CATALOGUE } from "./life-area-catalogue";

describe("starter challenge catalogue", () => {
	it("provides complete authored templates with permanent namespaced slugs", () => {
		const catalogueSlugs = new Set<string>(
			LIFE_AREA_CATALOGUE.map((area) => area.slug),
		);
		expect(new Set(CHALLENGE_CATALOGUE.map(({ slug }) => slug)).size).toBe(
			CHALLENGE_CATALOGUE.length,
		);
		expect(CHALLENGE_CATALOGUE).toHaveLength(14);
		for (const challenge of CHALLENGE_CATALOGUE) {
			expect(challenge.slug).toMatch(/^challenge:[a-z0-9-]+$/);
			expect(catalogueSlugs.has(challenge.areaSlug)).toBe(true);
			expect(challenge.days).toHaveLength(challenge.durationDays);
			expect(challenge.days.map(({ day }) => day)).toEqual(
				Array.from({ length: challenge.durationDays }, (_, index) => index + 1),
			);
			expect(resolveChallenge(challenge.slug)).toBe(challenge);
			for (const day of challenge.days) {
				expect(day.title.trim()).not.toBe("");
				expect(day.action.trim()).not.toBe("");
			}
		}
	});

	it("keeps a short starter available for every life area", () => {
		for (const area of LIFE_AREA_CATALOGUE) {
			const challenge = challengeForArea(area.slug);
			expect(challenge).not.toBeNull();
			if (!challenge) {
				throw new Error(`Missing challenge for ${area.slug}`);
			}
			expect(challenge.durationDays).toBe(3);
		}
	});

	it("adds a directly resolvable thirty-day strength flagship", () => {
		const flagship = resolveChallenge("challenge:thirty-day-strength-block");
		expect(flagship).toMatchObject({
			title: "Thirty-day strength block",
			areaSlug: "wheel:health",
			durationDays: 30,
		});
		expect(flagship?.days).toHaveLength(30);
		expect(challengeForArea("wheel:health")?.slug).toBe(
			"challenge:health-basics",
		);
	});

	it("resolves content by permanent area slug and tolerates unknown areas", () => {
		expect(challengeForArea("wheel:career")?.title).toBe(
			"A clearer working week",
		);
		expect(challengeForArea("wheel:future")).toBeNull();
		expect(resolveChallenge("challenge:future")).toBeNull();
	});
});
