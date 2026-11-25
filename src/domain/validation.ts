import { z } from 'zod';
import { CATEGORIES, URGENCIES } from './types';

export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 1000;
export const MAX_PHOTOS = 4;

export const requestFormSchema = z.object({
  unitId: z.string().min(1, 'Choose the unit this is about.'),
  category: z.enum(CATEGORIES, { message: 'Choose a category.' }),
  urgency: z.enum(URGENCIES, { message: 'Choose how urgent this is.' }),
  description: z
    .string()
    .trim()
    .min(DESCRIPTION_MIN, `Describe the problem in at least ${DESCRIPTION_MIN} characters.`)
    .max(DESCRIPTION_MAX, `Keep the description under ${DESCRIPTION_MAX} characters.`),
});

export type RequestFormValues = z.infer<typeof requestFormSchema>;
export type RequestFormErrors = Partial<Record<keyof RequestFormValues, string>>;

/** Returns a field -> message map; empty when valid. */
export function validateRequestForm(values: Partial<Record<keyof RequestFormValues, unknown>>): RequestFormErrors {
  const result = requestFormSchema.safeParse(values);
  const errors: RequestFormErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof RequestFormValues;
      if (!errors[key]) errors[key] = issue.message;
    }
  }
  return errors;
}

const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters.'),
});

export function validateSignIn(email: string, password: string) {
  const r = signInSchema.safeParse({ email, password });
  const errors: { email?: string; password?: string } = {};
  if (!r.success) {
    for (const i of r.error.issues) {
      const k = i.path[0] as 'email' | 'password';
      errors[k] ??= i.message;
    }
  }
  return errors;
}

export function validateMessage(text: string): string | null {
  const t = text.trim();
  if (t.length < 2) return 'Write a short message first.';
  if (t.length > 1000) return 'Keep messages under 1000 characters.';
  return null;
}
