<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules

- My Blue Dots reads count and member RPCs directly from the campaign-manager source DB (no local mirror sync) with a shared pure hierarchy projection; initial responses contain bounded counts, while IDs load lazily through the scoped member RPC.
- Blue Dots server functions require a signed httpOnly login credential and registry-validated persona scope, never a client-set role.
- Blue Dots data is keyed by instance plus source ID because UP and KA reuse user and item IDs.
- My Blue Dots uses the model's single statsFor selector via pure view projections for all participant-dependent surfaces; coverage excludes zero-dot units while tables retain them.

- Server functions must never return whole tables: responses are bounded by a framework size cap, so large lists are read in slices and stitched together client-side (see `fetchReviewCalls` + `useReviewCalls`). Keep slice steps derived from rows actually returned, because the database may hand back fewer rows than asked.
- Review-list reads must not select the heavy `data` jsonb column; only single-call detail fetches may (detoasting transcripts is what made the list time out).
