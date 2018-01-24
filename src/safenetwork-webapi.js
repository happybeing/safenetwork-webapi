/**
 * safenetwork-webapi.js - API public names and web style SAFEnetwork services
 *
 *  TODO temporarily in solid-safenetwork until extracted to safenetwork-webapi
 */

// TODO This is largely placeholder code for now
// Plan is to test the SAFE services part while still part of solid-safenetwork.js
// so as to speed up the SOLID+SAFE proof of concept (solid-plume), then extract
// into a generic SAFE Web API module assuming the spec (above) isn't shot down

// TODO implement SafeWeb
// TODO implement Services class (service manager accessed as safeWeb.Services)
// TODO implement ServiceImplementation template (was ServiceInterface)
// TODO implement serviceLDP (extend ServiceInterface based on SafenetworkLDP)
// TODO move this to its own module and have safenetwork-solid.js us it for LDP

const safeLog = require('debug')('safe:web')  // Decorated console output

const SN_TAGTYPE_SERVICES = 15001 // TODO get this from the API

const SN_TAGTYPE_LDP  = 80655     // Linked Data Protocol service (timbl's dob)

const safeUtils = require('./safenetwork-utils')

const isFolder = safeUtils.isFolder
const docpart = safeUtils.docpart
const pathpart = safeUtils.pathpart
const hostpart = safeUtils.hostpart
const protocol = safeUtils.protocol
const parentPath = safeUtils.parentPath

/*
 * Web API for SAFEnetwork
 * - public IDs
 * - web services (extendable through implementation modules)
 *
 * @Params
 *  appHandle - SAFE API app handle or null
 *
 */
var SafeWeb = function (appHandle) {
  this.setSafeApi(appHandle)
}

