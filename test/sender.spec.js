var Sender = require('./../lib/sender');

describe('sender', function() {
  'use strict';

  var sender;

  beforeEach(function() {
    sender = new Sender();
  });

  it('should have an audioContext', function() {
    expect(sender.context).toBeTruthy();
  });

  it('should create a gain node', function() {
    expect(sender.context.createGain()).toBeTruthy();
  });

  it('should create a oscillator', function() {
    expect(sender.context.createOscillator()).toBeTruthy();
  });

  it('should send a message and return a promise', function() {
    sender.sendMessage('abcdefg', function(frequencies) {
      expect(frequencies.length).toBe(7);
    });
  });
});
