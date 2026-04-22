/**
 * Mock for fs/promises - Vitest compatible
 */
import { vi } from 'vitest';

export const readFile = vi.fn();
export const access = vi.fn();
export const readdir = vi.fn();

const fsMock = {
  readFile,
  access,
  readdir,
};

export default fsMock;