SafeWeb.prototype = {
  // Application must set/refresh the SAFE API handles if they become invalid:
  setSafeApi: function (appHandle){
      this._appHandle = appHandle   // SAFE API application handle
      this._services = {}           // Map of fulldomain (profile.public-name) to service instance

      // TODO if necessary, update/reset managed objects such as MDs
  },

  // For access to SAFE API:
  appHandle: function (){ return this._appHandle },

  /*
   * SAFE Services API
   */

  // get a service object for the full domain portion of the URI (will create the service if necessary)
  //
  // @param a valid safe:// style URI
  // @returns a promise which evaluates to a ServiceInterface which supports fetch() operations
  getServiceForUri: async function (uri){
      return new Promise(async (resolve,reject) => {
        try {
          let fullDomain = hostpart(uri)
          if (this._services[fullDomain] != undefined)
            return resolve(_services[fullDomain]) // Already initialised

          // Lookup the service on this fullDomain: profile.public-name
          let profile = fullDomain.split('.')[0]
          let publicName = fullDomain.split('.')[1]

          // Get the services MD for publicName
          return this.getServicesMdFor(publicName)
          .then((servicesMd) => {
            /* TODO
            ??? oops I need a separate thing to create a service on a given profile.public-name
            ??? I was going to imply the service from 'profile' but not any more
            ??? so need that to be controlled by the app using a createNewService(profile,publicName)
            // TODO So here we can only succeed if the servicesMd for publicName has a service setting for profile
            ???
            MAYBE TIME TO SKETCH THIS OUT ON PAPER - BOTH A FINAL AND INTERIM DESIGN VERSIONS
            */
          }).catch( (err) => {
            // TODO What if there's no services MD?
            // ??? I think this is now an error
          });
        }
        catch (err) {
          safeLog('getServiceForUri(%s) FAILED: %s', uri, err)
          return reject(err)
        }
      });
  },

  // TODO maybe provide methods to create/delete/enumerate public names & services

  //// Interfaces ////
  //
  // These could be split into separate objects but to start SafeWeb API
  // does the lot.
  //
  // We do though wrap each service up in a ServiceInterface object.
  //
  // Some functions are available without authentication, but
  // some require the user to be logged in and have adequate
  // permissions for the underlying SAFE API operations.

  //// Public Names (aka 'public IDs' & 'domains')
  // TODO:
  // - List existing public names
  // - Get/set public name info (not sure what yet!)
  // - Create public name

  ////// TODO debugging helpers (to remove):
  listContainer: async function (containerName){
    safeLog('listContainer(%s)...',containerName)
    let mdHandle = await window.safeApp.getContainer(this.appHandle(), containerName)
    safeLog(containerName + " ----------- start ----------------")
    await this.listMd(mdHandle)
    safeLog(containerName + "------------ end -----------------")
  },

  listMd: async function (mdHandle){
    let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
    await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
      safeLog('Key: ', k.toString())
      safeLog('Value: ', v.buf.toString())
      safeLog('Version: ', v.version)
    });
  },
  ////// END of debugging helpers

  // Get the key/value of a public name's entry in the _publicNames container
  //
  // User must:
  //  - be logged into the account owning the public name for this to succeed.
  //  - authorise the app to 'Read' _publicNames on this account.
  //
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the key and value
  // The returned object is null on failure, or contains:
  //  - a 'key' of the format: '_publicNames/<public-name>'
  //  - a 'value', the XOR name of the services entry MD for the public name
  getPublicNameEntry: async function (publicName){
    safeLog('getPublicNameEntry(%s)...', publicName)
    return new Promise(async (resolve,reject) => {
      try {
        // TODO wrap access to some MDs (eg for _publicNames container) in a getter that is passed permissions
        // TODO checks those permissions, gets the MD, and caches the value, or returns it immediately if not null
        let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
        let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd)
        let entryKey = this.makePublicNamesEntryKey(publicName)
        return resolve({
          key:    entryKey,
          value:  await window.safeMutableDataEntries.get(entriesHandle, entryKey)
        })
      } catch(err){
        safeLog('getPublicNameEntry() WARNING no _publicNames entry found for: %s', publicName)
        return reject(err)
      }
    });
  },

  // Get mutable data handle for MD hash
  //
  // @param hash
  // @param tagType
  //
  // @returns a promise which resolves to an MD handle
  getMdFromHash: async function (hash,tagType){
    safeLog('getMdFromHash(%s,%s)...',hash,tagType)
    return new Promise(async (resolve,reject) => {
      try {
        return window.safeMutableData.newPublic(this.appHandle(),hash,tagType)
        .then((mdHandle) => resolve(mdHandle));
      } catch(err){
        safeLog('getMdFromHash() ERROR: %s', err)
        reject(err)
      }
    });
  },

  // Create/reserve a new public name
  //
  // This includes creating a new services MD and inserting it into the _publicNames container
  //
  // User must be logged in
  // User must authorise the app to 'Read' and 'Insert' _publicNames on this account
  //
  // Fails if it finds there is already a _publicNames entry, otherwise it
  // creates a new services MD for the public name, and inserts it.
  //
  // Fails if it can't create the services MD because it already exists, which implies that
  // the public name is already taken. You could pre-check for this using getServicesMdFor().
  //
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the new entry's key, value and handle:
  //  - key:      of the format: '_publicNames/<public-name>'
  //  - value:    the XOR name of the services entry MD for the public name
  //  - mdHandle: the handle of the newly created services MD
  createPublicName: async function (publicName){
    safeLog('createPublicName(%s)...', publicName)
    return new Promise(async (resolve,reject) => {
      try {
        // Check for an existing entry (before creating services MD)
        try {
          let entry = await this.getPublicNameEntry(publicName)
          return reject('Can\'t create _publicNames entry, already exists for %s', publicName) // Entry already exists, so exit early
        } catch (err) {} // No existing entry, so ok...

        // Create a new services MD (fails if the publicName is taken)
        let servicesMdName = await this.makeServicesMdName(publicName)
        let servicesMd = await window.safeMutableData.newPublic(this.appHandle(), servicesMdName, SN_TAGTYPE_SERVICES)

        // TODO remove (test only):
        await window.safeMutableData.getNameAndTag(servicesMd)
        .then((r) => safeLog('New Public servicesMd created with tag: ', r.tag, ' and name: ', r.name.buffer));

        let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
        let entryKey = this.makePublicNamesEntryKey(publicName)
        let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd)
        let mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle)
        await window.safeMutableDataMutation.insert(mutationHandle,entryKey,servicesMdName)
        return window.safeMutableData.applyEntriesMutation(publicNamesMd, mutationHandle).then(async _ => {
          safeLog('New _publicNames entry created for %s', publicName);
          resolve({
            key:            entryKey,
            value:          servicesMdName,
            servicesHandle: servicesMd,
          })
        });
      } catch (err) {
        safeLog('createPublicNameEntry() failed: ', err)
        reject(err)
      }
    });

  },

  // Helper to create the services MD name corresponding to a public name
  //
  // Standardised naming makes it possile to retrieve services MD for any public name.
  //
  // See final para: https://forum.safedev.org/t/container-access-any-recent-dom-api-changes/1314/13?u=happybeing
  //
  // @param publicName
  //
  // @returns the XOR name as a String, for the services MD unique to the given public name
  makeServicesMdName: async function (publicName){
    return window.safeCrypto.sha3Hash(this._appHandle,publicName)
  },

  // Helper to create the key for looking up a public name entry in the _publicNames container
  //
  // @param publicName
  //
  // @returns the key as a string, corresponding to the public name's entry in _publicNames
  makePublicNamesEntryKey: function (publicName){
    return '_publicNames/' + publicName
  },

  // Get the services MD for any public name, even ones you don't own
  //
  // This is always public, so no need to be logged in or own the public name.
  //
  // @param publicName
  //
  // @returns promise which resolves to the services MD of the given name
  getServicesMdFor: async function (publicName){
    safeLog('getServicesMdFor(%s)',publicName)
    return new Promise(async (resolve,reject) => {
      try {
        let servicesName = await this.makeServicesMdName(publicName)
        return window.safeMutableData.newPublic(servicesName,SN_TAGTYPE_SERVICES)
        .then((mdHandle) => {
            safeLog('Look up SUCCESS for MD XOR name: ' + servicesName)
            resolve(mdHandle)
        });
      } catch (err) {
        safeLog('Look up FAILED for MD XOR name: ' + this.makeServicesMdName(publicName))
        safeLog('getServicesMdFor ERROR: ', err)
        reject(err)
      }
    });
  },

  // Get the services MD for a given public name (which you must own)
  //
  // User must be logged into the account owning the public name for this to succeed.
  // User must authorise the app to 'Read' _publicNames on this account
  //
  // @param publicName
  //
  // @returns promise which resolves to the services MD of the given name
  getServicesMdFromContainers: async function (publicName){
    safeLog('getServicesForMy(%s)',publicName)
    const self = this
    return new Promise((resolve,reject) => {
      try {
        let nameKey = this.makePublicNamesEntryKey(publicName)
        window.safeApp.getContainer(this.appHandle(), '_publicNames')
        .then((mdHandle) => {
          safeLog("_publicNames ----------- start ----------------")
          return window.safeMutableData.getEntries(mdHandle)
         .then((entriesHandle) => window.safeMutableDataEntries
         .forEach(entriesHandle, (k, v) => {
            safeLog('Key: ', k.toString())
            safeLog('Value: ', v.buf.toString())
            safeLog('Version: ', v.version)
            if ( k == nameKey ){
              safeLog('Key: ' + nameKey + '- found')
              resolve(v.buf)
            }
          }).then(_ => {
            safeLog('Key: ' + nameKey + '- NOT found')
            reject('No _publicNames entry for public name')
          })
          );
        });
      } catch (err) {
        safeLog('getServicesMdFromContainers ERROR: ', err)
        reject(err)
      }
    });
  },

