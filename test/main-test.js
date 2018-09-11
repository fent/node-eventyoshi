const EventYoshi   = require('..');
const EventEmitter = require('events').EventEmitter;
const assert       = require('assert');


describe('Listen for an event', () => {
  const ee1   = new EventEmitter();
  const ee2   = new EventEmitter();
  const yoshi = new EventYoshi().add(ee1);

  let lastFoo, lastFooChild;
  const foo = function(s) {
    lastFoo = s;
    lastFooChild = this.child;
  };
  yoshi.on('foo', foo);

  let lastCat, lastCatChild;
  const cat = function(s) {
    lastCat = s;
    lastCatChild = this.child;
  };
  yoshi.on('cat', cat);

  it('Emits event to eventyoshi from emitter', () => {
    ee1.emit('foo', 'bar');
    assert.equal(lastFoo, 'bar');
    assert.equal(lastFooChild, ee1);

    ee1.emit('cat', 'doggy');
    assert.equal(lastCat, 'doggy');
    assert.equal(lastCatChild, ee1);
  });

  describe('Add another event emitter', () => {
    it('Routes its events to yoshi', () => {
      yoshi.add(ee2);

      ee2.emit('foo', 'bar2');
      assert.equal(lastFoo, 'bar2');
      assert.equal(lastFooChild, ee2);

      ee2.emit('cat', 'dog2');
      assert.equal(lastCat, 'dog2');
      assert.equal(lastCatChild, ee2);
    });

    it('Does not emit events not listened to', () => {
      ee2.emit('nope', 'yes');
      assert.equal(lastFoo, 'bar2');
      assert.equal(lastFooChild, ee2);
      assert.equal(lastCat, 'dog2');
      assert.equal(lastCatChild, ee2);
    });
  });

  describe('Remove listener', () => {

    it('Does not emit for those events anymore', () => {
      yoshi.removeListener('foo', foo);
      ee1.emit('foo', 'bar3');
      assert.equal(lastFoo, 'bar2');
      assert.equal(lastFooChild, ee2);
    });

    it('Still emits other listened to events', () => {
      ee1.emit('cat', 'dog3');
      assert.equal(lastCat, 'dog3');
      assert.equal(lastCatChild, ee1);
    });

    describe('Remove first event emitter', () => {
      it('Does not route events to yoshi anymore', () => {
        yoshi.remove(ee1);
        ee1.emit('cat', 'dog4');
        assert.equal(lastCat, 'dog3');
      });

      it('Still routes events from second event emitter', () => {
        ee2.emit('cat', 'dog5');
        assert.equal(lastCat, 'dog5');
        assert.equal(lastCatChild, ee2);
      });
    });
  });

  describe('Add more listeners', () => {
    let lastHello;
    const hello = (s) => { lastHello = s; };
    yoshi.on('hello', hello);
    yoshi.on('hello', foo);
    yoshi.on('hello', cat);

    it('Old listeners are still called', () => {
      ee2.emit('cat', 'diggity');
      assert.equal(lastCat, 'diggity');
      assert.equal(lastCatChild, ee2);
    });

    it('New listeners are called on new events', () => {
      ee2.emit('hello', 'world');
      assert.equal(lastFoo, 'world');
      assert.equal(lastCat, 'world');
      assert.equal(lastHello, 'world');
    });

    it('Listeners are not called when other events emitted', () => {
      ee2.emit('boy', 'meets world');
      assert.equal(lastFoo, 'world');
      assert.equal(lastCat, 'world');
      assert.equal(lastHello, 'world');
    });

    describe('Remove all listeners specifying event', () => {
      it('Does not call listeners for that event anymore', () => {
        yoshi.removeAllListeners('hello');

        ee2.emit('hello', 'world2');
        assert.equal(lastFoo, 'world');
        assert.equal(lastCat, 'world');
        assert.equal(lastHello, 'world');
      });

      it('Still calls listeners for other events', () => {
        ee2.emit('cat', 'dogton');
        assert.equal(lastCat, 'dogton');
      });
    });
  });

});


