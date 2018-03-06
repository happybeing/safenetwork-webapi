/*
 * Local helpers
 */

const isFolder = function (path) {
  return path.substr(-1) === '/'
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
  let hostlen = hostpart(uri).length
  uri = uri.slice(protocol(uri).length)
  if (uri.indexOf('://') === 0) {
    uri = uri.slice(3)
  }
  return docpart(uri.slice(hostlen))
}

const hostpart = function (u) {
  var m = /[^\/]*\/\/([^\/]*)\//.exec(u)
  if (m) {
    return m[1]
  } else {
    return ''
  }
}

const protocol = function (uri) {
  var i
  i = uri.indexOf(':')
  if (i < 0) {
    return null
  } else {
    return uri.slice(0, i)
  }
}

const parentPath = function (path) {
  return path.replace(/[^\/]+\/?$/, '')
}

// Used to cache file info
const Cache = function (maxAge) {
  this.maxAge = maxAge
  this._items = {}
}

// Cache of file version info
Cache.prototype = {
  get: function (key) {
    var item = this._items[key]
    var now = new Date().getTime()
    // Google backend expires cached fileInfo, so we do too
    // but I'm not sure if this is helpful. No harm tho.
    return (item && item.t >= (now - this.maxAge)) ? item.v : undefined
  },

  set: function (key, value) {
    this._items[key] = {
      v: value,
      t: new Date().getTime()
    }
  },

  'delete': function (key) {
    if (this._items[key]) {
      delete this._items[key]
    }
  }
}

/*
 * Adapted from node-solid-server/lib/metadata.js
 */
function Metadata () {
  this.filename = ''
  this.isResource = false
  this.isSourceResource = false
  this.isContainer = false
  this.isBasicContainer = false
  this.isDirectContainer = false
}

/*
* Adapted from node-solid-server/lib/headers.js
*/

function addLink (headers, value, rel) {
  var oldLink = headers.get('Link')
  if (oldLink === undefined) {
    headers.set('Link', '<' + value + '>; rel="' + rel + '"')
  } else {
    headers.set('Link', oldLink + ', ' + '<' + value + '>; rel="' + rel + '"')
  }
}

function addLinks (headers, fileMetadata) {
  if (fileMetadata.isResource) {
    addLink(headers, 'http://www.w3.org/ns/ldp#Resource', 'type')
  }
  if (fileMetadata.isSourceResource) {
    addLink(headers, 'http://www.w3.org/ns/ldp#RDFSource', 'type')
  }
  if (fileMetadata.isContainer) {
    addLink(headers, 'http://www.w3.org/ns/ldp#Container', 'type')
  }
  if (fileMetadata.isBasicContainer) {
    addLink(headers, 'http://www.w3.org/ns/ldp#BasicContainer', 'type')
  }
  if (fileMetadata.isDirectContainer) {
    addLink(headers, 'http://www.w3.org/ns/ldp#DirectContainer', 'type')
  }
}

/*
 * Copied from node-solid-server/lib/utils.js
 */
 /**
  * Composes and returns the fully-qualified URI for the request, to be used
  * as a base URI for RDF parsing or serialization. For example, if a request
  * is to `Host: example.com`, `GET /files/` using the `https:` protocol,
  * then:
  *
  *   ```
  *   getFullUri(req)  // -> 'https://example.com/files/'
  *   ```
  *
  * @param req {IncomingMessage}
  *
  * @return {string}
  */
function getFullUri (req) {
  return getBaseUri(req) + url.resolve(req.baseUrl, req.path)
}

function pathBasename (fullpath) {
  var bname = ''
  if (fullpath) {
    bname = (fullpath.lastIndexOf('/') === fullpath.length - 1)
     ? ''
     : path.basename(fullpath)
  }
  return bname
}

function hasSuffix (path, suffixes) {
  for (var i in suffixes) {
    if (path.indexOf(suffixes[i], path.length - suffixes[i].length) !== -1) {
      return true
    }
  }
  return false
}

function filenameToBaseUri (filename, uri, base) {
  var uriPath = S(filename).strip(base).toString()
  return uri + '/' + uriPath
}

function getBaseUri (req) {
  return req.protocol + '://' + req.get('host')
}

/*
 * npm modules
 */
const path = module.exports.path = require('path')
const S = module.exports.string = require('string')
const url = module.exports.url = require('url')

/*
 * Local helpers
 */
module.exports.isFolder = isFolder
module.exports.docpart = docpart
module.exports.pathpart = pathpart
module.exports.hostpart = hostpart
module.exports.protocol = protocol
module.exports.parentPath = parentPath
module.exports.Cache = Cache

// Adapted/copied from node-solid-server
module.exports.Metadata = Metadata
module.exports.addLink = addLink
module.exports.addLinks = addLinks

module.exports.getFullUri = getFullUri
module.exports.pathBasename = pathBasename
module.exports.hasSuffix = hasSuffix
module.exports.filenameToBaseUri = filenameToBaseUri
module.exports.getBaseUri = getBaseUri
