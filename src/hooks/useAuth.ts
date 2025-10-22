import { useContext } from 'preact/hooks';
import { AuthContext } from '../app/provider';

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}