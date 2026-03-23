CREATE OR REPLACE FUNCTION create_supplier_payment_from_cost()
RETURNS TRIGGER AS $$
DECLARE
  v_payment_id UUID;
  v_status TEXT;
  v_paid_amount NUMERIC;
  v_paid_date DATE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.supplier_id IS NULL THEN
      RETURN NEW;
    END IF;
    
    IF NEW.supplier_payment_id IS NOT NULL THEN
      RETURN NEW;
    END IF;
    
    IF EXISTS (SELECT 1 FROM supplier_payments WHERE cost_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    
    IF (NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE) THEN
      v_status := 'paid';
      v_paid_amount := NEW.amount;
      v_paid_date := NEW.payment_date;
    ELSIF (NEW.date <= CURRENT_DATE AND NEW.payment_date IS NULL) THEN
      v_status := 'pending';
      v_paid_amount := 0;
      v_paid_date := NULL;
    ELSE
      v_status := 'pending';
      v_paid_amount := 0;
      v_paid_date := NULL;
    END IF;
    
    INSERT INTO supplier_payments (
      supplier_id, amount, paid_amount, description, 
      due_date, status, paid_date, cost_id, created_by,
      category
    ) VALUES (
      NEW.supplier_id,
      NEW.amount,
      v_paid_amount,
      COALESCE(NEW.description, 'Gasto registrado'),
      COALESCE(NEW.date, CURRENT_DATE),
      v_status,
      v_paid_date,
      NEW.id,
      NEW.created_by,
      COALESCE(NEW.subcategory, NEW.category_id::text, 'otros')
    ) RETURNING id INTO v_payment_id;
    
    UPDATE costs SET supplier_payment_id = v_payment_id WHERE id = NEW.id;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF NEW.supplier_payment_id IS NOT NULL OR OLD.supplier_payment_id IS NOT NULL THEN
      DECLARE
        v_sp_id UUID := COALESCE(NEW.supplier_payment_id, OLD.supplier_payment_id);
      BEGIN
        IF (NEW.payment_date IS NOT NULL AND NEW.payment_date <= CURRENT_DATE) THEN
          v_status := 'paid';
          v_paid_amount := NEW.amount;
          v_paid_date := NEW.payment_date;
        ELSE
          SELECT status, paid_amount, paid_date INTO v_status, v_paid_amount, v_paid_date
          FROM supplier_payments WHERE id = v_sp_id;
        END IF;
        
        UPDATE supplier_payments SET
          amount = NEW.amount,
          paid_amount = CASE WHEN v_status = 'paid' THEN NEW.amount ELSE paid_amount END,
          description = COALESCE(NEW.description, description),
          due_date = COALESCE(NEW.date, due_date),
          paid_date = CASE WHEN v_status = 'paid' THEN v_paid_date ELSE paid_date END,
          status = v_status,
          supplier_id = COALESCE(NEW.supplier_id, supplier_id),
          category = COALESCE(NEW.subcategory, NEW.category_id::text, category)
        WHERE id = v_sp_id;
      END;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    IF OLD.supplier_payment_id IS NOT NULL THEN
      DELETE FROM supplier_payments WHERE id = OLD.supplier_payment_id;
    END IF;
    DELETE FROM supplier_payments WHERE cost_id = OLD.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;