# Real catalogue image mapping — 16 September 2026 master

Status: read-only Drive audit plus local asset mapping. Drive contents and
permissions were not changed. The application has not been pointed at Drive;
the existing `/catalog-images` application asset boundary remains the serving
mechanism.

## Source folders

The supplied parent folder is:
`https://drive.google.com/drive/folders/1JJMyEPQSVtWstUaovGZCFMgpllnTg92e`

The four observed child folders are recorded in
`docs/real-catalogue/drive-image-index.json`:

| Folder | Drive folder ID |
|---|---|
| Gagan Dal & Whole Grain | `1Srx693Qy1CNT9p-Zsgo4V4VjuPB0AuuO` |
| Laxmi Toor Dal | `1eF5vaQGrwOLjhLwROHl5Ia86GbdhCQ8s` |
| Rice | `1lU6H0mQnmSbzMTHzm-zaFQcrVY3k35j3` |
| Sehmat Poha -Sabudana - Instant Mix | `1BIPQ9xGHSEUBGcj3p_CuOOqXkf-Tk-Wx` |

The index contains 104 exact Drive file IDs and filenames. It is an evidence
index, not a permission or sharing change.

## Matching policy

The generated manifest matches a workbook variant only by normalized product
name and exact pack notation. Numeric suffixes such as `-11` or `-18` are
removed only for candidate detection; they never silently select a file.

| Result | Count | Treatment |
|---|---:|---|
| Exact, unambiguous candidate | 89 | Eligible for a local optimized derivative under the variant-specific asset path. |
| Multiple candidates | 5 | Held for explicit visual/owner selection; no application image assigned. |
| No exact candidate | 11 | Held as neutral missing-image state; no nearby pack or similarly named product substituted. |

Ambiguous groups:

- `PREMIUM (5 kg x 4)` — `IMG_PREMIUM ...-11.jpg`, `...-18.jpg`;
- `SUPER (10 kg x 4)` — `IMG_SUPER ...-12.jpg`, `...-19.jpg`;
- `SEHMAT POHA (35 KG X 1)` — `...-02.jpg`, `...-12.jpg`;
- `MOONG MOGAR (30 kg x 1)` — `...-13.jpg`, `...-15.jpg`;
- `URAD CHILKA (30 kg x 1)` — `...-14.jpg`, `...-16.jpg`.

The two `MOONG Dal` images are not mapped to `MOONG MOGAR`; their packaging
identifies a different product. The two unrelated files `IMG_564 copy 7.jpg`
and `IMG.ai` are retained in the Drive evidence index but are not assigned.

Missing exact-image rows are source rows 15, 27, 43, 45, 47, 62/68, 63/69,
77, 101, 102, and 103. The generated JSON records the full candidate list,
source rows, Drive filename/ID, status, and the final variant asset reference.

## Delivery boundary

Matched derivatives must be copied into the repository's
`backend/assets/catalog/real/` path only after their source ID and variant
identity are recorded. They are named from the deterministic variant key, not
from an uncontrolled user filename. Original Drive files remain the source of
truth and must remain recoverable outside the app repository. Private receipt
storage is not used for catalogue images.
