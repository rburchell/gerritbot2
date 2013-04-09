#!/usr/bin/env node
var irc = require("irc")
var https = require("https")
var config = require("./config")
var log = require("./log.js")
log.areaName = "irc"

var client = new irc.Client(config.ircServer, config.ircNickName, {
    userName: "qt_gerrit",
    realName: "Qt Project IRC bot",
    port: config.ircServerPort,
    password: config.ircServerPassword,
    showErrors: true,
    autoRejoin: true,
    autoConnect: true,
    channels: config.ircChannels,
    secure: config.ircUseSsl,
    selfSigned: true,
    certExpired: true,
    floodProtection: true,
    floodProtectionDelay: 1000,
    stripColors: true,
    channelPrefixes: "#",
    messageSplit: 400
})

client.on('message',  function (from,  to,  message) {
    if (to[0] != '#') {
        // assume it was to us privately, send to 'from'
        to = from
    }

    // jira bugs
    var bugs = message.match(/\b(Q[A-Z]+\-[0-9]+)\b/g)
    if (bugs) {
        bugs.forEach(function(bug) {
            client.emit('bugRequested', from, to, bug)
        })
    }

    var changes = message.match(/(I[0-9a-f]{40})/g)
    if (changes) {
        changes.forEach(function(change) {
            client.emit('changeIdRequested', from, to, change)
        })
    }
});

client.addListener('error', function(message) {
    log.error('irc error: ',  message);
});

module.exports.client = client
