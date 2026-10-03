# Vendored River Apps UI Kit packages

`tokens/`, `icons/` and `ui/` are copied from the River Apps UI Kit
(private repository `idealchop/river-apps-ui-kit`) at commit **40c7221**
("feat(docs): Next.js demo with component gallery, 7 reference screens,
screenshots and README").

They are vendored so this repository builds standalone, in CI and on any
machine, without access to the private kit repository or a package registry.

- Package names are unchanged (`@river-apps/tokens`, `@river-apps/icons`,
  `@river-apps/ui`) and are consumed as pnpm workspace packages (`workspace:*`).
- Upstream changes to the kit first, then re-vendor. Keep local edits minimal
  and list them below.
- Licensing: see `packages/LICENSE`. The kit is proprietary to River Apps; the
  public visibility of this repository does not grant a licence to reuse it.
  Bundled fonts (Plus Jakarta Sans, Geist Mono) are under the SIL OFL 1.1
  (`tokens/fonts/OFL.txt`).

## Local edits since 40c7221

- None.

## Re-vendoring

```bash
KIT=../river-apps-ui-kit
for p in tokens icons ui; do
  rm -rf packages/$p
  (cd $KIT/packages && tar cf - --exclude node_modules --exclude dist $p) | tar xf - -C packages
done
```
