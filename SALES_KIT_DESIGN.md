# Sales Kit Design

Sales Kit lives under More and is read-only for the salesperson. It is a lightweight list grouped by category: product catalogue, schemes, new launch and brand story.

The current implementation deliberately uses a small API-owned staging fixture (`source: "demo"`) because the repository has no approved general collateral/content model. This keeps the mobile app independent of local files and avoids inventing a CMS. Each item has an id, title, type, category, description, URL and source.

The next production-ready step is to replace the fixture with a small canonical `SalesCollateral` model or an approved existing object-storage/content contract, without changing the mobile surface. Upload, publishing, permissions and expiry belong to the admin/content owner and are not fabricated by this pass.
