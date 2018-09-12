const EventYoshi   = require('..');
const EventEmitter = require('events').EventEmitter;
const assert       = require('assert');
const spy          = require('sinon').spy;


describe('Add an emitter and listen for an event', () => {
  it('Emits event to eventyoshi', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);

    let lastFoo, lastFooChild;
    const foo = (s) => {
      lastFoo = s;
      lastFooChild = yoshi.child;
    };
    yoshi.on('foo', foo);

    let lastCat, lastCatChild;
    const cat = (s) => {
      lastCat = s;
      lastCatChild = yoshi.child;
    };
    yoshi.on('cat', cat);

    ee1.emit('foo', 'bar');
    assert.equal(lastFoo, 'bar');
    assert.equal(lastFooChild, ee1);

    ee1.emit('cat', 'doggy');
    assert.equal(lastCat, 'doggy');
    assert.equal(lastCatChild, ee1);
  });

  it('Does not emit events not listened to', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);
    const foo = spy();
    yoshi.on('foo', foo);
    ee1.emit('nope', 'yes');
    assert.ok(foo.notCalled);
  });

  describe('Remove listener', () => {
    it('Does not emit for those events anymore', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);
      const foo = spy();
      yoshi.on('foo', foo);
      ee1.emit('foo', 'bar2');
      assert.ok(foo.calledWith('bar2'));
      yoshi.removeListener('foo', foo);
      ee1.emit('foo', 'bar3');
      assert.ok(foo.calledWith('bar2'));
      assert.equal(foo.callCount, 1);
    });

    it('Still emits other listened to events', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);
      const foo = spy();
      const cat = spy();
      yoshi.addListener('foo', foo);
      yoshi.addListener('cat', cat);
      yoshi.off('foo', foo);
      ee1.emit('cat', 'dog');
      assert.ok(cat.calledWith('dog'));
    });
  });

  describe('Remove event emitter', () => {
    it('Does not route events to yoshi anymore', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);
      const cat = spy();
      yoshi.on('cat', cat);
      yoshi.remove(ee1);
      ee1.emit('cat', 'dog4');
      assert.ok(cat.notCalled);
    });

    it('Still routes events from other event emitters', () => {
      const ee1 = new EventEmitter();
      const ee2 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1).add(ee2);
      const cat = spy();
      yoshi.on('cat', cat);
      yoshi.remove(ee1);
      ee2.emit('cat', 'dog4');
      assert.ok(cat.calledWith('dog4'));
    });
  });
});

describe('Listen first, then add emitter', () => {
  it('Emits event to eventyoshi', () => {
    const ee1   = new EventEmitter();
    const yoshi = new EventYoshi();

    let lastFoo, lastFooChild;
    const foo = (s) => {
      lastFoo = s;
      lastFooChild = yoshi.child;
    };
    yoshi.on('foo', foo);

    let lastCat, lastCatChild;
    const cat = (s) => {
      lastCat = s;
      lastCatChild = yoshi.child;
    };
    yoshi.on('cat', cat);

    yoshi.add(ee1);

    ee1.emit('foo', 'bar');
    assert.equal(lastFoo, 'bar');
    assert.equal(lastFooChild, ee1);

    ee1.emit('cat', 'doggy');
    assert.equal(lastCat, 'doggy');
    assert.equal(lastCatChild, ee1);
  });
});

describe('Listen for `newListener` event', () => {
  describe('Add a new listener to yoshi', () => {
    it('Calls listener', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);

      let lastEmitter, lastEvent, lastListener;
      yoshi.on('newListener', (event, listener) => {
        lastEmitter = yoshi.child;
        lastEvent = event;
        lastListener = listener;
      });

      const f = () => {};
      yoshi.on('what', f);
      assert.equal(lastEmitter, yoshi);
      assert.equal(lastEvent, 'what');
      assert.equal(lastListener, f);
    });
  });

  describe('Add a new listener to event emitter', () => {
    it('Does not call listener', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);
      const f = spy();
      yoshi.on('newListener', f);
      ee1.on('butt', () => {});
      assert.ok(f.notCalled);
    });
  });

  describe('Remove `newListener` listener', () => {
    it('Does not call listener anymore', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);
      const f = spy();
      yoshi.on('newListener', f);
      yoshi.removeListener('newListener', f);
      yoshi.on('nothing', () => {});
      assert.ok(f.notCalled);
    });
  });
});

describe('Listener for `newChildListener` event', () => {
  describe('Add listener to yoshi', () => {
    it('Does not emit `newChildListener`', () => {
      const ee1 = new EventEmitter();
      const ee2 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1).add(ee2);
      const f = spy();
      yoshi.on('newChildListener', f);
      yoshi.on('foo', () => {});
      assert.ok(f.notCalled);
    });
  });

  describe('Add listener to child event emitter', () => {
    it('Emits `newChildListener`', () => {
      const ee1 = new EventEmitter();
      const ee2 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1).add(ee2);

      let lastEmitter, lastEvent, lastListener;
      yoshi.on('newChildListener', (event, listener) => {
        lastEmitter = yoshi.child;
        lastEvent = event;
        lastListener = listener;
      });

      const f = () => {};
      ee1.on('bar', f);
      assert.equal(lastEmitter, ee1);
      assert.equal(lastEvent, 'bar');
      assert.equal(lastListener, f);
    });
  });

  describe('Remove `newChildListener` listener', () => {
    it('Does not call listener anymore', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);
      const f = spy();
      yoshi.on('newChildListener', f);
      yoshi.removeAllListeners('newChildListener', f);
      yoshi.on('nothing', () => {});
      assert.ok(f.notCalled);
    });
  });
});

