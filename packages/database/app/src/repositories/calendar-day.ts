/** True only for a YYYY-MM-DD string naming a real calendar date. */
export function isCalendarDay(value: string): boolean {
	const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
	if (!match) {
		return false;
	}
	const [, year, month, day] = match;
	const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
	return (
		date.getUTCFullYear() === Number(year) &&
		date.getUTCMonth() === Number(month) - 1 &&
		date.getUTCDate() === Number(day)
	);
}
