var EventYoshi = require('..')
  , EventEmitter = require('events').EventEmitter
  , assert = require('assert')


describe('Listen for an event more than once', function() {
  var yoshi = new EventYoshi();
  yoshi.add(new EventEmitter());
  yoshi.add(new EventEmitter());

  it('Should emit event only once when emitted', function(done) {
    yoshi.on('foo', function() {});
    yoshi.on('foo', function() {});
    yoshi.on('foo', done);
    yoshi.emit('foo');
  });
});
