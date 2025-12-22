import { createProxy, isChanged, getUntracked, trackMemo, markToTrack } from 'proxy-compare';


// This is required only for performance.
// https://github.com/dai-shi/proxy-memoize/issues/68
const targetCache = new WeakMap();


// constants from proxy-compare

const HAS_KEY_PROPERTY = 'h';
const ALL_OWN_KEYS_PROPERTY = 'w';
const HAS_OWN_KEY_PROPERTY = 'o';
const KEYS_PROPERTY = 'k';

type HasKeySet = Set<string | symbol>;
type HasOwnKeySet = Set<string | symbol>;
type KeysSet = Set<string | symbol>;
type Used = {
    [HAS_KEY_PROPERTY]?: HasKeySet;
    [ALL_OWN_KEYS_PROPERTY]?: true;
    [HAS_OWN_KEY_PROPERTY]?: HasOwnKeySet;
    [KEYS_PROPERTY]?: KeysSet;
};
type Affected = WeakMap<object, Used>;

const trackMemoUntrackedObjSet = new WeakSet<object>();

const isObject = (x: unknown): x is object =>
    typeof x === 'object' && x !== null;

const untrack = <T>(x: T, seen: WeakSet<object>): T => {
    if (!isObject(x)) return x;
    const untrackedObj = getUntracked(x);
    if (untrackedObj) {
        trackMemo(x);
        trackMemoUntrackedObjSet.add(untrackedObj);
        return untrackedObj;
    }
    if (!seen.has(x)) {
        seen.add(x);
        // Include all properties, even non-enumerable ones and symbols
        Reflect.ownKeys(x).forEach((key) => {
            const desc = Object.getOwnPropertyDescriptor(x, key);
            // Skip getters to avoid side effects
            if (desc && !desc.get) {
                const v = (x as any)[key];
                const vv = untrack(v, seen);
                if (!Object.is(vv, v)) {
                    (x as any)[key] = vv;
                }
            }
        });
    }
    return x;
};

const touchAffected = (dst: unknown, src: unknown, affected: Affected) => {
    if (!isObject(dst) || !isObject(src)) return;
    const untrackedObj = getUntracked(src);
    const used = affected.get(untrackedObj || src);
    if (!used) {
        if (trackMemoUntrackedObjSet.has(untrackedObj as never)) {
            trackMemo(dst);
        }
        return;
    }
    used[HAS_KEY_PROPERTY]?.forEach((key) => {
        Reflect.has(dst, key);
    });
    if (used[ALL_OWN_KEYS_PROPERTY] === true) {
        Reflect.ownKeys(dst);
    }
    used[HAS_OWN_KEY_PROPERTY]?.forEach((key) => {
        Reflect.getOwnPropertyDescriptor(dst, key);
    });
    used[KEYS_PROPERTY]?.forEach((key) => {
        touchAffected(
            dst[key as keyof typeof dst],
            src[key as keyof typeof src],
            affected,
        );
    });
};

type Snapshot = Map<string | symbol, unknown | Map<string | symbol, unknown>>;

const captureSnapshot = (obj: unknown, affected: Affected): Snapshot | null => {
    if (!isObject(obj)) return null;

    const untrackedObj = getUntracked(obj);
    const used = affected.get(untrackedObj || obj);
    if (!used) {
        return null;
    }

    const snapshot = new Map<string | symbol, unknown>();
    const keysToCapture = new Set<string | symbol>();

    used[KEYS_PROPERTY]?.forEach((key) => keysToCapture.add(key));
    used[HAS_KEY_PROPERTY]?.forEach((key) => keysToCapture.add(key));
    used[HAS_OWN_KEY_PROPERTY]?.forEach((key) => keysToCapture.add(key));

    for (const key of keysToCapture) {
        const val = (obj as any)[key];
        snapshot.set(key, val);

        if (isObject(val)) {
            const nestedUsed = affected.get(val);
            if (nestedUsed) {
                const nestedKeysToCapture = new Set<string | symbol>();
                nestedUsed[KEYS_PROPERTY]?.forEach((k) => nestedKeysToCapture.add(k));
                nestedUsed[HAS_KEY_PROPERTY]?.forEach((k) => nestedKeysToCapture.add(k));
                nestedUsed[HAS_OWN_KEY_PROPERTY]?.forEach((k) => nestedKeysToCapture.add(k));

                if (nestedKeysToCapture.size > 0) {
                    const nestedSnapshot = new Map<string | symbol, unknown>();
                    for (const nestedKey of nestedKeysToCapture) {
                        nestedSnapshot.set(nestedKey, (val as any)[nestedKey]);
                    }
                    // Store nested object's state for change detection
                    (snapshot as any).set(`__nested_${String(key)}__`, nestedSnapshot);
                }
            }
        }
    }

    return snapshot.size > 0 ? snapshot : null;
};

