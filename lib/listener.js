var AudioContext = window.AudioContext || window.webkitAudioContext;

var _ = require('lodash');
var Promise = require('bluebird');
var Codec = require('./codec.js');