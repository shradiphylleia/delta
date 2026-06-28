# Planner examples
demo inputs for the `/plan` endpoint.

## Start the API:

```powershell
cd backend
go run ./cmd/api
```

## Post the failing product API scenario:

```powershell
curl.exe -X POST http://localhost:8080/plan `
  -H "Content-Type: application/json" `
  --data-binary "@examples/product-api-plan.json"
```

## Post the surviving product API scenario:

```powershell
curl.exe -X POST http://localhost:8080/plan `
  -H "Content-Type: application/json" `
  --data-binary "@examples/product-api-survives.json"
```

## Scenario 1

`product-api-plan.json` shows a composed response that fails because `Pricing` is required, down and has no cache fallback.
Expected summary:

```json
{
  "root": "Product API",
  "status": "FAIL",
  "reason": "required dependency Pricing failed"
}
```

## Scenario 2

`product-api-survives.json` shows a composed response that survives. `Pricing` is live, `Inventory` can use fresh cache, `Reviews` can use stale data and `Recommendations` can be omitted.

Expected summary:

```json
{
  "root": "Product API",
  "status": "LIVE",
  "reason": "dependency is healthy"
}
```

