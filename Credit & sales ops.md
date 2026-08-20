CREDIT & SALES OPERATIONS

Functional extraction of the Credit & Sales SOP (V4), for building the retailer / salesperson app
Purpose: This is a functional extraction of the Credit & Sales Operations SOP (V4), for use in building the retailer/salesperson app. All personal names have been replaced with posts. This is a reference document for scoping, not itself an SOP — the full SOP remains the source of truth for staff.
Role Naming Used In This Document
Person in SOP
Post Used Here
Mukesh
Credit Team Lead
Kajal
Sales Coordinator
Kuldeep
Dispatch Team (handles Sales Order creation & SAP execution — see note below)

Assumption flagged: Kuldeep's individual actions (creating Sales Orders in SAP, executing dispatch) have been folded into the single post "Dispatch Team" rather than kept as a separate individual role. If the app needs one specific login/user who does the SAP data-entry work distinct from other Dispatch Team members, let us know and this can be split back into two posts.

Section 1 — Roles & Permissions

Post
What They Do
Relevant App Permissions
Credit Team Lead
Owns the credit process end to end. Final say on invoices, ratings, blocks. Sets ratings every quarter (1 Apr/1 Jul/1 Oct/1 Jan) and immediately for urgent cases. Approves/rejects 3rd invoice requests. Sends block/unblock instructions. Leads recovery at every stage. Manages Field Collection Team. Main approver in SAP's 4-level workflow. Only admin for the IVR system.
Approve/reject invoices (3rd+), set/change ratings, issue block/unblock, view all customer accounts, manage Field Collection routes, IVR admin
Sales Coordinator
Backs up Credit Team Lead for all approvals when unavailable. Approves 2nd invoice requests. Can request a 3rd invoice via a formal form. Can issue block/unblock (Credit Team Lead normally does first). Reviews weekly Sales + Outstanding summary. Signs recovery letters for 70–89 day accounts.
Approve 2nd invoice, submit 3rd invoice request, backup-approve (when Credit Team Lead is on leave), issue block/unblock, view Outstanding Tracker
Salesperson
Posts customer orders. Tells customer about cash discount vs. due-date payment on the day of order. Shares new customer KYC. Tracks own customers' outstanding. Joins recovery calls once an invoice hits Day 53–56. Never dispatches outside the normal process. Never moved into field collection.
Create/post orders, view own customers' status, no access to Outstanding Tracker
Dispatch Team
Creates Sales Orders in SAP from posted orders. Only acts after approval comes through (Order Approval or Block/Unblock channel). Does not do manual credit checks — relies on SAP's automatic checks, but must verify those checks are firing and flag the Credit Team Lead if not. Only creates a new customer account once order + KYC are both received.
Create Sales Order, execute dispatch (post-approval only), flag SAP control failures
Credit Team (multi-member)
Pulls the outstanding list every 3 days. Calls overdue customers in the 30–45 / 45–59 / 60+ bands per schedule. Logs every call. Tells customers when 2% interest starts applying. Works with Salesperson on 60+ day recovery. Prepares weekly reports and recovery letters.
View Outstanding Tracker, log calls, generate weekly report
Field Collection Team (multi-member)
Visits customers in person to collect payment, mainly 45+ day accounts. Reports to Credit Team Lead. Submits daily collection summary.
View assigned route/customers, log payment collected, upload receipt
Accounts Team
Confirms advance payments and bank/UPI transfers before an invoice is marked paid. Approves the "advance-payment" SAP trigger (Rating F / restarting N). Reconciles Field Collection deposits daily.
Confirm payment received, approve advance-payment trigger
Founder/Director
Final word on unresolved Sales-vs-Credit conflicts. Approves legal write-offs/settlements. Reviewed monthly on IVR cost-effectiveness and quarterly on Legal Tracker.
Final conflict decision, approve write-off/settlement
SAP Approver on duty
Named in the Order Approval channel as a participant who can approve in SAP when routed. (Not otherwise defined in the SOP — flagged as an open question at the end.)
TBD

Section 2 — Key Definitions (for data model / field names)

Term
Meaning
Invoice Date
Always equals the dispatch date. No invoice/date exists until goods are dispatched.
Days Overdue / Outstanding
Counted from invoice date (= dispatch date) to today if unpaid, or to the date full payment was received if paid.
Regular Billing
Customer orders/bills at least every one month.
Irregular Billing
Customer does not order/bill every one month.
Rating N
Default rating for every new customer from account creation until a letter rating (A–F) is assigned. Follows Section 5 rules (invoice/₹ caps).
Order Approval Channel
Where Dispatch Team shares ledger + sales order + details whenever SAP requires approval; approver acts here and then in SAP. Also used for 3rd-invoice go-ahead instructions.
Block/Unblock Channel
Used only to communicate which customers to block/unblock. No other content belongs here.

