var EventEmitter = require('events').EventEmitter
  , util = require('util')
  ;


//
// Constructor
//
var yoshi = module.exports = function() {
  this.emitters = [];
  this.__listeners = [];
  this.__yoshi = [];

  // events listened to must be kept track of in order to
  // listen to them when an ee is added
  this.__events = {};
};

util.inherits(yoshi, EventEmitter);


//
// Adds an event emitter to eventyoshi
// iterate through list of already listened to events
// and listen to them on the newly added emitter
//
yoshi.prototype.add = function(ee) {
  var self = this;
  Object.keys(self.__events).forEach(function(event) {
    var ev = self.__events[event];

    for(var i = 0, l = ev.listeners.length; i < l; i++) {
      ee.on(event, ev.wrappers[i]);
      ee.on(event, ev.listeners[i]);
    }
  });

  // listen for new listeners after adding all previous event listeners
  var listen = function(event, listener) {

    // do not emit `newEmitterListener` event if this listener
    // was added by eventyoshi
    var i;
    if ((i = self.__yoshi.indexOf(listener)) !== -1) {
      self.__yoshi.splice(i, 1);
      return;
    }

    self._emit('newEmitterListener', ee, event, listener);
  };
  ee.on('newListener', listen);
  this.__listeners.push(listen);

  this.emitters.push(ee);
  return this;
};


//
// Remove an event emitter from eventyoshi
// remove all of the listeners that were added by eventyoshi
//
yoshi.prototype.remove = function(ee) {
  var i;
  if ((i = this.emitters.indexOf(ee)) !== -1) {
    var self = this;
    Object.keys(self.__events).forEach(function(event) {
      var ev = self.__events[event];

      for(var i = 0, l = ev.listeners.length; i < l; i++) {
        ee.removeListener(event, ev.wrappers[i]);
        self._removeListener(event, ev.listeners[i]);
      }
    });

    // remove newListener listener from event emitter
    ee.removeListener('newListener', this.__listeners[i]);
    this.__listeners.splice(i, 1);

    this.emitters.splice(i, 1);
  }

  return this;
};


//
// Keep a copy of old EventEmitter functions
// when the new functions are called publicly they will
// be proxied to the emitters
//
['addListener', 'on', 'once', 'emit', 'removeListener',
 'removeAllListeners', 'setMaxListeners'].forEach(function(fn) {
  yoshi.prototype['_' + fn] = yoshi.prototype[fn];
});


//
// Adds listener to event emitters
//
// All event handling functions deal with
// the special `newListener` event
// in that case, it's treated only on eventyoshi
// and not the rest of the emitters
//
yoshi.prototype.on = function(event, listener) {
  if (event === 'newListener') {
    this._on(event, listener);
    return;
  }

  var ev;
  if ((ev = this.__events[event]) === undefined) {
    ev = this.__events[event] = { wrappers: [], listeners: [] };
  }

  // proxy events emitted from each emitter onto eventyoshi
  // with a wrapper function
  var self = this;
  var wrapper = function() {
    self._emit.apply(self,
         [event].concat(Array.prototype.slice.call(arguments)));
  };

  // mark these listeners as added by eventyoshi
  this.__yoshi.push(wrapper);
  this.__yoshi.push(listener);

  ev.wrappers.push(wrapper);
  ev.listeners.push(listener);

  this.emitters.forEach(function(ee) {
    ee.on(event, wrapper);
  });

  this._on(event, listener);
};
yoshi.prototype.addListener = yoshi.prototype.on;


yoshi.prototype.once = function(event, listener) {
  var self = this;
  var wrapper = function() {
    self.removeListener(event, wrapper);
    listener.apply(self, arguments);
  };

  wrapper.listener = listener;

  self.on(event, wrapper);
};


//
// removeListener and removeAllListeners must iterate through
// the list of previously added listeners,
// remove the wrapper from the emitters
// and remove the listener from eventyoshi
//
yoshi.prototype.removeListener = function(event, listener) {
  if (event === 'newListener') {
    this._removeListener(event, listener);
    return;
  }

  var ev, i;
  if ((ev = this.__events[event]) !== undefined) {
    for (var i = 0, l = ev.listeners.length; i < l; i++) {
      var l = ev.listeners[i];
      if (l === listener ||
         (typeof l.listener === 'function' && l.listener === listener)) {
        break;
      }
    }

    this.emitters.forEach(function(ee) {
      ee.removeListener(event, ev.wrappers[i]);
    });
    this._removeListener(event, ev.listeners[i]);

    ev.wrappers.splice(i, 1);
    ev.listeners.splice(i, 1);
  }
};


yoshi.prototype.removeAllListeners = function(event) {
  if (event != null) {
    if (event === 'newListener') {
      this._removeAllListeners(event);
      return;
    }

    var ev;
    if ((ev = this.__events[event]) !== undefined) {
      this.emitters.forEach(function(ee) {
        ee.removeAllListeners(event);
      });
      this._removeAllListeners(event);

      delete this.__events[event];
    }

  } else {
    this.emitters.forEach(function(ee) {
      ee.removeAllListeners();
    });
    this._removeAllListeners();

    this.__events = {};
  }
};


//
// Proxy the rest of EventEmitter's functions from eventyoshi
// to all of the emitters added
// Note that addListener/on cannot simply be proxied due to
// once and the `addListener` event
//
['setMaxListeners', 'emit'].forEach(function(fn) {
  yoshi.prototype[fn] = function() {
    var args = arguments;
    this['_' + fn].apply(this, args);
    this.emitters.forEach(function(ee) {
      ee[fn].apply(ee, args);
    });
  };
});
