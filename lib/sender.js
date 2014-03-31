var AudioContext = window.AudioContext || window.webkitAudioContext;

var _ = require('lodash');
var Codec = require('./codec.js');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var Sender = function(config, codec, context) {
  'use strict';

  config = config || {};

  this.options = _.defaults(config, {
    characterDuration: 0.15,
    rampDuration: 0.001,
  });

  this.codec = codec || new Codec();

  this.context = context || new AudioContext();

  this.buffer = '';

  this.frequencies = [];

  this.charactersSent = 0;

  return this;
};

util.inherits(Sender, EventEmitter);

Sender.prototype.sendMessage = function(message, addStops) {
  'use strict';

  this.buffer = message;

  this.frequencies = this.codec.encodeString(this.buffer, addStops);

  this.charactersSent = 0;

  _(this.frequencies).forEach(function(freq, index) {
    var time = parseFloat((this.context.currentTime + this.options.characterDuration * index).toFixed(6));
    this.sendTone(freq, time, this.options.characterDuration);
  }, this);
};

Sender.prototype.sendTone = function(freq, startTime, duration) {
  var gainNode = this.context.createGainNode();
  var oscillator = this.context.createOscillator();

  gainNode.gain.value = 0;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(1, startTime + this.options.rampDuration);
  gainNode.gain.setValueAtTime(1, startTime + duration - this.options.rampDuration);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  gainNode.connect(this.context.destination);

  oscillator.frequency.value = freq;

  oscillator.onended = function() {
    this.charactersSent++;
    this.emit('tone', freq, startTime, duration);

    gainNode.disconnect();
    oscillator.disconnect();

    gainNode = null;
    oscillator = null;
    if (this.charactersSent === this.frequencies.length) {
      this.emit('end');
    }
  }.bind(this);

  oscillator.connect(gainNode);

  oscillator.start(startTime);
  oscillator.stop(startTime + this.options.characterDuration);
};

module.exports = Sender;
