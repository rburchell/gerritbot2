var ssh = require("ssh2")
var events = require("events")
var irc = require("irc")
var config = require("./config")
var log = require("./log.js")
var sys = require("sys")
log.areaName = "gerrit"

var emitter = new events.EventEmitter

function lookupAuthor(email, name) {
    log.debug("Looking up author for " + email + " " + name)

    if (email == undefined) // apparently email is not mandatory
        return name

    if (email == "qt_sanitybot@qt-project.org")
        return "Qt Sanity Bot"
    else if (email == "ci-noreply@qt-project.org")
        return "Qt CI"
    return email.substring(0, email.indexOf("@"))
}

// bot: data from gerrit: {"type":"comment-added","change":{"project":"test/project","branch":"master","id":"I6431abaee29306dbcb6a04564c832eaac865c177","number":"11693","subject":"test-03","owner":{"name":"Sergio Ahumada","email":"sergio.ahumada@digia.com"},"url":"https://codereview.qt-project.org/11693"},"patchSet":{"number":"1","revision":"d404415faeaea2880ff4f943b4abcf2149ca04b3","ref":"refs/changes/93/11693/1","uploader":{"name":"Sergio Ahumada","email":"sergio.ahumada@digia.com"}},"author":{"name":"Robin Burchell","email":"robin+qt@viroteck.net"},"comment":"test"}

function processComment(msg) {
    var change = msg["change"]
    var owner = lookupAuthor(change["owner"]["email"], change["owner"]["name"])
    var author = lookupAuthor(msg["author"]["email"], msg["author"]["name"])
    var approvals = msg["approvals"] || []
    var approval_str = ""
    var approval_count = 0
    var has_sanity_plusone = false

    for (var i = 0; i < approvals.length; ++i) {
        var reviewtype = ""
        var color = "reset"
        if (approvals[i]["value"] < 0)
            color = "dark_red"
        else if (approvals[i]["value"] > 0)
            color = "dark_green"

        if (approvals[i]["type"] == "SRVW")
            reviewtype += "S"
        else
            reviewtype += "C" // TODO: check explicitly, otherwise doc bot etc may cause issues in the future

        if (approvals[i]["type"] == "SRVW" && author == "Qt Sanity Bot")
            has_sanity_plusone = true

        temp = reviewtype + ": " + approvals[i]["value"]
        approval_str += irc.colors.wrap(color, temp) + " "
        approval_count += 1
    }

    if (approval_count == 1 && has_sanity_plusone == true)
        return // no need to spam sanity +1s

    message = "[" + change["project"] + "/" + change["branch"] + "] "

    if (author == "Qt CI") {
        comment = msg["comment"]
        // special case to detect CI pass/fail;
        // old style includes the same message on every pass, new style includes more
        // information but the first line shall always end with ": SUCCESS" on pass.
        if (comment == "Successful integration\n\nNo regressions!" || comment.search(/^[^\n]+:\sSUCCESS\n/) >= 0)
            message += change["subject"] + " from " + owner + irc.colors.wrap("dark_green", " _PASSED_") + " CI - " + change["url"]
        else
            message += change["subject"] + " from " + owner + irc.colors.wrap("dark_red", " _FAILED_") + " CI - " + change["url"]
    } else {
        message += change["subject"] + " from " + owner + " reviewed by " + author + ": " + approval_str + " - " + change["url"]
    }
    log.info("comment: " + message)
    emitter.emit("comment", message);
}

function processMerged(msg) {
    var change = msg["change"]

    var owner = lookupAuthor(change["owner"]["email"], change["owner"]["name"])
    var submitter = lookupAuthor(msg["submitter"]["email"], msg["submitter"]["name"])
    var message = "[" + change["project"] + "/" + change["branch"] + "] "

    message += change["subject"] + " from " + owner + " staged by " + submitter + " - " + change["url"]
    log.info("merged: " + message)
    emitter.emit("merged", message);
}

function processCreated(msg) {
    var change = msg["change"]
    var owner = lookupAuthor(change["owner"]["email"], change["owner"]["name"])
    var message = "[" + change["project"] + "/" + change["branch"] + "] "

    if (msg["patchSet"]["number"] == "1")
        message += change["subject"] + " pushed by " + owner + " - " + change["url"]
    else
        message += change["subject"] + " updated to v" + msg["patchSet"]["number"] + " by " + owner + " - " + change["url"]

    log.info("created: " + message)
    emitter.emit("created", message);
}

