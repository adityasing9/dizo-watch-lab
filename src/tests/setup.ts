import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill window.scrollTo for JSDOM
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn();
}

// Polyfill text encoding if needed
if (typeof TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
