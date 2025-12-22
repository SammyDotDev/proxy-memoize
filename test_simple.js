import { memoize } from './dist/index.js';

const obj = {};
Object.defineProperty(obj, 'hidden', {
  value: 42,
  enumerable: false,
  configurable: true,
  writable: true,
});

const fn = memoize((o) => {
  console.log('Function called with o.hidden =', o.hidden);
  return o.hidden;
});

console.log('\n=== First call ===');
const result1 = fn(obj);
console.log('Result:', result1);

console.log('\n=== Change obj.hidden to 100 ===');
obj.hidden = 100;
console.log('After change, obj.hidden =', obj.hidden);

console.log('\n=== Second call ===');
const result2 = fn(obj);
console.log('Result:', result2);
console.log('Expected: 100, Got:', result2);
