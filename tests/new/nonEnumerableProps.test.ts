import { describe, expect, it } from 'vitest';
import { memoize } from 'proxy-memoize';
describe('memoize with non-enumerable properties', () => {
  it('should track changes to non-enumerable properties', () => {
    const obj: any = {};
    Object.defineProperty(obj, 'hidden', {
      value: 42,
      enumerable: false,
      configurable: true,
      writable: true,
    });

    const fn = memoize((o: any) => o.hidden);
    expect(fn(obj)).toBe(42);

    obj.hidden = 100;
    expect(fn(obj)).toBe(100);
  });

  it('should track symbol-keyed properties', () => {
    const sym = Symbol('test');
    const obj: any = { [sym]: 42 };

    const fn = memoize((o: any) => o[sym]);
    expect(fn(obj)).toBe(42);

    obj[sym] = 100;
    expect(fn(obj)).toBe(100);
  });

  it('should handle prototype chain properties', () => {
    const parent = { value: 42 };
    const child = Object.create(parent);

    const fn = memoize((o: any) => o.value);
    expect(fn(child)).toBe(42);

    parent.value = 100;
    expect(fn(child)).toBe(100);
  });

  it('should handle non-enumerable properties in nested objects', () => {
    const obj: any = { nested: {} };
    Object.defineProperty(obj.nested, 'hidden', {
      value: 42,
      enumerable: false,
      writable: true,
    });

    const fn = memoize((o: any) => o.nested.hidden);
    expect(fn(obj)).toBe(42);

    obj.nested.hidden = 100;
    expect(fn(obj)).toBe(100);
  });

  it('should handle arrays with non-enumerable properties', () => {
    const arr: any = [1, 2, 3];
    Object.defineProperty(arr, 'sum', {
      value: 6,
      enumerable: false,
      writable: true,
    });

    const fn = memoize((a: any) => a.sum);
    expect(fn(arr)).toBe(6);

    arr.sum = 10;
    expect(fn(arr)).toBe(10);
  });

  it('should handle frozen objects', () => {
    const obj: any = {};
    Object.defineProperty(obj, 'hidden', {
      value: 42,
      enumerable: false,
    });
    Object.freeze(obj);

    const fn = memoize((o: any) => o.hidden);
    expect(fn(obj)).toBe(42);
  });

  it('should handle sealed objects', () => {
    const obj: any = {};
    Object.defineProperty(obj, 'hidden', {
      value: 42,
      enumerable: false,
      writable: true,
    });
    Object.seal(obj);

    const fn = memoize((o: any) => o.hidden);
    expect(fn(obj)).toBe(42);

    obj.hidden = 100;
    expect(fn(obj)).toBe(100);
  });
});
