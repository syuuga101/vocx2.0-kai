# UI / UX review — 2026-10-20

## Dojo exam rework

Dojo session lifecycle now includes resume/new selection for saved attempts, actual preparation-stage progress followed by a three-second countdown with the existing sound preference, and save/discard/cancel on exit. Preparation, countdown and exit confirmation do not consume exam time. Autosave survives reload; explicit discard removes the attempt while retaining best/perfect-clear history. Preparation cancellation preserves the previous attempt. Storage failures leave the confirmation open for retry.

The release build was exercised in Chromium at 320×568, 390×844, 390×430 and 1366×900. Verified: start-choice focus, 3-second screen before editable questions, changed questions/blank answers on a new attempt, typed and selected drafts restored after save/exit/reload/resume, scroll restoration, frozen exit timer, return-to-paper, discard surviving reload, and final grading/return. At reduced height, all three exit actions remained inside the viewport. Browser warning/error logs were empty. Fake-clock regression tests additionally cover exact countdown timing, loading cancellation, save/discard failure and retry, timeout, late inputs and idempotent grading. All 18 scripts and the release build pass. Physical mobile keyboards/Safari were not tested.

Follow-up visual alignment: the exam now follows the supplied LMS screenshot directly: grey material/exit toolbar, blue/grey desktop material sidebar, plain single-line English section headings, compact numbered dropdown rows with `>` markers, a short dashed separator and thin rectangular text fields with grey save buttons. Decorative row separators and green primary buttons were removed. Mobile retains the same neutral forms with 44px control heights and places answers below sentences; the sidebar is hidden. The release was inspected at 1366×900, 320×568, 390×844 and 390×430, including text saving and a 2/15 graded result. Footer bounds matched viewport height, no horizontal overflow was found, and browser warnings/errors were empty. All 18 scripts and the release build pass.

The new primary Dojo flow uses an 11-minute paper with eight dropdown blanks and seven spelling blanks. The screenshot informs the white paper, sentence numbering, native dropdowns and individual save buttons; personal/course identifiers were not copied. Questions are generated from the existing unit examples, not unseen actual exam questions. Unit 19–20 through 26–27 are available; the final three pairs are disabled because Units 28–30 are absent.

Real browser checks covered 320×568, 390×844, 1280×900 and a reduced 390×430 input viewport. No horizontal overflow or footer clipping was found. The desktop layout puts dropdowns beside sentences; mobile places controls underneath. Input text uses 16px and focus remains visible. The debug-free release was checked separately and had eight selects, seven inputs, no debug panel and no runtime warnings/errors.

The browser flow included choice and text entry, per-question saving, exit/reload/resume with preserved answers and order, unanswered confirmation/cancel, all 15 answers submitted, a 13/15 result with locked controls and inline correct/incorrect feedback, and automatic time-expiry grading. Tango's Dojo source now lists the same paired ranges with 40 entries each. All 18 verification scripts and the Pages build pass, including generated-paper coverage, answer-bank isolation, resume, time expiry and duplicate-grading prevention. These remain desktop responsive checks, not physical mobile or software-keyboard tests.

## Findings and fixes

- The app used the physical screen height in ordinary browser mode. At a 390×844 viewport, its height became 900px and the 88px footer extended below the visible screen. The app now uses the visible browser height, observes keyboard-related viewport resizing, and preserves pinch zoom.
- The main footer overlaid scrollable content. It now occupies its own fixed-size flex row, while lists and quiz content have explicit shrinkable scroll regions.
- The home header had 42px of extra top spacing. This is now 20px plus the safe-area inset, leaving more usable space on short screens.
- Unit scroll hints overlapped labels. Smaller hints are now aligned to the unused edge rather than the middle of the list.
- Long result lists required scrolling to reach Home. The return action now stays visible with an opaque backing; the scroll hint is placed clear of that action. Result titles use balanced wrapping and scrollbars follow the dark theme.
- Custom confirmation/profile dialogs left keyboard focus on the background. Dialog semantics, background inertness, Tab/Shift+Tab containment, Escape dismissal, and return focus are now implemented. These helpers are preserved in release builds.
- Tango search used a 14px input font. It now uses 16px to avoid triggering the small-input zoom behavior on mobile Safari. Meaning/example controls also have visible keyboard focus.
- The Oni subtitle wrapped a lone final character on a 320px screen. It was shortened without changing the mode.

## Browser checks

Verified in an actual Chromium browser, using desktop responsive viewport overrides:

| Viewport / flow | Evidence |
| --- | --- |
| 320×568 | Home and footer within the viewport; mode sheet, both Vocx choice layouts, correct/wrong feedback, profile editor |
| 390×844 | Tango source/unit navigation; search counts; meaning reveal; examples; settings; pause/quit confirmation; Dojo questions/results |
| 430×932 | Release-build Tango list, all controls within width; footer bottom equals viewport height |
| 1366×768 | Release-build centered phone layout, three tabs, unit list, footer within height |
| 320×360 | Reduced-height typing field, submission, and answer feedback |

The Vocx English-choice quiz was completed through all 20 questions using browser controls. Dojo Part 1 (four-choice then three-choice) and Part 2 (two-choice) were completed through their result screens. Correctness feedback, next-question transitions, scores, mistake lists, and return navigation were inspected. The public release build was tested separately from the development version, with debug controls absent.

Tango was checked with Japanese search, empty results, meaning hiding/revealing, example expansion, and Vocx/Dojo switching. No horizontal overflow was found in the inspected Tango controls and entries. Browser runtime warning/error logs were checked.

## Automated coverage

All 17 `scripts/verify-*.cjs` checks pass, including the new viewport-height regression and overlay-focus/release-preservation checks. The debug-free Pages build succeeds and contains every referenced asset.

## Limits

These checks use desktop Chromium with responsive dimensions. Physical iPhone/Android hardware, the actual iOS software keyboard, and Safari standalone/PWA behavior were not tested. Reduced-height testing is not a substitute for a physical keyboard/device check. Pixel-perfect equivalence across browsers is not claimed.

Future UI changes must follow `AGENTS.md`: real browser evidence, relevant end-to-end flows, automated regression checks, and public release verification before reporting completion.
