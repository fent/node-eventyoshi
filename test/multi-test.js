const EventYoshi   = require('..');
const EventEmitter = require('events').EventEmitter;
const assert       = require('assert');


describe('Listen for an event more than once', () => {
  const yoshi = new EventYoshi();
  yoshi.add(new EventEmitter());
  yoshi.add(new EventEmitter());
  const a = () => {};
  const b = () => {};
  yoshi.on('foo', a);
  yoshi.on('foo', b);

  it('Should emit event only once when emitted', (done) => {
    yoshi.on('foo', done);
    yoshi.emit('foo');
  });

  describe('remove a listener', () => {
    it('Does not throw', () => {
      yoshi.removeListener('foo', a);
    });
  });
});


describe('Listen first', () => {
  const yoshi = new EventYoshi();
  const ee1 = new EventEmitter();
  let lastA;
  let lastB;
  const a = (s) => { lastA = s; };
  const b = (s) => { lastB = s; } ;
  yoshi.on('foo', a);
  yoshi.on('foo', b);

  describe('then add a listener', () => {
    it('Emits event on yoshi', () => {
      yoshi.add(ee1);
      ee1.emit('foo', 'bar');
      assert.equal(lastA, 'bar');
      assert.equal(lastB, 'bar');
    });

    describe('then remove and add another', () => {
      it('Should call new listener on emit', () => {
        yoshi.removeListener('foo', a);
        ee1.emit('foo', 'fff');
        assert.equal(lastA, 'bar');
        assert.equal(lastB, 'fff');
      });
    });

  });
});
