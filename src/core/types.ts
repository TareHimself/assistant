export type BoundEventCallback = (...args: any[]) => (void | Promise<void>)

export interface BoundEventTarget {
  on: (event: string, callback: BoundEventCallback) => (any | Promise<any>);
  off: (event: string, callback: BoundEventCallback) => (any | Promise<any>);
}

export type BoundEvent<T extends BoundEventTarget = any> = {
  target: T;
  event: string;
  callback: BoundEventCallback
}

export type Awaitable<T> = T | Promise<T>





