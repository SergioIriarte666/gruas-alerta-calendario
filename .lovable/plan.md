

## Fix: Map Crane Types to Toll Vehicle Categories

### Problem
The toll API (`GetAPI Chile`) supports a `category` parameter for vehicle type (cars, trucks, heavy vehicles pay different rates). Currently, `calculateTolls()` is called without this parameter, defaulting to standard car rates. This explains why the user saw $7,900 instead of ~$76,000 for a Copiapo-Calama trip with a heavy crane.

### Solution

**1. Add a toll category mapping to `crane_consumption_rates` table**

Add a new column `toll_vehicle_category` to store the GetAPI category for each crane type:

| crane_type | toll_vehicle_category |
|---|---|
| heavy | 4 (or matching heavy vehicle category) |
| medium | 3 |
| light | 2 |
| horquilla | 3 |
| taxi | 1 |

We'll first query the GetAPI categories endpoint to confirm exact category values, then add the column and populate it.

**2. Update `ConsumptionRate` interface** (`src/hooks/useConsumptionRates.ts`)

Add `toll_vehicle_category: string` to the interface.

**3. Pass category through the calculation flow**

- **`TripCalculatorForm.tsx`**: Look up the selected crane's `toll_vehicle_category` from the rates data, and pass it to `calculateTolls(originCity, destCity, category)`.
- The `calculateTolls` function already accepts an optional `category` parameter -- it just needs to be provided.

**4. Update the consumption rate management UI** (if exists)

Add a field for `toll_vehicle_category` so admins can configure it per crane type.

### Files to modify
- **Database**: `ALTER TABLE crane_consumption_rates ADD COLUMN toll_vehicle_category text DEFAULT '1';` + UPDATE rows
- `src/hooks/useConsumptionRates.ts` -- add field to interface
- `src/components/trip-calculator/TripCalculatorForm.tsx` -- pass category to `calculateTolls`
- Any consumption rate admin form -- add the new field

### Alternative (simpler, no DB change)
Use a hardcoded mapping in the form component:

```text
const CRANE_TOLL_CATEGORY: Record<string, string> = {
  heavy: '4',
  medium: '3',
  light: '2',
  horquilla: '3',
  taxi: '1',
};
```

Then pass `CRANE_TOLL_CATEGORY[craneType]` to `calculateTolls()`. This is faster but less flexible. The DB approach is preferred for maintainability.

### Recommended approach
Use the DB column approach so categories can be adjusted without code changes. We'll also query the GetAPI `/categories` endpoint first to confirm the correct category identifiers.

