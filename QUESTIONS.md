# Open Questions & Decisions

The following items are tracked for user decisions as specified in Section 18 of the specification:

1. **`create-web-extension` Package**:
   - Would you like to publish a separate companion wrapper package named `create-web-extension` so users can run `npm create web-extension` / `bun create web-extension`?
   - *Status*: We have verified `create-web-extension` is currently vacant on npm. Per spec, not implementing until explicitly instructed.

2. **npm Publishing of `web-extension`**:
   - `web-extension` was unpublished on 2026-03-08. If the npm registry enforces a restriction or requires an owner reclaim during actual publish, what alternative package name (or scoped name, e.g. `@tiwphiraphan/web-extension`) would you prefer?
   - *Status*: Kept as `web-extension` per spec.

3. **MV2 Helper vs `vite-plugin-web-extension`**:
   - The spec prescribes a custom `build/mv2.ts` helper for MV2 targets (Firefox MV2, Safari MV2). If any edge case proves overly complex, would you permit `vite-plugin-web-extension` specifically for MV2 mode?
   - *Status*: Implementing custom `build/mv2.ts` helper as planned.

4. **Future UI Framework Support**:
   - Do you want UI framework options (e.g. React, Vue, Svelte) in a future iteration?
   - *Status*: Out of scope for v1 (vanilla only).

5. **Safari Xcode Project Generation**:
   - Should Safari targets in a future release generate an Xcode project automatically, or continue providing instructions for `xcrun safari-web-extension-converter`?
   - *Status*: Out of scope for v1 (instructions only).

