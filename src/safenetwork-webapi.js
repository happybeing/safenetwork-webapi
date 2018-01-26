/**
 * SAFEnetwork API for public names and web style SAFEnetwork services
 *
 * Includes tentative service implementations for www, LDP
 * Service implentations are easy to replace or add to (see ServiceInterface)
 *
 */

// TODO migrate and refactor LDP implementation here, from safenetwork-solid.js
// TODO maybe provide methods to enumerate public names & services
// TODO refactor to eliminate memory leaks (e.g. using 'finally')
// TODO consider adding other web services (e.g. WebDav)
// TODO consider whether a service could implement basic file sharing / URI shortening

const safeLog = require('debug')('safe:web')  // Decorated console output

const SN_TAGTYPE_SERVICES = 15001 // TODO get these from the API CONSTANTS
const SN_TAGTYPE_WWW  = 15002
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
class SafeWeb {
  constructor(){
    this._availableServices = new Map() // Map of installed services
    this.initialise()
  }

  initialise() {
    this._hostedServices = new Map     // Map of host (profile.public-name) to a service instance
    // TODO if necessary, update/reset managed objects such as MDs
  }

  // Application must set/refresh the SAFE API handles if they become invalid:
  setSafeApi(appHandle){
      this._appHandle = appHandle   // SAFE API application handle
      this.initialise()
  }

  // For access to SAFE API:
  appHandle(){  return this._appHandle }
  services(){   return this._availableServices }

  /* --------------------------
   * Simplified MutableData API
   * --------------------------
   */

   // Get the key/value of an entry from a mutable data object
   //
   // @param mdHandle handle of a mutable data, with permission to 'Read'
   //
   // @returns a Promise which resolves to a ValueVersion
   async getMutableDataValue(mdHandle,key){
    safeLog('%s(%s,%s)...', Function.name,mdHandle,key)
    try {
      let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
      let entryKey = this.makePublicNamesEntryKey(key)
      return await window.safeMutableDataEntries.get(entriesHandle, entryKey)
    } catch(err){
      safeLog("%s() WARNING no entry found for key '%s'", Function.name, key)
    }

    return null
   }

  // Set (ie insert or update) an entry in a mutable data object
  //
  // User must be logged in
  // App must have 'Insert'/'Update' permissions as appropriate
  //
  // @param mdHandle
  // @param key
  // @param value
  // @param mustNotExist  [defaults to false] if true, will fail if the key exists in the MD object
  //
  // @returns a Promise which resolves true if successful
  async setMutableDataValue(mdHandle,key,value,mustNotExist){
    if (mustNotExist == undefined)
      mustNotExist = true

    safeLog('%s(%s,%s,%s,%s)...',Function.name,mdHandle,key,value,mustNotExist)
    try {
      // Check for an existing entry (before creating services MD)
      let value = await window.safeMutableData.get(mdHandle,key)

      if (value && mustNotExist)
        throw new Error("Key '%s' already exists", key)

      let mutationHandle = await window.safeMutableData.newMutation(this.appHandle())
      if (entry)
        await window.safeMutableDataMutation.update(mutationHandle,key,servicesMdName,value.version+1)
      else
        await window.safeMutableDataMutation.insert(mutationHandle,key,servicesMdName)

      await window.safeMutableData.applyEntriesMutation(mdHandle, mutationHandle).then(_ => {
        safeLog('Mutable Data Entry %s:',(mustExist ? 'updated' : 'inserted'));
        return true
      });
    } catch (err) {
      safeLog('%s() failed: ',Function.name,err)
    }

    return false
  }

  /* ----------------
   * Public Names API
   * ----------------
   */

  // Get the key/value of a public name's entry in the _publicNames container
  //
  // User must:
  //  - be logged into the account owning the public name for this to succeed.
  //  - authorise the app to 'Read' _publicNames on this account.
  //
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the key and ValueVersion
  // The returned object is null on failure, or contains:
  //  - a 'key' of the format: '_publicNames/<public-name>'
  //  - a 'ValueVersion', the value part will be the XOR name of the services entry MD for the public name
  async getPublicNameEntry(publicName){
   safeLog('getPublicNameEntry(%s)...', publicName)
   try {
     // TODO wrap access to some MDs (eg for _publicNames container) in a getter that is passed permissions
     // TODO checks those permissions, gets the MD, and caches the value, or returns it immediately if not null
     let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
     let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd)
     let entryKey = this.makePublicNamesEntryKey(publicName)
     return {
       key:           entryKey,
       valueVersion:  await window.safeMutableDataEntries.get(entriesHandle, entryKey)
     }
   } catch(err){
     safeLog('getPublicNameEntry() WARNING no _publicNames entry found for: %s', publicName)
   }

