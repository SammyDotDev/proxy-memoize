import { memoize } from './dist/index.js';

const obj = {};
Object.defineProperty(obj, 'hidden', {
  value: 42,
  enumerable: false,
  configurable: true,
  writable: true,
});

const fn = memoize((o) => {
  console.log('fn called, o.hidden=', o.hidden);
  return o.hidden;
});

console.log('=== First call ===');
const result1 = fn(obj);
console.log('Result:', result1);

console.log('\n=== Change hidden to 100 ===');
obj.hidden = 100;
console.log('obj.hidden is now:', obj.hidden);

console.log('\n=== Second call ===');
const result2 = fn(obj);
console.log('Result:', result2);

console.log('\nExpected: 100, Got:', result2);
