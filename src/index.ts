import { EventEmitter } from 'node:events';

const SPECIAL_EVENTS = new Set([
  'newListener',
  'newChildListener',
  'removeListener',
  'removeChildListener',
]);

namespace EventYoshi {
  export interface ChildListenerMap {
    newListener: (
      event: string | symbol,
      childListener: ChildEventListener,
    ) => void;
    removeListener: (
      event: string | symbol,
      childListener: ChildEventListener,
    ) => void;
  }

  export type EventListener = Parameters<EventEmitter['on']>[1];

  export interface ChildEventListener extends EventListener {
    child?: EventEmitter;
    listener?: EventListener;
  }

  export type DynamicEmitter = EventEmitter & Record<string, unknown>;
}

class EventYoshi extends EventEmitter {
  static EventYoshi = EventYoshi;
  static default = EventYoshi;

  public children: Map<EventEmitter, EventYoshi.ChildListenerMap>;
  private __wrappers: Map<
    string | symbol,
    Map<EventEmitter, EventYoshi.ChildEventListener>
  >;
  private __lastEvent: string | symbol | null;
  public child: EventEmitter | null;
  [key: string]: unknown;

  constructor() {
    super();
    this.children = new Map();
    this.__wrappers = new Map();
    this.__lastEvent = null;
    this.child = null;
  }

  /**
   * Adds an event emitter to eventyoshi.
   */
  add(ee: EventEmitter): this {
    if (!this.children.has(ee)) {
      // Iterate through list of already listened to events
      // and listen to them on the newly added emitter.
      for (const [event, eeMap] of this.__wrappers.entries()) {
        this._addChildEventListener(ee, event, eeMap);
      }

      // Listen for new listeners after adding all previous event listeners.
      const listener = (
        eventName: string,
        event: string | symbol,
        childListener: EventYoshi.ChildEventListener,
      ) => {
        // Do not emit `newChildListener` event if this listener
        // was added by eventyoshi.
        const eeMap = this.__wrappers.get(event);
        if (eeMap?.has(childListener.child as EventEmitter)) return;

        this.child = ee;
        super.emit(eventName, event, childListener);
        this.child = null;
      };

      const newListener = listener.bind(this, 'newChildListener');
      const removeListener = listener.bind(this, 'removeChildListener');
      ee.on('newListener', newListener);
      ee.on('removeListener', removeListener);
      this.children.set(ee, { newListener, removeListener });
    }

    return this;
  }

  /**
   * Remove an event emitter from eventyoshi.
   */
  remove(ee: EventEmitter): this {
    const childListeners = this.children.get(ee);
    if (!childListeners) return this;

    for (const [event, eeMap] of this.__wrappers.entries()) {
      const wrapper = eeMap.get(ee);
      if (wrapper) {
        ee.removeListener(event, wrapper);
      }
      eeMap.delete(ee);
    }

    // Remove newListener listener from event emitter.
    ee.removeListener('newListener', childListeners.newListener);
    ee.removeListener('removeListener', childListeners.removeListener);
    this.children.delete(ee);

    return this;
  }

  private _addChildEventListener(
    child: EventEmitter,
    event: string | symbol,
    eeMap: Map<EventEmitter, EventYoshi.ChildEventListener>,
  ): void {
    const wrapper: EventYoshi.ChildEventListener = (...args: unknown[]) => {
      // Skip events emitted to yoshi.
      if (this.__lastEvent === event) return;
      this.child = child;
      super.emit(event, ...args);
      this.child = null;
    };
    wrapper.child = child;
    eeMap.set(child, wrapper);
    child.on(event, wrapper);
  }

  private _addListener(
    event: string | symbol,
    listener: EventYoshi.EventListener,
    append: boolean,
  ): void {
    const addListener = append ? super.addListener : super.prependListener;
    if (typeof event === 'string' && SPECIAL_EVENTS.has(event)) {
      addListener.call(this, event, listener);
      return;
    }

    if (!this.__wrappers.has(event)) {
      // Proxy events emitted from each emitter onto eventyoshi
      // with a wrapper function.
      const eeMap = new Map<EventEmitter, EventYoshi.ChildEventListener>();
      this.__wrappers.set(event, eeMap);

      this.children.forEach((_listener, ee) => {
        this._addChildEventListener(ee, event, eeMap);
      });
    }

    this.child = this;
    addListener.call(this, event, listener);
    this.child = null;
  }

  /**
   * Adds listener to event emitters.
   */
  override on(
    event: string | symbol,
    listener: EventYoshi.EventListener,
  ): this {
    this._addListener(event, listener, true);
    return this;
  }