   return null
  }

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
  async createPublicName(publicName){
    safeLog('createPublicName(%s)...', publicName)
    try {
      // Check for an existing entry (before creating services MD)
      let entry = null
      try {
       entry = await this.getPublicNameEntry(publicName)
      } catch (err) {} // No existing entry, so ok...

      if (entry)
        throw new Error('Can\'t create _publicNames entry, already exists for %s', publicName)

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
        return {
            key:            entryKey,
            value:          servicesMdName,
            servicesHandle: servicesMd,
          }
      });
    } catch (err) {
     safeLog('createPublicNameEntry() failed: ', err)
     throw err
    }
  }

  // Get the services MD for any public name, even ones you don't own
  //
  // This is always public, so no need to be logged in or own the public name.
  //
  // @param publicName
  //
  // @returns promise which resolves to the services MD of the given name
  async getServicesMdFor(publicName){
    safeLog('getServicesMdFor(%s)',publicName)
    try {
      let servicesName = await this.makeServicesMdName(publicName)
      await window.safeMutableData.newPublic(servicesName,SN_TAGTYPE_SERVICES)
      .then((mdHandle) => {
          safeLog('Look up SUCCESS for MD XOR name: ' + servicesName)
          return mdHandle
      });
    } catch (err) {
      safeLog('Look up FAILED for MD XOR name: ' + this.makeServicesMdName(publicName))
      safeLog('getServicesMdFor ERROR: ', err)
      throw err
    }
  }

  // Get the services MD for a given public name (which you must own)
  //
  // User must be logged into the account owning the public name for this to succeed.
  // User must authorise the app to 'Read' _publicNames on this account
  //
  // @param publicName
  //
  // @returns promise which resolves to the services MD of the given name, or null
  async getServicesMdFromContainers(publicName){
   safeLog('getServicesForMy(%s)',publicName)
   try {
     let nameKey = this.makePublicNamesEntryKey(publicName)
     window.safeApp.getContainer(this.appHandle(), '_publicNames')
     .then(async (mdHandle) => {
       safeLog("_publicNames ----------- start ----------------")
       await window.safeMutableData.getEntries(mdHandle)
       .then((entriesHandle) => window.safeMutableDataEntries
         .forEach(entriesHandle, (k, v) => {
           safeLog('Key: ', k.toString())
           safeLog('Value: ', v.buf.toString())
           safeLog('Version: ', v.version)
           if ( k == nameKey ){
             safeLog('Key: ' + nameKey + '- found')
             return v.buf
           }
         }).then(_ => {
           safeLog('Key: ' + nameKey + '- NOT found')
           safeLog("%s() - WARNING: No _publicNames entry for '%s'", Function.name, publicName)
           return null
         })
       );
     });
   } catch (err) {
     safeLog('getServicesMdFromContainers ERROR: ', err)
     throw err
   }
  }

  /* -----------------
   * SAFE Services API
   * -----------------
   */

  // Make a service available for use in this API
  //
  // - replaces any service with the same service idString
  //
  // @param a service specific implementation object, of class which extends ServiceInterface
  //
  // @returns a promise which resolves to true
  async setServiceImplementation(serviceImplementation){
    this._availableServices.set(serviceImplementation.getIdString(), serviceImplementation)
    return true
  }

  // Get the service implementation for a service if available
  //
  // @param serviceId
  //
  // @returns the ServiceInterface implementation for the service, or null
  async getServiceImplementation(serviceId){
    return this._availableServices.get(serviceId)
  }


  // Get the service implementation for a URI
  //
  // Maintains a cache of handlers for each host, so once a service has
  // been assigned to a host address the service implementation is already known
  // for any URI with that host. If the appropriate service for a host changes,
  // it would be necessary to clear its cached service by setting _hostedServices.delete(<host>)
  // to null, and the next call would allocate a service from scratch.
  //
  // @param a valid safe:// style URI
  // @returns a promise which evaluates to a ServiceInterface which supports fetch() operations
  //
  // @param a valid safe:// style URI
  // @returns a promise which evaluates to a service implementation object, or null if no service installed on host
  async getServiceForUri(uri){
    safeLog('%s(%s)...', Function.name, uri)
    try {
      let host = hostpart(uri)
      if (this._hostedServices.get(host) != undefined)
        return this._hostedServices.get(host) // Already initialised

      // Lookup the service on this host: profile.public-name
//TODO??? make sure it works if no '.'
let uriProfile = host.split('.')[0]
let publicName = host.split('.')[1]
      safeLog("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName)
      let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
      safeLog("checking servicesMd entries for host '%s'", host)
      await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
        safeLog('Key: ', k.toString())
        safeLog('Value: ', v.buf.toString())
        safeLog('Version: ', v.version)
        let serviceProfile = host.split('@')[0]
        let serviceId = host.split('@')[1]
        let serviceValue = v.buf.toString()
        safeLog("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
        if (serviceProfile == uriProfile){
          let serviceFound = this._availableServices.get(serviceId)
          if (serviceFound){
            // Use the installed service to enable the service on this host
            let hostedService = serviceFound.cloneService(serviceValue)
            this._hostedServices.set(host,hostedService)
            return hostedService
          }
          else {
            let errMsg = "WARNING service '" + serviceId + "' enabled for host '" + host + "' is not installed"
            throw new Error(errMsg)
          }
        }
      }).then(_ => {
        safeLog("WARNING no services enabled for host '" + host + "'")
        return null
      });
    }
    catch (err) {
      safeLog('getServiceForUri(%s) FAILED: %s', uri, err)
      throw(err)
    }
    finally {
      // TODO implement memory freeing stuff using 'finally' throughout the code!
    }
  }

  /* --------------
   * Helper Methods
   * --------------
   */

  // Helpter to mutable the data handle for an MD hash
  //
  // @param hash
  // @param tagType
  //
  // @returns a promise which resolves to an MD handle
  async getMdFromHash(hash,tagType){
   safeLog('getMdFromHash(%s,%s)...',hash,tagType)
   try {
     return window.safeMutableData.newPublic(this.appHandle(),hash,tagType)
   } catch(err){
     safeLog('getMdFromHash() ERROR: %s', err)
     throw err
   }
  }

  // Helper to create the services MD name corresponding to a public name
  //
  // Standardised naming makes it possile to retrieve services MD for any public name.
  //
  // See final para: https://forum.safedev.org/t/container-access-any-recent-dom-api-changes/1314/13?u=happybeing
  //
  // @param publicName
  //
  // @returns the XOR name as a String, for the services MD unique to the given public name
  async makeServicesMdName(publicName){
    return window.safeCrypto.sha3Hash(this.appHandle(),publicName)
  }

  // Helper to create the key for looking up a public name entry in the _publicNames container
  //
  // @param publicName
  //
  // @returns the key as a string, corresponding to the public name's entry in _publicNames
  makePublicNamesEntryKey(publicName){
    return '_publicNames/' + publicName
  }

  /*
   * Web Services API
   *
   * This API provides a way to implement Web like services on safe:// URIs.
   *
   * The API allows for new service implementations to be provided, replacing
   * or adding to the services *available* on this API, each of which is
   * implemented by extending the service implementation class: ServiceInterface.
   *
   * This API enables you to *install* any of the *available* services on a host, where
   * host means: [profile.]public-name (e.g. ldp.happybeing) which can then be
   * accessed by clients using fetch() on safe: URIs such as safe://ldp.happybeing/profile/me#card
   */

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

  // TODO this belongs in ServiceInterface now (MAYBE???) May need some tweaking (e.g. service would call this with a newly created serviceValue after having checked it doesn't already have a suitable entry, by calling this with 'overwrite:true')
  async InitialiseServiceEntry(serviceSettings,overwrite){
    safeLog('InitialiseServiceEntry(%o,%s)...',serviceSettings,overwrite)
    if (overwrite == undefined){
      const overwrite = false
    }

    try {
      let entriesHandle = await window.safeMutableData.getEntries(serviceSettings.servicesMd)
      try {
        await window.safeMutableDataEntries.get(entriesHandle,serviceSettings.serviceKey).then(async (value) => {
          // An entry exists for servicePrefix
          if (overwrite){
            safeLog("Initialise service entry WARNING: service entry exists for key '%s', no action taken", serviceSettings.serviceKey )
            return false
          }
          else {
            let mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle)
            await window.safeMutableDataMutation.update(mutationHandle,serviceSettings.serviceKey,serviceSettings.serviceValue)
            await window.safeMutableData.applyEntriesMutation(serviceSettings.servicesMd, mutationHandle)
            .then(async _ => {
                await window.safeMutableDataMutation.free(mutationHandle)
                return true
            });
          }
        }),(async _ =>{
          // No entry exists, so insert one
          let mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle)
          await window.safeMutableDataMutation.insert(mutationHandle,serviceSettings.serviceKey,serviceSettings.serviceValue)
          await window.safeMutableData.applyEntriesMutation(serviceSettings.servicesMd, mutationHandle)
          .then(async _ => {
              await window.safeMutableDataMutation.free(mutationHandle)
              return true
          });
        });
      } catch (err) {
        safeLog('InitialiseServiceEntry() WARNING: %s', err)
        return false
      }
    } catch (err) {
      safeLog('InitialiseServiceEntry() FAILED: ', err)
      throw err
    }
  }

  // Helper to create the key for looking up the service installed on a host
  //
  // @param hostProfile prefix of a host address, which is [profile.]public-name
  // @param serviceId
  //
  // @returns the key as a string, corresponding to a service entry in a servicesMD
  makeServiceEntryKey(hostProfile,serviceId){
    return (hostProfile + '@' + serviceId)
  }

  //////// TODO END of 'move to Service class/implementation'

  ////// TODO debugging helpers (to remove):

  testsNoAuth(){
    safeLog('testsNoAuth() called!')
  }

  // TODO prototyping only for now:
  async testsAuth(publicHandle,nfsHandle){
    safeLog('>>>> testsAuth(%o,%o)', publicHandle, nfsHandle)

  try {
    /*
     let authUri = await window.safeApp.authoriseContainer(this.appHandle(),
                                { _publicNames: ['Read','Insert','Update'] })

    safeLog('App was authorised and auth URI received: ', authUri)
    */


    safeLog('TEST START create public name')
    await this.listContainer('_publicNames')

    let name = 'testname3'
    let entry = await this.getPublicNameEntry(name);

/* TODO TEST THIS....... then implement container
 creation in LDP enableService() maybe needs params so can specify a public container
 for use and/or creation
 then try to use LDP to update a container that is also accessible by www service!
*/
    // Install an LDP service
    let profile = 'ldp'
    name = 'testname3'
    let serviceId = 'ldp'
    let servicesMd = await this.getServicesMdFor(name)
    if (servicesMd) {
      safeLog("servicesMd for public name '%s' contains...",name)
      this.safeWeb().listMd(servicesMd)

      let serviceInterface = this.getServiceImplementation(serviceId)
      let host = profile + '.' + name
      serviceInterface.enableService(host,servicesMd)

      safeLog("servicesMd for public name '%s' contains...",name)
      this.safeWeb().listMd(servicesMd)
    }
    // NOTES:
    //  testname1 thru 3 have entries in _publicNames (create successful)
//    await this.createPublicName(name)
    await this.listContainer('_publicNames')

    await this.listAvailableServices()
    await this.listHostedServices()

    safeLog('TEST END')

    } catch (err) {
      safeLog('Error: ', err)
    }

  }

  async listAvailableServices(){
   safeLog('listAvailableServices()...')
   this._availableServices.forEach((v,k) => {
     safeLog("%s: '%s' - %s", k, v.getName(), v.getDescription())
   });
  }

  async listHostedServices(){
   safeLog('listHostedServices()...')
   this._hostedServices.forEach((v,k) => {
     safeLog("%s: '%s' - %s", k, v.getName(), v.getDescription())
   });
  }

  async listContainer(containerName){
   safeLog('listContainer(%s)...',containerName)
   let mdHandle = await window.safeApp.getContainer(this.appHandle(), containerName)
   safeLog(containerName + " ----------- start ----------------")
   await this.listMd(mdHandle)
   safeLog(containerName + "------------ end -----------------")
  }

  async listMd(mdHandle){
   let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
   await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
     safeLog('Key: ', k.toString())
     safeLog('Value: ', v.buf.toString())
     safeLog('Version: ', v.version)
   });
  }
  ////// END of debugging helpers

};

