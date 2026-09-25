# Salesperson App Intelligence Design

This pass deepens the existing Field Companion rather than creating a second analytics product. The app remains a calm working companion for one salesperson and one assigned retailer book.

## Read-model rules

- Orders, visits, collections, targets, working calendar, route plans, retailer baselines and canonical schemes remain the only business sources.
- A screen may make one aggregated request that fans out to bounded database reads. It must not issue one request per chart or retailer.
- Missing history is represented as unavailable, not a fake zero line or a prediction.
- Existing deterministic opportunity triggers remain the only "needs attention" logic. No AI recommendations are added.
- Money is INR and is displayed with the same current Field Companion typography and warm ivory / green / gold palette.

## Surface map

| Need | Existing surface | New depth |
| --- | --- | --- |
| How am I doing? | Activity > Performance | 7D/30D daily bars, target context, productivity, category mix and route history |
| What should I know before this call? | Retailer Detail | Store Intelligence, last six orders and canonical schemes |
| What did I hand off today? | Today > End My Day | Review summary and optional auditable manager note |
| What can I show a retailer? | More | Read-only Sales Kit |

## Deferred deliberately

Stock audit, competitor intelligence, returns, surveys/photos, signatures, full offline ordering, distributor operations, distance expense, and real SAP B1 remain documented gaps. Adding them here would introduce new authority or operational contracts rather than deepen the approved field experience.