App design note: The SOP currently runs the Order Approval and Block/Unblock communication through two separate WhatsApp groups, each strictly single-purpose. Whether the app should replace or supplement these channels with in-app notifications/approval queues is a scoping decision flagged as an open question at the end, not assumed here.



Section 3 — Core Numeric Rules (config values)

Rule
Value
Target average collection time (DSO)
≤ 45 days
New customer (Rating N) invoice chain
1st: automatic → 2nd: Sales Coordinator approval → 3rd: Credit Team Lead approval → 4th: blocked until 1–3 fully paid
Rating N total outstanding cap
₹50,000 — checked at every invoice stage, routes to approval if it would be crossed
Partial payment
Never counts as invoice cleared — must be 100%
Full clearance rule
Any invoice past 45 days must be 100% paid before next dispatch — applies to every rating including A and B
Cash discount
2% — offered to customer, disclosed same day as order, customer chooses discount vs. due-date payment
Rating review cycle
Quarterly: 1 Apr, 1 Jul, 1 Oct, 1 Jan. Immediate review triggers can happen anytime.
3rd invoice approval SLA
Credit Team Lead must respond within 48 hours or it auto-escalates to Conflict Resolution
Outstanding pull frequency
Every 3 days (not daily)
Recovery letter deadline
7 days to pay, or moves to legal
Legal escalation
Day 90+, customer permanently set to Rating F, advance payment only, no exceptions





Section 4 — Customer Rating Table (drives dispatch logic in the app)

Rating
Billing Pattern
DSO Range
Dispatch Rule
Outstanding Limit
N
New, no history
N/A
Max 1 invoice to start; full chain per Section 5; ₹50,000 cap; full clearance rule applies
Max ₹50,000
A
Regular
≤ 30 days
No invoice/value limit; full clearance rule applies
No limit
B
Regular, or irregular with DSO < 45
≤ 45 days
No invoice/value limit; full clearance rule applies
No limit
C
Regular
45–59 days
Auto-blocked if outstanding ≥ ₹1,00,000 OR ≥3 open invoices; full clearance rule also applies
Max ₹1,00,000
D
Irregular
45–59 days
Auto-blocked if outstanding ≥ ₹25,000 OR ≥3 open invoices; full clearance rule also applies
Max ₹25,000
E
Any
60–89 days
Locked once any invoice passes 59 days; full clearance rule applies; restarts as N once 100% cleared
Locked
F
Any
90+ days
Permanently blocked; advance payment only; no exceptions
Locked


