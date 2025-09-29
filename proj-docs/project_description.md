Full MCAT Study Schedule Planner — Coding Test Task (Back-end Only)

This task is to help determine a suitable developer for our project.

Successful completion of this will prove competency and will be followed up with a larger offer to help complete the remainder of the project (version-control, integration with front-end, analytics and schedule optimization phase, etc). You will only be responsible for back-end work, we have a separate front-end developer who you would potentially work with in the future.

Goal:

Build one HTTP GET endpoint that returns a complete schedule from start to test (about 3 months). The plan must respect availability, split study days into Phase 1 → Phase 2 → Phase 3, place 6 AAMC full lengths (FLs), and pack each study day to a 5-hour day including 1 hour of written review.
Use Organized_MCAT_Topics (3).xlsx (or a CSV export). Load in memory (no DB).

Endpoint (input):

GET /full-plan?start=YYYY-MM-DD
&test=YYYY-MM-DD
&priorities=1A, 1B, 1D, 3A, 3B, 4A, 4B, 5A, 5D, 5E, 6B, 7A, 9B // category order, highest first
&availability=Mon,Tue,Thu, Fri, Sat // study days; others = break
&fl_weekday=Sat / day to schedule AAMC FLs
* start: first calendar day to plan
* test: MCAT exam day (exclusive for scheduling)
* priorities: content categories in priority order (e.g., 1A, 1B, 1D… )
* availability: weekdays you plan (others = break)
* fl_weekday: weekday for Full Lengths (e.g., Sat)

Output (JSON):
Return an array of dated day objects from start to the day before test. Each date is one of:

* Break day:

"date":"2025-10-06", "kind":"break"

* Full length day:

"date":"2025-10-11", "kind":"full_length", "provider":"AAMC", "name":"FL #3"

* Study day (Phase 1):


"date":"2025-10-07", "kind":"study", "phase":1,
"blocks":
"science_content":[...KA video..., ...KA article, …Kaplan section...],
"science_discretes":[...KA set..., ...ThirdParty set...],
"cars":[...passage..., ...passage...],
"written_review_minutes": 60,
"total_resource_minutes": 240

* Study day (Phase 2):

"date":"2025-10-08", "kind":"study", "phase":2,
"blocks":
"science_passages":[..., ...],
"uworld_set": [...10Q...],
"extra_discretes":[...not used in Phase1...],
"cars":[..., ...],
"written_review_minutes": 60,
"total_resource_minutes": 240

* Study day (Phase 3):

"date":"2025-11-20", "kind":"study", "phase":3,
"blocks":
"aamc_sets":[...20–30Q pack A..., ...20–30Q pack B...],
"aamc_CARS_passages":[..., ...],
"written_review_minutes": 60,
"total_resource_minutes": 240


Timeline & day types:
1. Build the calendar from start → test
2. Mark study vs break by availability.
3. Count study days only and split evenly into thirds:
* Phase 1 (first third, in order)
* Phase 2 (second third)
* Phase 3 (final third)
4. Insert 6 AAMC FLs on fl_weekday, evenly spaced from start to test, no FL in last 7 days. On FL days, no other blocks.

Global rules:

Daily time budget:
* Each study day has 5 hours (300 min).
* Always reserve 60 min for Written Question Review (end of day).
* Remaining resource budget = 240 min.
* Use per-row times from the Excel. If missing, defaults:
* KA video 12, KA article 10, Kaplan section 30, discrete 30, passage 25, UWorld 10Q 30.
High-Yield first (HY)
* A concept key is HY if any row at that concept has high_yield = Yes.
* Phases 1 & 2: use HY concepts only under priorities.
* If a required slot can’t be filled with HY that day, you may use LY for that slot only.
Never repeat (Phases 1–2)
* The same resource from Khan Academy, Kaplan, or Jack Westin may appear once total across P1+P2 (schedule-wide).
* Keep used_resources(schedule_id, provider, resource_uid).
* resource_uid = stable id if present, else lower(trim(title))+url.
* UWorld can repeat while sets remain.
* Phase 2 discretes must be not used in Phase 1.

