const EventEmitter = require('events').EventEmitter;


/**
 * @constructor
 * @extends {Stream}
 */
module.exports = class EventYoshi extends EventEmitter {
  constructor() {
    super();
    this.children = new Map();
    this.__wrappers = new Map();
    this.__lastEvent = null;
  }


  /**
   * Adds an event emitter to eventyoshi.
   *
   * @param {EventEmitter} ee
   * @return {EventYoshi}
   */
  add(ee) {
    if (!this.children.has(ee)) {
      // Iterate through list of already listened to events
      // and listen to them on the newly added emitter.
      for (let [event, eeMap] of this.__wrappers.entries()) {
        this._addChildEventListener(ee, event, eeMap);
      }

      // Listen for new listeners after adding all previous event listeners.
      const listen = (event, listener) => {

        // Do not emit `newChildListener` event if this listener
        // was added by eventyoshi.
        const eeMap = this.__wrappers.get(event);
        if (eeMap && eeMap.has(listener.child)) return;

        this.child = ee;
        super.emit('newChildListener', event, listener);
        this.child = null;
      };

      ee.on('newListener', listen);
      this.children.set(ee, listen);
    }

    return this;
  }


  /**
   * Remove an event emitter from eventyoshi.
   *
   * @param {EventEmitter} ee
   * @return {EventYoshi}
   */
  remove(ee) {
    if (this.children.has(ee)) {
      for (let [event, eeMap] of this.__wrappers.entries()) {
        ee.removeListener(event, eeMap.get(ee));
        eeMap.delete(ee);
      }

      // Remove newListener listener from event emitter.
      ee.removeListener('newListener', this.children.get(ee));
      this.children.delete(ee);
    }

    return this;
  }

  /**
   * @param {EventListener} child
   * @param {string} event
   * @param {Map} eeMap
   */
  _addChildEventListener(child, event, eeMap) {
    const wrapper = (...args) => {
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

  /**
   * @param {string} event
   * @param {Function} listener
   * @param {boolean} append
   */
  _addListener(event, listener, append) {
    const addListener = append ? super.addListener : super.prependListener;
    if (event === 'newListener' || event === 'newChildListener') {
      addListener.call(this, event, listener);
      return;
    }

    if (!this.__wrappers.has(event)) {

      // Proxy events emitted from each emitter onto eventyoshi
      // with a wrapper function.
      const eeMap = new Map();
      this.__wrappers.set(event, eeMap);

      this.children.forEach((listener, ee) => {
        this._addChildEventListener(ee, event, eeMap);
      });
    }

    this.child = this;
    addListener.call(this, event, listener);
    this.child = null;
  }


  /**
   * Adds listener to event emitters.
   *
   * All event handling functions deal with
   * the special `newListener` event
   * in that case, it's treated only on eventyoshi
   * and not the rest of the emitters
   *
   * @param {string} event
   * @param {Function} listener
   * @override
   */
  on(event, listener) {
    this._addListener(event, listener, true);
  }

  /**
   * @alias EventYoshi.prototype.addListener
   */
  addListener(event, listener) {
    this._addListener(event, listener, true);
  }

  /**
   * Adds a listener at the start of the list of listeners.
   *
   * @param {string} event
   * @param {Function} listener
   * @override
   */
  prependListener(event, listener) {
    this._addListener(event, listener, false);
  }

  /**
   * Adds a listener at the start of the list of listeners.
   *
   * @param {string} event
   * @param {Function} listener
   * @override
   */
  prependOnceListener(event, listener) {
    const wrapper = (...args) => {
      this.removeListener(event, wrapper);
      listener(...args);
    };
    wrapper.listener = listener;
    this._addListener(event, wrapper, false);
  }

  /**
   * @param {string} event
   * @param {Function} listener
   * @override
   */
  once(event, listener) {
    const wrapper = (...args) => {
      this.removeListener(event, wrapper);
      listener(...args);
    };
    wrapper.listener = listener;
    this._addListener(event, wrapper, true);
  }


  /**
   * `removeListener` and `removeAllListeners` must iterate through
   * the list of previously added listeners,
   * remove the wrapper from the emitters
   * and remove the listener from eventyoshi.
   *
   * @param {string} event
   * @param {Function} listener
   * @override
   */
  removeListener(event, listener) {
    super.removeListener(event, listener);
    if (event === 'newListener' || event === 'newChildListener') return;

    // Check if wrapper needs to be removed
    // by checking if there are anymore listeners for this event.
    const eeMap = this.__wrappers.get(event);
    if (!this.listenerCount(event) && eeMap) {
      this.children.forEach((listener, ee) => {
        ee.removeListener(event, eeMap.get(ee));
      });
      this.__wrappers.delete(event);
    }
  }

  /**
   * @alias EventYoshi.prototype.removeListener
   */
  off(event, listener) {
    this.removeListener(event, listener);
  }


  /**
   * @param {string} event Optional event.
   * If not given, removes all events in emitter.
   *
   * @override
   */
  removeAllListeners(event) {
    super.removeAllListeners(event);
    if (event != null) {
      if (event === 'newListener' || event === 'newChildListener') return;
      const eeMap = this.__wrappers.get(event);
      if (eeMap) {
        for (let [child, wrapper] of eeMap.entries()) {
          child.removeListener(event, wrapper);
        }
        this.__wrappers.delete(event);
      }
    } else {
      for (let [event, eeMap] of this.__wrappers.entries()) {
        for (let [child, wrapper] of eeMap.entries()) {
          child.removeListener(event, wrapper);
        }
      }
      this.__wrappers.clear();
    }
  }


  /**
   * Proxy the rest of EventEmitter's functions from eventyoshi
   * to all of the emitters added.
   *
   * @param {number} n
   */
  setMaxListeners(n) {
    super.setMaxListeners(n);
    this.children.forEach((listener, ee) => {
      ee.setMaxListeners(n);
    });
  }


  /**
   * @param {string} event
   * @param {...Object} args
   */
  emit(event, ...args) {
    super.emit(event, ...args);
    if (event === 'newListener') return;

    this.__lastEvent = event;

    this.children.forEach((listener, ee) => {
      ee.emit(event, ...args);
    });

    this.__lastEvent = null;
  }


  /**
   * Proxy custom functions.
   *
   * @param {...string} funcs
   */
  proxy(...funcs) {
    funcs.forEach((fn) => {
      this[fn] = (...args) => {
        const rs = [];

        this.children.forEach((listener, ee) => {
          if (typeof ee[fn] === 'function') {
            rs.push(ee[fn](...args));
          }
        });

        return rs.length === 1 ? rs[0] : rs;
      };
    });
  }
};
