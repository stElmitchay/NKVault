// Password generator — class inclusion, length, distribution.

import { describe, it, expect } from 'vitest';
import { generatePassword, getPasswordStrength, DEFAULT_OPTIONS } from './password';

describe('generatePassword', () => {
  it('honors the requested length for default options', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generatePassword(DEFAULT_OPTIONS);
      expect(pw.length).toBe(DEFAULT_OPTIONS.length);
    }
  });

  it('includes at least one character from each enabled class', () => {
    for (let i = 0; i < 100; i++) {
      const pw = generatePassword({
        length: 16,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      });
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[^A-Za-z0-9]/);
    }
  });

  it('produces unique passwords across calls', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(generatePassword(DEFAULT_OPTIONS));
    }
    // 200 length-20 passwords from a 90-ish-char alphabet — collisions
    // would imply broken RNG.
    expect(seen.size).toBe(200);
  });

  it('falls back to lowercase when no class is enabled', () => {
    const pw = generatePassword({
      length: 12,
      uppercase: false,
      lowercase: false,
      numbers: false,
      symbols: false,
    });
    expect(pw.length).toBe(12);
    expect(pw).toMatch(/^[a-z]+$/);
  });

  it('does not exhibit obvious modulo bias on a small alphabet', () => {
    // Generate many 1-char passwords from a 26-char alphabet and verify
    // the empirical frequency of each character is within a generous
    // tolerance of uniform. Rejection sampling guarantees true uniformity;
    // a buggy `array[0] % 26` would skew the first 16 chars by ~6%.
    const counts = new Map<string, number>();
    const N = 26 * 400; // 400 expected per char
    for (let i = 0; i < N; i++) {
      const c = generatePassword({
        length: 1,
        uppercase: false,
        lowercase: true,
        numbers: false,
        symbols: false,
      });
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    expect(counts.size).toBe(26);
    const expected = N / 26;
    for (const [, n] of counts) {
      // ±25% tolerance — generous, but a biased generator skews much harder.
      expect(n).toBeGreaterThan(expected * 0.75);
      expect(n).toBeLessThan(expected * 1.25);
    }
  });
});

describe('getPasswordStrength', () => {
  it('rates very short passwords as weak', () => {
    expect(getPasswordStrength('abc').label).toBe('Weak');
  });

  it('rates a long mixed password as strong', () => {
    expect(getPasswordStrength('Aa1!Aa1!Aa1!Aa1!Aa1!').label).toBe('Strong');
  });
});
