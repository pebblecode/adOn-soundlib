var AudioContext = window.AudioContext || window.webkitAudioContext;

var _ = require('lodash');
var Codec = require('./codec.js');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var status = {
  IDLE: 0,
  EXPORTING: 1,
  DONE: 2
};

var Export = function(config, codec, context) {
  'use strict';

  config = config || {};

  this.options = _.defaults(config, {
    characterDuration: 0.15,
    rampDuration: 0.001,
    bufferSize: 4096,
    inputChannels: 1,
    outputChannels: 1,
    sampleRate: null,
    duration: null,
    length: null
  });

  this.status = status.IDLE;

  this.codec = codec || new Codec();

  this.context = context || new AudioContext();

  this.message = '';

  this.frequencies = [];

  this.charactersSent = 0;

  this.offset = 0;

  this.outputLength = null;

  this.outputBuffer = null;

  return this;
};

util.inherits(Export, EventEmitter);

Export.prototype.exportMessage = function(message, addStops) {

  this.offset = 0;

  this.message = message;

  this.frequencies = this.codec.encodeString(this.message, addStops);

  this.charactersSent = 0;

  this.processor = this.context.createScriptProcessor(this.options.bufferSize, this.options.inputChannels, this.options.outputChannels);

  this.processor.connect(this.context.destination);

  this.processor.onaudioprocess = function(audioProcessEvent) {
    if (this.status === 2) {
      return false;
    }

    var inputBuffer = audioProcessEvent.inputBuffer;
    var inputLength = inputBuffer.length;

    //var outputBuffer = audioProcessEvent.outputBuffer;
    //var outData = outputBuffer.getChannelData(0);

    if (this.outputBuffer === null) {
      this.outputBuffer = this.context.createBuffer(1, (this.options.characterDuration * this.frequencies.length) * inputBuffer.sampleRate, inputBuffer.sampleRate);
    }
    var datagrab = inputBuffer.getChannelData(0).subarray(0, inputLength);

    this.outputBuffer.getChannelData(0).set(datagrab, this.offset);
    //outData.set(datagrab);
    //console.log(this.outputBuffer.getChannelData(0));

    this.offset += datagrab.length;
  }.bind(this);

  _(this.frequencies).forEach(function(freq, index) {
    var time = parseFloat((this.context.currentTime + this.options.characterDuration * index).toFixed(2));
    this.sendTone(freq, time, this.options.characterDuration);
  }, this);
};

Export.prototype.doExport = function() {

  function writeUTFBytes(view, offset, string){
    var lng = string.length;
    for (var i = 0; i < lng; i++){
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  var data = this.outputBuffer.getChannelData(0);
  console.log(data);
  var lng = data.length;

  var buffer = new ArrayBuffer(44 + lng * 2);
  var view = new DataView(buffer);

  writeUTFBytes(view, 0, 'RIFF');
  view.setUint32(4, 44 + lng * 2, true);
  writeUTFBytes(view, 8, 'WAVE');
  // FMT sub-chunk
  writeUTFBytes(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  // stereo (2 channels)
  view.setUint16(22, 2, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, 44100 * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  // data sub-chunk
  writeUTFBytes(view, 36, 'data');
  view.setUint32(40, lng * 2, true);

  // write the PCM samples
  var index = 44;
  var volume = 1;
  for (var i = 0; i < lng; i++){
    view.setInt16(index, data[i] * (0x7FFF * volume), true);
    index += 2;
  }

  // our final binary blob that we can hand off
  var blob = new Blob ( [ view ], { type : 'audio/wav' } );

  console.log(blob);

  var a = document.createElement('a');
  a.href = window.URL.createObjectURL(blob);
  a.download = 'foo.wav';
  a.click();
};

Export.prototype.sendTone = function(freq, startTime, duration) {
  var gainNode = this.context.createGainNode();
  var oscillator = this.context.createOscillator();

  gainNode.gain.value = 0;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(1, startTime + this.options.rampDuration);
  gainNode.gain.setValueAtTime(1, startTime + duration - this.options.rampDuration);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  gainNode.connect(this.processor);

  oscillator.frequency.value = freq;

  oscillator.onended = function() {
    this.charactersSent++;
    this.emit('tone', freq, startTime, duration);

    gainNode.disconnect();
    oscillator.disconnect();

    gainNode = null;
    oscillator = null;
    if (this.charactersSent === this.frequencies.length) {
      this.status = status.DONE;
      this.processor.disconnect();
      this.emit('end', this);
      this.doExport();
    }
  }.bind(this);

  oscillator.connect(gainNode);

  oscillator.start(startTime);
  oscillator.stop(startTime + this.options.characterDuration);
};

module.exports = Export;