  /**
   * @alias EventYoshi.prototype.addListener
   */
  override addListener(
    event: string | symbol,
    listener: EventYoshi.EventListener,
  ): this {
    this._addListener(event, listener, true);
    return this;
  }

  /**
   * Adds a listener at the start of the list of listeners.
   */
  override prependListener(
    event: string | symbol,
    listener: EventYoshi.EventListener,
  ): this {
    this._addListener(event, listener, false);
    return this;
  }

  /**
   * Wraps a listener to remove itself after being invoked once.
   */
  private _wrapOnceListener(
    event: string | symbol,
    listener: EventYoshi.EventListener,
  ): EventYoshi.ChildEventListener {
    const wrapper: EventYoshi.ChildEventListener = (...args: unknown[]) => {
      this.removeListener(event, wrapper);
      (listener as (...args: unknown[]) => void)(...args);
    };
    wrapper.listener = listener;
    return wrapper;
  }

  /**
   * Adds a listener at the start of the list of listeners.
   */
  override prependOnceListener(
    event: string | symbol,
    listener: EventYoshi.EventListener,
  ): this {
    this._addListener(event, this._wrapOnceListener(event, listener), false);
    return this;
  }

  override once(
    event: string | symbol,
    listener: EventYoshi.EventListener,
  ): this {
    this._addListener(event, this._wrapOnceListener(event, listener), true);
    return this;
  }

  override removeListener(
    event: string | symbol,
    listener: EventYoshi.EventListener,
  ): this {
    this.child = this;
    super.removeListener(event, listener);
    this.child = null;

    if (typeof event === 'string' && SPECIAL_EVENTS.has(event)) return this;

    // Check if wrapper needs to be removed
    // by checking if there are anymore listeners for this event.
    const eeMap = this.__wrappers.get(event);
    if (!this.listenerCount(event) && eeMap) {
      this.children.forEach((_listener, ee) => {
        const wrapper = eeMap.get(ee);
        if (wrapper) {
          ee.removeListener(event, wrapper);
        }
      });
      this.__wrappers.delete(event);
    }
    return this;
  }

  /**
   * @alias EventYoshi.prototype.removeListener
   */
  override off(
    event: string | symbol,
    listener: EventYoshi.EventListener,
  ): this {
    return this.removeListener(event, listener);
  }

  /**
   * Removes all listeners, or those of the specified event.
   *
   * @param event Optional event. If not given, removes all events in emitter.
   */
  override removeAllListeners(event?: string | symbol): this {
    super.removeAllListeners(event);
    if (event != null) {
      if (typeof event === 'string' && SPECIAL_EVENTS.has(event)) return this;
      const eeMap = this.__wrappers.get(event);
      if (eeMap) {
        for (const [child, wrapper] of eeMap.entries()) {
          child.removeListener(event, wrapper);
        }
        this.__wrappers.delete(event);
      }
    } else {
      for (const [evt, eeMap] of this.__wrappers.entries()) {
        for (const [child, wrapper] of eeMap.entries()) {
          child.removeListener(evt, wrapper);
        }
      }
      this.__wrappers.clear();
    }
    return this;
  }

  /**
   * Proxy the rest of EventEmitter's functions from eventyoshi
   * to all of the emitters added.
   */
  override setMaxListeners(n: number): this {
    super.setMaxListeners(n);
    this.children.forEach((_listener, ee) => {
      ee.setMaxListeners(n);
    });
    return this;
  }

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    const result = super.emit(event, ...args);
    if (typeof event === 'string' && SPECIAL_EVENTS.has(event)) return result;

    this.__lastEvent = event;

    this.children.forEach((_listener, ee) => {
      ee.emit(event, ...args);
    });

    this.__lastEvent = null;
    return result;
  }

  /**
   * Proxy custom functions.
   */
  proxy(...funcs: string[]): void {
    funcs.forEach((fn) => {
      this[fn] = (...args: unknown[]) => {
        const results: unknown[] = [];

        this.children.forEach((_listener, ee) => {
          const method = (ee as EventYoshi.DynamicEmitter)[fn];
          if (typeof method === 'function') {
            results.push(method.apply(ee, args));
          }
        });

        return results.length === 1 ? results[0] : results;
      };
    });
  }
}

// Statically recognizable exports for Node.js cjs-module-lexer (ESM named import support)
module.exports = EventYoshi;
module.exports.default = EventYoshi;
module.exports.EventYoshi = EventYoshi;

export = EventYoshi;
