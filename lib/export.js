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

  this.exportBuffer = null;

  this.sampleRate = null;

  this.recBuffersL = [];

  this.recBuffersR = [];

  this.recLength = 0;

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
    var inputData = inputBuffer.getChannelData(0);

    this.sampleRate = inputBuffer.sampleRate;

    console.log(this.sampleRate, inputData.length);

    this.recBuffersL.push(inputData);
    this.recBuffersR.push(inputData);
    this.recLength += inputData.length;
    console.log(this.recLength);

    audioProcessEvent.outputBuffer.getChannelData(0).set(inputData);


    // if (this.exportBuffer === null) {
    //   this.exportBuffer = this.context.createBuffer(1, (this.options.characterDuration * this.frequencies.length) * this.sampleRate, this.sampleRate);
    // }
    // var datagrab = inputBuffer.getChannelData(0).subarray(0, inputLength);

    //this.exportBuffer.getChannelData(0).set(datagrab, this.offset);
    //outData.set(datagrab);
    //console.log(this.exportBuffer.getChannelData(0));

    // this.offset += datagrab.length;
    // console.log(this.offset);
  }.bind(this);

  _(this.frequencies).forEach(function(freq, index) {
    var time = parseFloat((this.context.currentTime + this.options.characterDuration * index).toFixed(2));
    this.sendTone(freq, time, this.options.characterDuration);
  }, this);
};

Export.prototype.doExport = function() {
  debugger;
  var sampleRate = this.sampleRate;

  function mergeBuffers(recBuffers, recLength){
    var result = new Float32Array(recLength);
    var offset = 0;
    for (var i = 0; i < recBuffers.length; i++){
      result.set(recBuffers[i], offset);
      offset += recBuffers[i].length;
    }
    return result;
  }

  function interleave(inputL, inputR){
    var length = inputL.length + inputR.length;
    var result = new Float32Array(length);

    var index = 0,
      inputIndex = 0;

    while (index < length){
      result[index++] = inputL[inputIndex];
      result[index++] = inputR[inputIndex];
      inputIndex++;
    }
    return result;
  }

  function floatTo16BitPCM(output, offset, input){
    for (var i = 0; i < input.length; i++, offset+=2){
      var s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
  }

  function writeString(view, offset, string){
    for (var i = 0; i < string.length; i++){
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  function encodeWAV(samples){
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

  var bufferL = mergeBuffers(this.recBuffersL, this.recLength);
  var bufferR = mergeBuffers(this.recBuffersR, this.recLength);
  var interleaved = interleave(bufferL, bufferR);
  var dataview = encodeWAV(interleaved);
  var audioBlob = new Blob([dataview], { type: 'audio/wav' });

  console.log(audioBlob);

  var a = document.createElement('a');
  a.href = window.URL.createObjectURL(audioBlob);
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
