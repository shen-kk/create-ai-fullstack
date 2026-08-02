import { describe, expect, it } from 'vitest';
import { permissionCatalog } from '../src/index.js';

describe('permissionCatalog', () => {
  it('uses unique stable permission codes', () => {
    const codes = permissionCatalog.map(({ code }) => code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(
      codes.every((code) => /^(menu\.[a-z][a-z0-9_]*|[a-z][a-z0-9_]*\.[a-z]+)$/.test(code)),
    ).toBe(true);
  });

  it('keeps every non-dashboard menu group backed by an action permission', () => {
    const actionGroups = new Set(
      permissionCatalog.filter(({ type }) => type === 'action').map(({ groupCode }) => groupCode),
    );
    const menuGroups = permissionCatalog
      .filter(({ type, groupCode }) => type === 'menu' && groupCode !== 'dashboard')
      .map(({ groupCode }) => groupCode);
    expect(menuGroups.every((groupCode) => actionGroups.has(groupCode))).toBe(true);
  });
});
