var Codec = require('./../lib/Codec');

describe('Codec', function() {
  'use strict';

  var codec;

  beforeEach(function() {
    codec = new Codec();
  });

  it('Should encode a single character to a frequency', function() {
    var character = 'a';
    var freq = codec.toFrequency(character);
    expect(freq).toBe(18564);
  });

  it('Should decode a single frequency to a character', function() {
    var freq = 18564;
    var character = codec.toCharacter(freq);
    expect(character).toBe('a');
  });

  it('Should encode a string of character to a frequency array', function() {
    var str = 'abcdefgABCDEFG';
    var freqArray = codec.encodeString(str);
    expect(freqArray.length).toBe(14);
    expect(freqArray[0]).toBe(18564);
  });

});
