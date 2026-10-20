# Working on this project

- Before editing, check the working tree and fetch the latest remote state. Preserve other PCs' changes; use fast-forward updates when the tree is clean.
- UI changes require a real browser check before pushing. VM/script tests alone do not establish that the UI renders correctly.
- Check affected screens at 320×568 and 390×844, plus a desktop viewport. Inspect screenshots and element bounds for clipped controls, horizontal overflow, footer overlap, wrapped labels, and focus visibility. Test a reduced-height viewport for input-related changes.
- Exercise the changed user flow through its completion, including search/empty states or quiz feedback/results when relevant. Keep evidence and state clearly which devices or interactions were not checked; do not claim physical iPhone/Android testing from desktop emulation.
- Run all `scripts/verify-*.cjs` from the repository root and build the debug-free Pages release. Add meaningful regression coverage for bugs found during review.
- Keep development/debug tools in source and excluded from the public Pages release.
- After authorized changes pass review, commit and push, then confirm that local HEAD matches remote main and the working tree is clean. Do not use force push to reconcile other PCs' changes.
- GitHub Pages uses a manual workflow. A successful push does not update the public site. When the task requires a live-site update, dispatch the existing Pages workflow, wait for success, and check the deployed assets before reporting publication complete.
- Never commit secrets, credentials, private exports, or local environment files. Preserve the repository's ignore rules.