describe('Listen for `newListener` event', () => {
  const ee1 = new EventEmitter();
  const yoshi = new EventYoshi().add(ee1);

  let lastEmitter, lastEvent, lastListener;
  const newListener = function(event, listener) {
    lastEmitter = this.child;
    lastEvent = event;
    lastListener = listener;
  };
  yoshi.on('newListener', newListener);
  const f = () => {};

  describe('Add a new listener to yoshi', () => {
    it('Calls listener', () => {
      yoshi.on('what', f);
      assert.equal(lastEmitter, yoshi);
      assert.equal(lastEvent, 'what');
      assert.equal(lastListener, f);
    });
  });

  describe('Add a new listener to event emitter', () => {
    it('Does not call listener', () => {
      ee1.on('butt', () => {});
      assert.equal(lastEmitter, yoshi);
      assert.equal(lastEvent, 'what');
      assert.equal(lastListener, f);
    });
  });

  describe('Remove `newListener` listener', () => {
    it('Does not call listener anymore', () => {
      yoshi.removeListener('newListener', newListener);

      yoshi.on('nothing', () => {});
      assert.equal(lastEmitter, yoshi);
      assert.equal(lastEvent, 'what');
      assert.equal(lastListener, f);
    });
  });
});


describe('Listener for `newChildListener` event', () => {
  const ee1 = new EventEmitter();
  const ee2 = new EventEmitter();
  const yoshi = new EventYoshi()
    .add(ee1)
    .add(ee2);

  let lastEmitter, lastEvent, lastListener;
  const newChildListener = function(event, listener) {
    lastEmitter = this.child;
    lastEvent = event;
    lastListener = listener;
  };
  
  yoshi.on('newChildListener', newChildListener);

  describe('Add listener to yoshi', () => {
    it('Does not emit newChildListener', () => {
      yoshi.on('foo', () => {});
      assert.ok(!lastEmitter);
      assert.ok(!lastEvent);
      assert.ok(!lastListener);
    });
  });

  describe('Add listener to child event emitter', () => {
    it('Emits newChildListener', () => {
      const f = () => {};
      ee1.on('bar', f);
      assert.equal(lastEmitter, ee1);
      assert.equal(lastEvent, 'bar');
      assert.equal(lastListener, f);
    });
  });
});


describe('Listen once', () => {
  const ee1 = new EventEmitter();
  const yoshi = new EventYoshi().add(ee1);

  let last;
  const f = (s) => { last = s; };
  yoshi.once('soap', f);

  it('Calls listener just once', () => {
    ee1.emit('soap', 'a');
    ee1.emit('soap', 'b');
    ee1.emit('soap', 'c');
    assert.equal(last, 'a');
  });

  describe('and then removeListener', () => {
    it('Does not call listener when emitted', () => {
      yoshi.once('bar', f);
      yoshi.removeListener('bar', f);

      ee1.emit('bar', 1);
      assert.equal(last, 'a');
    });
  });
});


describe('Emit on eventyoshi', () => {
  const ee1 = new EventEmitter();
  const yoshi = new EventYoshi().add(ee1);

  let lastYoshi, lastEE;
  yoshi.on('a', (s) => { lastYoshi = s; });
  ee1.on('a', (s) => { lastEE = s; });

  it('Emits for both eventyoshi and child event emitters', () => {
    yoshi.emit('a', 'b');

    assert.equal(lastYoshi, 'b');
    assert.equal(lastEE, 'b');
  });
});


describe('Proxy a custom function', () => {
  const ee1 = new EventEmitter();
  const ee2 = new EventEmitter();
  const yoshi = new EventYoshi()
    .add(ee1)
    .add(ee2);


  yoshi.proxy('foo', 'bar');

  let ee1foo, ee2foo;
  ee1.foo = () => {
    ee1foo = true;
    return 'a';
  };

  ee2.foo = (a, b) => {
    ee2foo = a + b;
    return 'b';
  };

  ee2.bar = (a) => {
    return a;
  };

  it('Calls proxied child functions', () => {
    assert.deepEqual(yoshi.foo(2, 3), ['a', 'b']);
    assert.equal(ee1foo, true);
    assert.equal(ee2foo, 5);

    assert.equal(yoshi.bar('hello'), 'hello');
  });
});
