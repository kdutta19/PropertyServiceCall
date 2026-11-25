import type { Priority, Status, Urgency } from '../domain/types';

/** Restrained palette. Text/background pairs below meet WCAG AA (4.5:1) for normal text. */
export const colors = {
  bg: '#F5F6F4',
  surface: '#FFFFFF',
  border: '#D9DDD8',
  text: '#1B2420',
  textMuted: '#4F5B55',
  primary: '#1F5F5B',
  primaryText: '#FFFFFF',
  primarySoft: '#E3EFEC',
  danger: '#A12B1F',
  dangerSoft: '#FBE9E6',
  warning: '#8A5A00',
  warningSoft: '#FFF3D6',
  success: '#2D6A3E',
  successSoft: '#E4F2E7',
  info: '#2F4F7F',
  infoSoft: '#E6EDF7',
  neutralSoft: '#ECEEEB',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, pill: 999 };
export const TOUCH = 48; // minimum touch target
export const MAX_CONTENT_WIDTH = 720;

export const font = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, lineHeight: 23, color: colors.text },
  small: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.text },
};

export const statusStyle: Record<Status, { fg: string; bg: string; dot: string }> = {
  new: { fg: colors.info, bg: colors.infoSoft, dot: '#2F4F7F' },
  assigned: { fg: '#4A3F8A', bg: '#ECE9F8', dot: '#4A3F8A' },
  in_progress: { fg: colors.primary, bg: colors.primarySoft, dot: colors.primary },
  waiting_on_tenant: { fg: colors.warning, bg: colors.warningSoft, dot: '#B27300' },
  completed: { fg: colors.success, bg: colors.successSoft, dot: colors.success },
};

export const urgencyStyle: Record<Urgency, { fg: string; bg: string }> = {
  routine: { fg: colors.textMuted, bg: colors.neutralSoft },
  soon: { fg: colors.warning, bg: colors.warningSoft },
  emergency: { fg: colors.danger, bg: colors.dangerSoft },
};

export const priorityStyle: Record<Priority, { fg: string; bg: string }> = {
  low: { fg: colors.textMuted, bg: colors.neutralSoft },
  normal: { fg: colors.info, bg: colors.infoSoft },
  high: { fg: colors.warning, bg: colors.warningSoft },
  urgent: { fg: colors.danger, bg: colors.dangerSoft },
};