/*
 * Service interface template for each service implementation
 *
 * DRAFT spec: https://forum.safedev.org/t/safe-services-npm-module/1334
 */
class ServiceInterface {
  // An abstract class which defines the interface to a SAFE Web Service
  //
  // Extend this class to provide the implementation for a SAFE Web service.
  //
  // An application or module can add a new service or modify an existing service
  // by providing an implementation that follows this template, and installing
  // it in the SafeWebApi object.

  //
  // To implement a SAFE web service:
  // - extend this class and implement your service specific functionality
  // - make the service available on an instance of class SafeWeb
  // - enable the service for a given safe address (safe://[profile].public-name)
  // TODO provide way to do points 2 & 3 above

  constructor(safeWeb) {
    this._safeWeb =       safeWeb
    this._serviceConfig = {}

    // Clear properties until enabled for a host
    this.host = ''
  }

  set host(v){   this._host = v}
  get host(){    return this._host}

  safeWeb(){        return this._safeWeb }
  serviceConfig(){  return this._serviceConfig }

  getName(){        return this.serviceConfig().friendlyName }
  getDescription(){ return this.serviceConfig().description }
  getIdString(){    return this.serviceConfig().idString }
  getTagType(){     return this.serviceConfig().tagType }

  // Settings once service is enabled for a host
  /*
   * To provide a new SAFE web service:
   * - extend this class provide a constructor which calls super(safeWeb)
   *   and initialises the properties of this._serviceConfig
   * - provide service specific implementations of the following methods
   *
   * Refer to class SafeServiceLDP for guidance.
   */

