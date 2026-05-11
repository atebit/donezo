/**
 * throttle(fn, wait) — invokes fn at most once per `wait` ms.
 * Leading edge fires immediately; trailing edge fires the last call if any
 * occurred during the throttle window. Returns a function with a `.cancel()`
 * method to clear any pending trailing call.
 */
export function throttle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  wait: number,
): ((...args: TArgs) => void) & { cancel: () => void } {
  let lastCallTime: number | null = null;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: TArgs | null = null;

  function cancel(): void {
    if (trailingTimer !== null) {
      clearTimeout(trailingTimer);
      trailingTimer = null;
    }
    lastArgs = null;
  }

  function throttled(...args: TArgs): void {
    const now = Date.now();

    if (lastCallTime === null || now - lastCallTime >= wait) {
      // Leading edge: fire immediately
      lastCallTime = now;
      // Cancel any pending trailing call since we're firing now
      if (trailingTimer !== null) {
        clearTimeout(trailingTimer);
        trailingTimer = null;
      }
      fn(...args);
      lastArgs = null;
    } else {
      // Within the throttle window: schedule a trailing call
      lastArgs = args;
      if (trailingTimer === null) {
        const remaining = wait - (now - lastCallTime);
        trailingTimer = setTimeout(() => {
          trailingTimer = null;
          lastCallTime = Date.now();
          if (lastArgs !== null) {
            const argsToCall = lastArgs;
            lastArgs = null;
            fn(...argsToCall);
          }
        }, remaining);
      }
    }
  }

  throttled.cancel = cancel;

  return throttled;
}
