# Verity API

Base path: `/api/applications`. All responses are JSON with `Cache-Control: no-store` and use one envelope:

```jsonc
// success
{ "ok": true, "data": { /* … */ } }
// failure
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "fieldErrors": { "dtiRatio": "…" } } }
```

Server errors return a generic message; details are written to the server log only.

---

## POST `/api/applications`

Validates the input, runs the decision engine and explanation engine, stores the result and returns it.

**Headers**

| Header | Required | Notes |
|---|---|---|
| `Content-Type: application/json` | yes | otherwise `415` |
| `Idempotency-Key` | no | 8–100 chars `[A-Za-z0-9_-]`. Re-sending the same key with the same values returns the original application (`200`) instead of creating a duplicate. Same key with different values → `409`. The form sends one automatically. |

**Body** — exactly these three JSON numbers (strings are rejected, not converted; extra fields are rejected):

| Field | Range | Precision |
|---|---|---|
| `monthlyIncome` | 1,000 – 1,000,000 (AED) | up to 2 decimals |
| `dtiRatio` | 0 – 10,000 (%) — above 100% means repayments exceed income | up to 2 decimals |
| `creditScore` | 300 – 900 | whole number |

```bash
curl -X POST http://localhost:3000/api/applications \
  -H "Content-Type: application/json" \
  -d '{"monthlyIncome": 8000, "dtiRatio": 48, "creditScore": 690}'
```

**201 Created** (`Location: /api/applications/{id}`)

```jsonc
{
  "ok": true,
  "data": {
    "id": "VRT-RGCTKXJ9DN",
    "createdAt": "2026-11-05T10:45:12.000Z",
    "input": { "monthlyIncome": 8000, "dtiRatio": 48, "creditScore": 690 },
    "decision": "APPROVED",
    "score": 54,
    "threshold": 50,
    "policyVersion": "verity-demo-1.0",
    "contributions": { "monthlyIncome": 2.2, "dtiRatio": -6.3, "creditScore": 8.1 },
    "details": {
      "baseScore": 50, "maximumDti": 60, "dtiLimitExceeded": false,
      "factors": [ { "key": "monthlyIncome", "label": "Monthly income", "value": 8000, "referenceValue": 6000,
                     "normalised": 0.222, "contribution": 2.2, "maxPoints": 10, "status": "supports", "strength": "slight" },
                   "…" ]
    },
    "explanation": {
      "headline": "Approved — mainly supported by your credit score.",
      "summary": "Your credit score points to a good record of managing credit and … close to the threshold …",
      "outcomeReason": "…",
      "supporting": ["creditScore", "monthlyIncome"], "concerns": ["dtiRatio"], "neutral": [],
      "borderline": true,
      "factors": [ { "key": "monthlyIncome", "statusLabel": "Supports approval", "text": "…", "…": "…" } ],
      "pathsToApproval": [], "pathsNote": null,
      "disclaimer": "Contributions come from Verity's demonstration scoring policy. They are not SHAP or LIME values …"
    }
  }
}
```

| Status | Code | When |
|---|---|---|
| 400 | `INVALID_JSON` | body is not valid JSON |
| 400 | `INVALID_IDEMPOTENCY_KEY` | malformed `Idempotency-Key` |
| 409 | `IDEMPOTENCY_CONFLICT` | key reused with different values |
| 413 | `PAYLOAD_TOO_LARGE` | body over 10 KB |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | not JSON |
| 422 | `VALIDATION_ERROR` | missing / non-numeric / out-of-range values (see `fieldErrors`) |
| 500 | `INTERNAL_ERROR` | database or server failure |

---

## GET `/api/applications?limit=20`

Newest-first history plus statistics calculated from **all** stored records. `limit` 1–100 (default 20).

```jsonc
{ "ok": true, "data": {
  "items": [ { "id": "VRT-…", "createdAt": "…", "input": { "…": "…" }, "decision": "REJECTED", "score": 41.8 } ],
  "summary": { "total": 5, "approved": 3, "rejected": 2, "averageScore": 57.2 }
} }
```

Errors: `400 INVALID_QUERY`, `500 INTERNAL_ERROR`.

---

## GET `/api/applications/{id}`

One stored application in the same shape as the POST response.
Errors: `400 INVALID_ID` (not `VRT-` + 10 characters), `404 NOT_FOUND`, `500 INTERNAL_ERROR`.

---

## DELETE `/api/applications?confirm=true`

Clears all demonstration history. Without `?confirm=true` it returns `400 CONFIRMATION_REQUIRED`
and deletes nothing.

```jsonc
{ "ok": true, "data": { "deleted": 5 } }
```

---

## GET `/api/dataset`

Returns one record from the project dataset, converted to Verity's units. Nothing is scored or
stored — submit the `input` values with `POST /api/applications`.

| Query | Returns |
|---|---|
| `?userId=U00002` | that record (case-insensitive) |
| `?random=true` | any record |
| `?random=true&loan=true` | a record that has a loan |

```jsonc
{ "ok": true, "data": {
  "userId": "U00002",
  "hasLoan": true,
  "input":  { "monthlyIncome": 12970.28, "dtiRatio": 140, "creditScore": 543 },
  "source": { "monthlyIncomeUsd": 3531.73, "debtToIncomeRatio": 1.4, "creditScore": 543 },
  "datasetSize": 32424
} }
```

Errors: `400 INVALID_QUERY` (no query or malformed ID), `404 NOT_FOUND`, `500 INTERNAL_ERROR`
(dataset file missing or malformed — details only in the server log).
