#!/usr/bin/env node
var irc = require("./irc")
var gerrit = require("./gerrit")
var https = require("https")
var config = require("./config")
var log = require("./log.js")
log.areaName = "main"

irc.client.on('bugRequested', function (from, to, bug) {
    var receivedData = ""
    https.get("https://bugreports.qt.io/rest/api/2/issue/" + bug, function(res) {
        res.on("data", function(chunk) {
            receivedData += chunk
        })

        res.on("end", function() {
            var json
            try {
                json = JSON.parse(receivedData)
            } catch (err) {
                log.error("Error parsing JIRA response for bug " + bug + ", body: " + receivedData)
                irc.client.say(to, from + ": Error parsing JIRA response for bug " + bug)
                return
            }

            if (json["errorMessages"]) {
                log.error("Error retrieving " + bug + ", body: " + receivedData)
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

            // TODO: parse person the message is going to, and direct the reply
            // to them
            // [12:05:11] <ossi|tt> w00t: because then it's fairly trivial to do
            // that user addressing thing: m/^([^ ]+)[:, >] /; match $1 against
            // the nicklist to eliminate false positives, done.
            var bugurl = "https://bugreports.qt.io/browse/" + bug
            irc.client.say(to, json["fields"]["summary"] + " - " + bugurl)
        })
    }).on("error", function(error) {
        log.error("Error accessing bug " + bug + ": " + error.message)
    })
})

irc.client.on('changeIdRequested', function (from, to, changeId) {
    var receivedData = ""
    https.get("https://codereview.qt-project.org/changes/" + changeId, function(res) {
        res.on("data", function(chunk) {
            receivedData += chunk
        })

        res.on("end", function() {
            // From the Gerrit documentation:
            // To prevent against Cross Site Script Inclusion (XSSI) attacks, the JSON
            // response body starts with a magic prefix line that must be stripped before
            // feeding the rest of the response body to a JSON parser:
            //    )]}'
            //    [ ... valid JSON ... ]
            var lines = receivedData.split('\n');
            lines.splice(0,1);
            receivedData = lines.join('\n');

            var json
            try {
                json = JSON.parse(receivedData)
            } catch (err) {
                log.error("Error parsing Gerrit response for change " + changeId + ", body: " + receivedData)
                irc.client.say(to, from + ": Error parsing JIRA response for change " + changeId)
                return
            }

            /*
            {
                    "kind": "gerritcodereview#change",
                    "id": "qt-creator%2Fqt-creator~master~Iac6c9fe1ada27ac0d96417e490cc5723e6969541",
                    "project": "qt-creator/qt-creator",
                    "branch": "master",
                    "change_id": "Iac6c9fe1ada27ac0d96417e490cc5723e6969541",
                    "subject": "C++: move post-sourceprocessing action into callback.",
                    "status": "MERGED",
                    "created": "2014-06-06 12:41:43.937000000",
                    "updated": "2014-06-18 09:04:35.443000000",
                    "_sortkey": "002dd7e0000153d5",
                    "_number": 86997,
                    "owner": {
                            "name": "Erik Verbruggen"
                    }
            }
            */

            if (!json["id"]) {
                log.error("Malformed response for change " + changeId)
                return
            }

            irc.client.say(to, "[" + json["project"] + "/" + json["branch"] + "] " + json["subject"] +
                               " from " + json["owner"]["name"] + " https://codereview.qt-project.org/" + json["_number"] + " (" + json["status"] + ")")
        })
    }).on("error", function(error) {
        log.error("Error accessing change " + changeId + ": " + error.message)
    })
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
gerrit.on("deferred", function(deferred) {
    irc.client.say(config.ircChannels[0], deferred)
})
gerrit.on("restored", function(restored) {
    irc.client.say(config.ircChannels[0], restored)
})
gerrit.on("mergeFailed", function(merger) {
    irc.client.say(config.ircChannels[0], merger)
})
