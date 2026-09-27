# GGN-UX-02 thumbnail decode trial: rejected

27 September 2026, Moto E13 `ZD2229Q3KB`, Android font scale 1.3, Mahesh Store, existing hosted 52-item catalogue, same Products list, eight 800-pixel/260-ms upward swipes after visible 52-item load. No filter, account, navigation mode, server, stock guard, or product data was changed. The v29 accepted return-to-Products focus-refresh behavior stayed in the candidate source. This was a reversible local trial, not a release commit.

Hypothesis: legacy 1254x1254 remote PNGs are unnecessarily decoded at full resolution for 56-108 px list/Home thumbnails. Trial diff `b8b390e8507c10a79db7d7fe9a8f0bac14fb0b260d6fe50639738a6c1efac58e` applied React Native `resizeMethod="resize"` only to `ProductThumb` list/Home uses, leaving Product Detail's 168 px image unchanged. The trial had a red-to-green unit test, 39 Retailer test files/157 tests, typecheck and a signed release build. Trial APK `com.gagan.retailer.review` 1.0.30-trial/code 30, SHA-256 `671ea49a5b6572cc344e15d45f5e8b1793ed8b00f87458a3a418d7b2eac50d0d`, signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, embedded trial source label `4721d71+thumb-b8b390e8-trial`. It was installed in place without clearing app data.

| Pass | Rendered frames | Missed deadlines | p95 frame | App PSS |
|---|---:|---:|---:|---:|
| Accepted v29, first Products pass after force-stop | 254 | 10 (3.94%) | 23 ms | 218,932 KB |
| Accepted v29, warm retap pass | 270 | 4 (1.48%) | 23 ms | Not sampled |
| Trial v30, first Products pass after in-place install | 254 | 216 (85.04%) | 32 ms | 181,450 KB |
| Trial v30, warm retap pass | 242 | 3 (1.24%) | 21 ms | Not sampled |

The first-run memory/cache state was **not equivalent**: v29 was previously used, while v30 had just been installed. The frame-rate difference is a strong negative signal, not a controlled causal attribution. The trial's lower-list package images were visibly softer than v29 at the same font scale and display; see [v29 first](catalog-v29-trial-baseline-first.png), [v29 lower](catalog-v29-trial-baseline-lower.png), [v30 first](catalog-v30-resize-trial-first.png), [v30 lower](catalog-v30-resize-trial-lower.png). No blank cells were seen in these snapshots, but exhaustive fast-scroll, search/filter, Add and 20-item Home preview regressions were not run because the quality regression already disqualifies the trial.

Decision: **reject**, do not commit or hand off the `resizeMethod` source change or trial APK. The accepted v29 APK was reinstalled in place from its hash-verified artifact `00239aa176dca93809ef2551858a68e6cdb2e609dfa007270628d7d51e349874`; package reports 1.0.29/code 29 and Mahesh's Home/session survived. The trial source/test and generated Gradle version edits were removed; source remains at canonical `4721d71cd40edfb9a4d2d01f4e56a949ab874bbc`. Cold-scroll causality and a non-regressing improvement remain open, so GGN-UX-02 stays PARTIAL.
