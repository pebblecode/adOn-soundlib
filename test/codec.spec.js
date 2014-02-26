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
    expect(freq).toBe(18523);
  });

  it('Should decode a single frequency to a character', function() {
    var freq = 18523;
    var character = codec.toCharacter(freq);
    expect(character).toBe('a');
  });

  it('Should encode a string of character to a frequency array', function() {
    var str = 'foobar';
    var freqArray = codec.encodeString(str);
    expect(freqArray.length).toBe(11);  // 11 as there are stop characters
    expect(freqArray[8]).toBe(18523);  // 8  as there are stop characters
  });

  it('Should throw an error when encoding a single character', function() {
    var character = '(';
    expect(codec.toFrequency.bind(null, character)).toThrow();
  });

  it('Should throw an error when encoding a single frequency', function() {
    var freq = '500';
    expect(codec.toCharacter.bind(null, freq)).toThrow();
  });

  it('Should throw an error when encoding a character string', function() {
    var str = 'foobar';
    expect(codec.encodeString.bind(null, str)).toThrow();
  });

});