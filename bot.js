#!/usr/bin/env node
var irc = require("irc")
var gerrit = require("./gerrit")
var https = require("https")
var config = require("./config")
var log = require("./log.js")
log.areaName = "bot"

var client = new irc.Client(config.ircServer, "qt_gerrit", {
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

client.addListener('message',  function (from,  to,  message) {
    log.debug(from + ' => ' + to + ': ' + message);

    // jira bugs
    var bugs = message.match(/\b(Q[A-Z]+\-[0-9]+)\b/g)
    if (bugs) {
        bugs.forEach(function(bug) {
            log.debug("https://bugreports.qt-project.org/rest/api/2/issue/" + bug)
            https.get("https://bugreports.qt-project.org/rest/api/2/issue/" + bug, function(res) {
                res.on("data", function(chunk) {
                    //log.debug("BODY for bug " + bug + ": " + chunk);
                    var json
                    try {
                        json = JSON.parse(chunk)
                    } catch (err) {
                        log.error("Error retrieving " + bug + ", body: " + chunk)
                        return
                    }

                    if (!json["fields"]) {
                        log.error("Malformed response for bug " + bug)
                        return
                    }

                    var bugurl = "https://bugreports.qt-project.org/browse/" + bug
                    client.say(to, from + ": " + json["fields"]["summary"] + " - " + bugurl)
                })
            }).on("error", function(error) {
                log.error("Error accessing bug " + bug + ": " + error.message)
            })
        })
    }

    var changes = message.match(/(I[0-9a-f]{40})/g)
    if (changes) {
        changes.forEach(function(change) {
            client.say(to, "https://codereview.qt-project.org/#q," + change + ",n,z")
        })
    }
});

client.addListener('error', function(message) {
    log.error('irc error: ',  message);
});

gerrit.on("comment", function(comment) {
    client.say(config.ircChannels[0], comment)
})
gerrit.on("merged", function(merged) {
    client.say(config.ircChannels[0], merged)
})
gerrit.on("created", function(created) {
    client.say(config.ircChannels[0], created)
})
gerrit.on("abandoned", function(abandoned) {
    client.say(config.ircChannels[0], abandoned)
})

