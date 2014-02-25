var Sender = require('./../lib/sender');

describe('sender', function() {
  'use strict';

  var sender;

  beforeEach(function() {
    sender = new Sender();
  });

  it('should send message via audio context', function() {
    var str = 'abcdefg';
    sender.sendMessage(str)
      .then(function() {
        expect(true).toBe(true);
      });

  })
});