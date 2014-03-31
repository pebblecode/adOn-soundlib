/**
 *  codec.js
 *  Copyright 2014 Pebble{code} Ltd
 *  Authors
 *    Tane Piper <tane@pebblecode.com>
 *
 *  The Codec provides the functionality around encoding and decoding characters
 *  to and from frequencies based on a specified range.
 */

var _ = require('lodash');

var Codec = function(config) {
  'use strict';

  config = config || {};

  this.options = _.defaults(config, {
    minFreq: 18000,
    maxFreq: 20000,
    errorMargin: 50,
    characters: 'abcdefghijklmABCDEFGHIJKLM0123456789',
    startCharacter: '^',
    endCharacter: '$',
    stopCharacter: '.'
  });

  this.frequencyRange = this.options.maxFreq - this.options.minFreq;

  this.characters = this.options.startCharacter +
                    this.options.characters +
                    this.options.endCharacter +
                    this.options.stopCharacter;

  this.buffer = '';

  return this;
};

Codec.prototype.toFrequency = function(char) {
  'use strict';

  var index = this.characters.indexOf(char);

  if (index < 0) {
    return null;
  }

  return this.options.minFreq + Math.round(this.frequencyRange * (index / this.characters.length));
};

Codec.prototype.toCharacter = function(frequency) {
  'use strict';

  if (!((this.options.minFreq - this.options.errorMargin) < frequency &&
         frequency < (this.options.maxFreq + this.options.errorMargin))) {

    return null;
  }

  var percent = (frequency - this.options.minFreq) / this.frequencyRange;
  var index = Math.round(this.characters.length * percent);
  var character = this.characters[index];
  if (!character) {
    return null;
  }

  return character;
};

Codec.prototype.encodeString = function(characterString, addStops) {
  'use strict';
  
  if (addStops) {
    characterString = characterString.split('').join(this.options.stopCharacter);
  }

  this.buffer = this.options.startCharacter + characterString + this.options.endCharacter;

  return _.map(this.buffer, this.toFrequency, this);
};

module.exports = Codec;
