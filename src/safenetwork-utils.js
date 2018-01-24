

// Local helpers
const isFolder = function (path) {
  return path.substr(-1) === '/';
}

// Strip fragment for URI (removes everything from first '#')
const docpart = function (uri) {
  var i
  i = uri.indexOf('#')
  if (i < 0) {
    return uri
  } else {
    return uri.slice(0, i)
  }
}

// Return full document path from root (strips host and fragment)
const pathpart = function (uri) {
  let prePath = hostpart(uri)
  return docpart(uri.slice( prePath.length ))
}

const hostpart = function (u) {
  var m = /[^\/]*\/\/([^\/]*)\//.exec(u)
  if (m) {
    return m[1]
  } else {
    return ''
  }
}

const  protocol = function (uri) {
  var i
  i = uri.indexOf(':')
  if (i < 0) {
    return null
  } else {
    return uri.slice(0, i)
  }
}

const parentPath = function (path) {
  return path.replace(/[^\/]+\/?$/, '');
}

module.exports.isFolder = isFolder
module.exports.docpart = docpart
module.exports.pathpart = pathpart
module.exports.hostpart = hostpart
module.exports.protocol = protocol
module.exports.parentPath = parentPath
