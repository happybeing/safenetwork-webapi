// fetch() for safe:// URIs
//
// TODO support services in exensible way, for example:
//
// RESTful like APIs on SAFE Network services such as
//  safeFetch.['solid'] = new LDP()      // SOLID LPD for safe://solid.<public_name>
//  safeFetch.['short'] = new ShortURL() // RESTful API to create/server shortened URLs safe://short.<public_name>
//

// For now a bare bone proof of concept:

// This is a copy of file-fetch (copy of https://github.com/bergos/file-fetch/blob/master/index.js)
// TODO get something working with this
// TODO modify to use safe: API

const debugSF = require('debug')('safe-fetch')  // Decorate console logging
const safeNetwork = require('safenetwork-solid')      // TODO ???

const concatStream = require('concat-stream')
const contentTypeLookup = require('mime-types').contentType
//const fs = require('fs')
const path = require('path')
const url = require('url')
const Headers = require('node-fetch').Headers
const ReadableError = require('readable-error')

function text (stream) {
  return new Promise((resolve, reject) => {
    stream.pipe(concatStream({
      encoding: 'string'
    }, resolve))
    stream.on('error', reject)
  })
}

function json (stream) {
  return text(stream).then(text => JSON.parse(text))
}

function response (status, body, headers) {
  return {
    status: status,
    headers: new Headers(headers),
    body: body,
    text: text.bind(null, body),
    json: json.bind(null, body)
  }
}

function fetch (iri, options) {
  debugSF.log('fetch('+iri+','+options+')')
  options = options || {}
  options.method = (options.method || 'GET').toUpperCase()
  options.contentTypeLookup = options.contentTypeLookup || contentTypeLookup

  const pathname = decodeURIComponent(url.parse(iri).pathname)

  if (options.method === 'GET') {
    return Promise.resolve(response(200, fs.createReadStream(pathname), {
      'content-type': options.contentTypeLookup(path.extname(pathname))
    }))
  } else if (options.method === 'PUT') {
    return new Promise((resolve) => {
      if (!options.body) {
        return resolve(response(406, new ReadableError(new Error('body required'))))
      }

      options.body.pipe(fs.createWriteStream(pathname)).on('finish', () => {
        resolve(response(201))
      }).on('error', (err) => {
        resolve(response(500, new ReadableError(err)))
      })
    })
  } else {
    return Promise.resolve(response(405, new ReadableError(new Error('method not allowed'))))
  }
}

// TODO implement this SAFE version and use to replace the above

function fetchSafe (iri, options) {
  debugSF.log('fetch('+iri+','+options+')')
  options = options || {}
  options.method = (options.method || 'GET').toUpperCase()
  options.contentTypeLookup = options.contentTypeLookup || contentTypeLookup

  const pathname = decodeURIComponent(url.parse(iri).pathname)

  if (options.method === 'GET') {
    return Promise.resolve(response(200, fs.createReadStream(pathname), {
      'content-type': options.contentTypeLookup(path.extname(pathname))
    }))
  } else if (options.method === 'PUT') {
    return new Promise((resolve) => {
      if (!options.body) {
        return resolve(response(406, new ReadableError(new Error('body required'))))
      }

      options.body.pipe(fs.createWriteStream(pathname)).on('finish', () => {
        resolve(response(201))
      }).on('error', (err) => {
        resolve(response(500, new ReadableError(err)))
      })
    })
  } else {
    return Promise.resolve(response(405, new ReadableError(new Error('method not allowed'))))
  }
}

fetch.Headers = Headers

module.exports = fetch
