# Roadmap

- [x] Mirror Blue Dots into local Cloud, add SQL rollup and authenticated sync; initial sync complete.
- [x] Switch persona counts to fast rollup and participant drill-downs to lazy mirror reads; show freshness and refresh.
- [x] Compare live counts and timings, test toggles/drills, and delete temporary verification accounts.
- [ ] Activate hosted four-hour Blue Dots sync — schedule exists; waits for publishing the new endpoint (hosted preview endpoint returned 404).

- [x] Audit and fix participant-view totals, ordering, attention and network/coverage in district and owner views.
- [x] Test toggle rules and verify all three live states with temporary accounts; delete accounts afterward.

- [x] Use live coordinator organisation names with same-org collision suffixes; test district/owner and delete temporary accounts.

- [x] Verify live Blue Dots hierarchy and replace all three persona samples.
- [x] Test hierarchy/lifecycle rules and verify district/owner drill-downs; delete temporary accounts.

- [x] Sapijodzi donation flow: `/donera` form, Zeffy prefill handoff, webhook, CSV to Agnes, DB tables
- [x] ATLAS urgency score: `atlas_cohort_members` migration + optional urgency in
      `atlasBuildCohort` + planner inputs and members table in `/atlas`
- [ ] Donation flow config — needs the user to add secrets: `ZEFFY_API_KEY`, `ZEFFY_WEBHOOK_TOKEN`
      (same value pasted into Zeffy's webhook config), `RESEND_API_KEY`,
      `ZEFFY_FORM_ONETIME_URL`, `ZEFFY_FORM_MONTHLY_URL`
