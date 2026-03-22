

## Plan: Fix jspdf build error in send-daily-pending-report edge function

### Problem

The edge function `send-daily-pending-report` uses `npm:jspdf@2.5.2` and `npm:jspdf-autotable@5.0.2` but there's no `deno.json` file declaring these dependencies, causing the build error.

### Solution

Create `supabase/functions/send-daily-pending-report/deno.json` with the npm dependencies mapped, and update the import statements in `index.ts` to use the mapped names.

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/send-daily-pending-report/deno.json` | **Create** — declare npm dependencies for jspdf, jspdf-autotable, resend, and supabase-js |
| `supabase/functions/send-daily-pending-report/index.ts` | Update imports to use mapped names from deno.json |

### Detail

**New `deno.json`:**
```json
{
  "imports": {
    "jspdf": "npm:jspdf@2.5.2",
    "jspdf-autotable": "npm:jspdf-autotable@5.0.2",
    "resend": "npm:resend@2.0.0",
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2.50.0"
  },
  "nodeModulesDir": "auto"
}
```

**Updated imports in `index.ts`:**
```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import jsPDFModule from "jspdf";
import autoTableModule from "jspdf-autotable";
```

