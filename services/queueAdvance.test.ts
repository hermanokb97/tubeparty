import assert from 'node:assert/strict';
import test from 'node:test';
import { isStaleRemoteUpdate } from './playbackGuard.ts';
import { advanceQueue, skipQueue, skipUnplayable } from './queueAdvance.ts';
import type { Video } from '../types.ts';

const video = (id: string): Video => ({
  id,
  title: id,
  thumbnail: '',
  channelTitle: '',
});

const queue = [video('a'), video('b'), video('c')];

test('advanceQueue plays the next item and stops at the end', () => {
  assert.equal(advanceQueue(queue, 'a', 'off', false).video?.id, 'b');
  assert.equal(advanceQueue(queue, 'c', 'off', false).video, null);
});

test('advanceQueue loops only in repeat-all and replays the same id in repeat-one', () => {
  assert.equal(advanceQueue(queue, 'c', 'all', false).video?.id, 'a');
  assert.equal(advanceQueue(queue, 'b', 'one', false).video?.id, 'b');
});

test('advanceQueue shuffle does not depend on a stale index', () => {
  const result = advanceQueue(queue, 'a', 'off', true, () => 0);
  assert.equal(result.video?.id, 'b');
  assert.equal(advanceQueue([video('a')], 'a', 'off', true).video?.id, 'a');
});

test('skipQueue wraps, and skipUnplayable removes the broken video', () => {
  assert.equal(skipQueue(queue, 'c').video?.id, 'a');
  const removed = skipUnplayable(queue, 'b', 'off');
  assert.deepEqual(removed.playlist.map((item) => item.id), ['a', 'c']);
  assert.equal(removed.video?.id, 'c');
  assert.equal(skipUnplayable([video('a')], 'a', 'off').video, null);
  assert.equal(skipUnplayable(queue, 'c', 'all').video?.id, 'a');
});

test('isStaleRemoteUpdate blocks only older snapshots inside the pending window', () => {
  assert.equal(isStaleRemoteUpdate(1_000, 900, 1_100), true);
  assert.equal(isStaleRemoteUpdate(1_000, 1_000, 1_100), false);
  assert.equal(isStaleRemoteUpdate(1_000, 900, 10_000), false);
  assert.equal(isStaleRemoteUpdate(null, 0, 1_100), false);
});
