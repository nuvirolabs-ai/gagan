import type { FounderPulse } from "../pulse/viewState";

/** Captured from GET /founder/pulse against local canonical data after seed:founder-uat. */
export const PULSE_VISUAL_FIXTURE: FounderPulse = {
  "asOf": "2026-09-02T10:11:27.539Z",
  "period": {
    "label": "Wednesday, 2 September"
  },
  "sourceStatus": "partial",
  "isStale": true,
  "viewer": {
    "staffId": "visual",
    "name": "Ananya Shah"
  },
  "summary": {
    "greeting": "Good afternoon, Ananya",
    "headline": "Attention required: sales team is at risk.",
    "tone": "risk"
  },
  "metrics": [
    {
      "id": "orders",
      "label": "Orders",
      "value": 124800,
      "unit": "inr",
      "availability": "available",
      "delta": {
        "amount": 93800,
        "unit": "inr",
        "direction": "up"
      }
    },
    {
      "id": "collections",
      "label": "Collections",
      "value": 27100,
      "unit": "inr",
      "availability": "available",
      "delta": {
        "amount": 27100,
        "unit": "inr",
        "direction": "up"
      }
    },
    {
      "id": "fillRate",
      "label": "Fill rate",
      "value": 90,
      "unit": "percent",
      "availability": "available",
      "delta": {
        "amount": 10,
        "unit": "points",
        "direction": "down"
      }
    },
    {
      "id": "blocked",
      "label": "Blocked",
      "value": 78000,
      "unit": "inr",
      "availability": "available",
      "delta": null
    }
  ],
  "secondaryMetrics": [],
  "changes": [
    {
      "id": "orders-pace",
      "type": "POSITIVE_CHANGE",
      "title": "Sales accelerated",
      "explanation": "Order value is ahead of last Wednesday.",
      "businessImpact": {
        "amount": 93800,
        "unit": "inr"
      }
    },
    {
      "id": "fill-rate",
      "type": "NEGATIVE_CHANGE",
      "title": "Fill rate fell",
      "explanation": "Fill rate is 90% versus 100% on the comparable day.",
      "businessImpact": {
        "amount": 10,
        "unit": "percent"
      }
    }
  ],
  "blocked": {
    "totalUniqueValue": 78000,
    "categories": [
      {
        "id": "CREDIT",
        "uniqueValue": 78000,
        "orderCount": 1
      }
    ]
  },
  "health": [
    {
      "domain": "Sales",
      "status": "HEALTHY",
      "reason": "Order value is at or above expected pace."
    },
    {
      "domain": "Collections",
      "status": "WATCH",
      "reason": "Confirmed collections are behind the comparable day."
    },
    {
      "domain": "Inventory",
      "status": "HEALTHY",
      "reason": "Inventory is not holding a material share of open orders."
    },
    {
      "domain": "Fulfilment",
      "status": "WATCH",
      "reason": "Fill rate is between 90% and 95%."
    },
    {
      "domain": "Receivables",
      "status": "WATCH",
      "reason": "Not enough canonical data to judge this domain."
    },
    {
      "domain": "Sales Team",
      "status": "AT_RISK",
      "reason": "Many expected salespeople have not started their day."
    },
    {
      "domain": "Systems",
      "status": "HEALTHY",
      "reason": "No critical system issues detected."
    }
  ],
  "issues": [
    {
      "id": "blocked-credit",
      "severity": "HIGH",
      "title": "Orders waiting on credit approval",
      "explanation": "1 open order is held for credit approval.",
      "businessImpact": {
        "amount": 78000,
        "unit": "inr"
      },
      "owner": "Credit"
    }
  ],
  "pendingDecisions": {
    "count": 1,
    "label": "1 decision needs your attention."
  }
} as FounderPulse;
