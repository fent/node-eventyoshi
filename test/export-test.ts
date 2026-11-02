import assert from 'node:assert';
import EventYoshi, { EventYoshi as NamedEventYoshi } from '..';

describe('Exports', () => {
  it('Exposes class as default and named export', () => {
    assert.strictEqual(EventYoshi, NamedEventYoshi);
    assert.strictEqual(EventYoshi.EventYoshi, EventYoshi);
    assert.strictEqual(EventYoshi.default, EventYoshi);
  });
});