///////// TODO START move to Service class/implementation, as the service needs to create a suitably named public container for its entry

  // Initialise a service on a given services MD. If necessary creates an entry in the services MD
  //
  // @param serviceSettings an object with properties:
  //  publicName:    publicName on which this service is active
  //  servicesMd:    MD handle for the services of a public name (ie a _publicNames entry value)
  //  servicePrefix: string identifier for the service (used as a prefix to a domain)
  //  serviceTag:    numeric identifier for the service
  //  serviceKey:    the entry key for this service in servicesMd
  //  serviceValue:  service specific implementation (e.g. for www, it will identify a container in _public)
  // @param overwrite     [defaults to false] if the service has an entry that does not match, set this 'true' to overwrite
  //
  // @returns a promise which resolves to true if it succeeded in creating or updating to the given settings, false if a suitable entry already exists

  // TODO this belongs in ServiceInterface now! May need some tweaking (e.g. service would call this with a newly created serviceValue after having checked it doesn't already have a suitable entry, by calling this with 'overwrite:true')
  InitialiseServiceEntry: async function (serviceSettings,overwrite){
    safeLog('InitialiseServiceEntry(%o,%s)...',serviceSettings,overwrite)
    if (overwrite == undefined){
      const overwrite = false
    }

    return new Promise(async (resolve,reject) =>{
      try {
        let entriesHandle = await window.safeMutableData.getEntries(serviceSettings.servicesMd)
        try {
          return window.safeMutableDataEntries.get(entriesHandle,serviceSettings.serviceKey).then(async (value) => {
            // An entry exists for servicePrefix
            if (overwrite){
              safeLog("Initialise service entry WARNING: service entry exists for key '%s', no action taken", serviceSettings.serviceKey )
              resolve(false)
            }
            else {
              let mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle)
              await window.safeMutableDataMutation.update(mutationHandle,serviceSettings.serviceKey,serviceSettings.serviceValue)
              return window.safeMutableData.applyEntriesMutation(serviceSettings.servicesMd, mutationHandle)
              .then(_ => {
                  window.safeMutableDataMutation.free(mutationHandle)
                  resolve(true)
              });
            }
          }),(async _ =>{
            // No entry exists, so insert one
            let mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle)
            await window.safeMutableDataMutation.insert(mutationHandle,serviceSettings.serviceKey,serviceSettings.serviceValue)
            return window.safeMutableData.applyEntriesMutation(serviceSettings.servicesMd, mutationHandle)
            .then(async _ => {
                window.safeMutableDataMutation.free(mutationHandle)
                resolve(true)
            });
          });
        } catch (err) {
          safeLog('InitialiseServiceEntry() WARNING: %s', err)
          resolve(false)
        }
      } catch (err) {
        safeLog('InitialiseServiceEntry() FAILED: ', err)
        reject(err)
      }
    });
  },

  // Helper to create the key for looking up a public name entry in the _publicNames container
  //
  // @param publicName
  // @param servicePrefix
  //
  // @returns the key as a string, corresponding to a service entry in a servicesMD
  makeServiceEntryKey(publicName,servicePrefix){
    return (publicName + '@' + servicePrefix)
  },

