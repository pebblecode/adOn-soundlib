var AudioContext = window.AudioContext || window.webkitAudioContext;

var _ = require('lodash');
var Promise = require('bluebird');
var Codec = require('./codec.js');

var Sender = function(config) {
  'use strict';
  config = config || {};
  this.options = _.defaults(config, {
    codec: new Codec(),
    characterDuration: 0.2,
    rampDuration: 0.001,
    context: new AudioContext()
  });

  //this.gainNode = this.options.createGainNode();
  //this.oscillator = this.options.createOscillator();

  return this;
};

Sender.prototype.sendMessage = function(message) {
  'use strict';
  
  return new Promise(function(resolve, reject) {
    
    message = this.options.codec.options.startChracter + message + this.options.codec.options.endCharacter;

    var frequencies = this.options.codec.encodeString(message);
    _(frequencies).forEach(function(freq, index) {
      var time = this.options.context.currentTime + this.options.characterDuration * index;
      this.sendTone(freq, time, this.options.characterDuration);
    }, this);
  }.bind(this));
};

Sender.prototype.sendTone = function(freq, startTime, duration) {
  var gainNode = this.options.context.createGainNode();
  var oscillator = this.options.context.createOscillator();

  gainNode.gain.value = 0;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(1, startTime + this.options.rampDuration);
  gainNode.gain.setValueAtTime(1, startTime + duration - this.options.rampDuration);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  gainNode.connect(this.options.context.destination);

  oscillator.frequency.value = freq;
  oscillator.connect(gainNode);
  oscillator.start(startTime);
};

module.exports = Sender;