describe('Listen for `removeListener` event', () => {
  describe('Remove a listener from yoshi', () => {
    it('Calls listener', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);

      let lastEmitter, lastEvent, lastListener;
      yoshi.on('removeListener', (event, listener) => {
        lastEmitter = yoshi.child;
        lastEvent = event;
        lastListener = listener;
      });

      const f = () => {};
      yoshi.on('what', f);
      yoshi.off('what', f);
      assert.equal(lastEmitter, yoshi);
      assert.equal(lastEvent, 'what');
      assert.equal(lastListener, f);
    });
  });

  describe('Remove a listener from event emitter', () => {
    it('Does not call listener', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);
      const f = spy();
      yoshi.on('removeListener', f);
      ee1.on('butt', () => {});
      ee1.off('butt', () => {});
      assert.ok(f.notCalled);
    });
  });
});

describe('Listener for `removeChildListener` event', () => {
  describe('Remove listener from yoshi', () => {
    it('Does not emit `removeChildListener`', () => {
      const ee1 = new EventEmitter();
      const ee2 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1).add(ee2);
      const f = spy();
      yoshi.on('removeChildListener', f);
      yoshi.on('foo', () => {});
      yoshi.off('foo', () => {});
      assert.ok(f.notCalled);
    });
  });

  describe('Remove listener from child event emitter', () => {
    it('Emits `removeChildListener`', () => {
      const ee1 = new EventEmitter();
      const ee2 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1).add(ee2);

      let lastEmitter, lastEvent, lastListener;
      yoshi.on('removeChildListener', (event, listener) => {
        lastEmitter = yoshi.child;
        lastEvent = event;
        lastListener = listener;
      });

      const f = () => {};
      ee1.on('bar', f);
      ee1.off('bar', f);
      assert.equal(lastEmitter, ee1);
      assert.equal(lastEvent, 'bar');
      assert.equal(lastListener, f);
    });
  });
});

describe('Listen once', () => {
  it('Calls listener just once', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);
    const f = spy();
    yoshi.once('soap', f);
    ee1.emit('soap', 'a');
    ee1.emit('soap', 'b');
    ee1.emit('soap', 'c');
    assert.equal(f.callCount, 1);
    assert.ok(f.calledWith('a'));
  });

  describe('Remove listener before emitting', () => {
    it('Does not call listener when emitted', () => {
      const ee1 = new EventEmitter();
      const yoshi = new EventYoshi().add(ee1);
      const f = spy();
      yoshi.once('bar', f);
      yoshi.removeListener('bar', f);
      ee1.emit('bar', 1);
      assert.ok(f.notCalled);
    });
  });
});

describe('Emit on eventyoshi', () => {
  it('Emits for both eventyoshi and child event emitters', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);
    const parent = spy();
    const child = spy();
    yoshi.on('a', parent);
    ee1.on('a', child);
    yoshi.emit('a', 'b');
    assert.ok(parent.called);
    assert.ok(child.called);
  });

  it('Does not emit for child after removing', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);
    const parent = spy();
    const child = spy();
    yoshi.on('a', parent);
    ee1.on('a', child);
    yoshi.remove(ee1);
    yoshi.emit('a', 'b');
    assert.ok(parent.called);
    assert.ok(child.notCalled);
  });
});

describe('Listen for an event more than once', () => {
  it('Should emit event once per listener when emitted', (done) => {
    const yoshi = new EventYoshi();
    yoshi.add(new EventEmitter());
    yoshi.add(new EventEmitter());
    yoshi.setMaxListeners(3);
    const b = () => {};
    yoshi.on('foo', () => {});
    yoshi.on('foo', b);
    yoshi.removeListener('foo', b);
    yoshi.on('foo', done);
    yoshi.emit('foo');
  });
});

describe('Proxy a custom function', () => {
  it('Calls proxied child functions', () => {
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

    assert.deepEqual(yoshi.foo(2, 3), ['a', 'b']);
    assert.equal(ee1foo, true);
    assert.equal(ee2foo, 5);

    assert.equal(yoshi.bar('hello'), 'hello');
  });
});

describe('Add the same emitter twice', () => {
  it('Emits event only once', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1).add(ee1);
    const f = spy();
    yoshi.on('hello', f);
    yoshi.emit('hello', 'to u');
    yoshi.remove(ee1).remove(ee1);
    assert.ok(f.calledOnce);
  });
});

describe('Remove all events from yoshi', () => {
  it('Does not emit event anymore from child emitters', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);
    const parent = spy();
    yoshi.on('foo', parent);
    yoshi.removeAllListeners('foo');
    yoshi.removeAllListeners('bar');
    ee1.emit('foo', 42);
    assert.ok(parent.notCalled);
  });

  it('Still emits events to children', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);
    const parent = spy();
    const child = spy();
    yoshi.on('foo', parent);
    ee1.on('foo', child);
    yoshi.removeAllListeners();
    ee1.emit('foo', 42);
    assert.ok(parent.notCalled);
    assert.ok(child.called);
  });
});

describe('Use `EventEmitter#prependListener()`', () => {
  it('Emits listeners in correct order', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);
    const a = spy();
    const b = spy();
    yoshi.prependListener('heart', b);
    yoshi.prependListener('heart', a);
    ee1.emit('heart');
    assert.ok(a.called);
    assert.ok(b.called);
    assert.ok(a.calledBefore(b));
  });
});

describe('Use `EventEmitter#prependOnceListener()`', () => {
  it('Emits listeners in correct order', () => {
    const ee1 = new EventEmitter();
    const yoshi = new EventYoshi().add(ee1);
    const a = spy();
    const b = spy();
    yoshi.prependOnceListener('heart', b);
    yoshi.prependOnceListener('heart', a);
    ee1.emit('heart');
    assert.ok(a.called);
    assert.ok(b.called);
    assert.ok(a.calledBefore(b));
  });
});
