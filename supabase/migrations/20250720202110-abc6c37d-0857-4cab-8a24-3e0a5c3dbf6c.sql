
-- Add new service status for inspection completed
ALTER TYPE service_status ADD VALUE 'inspection_completed';

-- Update the status helpers to include the new status
COMMENT ON TYPE service_status IS 'Service status: pending, in_progress, inspection_completed, completed, cancelled, invoiced';
