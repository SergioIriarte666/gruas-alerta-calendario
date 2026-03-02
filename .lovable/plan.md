

## Fix: Toll API Categories Use Text Values, Not Numbers

### Root Cause
The GetAPI Chile toll API expects **text-based** category values like `LIVIANO`, `CAMION`, `MOTO`, etc. -- NOT numeric values like `1`, `2`, `3`, `4`.

From the OpenAPI spec (line 971): `example: LIVIANO`

The logs confirm this: `"Categoría inválida: 3"` -- the API rejects numeric categories, and the fallback retries without any category, returning default (car/LIVIANO) rates. That's why a heavy crane trip shows $7,900 instead of the correct higher amount.

### Changes Required

**1. Database migration -- update `toll_vehicle_category` values in both tables**

Update `cranes` and `crane_consumption_rates` tables to use the correct text values:

| Current (numeric) | Correct (text) | Applies to |
|---|---|---|
| `1` | `MOTO` | Motorcycles |
| `2` | `LIVIANO` | Cars, pickups (VBPH-58, horquilla) |
| `3` | `CAMION` | 2-axle trucks (TLYF-23, TDCJ-46, FYTR-49) |
| `4` | `CAMION` | Heavy trucks (DCBV-94) |

We need to query the `/categories` endpoint to confirm exact valid values, but based on the documentation, `LIVIANO` and `CAMION` are the two relevant ones.

**2. Update the CraneForm.tsx toll category selector**

Change the dropdown options from numeric (1-4) to text values (`LIVIANO`, `CAMION`, `MOTO`, etc.).

**3. Update ConsumptionRatesManager.tsx toll category selector**

Same change -- use text values instead of numbers.

**4. Query the categories endpoint for confirmation**

Call the `/categories` endpoint via the edge function to get the exact list of valid category strings, and ideally use those to populate the selectors dynamically or at least validate our mapping.

### Technical Details

**Migration SQL:**
```sql
-- Update cranes table
UPDATE cranes SET toll_vehicle_category = 'CAMION' WHERE toll_vehicle_category IN ('3', '4');
UPDATE cranes SET toll_vehicle_category = 'LIVIANO' WHERE toll_vehicle_category IN ('1', '2');

-- Update crane_consumption_rates table
UPDATE crane_consumption_rates SET toll_vehicle_category = 'CAMION' WHERE toll_vehicle_category IN ('3', '4');
UPDATE crane_consumption_rates SET toll_vehicle_category = 'LIVIANO' WHERE toll_vehicle_category IN ('1', '2');
```

**Files to modify:**
- New Supabase migration (update existing category values)
- `src/components/cranes/CraneForm.tsx` -- change Select options to text values
- `src/components/trip-calculator/ConsumptionRatesManager.tsx` -- change Select options to text values

No changes needed to the edge function or calculation hooks since they already pass the category string through as-is.

