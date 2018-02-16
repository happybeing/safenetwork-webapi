
/**
 * SAFEnetwork Web API
 *
 * Supports:
 *  - application authorisation and connection to SAFE network
 *  - safe:// URIs for any code using window.fetch()
 *  - creation of SAFE network public names and services
 *  - tentative web service implementations for www, LDP
 *  - ability add services or override the default implementations
 *
 * Prerequisites:
 *  - access to the SAFE browser DOM API
 *  - website / web app must be accessed using a SAFE network aware web browser
 *  - if using MaidSafe Peruse browser, your website/web app must reside at a 'safe://' URI
 */

/* TODO:
[/] migrate RS code to LDP service and refactor to async/await
[/] check everything in:
    - milestone-01 SafenetworkWebApi-coded-broken
    - git tag safe-v0.03
[/] revert to an earlier vertion without problems (below)
[/] fix problems caused by switch from SafenetworkLDP to SafenetworkWebApi:
  [/] safeWebLog() no longer outputs
  [/] solid-plume no longer behaves (e.g. Login > New Post etc)
[/] slowly re-instate changes to isolate problems:
    [/] SORTED: issue is with peruse-mock and 'yarn dev'
        WORKS using ~/src/safe/peruse-mock/release/linux-unpacked/peruse
[/] revert back to latest code
[/] check it now works
[ ] test and debug SafenetworkWebAPi and LDP service:
[ ]   1. test update to container
[ ]   2. test access to LDP container by owner
[ ]   3. test access to LDP container by NON-owner (ie while logged out)
[ ] try to use LDP to update a container that is also accessible by www service!
[ ] fix SAFE API issue with safeNfs.create() and
see: https://forum.safedev.org/t/safenfs-create-error-first-argument-must-be-a-string-buffer-arraybuffer-array/1325/23?u=happybeing)
[ ]   1. update first PoC (write/read block by owner only)
[ ]   2. create second PoC (which allows me to write blog, others to read it)
[ ] review usefulness of my getServicesMdFromContainers (is getServciesMdFor enough?)
[ ] review ServiceInterface implementations and
[ ]   1. implement a simple www service
[ ]   2. implement RemoteStorage as a SAFE service
[ ]   3. consider how to implement a file share / URL shortener as a service
*/
// TODO test get folder and then convert to proper LDP response
// TODO disallow service creation with empty profile for all but www
// TODO maybe provide methods to enumerate public names & services
// TODO refactor to eliminate memory leaks (e.g. using 'finally')
// TODO consider adding other web services (e.g. WebDav)
// TODO go through todos in the code...

localStorage.debug = 'safe:*'
const oldLog = require('debug')('safe:web')  // Decorated console output
oldLog('SUDDENLY oldLog() is %s','working!!!!')
// While oldLog not working...
safeWebLog = function () { console.log.apply(null,arguments) }

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
 *  Example application config for SAFE Authenticator UI
 *
 * const appCfg = {
 *   id:     'com.happybeing',
 *   name:   'Solid Plume (Testing)',
 *   vendor: 'happybeing.'
 * }
 *
 */

// Default permissions to request. Optional parameter to SafenetworkWebApi.simpleAuthorise()
//
const defaultPerms = {

  // The following defaults have been chosen to allow creation of public names
  // and containers, as required for accessing SAFE web services.
  //
  // If your app doesn't need those features it can specify only the permissions
  // it needs when calling SafenetworkWebApi.simpleAuthorise()
  _public:      ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _publicNames: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
}

/*
 * Web API for SAFEnetwork
 * - public IDs
 * - web services (extendable through implementation modules)
 *
 * @Params
 *  appHandle - SAFE API app handle or null
 *
 */
class SafenetworkWebApi {
  constructor(){
    this._availableServices = new Map // Map of installed services
    this.initialise()

    // An app can install additional services as needed
    // TODO update:
    //this.setServiceImplementation(new SafeServiceWww(this)) // A default service for www (passive)
    this.setServiceImplementation(new SafeServiceLDP(this))
  }

  initialise() {
    // TODO implement delete any active services

    // SAFE Network Services
    this._activeServices = new Map    // Map of host (profile.public-name) to a service instance

    // DOM API settings and and authorisation status
    this._safeAuthUri = ''
    this._isConnected = false
    this._isAuthorised = false
    this._authOnAccessDenied = false  // Used by simpleAuthorise() and fetch()

    // Application specific configuration required for authorisation
    // TODO how is this set?
    this._safeAppConfig = {}
    this._safeAppPermissions = {}
  }

  /*
   * Application API - authorisation with SAFE network
   */

  // Set SAFE DOM API application handle
  //
  // If application does its own safeApp.initialise, it must call setSafeApi()
  // Application can call this again if it wants to clear/refresh DOM API handles
  //
  // @param a DOM API SAFEAppHandle, see window.safeApp.initialise()
  //
  setSafeApi(appHandle){
    this.initialise()             // Clears active services (so DOM API handles will be discarded)
    this._appHandle = appHandle   // SAFE API application handle
  }

  // Simplified authorisation with SAFE network
  //
  // Before you can use the SafenetworkWebApi methods, you must authorise your application
  // with SAFE network. This function provides simplified, one step authorisation, but
  // you can authorise separately, including using the SAFE DOM API directly to
  // obtain a valid SAFEAppHandle, which you MUST then use to initialise
  // the SafenetworkWebApi.
  //
  // - if using this method you don't need to do anything with the returned SAFEAppHandle
  // - if authorising using another method, you MUST call SafenetworkWebApi.setApi() with a valid SAFEAppHandle
  //
  // @param appConfig      - information for auth UI - see DOM API window.safeApp.initialise()
  // @param appPermissions - (optional) requested permissions - see DOM API window.safeApp.authorise()
  //
  // @returns a DOM API SAFEAppHandle, see window.safeApp.initialise()
  //
  async simpleAuthorise(appConfig,appPermissions){
    safeWebLog('%s.simpleAuthorise(%O,%O)...',this.constructor.name,appConfig,appPermissions);

    // TODO ??? not sure what I'm thinking here...
    // TODO probably best to have initialise called once at start so can
    // TODO access the API with or without authorisation. So: remove the
    // TODO initialise call to a separate point and only call it once on
    // TODO load. Need to change freeSafeAPI() or not call it above.
    this._safeAppConfig = appConfig
    this._safeAppPermissions = ( appPermissions != undefined ? appPermissions : defaultPerms)
    this._authOnAccessDenied = true // Enable auth inside SafenetworkWebApi.fetch() on 401

    let appHandle
    try {
      appHandle = await window.safeApp.initialise(this._safeAppConfig, (newState) => {
          // Callback for network state changes
          safeWebLog('SafeNetwork state changed to: ', newState)
          this._isConnected = newState
        })

        safeWebLog('SAFEApp instance initialised and appHandle returned: ', appHandle);
        safeWeb.setSafeApi(appHandle)
        //safeWeb.testsNoAuth();  // TODO remove (for test only)

        this._safeAuthUri = await window.safeApp.authorise(appHandle, this._safeAppPermissions, this._safeAppConfig.options)
        safeWebLog('SAFEApp was authorised and authUri received: ', this._safeAuthUri);

        await window.safeApp.connectAuthorised(appHandle, this._safeAuthUri)
        safeWebLog('SAFEApp was authorised & a session was created with the SafeNetwork');
        this._isAuthorised = true;
        safeWeb.testsAfterAuth();  // TODO remove (for test only)
        return appHandle

      } catch (err){
        safeWebLog('WARNING: ', err)
      }

      return appHandle
  }

  // For access to SAFE API:
  appHandle(){  return this._appHandle }
  safeAuthUri(){return this._safeAuthUri }
  isConnected(){return this._isConnected }
  isAuthorised(){return this._isAuthorised }
  appHandle(){  return this._appHandle }
  services(){   return this._availableServices }

  /* --------------------------
   * Simplified MutableData API
   * --------------------------
   */