//////// TODO END of 'move to Service class/implementation'

  // TODO prototyping only for now:
  testsNoAuth: function (){
    safeLog('testsNoAuth() called!')
  },

  // TODO prototyping only for now:
  testsAuth: async function (publicHandle,nfsHandle){
    safeLog('>>>> testsAuth(%o,%o)', publicHandle, nfsHandle)

    try {
      /*
       let authUri = await window.safeApp.authoriseContainer(this.appHandle(),
                                  { _publicNames: ['Read','Insert','Update'] })

      safeLog('App was authorised and auth URI received: ', authUri)
      */


      safeLog('TEST START create public name')
      await this.listContainer('_publicNames')
      // NOTES:
      //  testname1 has an entry in _publicNames - possibly an invalid services MD
      //  testname2 has an entry in _publicNames (create successful)
//      await this.createPublicName('testname2')
      await this.listContainer('_publicNames')
      safeLog('TEST END')

      /* TODO this should really be part of the ServiceInterface object:
          const publicName = 'solidpoc5'
          let serviceSettings = {
            publicName:    publicName,
            servicesMd:    servicesMd, ???
            servicePrefix: ldpServiceConfig.uriPrefix,
            serviceTag:    ldpServiceConfig.tagType,
            serviceKey:    makeServiceEntryKey(publicName,ldpServiceConfig.uriPrefix)
            serviceValue:  '', ???
          }
          this.InitialiseServiceEntry(serviceSettings)
          */

    } catch (err) {
      safeLog('Error: ', err)
    }

   },

   //// SAFE Web Services
   // TODO:
   // - List implemented services
   // - Get/set service implementation (by prefix/tag type)
   //
   // - For a given public name:
   //   - list its services
   //   - find active service by prefix/tag type
   //   - create/modify active service
   //   - access service features (GET,PUT,POST,DELETE,HEAD,OPTIONS etc)

};

