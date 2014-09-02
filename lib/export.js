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
    inputChannels: 2,
    outputChannels: 2,
    sampleRate: null,
    duration: null,
    length: null,
    playOutput: true
  });

  this.status = status.IDLE;

  this.codec = codec || new Codec();

  this.context = context || new AudioContext();

  this.message = '';

  this.frequencies = [];

  this.charactersSent = 0;

  this.recBuffersL = null;

  this.recBuffersR = null;

  this.recLength = 0;

  this.highPassFilter = null;

  this.lowPassFilter = null;

  this.peakingFilter = null;

  return this;
};

util.inherits(Export, EventEmitter);

Export.prototype.exportMessage = function(message, addStops) {

  this.message = message;

  this.frequencies = this.codec.encodeString(this.message, addStops);

  this.recBuffersL = new Float32Array(4096 * this.frequencies.length * 2);
  this.recBuffersR = new Float32Array(4096 * this.frequencies.length * 2);

  this.charactersSent = 0;

  // We only allow sound above our min frequency through
  this.highPassFilter = this.context.createBiquadFilter();
  this.highPassFilter.type = 'highpass';
  this.highPassFilter.frequency.value = this.codec.options.minFreq - this.codec.options.errorMargin;

  // We only allow sound below our max filter through
  this.lowPassFilter = this.context.createBiquadFilter();
  this.lowPassFilter.type = 'lowpass';
  this.lowPassFilter.frequency.value = this.codec.options.maxFreq + this.codec.options.errorMargin;

  // From our central frequency we boost the peaks of our frequencies
  this.peakingFilter = this.context.createBiquadFilter();
  this.peakingFilter.type = 'peaking';
  this.peakingFilter.frequency.value = (this.codec.options.minFreq + this.codec.options.maxFreq) / 2;

  this.processor = this.context.createScriptProcessor(this.options.bufferSize, this.options.inputChannels, this.options.outputChannels);

  this.highPassFilter.connect(this.lowPassFilter);
  this.lowPassFilter.connect(this.peakingFilter);
  this.peakingFilter.connect(this.processor);
  this.processor.connect(this.context.destination);

  this.processor.onaudioprocess = function(audioProcessEvent) {
    if (this.status === 2) {
      return false;
    }

    var inputBuffer = audioProcessEvent.inputBuffer;
    var inputData1 = inputBuffer.getChannelData(0);
    var inputData2 = inputBuffer.getChannelData(1);

    this.recBuffersL.set(inputData1, this.recLength);
    this.recBuffersR.set(inputData2, this.recLength);
    this.recLength += inputData1.length;
  
    if (this.options.playOutput) {
      audioProcessEvent.outputBuffer.getChannelData(0).set(inputData1);
      audioProcessEvent.outputBuffer.getChannelData(1).set(inputData2);
    }
  }.bind(this);

  _(this.frequencies).forEach(function(freq, index) {
    var time = parseFloat((this.context.currentTime + this.options.characterDuration * index).toFixed(2));
    this.sendTone(freq, time, this.options.characterDuration);
  }, this);
};

Export.prototype.doExport = function() {

  var sampleRate = this.context.sampleRate;

  /**
   *  Function takes 2 Float32Array and creates an interleaved
   *  new Float32Array where each member is placed in series
   */
  function interleave(inputL, inputR) {
    var length = inputL.length + inputR.length;
    var result = new Float32Array(length);

    var index = 0;
    var inputIndex = 0;

    while (index < length) {
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  function floatTo16BitPCM(output, offset, input) {
    for (var i = 0; i < input.length; i++, offset+=2) {
      var s = Math.max(-1, Math.min(1, input[i]));
      data = s < 0 ? parseInt(s * 0x8000) : parseInt(s * 0x7FFF);
      output.setInt16(offset, data, true);
    }
  }

  function writeString(view, offset, string) {
    for (var i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function encodeWAV(samples) {
    var buffer = new ArrayBuffer(44 + samples.length * 2);
    var view = new DataView(buffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 32 + samples.length * 2, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 2, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 4, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 4, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, samples.length * 2, true);

    floatTo16BitPCM(view, 44, samples);

    return view;
  }

  var channelData = interleave(this.recBuffersL, this.recBuffersR);
  var WAVData = encodeWAV(channelData);
  var audioBlob = new Blob([WAVData], { type: 'audio/wav' });

  this.emit('export', audioBlob);
};

Export.prototype.sendTone = function(freq, startTime, duration) {
  var gainNode = this.context.createGain();
  var oscillator = this.context.createOscillator();

  gainNode.gain.value = 0;
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(1, startTime + this.options.rampDuration);
  gainNode.gain.setValueAtTime(1, startTime + duration - this.options.rampDuration);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
  gainNode.connect(this.highPassFilter);

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
