'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveGrupoPrincipal } = require('../src/services/driveService');

test('selects the group with the most student subject registrations', () => {
  assert.equal(resolveGrupoPrincipal([
    { grupo: 'A1' },
    { grupo: 'A1' },
    { grupo: 'B1' },
  ]), 'A1');
});

test('counts group names without case sensitivity', () => {
  assert.equal(resolveGrupoPrincipal([
    { grupo: 'a1' },
    { grupo: 'A1' },
    { grupo: 'B1' },
  ]), 'a1');
});

test('rejects a tie instead of selecting an arbitrary group', () => {
  assert.throws(
    () => resolveGrupoPrincipal([{ grupo: 'A1' }, { grupo: 'B1' }]),
    (error) => error.code === 'DRIVE_STUDENT_GROUP_AMBIGUOUS',
  );
});

test('rejects students without an assigned group', () => {
  assert.throws(
    () => resolveGrupoPrincipal([{ grupo: ' ' }]),
    (error) => error.code === 'DRIVE_STUDENT_GROUP_REQUIRED',
  );
});
