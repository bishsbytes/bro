-- Assigns every existing reminder to the sitting its time suggests, so a
-- device upgrading into slots keeps reminding at the times it already did
-- without nagging past a completed check-in. Only ever fills a null, so a
-- replay after an unobserved marker write cannot overwrite a user's choice.
UPDATE `reminders`
SET `slot` = CASE WHEN `minute_of_day` < 720 THEN 'morning' ELSE 'evening' END
WHERE `slot` IS NULL;
