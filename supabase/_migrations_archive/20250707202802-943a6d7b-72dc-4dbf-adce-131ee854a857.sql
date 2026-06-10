-- Update cost centers with realistic budget amounts
UPDATE cost_centers SET budget_amount = 2000000 WHERE code = 'ADMIN'; -- $2M for administrative
UPDATE cost_centers SET budget_amount = 3000000 WHERE code = 'COMB'; -- $3M for fuel
UPDATE cost_centers SET budget_amount = 5000000 WHERE code = 'MANT'; -- $5M for maintenance
UPDATE cost_centers SET budget_amount = 1000000 WHERE code = 'MKT'; -- $1M for marketing
UPDATE cost_centers SET budget_amount = 20000000 WHERE code = 'OPER'; -- $20M for operations
UPDATE cost_centers SET budget_amount = 8000000 WHERE code = 'OPER-GRU'; -- $8M for crane operations
UPDATE cost_centers SET budget_amount = 3000000 WHERE code = 'OPER-SERV'; -- $3M for client services
UPDATE cost_centers SET budget_amount = 15000000 WHERE code = 'PERS'; -- $15M for personnel
UPDATE cost_centers SET budget_amount = 2000000 WHERE code = 'TEC'; -- $2M for technology

-- Update budget period to yearly for all centers to reflect these amounts
UPDATE cost_centers SET budget_period = 'yearly';