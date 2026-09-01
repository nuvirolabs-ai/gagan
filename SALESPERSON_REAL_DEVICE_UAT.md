# Salesperson app — real-device UAT

**Nothing in this document has been executed on a physical handset.** It was
written from the shipped code and verified only against the automated suites and
a desktop browser. Every box below is unticked on purpose: this is the script a
tester follows on a real phone, not a record of a test that happened.

## Why a real device is required

Four things behave differently on a handset than anywhere else, and all four are
load-bearing for a field day:

| Behaviour | Why a simulator or browser will not tell you |
|---|---|
| GPS accuracy and drift | Desktop geolocation is a fixed, perfect coordinate. Check-in distance rules only get exercised outdoors. |
| Losing and regaining signal | The offline outbox is the whole point of the design; airplane mode on a laptop is not the same as a basement in a market. |
| Camera and photo size | Attendance photos and expense receipts are bounded base64 payloads. A 12 MP phone camera is the real input. |
| Battery and backgrounding | Location pings stop when the workday is closed; the OS also suspends the app. Both need watching over hours, not seconds. |

## Before you start

- [ ] Build installed on a physical Android **and** a physical iPhone.
- [ ] Backend reachable from the handset (not `localhost`).
- [ ] A seeded salesperson with: an assigned `SalesRep`, at least 5 retailers on
      their book, a published route for today, and a target for this month.
- [ ] That salesperson's manager set in **Admin → Sales organisation**. Without a
      reporting line, no manager screen will show this person's day.
- [ ] Location permission granted, camera permission granted.
- [ ] A second handset, or the admin portal, signed in as the manager.

## The salesperson's day, start to finish

### 1. Sign in
- [ ] OTP arrives on the real number and the app opens on Today.
- [ ] Force-quit and reopen: still signed in.
- [ ] Turn off all networking and reopen: the app opens on cached data and says
      so, rather than signing out.

### 2. Start the day
- [ ] Start workday. Attendance photo capture opens the real camera.
- [ ] The captured photo uploads and the day shows as open.
- [ ] Confirm the app states that location is recorded only while the day is
      open, before any location is recorded.
- [ ] Location shows as tracking.

### 3. Work the beat
- [ ] Today lists the published route in order, with the next stop first.
- [ ] Navigate to a real store. Check in **at** the store: accepted.
- [ ] Check in from ~500 m away: the distance rule behaves as specified (record
      what it actually does — accepted, warned, or blocked).
- [ ] The planned stop flips to visited without creating a second visit record.
- [ ] Skip a stop with a reason. It is recorded as skipped, not visited.

### 4. Sell
- [ ] Open a retailer, place an order across two pack sizes of one product.
- [ ] The order total on the phone matches the order in the admin portal.
- [ ] Record a collection against an outstanding invoice.
- [ ] The retailer's balance moves by exactly that amount, once.

### 5. Work offline (the important one)
- [ ] Put the phone in airplane mode **inside** a store.
- [ ] Check in, log an activity, record a visit note.
- [ ] Each queued item shows as pending, not as saved-and-synced.
- [ ] Restore the network. Items sync and change state to synced.
- [ ] Kill the app mid-sync and reopen: nothing is lost and nothing double-posts.
- [ ] Confirm a collection or order was **not** silently queued offline — money
      movements are online-only by design. Record what the app actually did.

### 6. Expenses and issues
- [ ] Submit a travel expense with a receipt photo taken on the device.
- [ ] Raise a service issue against a retailer.
- [ ] Both appear in the manager's queue on the other device.

### 7. End the day
- [ ] Close the workday.
- [ ] Location tracking stops. Confirm on the manager's live view that the
      salesperson disappears from "on duty now".
- [ ] Leave the phone for 30 minutes with the app backgrounded and confirm no
      further pings were recorded.

### 8. Performance and motivation
- [ ] Today shows target progress that matches the admin portal for the same period.
- [ ] Any projection is labelled as a run rate and never says "will achieve".
- [ ] Rank is shown with the scope it was computed in.
- [ ] An achievement, if one fires, appears once and does not reappear after a
      background refresh.

## Manager-side checks, run in parallel

Do these on the second device while the salesperson works.

- [ ] The manager sees **only** their own reporting tree on Field team, Sales
      leader, expenses, leave and issues.
- [ ] A second manager, on a different branch, sees none of the first team.
- [ ] The manager approves the expense. A salesperson cannot approve their own.
- [ ] Move the salesperson to a different manager in Sales organisation. The
      first manager loses them and the second gains them, along with their
      retailers, on the next refresh — with no store reassignment.
- [ ] The move is recorded in that employee's history with both managers named.

## Recording results

For each unticked box, record: device and OS version, what you did, what you
expected, what happened, and a screenshot. A box that cannot be reached (no
seeded data, no permission) is **blocked**, not passed.

Do not add features to make a box tick. If a box fails, that is a defect to
raise; if a box describes something the product deliberately does not do, correct
this document rather than the product.