/*
 * Service interface template for each service implementation
 *
 * DRAFT spec: https://forum.safedev.org/t/safe-services-npm-module/1334
 */
var ServiceInterface = function (safeWeb,serviceConfig) {
  this._safeWeb =       safeWeb
  this._serviceConfig = serviceConfig

}

ServiceInterface.prototype = {
  // SAFE Web Service
  //
  // This is a template API which will be supported by an implementation
  // object for each SAFE Web service.
  //
  // An application can add a service or modify an existing service by
  // providing an implementation that follows this template, and adding
  // it to the SafeWebApi object.

  /*
   ??? write code to support SAFE services:
  - start with listing and comparing with this
  - create it along with a container (mutable data)
  - if it exists, interrogate it and store info needed for operations

  ??? implement a fetch() which calls _fetch() on the SafenetworkLDP
  ??? when that works, switch to own implementation that uses SAFE services code
  */

  safeWeb:          function (){  return this._safeWeb },
  serviceConfig:    function (){  return this._serviceConfig },

  getName:          function (){  return this.serviceConfig().name },
  getDescription:   function (){  return this.serviceConfig().description },
  getUriPrefix:     function (){  return this.serviceConfig().uriPrefix },
  getTagType:       function (){  return this.serviceConfig().tagType },

  /*
   * The following stubs must be replaced for each service implementation:
   */

  // Initialise an services MD with an entry for this service
  //
  // @param servicesMd
  //
  // @returns a promise which resolves to the servicesMd
  initialiseService:    async function(servicesMd){ throw('ServiceInterface.initialiseServicesMd() not implemented for ' + this.getName() + ' service')},

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  _fetch:               async function(){ throw('ServiceInterface._fetch() not implemented for ' + this.getName() + ' service')},
};

// TODO change to export class, something like this (example rdflib Fetcher.js)
// class SafeWeb {...}
// let safeWeb = new SafeWeb()
// module.exports = SafeWeb
// module.exports.safeWeb = safeWeb


let safeWeb = new SafeWeb();

exports = module.exports =  SafeWeb.bind(safeWeb);
module.exports.setSafeApi = SafeWeb.prototype.setSafeApi.bind(safeWeb)
module.exports.listContainer = SafeWeb.prototype.listContainer.bind(safeWeb)
module.exports.testsNoAuth = SafeWeb.prototype.testsNoAuth.bind(safeWeb)
module.exports.testsAuth = SafeWeb.prototype.testsAuth.bind(safeWeb)

// Create and export LDP service for Solid apps:
//
// TODO move this to a services loading feature

// Service configuration (maps to a SAFE API Service)
const ldpServiceConfig = {
  // UI - to help identify the service in user interface
  //    - don't match with these in code (use the uriPrefix or tagType)
  name:         "LDP",
  description:  "LinkedData Platform (http://www.w3.org/TR/ldp/)",

  // Don't change this unless you are defining a brand new service
  uriPrefix:  'ldp',  // Uses:
                      // to direct URI to service (e.g. safe://ldp.somesite)
                      // identify service in _publicNames (e.g. happybeing@ldp)

  tagType:    SN_TAGTYPE_LDP,  // Mutable data tag type (don't change!)
}

// TODO remove once SafenetworkServices implemented:
let safeLDP = new ServiceInterface(ldpServiceConfig);

module.exports.safeLDP =  ServiceInterface.bind(safeLDP);
