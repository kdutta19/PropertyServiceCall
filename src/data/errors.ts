export type AppErrorCode =
  | 'network'
  | 'auth'
  | 'forbidden'
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'unknown';

/** Error with a message that is safe and useful to show to a person. */
export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public retryable = false,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

interface SupabaseLikeError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
  details?: string;
}

/** Postgres/PostgREST/GoTrue errors -> friendly AppError. Raw text never reaches the UI. */
export function mapError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const e = (err ?? {}) as SupabaseLikeError;
  const msg = (e.message ?? '').toLowerCase();

  if (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network error') ||
    msg.includes('timeout') ||
    e.name === 'TypeError'
  ) {
    return new AppError('network', 'Can’t reach the server. Check your connection and try again.', true);
  }
  if (msg.includes('invalid login credentials')) {
    return new AppError('auth', 'That email and password don’t match. Try again.');
  }
  if (msg.includes('email not confirmed')) {
    return new AppError('auth', 'Confirm your email address first, then sign in.');
  }
  if (e.status === 401 || msg.includes('jwt')) {
    return new AppError('auth', 'Your session expired. Please sign in again.');
  }
  // Our RPCs raise SQLSTATE P0001 with a message prefixed "psc:" that is safe to show.
  if (e.code === 'P0001' && e.message?.startsWith('psc:')) {
    return new AppError('validation', e.message.slice(4).trim());
  }
  if (e.code === '42501' || e.status === 403 || msg.includes('row-level security')) {
    return new AppError('forbidden', 'You don’t have permission to do that.');
  }
  if (e.code === 'PGRST116') return new AppError('not_found', 'That request could not be found.');
  if (e.code === '23505') return new AppError('conflict', 'That was already saved.');
  if (e.status && e.status >= 500) {
    return new AppError('unknown', 'The server had a problem. Please try again in a moment.', true);
  }
  return new AppError('unknown', 'Something went wrong. Please try again.', true);
}
