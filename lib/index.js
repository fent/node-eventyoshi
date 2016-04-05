var Stream       = require('stream').Stream;
var EventEmitter = require('events').EventEmitter;
var util         = require('util');


/**
 * @constructor
 * @extends {Stream}
 */
var EventYoshi = module.exports = function() {
  EventEmitter.call(this);
  this._events = {};
  this.children = [];
  this.__listeners = [];
  this.__wrappers = {};
  this.__lastEvent = null;
};

util.inherits(EventYoshi, Stream);


/**
 * Keep a copy of old EventEmitter functions
 * when the new functions are called publicly they will
 * be proxied to the emitters.
 */
var addListener = EventEmitter.prototype.addListener;
var emit = EventEmitter.prototype.emit;
var removeListener = EventEmitter.prototype.removeListener;
var removeAllListeners = EventEmitter.prototype.removeAllListeners;
var setMaxListeners = EventEmitter.prototype.setMaxListeners;


/**
 * Adds an event emitter to eventyoshi.
 *
 * @param {EventEmitter} ee
 * @return {EventYoshi}
 */
EventYoshi.prototype.add = function(ee) {
  if (this.children.indexOf(ee) === -1) {
    var self = this;

    // Iterate through list of already listened to events
    // and listen to them on the newly added emitter.
    Object.keys(self._events)
      .forEach(function(event) {
        var listener = self.__wrappers[event];
        if (listener) {
          ee.on(event, listener);
        }
      });

    // Listen for new listeners after adding all previous event listeners.
    var listen = function(event, listener) {

      // Do not emit `newChildListener` event if this listener
      // was added by eventyoshi.
      if (self.__wrappers[event] === listener) return;

      self.child = ee;
      emit.call(self, 'newChildListener', event, listener);
      self.child = null;
    };

    ee.on('newListener', listen);
    this.__listeners.push(listen);

    this.children.push(ee);
  }

  return this;
};


/**
 * Remove an event emitter from eventyoshi
 * remove all of the listeners that were added by eventyoshi.
 *
 * @param {EventEmitter} ee
 * @return {EventYoshi}
 */
EventYoshi.prototype.remove = function(ee) {
  var i;
  if ((i = this.children.indexOf(ee)) !== -1) {
    var self = this;
    Object.keys(self._events)
      .forEach(function(event) {
        var listener = self.__wrappers[event];
        if (listener) {
          ee.removeListener(event, listener);
        }
      });

    // Remove newListener listener from event emitter.
    ee.removeListener('newListener', this.__listeners[i]);
    this.__listeners.splice(i, 1);

    this.children.splice(i, 1);
  }

  return this;
};


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
EventYoshi.prototype.on = function(event, listener) {
  if (event === 'newListener' || event === 'newChildListener') {
    addListener.call(this, event, listener);
    return;
  }

  if (this.__wrappers[event] === undefined) {

    // Proxy events emitted from each emitter onto eventyoshi
    // with a wrapper function.
    var self = this;
    var wrapper = this.__wrappers[event] = function() {

      // Skip events emitted to yoshi.
      if (self.__lastEvent === event) return;

      self.child = this;
      emit.apply(self,
           [event].concat(Array.prototype.slice.call(arguments)));
      self.child = null;
    };

    this.children.forEach(function(ee) {
      ee.on(event, wrapper);
    });
  }

  this.child = this;
  addListener.call(this, event, listener);
  this.child = null;
};

/**
 * @alias EventYoshi.prototype.addListener
 */
EventYoshi.prototype.addListener = EventYoshi.prototype.on;


/**
 * @param {String} event
 * @param {Function} listener
 * @override
 */
EventYoshi.prototype.once = function(event, listener) {
  var self = this;
  var wrapper = function() {
    self.removeListener(event, wrapper);
    listener.apply(self, arguments);
  };

  wrapper.listener = listener;

  self.on(event, wrapper);
};


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
EventYoshi.prototype.removeListener = function(event, listener) {
  if (event === 'newListener' || event === 'newChildListener') {
    removeListener.call(this, event, listener);
    return;
  }

  removeListener.call(this, event, listener);

  // Check if wrapper needs to be removed
  // by checking if there are anymore listeners for this event.
  var wrapper = this.__wrappers[event];
  if (!EventEmitter.prototype.listeners.call(this, event).length &&
      wrapper !== undefined) {
    this.children.forEach(function(ee) {
      ee.removeListener(event, wrapper);
    });
    delete this.__wrappers[event];
  }
};


/**
 * @param {String} event Optional event.
 * If not given, removes all events in emitter.
 *
 * @override
 */
EventYoshi.prototype.removeAllListeners = function(event) {
  if (event != null) {
    if (event === 'newListener' || event === 'newChildListener') {
      removeAllListeners.call(this, event);
      return;
    }

    if (EventEmitter.prototype.listeners.call(this, event).length) {
      this.children.forEach(function(ee) {
        ee.removeAllListeners(event);
      });
      removeAllListeners.call(this, event);
    }

  } else {
    this.children.forEach(function(ee) {
      ee.removeAllListeners();
    });
    removeAllListeners.call(this);
  }
};


/**
 * Proxy the rest of EventEmitter's functions from eventyoshi
 * to all of the emitters added.
 * Note that addListener/on cannot simply be proxied due to
 * once and the `addListener` event
 *
 * @param {Number} n
 */
EventYoshi.prototype.setMaxListeners = function(n) {
  setMaxListeners.call(this, n);
  this.children.forEach(function(ee) {
    ee.setMaxListeners(n);
  });
};


/**
 * @param {String} event
 * @param {Object...} args
 */
EventYoshi.prototype.emit = function(event) {
  var args = arguments;
  emit.apply(this, args);
  if (event === 'newListener') return;

  this.__lastEvent = event;

  this.children.forEach(function(ee) {
    ee.emit.apply(ee, args);
  });

  this.__lastEvent = null;
};


/**
 * Proxy custom functions.
 *
 * @param {String...} funcs
 */
EventYoshi.prototype.proxy = function() {
  var self = this;

  Array.prototype.slice.call(arguments).forEach(function(fn) {
    self[fn] = function() {
      var args = arguments;
      var rs = [];

      self.children.forEach(function(ee) {
        if (typeof ee[fn] === 'function') {
          rs.push(ee[fn].apply(ee, args));
        }
      });

      return rs.length === 1 ? rs[0] : rs;
    };
  });
};
