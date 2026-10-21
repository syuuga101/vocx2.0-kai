# Internal performance and audio review — 2026-10-21

## Changes

- Tango starts with meanings hidden. No stylesheet, layout, color, wording or interaction redesign was made.
- Dojo vocabulary books are reused while lesson-array references and the additional-example source remain unchanged. Live CSV replacement invalidates the cached books. Search normalization and escaped highlight HTML are reused for unchanged entry objects.
- Exam creation constructs only its selected range's word pool once, instead of scanning all ranges and reconstructing that pool several times.
- Public builds use the complete generated `data.js` once. The development CSV/JSON loader remains in source but is removed from the public app. Its 30 duplicate lesson downloads, corresponding precache entries and raw lesson copies are omitted from the release. All 520 words, 720 additional contexts and legacy fallback data remain in the generated bundle. Source CSV/JSON files remain editable in Git.
- Three PNGs were recompressed only when smaller. Before/after decoded RGBA buffers were identical; dimensions, transparency and displayed content were preserved. Images that grew were left untouched. No sound or font was replaced.
- Corrupt saved Dojo rows/range metadata are rejected instead of throwing while rendering the launcher. Leaving an exam now releases its hidden question/control DOM while preserving saved progress, avoiding leftover inaccessible content and memory.

## Measurements

The same machine, Node runtime and lesson data were used. These are repeated-operation microbenchmarks, not claimed mobile page-load timings.

| Measurement | Before | After |
| --- | ---: | ---: |
| Release file bytes (uncompressed) | 906,581 | about 734,000 |
| Repeated book construction/access, 1,000 calls | 4,703 ms | 14 ms |
| Exam creation, 1,000 calls | 3,328 ms | 544 ms |
| Duplicate raw-lesson fetches at release startup | 30 | 0 |

## Verification

- At 390×844, stable screenshots of the existing manually hidden-meaning state and the new default state had zero differing color channels. CSS and HTML source layout were not edited.
- Chromium responsive checks covered 320×568, 390×844, 390×430 and 1366×900: reveal/hide, inflected-word highlights, examples, search/empty state, source navigation, exam countdown, draft save/reload/resume and a 15/15 result. Vocx's ordinary quiz was also started from bundled lessons.
- Twenty verification scripts and the debug-free release build pass. New regression assertions cover default-hidden meanings, cached-book invalidation, corrupt saved questions, hidden-DOM cleanup, absence of duplicate release assets/download code, and offline availability of all bundled code and study data.
- The offline test runs the built service worker with network failure and generates/grades an exam from the precached bundle. It does not claim physical mobile/PWA or third-party font availability testing.

No further concrete correction was found in the reviewed startup, dataset, rendering, caching, persistence and packaging paths after these checks. This is a bounded review, not a guarantee that all possible bugs are absent.

## Audio follow-up

The final release including the new audio engine is 737,184 bytes (18.7% below the original package). The effect files themselves were retained: their measured leading silence was about 0–0.3ms, except the slide effect at 6.8ms, so trimming or changing their sound was unnecessary.

Effects now share one Web Audio context with interactive latency, predecoded buffers and a shared gain node. Duplicate URLs such as correct/completion load once. The app uses no HTML audio player or exclusive media-session claim for effects. It requests `ambient` where Audio Session is available; the [W3C Audio Session specification](https://w3c.github.io/audio-session/#audio-session-types) defines that type as mixable and Web Audio's default type as ambient. Unsupported setters are caught; actual OS/browser mixing is not guaranteed by JavaScript alone.

Pointer/touch/keyboard interaction resumes the context early. Correct/wrong playback is requested in the same handler immediately after the feedback UI is opened, without waiting for decoding. A cold/failed decode uses a short synthesized feedback tone immediately; the original file is used once ready. Requests delayed more than 100ms by context resumption are dropped instead of played over a later screen. Muting/backgrounding stops effects, and hidden pages do not queue sounds.

Real Chromium diagnostic measurements: warmed UI handler to buffer start was 0–0.3ms; first context recovery was about 60ms. These numbers exclude OS/output-device/Bluetooth latency and are not audible end-to-end timing claims. A separate looping media element remained playing while a decoded effect started (`paused: false`). The real app's countdown and correct-feedback flow ran without warning/error logs. iPhone/Safari plus the Spotify app was not available for direct verification.

All 21 verification scripts pass, including mixing configuration, buffer reuse, immediate start, mute/background, stale-resume rejection, cold fallback and precached offline availability of the audio engine. The app's layout and style remain unchanged.
