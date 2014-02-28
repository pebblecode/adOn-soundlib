// codec.js

var _ = require('lodash');

var Codec = function(config) {
  'use strict';

  config = config || {};

  this.options = _.defaults(config, {
    minFreq: 18500,
    maxFreq: 21000,
    errorMargin: 50,
    characters: 'abcdefghijklmABCDEFGHIJKLM0123456789',
    startCharacter: '^',
    endCharacter: '$',
    stopCharacter: '.'
  });

  this.frequencyRange = this.options.maxFreq - this.options.minFreq;
  this.characters = this.options.startCharacter + this.options.characters + this.options.endCharacter + this.options.stopCharacter;

  return this;
};

Codec.prototype.toFrequency = function(char) {
  'use strict';

  var index = this.characters.indexOf(char);

  if (index < 0) {
    //throw new Error('The character ' + char + ' is not within range');
    return;
  }

  var percent = index / this.characters.length;
  var offset = Math.round(this.frequencyRange * percent);
  return this.options.minFreq + offset;
};

Codec.prototype.toCharacter = function(frequency) {
  'use strict';

  if (!((this.options.minFreq - this.options.errorMargin) < frequency && frequency < (this.options.maxFreq + this.options.errorMargin))) {
    // Do error handling here, for now we just return an error
    //throw new Error('This frequency is not within the allowed range');
    console.log('frequency out of range');
    return;
  }

  var percent = (frequency - this.options.minFreq) / this.frequencyRange;
  var index = Math.round(this.characters.length * percent);
  var character = this.characters[index];
  if (!character) {
    //throw new Error('No character was found at frequency ' + frequency);
    return;
  }

  return character;
};

Codec.prototype.encodeString = function(characterString) {
  'use strict';

  return _.map(characterString, this.toFrequency, this);
};

module.exports = Codec;