  // Initialise an services MD with an entry for this service
  //
  // @param servicesMd
  //
  // @returns a promise which resolves to the servicesMd
  async enableService(host,servicesMd){
    safeLog('%s.enableService(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
    throw('ServiceInterface.enableService() not implemented for ' + this.getName() + ' service')
    this.host = host
  }

  // Create an instance of your service from a servicesMd entry
  //
  // @param serviceValue is the value stored in the servicesMd by your enableService() implementation
  async cloneService(serviceValue){
    throw('ServiceInterface.cloneService() not implemented for ' + this.getName() + ' service')

    /* Your implementation should call this method and store a copy of serviceValue
     * for use within the _fetch() implementation, along with any other initialisation
     * needed. For example:

      async cloneService(serviceValue){
        let hostService = await new this.constructor.name(this.safeWeb())
        await hostService.initialiseClone(serviceValue) // Probably stores serviceValue for use in _fetch()
        return hostService
      }

     */
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch(){
    safeLog('%s._fetch() - NOT YET IMPLEMENTED', this.constructor.name, servicesMd)
    throw('ServiceInterface._fetch() not implemented for ' + this.getName() + ' service')
  }

};

// Keep this service implementation here because it is simple and illustrates
// the basics of providing an implementation. Other implementations would
// probably best be in separate files.
class SafeServiceWww extends ServiceInterface {
  constructor(safeWeb){
    super(safeWeb)

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {
      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName:         "WWW",
      description:          "www service (defers to SAFE webFetch)",

      // Don't change this unless you are defining a brand new service
      idString:  'www', // Uses:
                        // to direct URI to service (e.g. safe://www.somesite)
                        // identify service in _publicNames (e.g. happybeing@www)
                        // Note: SAFE WHM 0.4.4 leaves blank for www (i.e. happybeing@) (RFC needs to clarify)

      tagType:    SN_TAGTYPE_WWW,  // Mutable data tag type (don't change!)
    }
  }
  // Initialise an services MD with an entry for this service
  //
  // @param servicesMd
  //
  // @returns a promise which resolves to the servicesMd
  async enableService(host,servicesMd){
    // This is not implemented for www because this service is passive (see _fetch() below)
    // and so a www service must be set up using another application such as
    // the Maidsafe Web Hosting Manager example. This can't be done here
    // because the user must specify a name for a public container.
    safeLog('%s.enableService(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
    throw('%s.enableService() not implemented for ' + this.getName() + ' service',  this.constructor.name)
    this.host = host
  }

  // Create an instance of your service from a servicesMd entry
  //
  // @param serviceValue is the value stored in the servicesMd by your enableService() implementation
  async cloneService(serviceValue){
    let hostService = await new this.constructor.name(this.safeWeb())
    await hostService.initialiseWwwService(serviceValue)
    return hostService
  }

  async inistialiseWwwService(serviceValue){
    this._serviceValue = serviceValue // TODO not needed if _fetch() just defers to window.webFetch()
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch(){
    safeLog('%s.%s(%o) calling window.webFetch()', this.constructor.name, Function.name, arguments)
    return window.webFetch.apply(null,arguments)
  }
}

// TODO move this service implementation into its own file and require() to use it
class SafeServiceLDP extends ServiceInterface {
  constructor(safeWeb){
    super(safeWeb)

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {
      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName:         "LDP",
      description:          "LinkedData Platform (http://www.w3.org/TR/ldp/)",

      // Don't change this unless you are defining a brand new service
      idString:  'ldp', // Uses:
                        // to direct URI to service (e.g. safe://ldp.somesite)
                        // identify service in _publicNames (e.g. happybeing@ldp)

      tagType:    SN_TAGTYPE_LDP,  // Mutable data tag type (don't change!)
    }
  }
  // Initialise an services MD with an entry for this service
  //
  // @param servicesMd
  //
  // @returns a promise which resolves to the servicesMd
  async enableService(host,servicesMd){
    safeLog('%s.enableService(%s,%o)', host, this.constructor.name, servicesMd)
    this.host = host
    let uriProfile = host.split('.')[0]
    let publicName = host.split('.')[1]
    let serviceKey = this.safeWeb().makeServiceEntryKey(uriProfile,this.getServiceId())

    let serviceValue = '<test value for LDP service>' // TODO create/store address of a public container, maybe parameterised?

    await this.safeWeb().setMutableDataEntry(servicesMd,serviceKey,serviceValue)
  }

  // Create an instance of your service from a servicesMd entry
  //
  // @param serviceValue is the value stored in the servicesMd by your enableService() implementation
  async cloneService(serviceValue){
    throw('ServiceInterface.cloneService() not implemented for ' + this.getName() + ' service')

    /* Your implementation should call this method and store a copy of serviceValue
     * for use within the _fetch() implementation, along with any other initialisation
     * needed. For example:

      async cloneService(serviceValue){
        let hostService = await new this.constructor.name(this.safeWeb())
        await hostService.initialiseLdpService(serviceValue) // Probably stores serviceValue for use in _fetch()
        return hostService
      }

     */
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch(){
    safeLog('%s._fetch(%o) - NOT YET IMPLEMENTED', this.constructor.name, servicesMd)
  }
}

// TODO change to export class, something like this (example rdflib Fetcher.js)
// class SafeWeb {...}
// let safeWeb = new SafeWeb()
// module.exports = SafeWeb
// module.exports.safeWeb = safeWeb

// Usage: create the web API and install the built in services
let safeWeb = new SafeWeb();
safeWeb.setServiceImplementation(new SafeServiceWww(safeWeb)) // A default service for www (passive)
safeWeb.setServiceImplementation(new SafeServiceLDP(safeWeb)) // An app can install additional services as needed

exports = module.exports =  SafeWeb.bind(safeWeb);
module.exports.setSafeApi = SafeWeb.prototype.setSafeApi.bind(safeWeb)
module.exports.listContainer = SafeWeb.prototype.listContainer.bind(safeWeb)
module.exports.testsNoAuth = SafeWeb.prototype.testsNoAuth.bind(safeWeb)
module.exports.testsAuth = SafeWeb.prototype.testsAuth.bind(safeWeb)

// Create and export LDP service for Solid apps:
//
// TODO move this to a services loading feature


// TODO remove once SafenetworkServices implemented:
let safeLDP = new SafeServiceLDP(safeWeb);

module.exports.safeLDP =  ServiceInterface.bind(safeLDP);
