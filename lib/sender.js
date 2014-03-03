var AudioContext = window.AudioContext || window.webkitAudioContext;

var _ = require('lodash');
var Promise = require('bluebird');
var Codec = require('./codec.js');

var Sender = function(config) {
  'use strict';
  config = config || {};
  this.options = _.defaults(config, {
    codec: new Codec(),
    characterDuration: 0.15,
    rampDuration: 0.001,
    context: new AudioContext()
  });

  this.buffer = '';
  this.frequencies = [];

  return this;
};

Sender.prototype.sendMessage = function(message, addStops) {
  'use strict';

  this.buffer = '';
  this.frequencies = [];

  return new Promise(function(resolve, reject) {

    this.buffer = message;

    this.frequencies = this.options.codec.encodeString(this.buffer, addStops);

    _(this.frequencies).forEach(function(freq, index) {
      var time = parseFloat((this.options.context.currentTime + this.options.characterDuration * index).toFixed(6));

      requestAnimationFrame(function() {
        this.sendTone(freq, time, this.options.characterDuration);
      }.bind(this));

    }, this);

    setTimeout(resolve.bind(this, this), this.options.characterDuration * this.frequencies.length * 1000);

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

  oscillator.onended = function() {
    gainNode.disconnect();
    oscillator.disconnect();

    gainNode = null;
    oscillator = null;
  };

  oscillator.start(startTime);
  oscillator.stop(startTime + this.options.characterDuration);


};

module.exports = Sender;