// main: ERROR: Unknown type from gerrit: {"type":"change-deferred","change":{"project":"qt/qtbase","branch":"dev","id":"I03c19d622bf3c3289cd16482cff704489de7a015","number":"74473","subject":"WIP: Utility for generating Qt Appx Frameworks","owner":{"name":"Andrew Knight","email":"andrew.knight@digia.com"},"url":"https://codereview.qt-project.org/74473"},"deferrer":{"name":"Andrew Knight","email":"andrew.knight@digia.com"},"reason":""}
function processDeferred(msg) {
    var change = msg["change"]
    var owner = lookupAuthor(change["owner"]["email"], change["owner"]["name"])
    var deferrer = lookupAuthor(msg["deferrer"]["email"], msg["deferrer"]["name"])
    var message = "[" + change["project"] + "/" + change["branch"] + "] "

    message += change["subject"] + " from " + owner + " deferred by " + deferrer + " - " + change["url"]
    log.info("deferred: " + message)
    emitter.emit("deferred", message)
}

// main: ERROR: Unknown type from gerrit: {"type":"change-restored","change":{"project":"qt/qtwayland","branch":"stable","id":"Ie9ad14b8d8230cfd3b2772511b853d71f2eed977","number":"79284","subject":"Error out if dependencies aren\u0027t met.","owner":{"name":"Robin Burchell","email":"robin+qt@viroteck.net"},"url":"https://codereview.qt-project.org/79284"},"restorer":{"name":"Robin Burchell","email":"robin+qt@viroteck.net"},"reason":"sorry for the noise"}
function processRestored(msg) {
    var change = msg["change"]
    var owner = lookupAuthor(change["owner"]["email"], change["owner"]["name"])
    var restorer = lookupAuthor(msg["restorer"]["email"], msg["restorer"]["name"])
    var message = "[" + change["project"] + "/" + change["branch"] + "] "

    message += change["subject"] + " from " + owner + " restored by " + restorer + " - " + change["url"]
    log.info("restored: " + message)
    emitter.emit("restored", message)
}

// gerrit: Unknown type from gerrit: {"type":"change-abandoned","change":{"project":"qt/qtbase","branch":"dev","id":"I685c2ea91dbc6ab18b063bb7e8f0f50fbfa686ac","number":"45686","subject":"Window activation: support new focus reason: Qt::InputPanelFocusReason","owner":{"name":"Richard Moe Gustavsen","email":"richard.gustavsen@digia.com"},"url":"https://codereview.qt-project.org/45686"},"abandoner":{"name":"Richard Moe Gustavsen","email":"richard.gustavsen@digia.com"},"reason":""}
function processAbandoned(msg) {
    var change = msg["change"]
    var owner = lookupAuthor(change["owner"]["email"], change["owner"]["name"])
    var abandoner = lookupAuthor(msg["abandoner"]["email"], msg["abandoner"]["name"])
    var message = "[" + change["project"] + "/" + change["branch"] + "] "

    message += change["subject"] + " from " + owner + " abandoned by " + abandoner + " - " + change["url"]
    log.info("abandoned: " + message)
    emitter.emit("abandoned", message)
}

// a cheat
ssh.prototype.easyConnect = function() {
    this.connect({
        host: "codereview.qt-project.org",
        port: 29418,
        username: 'w00t',
        privateKey: require('fs').readFileSync(config.gerritSshKey),
        pingInterval: 40000
    });
}

function redo() {
    var gerrit = new ssh;

    gerrit.on('connect', function() {
        log.info("Gerrit connected");
    });
    gerrit.on('ready', function() {
        gerrit.exec('gerrit stream-events', function(err, stream) {
            log.debug("Requesting event stream")
            if (err) {
                log.error("Error from Gerrit stream-events: " + err + " - ending")
                gerrit.end()
                return
            }

            log.debug("Streaming events from Gerrit");
            stream.on('data', function(data, extended) {
                log.debug(data)
                try {
                    var msg = JSON.parse(data)
                } catch (err) {
                    log.error("Gerrit returned malformed json")
                    gerrit.end();
                    return
                }
                if (msg["type"] == "comment-added")
                    processComment(msg)
                else if (msg["type"] == "change-merged")
                    processMerged(msg)
                else if (msg["type"] == "patchset-created")
                    processCreated(msg)
                else if (msg["type"] == "change-deferred")
                    processDeferred(msg)
                else if (msg["type"] == "change-abandoned")
                    processAbandoned(msg)
                else if (msg["type"] == "change-restored")
                    processRestored(msg)
                else if (msg["type"] == "ref-updated")
                    ; // ignore
                else
                    log.error("Unknown type from gerrit: " + data)

            });
            stream.on('end', function() {
                log.info("Stream disconnected, ending, COMMENTED OUT");
            });
            stream.on('exit', function(code, signal) {
                log.info('Stream exit :: code: ' + code + ', signal: ' + signal);
                gerrit.end();
            });
        });
    });
    gerrit.on('error', function(err) {
        log.error('Connection error: ' + err);
    });
    gerrit.on('close', function(had_error) {
        log.error('Connection Closed, reconnecting');
        setTimeout(redo, 5000);
    });

    gerrit.easyConnect()
}

redo();

module.exports = emitter