  // Get the key/value of an entry from a mutable data object
  //
  // This is trivial, but provided to match setMutableDataValue()
  //
  // @param mdHandle handle of a mutable data, with permission to 'Read'
  //
  // @returns a Promise which resolves to a ValueVersion
  async getMutableDataValue(mdHandle,key){
    safeWebLog('getMutableDataValue(%s,%s)...',mdHandle,key)
    try {
      return await window.safeMutableData.get(mdHandle,key)
    } catch(err){
      safeWebLog("getMutableDataValue() WARNING no entry found for key '%s'", key)
      throw err
    }
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

    safeWebLog('setMutableDataValue(%s,%s,%s,%s)...',mdHandle,key,value,mustNotExist)
    let entry = null
    try {
      // Check for an existing entry (before creating services MD)
      try {
      entry = await window.safeMutableData.get(mdHandle,key)
    } catch (err) {}

      if (entry && mustNotExist)
        throw new Error("Key '" + key + "' already exists")

      let mutationHandle = await window.safeMutableData.newMutation(this.appHandle())
      if (entry)
        await window.safeMutableDataMutation.update(mutationHandle,key,value.version+1)
      else
        await window.safeMutableDataMutation.insert(mutationHandle,key,value)

      await window.safeMutableData.applyEntriesMutation(mdHandle, mutationHandle)
      safeWebLog('Mutable Data Entry %s',(mustNotExist ? 'inserted' : 'updated'));
      return true
    } catch (err) {
      safeWebLog('WARNING - unable to set mutable data value: ',err)
      throw err
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
   safeWebLog('getPublicNameEntry(%s)...', publicName)
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
     safeWebLog('getPublicNameEntry() WARNING no _publicNames entry found for: %s', publicName)
   }

   return null
  }

  // Create/reserve a new public name and set it up with a hosted service
  //
  // See also createPublicName()
  //
  // User must be logged in
  // User must authorise the app to 'Read' and 'Insert' _publicNames on this account
  //
  // Fails if it finds there is already a _publicNames entry, otherwise it
  // creates a new services MD for the public name, and inserts it, and sets
  // up the service on the MD.
  //
  // Fails if the requested service is not available.
  //
  // Fails if it can't create the services MD because it already exists, which implies that
  // the public name is already taken. You could pre-check for this using getServicesMdFor().
  //
  // @param publicName
  // @param hostProfile a prefix which identifyies the host for the service where host=[profile.]public-name
  // @param serviceId   the string form of service identity (e.g. 'www', 'ldp' etc.)
  //
  // @returns a Promise which resolves to an object containing the _public entry's key, value and handle:
  //  - key:          of the format: '_publicNames/<public-name>'
  //  - value:        the XOR name of the services MD of the new public name
  //  - serviceValue: the value of the services MD entry for this host (ie [profile.]public-name)
  async createPublicNameAndSetupService(publicName,hostProfile,serviceId){
    safeWebLog('createPublicNameAndSetupService(%s,%s,%s)...', publicName,hostProfile,serviceId)
    let createResult = undefined

    try {
      let service = await this._availableServices.get(serviceId)
      if (!service){
        throw new Error('requested service \''+serviceId+'\' is not available')
      }

      createResult = await this._createPublicName(publicName)
      let servicesMd = createResult.servicesMd

      let host = publicName
      if (hostProfile != undefined && hostProfile != '')
        host = hostProfile+'.'+ publicName

      createResult.serviceValue = await service.setupServiceForHost(host,createResult.servicesMd)
      window.safeMutableData.free(servicesMd)
    } catch (err){
      err = new Error('ERROR failed to create public name with service: ' + err)
      throw err
    }

    return createResult
  }

  // Create/reserve a new public name
  //
  // See also createPublicNameWithService()
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
  //  - key:        of the format: '_publicNames/<public-name>'
  //  - value:      the XOR name of the services entry MD for the public name
  async createPublicName(publicName){
    safeWebLog('createPublicName(%s)...', publicName)
    try {
      let createResult = await this._createPublicName(publicName)
      let servicesMd = await createResult.servicesMd
      delete createResult.servicesMd
      window.safeMutableData.free(servicesMd)
    } catch (err) {
     safeWebLog('Unable to create public name \''+publicName+'\': ', err)
     throw err
    }
  }

