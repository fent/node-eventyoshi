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