const checkSnapshotChange = (snapshot: Snapshot | null, obj: unknown, affected: Affected): boolean => {
    if (!snapshot || !isObject(obj)) {
        return false;
    }

    const untrackedObj = getUntracked(obj);
    const used = affected.get(untrackedObj || obj);
    if (!used) {
        return false;
    }

    // Check if any captured properties have changed
    for (const [key, snapshotVal] of snapshot) {
        // Skip our internal snapshot markers
        if (typeof key === 'string' && key.startsWith('__nested_')) {
            continue;
        }

        // Handle nested objects by checking their stored snapshots
        if (isObject(snapshotVal)) {
            const nestedSnapshotKey = `__nested_${String(key)}__`;
            const nestedSnapshot = snapshot.get(nestedSnapshotKey) as Map<string | symbol, unknown> | undefined;
            if (nestedSnapshot) {
                // Compare each nested property with its snapshot
                const currentVal = (obj as any)[key];
                if (isObject(currentVal)) {
                    for (const [nestedKey, nestedSnapshotVal] of nestedSnapshot) {
                        const nestedCurrentVal = (currentVal as any)[nestedKey];
                        if (!Object.is(nestedSnapshotVal, nestedCurrentVal)) {
                            // console.log(`checkSnapshotChange: FOUND CHANGE in nested ${String(key)}.${String(nestedKey)}`);
                            return true;
                        }
                    }
                }
            }
            // Move to next property since we've handled this nested object
            continue;
        }

        // Compare current value with snapshot
        const currentVal = (obj as any)[key];
        if (!Object.is(snapshotVal, currentVal)) {
            return true; // Value has changed
        }
    }

    return false; // No changes found in any tracked property
};

const isOriginalEqual = (x: unknown, y: unknown): boolean => {
    for (let xx = x; xx; x = xx, xx = getUntracked(xx));
    for (let yy = y; yy; y = yy, yy = getUntracked(yy));
    return Object.is(x, y);
};

// Always perform deep comparison to detect changes in object properties
const alwaysDeepCompare = (): boolean => false;

// Internal property keys for memoization state
const OBJ_PROPERTY = 'o';
const RESULT_PROPERTY = 'r';
const AFFECTED_PROPERTY = 'a';
const SNAPSHOT_PROPERTY = 's';
const CACHE_SNAPSHOT_PROPERTY = 'cs';

/**
 * Create a memoized function
 *
 * @example
 * import { memoize } from 'proxy-memoize';
 *
 * const fn = memoize(obj => ({ sum: obj.a + obj.b, diff: obj.a - obj.b }));
 *
 * @param options
 * @param options.size - (default: 1)
 * @param options.noWeakMap - disable tier-1 cache (default: false)
 */
export function memoize<Obj extends object, Result>(
    fn: (obj: Obj) => Result,
    options?: { size?: number; noWeakMap?: boolean },
): (obj: Obj) => Result {
    let memoListHead = 0;
    const size = options?.size ?? 1;
    type Entry = {
        [OBJ_PROPERTY]: Obj;
        [RESULT_PROPERTY]: Result;
        [AFFECTED_PROPERTY]: Affected;
        [SNAPSHOT_PROPERTY]?: Snapshot | null;
    };
    const memoList: Entry[] = [];
    const resultCache = options?.noWeakMap ? null : new WeakMap<Obj, { result: Result; snapshot: Snapshot | null; affected: Affected }>();
    const memoizedFn = (obj: Obj) => {
        // Ensure the object is properly tracked by proxy-compare
        markToTrack(obj, true);

        const cacheEntry = resultCache?.get(obj);
        if (cacheEntry) {
            // Return cached result if the object hasn't changed
            if (!checkSnapshotChange(cacheEntry.snapshot, obj, cacheEntry.affected)) {
                return cacheEntry.result;
            }
            // If we get here, the object has changed
        }
        for (let i = 0; i < size; i += 1) {
            const memo = memoList[(memoListHead + i) % size];
            if (!memo) break;
            const {
                [OBJ_PROPERTY]: memoObj,
                [AFFECTED_PROPERTY]: memoAffected,
                [RESULT_PROPERTY]: memoResult,
                [SNAPSHOT_PROPERTY]: memoSnapshot,
            } = memo;

            const isChangedResult = isChanged(memoObj, obj, memoAffected, new WeakMap(), alwaysDeepCompare);
            if (!isChangedResult) {
                // Object is the same as cached version
                touchAffected(obj, memoObj, memoAffected);
                resultCache?.set(obj, { result: memoResult, snapshot: memoSnapshot || null, affected: memoAffected });
                return memoResult;
            }
        }
        const affected: Affected = new WeakMap();
        const proxy = createProxy(obj, affected, undefined, targetCache);
        const result = untrack(fn(proxy), new WeakSet());
        touchAffected(obj, obj, affected);
        const snapshot = captureSnapshot(obj, affected);
        const entry: Entry = {
            [OBJ_PROPERTY]: obj,
            [RESULT_PROPERTY]: result,
            [AFFECTED_PROPERTY]: affected,
            [SNAPSHOT_PROPERTY]: snapshot,
        };
        memoListHead = (memoListHead - 1 + size) % size;
        memoList[memoListHead] = entry;
        resultCache?.set(obj, { result, snapshot, affected });
        return result;
    };
    return memoizedFn;
}