  // Create a new random public container for
  //
  // @param rootContainer a top level public container (e.g. '_public', '_documents' etc)
  // @param publicName    the public name which owns the container
  // @param containerName an arbitrary name which may be specified by the user, such as 'root-photos'
  // @param mdTagType     Mutable Data tag_type (typically, this will be the service tag_type)
  //
  // @returns   Promise<NameAndTag>: the name and tag values
  async createPublicContainer(rootContainer,publicName,containerName,mdTagType){
    safeWebLog('createPublicContainer(%s,%s,%s,%s)...',rootContainer,publicName,containerName,mdTagType)
    try {
      // Check the container does not yet exist
      let rootMd = await window.safeApp.getContainer(this.appHandle(),rootContainer)
      let rootKey = '/'+rootContainer+'/'+publicName+'/'+containerName

      // Check the public container doesn't already exist
      let existingValue = null
      try {
        existingValue = await this.getMutableDataValue(rootMd,rootKey)
      } catch (err){
      } // Ok, key doesn't exist yet
      if (existingValue)
        throw new Error("root container '"+rootContainer+"' already has entry with key: '"+rootKey+"'")

      // Create the new container
      let mdHandle = await window.safeMutableData.newRandomPublic(this.appHandle(),mdTagType)
      let entriesHandle = await window.safeMutableData.newEntries(this.appHandle())
      // TODO review this with Web Hosting Manager (where it creates a new root-www container)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read','Update','Insert','Delete','ManagePermissions'];
      let pubKey = await window.safeCrypto.getAppPubSignKey(this.appHandle())
      let pmHandle = await window.safeMutableData.newPermissions(this.appHandle())
      await window.safeMutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet)
      await window.safeMutableData.put(mdHandle, pmHandle,entriesHandle)
      let nameAndTag = await window.safeMutableData.getNameAndTag(mdHandle)

      // Create an entry in rootContainer (fails if key exists for this container)
      await this.setMutableDataValue(rootMd,rootKey,nameAndTag.name.buffer)
      window.safeMutableData.free(mdHandle)
      return nameAndTag
    } catch (err){
      safeWebLog('unable to create public container: ', err)
      throw err
    }
  }

  // Set up a service on a host / public name
  //
  // See also createPublicName()
  //
  // User must be logged in and grant permissions (TODO - what precisley?)
  //
  // Fails if the requested service is not available.
  //
  // @param host (i.e. [profile.]public-name)
  // @param serviceId   the string form of service identity (e.g. 'www', 'ldp' etc.)
  //
  // @returns   the value of the services MD entry for this host (ie [profile.]public-name)
  async setupServiceOnHost(host,serviceId){
    safeWebLog('setupServiceServiceOnHost(%s,%s)...', host,serviceId)
    let serviceValue = undefined

    try {
      let service = await this._availableServices.get(serviceId)
      if (!service){
        throw new Error('requested service \''+serviceId+'\' is not available')
      }

      let servicesMd = await this.getServicesMdFor(host)
      serviceValue = await service.setupServiceForHost(host,servicesMd)
      window.safeMutableData.free(servicesMd)
    } catch (err){
      err = new Error('ERROR unable to set up service \''+serviceId+'\': ' + err)
      throw err
    }

    return serviceValue
  }

  // Internal version returns a handle which must be freed by the caller
  //
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the new entry's key, value and handle:
  //  - key:        of the format: '_publicNames/<public-name>'
  //  - value:      the XOR name of the services entry MD for the public name
  //  - servicesMd: the handle of the newly created services MD
  async _createPublicName(publicName){
    safeWebLog('_createPublicName(%s)...', publicName)
    try {
      // Check for an existing entry (before creating services MD)
      let entry = null
      try {
       entry = await this.getPublicNameEntry(publicName)
      } catch (err) {} // No existing entry, so ok...

      if (entry)
        throw new Error('Can\'t create _publicNames entry, already exists for \`'+publicName+"'")

      // Create a new services MD (fails if the publicName is taken)
      // Do this before updating _publicNames and even if that fails, we
      // still own the name so TODO check here first, if one exists that we own
      let servicesMdName = await this.makeServicesMdName(publicName)
      let servicesMd = await window.safeMutableData.newPublic(this.appHandle(),servicesMdName,SN_TAGTYPE_SERVICES)

    let servicesEntriesHandle = await window.safeMutableData.newEntries(this.appHandle())
//TODO NEXT...
      // TODO review this with Web Hosting Manager (separate into a make or init servicesMd function)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read','Update','Insert','Delete','ManagePermissions'];
      let pubKey = await window.safeCrypto.getAppPubSignKey(this.appHandle())
      let pmHandle = await window.safeMutableData.newPermissions(this.appHandle())
      await window.safeMutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet)
      await window.safeMutableData.put(servicesMd, pmHandle, servicesEntriesHandle)

      // TODO do I also need to set metadata?
      // TODO - see: 	http://docs.maidsafe.net/beaker-plugin-safe-app/#windowsafemutabledatasetmetadata
      // TODO free stuff!
      // TODO   - pubKey? - ask why no free() functions for cyrpto library handles)
      // TODO   - servicesEntriesHandle (window.safeMutableData.newEntries doesn't say it should be freed)
      await window.safeMutableDataPermissions.free(pmHandle)

      // TODO remove (test only):
      let r = await window.safeMutableData.getNameAndTag(servicesMd)
      safeWebLog('New Public servicesMd created with tag: ', r.type_tag, ' and name: ', r.name);

      let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
      let entryKey = this.makePublicNamesEntryKey(publicName)
      let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd)
      let namesMutation = await window.safeMutableDataEntries.mutate(entriesHandle)
      await window.safeMutableDataMutation.insert(namesMutation,entryKey,servicesMdName)
      await window.safeMutableData.applyEntriesMutation(publicNamesMd, namesMutation)
      await window.safeMutableDataMutation.free(namesMutation)

      // TODO remove (test only):
      r = await window.safeMutableData.getNameAndTag(servicesMd)
      safeWebLog('New Public servicesMd created with tag: ', r.type_tag, ' and name: ', r.name);

      safeWebLog('New _publicNames entry created for %s', publicName);
      return {
        key:        entryKey,
        value:      servicesMdName,
        'servicesMd': servicesMd,
      }
    } catch (err) {
     safeWebLog('_createPublicNameEntry() failed: ', err)
     throw err
    }
  }

  // Test if a given Mutable Data exists on the network
  //
  // Use this on a handle from one the safeApp.MutableData.newPublic()
  // or newPrivate() APIs. Those don't create a MutableData on the network
  // but a handle which you can then use to do so. So we use that to test if
  // it already exists.
  //
  // This method is really just to help clarify the SAFE API, so you could
  // just do what this does in your code.
  //
  // @param mdHandle the handle of a Mutable Data object
  //
  // @returns a promise which resolves true if the Mutable Data exists
  async mutableDataExists(mdHandle){
    try {
      await window.safeMutableData.getVersion(mdHandle)
      return true
    } catch (err) {
      return false  // Error indicates this MD doens't exist on the network
    }

    return false
  }

  // Get the services MD for any public name or host, even ones you don't own
  //
  // This is always public, so no need to be logged in or own the public name.
  //
  // @param host (or public-name), where host=[profile.]public-name
  //
  // @returns promise which resolves to the services MD of the given name
  // You should free() the returned handle with window.safeMutableData.free
  async getServicesMdFor(host){
    safeWebLog('getServicesMdFor(%s)',host)
    let publicName = host.split('.')[1]
    try {
      if (publicName == undefined)
        publicName = host

      safeWebLog("host '%s' has publicName '%s'", host, publicName)

      let servicesName = await this.makeServicesMdName(publicName)
      let mdHandle = await window.safeMutableData.newPublic(this.appHandle(),servicesName,SN_TAGTYPE_SERVICES)
      if (await this.mutableDataExists(mdHandle)) {
          safeWebLog('Look up SUCCESS for MD XOR name: ' + servicesName)
          return mdHandle
      }
      throw new Error("services Mutable Data not found for public name '" + publicName + "'")
    } catch (err) {
      safeWebLog('Look up FAILED for MD XOR name: ' + await this.makeServicesMdName(publicName))
      safeWebLog('getServicesMdFor ERROR: ', err)
      throw err
    }
  }

  // Get the services MD for a public name or host (which you must own)
  //
  // User must be logged into the account owning the public name for this to succeed.
  // User must authorise the app to 'Read' _publicNames on this account
  //
  // @param host (or public-name), where host=[profile.]public-name
  //
  // @returns promise which resolves to the services MD of the given name, or null
  // You should free() the returned handle with window.safeMutableData.free
  async getServicesMdFromContainers(host){
   safeWebLog('getServicesMdFromContainers(%s)',host)
   try {
     let publicName = host.split('.')[1]
     if (publicName == undefined)
       publicName = host
     safeWebLog("host '%s' has publicName '%s'", host, publicName)

     let nameKey = this.makePublicNamesEntryKey(publicName)
     let mdHandle = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
     safeWebLog("_publicNames ----------- start ----------------")
     let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
     await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
       safeWebLog('Key: ', k.toString())
       safeWebLog('Value: ', v.buf.toString())
       safeWebLog('Version: ', v.version)
       if ( k == nameKey ){
         safeWebLog('Key: ' + nameKey + '- found')
         return v.buf
       }
     })
     safeWebLog('Key: ' + nameKey + '- NOT found')
     safeWebLog("getServicesMdFromContainers() - WARNING: No _publicNames entry for '%s'", publicName)
     return null
   } catch (err) {
     safeWebLog('getServicesMdFromContainers() ERROR: ', err)
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

  // Make service active for a host address
  //
  // - replaces an active service instance if present
  //
  // @param host
  // @param a service instance which handles service requests for this host
  //
  // @returns a promise which resolves to true
  async setActiveService(host,serviceInstance){
    let oldService = await this.getActiveService(host)
    if (oldService)
      oldService.freeHandles()

    this._activeServices.set(host, serviceInstance)
    return true
  }

  // Get the service instance active for this host address
  //
  // @param host
  //
  // @returns the ServiceInterface implementation for the service, or null
  async getActiveService(host){
    return this._activeServices.get(host)
  }

  // Get the service enabled for a URI
  //
  // Maintains a cache of handlers for each host, so once a service has
  // been assigned to a host address the service implementation is already known
  // for any URI with that host. If the appropriate service for a host changes,
  // it would be necessary to clear its cached service by setting _activeServices.delete(<host>)
  // to null, and the next call would allocate a service from scratch.
  //
  // @param a valid safe:// style URI
  // @returns a promise which evaluates to a ServiceInterface which supports fetch() operations
  //
  // @param a valid safe:// style URI
  // @returns a promise which evaluates to a service implementation object, or null if no service installed on host
  async getServiceForUri(uri){
    safeWebLog('getServiceForUri(%s)...', uri)
    try {
      let host = hostpart(uri)
      if (this._activeServices.get(host) != undefined)
        return this._activeServices.get(host) // Already initialised

      // Lookup the service on this host: profile.public-name
      let uriProfile = host.split('.')[0]
      let publicName = host.split('.')[1]
      if (publicName == undefined){
        publicName = host
        uriProfile = ''
      }
      safeWebLog("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName)
      let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
      safeWebLog("checking servicesMd entries for host '%s'", host)
      await window.safeMutableDataEntries.forEach(entriesHandle, async (k, v) => {
        safeWebLog('Key: ', k.toString())
        safeWebLog('Value: ', v.buf.toString())
        safeWebLog('Version: ', v.version)
        let serviceKey = k.toString()
        let serviceProfile = key.split('@')[0]
        let serviceId = key.split('@')[1]
        if (serviceId == undefined){
          serviceId = serviceKey
          serviceProfile = ''
        }

        let serviceValue = v.buf.toString()
        safeWebLog("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
        if (serviceProfile == uriProfile){
          let serviceFound = this._availableServices.get(serviceId)
          if (serviceFound){
            // Use the installed service to enable the service on this host
            let hostedService = await serviceFound.makeServiceInstance(host,serviceValue)
            this.setActiveService(host,hostedService) // Cache the instance for subsequent uses
            return hostedService
          }
          else {
            let errMsg = "WARNING service '" + serviceId + "' is setup on '" + host + "' but no implementation is available"
            throw new Error(errMsg)
          }
        }
      })

      safeWebLog("WARNING no service setup for host '" + host + "'")
      return null
    }
    catch (err) {
      safeWebLog('getServiceForUri(%s) FAILED: %s', uri, err)
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

  // Helper to get a mutable data handle for an MD hash
  //
  // @param hash
  // @param tagType
  //
  // @returns a promise which resolves to an MD handle
  async getMdFromHash(hash,tagType){
   safeWebLog('getMdFromHash(%s,%s)...',hash,tagType)
   try {
     return window.safeMutableData.newPublic(this.appHandle(),hash,tagType)
   } catch(err){
     safeWebLog('getMdFromHash() ERROR: %s', err)
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

  /*
   * Support safe:// URIs
   *
   * To enable safe:// URI support in any website/web app, all the app needs to
   * do is use the standard window.fetch(), rather than XmlHttpRequest etc
   *
   */
  //

  // fetch() implementation for 'safe:' URIs
  //
  // This fetch is not intended to be called by the app directly. Instead,
  // the app can use window.fetch() as normal, and that will automatically
  // be redirected to this implementation for 'safe:' URIs.
  //
  // This means that an existing website/web app which uses window.fetch()
  // will automatically support 'safe:' URIs without needing to change
  // and fetch() calls. If it uses an older browser API such as
  // XmlHttpRequest, then to support 'safe:' URIs it must first be
  // converted from those to use window.fetch() instead.
  //
  // @param docUri {string}
  // @param options {Object}
  //
  // @returns null if not handled, or a {Promise<Object} on handling a safe: URI
  //
  async fetch (docUri, options){
    safeWebLog('%s.fetch(%s,%o)...',this.constructor.name,docUri,options)
    // TODO remove:
//    return httpFetch(docUri,options) // TESTING so pass through

    try {
      //console.assert('safe' == protocol(docUri),protocol(docUri))
      let allowAuthOn401 = false // TODO reinstate: true
      return this._fetch(docUri,options)
    } catch (err){
      try {
        if (err.status == '401' && this._authOnAccessDenied && allowAuthOn401){
          allowAuthOn401 = false // Once per fetch attempt
          await this.simpleAuthorise(this._safeAppConfig,this._safeAppPermissions)
          return this._fetch(docUri,options)
        }
      } catch (err){
        safeWebLog('WARNING: '+err)
        throw err
      }
    }
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch(docUri,options){
    safeWebLog('%s.fetch(%s,%o)', this.constructor.name,docUri,options)
    let service = await getServiceForUri(docUri)
    if (service){
      let handler = service.getHandler(options.method)
      return handler.call(service,docUri,options)
    }
    else
      return this.safeApp().webFetch(docUri,options)
  }

  ////// TODO debugging helpers (to remove):

  testsNoAuth(){
    safeWebLog('testsNoAuth() called!')
  }

  // TODO prototyping only for now:
  async testsAfterAuth(){
    safeWebLog('>>>>>> T E S T S testsAfterAuth()')

    try {
      await this.listContainer('_public')
      await this.listContainer('_publicNames')

      // Change public name / host for each run (e.g. testname1 -> testname2)
//      this.test_createPublicNameAndSetupService('testname11','test','ldp')

      // This requires that the public name of the given host already exists:
//      this.test_setupServiceOnHost('testname10','ldp')
    } catch (err) {
      safeWebLog('Error: ', err)
    }
  }

  async testServiceCreation1(publicName){
    safeWebLog('>>>>>> TEST testServiceCreation1(%s)...',publicName)
    let name=publicName

    safeWebLog('TEST: create public name')
    let newNameResult = await this.createPublicName(name)
    await this.listContainer('_publicNames')
    let entry = await this.getPublicNameEntry(name);
    safeWebLog('_publicNames entry for \'%s\':\n   Key: \'%s\'\n   Value: \'%s\'\n   Version: %s',name,entry.key,entry.valueVersion.value,entry.valueVersion.version)
    await this.listAvailableServices()
    await this.listHostedServices()

    safeWebLog('TEST: install service on \'%s\'', name)
    // Install an LDP service
    let profile = 'ldp'
//    name = name + '.0'
    let serviceId = 'ldp'
    let servicesMd = await this.getServicesMdFor(name)
    if (servicesMd) {
      safeWebLog("servicesMd for public name '%s' contains...",name)
      await this.listMd(servicesMd)

      let serviceInterface = await this.getServiceImplementation(serviceId)
      let host = profile + '.' + name

      // Set-up the servicesMD
      let serviceValue = await serviceInterface.setupServiceForHost(host,servicesMd)

      // Activate the service for this host
      let hostedService = await serviceInterface.makeServiceInstance(host,serviceValue)
      this.setActiveService(host,hostedService)

      safeWebLog("servicesMd for public name '%s' contains...",name)
      await this.listMd(servicesMd)
    }

    await this.listHostedServices()

    safeWebLog('<<<<<< TEST END')
  }

  async test_createPublicNameAndSetupService(publicName,hostProfile,serviceId){
    safeWebLog('>>>>>> TEST: createPublicNameAndSetupService(%s,%s,%s)...',publicName,hostProfile,serviceId)
    let createResult = await this.createPublicNameAndSetupService(publicName,hostProfile,'ldp')
    safeWebLog('test result: %O', createResult)

    await this.listContainer('_publicNames')
    await this.listContainer('_public')
    await this.listHostedServices()
    safeWebLog('<<<<<< TEST END')
  }

  async test_setupServiceOnHost(host,serviceId){
    safeWebLog('>>>>>> TEST setupServiceOnHost(%s,%s)',host,serviceId)
    let createResult = await this.setupServiceOnHost(host,serviceId)
    safeWebLog('test result: %O', createResult)

    await this.listContainer('_publicNames')
    await this.listContainer('_public')
    await this.listHostedServices()
    safeWebLog('<<<<<< TEST END')
  }

  async listAvailableServices(){
   safeWebLog('listAvailableServices()...')
   await this._availableServices.forEach( async (v,k) => {
     safeWebLog("%s: '%s' - %s", k, await v.getName(), await v.getDescription())
   });
  }

  async listHostedServices(){
   safeWebLog('listHostedServices()...')
   await this._activeServices.forEach( async (v,k) => {
     safeWebLog("%s: '%s' - %s", k, await v.getName(), await v.getDescription())
   });
  }

  async listContainer(containerName){
   safeWebLog('listContainer(%s)...',containerName)
   let mdHandle = await window.safeApp.getContainer(this.appHandle(), containerName)
   safeWebLog(containerName + " ----------- start ----------------")
   await this.listMd(mdHandle)
   safeWebLog(containerName + "------------ end -----------------")
  }

  async listMd(mdHandle){
   let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
   await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
     safeWebLog('Key: ', k.toString())
     safeWebLog('Value: ', v.buf.toString())
     safeWebLog('Version: ', v.version)
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
  // it in the SafenetworkWebApi object.

  /*
   * To provide a new SAFE web service extend this class to:
   * - provide a constructor which calls super(safeWeb) and initialises
   *   the properties of this._serviceConfig
   * - enable the service for a given SAFE host (safe://[profile].public-name)
   *
   * Refer to class SafeServiceLDP for guidance.
   */

  constructor(safeWeb) {
    this._safeWeb =       safeWeb

    // Should be set in service implementation constructor:
    this._serviceConfig = {}
    this._serviceHandler = new Map  // Map 'GET', 'PUT' etc to handler function

    // Properties which must be set by setupServiceForHost()
    this._host = ''
    this._serviceValue = ''
  }

  // Free any cached DOM API handles (should be called by anything discarding an active service)
  freeHandles(){}

  safeWeb(){        return this._safeWeb }

  getName(){        return this.getServiceConfig().friendlyName }
  getDescription(){ return this.getServiceConfig().description }
  getIdString(){    return this.getServiceConfig().idString }
  getTagType(){     return this.getServiceConfig().tagType }
  setHandler(method,handler){  this._serviceHandler.set(method,handler) }
  getHandler(method){
    let handler = this._serviceHandler.get(method)
    if (handler != undefined)
      return handler

    // Default handler when service does not provide one
    return async function (){
      return new Response({},{ ok: false, status: 405, statusText: '405 Method Not Allowed'})
    }
  }

// Initialise a services MD with an entry for this host
//
// Your implementation should:
//  - create any service specific objects on the network (e.g. a container MD to store files)
//  - make a serviceValue to be stored in the services MD entry for this host
//  - mutate the service MD to add the service on the MD for the given host (profile.public-name)
//
// @param servicesMd
//
// @returns a promise which resolves to the services entry value for this service
  async setupServiceForHost(host,servicesMd){
    safeWebLog('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
    throw('ServiceInterface.setupServiceForHost() not implemented for ' + this.getName() + ' service')
    /* Example:
TODO
    */
  }

  // Create an instance of a service inistalised for a given host
  //  - create and intitialise a new instance of this service implementation
  //
  // @param serviceValue  from the services MD for this host
  //
  // @returns a promise which resolves to a new instance of this service for the given host
  async makeServiceInstance(host,serviceValue){
    safeWebLog('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED',  this.constructor.name, host, serviceValue)
    throw('%s.makeServiceInstance() not implemented for ' + this.getName() + ' service',  this.constructor.name)
    /* Example:
    let hostService = await new this.constructor(this.safeWeb())
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
    */
  }

  // Your makeServiceInstance() implementation must set the following properties:
  getHost(){          return this._host }           // The host on which service is active (or null)
  getServiceConfig(){ return this._serviceConfig }  // This should be a copy of this.getServiceConfig()
  getServiceSetup(){  return this._serviceConfig.setupDefaults }
  getServiceValue(){  return this._serviceValue }   // The serviceValue for an enabled service (or undefined)

// TODO remove _fetch() from ServiceInterface classes - now on SafenetworkWebApi
  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch(){
    safeWebLog('%s._fetch() - NOT YET IMPLEMENTED', this.constructor.name, servicesMd)
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

      // Service Setup - configures behaviour of setupServiceForHost()
      setupDefaults: {
        setupNfsContainer:   true,        // Automatically create a file store for this host
        defaultRootContainer: '_public',  // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-www', // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // Don't change this unless you are defining a brand new service
      idString:  'www', // Uses:
                        // to direct URI to service (e.g. safe://www.somesite)
                        // identify service in _publicNames (e.g. happybeing@www)
                        // Note: SAFE WHM 0.4.4 leaves blank for www (i.e. happybeing@) (RFC needs to clarify)

      tagType:    SN_TAGTYPE_WWW,  // Mutable data tag type (don't change!)
    }
  }

  // Initialise a services MD with an entry for this host
  //
  // Your implementation should:
  //  - create any service specific objects on the network (e.g. a container MD to store files)
  //  - make a serviceValue to be stored in the services MD entry for this host
  //  - mutate the service MD to add the service on the MD for the given host (profile.public-name)
  //
  // @param servicesMd
  //
  // @returns a promise which resolves to the services entry value for this service
  async setupServiceForHost(host,servicesMd){
    // This is not implemented for www because this service is passive (see _fetch() below)
    // and so a www service must be set up using another application such as
    // the Maidsafe Web Hosting Manager example. This can't be done here
    // because the user must specify a name for a public container.
    safeWebLog('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
    throw('%s.setupServiceForHost() not implemented for ' + this.getName() + ' service',  this.constructor.name)

    /* Example:
TODO
    */
  }

  // Create an instance of a service inistalised for a given host
  //  - create and intitialise a new instance of this service implementation
  //
  // @param serviceValue  from the services MD for this host
  //
  // @returns a promise which resolves to a new instance of this service for the given host
  async makeServiceInstance(host,serviceValue){
    safeWebLog('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED',  this.constructor.name, host, serviceValue)
    throw('%s.makeServiceInstance() not implemented for ' + this.getName() + ' service',  this.constructor.name)
    /* Example:
    let hostService = await new this.constructor(this.safeWeb())
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
    */
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch(){
    safeWebLog('%s._fetch(%o) calling window.webFetch()', this.constructor.name, arguments)
    return window.webFetch.apply(null,arguments)
  }
}

// TODO move most of the implementation to the ServiceInterface class so that
// TODO it is easy to implement a service with a SAFE NFS storage container
// TODO then move this service implementation into its own file and require() to use it

/*
 * Linked Data Platform (LDP) SAFE Network Service
 *
 * TODO review the detail of the LPD spec against the implementation
 * TODO review BasicContainer, DirectContainer, and IndirectContainer
 * TODO implement PATCH, OPTIONS, SPARQL, anything else?
 * TODO LDPC paging and ordering (see https://en.wikipedia.org/wiki/Linked_Data_Platform)
 *
 * References:
 *  Linked Data Platform Primer (http://www.w3.org/TR/2015/NOTE-ldp-primer-20150423/)
 *  HTTP/1.1 Status Code Definitions (https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html)
 */
class SafeServiceLDP extends ServiceInterface {
  constructor(safeWeb){
    super(safeWeb)

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {

      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName:         "LDP",
      description:          "LinkedData Platform (http://www.w3.org/TR/ldp/)",

      // Service Setup - configures behaviour of setupServiceForHost()
      setupDefaults: {
        setupNfsContainer:   true,        // Automatically create a file store for this host
        defaultRootContainer: '_public',  // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-ldp', // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // SAFE Network Service Identity
      // - only change this to implementing a new service
      idString:  'ldp', // Uses:
                        // to direct URI to service (e.g. safe://ldp.somesite)
                        // identify service in _publicNames (e.g. happybeing@ldp)

      tagType:    SN_TAGTYPE_LDP,  // Mutable data tag type (don't change!)
    }

    // Provide a handler for each supported fetch() request method ('GET', 'PUT' etc)
    //
    // Each handler is a function with same parameters and return as window.fetch()
    this.setHandler('GET',this.get)
    this.setHandler('PUT',this.put)
    this.setHandler('POST',this.post)
    this.setHandler('DELETE',this.delete)
  }

  // TODO copy theses function header comments to above, (also example code)
  // Initialise a services MD with an entry for this host
  //
  // User must grant permission on a services MD, and probably also the
  // _public container, if the service creates file storage for example
  //
  // NOTE: the SAFE _public container has entries for each MD being used
  // as a file store, and by convention the name reflects both the
  // public name and the service which created the container. So for
  // a www service on host 'blog.happybeing' you would expect
  // an entry in _public with key '_public/qw2/root-www' and a
  // value which is a hash of the MD used to store files (see SAFE NFS).
  //
  // Your implementation should:
  //  - create any service specific objects on the network (e.g. a container MD to store files)
  //  - make a serviceValue to be stored in the services MD entry for this host
  //  - mutate the service MD to add the service on the MD for the given host (profile.public-name)
  //
  // @param host is host part of the URI (ie [profile.]public-name)
  // @param servicesMd
  // @param [-] optional service specific parameters, such as name for a new _public container
  //
  // @returns a promise which resolves to the services entry value for this service
  // TODO move this to the super class - many implementations will be able to just change setupConfig
  async setupServiceForHost(host,servicesMd){
    safeWebLog('%s.setupServiceForHost(%s,%o)',  this.constructor.name, host, servicesMd)
    let uriProfile = host.split('.')[0]
    let publicName = host.split('.')[1]
    if (publicName == undefined){
      publicName = host
      uriProfile = ''
    }
    let serviceKey = this.safeWeb().makeServiceEntryKey(uriProfile,this.getIdString())

    let serviceValue = ''   // Default is do nothing
    let setup = this.getServiceConfig().setupDefaults
    if (setup.setupNfsContainer){
      let nameAndTag = await this.safeWeb().createPublicContainer(
        setup.defaultRootContainer,publicName,setup.defaultContainerName,this.getTagType())

      serviceValue = nameAndTag.name.buffer
      await this.safeWeb().setMutableDataValue(servicesMd,serviceKey,serviceValue)
      // TODO remove this excess DEBUG:
      safeWebLog('Pubic name \'%s\' services:',publicName)
      await this.safeWeb().listMd(servicesMd)
    }
    return serviceValue
  }

  // TODO copy theses function header comments to above, (also example code)
  // Create an instance of a service inistalised for a given host
  //  - create and intitialise a new instance of this service implementation
  //
  // @param serviceValue  from the services MD for this host
  //
  // @returns a promise which resolves to a new instance of this service for the given host
  async makeServiceInstance(host,serviceValue){
    safeWebLog('%s.makeServiceInstance(%s,%s)',this.constructor.name, host, serviceValue)
    let hostService = await new this.constructor(this.safeWeb())
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
  }

  /*
   * SAFE NFS Container based service implementation:
   *
   * Many web services revolve around storage and a RESTful/CRUD style
   * interface. This is a default implementation based on the
   * SAFE www service, which uses a public Mutable Data as a
   * container for the service.
   *
   */

  // Get the NFSHandle of the service's storage container
  //
  // @returns a promise which resolves to the NHSHandle
  async storageNfs(){
    if (_storageNfsHandle)
      return await _storageNfsHandle

    safeWebLog('storageNfs()')
    try {
      let _storageNfsHandle = window.safeMutableData.emulateAs(this.storageMd(), 'NFS')
      return _storageNfsHandle
    } catch (err) {
      safeWebLog('Unable to access NFS storage for %s service: %s',this.getName(),err)
      throw(err)
    }
  }

  // Get Mutable Data handle of the service's storage container
  //
  // @returns a promise which resolves to the Mutable Handle
  async storageMd(){
    if (_storageMd)
      return await _storageMd

    safeWebLog('storageMd()')
    try {
      // The service value is the address of the storage container (Mutable Data)
      this._storageMd = window.safeMutableData.newPublic(this.appHandle(),this.getServiceValue(),this.getTagType())
      return this._storageMd
    } catch (err) {
      safeWebLog('Unable to access Mutable Data for %s service: %s',this.getName(),err)
      throw(err)
    }
  }

  /*
   * Service handlers
   *
   * These must be assigned to service methods (e.g. GET, PUT etc) in the
   * constructor of this service implementation. These will then be called
   * by the fetch() when this service has been set up for the host in
   * a safe: URI
   */

  async get(docUri,options){
    safeWebLog('%s.get(%s,%O)',this.constructor.name,docUri,options)
    let path = pathpart(docUri)

  /* TODO if get() returns 404 (not found) return empty listing to fake existence of empty container
    if (response.status == 404)
      safeWebLog('WARNING: SafenetworkLDP::_fetch() may need to return empty listing for non-existant containers')
      return response;
  */
      if (isFolder(path)) {
        return this._getFolder(path, options);
      } else {
        return this._getFile(path, options);
      }
  }

  async put(docUri,options){
    safeWebLog('%s.put(%s,%O)',this.constructor.name,docUri,options)
    let path = pathpart(docUri)

    let body = options.body
    let contentType = options.contentType

    // TODO Refactor to get rid of putDone...
    const putDone = async (response) => {
      safeWebLog('%s.put putDone(statusCode: ' + response.statusCode + ') for path: %s',this.constructor.name,path);

      try {
        // mrhTODO response.statusCode checks for versions are untested
        if (response.statusCode >= 200 && response.statusCode < 300) {
          let fileInfo = await this._getFileInfo(path)
          var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined )
          return new Response({},{statusCode: 200, 'contentType': contentType, revision: etagWithoutQuotes})
        } else if (response.statusCode === 412) {   // Precondition failed
          safeWebLog('putDone(...) conflict - resolving with statusCode 412')
          return new Response({},{statusCode: 412, revision: 'conflict'})
        } else {
          throw new Error("PUT failed with status " + response.statusCode + " (" + response.responseText + ")")
        }
      } catch (err){
        safeWebLog('putDone() failed: '+err)
        throw err
      }
    }

  try {
    let fileInfo = await this._getFileInfo(path)
    if (fileInfo) {
        if (options && (options.ifNoneMatch === '*')) {
          return putDone({ statusCode: 412 });    // Precondition failed
                                                  // (because entity exists,
                                                  // version irrelevant)
        }
        return putDone(this._updateFile(path, body, contentType, options))
      } else {
        return putDone(this._createFile(path, body, contentType, options))
      }
    } catch (err) {
      safeWebLog('put failed: %s',err)
      throw err
    }
  }

  // TODO specialise put/post (RemoteStorage service just has put - so leave til imp RS service)
  async post(docUri,options){
    safeWebLog('%s.post(%s,%O)',this.constructor.name,docUri,options)
    let path = pathpart(docUri)

    if (isFolder(docPath))
      return this._fakeCreateContainer(docPath,options)

    return this.put(docUri,options)
  }

  async delete(docUri,options){
    safeWebLog('%s.delete(%s,%O)',this.constructor.name,docUri,options)
    let path = pathpart(docUri)

    if (isFolder(path))
      return this._fakeDeleteContainer(path,options)

    try {
      let fileInfo = await this._getFileInfo(path)
      if (!fileInfo) {
        // Resource doesn't exist
        return new Response({statusCode: 404,responseText: '404 Not Found'})
      }

      var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );
      if (ENABLE_ETAGS && options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
        return new Response({},{statusCode: 412, revision: etagWithoutQuotes})
      }

      if (!isFolder(path)) {
          safeWebLog('safeNfs.delete() param this.storageNfs(): ' + this.storageNfs());
          safeWebLog('                 param path: ' + path);
          safeWebLog('                 param version: ' + fileInfo.version);
          safeWebLog('                 param containerVersion: ' + fileInfo.containerVersion);
          await window.safeNfs.delete(this.storageNfs(), path, fileInfo.version + 1)
          this._fileInfoCache.delete(path);
          return new Response({statusCode: 204,responseText: '204 No Content'})
      }
    } catch (err){
      safeWebLog('%s.delete() failed: %s',err)
      this._fileInfoCache.delete(path);
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response({},{statusCode: 500,responseText:'500 Internal Server Error ('+err+')'})
    }
  }

  /*
   * Helpers for service handlers
   */

  async _fakeCreateContainer(path,options){
    safeWebLog('fakeCreateContainer(%s,{%o})...')
    return new Response({ ok: true, status: 201, statusText: '201 Created'})
  }

  async _fakeDeleteContainer(path,options){
    safeWebLog('fakeDeleteContainer(%s,{%o})...')
    return new Response({statusCode: 204,responseText: '204 No Content'})
  }

  // TODO the remaining helpers should probably be re-written just for LDP because
  // TODO it was only moderately refactored from poor quality RS.js imp

  // Update file
  //
  // @returns promise which resolves to a Resonse object
  async _updateFile(fullPath, body, contentType, options) {
    safeWebLog('%s._updateFile(\'%s\',%O,%o,%O)',this.constructor.name,fullPath,body,contentType,options);
    try {
      // mrhTODO GoogleDrive only I think:
      // if ((!contentType.match(/charset=/)) &&
      //     (encryptedData instanceof ArrayBuffer || WireClient.isArrayBufferView(encryptedData))) {
      //       contentType += '; charset=binary';
      // }

      let fileInfo = await this._getFileInfo(fullPath)
      if (!fileInfo) {
        // File doesn't exist so create (ref: https://stackoverflow.com/questions/630453
        return this._createFile(fullPath,body,contentType,options)
      }

      var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );
      if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
        return new Response({statusCode: 412, statusText: '412 Precondition Failed', revision: etagWithoutQuotes})
      }

      // Only act on files (directories are inferred so no need to create)
      if (isFolder(fullPath)) {
        // Strictly we shouldn't get here as the caller should test, but in case we do
        safeWebLog('WARNING: attempt to update a folder')
      }
      else {
        // Store content as new immutable data (pointed to by fileHandle)
        let fileHandle = await window.safeNfs.create(this.storageNfs(), body)
        // TODO set file metadata (contentType) - how?

        // Add file to directory (by inserting fileHandle into container)
        fileHandle = await window.safeNfs.update(this.storageNfs(), fileHandle, fullPath, fileInfo.containerVersion + 1)
        await this._updateFileInfo(fileHandle, fullPath)
        var response = { statusCode: ( fileHandle ? 200 : 400  ) };
        // mrhTODO currently just a response that resolves to truthy (may be exteneded to return status?)
        this.reflectNetworkStatus(true);

        // TODO Not sure if eTags can still be simulated:
        // TODO would it be better to not delete, but set fileHandle in the fileInfo?
        this._fileInfoCache.delete(fullPath);     // Invalidate any cached eTag

        // TODO implement LDP PUT response https://www.w3.org/TR/ldp-primer/
        return new Response
      }
    } catch (err){
      safeWebLog('Unable to update file \'%s\' : %s',fullPath,err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response({},{statusCode: 500,responseText:'500 Internal Server Error ('+err+')'})
    }
  }

  // Create file
  //
  // @returns promise which resolves to a Resonse object
  async _createFile(fullPath,body,contentType,options) {
    safeWebLog('%s._createFile(\'%s\',%O,%o,%O)',this.constructor.name,fullPath,body,contentType,options);
    try {
      let fileHandle = await window.safeNfs.create(this.storageNfs(),body)
      // mrhTODOx set file metadata (contentType) - how?

      // Add file to directory (by inserting fileHandle into container)
      fileHandle = await window.safeNfs.insert(this.storageNfs(),fileHandle,fullPath)
      this._updateFileInfo(fileHandle, fullPath)

      // TODO implement LDP POST response https://www.w3.org/TR/ldp-primer/
      return new Response
    } catch (err){
      safeWebLog('Unable to create file \'%s\' : %s',fullPath,err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response({},{statusCode: 500,responseText:'500 Internal Server Error ('+err+')'})
    }
  }

  // For reference see WireClient#get (wireclient.js)
  async _getFile(fullPath,options) {
    safeWebLog('%s._getFile(%s,%O)',this.constructor.name,fullPath,options)
    try {
      if (!this.isConnected()){
        return new Response({statusCode: 503, responseText: '503 not connected to SAFE network'})
      }

      // Check if file exists by obtaining directory listing if not already cached
      let fileInfo = await this._getFileInfo(fullPath)
      if (!fileInfo){
        // TODO does the response object automatically create responseText?
        return new Response({statusCode: 404})
      }

      // TODO If the options are being used to retrieve specific version
      // should we get the latest version from the API first?
      var etagWithoutQuotes = fileInfo.ETag

      // Request is for changed file, so if eTag matches return "304 Not Modified"
      if (ENABLE_ETAGS && options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
        // TODO does the response object automatically create responseText?
        return new Response({statusCode: 304})
      }

      let fileHandle = await window.safeNfs.fetch(this.storageNfs(), fullPath)
      safeWebLog('fetched fileHandle: %s',fileHandle.toString())
      fileHandle = window.safeNfs.open(this.storageNfs(),fileHandle,4/* read TODO get from safeApp.CONSTANTS */)
      let openHandle = await safeWebLog('safeNfs.open() returns fileHandle: %s',fileHandle.toString())
      let size = window.safeNfsFile.size(openHandle)
      safeWebLog('safeNfsFile.size() returns size: %s',size.toString())
      let content = await window.safeNfsFile.read(openHandle,0,size)
      safeWebLog('%s bytes read from file.',content.byteLength)

      let decoder = new TextDecoder();
      let data = decoder.decode(content);
      safeWebLog('data: \'%s\'',data);

      // TODO SAFE API file-metadata - disabled for now:
      // var fileMetadata = response.getResponseHeader('file-metadata');
      // if (fileMetadata && fileMetadata.length() > 0){
      //   fileMetadata = JSON.parse(fileMetadata);
      //   safeWebLog('..file-metadata: ' + fileMetadata);
      // }

      let response = new Response({
        statusCode: 200,
        body: data,
        // TODO look into this:
        /*body: JSON.stringify(data),*/ // TODO Not sure stringify() needed, but without it local copies of nodes differ when loaded from SAFE
                                        // TODO RS ISSUE:  is it a bug that RS#get accepts a string *or an object* for body? Should it only accept a string?
        revision: etagWithoutQuotes,
        contentType: 'application/json; charset=UTF-8',   // Fairly safe default until SAFE NFS supports save/get of content type
      })

      if (fileInfo && fileInfo['Content-Type'] ){
        retResponse.contentType = fileInfo['Content-Type'];
      }
  } catch (err){
      safeWebLog('Unable to get file: %s',err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response({},{statusCode: 500,responseText:'500 Internal Server Error ('+err+')'})
    }
  }


  // Use fileHandle to insert metadata into given fileInfo
  //
  // returns a Promise which resolves to a fileInfo object
  async _makeFileInfo(fileHandle,fileInfo,fullPath){
    try {
      let fileMetadata = await window.safeNfsFile.metadata(fileHandle)
      fileInfo.created = fileMetadata.created
      fileInfo.modified = fileMetadata.modified
      fileInfo.version = fileMetadata.version
      fileInfo.dataMapName = fileMetadata.dataMapName // TODO Debug only!

      // Overwrite ETag using the file version (rather than the enry version)
      fileInfo.ETag = fullPath + '-v' + fileMetadata.version
      return fileInfo
    } catch (err){
      safeWebLog('_makeFileInfo(%s) > safeNfsFile.metadata() FAILED: %s',fullPath,err)
      throw err
    }
  }

  // Use fileHandle to update cached fileInfo with metadata
  //
  // returns a Promise which resolves to an updated fileInfo
  async _updateFileInfo(fileHandle,fullPath){
    try {
      let fileInfo = await this._getFileInfo(fullPath)
      if (fileInfo)
        return fileInfo
      else
        throw new Error('_updateFileInfo( ' + fullPath + ') - unable to update - no existing fileInfo')
    } catch (err){
        safeWebLog('unable to update file info: %s',err)
        throw err
    }
  }

  // Obtain folder listing
  //

  // TODO implement LDP formatted response https://www.w3.org/TR/ldp-primer/
  async _getFolder(fullPath,options) {
    safeWebLog('%s._getFolder(%s,%O)',this.constructor.name,fullPath,options)
    var listing = {}

    try {
      // Create listing by enumerating container keys beginning with fullPath
      const directoryEntries = [];
      let entriesHandle = await window.safeMutableData.getEntries(this.storageMd())
      await window.safeMutableDataEntries.forEach(entriesHandle, async (k, v) => {
        // Skip deleted entries
        if (v.buf.length == 0){
          // TODO try without this...
          return true;  // Next
        }
        safeWebLog('Key: ', k.toString())
        safeWebLog('Value: ', v.buf.toString('base64') )
        safeWebLog('entryVersion: ', v.version)

        var dirPath = fullPath
        if (dirPath.slice(-1) != '/')
          dirPath += '/' // Ensure a trailing slash

        key = k.toString()
        // If the folder matches the start of the key, the key is within the folder
        if (key.length > dirPath.length && key.substr(0,dirPath.length) == dirPath) {
          var remainder = key.slice(dirPath.length)
          var itemName = remainder // File name will be up to but excluding first '/'
          var firstSlash = remainder.indexOf('/')
          if (firstSlash != -1) {
            itemName = remainder.slice(0,firstSlash+1) // Directory name with trailing '/'
          }

          // Add file/directory info to cache and for return as listing
          var fullItemPath = dirPath + itemName;
          // First part of fileInfo
          var fileInfo = {
            name:       itemName,       // File or directory name
            fullPath:   fullItemPath,   // Full path including name
            entryVersion:    v.version, // mrhTODO for debug

            // Remaining members must pass test: sync.js#corruptServerItemsMap()
            ETag:       'dummy-etag-for-folder',  // Must be present, but we fake it because diretories are implied (not versioned objects)
                                                  // For folders an ETag is only useful for get: and _getFolder() ignores options so faking is ok
          }

          if (firstSlash == -1) { // File not folder
            // Files have metadata but directories DON'T (faked above)
            var metadata; // mrhTODO ??? - obtain this?
            metadata = { mimetype: 'application/json; charset=UTF-8' };  // mrhTODO fake it until implemented - should never be used
// mrhTODOx add in get file size - or maybe leave this unset, and set it when getting the file?
            fileInfo['Content-Length'] = 123456; // mrhTODO: item.size,
            fileInfo['Content-Type'] = metadata.mimetype;  // metadata.mimetype currently faked (see above) mrhTODO see next
          }
          directoryEntries.push(fileInfo)
        }
      }).then(_ => Promise.all(directoryEntries.map(async (fileInfo) => {
        safeWebLog('directoryEntries.map() with %s',JSON.stringify(fileInfo))

        if (fileInfo.fullPath.slice(-1) == '/'){
          // Directory entry:
          safeWebLog('Listing: ',fileInfo.name)
          listing[fileInfo.name] = fileInfo
        }
        else {  // File entry:
            try {
            safeWebLog('DEBUG: window.safeNfs.fetch(\'%s\')...',fileInfo.fullPath);
            let fileHandle = await window.safeNfs.fetch(this.storageNfs(),fileInfo.fullPath)
            let fileInfo = await this._makeFileInfo(fileHandle,fileInfo,fileInfo.fullPath)
            safeWebLog('file created: %s',fileInfo.created)
            safeWebLog('file modified: %s',fileInfo.modified)
            safeWebLog('file version: %s',fileInfo.version)
            safeWebLog('file dataMapName: %s',fileInfo.dataMapName.toString('base64'))

            // File entry:
            this._fileInfoCache.set(fileInfo.fullPath,fileInfo)
            safeWebLog('..._fileInfoCache.set(file: \'%s\')',fileInfo.fullPath)
            safeWebLog('Listing: ', fileInfo.name)
            listing[fileInfo.name] = fileInfo
          } catch (err){
              safeWebLog('_getFolder(\'%s\') Skipping invalid entry. Error: %s',fileInfo.fullPath,err)
          }
        }
      })));

      safeWebLog('Iteration finished')
      safeWebLog('%s._getFolder(\'%s\', ...) RESULT: listing contains %s',fullPath,JSON.stringify( listing ),this.constructor.name)
      var folderMetadata = { contentType: RS_DIR_MIME_TYPE}        // mrhTODOx - check what is expected and whether we can provide something
      return new Response({statusCode: 200, body: listing, meta: folderMetadata, contentType: RS_DIR_MIME_TYPE /*, mrhTODOx revision: folderETagWithoutQuotes*/ })
    } catch(err) {
      safeWebLog('safeNfs.getEntries(\'%s\') failed: %s',fullPath,err.status)
      // var status = (err == 'Unauthorized' ? 401 : 404); // mrhTODO
      // ideally safe-js would provide response code (possible enhancement)
      if (err.status === undefined)
          err.status = 401; // Force Unauthorised, to handle issue in safe-js:

      /* TODO review -old RS code
      if (err.status == 401){
        // Modelled on how googledrive.js handles expired token
        if (this.connected){
          this.connect();
          return resolve({statusCode: 401}); // mrhTODO should this reject
        }
      }*/
      return new Response({statusCode: err.status})
    }
  }

  // Check if file exists
  //
  // Checks if the file (fullPath) is in the _fileInfoCache(), and if
  // not found obtains a parent folder listing to check if it exists.
  // Causes update of _fileInfoCache with contents of its parent folder.
  //
  // Folders - a folder is inferred, so:
  // - a folder is deemed valid if any *file* path contains it
  // - fileInfo for a folder lacks a version or eTag
  //
  // returns a promise with
  //   if a file { path: string, ETag: string, 'Content-Length': number }
  //   if a folder { path: string, ETag: string }
  //   if root '/' { path: '/' ETag }
  //   or {} if file/folder doesn't exist
  //
  // See _getFolder() to confirm the above content values (as it creates
  // fileInfo objects)
  //
  async _getFileInfo(fullPath){
    safeWebLog('%s._getFileInfo(%s)',this.constructor.name,fullPath)
    try {
      if (fullPath === '/' )
        return { path: fullPath, ETag: 'root' } // Dummy fileInfo to stop at "root"


      if (info = await this._fileInfoCache.get(fullPath))
        return info

      // Not yet cached or doesn't exist
      // Load parent folder listing update _fileInfoCache.
      let rootVersion = window.safeMutableData.getVersion(this.storageMd())

/* TODO there seems no point calling _getFileInfo on a folder so could just
let that trigger an error in this function, then fix the call to handle differently
*/
      if (isFolder(fullPath)) {    // folder, so fake its info
        // Add file info to cache
        var fileInfo = {
          fullPath:   fullPath, // Used by _fileInfoCache() but nothing else
        }
        this._fileInfoCache.set(fullPath, fileInfo)
        return fileInfo
      }

      // Get the parent directory and test if the file is listed
      await this._getFolder(parentPath(fullPath))
      if (info = this._fileInfoCache.get(fullPath)){
        return info
      }
      else {
        // file, doesn't exist
        safeWebLog('_getFileInfo(%s) file does not exist, no fileInfo available ',fullPath)
        return null
      }
    } catch (err){
      safeWebLog('_getFileInfo(%s) > safeMutableData.getVersion() FAILED: %s',fullPath,err)
      throw err
    }
  }
}

// TODO change to export class, something like this (example rdflib Fetcher.js)
// class SafenetworkWebApi {...}
// let safeWeb = new SafenetworkWebApi()
// module.exports = SafenetworkWebApi
// module.exports.safeWeb = safeWeb

// Usage: create the web API and install the built in services
let safeWeb = new SafenetworkWebApi();

module.exports = SafenetworkWebApi
module.exports.safeWeb = safeWeb
module.exports.setSafeApi = SafenetworkWebApi.prototype.setSafeApi.bind(safeWeb)
module.exports.listContainer = SafenetworkWebApi.prototype.listContainer.bind(safeWeb)
module.exports.testsNoAuth = SafenetworkWebApi.prototype.testsNoAuth.bind(safeWeb)
module.exports.testsAfterAuth = SafenetworkWebApi.prototype.testsAfterAuth.bind(safeWeb)

// Create and export LDP service for Solid apps:
//
// TODO move this to a services loading feature

/*
// TODO remove once SafenetworkServices implemented:
let safeLDP = new SafeServiceLDP(safeWeb);

module.exports.safeLDP =  ServiceInterface.bind(safeLDP);
*/

/*
 *  Override window.fetch() in order to support safe:// URIs
 */


// Protocol handlers for fetch()
const httpFetch = require('isomorphic-fetch')
const protoFetch = require('proto-fetch')

// map protocols to fetch()
const fetch = protoFetch({
  http: httpFetch,
  https: httpFetch,
  safe: safeWeb.fetch.bind(safeWeb),
//  https: Safenetwork.fetch.bind(Safenetwork), // Debugging with SAFE mock browser
})

module.exports.protoFetch = fetch;
