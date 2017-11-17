//const fileFetch = require('file-fetch')
const httpFetch = require('nodeify-fetch')
const safeFetch = require('safe-fetch')
const protoFetch = require('proto-fetch')

// map protocol to fetch() handler
const fetch = protoFetch({
  file: fileFetch,
  http: httpFetch,
  https: httpFetch,
  safe: safeFetch,
})
