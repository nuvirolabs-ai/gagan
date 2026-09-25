# Retailer Intelligence Contract

Retailer Intelligence is part of the existing Retailer Detail screen. It is not a separate report module.

The existing `/rep/intelligence/retailers/:retailerId/baseline` response supplies descriptive history: last order, days since last order, median/average order value, median order interval, last visit, regular categories, last-order facts and a trend only when six orders support comparison. The existing opportunity route supplies deterministic attention items. Retailer assignment is checked before either is shown.

The new screen presentation adds:

- last order and days since order
- average order and usual cycle
- last visit and route-today state
- regular categories
- recent order trend only when the baseline can support it
- last six order values only when at least three real orders exist
- current canonical schemes, with delivered progress and remaining value where supported

Outstanding, overdue and available credit continue to come from the existing financial summary. No new retailer intelligence table or AI recommendation engine is introduced.
