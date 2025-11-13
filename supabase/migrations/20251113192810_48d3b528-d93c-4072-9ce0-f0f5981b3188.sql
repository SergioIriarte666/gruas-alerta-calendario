-- Create patent_search_history table
CREATE TABLE patent_search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  patente text NOT NULL,
  marca text NOT NULL,
  modelo text NOT NULL,
  año integer,
  color text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE patent_search_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own search history
CREATE POLICY "patent_search_history_select_own"
  ON patent_search_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own search history
CREATE POLICY "patent_search_history_insert_own"
  ON patent_search_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own search history
CREATE POLICY "patent_search_history_delete_own"
  ON patent_search_history
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_patent_search_history_user_id ON patent_search_history(user_id);
CREATE INDEX idx_patent_search_history_created_at ON patent_search_history(created_at DESC);