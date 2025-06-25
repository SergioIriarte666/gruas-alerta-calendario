
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'viewer' | 'client';
  client_id?: string;
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (error) {
          console.error('Error fetching user profile:', error);
          setUser(null);
        } else if (data) {
          setUser({
            id: data.id,
            email: data.email,
            name: data.full_name || data.email,
            role: data.role,
            client_id: data.client_id,
          });
        }
      } catch (error) {
        console.error('Error in fetchUserProfile:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [authUser, authLoading]);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
