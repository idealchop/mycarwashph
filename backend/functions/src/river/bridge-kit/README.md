# bridge-kit (vendored)

Copied from `idealchop/River-Mobile-App` branch `cursor/river-bridge-phase-0-839a`
(commit `aa192e8`, PR #3), folder `bridge-kit/src/`. The only change is the `.js`
suffix on relative imports (this package is ESM / NodeNext) and one type-only `match[1]!` in
verify.ts for `noUncheckedIndexedAccess`. Do not edit the
logic here; pull a new copy from the Bridge repo instead, then rerun
`pnpm --filter @mycarwash/functions conformance`.
