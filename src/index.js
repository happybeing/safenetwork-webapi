/*
//OLD:
// Must set webpack.config output library to SafenetworkLDP
const SafenetworkLDP = require('./safenetwork-solid')

module.exports = SafenetworkLDP
module.exports.SafenetworkLDP = SafenetworkLDP
*/


// NEW:
// Must set webpack.config output library to SafenetworkWebApi
//import * as SafenetworkWebApi from './safenetwork-webapi'

const SafenetworkWebApi = require('./safenetwork-webapi')

exports = module.exports = SafenetworkWebApi
module.exports.SafenetworkWebApi = SafenetworkWebApi
