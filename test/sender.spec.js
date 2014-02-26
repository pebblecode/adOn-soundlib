var Sender = require('./../lib/sender');

describe('sender', function() {
  'use strict';

  var sender;

  beforeEach(function() {
    sender = new Sender();
  });

  it('should have an audioContext', function() {
    expect(sender.options.context).toBeTruthy();
  });

  it('should create a gain node', function() {
    expect(sender.options.context.createGainNode()).toBeTruthy();
  });
});