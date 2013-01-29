#!/usr/bin/env node
var irc = require("irc")
var gerrit = require("./gerrit")
var https = require("https")

function log(data) {
    console.log("bot: " + data)
}

var client = new irc.Client("irc.chatspike.net", "qt_gerrit", {
    userName: "qt_gerrit",
    realName: "Qt Project IRC bot",
    port: 6697,
    showErrors: true,
    autoRejoin: true,
    autoConnect: true,
    channels: [ "#qt-gerrit" ],
    secure: true,
    selfSigned: true,
    certExpired: true,
    floodProtection: true,
    floodProtectionDelay: 1000,
    stripColors: true,
    channelPrefixes: "#",
    messageSplit: 400
})

client.addListener('message',  function (from,  to,  message) {
    log(from + ' => ' + to + ': ' + message);

    // jira bugs
    var bugs = message.match(/\b(Q[A-Z]+\-[0-9]+)\b/g)
    if (bugs) {
        bugs.forEach(function(bug) {
            log("https://bugreports.qt-project.org/rest/api/2/issue/" + bug)
            https.get("https://bugreports.qt-project.org/rest/api/2/issue/" + bug, function(res) {
                res.on("data", function(chunk) {
                    //log("BODY for bug " + bug + ": " + chunk);
                    var json
                    try {
                        json = JSON.parse(chunk)
                    } catch (err) {
                        log("Error retrieving " + bug + ", body: " + chunk)
                        return
                    }

                    var bugurl = "https://bugreports.qt-project.org/browse/" + bug
                    client.say(to, from + ": " + json["fields"]["summary"] + " - " + bugurl)
                })
            }).on("error", function(error) {
                log("Error accessing bug " + bug + ": " + error.message)
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

gerrit.on("comment", function(comment) {
    client.say("#qt-gerrit", comment)
})
gerrit.on("merged", function(merged) {
    client.say("#qt-gerrit", merged)
})
gerrit.on("created", function(created) {
    client.say("#qt-gerrit", created)
})
gerrit.on("abandoned", function(abandoned) {
    client.say("#qt-gerrit", abandoned)
})

