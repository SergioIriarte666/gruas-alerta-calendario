export interface PendingUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  rut: string | null;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
}
