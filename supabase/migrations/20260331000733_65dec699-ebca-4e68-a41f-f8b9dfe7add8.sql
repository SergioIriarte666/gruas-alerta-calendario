-- Fix payment 9234da35: adjust amount to match applied total ($1,025,375)
UPDATE payments 
SET amount = 1025375, 
    status = 'applied', 
    updated_at = now() 
WHERE id = '9234da35-7e10-43e6-b918-b08d18b101be';