# Fast-loading My Blue Dots

## Changes
- Mirror the real UP and KA users, applications, live postings and organisation arms into this project's Cloud database.
- Replace repeated remote scans with one local, count-only SQL rollup, preserving organisation grouping, arm names, test exclusions, zero-participant arms and every participant toggle.
- Fetch ID-only participants separately when a dots dialog opens; preserve the coordinator roster using the same member reader.
- Show the last successful update beside Refresh. Refresh syncs first, then reloads counts and members.
- Run an initial sync and schedule authenticated updates every four hours.

## Correctness and security
- Preserve the existing **New-first, mutually exclusive lifecycle**: recently onboarded participants count as New rather than also Active/Inactive. This keeps the four cards and current output unchanged.
- Preserve unattributed/non-registered arms with org-ID fallback, as the current model does.
- Keep mirrors and SQL functions server-only; authorize reads and refresh through the existing account session pattern.
- Publish completed syncs atomically, remove obsolete mirrored rows, and prevent concurrent refreshes from overwriting each other. Failed updates leave the last successful snapshot available.
- Campaigns and Ecosystem remain untouched; no fabricated data.

## Technical approach
- Add indexed `bd_*` mirror tables, server-only rollup/member RPCs, and minimal staging/sync-state storage for safe snapshot publication.
- Share count-to-hierarchy shaping with the existing pure model, retaining bounded responses. Count-only results no longer need repeated two-org scans.
- Reuse the existing secret-authenticated scheduled-hook pattern; schedule the stable preview endpoint until publishing, since production cannot run newly added code before deployment.

## Verification
- Compare the old live model with the mirrored rollup for both instances, including JFC 1,408 / 1,381 / 27 and the DIC/Higher Education figures, reporting any real source changes.
- Measure old/new loading, RPC rows and payload size; test lifecycle boundaries, disambiguation, scoping, exclusions and lazy members.
- Sign in with a temporary Ghaziabad JFC account, capture All/Seeker/Provider and expanded arms/member dialogs, then delete the account.
- Run relevant tests and inspect preview build/runtime results; do not claim a separate typecheck if unavailable.