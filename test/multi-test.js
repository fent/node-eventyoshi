var EventYoshi = require('..')
  , EventEmitter = require('events').EventEmitter
  , assert = require('assert')


describe('Listen for an event more than once', function() {
  var yoshi = new EventYoshi();
  yoshi.add(new EventEmitter());
  yoshi.add(new EventEmitter());
  function a() {}
  function b() {}
  yoshi.on('foo', a);
  yoshi.on('foo', b);

  it('Should emit event only once when emitted', function(done) {
    yoshi.on('foo', done);
    yoshi.emit('foo');
  });

  describe('remove a listener', function() {
    it('Does not throw', function() {
      yoshi.removeListener('foo', a);
    });
  });
});


describe('Listen first', function() {
  var yoshi = new EventYoshi();
  var ee1 = new EventEmitter();
  var lastA;
  var lastB
  function a(s) {
    lastA = s;
  }

  function b(s) {
    lastB = s;
  }

  yoshi.on('foo', a);
  yoshi.on('foo', b);

  describe('then add a listener', function() {
    it('Emits event on yoshi', function() {
      yoshi.add(ee1);
      ee1.emit('foo', 'bar');
      assert.equal(lastA, 'bar');
      assert.equal(lastB, 'bar');
    });

    describe('then remove and add another', function() {
      it('Should call new listener on emit', function() {
        yoshi.removeListener('foo', a);
        ee1.emit('foo', 'fff');
        assert.equal(lastA, 'bar');
        assert.equal(lastB, 'fff');
      });
    });

  });
});
