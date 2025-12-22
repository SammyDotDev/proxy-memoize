import { createProxy, isChanged, markToTrack } from 'proxy-compare';

const obj = {};
Object.defineProperty(obj, 'hidden', {
  value: 42,
  enumerable: false,
  configurable: true,
  writable: true,
});

// Mark as trackable
markToTrack(obj, true);

const affected = new WeakMap();
const proxy = createProxy(obj, affected);

console.log('=== First access ===');
const val1 = proxy.hidden;
console.log('proxy.hidden:', val1);
console.log('affected.get(obj):', affected.get(obj));

// Change the property
obj.hidden = 100;
console.log('\nChanged obj.hidden to 100');

// Check if isChanged detects it
const changed = isChanged(obj, obj, affected);
console.log('isChanged(obj, obj, affected):', changed);

// Try with a different object
const obj2 = {};
Object.defineProperty(obj2, 'hidden', {
  value: 100,
  enumerable: false,
  configurable: true,
  writable: true,
});

const changed2 = isChanged(obj, obj2, affected);
console.log('isChanged(obj with 42, obj2 with 100, affected):', changed2);
