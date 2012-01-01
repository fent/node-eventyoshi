var EventEmitter = require('events').EventEmitter
  , util = require('util')
  ;


//
// Constructor
//
var yoshi = module.exports = function() {
  this.children = [];
  this.__listeners = [];
  this.__yoshi = [];

  // events listened to must be kept track of in order to
  // listen to them when an ee is added
  this.__events = {};
};

util.inherits(yoshi, EventEmitter);


//
// Adds an event emitter to eventyoshi
//
yoshi.prototype.add = function(ee) {
  if (this.children.indexOf(ee) === -1) {
    var self = this;

    // iterate through list of already listened to events
    // and listen to them on the newly added emitter
    Object.keys(self.__events).forEach(function(event) {
      var ev = self.__events[event];

      for(var i = 0, l = ev.listeners.length; i < l; i++) {
        ee.on(event, ev.wrappers[i]);
      }
    });

    // listen for new listeners after adding all previous event listeners
    var listen = function(event, listener) {

      // do not emit `newChildListener` event if this listener
      // was added by eventyoshi
      var i;
      if ((i = self.__yoshi.indexOf(listener)) !== -1) {
        return;
      }

      self.child = ee;
      self._emit('newChildListener', event, listener);
      self.child = null;
    };

    ee.on('newListener', listen);
    this.__listeners.push(listen);

    this.children.push(ee);
  }

  return this;
};


//
// Remove an event emitter from eventyoshi
// remove all of the listeners that were added by eventyoshi
//
yoshi.prototype.remove = function(ee) {
  var i;
  if ((i = this.children.indexOf(ee)) !== -1) {
    var self = this;
    Object.keys(self.__events).forEach(function(event) {
      var ev = self.__events[event];

      for(var i = 0, l = ev.listeners.length; i < l; i++) {
        ee.removeListener(event, ev.wrappers[i]);
      }
    });

    // remove newListener listener from event emitter
    ee.removeListener('newListener', this.__listeners[i]);
    this.__listeners.splice(i, 1);

    this.children.splice(i, 1);
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
  if (event === 'newListener' || event === 'newChildListener') {
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
    self.child = this;
    self._emit.apply(self,
         [event].concat(Array.prototype.slice.call(arguments)));
    self.child = null;
  };

  // mark these listeners as added by eventyoshi
  var i = this.__yoshi.length;
  this.__yoshi.push(wrapper);

  ev.wrappers.push(wrapper);
  ev.listeners.push(listener);

  this.children.forEach(function(ee) {
    ee.on(event, wrapper);
  });

  this.child = this;
  this._on(event, listener);
  this.child = null;

  // listeners have been added, safe to delete these
  this.__yoshi.splice(i, 1);
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
  if (event === 'newListener' || event === 'newChildListener') {
    this._removeListener(event, listener);
    return;
  }

  var ev, i;
  if ((ev = this.__events[event]) !== undefined) {
    var found = false;

    for (var i = 0, l = ev.listeners.length; i < l; i++) {
      var l = ev.listeners[i];
      if (l === listener ||
         (typeof l.listener === 'function' && l.listener === listener)) {
        found = true;
        break;
      }
    }

    if (!found) return;

    this.children.forEach(function(ee) {
      ee.removeListener(event, ev.wrappers[i]);
    });
    this._removeListener(event, ev.listeners[i]);

    ev.wrappers.splice(i, 1);
    ev.listeners.splice(i, 1);
  }
};


yoshi.prototype.removeAllListeners = function(event) {
  if (event != null) {
    if (event === 'newListener' || event === 'newChildListener') {
      this._removeAllListeners(event);
      return;
    }

    var ev;
    if ((ev = this.__events[event]) !== undefined) {
      this.children.forEach(function(ee) {
        ee.removeAllListeners(event);
      });
      this._removeAllListeners(event);

      delete this.__events[event];
    }

  } else {
    this.children.forEach(function(ee) {
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
yoshi.prototype.setMaxListeners = function(n) {
  this._setMaxListeners(n);
  this.children.forEach(function(ee) {
    ee._setMaxListeners(n);
  });
};


yoshi.prototype.emit = function() {
  var args = arguments;
  this._emit.apply(this, args);
  if (args[0] === 'newListener') return;

  this.children.forEach(function(ee) {
    ee.emit.apply(ee, args);
  });
};


//
// Proxy custom functions
//
yoshi.prototype.proxy = function() {
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
