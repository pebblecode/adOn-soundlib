var AudioContext = window.AudioContext || window.webkitAudioContext;
navigator.getMedia = ( navigator.getUserMedia ||
                 navigator.webkitGetUserMedia ||
                 navigator.mozGetUserMedia ||
                 navigator.msGetUserMedia);

var _ = require('lodash');
var Promise = require('bluebird');
var Codec = require('./codec.js');

var State = {
  IDLE: 1,
  RECV: 2
};

var Listener = function(config) {
  'use strict';

  config = config || {};

  this.options = _.defaults({}, {
    peakThreshold: -65,
    minRunLength: 2,
    codec: new Codec(),
    context: new AudioContext(),
    timeout: 300,
    debug: false
  });

  this.peakHistory = [];
  this.peakTimes = [];

  this.callbacks = {};

  this.buffer = '';
  this.state = State.IDLE;
  this.isRunning = false;

  this.stream = null;
  this.analyser = null;
  this.frequencies = null;

  return this;
};

Listener.prototype.start = function() {
  'use strict';

  navigator.getMedia({audio: true}, this.onStream.bind(this), this.onStreamError.bind(this));
};

Listener.prototype.stop = function() {
  'use strict';

  this.isRunning = false;
  if (this.stream) {
    this.stream.stop();
  }
};

Listener.prototype.on = function(event, callback) {
  if (event == 'message') {
    this.callbacks.message = callback;
  }
};

Listener.prototype.onStream = function(stream) {
  'use strict';

  this.stream = stream;
  var input = this.options.context.createMediaStreamSource(stream);
  var analyser = this.analyser = this.options.context.createAnalyser();

  input.connect(analyser);

  this.frequencies = new Float32Array(analyser.frequencyBinCount);

  this.isRunning = true;

  requestAnimationFrame(this.loop.bind(this));
};

Listener.prototype.onStreamError = function(e) {
  console.error('Audio input error:', e);
};

Listener.prototype.loop = function() {
  'use strict';

  this.analyser.getFloatFrequencyData(this.frequencies);

  var freq = this.getPeakFrequency.apply(this);
  
  if (freq) {
    var character = this.options.codec.toCharacter(freq);
    this.peakHistory.push(character);
    this.peakTimes.push(new Date());
  } else {
    // If no character was detected, see if we've timed out.
    var lastPeakTime = this.peakTimes[this.peakTimes.length - 1];
    if (lastPeakTime && new Date() - lastPeakTime > this.timeout) {
      // Last detection was over 300ms ago.
      this.state = State.IDLE;
      this.peakTimes = [];
    }
  }

  this.analysePeaks.apply(this);

  if (this.isRunning) {
    requestAnimationFrame(this.loop.bind(this));
  }
};

Listener.prototype.indexToFreq = function(index) {
  var nyquist = this.options.context.sampleRate / 2;
  return nyquist / this.frequencies.length * index;
};

Listener.prototype.freqToIndex = function(frequency) {
  var nyquist = this.options.context.sampleRate / 2;
  return Math.round(frequency / nyquist * this.frequencies.length);
};

Listener.prototype.analysePeaks = function() {
  // Look for runs of repeated characters.
  var character = this.getLastRun();
  if (!character) {
    return;
  }
  console.log('character', character);
  if (this.state == State.IDLE) {
    // If idle, look for start character to go into recv mode.
    if (character == this.options.codec.options.startChar) {
      this.buffer = '';
      this.state = State.RECV;
    }
  } else if (this.state == State.RECV) {
    // If receiving, look for character changes.
    if (character != this.lastChar &&
        character != this.options.codec.options.startChar && character != this.options.codec.options.endChar) {
      this.buffer += character;
      this.lastChar = character;
    }
    // Also look for the end character to go into idle mode.
    if (character == this.options.codec.options.endChar) {
      this.state = State.IDLE;
      this.callbacks.message.apply(null, this.buffer);
      this.buffer = '';
    }
  }
};

Listener.prototype.getLastRun = function() {
  var lastChar = this.peakHistory[this.peakHistory.length - 1];
  var runLength = 0;
  // Look at the peakHistory array for patterns like ajdlfhlkjxxxxxx$.
  for (var i = this.peakHistory.length - 2; i >= 0; i--) {
    var character = this.peakHistory[i]
    if (character == lastChar) {
      runLength += 1;
    } else {
      break;
    }
  }
  if (runLength > this.options.minRunLength) {
    // Remove it from the buffer.
    this.peakHistory.splice(i + 1, runLength + 1);
    return lastChar;
  }
  return null;
};

Listener.prototype.getPeakFrequency = function() {
  // Find where to start.
  var start = this.freqToIndex(this.options.codec.options.minFreq);
  // TODO: use first derivative to find the peaks, and then find the largest peak.
  // Just do a max over the set.
  var max = -Infinity;
  var index = -1;
  for (var i = start; i < this.frequencies.length; i++) {
    if (this.frequencies[i] > max) {
      max = this.frequencies[i];
      index = i;
    }
  }
  // Only care about sufficiently tall peaks.
  if (max > this.options.peakThreshold) {
    return this.indexToFreq(index);
  }
  return null;
};

module.exports = Listener;