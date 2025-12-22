import { memoize } from './dist/index.js';

const getA = memoize((state) => state.a);

let count = 0;
const state2 = new Proxy(
  { a: 11, b: 22 },
  {
    get(target, prop) {
      if (typeof prop === 'string' && prop === 'a') {
        console.log(`get(${prop})`);
        count += 1;
      }
      return Reflect.get(target, prop);
    },
  },
);

console.log('=== Call 1 ===');
console.log('Result:', getA(state2));
console.log('Count:', count);

console.log('\n=== Call 2 ===');
const savedCount = count;
console.log('Result:', getA(state2));
console.log('Count:', count);
console.log(
  'Count changed?',
  count !== savedCount,
  `(was ${savedCount}, now ${count})`,
);
