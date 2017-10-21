'use strict';

const EventEmitter = require('events').EventEmitter;


/**
 * @constructor
 * @extends {Stream}
 */
module.exports = class EventYoshi extends EventEmitter {
  constructor() {
    super();
    this.children = new Map();
    this.__wrappers = {};
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
      Object.keys(this.__wrappers).forEach((event) => {
        ee.on(event, this.__wrappers[event]);
      });

      // Listen for new listeners after adding all previous event listeners.
      var listen = (event, listener) => {

        // Do not emit `newChildListener` event if this listener
        // was added by eventyoshi.
        if (this.__wrappers[event] === listener) return;

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
   * Remove an event emitter from eventyoshi
   * remove all of the listeners that were added by eventyoshi.
   *
   * @param {EventEmitter} ee
   * @return {EventYoshi}
   */
  remove(ee) {
    if (this.children.has(ee)) {
      Object.keys(this.__wrappers).forEach((event) => {
        ee.removeListener(event, this.__wrappers[event]);
      });

      // Remove newListener listener from event emitter.
      ee.removeListener('newListener', this.children.get(ee));
      this.children.delete(ee);
    }

    return this;
  }


  /**
   * Adds listener to event emitters
   *
   * All event handling functions deal with
   * the special `newListener` event
   * in that case, it's treated only on eventyoshi
   * and not the rest of the emitters
   *
   * @param {String} event
   * @param {Function} listener
   * @override
   */
  on(event, listener) {
    if (event === 'newListener' || event === 'newChildListener') {
      super.addListener(event, listener);
      return;
    }

    if (!this.__wrappers[event]) {

      // Proxy events emitted from each emitter onto eventyoshi
      // with a wrapper function.
      var self = this;
      var emit = super.emit;
      var wrapper = this.__wrappers[event] = function() {

        // Skip events emitted to yoshi.
        if (self.__lastEvent === event) return;

        self.child = this;
        emit.apply(self,
          [event].concat(Array.prototype.slice.call(arguments)));
        self.child = null;
      };

      this.children.forEach((listener, ee) => {
        ee.on(event, wrapper);
      });
    }

    this.child = this;
    super.addListener(event, listener);
    this.child = null;
  }

  /**
   * @alias EventYoshi.prototype.addListener
   */
  addListener(event, listener) {
    this.on(event, listener);
  }


  /**
   * @param {String} event
   * @param {Function} listener
   * @override
   */
  once(event, listener) {
    var self = this;
    var wrapper = function() {
      self.removeListener(event, wrapper);
      listener.apply(self, arguments);
    };

    wrapper.listener = listener;

    self.on(event, wrapper);
  }


  /**
   * `removeListener` and `removeAllListeners` must iterate through
   * the list of previously added listeners,
   * remove the wrapper from the emitters
   * and remove the listener from eventyoshi.
   *
   * @param {String} event
   * @param {Function} listener
   * @override
   */
  removeListener(event, listener) {
    if (event === 'newListener' || event === 'newChildListener') {
      super.removeListener(event, listener);
      return;
    }

    super.removeListener(event, listener);

    // Check if wrapper needs to be removed
    // by checking if there are anymore listeners for this event.
    var wrapper = this.__wrappers[event];
    if (!super.listeners(event).length && wrapper) {
      this.children.forEach((listener, ee) => {
        ee.removeListener(event, wrapper);
      });
      delete this.__wrappers[event];
    }
  }


  /**
   * @param {String} event Optional event.
   * If not given, removes all events in emitter.
   *
   * @override
   */
  removeAllListeners(event) {
    if (event != null) {
      if (event === 'newListener' || event === 'newChildListener') {
        super.removeAllListeners(event);
        return;
      }

      if (EventEmitter.prototype.listeners.call(this, event).length) {
        this.children.forEach((listener, ee) => {
          ee.removeAllListeners(event);
        });
        super.removeAllListeners(event);
      }

    } else {
      this.children.forEach((listener, ee) => {
        ee.removeAllListeners();
      });
      super.removeAllListeners();
    }
  }


  /**
   * Proxy the rest of EventEmitter's functions from eventyoshi
   * to all of the emitters added.
   * Note that addListener/on cannot simply be proxied due to
   * once and the `addListener` event
   *
   * @param {Number} n
   */
  setMaxListeners(n) {
    super.setMaxListeners(n);
    this.children.forEach((listener, ee) => {
      ee.setMaxListeners(n);
    });
  }


  /**
   * @param {String} event
   * @param {Object...} args
   */
  emit(event) {
    var args = arguments;
    super.emit.apply(this, args);
    if (event === 'newListener') return;

    this.__lastEvent = event;

    this.children.forEach((listener, ee) => {
      ee.emit.apply(ee, args);
    });

    this.__lastEvent = null;
  }


  /**
   * Proxy custom functions.
   *
   * @param {String...} funcs
   */
  proxy() {
    var self = this;

    Array.prototype.slice.call(arguments).forEach((fn) => {
      self[fn] = function() {
        var args = arguments;
        var rs = [];

        self.children.forEach((listener, ee) => {
          if (typeof ee[fn] === 'function') {
            rs.push(ee[fn].apply(ee, args));
          }
        });

        return rs.length === 1 ? rs[0] : rs;
      };
    });
  }
};
