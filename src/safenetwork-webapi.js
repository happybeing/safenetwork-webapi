/**
 * SAFEnetwork API for public names and web style SAFEnetwork services
 *
 * Includes tentative service implementations for www, LDP
 * Service implentations are easy to replace or add to (see ServiceInterface)
 *
 */

// TODO see TODO inside testsAuth below
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
    this._activeServices = new Map     // Map of host (profile.public-name) to a service instance
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
  safeLog('getMutableDataValues(%s,%s)...',mdHandle,key)
  try {
    let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
    let entryKey = this.makePublicNamesEntryKey(key)
    return await window.safeMutableDataEntries.get(entriesHandle, entryKey)
  } catch(err){
    safeLog("getMutableDataValues() WARNING no entry found for key '%s'", key)
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

    safeLog('setMutableDataValue(%s,%s,%s,%s)...',mdHandle,key,value,mustNotExist)
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
        await window.safeMutableDataMutation.update(mutationHandle,key,mdHandle,value.version+1)
      else
        await window.safeMutableDataMutation.insert(mutationHandle,key,mdHandle)

      await window.safeMutableData.applyEntriesMutation(mdHandle, mutationHandle)
      safeLog('Mutable Data Entry %s',(mustNotExist ? 'inserted' : 'updated'));
      return true
    } catch (err) {
      safeLog('ERROR: unable to set mutable data value: ',err)
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
    safeLog('createPublicNameAndSetupService(%s,%s,%s)...', publicName,hostProfile,serviceId)
    let createResult = undefined

    try {
      let service = this._availableServices.get(serviceId)
      if (!service){
        throw new Error('requested service \''+serviceId+'\' is not available')
      }

      createResult = await _createPublicName(publicName)
      let servicesMd = createResult.servicesMd
      delete createResult.servicesMd

      let host = publicName
      if (hostProfile != undefined && hostProfile != '')
        host = hostProfile+'.'+hostPublicName

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
    safeLog('createPublicName(%s)...', publicName)
    try {
      let createResult = await this._createPublicName(publicName)
      let servicesMd = await createResult.servicesMd
      delete createResult.servicesMd
      window.safeMutableData.free(servicesMd)
    } catch (err) {
     safeLog('Unable to create public name \''+publicName+'\': ', err)
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
    safeLog('createPublicContainer(%s,%s,%s,%s)...',rootContainer,publicName,containerName,mdTagType)
    try {
      let mdHandle = await window.safeMutableData.newRandomPublic(this.appHandle(),mdTagType)

      let entriesHandle = await window.safeMutableData.newEntries(this.appHandle())
      // TODO see if there's a way to create MD without setting a key (maybe just set metadata?)
      await window.safeMutableDataEntries.insert(entriesHandle, 'key1', 'value1')

      // TODO review this with Web Hosting Manager (where it creates a new root-www container)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read','Update','Insert','Delete','ManagePermissions'];
      let pubKey = await window.safeCrypto.getAppPubSignKey(this.appHandle())
      let pmHandle = await window.safeMutableData.newPermissions(this.appHandle())
      await window.safeMutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet)
      await window.safeMutableData.put(mdHandle, pmHandle,entriesHandle)
      let nameAndTag = await window.safeMutableData.getNameAndTag(mdHandle)
      window.safeMutableData.free(mdHandle)
      return nameAndTag
    } catch (err){
      safeLog('createPublicContainer() failed: ', err)
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
    safeLog('setupServiceServiceOnHost(%s,%s)...', host,serviceId)
    let serviceValue = undefined

    try {
      let service = this._availableServices.get(serviceId)
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
    safeLog('_createPublicName(%s)...', publicName)
    try {
      // Check for an existing entry (before creating services MD)
      let entry = null
      try {
       entry = await this.getPublicNameEntry(publicName)
      } catch (err) {} // No existing entry, so ok...

      if (entry)
        throw new Error('Can\'t create _publicNames entry, already exists for \`'+publicName+"'")

 // TODO move servicesMd commit to after, successful mutation of the _publicNames entry
      // Create a new services MD (fails if the publicName is taken)
      let servicesMdName = await this.makeServicesMdName(publicName)
      let servicesMd = await window.safeMutableData.newPublic(this.appHandle(),servicesMdName,SN_TAGTYPE_SERVICES)

/*      let servicesMutation = await window.safeMutableData.newMutation(this.appHandle())
      await window.safeMutableDataMutation.insert(servicesMutation, 'key1', 'value1')
      await window.safeMutableData.applyEntriesMutation(servicesMd, servicesMutation)
*/
      let servicesEntriesHandle = await window.safeMutableData.newEntries(this.appHandle())
      // TODO see if there's a way to create MD without setting a key (maybe just set metadata?)
      await window.safeMutableDataEntries.insert(servicesEntriesHandle, 'key1', 'value1')
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
//      await window.safeMutableDataMutation.free(servicesMutation)

      // TODO remove (test only):
      let r = await window.safeMutableData.getNameAndTag(servicesMd)
      safeLog('New Public servicesMd created with tag: ', r.type_tag, ' and name: ', r.name);

      let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
      let entryKey = this.makePublicNamesEntryKey(publicName)
      let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd)
      let namesMutation = await window.safeMutableDataEntries.mutate(entriesHandle)
      await window.safeMutableDataMutation.insert(namesMutation,entryKey,servicesMdName)
      await window.safeMutableData.applyEntriesMutation(publicNamesMd, namesMutation)
      await window.safeMutableDataMutation.free(namesMutation)

      // We've stored servicesMd in the _publicNames container, so commit servicesMd to the network
/*      let servicesMutation = await window.safeMutableData.newMutation(this.appHandle())
      await window.safeMutableDataMutation.insert(servicesMutation, 'key1', 'value1')
      await window.safeMutableData.applyEntriesMutation(servicesMd, servicesMutation)
      await window.safeMutableDataMutation.free(servicesMutation)
*/      // TODO remove (test only):
      r = await window.safeMutableData.getNameAndTag(servicesMd)
      safeLog('New Public servicesMd created with tag: ', r.type_tag, ' and name: ', r.name);

      safeLog('New _publicNames entry created for %s', publicName);
      return {
        key:        entryKey,
        value:      servicesMdName,
        'servicesMd': servicesMd,
      }
    } catch (err) {
     safeLog('_createPublicNameEntry() failed: ', err)
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
    safeLog('getServicesMdFor(%s)',host)
    try {
      let publicName = host.split('.')[1]
      if (publicName == undefined)
        publicName = host

      safeLog("host '%s' has publicName '%s'", host, publicName)

      let servicesName = await this.makeServicesMdName(publicName)
      let mdHandle = await window.safeMutableData.newPublic(this.appHandle(),servicesName,SN_TAGTYPE_SERVICES)
      if (await this.mutableDataExists(mdHandle)) {
          safeLog('Look up SUCCESS for MD XOR name: ' + servicesName)
          return mdHandle
      }
      throw new Error("services Mutable Data not found for public name '" + publicName + "'")
    } catch (err) {
      safeLog('Look up FAILED for MD XOR name: ' + this.makeServicesMdName(publicName))
      safeLog('getServicesMdFor ERROR: ', err)
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
   safeLog('getServicesMdFromContainers(%s)',host)
   try {
     let publicName = host.split('.')[1]
     if (publicName == undefined)
       publicName = host
     safeLog("host '%s' has publicName '%s'", host, publicName)

     let nameKey = this.makePublicNamesEntryKey(publicName)
     let mdHandle = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
     safeLog("_publicNames ----------- start ----------------")
     let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
     await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
       safeLog('Key: ', k.toString())
       safeLog('Value: ', v.buf.toString())
       safeLog('Version: ', v.version)
       if ( k == nameKey ){
         safeLog('Key: ' + nameKey + '- found')
         return v.buf
       }
     })
     safeLog('Key: ' + nameKey + '- NOT found')
     safeLog("getServicesMdFromContainers() - WARNING: No _publicNames entry for '%s'", publicName)
     return null
   } catch (err) {
     safeLog('getServicesMdFromContainers() ERROR: ', err)
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
    safeLog('getServiceForUri(%s)...', uri)
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
      safeLog("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName)
      let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
      safeLog("checking servicesMd entries for host '%s'", host)
      await window.safeMutableDataEntries.forEach(entriesHandle, async (k, v) => {
        safeLog('Key: ', k.toString())
        safeLog('Value: ', v.buf.toString())
        safeLog('Version: ', v.version)
        let serviceKey = k.toString()
        let serviceProfile = key.split('@')[0]
        let serviceId = key.split('@')[1]
        if (serviceId == undefined){
          serviceId = serviceKey
          serviceProfile = ''
        }

        let serviceValue = v.buf.toString()
        safeLog("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
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

      safeLog("WARNING no service setup for host '" + host + "'")
      return null
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

  // Helper to get a mutable data handle for an MD hash
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

    let name = 'testname11'
    // Entries so far: testname1 broken
    // testname2 onwards should have valid esrvicesMd (with key1/value1)
    //
    await this.listContainer('_publicNames')
    let newNameResult = await this.createPublicName(name)
    await this.listContainer('_publicNames')
    let entry = await this.getPublicNameEntry(name);
    safeLog('_publicNames entry for \'%s\':\n   Key: \'%s\'\n   Value: \'%s\'\n   Version: %s',name,entry.key,entry.valueVersion.value,entry.valueVersion.version)

/* TODO (updated29-01-2018):
[/] clarify/fix how to access an MD without creating it (see my getServicesMdFor)
    See my Dev Forum question: https://forum.safedev.org/t/safe-dom-api-how-to-access-public-mutable-data/1378?u=happybeing
[/] test what I have below
[ ] implement container creation in LDP setupServiceForHost() maybe needs params so can specify a public container
 for use and/or creation
[ ] migrate and test RS code to LDP service, but still using _public (not the LDP container)
[ ] refactor LDP service:
[ ]   1. async/await
[ ]   2. use the LDP container
[ ]   3. test update to container
[ ]   4. test access to LDP container by owner
[ ]   5. test access to LDP container by NON-owner
[ ] try to use LDP to update a container that is also accessible by www service!
[ ] fix SAFE API issue with safeNfs.create() and
[ ]   1. update first PoC (write/read block by owner only)
[ ]   2. create second PoC (which allows me to write blog, others to read it)
[ ] review usefulness of my getServicesMdFromContainers (is getServciesMdFor enough?)
*/

    await this.listAvailableServices()
    await this.listHostedServices()

    // Install an LDP service
    let profile = 'ldp'
//    name = 'testname21'
    let serviceId = 'ldp'
    let servicesMd = await this.getServicesMdFor(name)
    if (servicesMd) {
      safeLog("servicesMd for public name '%s' contains...",name)
      await this.listMd(servicesMd)

      let serviceInterface = await this.getServiceImplementation(serviceId)
      let host = profile + '.' + name

      // Set-up the servicesMD
      let serviceValue = await serviceInterface.setupServiceForHost(host,servicesMd)

      // Activate the service for this host
      let hostedService = await serviceInterface.makeServiceInstance(host,serviceValue)
      this.setActiveService(host,hostedService)

      safeLog("servicesMd for public name '%s' contains...",name)
      await this.listMd(servicesMd)
    }

    await this.listHostedServices()

    // TODO try this...
    /* Later test createPublicNameAndSetupService()
    safeLog( 'TEST createPublicNameAndSetupService()')
    let publicName = 'allatonce1'
    let createResult = this.createPublicNameAndSetupService(publiceName,'ldp')
    safeLog()'test result: %O', createResult)
    */

    safeLog('TEST END')

    } catch (err) {
      safeLog('Error: ', err)
    }

  }

  async listAvailableServices(){
   safeLog('listAvailableServices()...')
   await this._availableServices.forEach( async (v,k) => {
     safeLog("%s: '%s' - %s", k, await v.getName(), await v.getDescription())
   });
  }

  async listHostedServices(){
   safeLog('listHostedServices()...')
   await this._activeServices.forEach( async (v,k) => {
     safeLog("%s: '%s' - %s", k, await v.getName(), await v.getDescription())
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
    safeLog('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
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
    safeLog('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED',  this.constructor.name, host, serviceValue)
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
    safeLog('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
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
    safeLog('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED',  this.constructor.name, host, serviceValue)
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
    safeLog('%s._fetch(%o) calling window.webFetch()', this.constructor.name, arguments)
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
    safeLog('%s.enableService(%s,%o)',  this.constructor.name, host, servicesMd)
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
    safeLog('%s.makeServiceInstance(%s,%s)',  this.constructor.name, host, serviceValue)
    let hostService = await new this.constructor(this.safeWeb())
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
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
