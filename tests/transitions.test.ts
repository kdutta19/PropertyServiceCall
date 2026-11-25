import {
  canRoleTransition,
  canTenantEdit,
  nextStatusOptions,
  TRANSITIONS,
  validateTransition,
} from '../src/domain/transitions';
import { STATUSES } from '../src/domain/types';

describe('status transitions', () => {
  it('allows only the defined lifecycle edges', () => {
    expect(TRANSITIONS.new).toEqual(['assigned']);
    expect(canRoleTransition('manager', 'new', 'completed')).toBe(false);
    expect(canRoleTransition('manager', 'new', 'in_progress')).toBe(false);
    expect(canRoleTransition('manager', 'waiting_on_tenant', 'completed')).toBe(false);
  });

  it('never lets tenants change status', () => {
    for (const from of STATUSES) for (const to of STATUSES) {
      expect(canRoleTransition('tenant', from, to)).toBe(false);
    }
  });

  it('lets technicians work the job but not assign, unassign or reopen', () => {
    expect(canRoleTransition('technician', 'assigned', 'in_progress')).toBe(true);
    expect(canRoleTransition('technician', 'in_progress', 'waiting_on_tenant')).toBe(true);
    expect(canRoleTransition('technician', 'waiting_on_tenant', 'in_progress')).toBe(true);
    expect(canRoleTransition('technician', 'in_progress', 'completed')).toBe(true);
    expect(canRoleTransition('technician', 'assigned', 'new')).toBe(false);
    expect(canRoleTransition('technician', 'new', 'assigned')).toBe(false);
    expect(canRoleTransition('technician', 'completed', 'in_progress')).toBe(false);
  });

  it('lets managers reopen a completed request', () => {
    expect(canRoleTransition('manager', 'completed', 'in_progress')).toBe(true);
  });

  it('requires a completion note and a tenant message', () => {
    const base = { role: 'technician', from: 'in_progress' } as const;
    expect(validateTransition({ ...base, to: 'completed', note: '' }).ok).toBe(false);
    expect(validateTransition({ ...base, to: 'completed', note: 'abc' }).ok).toBe(false);
    expect(validateTransition({ ...base, to: 'completed', note: 'Replaced the valve.' }).ok).toBe(true);
    expect(validateTransition({ ...base, to: 'waiting_on_tenant', note: '' }).ok).toBe(false);
    expect(validateTransition({ ...base, to: 'waiting_on_tenant', note: 'Need access Tuesday' }).ok).toBe(true);
  });

  it('exposes only change-status options (assign/unassign are separate actions)', () => {
    expect(nextStatusOptions('technician', 'assigned')).toEqual(['in_progress']);
    expect(nextStatusOptions('manager', 'assigned')).toEqual(['in_progress']);
    expect(nextStatusOptions('manager', 'new')).toEqual([]);
    expect(nextStatusOptions('tenant', 'in_progress')).toEqual([]);
  });

  it('lets tenants edit only unassigned new requests', () => {
    expect(canTenantEdit('new', null)).toBe(true);
    expect(canTenantEdit('assigned', 'u1')).toBe(false);
    expect(canTenantEdit('new', 'u1')).toBe(false);
  });
});
