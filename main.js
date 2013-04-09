#!/usr/bin/env node
var irc = require("./irc")
var gerrit = require("./gerrit")
var https = require("https")
var config = require("./config")
var log = require("./log.js")
log.areaName = "main"

irc.client.on('bugRequested', function (from, to, bug) {
    https.get("https://bugreports.qt-project.org/rest/api/2/issue/" + bug, function(res) {
        res.on("data", function(chunk) {
            var json
            try {
                json = JSON.parse(chunk)
            } catch (err) {
                log.error("Error parsing JIRA response for bug " + bug + ", body: " + chunk)
                irc.client.say(to, from + ": Error parsing JIRA response for bug " + bug)
                return
            }

            if (json["errorMessages"]) {
                log.error("Error retrieving " + bug + ", body: " + chunk)
                json["errorMessages"].forEach(function(msg) {
                    log.error("Error in JIRA response for bug " + bug + ": " + msg)
                    irc.client.say(to, from + ": Error from JIRA in response for bug " + bug + ": " + msg)
                })
                return
            }

            if (!json["fields"]) {
                log.error("Malformed response for bug " + bug)
                return
            }

            var bugurl = "https://bugreports.qt-project.org/browse/" + bug
            irc.client.say(to, from + ": " + json["fields"]["summary"] + " - " + bugurl)
        })
    }).on("error", function(error) {
        log.error("Error accessing bug " + bug + ": " + error.message)
    })
})

irc.client.on('changeIdRequested', function (from, to, changeId) {
    irc.client.say(to, "https://codereview.qt-project.org/#q," + change + ",n,z")
})



gerrit.on("comment", function(comment) {
    irc.client.say(config.ircChannels[0], comment)
})
gerrit.on("merged", function(merged) {
    irc.client.say(config.ircChannels[0], merged)
})
gerrit.on("created", function(created) {
    irc.client.say(config.ircChannels[0], created)
})
gerrit.on("abandoned", function(abandoned) {
    irc.client.say(config.ircChannels[0], abandoned)
})

