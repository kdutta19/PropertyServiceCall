import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { mapError } from '../../data/errors';
import type { Repository } from '../../data/repository';
import type { Profile } from '../../domain/types';

interface AuthValue {
  repo: Repository;
  user: Profile | null;
  /** True until the stored session has been checked. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let alive = true;
    repo
      .restoreSession()
      .then((p) => alive && setUser(p))
      .catch(() => undefined)
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [repo]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        qc.clear();
        setUser(await repo.signIn(email, password));
      } catch (e) {
        throw mapError(e);
      }
    },
    [repo, qc],
  );

  const signOut = useCallback(async () => {
    await repo.signOut();
    qc.clear(); // never leave one person's cached data in memory for the next
    setUser(null);
  }, [repo, qc]);

  const value = useMemo(() => ({ repo, user, loading, signIn, signOut }), [repo, user, loading, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}

export function useRepo(): Repository {
  return useAuth().repo;
}

/** Signed-in user; only call from screens behind the auth gate. */
export function useUser(): Profile {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user;
}
