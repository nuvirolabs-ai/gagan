# Offline integrity — Phase B

Account-partitioned v2 outboxes replace snapshot rewrites. Mutation locks are shared across queue instances. Network sends do not hold the storage lock; each acknowledgement reloads and updates only the immutable client reference. Retry uses the same server idempotency reference. Failed persistence throws; corrupt data is retained rather than treated as an empty queue. Capacity rejects new work visibly rather than discarding older work.

Logout revokes the bound account generation synchronously. A later login cannot read/replay the old partition, including through retained callbacks. A request already sent with A's credentials may acknowledge into A's partition after logout; remaining A work stays pending. Replay requests use guarded credential reads and do not refresh or clear a replacement session. A signing in again creates a fresh binding and resumes A's durable work.

Legacy ownerless v1 records are NOT assigned to the next login or deleted. If a legacy partition has pending/corrupt data, the queue reports that ownership recovery is required and preserves the bytes. Operator-assisted, verified-owner recovery is required; this change does not guess account ownership. Already-settled legacy rows do not block a new partition.

Reproduction test: enqueue A, begin flush, enqueue B while sender waits, complete flush. Old Dogkart queue lost B. The regression now passes in both products. Added coverage: concurrent enqueues across instances; restart; partial acknowledgement; sender failure; read/write failure; failed acknowledgement persistence; corruption; capacity; logout; account switch during a batch; legacy retention; refusal to clear pending business work.

Automated mobile regression: Dogkart 70 tests (15 files), Gagan 112 tests (23 files); both typechecks passed. These are automated JS tests, not physical-device proof. No commercial order submission was added offline. No presentation was redesigned.

Physical account-switch/offline acceptance remains BLOCKED: no connected Android device at discovery. No client APK was replaced. Local end-to-end and final release gates remain outstanding. Phases C–J are not certified by this document.

