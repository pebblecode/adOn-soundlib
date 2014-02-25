// codec.js

var _ = require('lodash');

var Codec = function(config) {
  'use strict';

  config = config || {};

  this.options = _.defaults(config, {
    minFreq: 18500,
    maxFreq: 20000,
    errorMargin: 50,
    characters: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    startChracter: '^',
    endCharacter: '$',
    stopChar: '.'
  });

  this.frequencyRange = this.options.maxFreq - this.options.minFreq;
  this.characters = this.options.startChracter + this.options.characters + this.options.endCharacter + this.options.stopChar;

  return this;
};

Codec.prototype.toFrequency = function(char) {
  'use strict';

  var index = this.characters.indexOf(char);

  if (index < 0) {
    throw new Error('The character ' + char + ' is not within range');
  }

  var percent = index / this.characters.length;
  var offset = Math.round(this.frequencyRange * percent);
  return this.options.minFreq + offset;
};

Codec.prototype.toCharacter = function(frequency) {
  'use strict';

  if (!(this.options.minFreq < frequency && frequency < this.options.maxFreq)) {
    // Do error handling here, for now we just return an error
    throw new Error('This frequency is not within the allowed range');
  }

  var percent = (frequency - this.options.minFreq) / this.frequencyRange;
  var index = Math.round(this.characters.length * percent);
  var character = this.characters[index];
  if (!character) {
    throw new Error('No character was found at frequency ' + frequency);
  }

  return character;
};

Codec.prototype.encodeString = function(characterString) {
  'use strict';

  characterString = characterString.split('').join('.');
  console.log(characterString);

  var frequencyArray = [];
  var i, j;
  for (i = 0, j = characterString.length; i < j; i++) {
    var freq = this.toFrequency(characterString[i]);
    frequencyArray.push(freq);
  }

  return frequencyArray;
};

module.exports = Codec;