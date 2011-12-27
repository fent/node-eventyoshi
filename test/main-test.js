var EventYoshi = require('..')
  , EventEmitter = require('events').EventEmitter
  , assert = require('assert')


describe('Listen for an event', function() {
  var ee1 = new EventEmitter()
    , ee2 = new EventEmitter()
    , yoshi  = new EventYoshi()
               .add(ee1)

  var lastFoo, lastFooChild;
  var foo = function(s) {
    lastFoo = s;
    lastFooChild = this.child;
  };
  yoshi.on('foo', foo);

  var lastCat, lastCatChild;
  var cat = function(s) {
    lastCat = s;
    lastCatChild = this.child;
  };
  yoshi.on('cat', cat);


  it('Emits event to eventyoshi from emitter', function() {
    ee1.emit('foo', 'bar');
    assert.equal(lastFoo, 'bar');
    assert.equal(lastFooChild, ee1);

    ee1.emit('cat', 'doggy');
    assert.equal(lastCat, 'doggy');
    assert.equal(lastCatChild, ee1);
  });

  describe('Add another event emitter', function() {

    it('Routes its events to yoshi', function() {
      yoshi.add(ee2);

      ee2.emit('foo', 'bar2');
      assert.equal(lastFoo, 'bar2');
      assert.equal(lastFooChild, ee2);

      ee2.emit('cat', 'dog2');
      assert.equal(lastCat, 'dog2');
      assert.equal(lastCatChild, ee2);
    });

    it('Does not emit events not listened to', function() {
      ee2.emit('nope', 'yes');
      assert.equal(lastFoo, 'bar2');
      assert.equal(lastFooChild, ee2);
      assert.equal(lastCat, 'dog2');
      assert.equal(lastCatChild, ee2);
    });
  });

  describe('Remove listener', function() {

    it('Does not emit for those events anymore', function() {
      yoshi.removeListener('foo', foo);
      ee1.emit('foo', 'bar3');
      assert.equal(lastFoo, 'bar2');
      assert.equal(lastFooChild, ee2);
    });

    it('Still emits other listened to events', function() {
      ee1.emit('cat', 'dog3');
      assert.equal(lastCat, 'dog3');
      assert.equal(lastCatChild, ee1);
    });

    describe('Remove first event emitter', function() {
      it('Does not route events to yoshi anymore', function() {
        yoshi.remove(ee1);
        ee1.emit('cat', 'dog4');
        assert.equal(lastCat, 'dog3');
      });

      it('Still routes events from second event emitter', function() {
        ee2.emit('cat', 'dog5');
        assert.equal(lastCat, 'dog5');
      assert.equal(lastCatChild, ee2);
      });
    });
  });

  describe('Add more listeners', function() {
    var lastHello;
    var hello = function(s) {
      lastHello = s;
    };
    yoshi.on('hello', hello);
    yoshi.on('hello', foo);
    yoshi.on('hello', cat);

    it('Old listeners are still called', function() {
      ee2.emit('cat', 'diggity');
      assert.equal(lastCat, 'diggity');
      assert.equal(lastCatChild, ee2);
    });

    it('New listeners are called on new events', function() {
      ee2.emit('hello', 'world');
      assert.equal(lastFoo, 'world');
      assert.equal(lastCat, 'world');
      assert.equal(lastHello, 'world');
    });

    it('Listeners are not called when other events emitted', function() {
      ee2.emit('boy', 'meets world');
      assert.equal(lastFoo, 'world');
      assert.equal(lastCat, 'world');
      assert.equal(lastHello, 'world');
    });

    describe('Remove all listeners specifying event', function() {
      it('Does not call listeners for that event anymore', function() {
        yoshi.removeAllListeners('hello');

        ee2.emit('hello', 'world2');
        assert.equal(lastFoo, 'world');
        assert.equal(lastCat, 'world');
        assert.equal(lastHello, 'world');
      });

      it('Still calls listeners for other events', function() {
        ee2.emit('cat', 'dogton');
        assert.equal(lastCat, 'dogton');
      });
    });

    /*
     * does not work with node v0.4.x
     * because `removeAllListeners()` must be called with an event name
    describe('Remove all listeners', function() {
      it('Does not call any listener', function() {
        yoshi.removeAllListeners();

        ee2.emit('hello', 'world3');
        ee2.emit('cat', 'diddy');
        ee2.emit('foo', 'boor');
        assert.equal(lastFoo, 'world');
        assert.equal(lastCat, 'dogton');
        assert.equal(lastHello, 'world');
      });
    });
    */
  });

});


