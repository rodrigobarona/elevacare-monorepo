/**
 * Mock for remark-gfm - Vitest compatible
 */
import { vi } from 'vitest';

const remarkGfm = vi.fn(() => () => {});

export default remarkGfm;
