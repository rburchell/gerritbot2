var areaName = "(undefined)"

module.exports.areaName = areaName

module.exports.debug = function(msg) {
    console.log(module.exports.areaName + ": DEBUG: " + msg)
}

module.exports.log = module.exports.info = function(msg) {
    console.log(module.exports.areaName + ": " + msg)
}

module.exports.warn = function(msg) {
    console.log(module.exports.areaName + ": WARN: " + msg)
}

module.exports.error = function(msg) {
    console.log(module.exports.areaName + ": ERROR: " + msg)
}