describe('Listen for `newListener` event', function() {
  var ee1 = new EventEmitter()
    , yoshi  = new EventYoshi()
               .add(ee1)

  var lastEmitter, lastEvent, lastListener;
  var newListener = function(event, listener) {
    lastEmitter = this.child;
    lastEvent = event;
    lastListener = listener
  };
  yoshi.on('newListener', newListener);

  var f = function() {};

  describe('Add a new listener to yoshi', function() {
    it('Calls listener', function() {
      yoshi.on('what', f);
      assert.equal(lastEmitter, yoshi);
      assert.equal(lastEvent, 'what');
      assert.equal(lastListener, f);
    });
  });

  describe('Add a new listener to event emitter', function() {
    it('Does not call listener', function() {
      ee1.on('butt', function() {});
      assert.equal(lastEmitter, yoshi);
      assert.equal(lastEvent, 'what');
      assert.equal(lastListener, f);
    });
  });

  describe('Remove `newListener` listener', function() {
    it('Does not call listener anymore', function() {
      yoshi.removeListener('newListener', newListener);

      yoshi.on('nothing', function() {});
      assert.equal(lastEmitter, yoshi);
      assert.equal(lastEvent, 'what');
      assert.equal(lastListener, f);
    });
  });
});


describe('Listener for `newChildListener` event', function() {
  var ee1 = new EventEmitter()
    , ee2 = new EventEmitter()
    , yoshi  = new EventYoshi()
               .add(ee1)
               .add(ee2)

  var lastEmitter, lastEvent, lastListener;
  var newChildListener = function(event, listener) {
    lastEmitter = this.child;
    lastEvent = event;
    lastListener = listener;
  };
  
  yoshi.on('newChildListener', newChildListener);

  describe('Add listener to yoshi', function() {
    it('Does not emit newChildListener', function() {
      yoshi.on('foo', function() {});
      assert.equal(lastEmitter, undefined);
      assert.equal(lastEvent, undefined);
      assert.equal(lastListener, undefined);
    });
  });

  describe('Add listener to child event emitter', function() {
    it('Emits newChildListener', function() {
      var f = function() {};
      ee1.on('bar', f);
      assert.equal(lastEmitter, ee1);
      assert.equal(lastEvent, 'bar');
      assert.equal(lastListener, f);
    });
  });
});


describe('Listen once', function() {
  var ee1 = new EventEmitter()
    , yoshi  = new EventYoshi()
               .add(ee1)

  var last;
  var f = function(s) {
    last = s;
  };
  yoshi.once('soap', f);

  it('Calls listener just once', function() {
    ee1.emit('soap', 'a');
    ee1.emit('soap', 'b');
    ee1.emit('soap', 'c');

    assert.equal(last, 'a');
  });

  describe('and then removeListener', function() {
    it('Does not call listener when emitted', function() {
      yoshi.once('bar', f);
      yoshi.removeListener('bar', f);

      ee1.emit('bar', 1);
      assert.equal(last, 'a');
    });
  });
});


describe('Emit on eventyoshi', function() {
  var ee1 = new EventEmitter()
    , yoshi  = new EventYoshi()
               .add(ee1)

  var lastYoshi, lastEE;
  yoshi.on('a', function(s) {
    lastYoshi = s;
  });

  ee1.on('a', function(s) {
    lastEE = s;
  });

  it('Emits for both eventyoshi and child event emitters', function() {
    yoshi.emit('a', 'b');

    assert.equal(lastYoshi, 'b');
    assert.equal(lastEE, 'b');
  });
});