Two edge rules to encode:
	•	An irregular biller with DSO still under 45 days is treated as Rating B (irregularity alone doesn't drag them below B).
	•	A regular biller whose DSO slips to 60–89 days is treated as Rating E (regularity no longer protects once DSO > 59).













Section 5 — New Customer Invoice Approval Chain

Invoice
What Unlocks It
Who Approves
Dispatch Team's Role
1st
Real order + KYC shared; order alone doesn't push outstanding to ₹50,000
Automatic (unless ₹50,000 cap triggers approval routing)
Creates account, sets Rating N, sets limit to 1
2nd
1st invoice status, days outstanding, and whether 1+2 would hit ₹50,000
Sales Coordinator only
Sends invoice only after SAP shows approval — does not decide
3rd
Sales Coordinator submits a formal request (with 1+2+3 projected total); decision due within 48 hours
Credit Team Lead (final say)
Raises limit to 3 only after explicit go-ahead — does not decide
4th
Never, until invoices 1–3 are 100% paid and confirmed
No one can override
Limit stays locked at 3

The ₹50,000 cap applies at every invoice stage, independent of invoice number — SAP should route for approval the instant any order would push total outstanding to or past ₹50,000, even the 1st invoice.



Section 6 — New-to-Old Rating Upgrade Logic

A Rating N customer becomes a lettered rating (A–F) at the first of: the next quarterly checkpoint after meeting all 3 conditions below, or 6 months after account creation (whichever comes first).
All 3 must be true:
	•	At least 3 invoices sent.
	•	Every payment came in within 45 days of dispatch date.
	•	No partial payments — 100% paid on each.

If not met at 6 months: Credit Team Lead still must assign a letter rating after consulting the Salesperson — C/D for regular order’s with unproven payment, E/F if payment behaviour is uncertain/worrying.
Reset trigger: Any late payment (>45 days) or any partial payment resets the clean-invoice count to zero; 3 new clean invoices required before next checkpoint.






Section 7 — Recovery / Overdue Workflow (state machine)

Stage
Days
Key Actions
Escalation Trigger
30–45 day
Ongoing
Pull list every 3 days. Day 35: reminder call. Day 40: active push + 2% interest warning (5-day deadline).
Crosses Day 45 → move to next stage + 2% interest formally applies
45–59 day
Ongoing
Day 45–48: call, state amount, get firm commitment date. Day 49–52: follow-up on commitment. Day 53–56: Credit Team + Salesperson call together; Salesperson must join from Day 56.
Missed commitment → same-day joint call (no escalation to Credit Team Lead needed at this stage)
60–69 day
High priority
Rating reviewed immediately (mid-cycle trigger). Daily calls, logged. No commitment → escalate to Credit Team Lead/senior management.
No commitment, or 2 missed commitments in a row → escalate to Credit Team Lead
70–89 day
—
Formal recovery letter (signed by Credit Team Lead + Sales Coordinator + a Credit Team member), sent as PDF via WhatsApp, 7-day deadline.
Deadline missed → Day 90+
90+ day
Final
Sent to legal/collections. Customer permanently set Rating F. Legal Action Tracker entry opened.
—

Escalation options available to Credit Team Lead on 60+ day escalation (in preferred order where applicable): joint call with Salesperson, Field Collection visit, downgrade rating, block dispatch via SAP, send recovery letter. Try joint call or field visit before blocking, where it makes sense.
No-movement rule: any 60+ case with no movement for 2 weeks → Credit Team Lead steps in directly, may trigger a Field Collection visit.



Section 8 — Blocking / Unblocking

	•	Blocking is a last resort, not a first move — always attempt collection first (calls, reminders, visits).
	•	Blocking only happens through the automated SAP rating-based controls described in Section 4, communicated via the Block/Unblock channel — never a purely manual/verbal instruction.
	•	Instruction can be issued by Credit Team Lead or Credit Team; Sales Coordinator can also issue it.
	•	Dispatch Team acts only on the written Block/Unblock channel message — never a verbal instruction.
	•	Unblock (Rating E) only after 100% of outstanding is cleared and confirmed in SAP — customer then restarts as Rating N.



Section 9 — Conflict Resolution (Sales Coordinator vs. Credit Team Lead)

Triggers:
	•	3rd invoice request denied
	•	A block is disputed as unfair
	•	No response to a 3rd invoice request within 48 hours
	•	A rating is disputed with supporting data

Flow:
	•	Sales Coordinator raises it in writing.
	•	Credit Team Lead must acknowledge within 4 working hours (auto-triggers if the original 48-hour SLA was already missed).
	•	Joint call/meeting within 24 hours of acknowledgment, both sides bring data.
	•	If resolved: written decision, SAP updated via Dispatch Team, Rating Log updated, both sign off.
	•	If unresolved: both send a short written position to Founder/Director.
	•	Founder/Director decides within 24 hours, in writing — not appealable.

Default state while unresolved
Situation
Default
3rd invoice disputed
Not sent; customer capped at 2 invoices
Rating disputed, block already in place
Block stays; no dispatch
Rating disputed, no block in place
Current rating stays unchanged
No response to 3rd invoice request for 48+ hours
Goes straight to Founder/Director














Section 10 — SAP Four-Tier Approval Triggers

Trigger
Condition
Main Approver
Backup
(a)
Advance-payment customer (Rating F, or N restarting after E unlock)
Accounts Team
Accounts Team Lead
(b)
More than 3 open invoices
Credit Team Lead
Sales Coordinator (when Credit Team Lead unavailable)
(c)
Outstanding over 45 days (full clearance rule)
Credit Team Lead
Sales Coordinator (when Credit Team Lead unavailable)
(d)
Rating N customer's total outstanding would reach ₹50,000+
Credit Team Lead
Sales Coordinator (only when Credit Team Lead genuinely unavailable)

Escalation rule: if the same customer hits the approval queue 2+ times in a month, it always goes to Credit Team Lead (signals a rating review is needed), regardless of who'd normally handle it.

Section 11 — Decision Trees

11.1  New Customer Invoice Approval
	•	1st invoice
	•	Order + KYC received, and alone doesn't hit ₹50,000 → dispatch automatically
	•	Would hit ₹50,000 alone → routes to approval queue
	•	2nd invoice requested
	•	Sales Coordinator checks 1st invoice status + days outstanding + whether 1+2 hits ₹50,000
	•	Approved → dispatch
	•	Rejected → hold, tell Salesperson why
	•	3rd invoice requested
	•	Sales Coordinator submits formal request to Credit Team Lead
	•	Approved within 48 hrs → Dispatch Team raises limit to 3, sends invoice
	•	Rejected → hold, reason sent to Sales Coordinator
	•	No response within 48 hrs → auto-escalates to Conflict Resolution (Section 9)
	•	4th invoice requested
	•	Always blocked until invoices 1–3 are 100% paid and confirmed — no exceptions, no override
11.2  Old Customer Dispatch Check
	•	Any invoice older than 60 days (any rating A–E)?
	•	Yes → SAP auto-blocks. If it doesn't, Dispatch Team flags Credit Team Lead immediately.
	•	No → continue
	•	Rating A or B — any invoice older than 45 days?
	•	Yes → hold dispatch until fully cleared (full clearance rule)
	•	No → dispatch allowed, no invoice/value limit
	•	Rating C — outstanding ≥ ₹1,00,000 OR ≥3 open invoices?
	•	Yes → SAP auto-blocks
	•	No → dispatch allowed
	•	Rating D — outstanding ≥ ₹25,000 OR ≥3 open invoices?
	•	Yes → SAP auto-blocks
	•	No → dispatch allowed
	•	Rating E — any invoice over 59 days?
	•	Yes → SAP auto-blocks; unlocks only after 100% clearance, then restarts as N
	•	Rating F?
	•	Always blocked; advance payment required; dispatch only after Accounts confirms payment
	•	Rating missing or N with no invoice limit set?
	•	Stop; Dispatch Team contacts Credit Team Lead; no dispatch until rating is confirmed
11.3  Recovery Path by Day Band
	•	30–44 days
	•	Responding → log confirmation, continue every-3-day follow-up
	•	Not responding → Day 35 reminder call, Day 40 interest warning (5-day deadline)
	•	45–59 days
	•	Responding → log commitment, keep monitoring every 3 days
	•	Not responding → Credit Team + Salesperson call together for new commitment date
	•	60–69 days
	•	Responding → keep pulling every 3 days, log in call system
	•	Not responding → Credit Team Lead decides: downgrade / block via SAP / Field Collection visit / recovery letter
	•	70–89 days
	•	Recovery letter sent, 7-day deadline
	•	90+ days
	•	Sent to legal, permanently Rating F

Section 12 — Edge Cases Worth Encoding as App Validations

Situation
App Should
Customer pays 90% of Invoice 1, requests Invoice 2
Block the 2nd invoice request until SAP shows 100% received — "almost paid" is not eligible
A customer's payment isn't showing in SAP yet
Block dispatch; require Accounts/Credit Team Lead confirmation before proceeding — never accept proof directly from Salesperson
Customer has 2+ accounts/codes in SAP
Flag for Credit Team Lead to merge — ratings must apply to the customer as a whole, not per account
Rating Log more than 7 days overdue past a checkpoint
For C/D/E/F customers, require Sales Coordinator sign-off before dispatch continues. A/B customers can dispatch normally if the 45-day clearance check passes.
4th invoice exception requested for a "big" customer
No override possible in the app logic — only a Founder/Director manual, documented override outside the system counts

Open Questions Before Finalizing the App Spec

These have not been guessed at — flagged for confirmation:
	•	SAP Approver on duty — the SOP names this as a participant in the Order Approval channel but never defines who holds this post or how they're assigned. Is this a role the app needs to model separately, or is it always one of the roles already listed (e.g., Accounts Team)?
	•	WhatsApp channels vs. in-app workflow — should the app replace the Order Approval and Block/Unblock WhatsApp groups with in-app approval queues/notifications, or run alongside them (i.e., app is for order placement/status only, approvals stay on WhatsApp)? This affects whether "post to Order Approval Group" becomes an app notification or stays external.
	•	SAP integration — is the app expected to read/write live SAP data (ratings, invoice counts, outstanding), or will it maintain its own copy that's reconciled with SAP separately?
	•	Neodove / Exotel — these are named third-party systems for call logging and IVR. Should the app integrate with them, or are they out of scope for this app and remain separate tools used only by the Credit Team Lead/Credit Team?
	•	Field Collection Team app access — the SOP describes paper/WhatsApp-based daily collection summaries. Should this become an in-app form, or stay outside the app?

— End of Summary —
