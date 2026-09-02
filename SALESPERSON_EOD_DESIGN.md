# Salesperson End-of-day Design

End My Day remains inside Today. When the workday is open, the first tap opens a review card with supported canonical day facts:

- visits
- productive visits
- orders and order value
- confirmed collections
- route completion when a route exists

The salesperson may enter an optional manager note. On confirmation, the note is written into the existing `workday.ended` audit event metadata beside the closed workday session. It is therefore auditable and visible to the existing reporting/audit hierarchy without creating a chat or messaging system. The note is not required and is trimmed/limited to 1,000 characters.

After success, Today returns to the calm closed-day state: `Your day is complete.` No confetti, leaderboard reward, or forced comment is added.