Specificity priority (for matching):
* Concept (preferred), otherwise Subtopic, then Category
* In code: concept = 0, subtopic = 1, category = 2 (sort ascending).
Numeric key order (within specificity)
* Concept rows: (subtopic_number ASC, concept_number ASC)
* Subtopic rows: (subtopic_number ASC)
* This ensures 1A.1.3 comes before 1A.2.1, and before 1A.1.4.

Time-fit (not “shorter first”):
* Prefer items inside a target band, then the one closest to target.
* KA video 15 (10–15)
* Kaplan 30 (20–30)
* Discrete 30 (25–35)
* Passage 25 (20–25)
* UWorld 10Q 30 (25–35)

CARS Provider rank (use only when relevant):
* CARS passages: Phases 1 + 2 = Jack Westin, Phase 3 = AAMC only

Same-day de-dup:
* Do not place the same resource twice on the same day (across blocks).
* Phase 3: the two AAMC sets must be from different packs unless nothing else is left.

What to schedule each study day:

Phase 1 (science first → CARS → review):
Goal: always pair Kaplan with matching KA content.
1. Science content (matched to same anchor key):
* 1 Kaplan section, plus matching KA content items (videos + articles)
2. Science discretes (same anchor key):
* 1 KA or Jack Westin discrete set
3. CARS: 2 Jack Westin passages
4. Written Question Review: 60 min (outside the 240)
If time runs short in the 240: keep Kaplan + ≥1 KA content, then KA 10Q, then 3rd-party 10Q, then CARS.

Phase 2 (science first → CARS → review):
1. Science passages: 2 third-party (same category/subtopic as anchor is fine)
2. UWorld: 1 set (10Q)
3. Extra discretes not used in Phase 1: 1–2 × discrete set (KA or Jack Westin)
4. CARS: 2 Jack Westin passages
5. Written Question Review: 60 min
If tight: keep 2 science passages + UWorld 10Q, then add 1 new discrete, then CARS; drop a second discrete first if needed.

Phase 3 (AAMC only → review):
1. AAMC sets: 2 × (20–30Q) from different packs
2. AAMC CARS passages: 2
3. Written Question Review: 60 min

Anchor & candidate selection (Phases 1–2):
1. Pick an anchor concept for the day from the HY pool in the highest-priority category with HY remaining.
2. Phase 1 science picks must match the same anchor; if any science slot can’t fill, widen together: Concept → Subtopic (AA.B.x) → Category (AA.x.x).
3. Phase 2 science may use the anchor (same subtopic OK). CARS is independent.
4. For each slot, build the candidate pool from the anchor via fallback, filter by slot type, never-repeat, supply, then sort by:
* Specificity (0/1/2)
* Numeric key order
* Time-fit (band → closeness)
* Provider rank (if applicable)
* Title A→Z, then stable id
Packing the 240 minutes: add items in the required order for the phase; skip an item if it would exceed 240, then continue.

Deliverables:
* Small Node/TypeScript service exposing /full-plan.
* In-memory XLSX/CSV read; no DB.
* Short README with run steps and one sample call.

How we’ll evaluate:
* ✅ Availability respected (correct break vs study days).
* ✅ Phases split by study-day count in order: P1 → P2 → P3.
* ✅ Six AAMC FLs: on fl_weekday, evenly spaced, none in last 7 days.
* ✅ Phase 1: Kaplan is matched with relevant KA content; KA/Kaplan/Jack Westin never repeat across P1+P2.
* ✅ Phase 2: includes passages, UWorld set, and discretes not used in P1.
* ✅ Phase 3: AAMC only; two sets from different packs per day.
* ✅ Daily time budget honored: 240 min resources + 60 min review.
* ✅ HY-first enforced (LY only if HY can’t fill a slot that day).
* ✅ Tie-breaks followed: Concept, Subtopic, Category, numeric key order, time-fit, provider rank.
* ✅ Deterministic: same inputs → same plan.
* ✅ Clean JSON + README.

Please let us know if you'd like more information / clarification and we'd like to set up a 15 minute call to discuss the task before starting.