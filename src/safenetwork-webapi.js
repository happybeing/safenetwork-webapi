/**
 * SAFEnetwork Web API
 *
 * Supports:
 *  - application authorisation and connection to SAFE network
 *  - safe:// URIs for any code using window.fetch()
 *  - creation of SAFE network public names and services
 *  - ability add services or override the default implementations
 *  - tentative web service implementation for LDP (Solid w/o access control)
 *    using a very slightly modified rdflib.js (github.cm/theWebalyst/rdflib.js)
 *
 * Prerequisites:
 *  - access to the SAFE browser DOM API (e.g. Peruse browser by Maidsafe)
 *    so typically your website/web app must reside at a 'safe://' URI
 */

/* TODO:
Solid + SAFE PoC
================
[/]   1. update first PoC (write/read blog by owner only)
  [/] review how to integrate with rdflib.js (maybe just mod that to allow a protoFetch to be set?)
  [ ] BUG: author avatar image does not display because browser can't access Solid service storage
[ ]   2. create second PoC (which allows me to write blog, others to read it)
  [ ] split serviceinterface and  implementations into separate files
  [ ] change SafeServiceLDP to use www service (should just work) so browser can access LDP resources
[ ] validate against LDP test suites:
    - https://w3c.github.io/ldp-testsuite/
    - https://github.com/solid/node-solid-server/tree/master/test/integration
[ ] consider (discuss with Maidsafe?)
  [ ] customise Peruse web fetch to support service 'ldp'
  [ ] submit PR for Peruse to add support for 'ldp' service
  [ ] change  SafenetworkServiceLDP back to service 'ldp'
[ ] TODO go through todos in the code...

Future
======
[ ] write up what to aim for in terms of access control (is it just MD or also ID?
    try to come up with a Solid compatible way of implementing this with SAFE functinoality
    see: https://forum.safedev.org/t/modelling-file-system-permissions-using-safe-network/1480?u=happybeing
[ ]   1. implement RemoteStorage as a SAFE service
[ ]   2. implement a simple www WebDav service (similar to LDP?)
[ ]   3. consider how to implement a file share / URL shortener as a service
[ ] thorough linting
[ ] consider refactor using express.router() (see node-solid-server) in a revised architecture

Work In Progress
----------------
[/] migrate RS code to LDP service and refactor to async/await
[/] check everything in:
    - milestone-01 SafenetworkWebApi-coded-broken
    - git tag safe-v0.03
[/] revert to an earlier vertion without problems (below)
[/] fix problems caused by switch from SafenetworkLDP to SafenetworkWebApi:
  [/] safeWeb() no longer outputs
  [/] solid-plume no longer behaves (e.g. Login > New Post etc)
[/] slowly re-instate changes to isolate problems:
    [/] SORTED: issue is with peruse-mock and 'yarn dev'
        WORKS using ~/src/safe/peruse-mock/release/linux-unpacked/peruse
[/] revert back to latest code
[/] check it now works
[/] apply standard formatting (most but not all errors fixed)
[/] create RDF response to GET container:
    [/] examine solid-server resonse to Plume get('../posts/')
    [/] implement in _getFolder() to create RDF response
[/] test main Plume features: New Post, Delete Post, Edit Post, List Posts
[ ] Outstanding GET container issues:
    [ ] look into differences (see zim comparisson solid server versus my turtle):
        - missing 'posts:'
        - each RDF resource is missing 'ldp:Resource'
        - modifiedis  missing '^^XML:dateTime'
    [ ] try using different parser if I can (to eliminate $rdf / rdflib.js) (maybe N3?)
[ ] add basic response headers (links) for each method:
    [ ] note solid-plume looks for 'User' and 'Updates-Via' but my PUT omits both
    (For comprehensive list see node-solid-server/lib/create-app.js)
    [ ] PUT. [ ] POST. [/] GET/HEAD. [ ] DELETE. [ ] OPTIONS
[ ] fix warning building solid-safenetwork - may have started when I required rdflib.js
[ ] test and debug SafenetworkWebAPi and LDP service:
[ ]   1. test update to container
[ ]   2. test access to LDP container by owner
[ ]   3. test access to LDP container by NON-owner (ie while logged out)
[/] provide app with function SafenetworkWebApi.setupServiceOnHost()
[ ] try to use LDP to update a container that is also accessible by www service!
[ ] revise setup to create default containers, see: https://github.com/solid/solid-spec/blob/master/recommendations-server.md
[ ] review CORS requirements (relevance to SAFE?): https://github.com/solid/solid-spec/blob/master/recommendations-server.md
[ ] TODO BUGS:
  [/] publish post shows 404 rather than the post, because app.js fetches a post.url which is different from the saved url (title prefixed with time)
  [ ] TODO encrypt entries (value + key) in _publicNames
      -> add encrypt param to get/set key and listMd()
      -> see https://github.com/maidsafe/safe_examples/blob/2f06aa65025a417a70cf6e93185dbe5ffcb44b9e/web_hosting_manager/app/safenet_comm/api.js#L715
  [ ] TODO safeWeb().isConnected() broken because _isConnected always false (may be fixed if I use rdflib.js SafenetworkWebApi)
  [ ] TODO disallow service creation with empty profile for all but www
  [ ] TODO [may be redundant - SAFE API changes coming] refactor to eliminate memory leaks (e.g. using 'finally')

SafenetworkWebApi
-----------------
[ ] provide documentation README.md for github
  [ ] mandate standard.js for all pull contributions
  [ ] implement a documentation build (based on source)
[ ] rename the github repo to be safenetwork-web-api
[ ] add further APIs:
  [ ] Nfs file API for www and solid services: create/update/delete
  [ ] review public name and service creation for ease of use
  [ ] APIs to enumerate services, public names, services on a public name, files in service container
[/] fix SAFE API issue with safeNfs.create() and
  see: https://forum.safedev.org/t/safenfs-create-error-first-argument-must-be-a-string-buffer-arraybuffer-array/1325/23?u=happybeing)
[ ] review ServiceInterface implementation:
  maybe move all www aspects to class SafeServiceWww (eg www name/tag_type), change SafeServiceLDP to extend SafeServiceWww

*/

localStorage.debug = '*'

// Decorated console output
const debug = require('debug')
const logApi = require('debug')('safe:web')  // Web API
const logLdp = require('debug')('safe:ldp')  // LDP service
const logTest = require('debug')('safe:test')  // Test output

const SN_TAGTYPE_SERVICES = 15001 // TODO get these from the API CONSTANTS
const SN_TAGTYPE_WWW = 15002

// TODO We might want to change SN_TAGTYPE_LDP to SN_TAGTYPE_WWW so that www fetch() works w/o this library,
// TODO unless or until Peruse can fetch() an LDP service tagtype
const SN_TAGTYPE_LDP = 80655     // Linked Data Protocol service (timbl's dob)
const SN_SERVICEID_LDP = 'ldp'

// rdflib is separated because it is only needed for the Solid service (for $rdf.graph())
const $rdf = require('rdflib')

// Libs
const safeUtils = require('./safenetwork-utils')
const mime = require('mime-types')
const ns = require('solid-namespace')($rdf)

/* eslint-disable no-unused-vars */
const isFolder = safeUtils.isFolder
const docpart = safeUtils.docpart
const pathpart = safeUtils.pathpart
const hostpart = safeUtils.hostpart
const protocol = safeUtils.protocol
const parentPath = safeUtils.parentPath
const addLink = safeUtils.addLink
const addLinks = safeUtils.addLinks
const Metadata = safeUtils.Metadata
// TODO change my code and these utils to use these npm libs:
const S = safeUtils.string
const path = safeUtils.path
const url = safeUtils.url
const getFullUri = safeUtils.getFullUri
const pathBasename = safeUtils.pathBasename
const hasSuffix = safeUtils.hasSuffix
const filenameToBaseUri = safeUtils.filenameToBaseUri
const getBaseUri = safeUtils.getBaseUri
/* eslint-enable */

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
  _public: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _publicNames: ['Read', 'Insert', 'Update', 'Delete'] // TODO maybe reduce defaults later
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
  constructor () {
    logApi('SafenetworkWebApi()')
    this._availableServices = new Map() // Map of installed services
    this.initialise()

    // An app can install additional services as needed
    // TODO update:
    // this.setServiceImplementation(new SafeServiceWww(this)) // A default service for www (passive)
    this.setServiceImplementation(new SafeServiceLDP(this))
  }

  initialise () {
    // TODO implement delete any active services

    // SAFE Network Services
    this._activeServices = new Map()    // Map of host (profile.public-name) to a service instance

    // DOM API settings and and authorisation status
    this._safeAuthUri = ''
    this._isConnected = true // TODO bugchase (should be set false here)
    this._isAuthorised = false
    this._authOnAccessDenied = false  // Used by simpleAuthorise() and fetch()

    // Application specific configuration required for authorisation
    this._safeAppConfig = {}
    this._safeAppPermissions = {}

    /*
     * Access to helpers and constants via the object (useful when <script> including this JS)
     */
    this.isFolder = isFolder
    this.docpart = docpart
    this.pathpart = pathpart
    this.hostpart = hostpart
    this.protocol = protocol
    this.parentPath = parentPath

    this.SN_TAGTYPE_LDP = SN_TAGTYPE_LDP
    this.SN_SERVICEID_LDP = SN_SERVICEID_LDP
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
  setSafeApi (appHandle) {
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
  async simpleAuthorise (appConfig, appPermissions) {
    logApi('%s.simpleAuthorise(%O,%O)...', this.constructor.name, appConfig, appPermissions)

    // TODO ??? not sure what I'm thinking here...
    // TODO probably best to have initialise called once at start so can
    // TODO access the API with or without authorisation. So: remove the
    // TODO initialise call to a separate point and only call it once on
    // TODO load. Need to change freeSafeAPI() or not call it above.
    this._authOnAccessDenied = true // Enable auth inside SafenetworkWebApi.fetch() on 401

    let tmpAppHandle
    try {
      tmpAppHandle = await window.safeApp.initialise(appConfig, (newState) => {
          // Callback for network state changes
        logApi('SafeNetwork state changed to: ', newState)
        this._isConnected = newState // TODO bugchase
      })

      this._isConnected = true // TODO to remove (see https://github.com/maidsafe/beaker-plugin-safe-app/issues/123)
      logApi('SAFEApp instance initialised and appHandle returned: ', tmpAppHandle)
      this.setSafeApi(tmpAppHandle)
      this._safeAppConfig = appConfig
      this._safeAppPermissions = (appPermissions !== undefined ? appPermissions : defaultPerms)

      // this.testsNoAuth();  // TODO remove (for test only)
      this._safeAuthUri = await window.safeApp.authorise(tmpAppHandle, this._safeAppPermissions, this._safeAppConfig.options)
      logApi('SAFEApp was authorised and authUri received: ', this._safeAuthUri)

      await window.safeApp.connectAuthorised(tmpAppHandle, this._safeAuthUri)
      logApi('SAFEApp was authorised & a session was created with the SafeNetwork')
      this._isAuthorised = true
      this.testsAfterAuth()  // TODO remove (for test only)
      return tmpAppHandle
    } catch (err) {
      logApi('WARNING: ', err)
    }

    return tmpAppHandle
  }

  // For access to SAFE API:
  appHandle () { return this._appHandle }
  safeAuthUri () { return this._safeAuthUri }
  isConnected () { return this._isConnected }
  isAuthorised () { return this._isAuthorised }
  services () { return this._availableServices }

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
  async getMutableDataValue (mdHandle, key) {
    logApi('getMutableDataValue(%s,%s)...', mdHandle, key)
    try {
      return await window.safeMutableData.get(mdHandle, key)
    } catch (err) {
      logApi("getMutableDataValue() WARNING no entry found for key '%s'", key)
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
  async setMutableDataValue (mdHandle, key, value, mustNotExist) {
    if (mustNotExist === undefined) {
      mustNotExist = true
    }

    logApi('setMutableDataValue(%s,%s,%s,%s)...', mdHandle, key, value, mustNotExist)
    let entry = null
    try {
      // Check for an existing entry (before creating services MD)
      try {
        entry = await window.safeMutableData.get(mdHandle, key)
      } catch (err) {}

      if (entry && mustNotExist) {
        throw new Error("Key '" + key + "' already exists")
      }

      let mutationHandle = await window.safeMutableData.newMutation(this.appHandle())
      if (entry) {
        await window.safeMutableDataMutation.update(mutationHandle, key, value.version + 1)
      } else {
        await window.safeMutableDataMutation.insert(mutationHandle, key, value)
      }

      await window.safeMutableData.applyEntriesMutation(mdHandle, mutationHandle)
      logApi('Mutable Data Entry %s', (mustNotExist ? 'inserted' : 'updated'))
      return true
    } catch (err) {
      logApi('WARNING - unable to set mutable data value: ', err)
      throw err
    }
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
  async getPublicNameEntry (publicName) {
    logApi('getPublicNameEntry(%s)...', publicName)
    try {
     // TODO wrap access to some MDs (eg for _publicNames container) in a getter that is passed permissions
     // TODO checks those permissions, gets the MD, and caches the value, or returns it immediately if not null
      let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
      let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd)
      let entryKey = this.makePublicNamesEntryKey(publicName)
      return {
        key: entryKey,
        valueVersion: await window.safeMutableDataEntries.get(entriesHandle, entryKey)
      }
    } catch (err) {
      logApi('getPublicNameEntry() WARNING no _publicNames entry found for: %s', publicName)
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
  async createPublicNameAndSetupService (publicName, hostProfile, serviceId) {
    logApi('createPublicNameAndSetupService(%s,%s,%s)...', publicName, hostProfile, serviceId)
    let createResult

    try {
      let service = await this._availableServices.get(serviceId)
      if (!service) {
        throw new Error('requested service \'' + serviceId + '\' is not available')
      }

      createResult = await this._createPublicName(publicName)
      let servicesMd = createResult.servicesMd

      let host = publicName
      if (hostProfile !== undefined && hostProfile !== '') { host = hostProfile + '.' + publicName }

      createResult.serviceValue = await service.setupServiceForHost(host, createResult.servicesMd)
      window.safeMutableData.free(servicesMd)
    } catch (err) {
      throw new Error('Failed to create public name with service - Error: ' + err)
    }

    return createResult
  }

  // Create/reserve a new public name
  //
  // See also createPublicNameAndSetupService()
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
  async createPublicName (publicName) {
    logApi('createPublicName(%s)...', publicName)
    try {
      let createResult = await this._createPublicName(publicName)
      let servicesMd = await createResult.servicesMd
      delete createResult.servicesMd
      window.safeMutableData.free(servicesMd)
    } catch (err) {
      logApi('Unable to create public name \'' + publicName + '\': ', err)
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
  async createPublicContainer (rootContainer, publicName, containerName, mdTagType) {
    logApi('createPublicContainer(%s,%s,%s,%s)...', rootContainer, publicName, containerName, mdTagType)
    try {
      // Check the container does not yet exist
      let rootMd = await window.safeApp.getContainer(this.appHandle(), rootContainer)
      let rootKey = '/' + rootContainer + '/' + publicName + '/' + containerName

      // Check the public container doesn't already exist
      let existingValue = null
      try {
        existingValue = await this.getMutableDataValue(rootMd, rootKey)
      } catch (err) {
      } // Ok, key doesn't exist yet
      if (existingValue) {
        throw new Error("root container '" + rootContainer + "' already has entry with key: '" + rootKey + "'")
      }

      // Create the new container
      let mdHandle = await window.safeMutableData.newRandomPublic(this.appHandle(), mdTagType)
      let entriesHandle = await window.safeMutableData.newEntries(this.appHandle())
      // TODO review this with Web Hosting Manager (where it creates a new root-www container)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read', 'Update', 'Insert', 'Delete', 'ManagePermissions']
      let pubKey = await window.safeCrypto.getAppPubSignKey(this.appHandle())
      let pmHandle = await window.safeMutableData.newPermissions(this.appHandle())
      await window.safeMutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet)
      await window.safeMutableData.put(mdHandle, pmHandle, entriesHandle)
      let nameAndTag = await window.safeMutableData.getNameAndTag(mdHandle)

      // Create an entry in rootContainer (fails if key exists for this container)
      await this.setMutableDataValue(rootMd, rootKey, nameAndTag.name.buffer)
      window.safeMutableData.free(mdHandle)
      return nameAndTag
    } catch (err) {
      logApi('unable to create public container: ', err)
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
  async setupServiceOnHost (host, serviceId) {
    logApi('setupServiceServiceOnHost(%s,%s)...', host, serviceId)
    let serviceValue

    try {
      let service = await this._availableServices.get(serviceId)
      if (!service) {
        throw new Error('requested service \'' + serviceId + '\' is not available')
      }

      let servicesMd = await this.getServicesMdFor(host)
      serviceValue = await service.setupServiceForHost(host, servicesMd)
      window.safeMutableData.free(servicesMd)
    } catch (err) {
      throw new Error('Failed to set up service \'' + serviceId + '\' - Error: ' + err)
    }

    return serviceValue
  }

  // Internal version returns a handle which must be freed by the caller
  //
  // TODO ensure publicName is valid before attempting (eg lowercase, no illegal chars)
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the new entry's key, value and handle:
  //  - key:        of the format: '_publicNames/<public-name>'
  //  - value:      the XOR name of the services entry MD for the public name
  //  - servicesMd: the handle of the newly created services MD
  async _createPublicName (publicName) {
    logApi('_createPublicName(%s)...', publicName)
    try {
      // Check for an existing entry (before creating services MD)
      let entry = null
      try {
        entry = await this.getPublicNameEntry(publicName)
      } catch (err) {} // No existing entry, so ok...

      if (entry) {
        throw new Error("Can't create _publicNames entry, already exists for `" + publicName + "'")
      }

      // Create a new services MD (fails if the publicName is taken)
      // Do this before updating _publicNames and even if that fails, we
      // still own the name so TODO check here first, if one exists that we own
      let servicesMdName = await this.makeServicesMdName(publicName)
      let servicesMd = await window.safeMutableData.newPublic(this.appHandle(), servicesMdName, SN_TAGTYPE_SERVICES)

      var enc = new TextDecoder()
      logApi('DEBUG created services MD with servicesMdName: %s', enc.decode(new Uint8Array(servicesMdName)))

      let servicesEntriesHandle = await window.safeMutableData.newEntries(this.appHandle())

      // TODO review this with Web Hosting Manager (separate into a make or init servicesMd function)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read', 'Update', 'Insert', 'Delete', 'ManagePermissions']
      let pubKey = await window.safeCrypto.getAppPubSignKey(this.appHandle())
      let pmHandle = await window.safeMutableData.newPermissions(this.appHandle())
      await window.safeMutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet)
      await window.safeMutableData.put(servicesMd, pmHandle, servicesEntriesHandle)

      // TODO do I also need to set metadata?
      // TODO - see: http://docs.maidsafe.net/beaker-plugin-safe-app/#windowsafemutabledatasetmetadata
      // TODO free stuff!
      // TODO   - pubKey? - ask why no free() functions for cyrpto library handles)
      // TODO   - servicesEntriesHandle (window.safeMutableData.newEntries doesn't say it should be freed)
      await window.safeMutableDataPermissions.free(pmHandle)

      // TODO remove (test only):
      let r = await window.safeMutableData.getNameAndTag(servicesMd)
      logApi('DEBUG new servicesMd created with tag: ', r.type_tag, ' and name: ', r.name, ' (%s)', enc.decode(new Uint8Array(r.name)))

      let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
      let entryKey = this.makePublicNamesEntryKey(publicName)
      let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd)
      let namesMutation = await window.safeMutableDataEntries.mutate(entriesHandle)
      await window.safeMutableDataMutation.insert(namesMutation, entryKey, servicesMdName)
      await window.safeMutableData.applyEntriesMutation(publicNamesMd, namesMutation)
      await window.safeMutableDataMutation.free(namesMutation)

      // TODO remove (test only):
      r = await window.safeMutableData.getNameAndTag(servicesMd)
      logApi('DEBUG new servicesMd created with tag: ', r.type_tag, ' and name: ', r.name)

      logApi('DEBUG _publicNames entry created for %s', publicName)

      logApi('DEBUG servicesMd for public name \'%s\' contains...', publicName)
      await this.listMd(servicesMd)
      logApi('DEBUG _publicNames MD contains...')
      await this.listMd(publicNamesMd)

      return {
        key: entryKey,
        value: servicesMdName,
        'servicesMd': servicesMd
      }
    } catch (err) {
      logApi('_createPublicName() failed: ', err)
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
  async mutableDataExists (mdHandle) {
    logApi('mutableDataExists(%s)', mdHandle)
    try {
      await window.safeMutableData.getVersion(mdHandle)
      return true
    } catch (err) {
      return false  // Error indicates this MD doens't exist on the network
    }
  }

  // Get the services MD for any public name or host, even ones you don't own
  //
  // This is always public, so no need to be logged in or own the public name.
  //
  // @param host (or public-name), where host=[profile.]public-name
  //
  // @returns promise which resolves to the services MD of the given name
  // You should free() the returned handle with window.safeMutableData.free
  async getServicesMdFor (host) {
    logApi('getServicesMdFor(%s)', host)
    let publicName = host.split('.')[1]
    try {
      if (publicName === undefined) {
        publicName = host
      }

      logApi("host '%s' has publicName '%s'", host, publicName)
      let servicesName = await this.makeServicesMdName(publicName)
      let mdHandle = await window.safeMutableData.newPublic(this.appHandle(), servicesName, SN_TAGTYPE_SERVICES)
      if (await this.mutableDataExists(mdHandle)) {
        var enc = new TextDecoder()
        logApi('Look up SUCCESS for MD XOR name: ' + enc.decode(new Uint8Array(servicesName)))
        return mdHandle
      }
      throw new Error("services Mutable Data not found for public name '" + publicName + "'")
    } catch (err) {
      var enc = new TextDecoder()
      logApi('Look up FAILED for MD XOR name: ' + enc.decode(new Uint8Array(await this.makeServicesMdName(publicName))))
      logApi('getServicesMdFor ERROR: ', err)
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
  async getServicesMdFromContainers (host) {
    logApi('getServicesMdFromContainers(%s)', host)
    try {
      let publicName = host.split('.')[1]
      if (publicName === undefined) {
        publicName = host
      }
      logApi("host '%s' has publicName '%s'", host, publicName)

      let nameKey = this.makePublicNamesEntryKey(publicName)
      let mdHandle = await window.safeApp.getContainer(this.appHandle(), '_publicNames')
      logApi('_publicNames ----------- start ----------------')
      let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
      await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
        logApi('Key: ', k.toString())
        logApi('Value: ', v.buf.toString())
        logApi('Version: ', v.version)
        if (k === nameKey) {
          logApi('Key: ' + nameKey + '- found')
          return v.buf
        }
      })
      logApi('Key: ' + nameKey + '- NOT found')
      logApi("getServicesMdFromContainers() - WARNING: No _publicNames entry for '%s'", publicName)
      return null
    } catch (err) {
      logApi('getServicesMdFromContainers() ERROR: ', err)
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
  async setServiceImplementation (serviceImplementation) {
    this._availableServices.set(serviceImplementation.getIdString(), serviceImplementation)
    return true
  }

  // Get the service implementation for a service if available
  //
  // @param serviceId
  //
  // @returns the ServiceInterface implementation for the service, or null
  async getServiceImplementation (serviceId) {
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
  async setActiveService (host, serviceInstance) {
    let oldService = await this.getActiveService(host)
    if (oldService) {
      oldService.freeHandles()
    }

    this._activeServices.set(host, serviceInstance)
    return true
  }

  // Get the service instance active for this host address
  //
  // @param host
  //
  // @returns the ServiceInterface implementation for the service, or null
  async getActiveService (host) {
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
  async getServiceForUri (uri) {
    logApi('getServiceForUri(%s)...', uri)
    try {
      let host = hostpart(uri)
      let service = await this._activeServices.get(host)
      if (service) {
        return service
      } // Already initialised

      // Look up the service on this host: profile.public-name
      let uriProfile = host.split('.')[0]
      let publicName = host.split('.')[1]
      if (publicName === undefined) {
        publicName = host
        uriProfile = ''
      }
      logApi("URI has profile '%s' and publicName '%s'", uriProfile, publicName)

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName)
      let entriesHandle = await window.safeMutableData.getEntries(servicesMd)
      logApi("checking servicesMd entries for host '%s'", host)
      this.hostedService = null
      await window.safeMutableDataEntries.forEach(entriesHandle, async (k, v) => {
        logApi('Key: ', k.toString())
        logApi('Value: ', v.buf.toString())
        logApi('Version: ', v.version)
        let serviceKey = k.toString()
        let serviceProfile = serviceKey.split('@')[0]
        let serviceId = serviceKey.split('@')[1]
        if (serviceId === undefined) {
          serviceId = serviceKey
          serviceProfile = ''
        }

        let serviceValue = v
        logApi("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId)
        if (serviceProfile === uriProfile) {
          let serviceFound = this._availableServices.get(serviceId)
          if (serviceFound) {
            // Use the installed service to enable the service on this host
            let newHostedService = await serviceFound.makeServiceInstance(host, serviceValue)
            this.setActiveService(host, newHostedService) // Cache the instance for subsequent uses
            logApi('Service activated - %s (serviceName: %s, serviceId: %s)', newHostedService.getDescription(), newHostedService.getName(), newHostedService.getIdString())
            this.hostedService = newHostedService
          } else {
            let errMsg = "WARNING service '" + serviceId + "' is setup on '" + host + "' but no implementation is available"
            throw new Error(errMsg)
          }
        }
      })

      if (!this.hostedService) {
        logApi("WARNING no service setup for host '" + host + "'")
      }
      return this.hostedService
    } catch (err) {
      logApi('getServiceForUri(%s) FAILED: %s', uri, err)
      return null
    } finally {
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
  async getMdFromHash (hash, tagType) {
    logApi('getMdFromHash(%s,%s)...', hash, tagType)
    try {
      return window.safeMutableData.newPublic(this.appHandle(), hash, tagType)
    } catch (err) {
      logApi('getMdFromHash() ERROR: %s', err)
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
  async makeServicesMdName (publicName) {
    logApi('makeServicesMdName(%s)', publicName)
    return window.safeCrypto.sha3Hash(this.appHandle(), publicName)
  }

  // Helper to create the key for looking up a public name entry in the _publicNames container
  //
  // @param publicName
  //
  // @returns the key as a string, corresponding to the public name's entry in _publicNames
  makePublicNamesEntryKey (publicName) {
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
  // TODO ensure hostProfile is valid before attempting (eg lowercase, no illegal chars)
  //
  // @param hostProfile prefix of a host address, which is [profile.]public-name
  // @param serviceId
  //
  // @returns the key as a string, corresponding to a service entry in a servicesMD
  makeServiceEntryKey (hostProfile, serviceId) {
    return (hostProfile + '@' + serviceId)
  }

  // ////// TODO END of 'move to Service class/implementation'

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
  async fetch (docUri, options) {
    logApi('%s.fetch(%s,%o)...', this.constructor.name, docUri, options)

    let allowAuthOn401 = false // TODO reinstate: true
    try {
      // console.assert('safe' === protocol(docUri),protocol(docUri))
      return this._fetch(docUri, options)
    } catch (err) {
      try {
        if (err.status === '401' && this._authOnAccessDenied && allowAuthOn401) {
          allowAuthOn401 = false // Once per fetch attempt
          await this.simpleAuthorise(this._safeAppConfig, this._safeAppPermissions)
          return this._fetch(docUri, options)
        }
      } catch (err) {
        logApi('WARNING: ' + err)
        throw err
      }
    }
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch (docUri, options) {
    logApi('%s._fetch(%s,%o)', this.constructor.name, docUri, options)

    let response
    try {
      let service = await this.getServiceForUri(docUri)

      if (service) {
        if (!options.method) {
          options.method = 'GET'
        }
        let handler = service.getHandler(options.method)
        response = await handler.call(service, docUri, options)
      }
    } catch (err) {
      logApi('%s._fetch() error: %s', this.constructor.name, err)
    }

    if (!response) {
      logApi('%s._fetch() - no service available, defaulting to webFetch()...', this.constructor.name)

      try {
        response = await window.safeApp.webFetch(this.appHandle(), docUri, options)
      } catch (err) {
        logApi('%s._fetch() error: %s', this.constructor.name, err)
        response = new Response(null, {status: 404, statusText: '404 Not Found'})
      }
    }

    return response
  }

  // //// TODO debugging helpers (to remove):

  testsNoAuth () {
    logTest('testsNoAuth() called!')
  }

  // TODO prototyping only for now:
  async testsAfterAuth () {
    logTest('>>>>>> T E S T S testsAfterAuth()')

    try {
      await this.listContainer('_public')
      await this.listContainer('_publicNames')

      // Change public name / host for each run (e.g. testname1 -> testname2)
//      this.test_createPublicNameAndSetupService('testname11','test','ldp')

      // This requires that the public name of the given host already exists:
//      this.test_setupServiceOnHost('testname10','ldp')
    } catch (err) {
      logTest('Error: ', err)
    }
  }

  async testServiceCreation1 (publicName) {
    logTest('>>>>>> TEST testServiceCreation1(%s)...', publicName)
    let name = publicName

    logTest('TEST: create public name')
    let newNameResult = await this.createPublicName(name)
    await this.listContainer('_publicNames')
    let entry = await this.getPublicNameEntry(name)
    logTest('_publicNames entry for \'%s\':\n   Key: \'%s\'\n   Value: \'%s\'\n   Version: %s', name, entry.key, entry.valueVersion.value, entry.valueVersion.version)
    await this.listAvailableServices()
    await this.listHostedServices()

    logTest('TEST: install service on \'%s\'', name)
    // Install an LDP service
    let profile = 'ldp'
//    name = name + '.0'
    let serviceId = 'ldp'
    let servicesMd = await this.getServicesMdFor(name)
    if (servicesMd) {
      logTest("servicesMd for public name '%s' contains...", name)
      await this.listMd(servicesMd)

      let serviceInterface = await this.getServiceImplementation(serviceId)
      let host = profile + '.' + name

      // Set-up the servicesMD
      let serviceValue = await serviceInterface.setupServiceForHost(host, servicesMd)

      // Activate the service for this host
      let hostedService = await serviceInterface.makeServiceInstance(host, serviceValue)
      this.setActiveService(host, hostedService)

      logTest("servicesMd for public name '%s' contains...", name)
      await this.listMd(servicesMd)
    }

    await this.listHostedServices()

    logTest('<<<<<< TEST END')
  }

  async test_createPublicNameAndSetupService (publicName, hostProfile, serviceId) {
    logTest('>>>>>> TEST: createPublicNameAndSetupService(%s,%s,%s)...', publicName, hostProfile, serviceId)
    let createResult = await this.createPublicNameAndSetupService(publicName, hostProfile, 'ldp')
    logTest('test result: %O', createResult)

    await this.listContainer('_publicNames')
    await this.listContainer('_public')
    await this.listHostedServices()
    logTest('<<<<<< TEST END')
  }

  async test_setupServiceOnHost (host, serviceId) {
    logTest('>>>>>> TEST setupServiceOnHost(%s,%s)', host, serviceId)
    let createResult = await this.setupServiceOnHost(host, serviceId)
    logTest('test result: %O', createResult)

    await this.listContainer('_publicNames')
    await this.listContainer('_public')
    await this.listHostedServices()
    logTest('<<<<<< TEST END')
  }

  async listAvailableServices () {
    logTest('listAvailableServices()...')
    await this._availableServices.forEach(async (v, k) => {
      logTest("%s: '%s' - %s", k, await v.getName(), await v.getDescription())
    })
  }

  async listHostedServices () {
    logTest('listHostedServices()...')
    await this._activeServices.forEach(async (v, k) => {
      logTest("%s: '%s' - %s", k, await v.getName(), await v.getDescription())
    })
  }

  async listContainer (containerName) {
    logTest('listContainer(%s)...', containerName)
    logTest(containerName + ' ----------- start ----------------')
    let mdHandle = await window.safeApp.getContainer(this.appHandle(), containerName)
    await this.listMd(mdHandle)
    logTest(containerName + '------------ end -----------------')
  }

  async listMd (mdHandle) {
    let entriesHandle = await window.safeMutableData.getEntries(mdHandle)
    await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
      logTest('Key: ', k.toString())
      logTest('Value: ', v.buf.toString())
      logTest('Version: ', v.version)
    })
  }
  // //// END of debugging helpers
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

  constructor (safeWeb) {
    this._safeWeb = safeWeb

    // Should be set in service implementation constructor:
    this._serviceConfig = {}
    this._serviceHandler = new Map()  // Map 'GET', 'PUT' etc to handler function

    // Properties which must be set by setupServiceForHost()
    this._host = ''
    this._serviceValue = ''
  }

  // Free any cached DOM API handles (should be called by anything discarding an active service)
  freeHandles () {}

  safeWeb () { return this._safeWeb }
  appHandle () { return this._safeWeb.appHandle() }
  getName () { return this.getServiceConfig().friendlyName }
  getDescription () { return this.getServiceConfig().description }
  getIdString () { return this.getServiceConfig().idString }
  getTagType () { return this.getServiceConfig().tagType }
  setHandler (method, handler) { this._serviceHandler.set(method, handler) }
  getHandler (method) {
    let handler = this._serviceHandler.get(method)
    if (handler !== undefined) {
      return handler
    }

    // Default handler when service does not provide one
    logApi('WARNING: \'%s\' not implemented for %s service (returning 405)', method, this.getName())
    return async function () {
      return new Response(null, {ok: false, status: 405, statusText: '405 Method Not Allowed'})
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
  async setupServiceForHost (host, servicesMd) {
    logApi('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
    throw new Error('ServiceInterface.setupServiceForHost() not implemented for ' + this.getName() + ' service')
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
  async makeServiceInstance (host, serviceValue) {
    logApi('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED', this.constructor.name, host, serviceValue)
    throw ('%s.makeServiceInstance() not implemented for ' + this.getName() + ' service', this.constructor.name)
    /* Example:
    let hostService = await new this.constructor(this.safeWeb())
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
    */
  }

  // Your makeServiceInstance() implementation must set the following properties:
  getHost () { return this._host }           // The host on which service is active (or null)
  getServiceConfig () { return this._serviceConfig }  // This should be a copy of this.getServiceConfig()
  getServiceSetup () { return this._serviceConfig.setupDefaults }
  getServiceValue () { return this._serviceValue }   // The serviceValue for an enabled service (or undefined)

// TODO remove _fetch() from ServiceInterface classes - now on SafenetworkWebApi
  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch () {
    logApi('%s._fetch() - NOT YET IMPLEMENTED', this.constructor.name)
    throw new Error('ServiceInterface._fetch() not implemented for ' + this.getName() + ' service')
  }
};

// Keep this service implementation here because it is simple and illustrates
// the basics of providing an implementation. Other implementations would
// probably best be in separate files.
class SafeServiceWww extends ServiceInterface {
  constructor (safeWeb) {
    super(safeWeb)

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {
      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName: 'WWW',
      description: 'www service (defers to SAFE webFetch)',

      // Service Setup - configures behaviour of setupServiceForHost()
      setupDefaults: {
        setupNfsContainer: true,        // Automatically create a file store for this host
        defaultRootContainer: '_public',  // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-www' // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // Don't change this unless you are defining a brand new service
      idString: 'www', // Uses:
                        // to direct URI to service (e.g. safe://www.somesite)
                        // identify service in _publicNames (e.g. happybeing@www)
                        // Note: SAFE WHM 0.4.4 leaves blank for www (i.e. happybeing@) (RFC needs to clarify)

      tagType: SN_TAGTYPE_WWW  // Mutable data tag type (don't change!)
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
  async setupServiceForHost (host, servicesMd) {
    // This is not implemented for www because this service is passive (see _fetch() below)
    // and so a www service must be set up using another application such as
    // the Maidsafe Web Hosting Manager example. This can't be done here
    // because the user must specify a name for a public container.
    logApi('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd)
    throw ('%s.setupServiceForHost() not implemented for ' + this.getName() + ' service', this.constructor.name)

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
  async makeServiceInstance (host, serviceValue) {
    logApi('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED', this.constructor.name, host, serviceValue)
    throw ('%s.makeServiceInstance() not implemented for ' + this.getName() + ' service', this.constructor.name)
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
  async _fetch () {
    logApi('%s._fetch(%o) calling window.safeApp.webFetch()', this.constructor.name, arguments)
    return window.safeApp.webFetch.apply(null, this.appHandle(), arguments)
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
  constructor (safeWeb) {
    super(safeWeb)

    // TODO: info expires after 5 minutes (is this a good idea?)
    this._fileInfoCache = new safeUtils.Cache(60 * 5 * 1000)

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {

      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName: 'LDP',
      description: 'LinkedData Platform (ref http://www.w3.org/TR/ldp/)',

      // Service Setup - configures behaviour of setupServiceForHost()
      setupDefaults: {
        setupNfsContainer: true,        // Automatically create a file store for this host
        defaultRootContainer: '_public',  // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-ldp' // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // SAFE Network Service Identity
      // - only change this to implementing a new service
      idString: SN_SERVICEID_LDP, // Uses:
                        // to direct URI to service (e.g. safe://ldp.somesite)
                        // identify service in _publicNames (e.g. happybeing@ldp)

      tagType: SN_TAGTYPE_LDP  // Mutable data tag type (don't change!)

    }

    // LDP config from node-solid-server/lib/ldp.js

    // TODO not sure where to put this and if to export?
    const DEFAULT_CONTENT_TYPE = 'text/turtle'
    const RDF_MIME_TYPES = [
      'text/turtle',            // .ttl
      'text/n3',                // .n3
      'text/html',              // RDFa
      'application/xhtml+xml',  // RDFa
      'application/n3',
      'application/nquads',
      'application/n-quads',
      'application/rdf+xml',    // .rdf
      'application/ld+json',    // .jsonld
      'application/x-turtle'
    ]

    if (!this.suffixAcl) {
      this.suffixAcl = '.acl'
    }
    if (!this.suffixMeta) {
      this.suffixMeta = '.meta'
    }
    this.turtleExtensions = [ '.ttl', this.suffixAcl, this.suffixMeta ]

    // Provide a handler for each supported fetch() request method ('GET', 'PUT' etc)
    //
    // Each handler is a function with same parameters and return as window.fetch()
    this.setHandler('GET', this.get)
    this.setHandler('HEAD', this.get)
    this.setHandler('PUT', this.put)
    this.setHandler('POST', this.post)
    this.setHandler('DELETE', this.delete)
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
  async setupServiceForHost (host, servicesMd) {
    logLdp('%s.setupServiceForHost(%s,%o)', this.constructor.name, host, servicesMd)
    let uriProfile = host.split('.')[0]
    let publicName = host.split('.')[1]
    if (publicName === undefined) {
      publicName = host
      uriProfile = ''
    }
    let serviceKey = this.safeWeb().makeServiceEntryKey(uriProfile, this.getIdString())

    let serviceValue = ''   // Default is do nothing
    let setup = this.getServiceConfig().setupDefaults
    if (setup.setupNfsContainer) {
      let nameAndTag = await this.safeWeb().createPublicContainer(
        setup.defaultRootContainer, publicName, setup.defaultContainerName, this.getTagType())

      serviceValue = nameAndTag.name.buffer
      await this.safeWeb().setMutableDataValue(servicesMd, serviceKey, serviceValue)
      // TODO remove this excess DEBUG:
      logLdp('Pubic name \'%s\' services:', publicName)
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
  async makeServiceInstance (host, serviceValue) {
    logLdp('%s.makeServiceInstance(%s,%s)', this.constructor.name, host, serviceValue)
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
  async storageNfs () {
    if (this._storageNfsHandle) { return this._storageNfsHandle }

    logLdp('storageNfs()')
    try {
      this._storageNfsHandle = await window.safeMutableData.emulateAs(await this.storageMd(), 'NFS')
      return this._storageNfsHandle
    } catch (err) {
      logLdp('Unable to access NFS storage for %s service: %s', this.getName(), err)
      throw (err)
    }
  }

  // Get Mutable Data handle of the service's storage container
  //
  // @returns a promise which resolves to the Mutable Handle
  async storageMd () {
    if (this._storageMd) {
      return this._storageMd
    }

    logLdp('storageMd()')
    try {
      // The service value is the address of the storage container (Mutable Data)
      this._storageMd = await window.safeMutableData.newPublic(this.appHandle(), this.getServiceValue().buf, this.getTagType())
      // TODO remove this validity check:
      await window.safeMutableData.getVersion(this._storageMd)
      return this._storageMd
    } catch (err) {
      logLdp('Unable to access Mutable Data for %s service: %s', this.getName(), err)
      throw (err)
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

  // Handle both GET and HEAD (which is like GET but does not return a body)
  async get (docUri, options) {
    options.includeBody = (options.method === 'GET')

    logLdp('%s.get(%s,%O)', this.constructor.name, docUri, options)

  /* TODO if get() returns 404 (not found) return empty listing to fake existence of empty container
    if (response.status === 404)
      logLdp('WARNING: SafenetworkLDP::_fetch() may need to return empty listing for non-existant containers')
      return response;
  */
    if (isFolder(docUri)) {
      return this._getFolder(docUri, options)
    } else {
      return this._getFile(docUri, options)
    }
  }

  // Add Solid response header links
  //
  // See node-solid-server/lib/header.js linksHandler()
  async addHeaderLinks (docUri, options, headers) {
    let fileMetadata = new Metadata()
    if (S(docUri).endsWith('/')) {
      fileMetadata.isContainer = true
      fileMetadata.isBasicContainer = true
    } else {
      fileMetadata.isResource = true
    }

    if (fileMetadata.isContainer && options.method === 'OPTIONS') {
      headers.header('Accept-Post', '*/*')
    }
    // Add ACL and Meta Link in header
    safeUtils.addLink(headers, safeUtils.pathBasename(docUri) + this.suffixAcl, 'acl')
    safeUtils.addLink(headers, safeUtils.pathBasename(docUri) + this.suffixMeta, 'describedBy')
    // Add other Link headers
    safeUtils.addLinks(headers, fileMetadata)
  }

  async put (docUri, options) {
    logLdp('%s.put(%s,%O)', this.constructor.name, docUri, options)
    let body = options.body
    let contentType = options.contentType

    // TODO Refactor to get rid of putDone...
    const putDone = async (docUri, opotions, response) => {
      try {
        // mrhTODO response.status checks for versions are untested
        logLdp('%s.put putDone(status: ' + response.status + ') for path: %s', this.constructor.name, docUri)
        if (response.status >= 200 && response.status < 300) {
          let fileInfo = await this._getFileInfo(pathpart(docUri))
          var etagWithoutQuotes = (typeof (fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined)
          let res = new Response(null,
            {status: 200,
              headers: new Headers({
                Location: docUri,
                'contentType': contentType,
                revision: etagWithoutQuotes,
                'MS-Author-Via': 'SPARQL'
              })
            })
          this.addHeaderLinks(docUri, options, res.headers)
          return res
        } else if (response.status === 412) {   // Precondition failed
          logLdp('putDone(...) conflict - resolving with status 412')
          return new Response(null, {status: 412, revision: 'conflict'})
        } else {
          throw new Error('PUT failed with status ' + response.status + ' (' + response.statusText + ')')
        }
      } catch (err) {
        logLdp('putDone() failed: ' + err)
        throw err
      }
    }

    try {
      let fileInfo = await this._getFileInfo(pathpart(docUri))
      if (fileInfo) {
        if (options && (options.ifNoneMatch === '*')) { // Entity exists, version irrelevant)
          return putDone(docUri, options, { status: 412, statusText: 'Precondition failed' })
        }
        return putDone(docUri, options, await this._updateFile(docUri, body, contentType, options))
      } else {
        return putDone(docUri, options, await this._createFile(docUri, body, contentType, options))
      }
    } catch (err) {
      logLdp('put failed: %s', err)
      throw err
    }
  }

  // TODO specialise put/post (RemoteStorage service just has put - so leave til imp RS service)
  async post (docUri, options) {
    logLdp('%s.post(%s,%O)', this.constructor.name, docUri, options)

    if (isFolder(docUri)) {
      return this._fakeCreateContainer(docUri, options)
    }

    return this.put(docUri, options)
  }

  async delete (docUri, options) {
    logLdp('%s.delete(%s,%O)', this.constructor.name, docUri, options)
    let docPath = pathpart(docUri)

    try {
      let fileInfo = await this._getFileInfo(pathpart(docUri))
      if (!fileInfo) {
        return new Response(null, {status: 404, statusText: '404 Not Found'})
      }

      var etagWithoutQuotes = (typeof (fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined)
      if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
        return new Response(null, {status: 412, revision: etagWithoutQuotes})
      }

      if (isFolder(docUri)) {
        return this._fakeDeleteContainer(docUri, options)
      }

      if (!isFolder(docPath)) {
        logLdp('safeNfs.delete() param this.storageNfs(): ' + await this.storageNfs())
        logLdp('                 param path: ' + docPath)
        logLdp('                 param version: ' + fileInfo.version)
        logLdp('                 param containerVersion: ' + fileInfo.containerVersion)
        await window.safeNfs.delete(await this.storageNfs(), docPath, fileInfo.version + 1)
        this._fileInfoCache.delete(docUri)
        return new Response(null, {status: 204, statusText: '204 No Content'})
      }
    } catch (err) {
      logLdp('%s.delete() failed: %s', err)
      this._fileInfoCache.delete(docUri)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
  }

  /*
   * Helpers for service handlers
   */

  // TODO review container emulation (create,delete,get)
  async _fakeCreateContainer (path, options) {
    logLdp('fakeCreateContainer(%s,{%o})...')
    return new Response(null, {ok: true, status: 201, statusText: '201 Created'})
  }

  // TODO this should error if the container is not empty, so check this
  // TODO (check Solid and/or LDP spec)
  async _fakeDeleteContainer (path, options) {
    logLdp('fakeDeleteContainer(%s,{%o})...')
    return new Response(null, {status: 204, statusText: '204 No Content'})
  }

  // TODO the remaining helpers should probably be re-written just for LDP because
  // TODO it was only moderately refactored from poor quality RS.js imp

  // Update file
  //
  // @returns promise which resolves to a Resonse object
  async _updateFile (docUri, body, contentType, options) {
    logLdp('%s._updateFile(\'%s\',%O,%o,%O)', this.constructor.name, docUri, body, contentType, options)
    let docPath = pathpart(docUri)

    try {
      // mrhTODO GoogleDrive only I think:
      // if ((!contentType.match(/charset=/)) &&
      //     (encryptedData instanceof ArrayBuffer || WireClient.isArrayBufferView(encryptedData))) {
      //       contentType += '; charset=binary';
      // }

      let fileInfo = await this._getFileInfo(docPath)
      if (!fileInfo) {
        // File doesn't exist so create (ref: https://stackoverflow.com/questions/630453
        return this._createFile(docUri, body, contentType, options)
      }

      var etagWithoutQuotes = (typeof (fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined)
      if (options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
        return new Response(null, {status: 412, statusText: '412 Precondition Failed', revision: etagWithoutQuotes})
      }

      // Only act on files (directories are inferred so no need to create)
      if (isFolder(docUri)) {
        // Strictly we shouldn't get here as the caller should test, but in case we do
        logLdp('WARNING: attempt to update a folder')
      } else {
        // Store content as new immutable data (pointed to by fileHandle)
        let fileHandle = await window.safeNfs.create(await this.storageNfs(), body)

        // Add file to directory (by inserting fileHandle into container)
        fileHandle = await window.safeNfs.update(await this.storageNfs(), fileHandle, docPath, fileInfo.containerVersion + 1)
        await this._updateFileInfo(fileHandle, docPath)

        // TODO implement LDP PUT response https://www.w3.org/TR/ldp-primer/
        return new Response(null, {status: (fileHandle ? 200 : 400)})
      }
    } catch (err) {
      logLdp('Unable to update file \'%s\' : %s', docUri, err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
  }

  // Create file
  //
  // @returns promise which resolves to a Resonse object
  // TODO add header links addLinks() - see node-solid-server/lib/handlers/post.js function one ()
  async _createFile (docUri, body, contentType, options) {
    logLdp('%s._createFile(\'%s\',%O,%o,%O)', this.constructor.name, docUri, body, contentType, options)
    let docPath = pathpart(docUri)

    try {
      let fileHandle = await window.safeNfs.create(await this.storageNfs(), body)
      // mrhTODOx set file metadata (contentType) - how?

      // Add file to directory (by inserting fileHandle into container)
      fileHandle = await window.safeNfs.insert(await this.storageNfs(), fileHandle, docPath)
      this._updateFileInfo(fileHandle, docPath)

      // TODO implement LDP POST response https://www.w3.org/TR/ldp-primer/
      return new Response(null, {status: 200, statusText: 'OK'})
    } catch (err) {
      logLdp('Unable to create file \'%s\' : %s', docUri, err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    }
  }

  // get the full content of file stored using safeNfs
  //
  // @param fullPath is the path of the file (according to its safeNfs entry key)
  // @param if options.includeBody is true, the response includes content (data)
  //
  // @returns a Promise which resolves to a Response object. On success, the response
  // will contain file metadata available from the safeNfs fileHandle and a
  // contentType based on the file extension
  //
  // TODO add support for content negotiation see node-solid-server/lib/handlers/get.js
  // TODO add support for data browser node-solid-server/lib/handlers/get.js
  async _getFile (docUri, options) {
    logLdp('%s._getFile(%s,%O)', this.constructor.name, docUri, options)
    let docPath = pathpart(docUri)
    let fileInfo = {}
    let fileHandle
    let retResponse
    try {
      if (!this.safeWeb().isConnected()) {
        return new Response(null, {status: 503, statusText: '503 not connected to SAFE network'})
      }

      // TODO If the options are being used to retrieve specific version
      // should we get the latest version from the API first?
      try {
        fileHandle = await window.safeNfs.fetch(await this.storageNfs(), docPath)
        logLdp('fetched fileHandle: %s', fileHandle.toString())
        fileInfo = await this._makeFileInfo(fileHandle, fileInfo, docPath)
      } catch (err) {
        return new Response(null, {status: 404, statusText: '404 File not found'})
      }
      logLdp('safeNfs.open() returns handle: %s', fileInfo.openHandle.toString())

      var etagWithoutQuotes = fileInfo.ETag
      // Request is for changed file, so if eTag matches return "304 Not Modified"
      if (options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
        return new Response(null, {status: 304, statusText: '304 Not Modified'})
      }

      var contentType = mime.lookup(docPath) || this.DEFAULT_CONTENT_TYPE
      if (safeUtils.hasSuffix(docPath, this.turtleExtensions)) {
        contentType = 'text/turtle'
      }

      let body = null
      if (options.includeBody) {
        let content = await window.safeNfsFile.read(fileInfo.openHandle, 0, fileInfo.size)
        logLdp('%s bytes read from file.', content.byteLength)

        let decoder = new TextDecoder()
        body = decoder.decode(content)
        logLdp('body: \'%s\'', body)
      }

      retResponse = new Response(body, {
        status: 200,
        statusText: 'OK',
        revision: etagWithoutQuotes,
        // TODO how to get contentType from from metadata?
        headers: new Headers({
          'Content-Type': contentType,
          container: false,
          'MS-Author-Via': 'SPARQL'
        })
      })
      this.addHeaderLinks(docUri, options, retResponse.headers) // TODO is docUri correct
      return retResponse
    } catch (err) {
      logLdp('Unable to get file: %s', err)
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response(null, {status: 500, statusText: '500 Internal Server Error (' + err + ')'})
    } finally {
      if (fileInfo.openHandle) {
        window.safeNfsFile.close(fileInfo.openHandle)
      }
      if (fileHandle) {
        window.safeNfs.free(fileHandle)
      }
    }
  }

  // Use fileHandle to insert metadata into given fileInfo
  //
  // returns a Promise which resolves to a fileInfo object
  // Note: if the fileInfo object includes an openHandle this should be closed by the caller
  async _makeFileInfo (fileHandle, fileInfo, docPath) {
    try {
      let fileMetadata = await window.safeNfsFile.metadata(fileHandle)
      fileInfo.openHandle = await window.safeNfs.open(await this.storageNfs(), fileHandle, 4/* read TODO get from safeApp.CONSTANTS */)

      fileInfo.size = await window.safeNfsFile.size(fileInfo.openHandle)
      fileInfo.created = fileMetadata.created
      fileInfo.modified = fileMetadata.modified
      fileInfo.version = fileMetadata.version
      fileInfo.ETag = fileMetadata.version
      fileInfo.dataMapName = fileMetadata.dataMapName // TODO Debug only!
      this._fileInfoCache.set(docPath, fileInfo)    // Update the cached version
      return fileInfo
    } catch (err) {
      logLdp('_makeFileInfo(%s) > safeNfsFile.metadata() FAILED: %s', docPath, err)
      throw err
    }
  }

  // Use fileHandle to update cached fileInfo with metadata
  //
  // returns a Promise which resolves to an updated fileInfo
  async _updateFileInfo (fileHandle, docPath) {
    try {
      let fileInfo = await this._makeFileInfo(fileHandle, {}, docPath)
      if (fileInfo) {
        return fileInfo
      } else { throw new Error('_updateFileInfo( ' + docPath + ') - unable to update - no existing fileInfo') }
    } catch (err) {
      logLdp('unable to update file info: %s', err)
      throw err
    }
  }

  // Obtain folder listing
  //

  async _getFolder (docUri, options) {
    logLdp('%s._getFolder(%s,%O)', this.constructor.name, docUri, options)
    let docPath = pathpart(docUri)
    let response

    // TODO delete this
    const containerPrefixes = {
      posts: '',
      ldp: 'http://www.w3.org/ns/ldp#',
      terms: 'http://purl.org/dc/terms/',
      XML: 'http://www.w3.org/2001/XMLSchema#',
      st: 'http://www.w3.org/ns/posix/stat#',
      tur: 'http://www.w3.org/ns/iana/media-types/text/turtle#'
    }

    var listing = {} // TODO listing output - to be removed now o/p is via an RDF graph
//    var rdfGraph = N3.Writer({ prefixes: containerPrefixes })
    var rdfGraph = $rdf.graph()

    // TODO Can we improve 'stat()' for container. See node-solid-server/lib/ldp-container.js addContainerStats()
let resourceGraph = rdfGraph
    rdfGraph.add(resourceGraph.sym(docUri), ns.rdf('type'), ns.ldp('BasicContainer'))
    rdfGraph.add(resourceGraph.sym(docUri), ns.rdf('type'), ns.ldp('Container'))

    try {
debug('safe:TMP')('1')
      // Create listing by enumerating container keys beginning with docPath
      const directoryEntries = []
      let entriesHandle = await window.safeMutableData.getEntries(await this.storageMd())
debug('safe:TMP')('2')
      await window.safeMutableDataEntries.forEach(entriesHandle, async (k, v) => {
        debug('safe:TMP')('3')
        // Skip deleted entries
        if (v.buf.length === 0) {
          // TODO try without this...
debug('safe:TMP')('4')
          return true  // Next
        }
        logLdp('Key: ', k.toString())
        logLdp('Value: ', v.buf.toString('base64'))
        logLdp('entryVersion: ', v.version)

        var dirPath = docPath
        if (dirPath.slice(-1) !== '/') { dirPath += '/' } // Ensure a trailing slash

        var key = k.toString()
        // If the folder matches the start of the key, the key is within the folder
        if (key.length > dirPath.length && key.substr(0, dirPath.length) === dirPath) {
          debug('safe:TMP')('5')
          var remainder = key.slice(dirPath.length)
          var itemName = remainder // File name will be up to but excluding first '/'
          var firstSlash = remainder.indexOf('/')
          if (firstSlash !== -1) {
            itemName = remainder.slice(0, firstSlash + 1) // Directory name with trailing '/'
          }

          if (options.includeBody) {
            debug('safe:TMP')('6')
            let testPath = docPath + this.suffixMeta
            let fullItemUri = docUri + itemName
            let metaFilePath

            try {
              debug('safe:TMP')('7')
/*              if (await window.safeMutableDataEntries.get(entriesHandle, testPath)) {
                metaFilePath = testPath
              }
*/            } catch (err) {
              debug('safe:TMP')('8')
            } // metaFilePath - file not found
logLdp('calling _addListingEntry for %s', itemName)
            directoryEntries.push(this._addListingEntry(rdfGraph, fullItemUri, docUri, itemName, metaFilePath))
            debug('safe:TMP')('9')
          }
        }
      })
      .then(async _ => Promise.all(directoryEntries)
      .then(async _ => {
        logLdp('Iteration finished')
//        let triples = await new $rdf.Serializer(rdfGraph).toN3(rdfGraph)

        let triples
        $rdf.serialize(null, rdfGraph, docUri, 'text/turtle',
          function (err, result) {
            if (!err) {
              triples = result
            } else {
              throw err
            }
          })

        let body = null
        if (options.includeBody) {
          body = triples
        }

        response = new Response(body,
          { status: 200,
            statusText: 'OKey dokey',
            headers: new Headers({
              'Content-Type': 'text/turtle',
              'MS-Author-Via': 'SPARQL'
            })
          })
          logLdp('%s._getFolder(\'%s\', ...) response %s body:\n %s', this.constructor.name, docUri, response.status, triples)

        return response
      }))
    } catch (err) { // TODO review error handling and responses
      logLdp('safeNfs.getEntries(\'%s\') failed: %s', docUri, err)
      // TODO are their any SAFE API codes we need to detect?
      return new Response(null, {status: 404, statusText: '404 Resource Not Found'})
    }

    return response
  }

  // Adds a entry to directory listing (file or folder to the RDF graph)
  async _addListingEntry (resourceGraph, fullItemUri, containerUri, itemName, metaFilePath) {
    logLdp('%s._addListingEntry(g,%s,%s,%s,%s)', this.constructor.name, fullItemUri, containerUri, itemName, metaFilePath)
    let fileInfo = await this._getFileInfo(pathpart(fullItemUri))
    resourceGraph = await this._addFileInfo(resourceGraph, fullItemUri, fileInfo)

    // Add to `contains` list
    let newTriple = resourceGraph.add(
      resourceGraph.sym(containerUri),
      ns.ldp('contains'),
      resourceGraph.sym(fullItemUri))

    // Set up a metaFile path
    // Earlier code used a .ttl file as its own meta file, which
    // caused massive data files to parsed as part of deirectory listings just looking for type triples
    if (metaFilePath)
      resourceGraph = this._addFileMetadata(resourcesGraph, metaFilePath, fullItemUri)

    return resourceGraph
  }

  // get LDP metadata for an LDPC container or LDPR/LDP-NR file
  //
  // @returns a Promise which resolves to an ldpMetadata
  //
  //  Note: to avoid having to parse large files, node-solid-server
  //  stores file metadata in a .meta file.
  //
  //  CONTAINERS
  //  LDP PATCH or PUT to create a container
  //  places the body of the request in a .meta file within
  //  the container, but that behaviour is due to be
  //  removed, see https://github.com/solid/node-solid-server/issues/547
  //
  //  FILES
  //  I can't find how the .meta is created, but they
  //  are read. See node-solid-server/lib/ldp-container.js addFile().
  //  @timbl (Solid gitter 26-feb-18) mentions that they are intended to
  //  allow information about a resource to be stored, and gives this
  //  example: https://www.w3.org/2012/ldp/hg/ldp-primer/ldp-primer.html#creating-a-non-rdf-binary-resource-post-an-image-to-an-ldp-bc
  //
  //  For now we could take the hit reading the whole file, but obvs
  //  for large files this becomes unacceptably onerous.
  //
  // TODO not implemented!
  //   - as file .meta seems to be little used for now
  //   - and container .meta has been dropped from the Solid spec
  //
  // Ref: node-solid-server/lib/ldp-container.js addFile()
  // TODO _getMetadataGraph() returns an $rdf.graph() which may not be compat with N3
  async _addFileMetadata (resourceGraph, metaFilePath, docUri) {
    logLdp('%s._addFileMetadata(%O,%s,%s)...', this.constructor.name, resourceGraph, metaFilePath, docUri)

    let metadataGraph = await this._getMetadataGraph(metaFilePath, docUri)

    if (metadataGraph) {
      // Add Container or BasicContainer types
      if (safeUtils.isDirectory(docUri)) {
        resourceGraph.add(metadataGraph.sym(docUri), ns.rdf('type'), ns.ldp('BasicContainer'))
        resourceGraph.add(metadataGraph.sym(docUri), ns.rdf('type'), ns.ldp('Container'))
      }
      // Add generic LDP type
      resourceGraph.add(metadataGraph.sym(docUri), ns.rdf('type'), ns.ldp('Resource'))

      // Add type from metadataGraph
      metadataGraph
        .statementsMatching(
          metadataGraph.sym(docUri),
          ns.rdf('type'),
          undefined)
        .forEach(function (typeStatement) {
          // If the current is a file and its type is BasicContainer,
          // This is not possible, so do not infer its type!
          if (
            (
              typeStatement.object.uri !== ns.ldp('BasicContainer').uri &&
              typeStatement.object.uri !== ns.ldp('Container').uri
            ) ||
            safeUtils.isFolder(docUri)
          ) {
            resourceGraph.add(
              resourceGraph.sym(docUri),
              typeStatement.predicate,
              typeStatement.object)
          }
        })
    }
  }

  async _getMetadataGraph (metaFilePath, docUri) {
    logLdp('%s._getMetadataGraph(%s,%s)...', this.constructor.name, metaFilePath, docUri)

    let fileHandle
    let fileInfo = {}
    let metadataGraph
    try {
      fileHandle = await window.safeNfs.fetch(await this.storageNfs(), metaFilePath)
    } catch (err) {}

    try {
      // Metadata file exists
      if (fileHandle) {
        fileInfo.openHandle = await window.safeNfs.open(await this.storageNfs(), fileHandle, 4/* read TODO get from safeApp.CONSTANTS */)
        let content = await window.safeNfsFile.read(fileInfo.openHandle, 0, fileInfo.size)

        if (content) {
          logLdp('%s bytes read from file.', content.byteLength)

          // TODO review: to keep lib small, we avoid require('rdflib) and leave
          // TODO for the application to assign one to $rdf member of the service interface (this)
          if (!this.$rdf) {
            throw new Error('%s has no $rdf (rdflib) object - must be set by application to support meta files')
          }

          let decoder = new TextDecoder()
          try {
            metadataGraph = this.$rdf.graph()
            $rdf.parse(
              decoder.decode(content),
              metadataGraph,
              docUri,
              'text/turtle')
          } catch (err) {
            logLdp('_getMetadataGraph(): ', err)
            logLdp('ERROR - can\'t parse metadata file: %s', metaFilePath)
          }
        }
      }
    } catch (err) {
      logLdp(err)
    } finally {
      if (fileInfo.openHandle) {
        await window.safeNfsFile.close(fileInfo.openHandle)
      }

      if (fileHandle) {
        await window.safeNfs.free(fileHandle)
      }
    }

    return metadataGraph
  }

  // SAFE NFS API file metadata comprises created, modified, version & dataMapName
  //
  // For an Solid we also need resource metadata from an optional separate meta
  // file (eg resource-filename.meta)
  //
  // See node-solid-server/lib/ldp-container.js addStats()
  async _addFileInfo (resourceGraph, reqUri, fileInfo) {
    logLdp('%s._addFileInfo(g,%s,%o)', this.constructor.name,  reqUri, fileInfo)

    resourceGraph.add(
      resourceGraph.sym(reqUri),
      ns.stat('size'),
      fileInfo.size)

    resourceGraph.add(
      resourceGraph.sym(reqUri),
      ns.dct('modified'),
      fileInfo.modified) // An actual datetime value from a Date object

    if (mime.lookup(reqUri)) { // Is the file has a well-known type,
      let type = 'http://www.w3.org/ns/iana/media-types/' + mime.lookup(reqUri) + '#Resource'
      resourceGraph.add(
        resourceGraph.sym(reqUri),
        ns.rdf('type'), // convert MIME type to RDF
        resourceGraph.sym(type)
      )
    }

    return resourceGraph
  }

  // Check if file/folder exists and if it does, returns metadata which is kept in a cache
  //
  // Checks if the file (docPath) is in the _fileInfoCache(), and if
  // not found attempts to get its metadata
  //
  // Folders - a folder is inferred, so:
  // - a folder is deemed valid if any *file* path contains it
  // - fileInfo for a folder lacks a version or eTag
  //
  // @param docPath  the path of a file/folder in the storage container
  // @param optional refreshCache, if true clears cache first
  //
  // @returns a promise with
  //   if a file { path: string, ETag: string, 'Content-Length': number, ldpMetadata: object }
  //   if a folder { path: string, ETag: string, ldpMetadata: object }
  //   if root '/' { path: '/', ETag: string, ldpMetadata: object }
  //   or {} if file/folder doesn't exist, or the cached info doesn't match version
  //
  // See _getFolder() to confirm the above content values (as it creates
  // fileInfo objects)
  //
  // TODO ??? implement version param - check if anything needs this first?
  // TODO ??? implement Solid metadata for folders (Solid uses stat())
  async _getFileInfo (docPath, refreshCache) {
    logLdp('%s._getFileInfo(%s)', this.constructor.name, docPath)
    try {
      if (refreshCache) {
        this._fileInfoCache.delete(docPath)
      }

      let fileInfo
      if (docPath !== '/') {
        fileInfo = await this._fileInfoCache.get(docPath)
        if (fileInfo) { return fileInfo }
      }
      // Not yet cached or doesn't exist

      // Folders //
      let smd = await this.storageMd()
      let rootVersion = await window.safeMutableData.getVersion(smd)
      if (docPath === '/') {
        return { path: docPath, ETag: rootVersion.toString() }
      } // Dummy fileInfo to stop at "root"

      if (isFolder(docPath)) {
        // TODO Could use _getFolder() in order to generate Solid metadata
        var folderInfo = {
          docPath: docPath // Used by _fileInfoCache() but nothing else
        }
        this._fileInfoCache.set(docPath, folderInfo)
        return folderInfo
      }

      // Files //
      let fileHandle
      try {
        fileHandle = await window.safeNfs.fetch(await this.storageNfs(), docPath)
        logLdp('_getFileInfo() - fetched fileHandle: %s', fileHandle.toString())
        fileInfo = await this._makeFileInfo(fileHandle, {}, docPath)
      } catch (err) {
        fileInfo = null
      }
      if (fileInfo && fileInfo.openHandle) {
        await window.safeNfsFile.close(fileInfo.openHandle)
        delete fileInfo.openHandle
      }

      if (fileInfo) {
        this._fileInfoCache.set(docPath, fileInfo)
        if (fileHandle) {
          window.safeNfs.free(fileHandle)
        }

        return fileInfo
      } else {
        // file, doesn't exist
        logLdp('_getFileInfo(%s) file does not exist, no fileInfo available ', docPath)
        return null
      }
    } catch (err) {
      logApi('_getFileInfo(%s) FAILED: %s', docPath, err)
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
let safeWeb = new SafenetworkWebApi()

module.exports = SafenetworkWebApi
module.exports.safeWeb = safeWeb
module.exports.setSafeApi = SafenetworkWebApi.prototype.setSafeApi.bind(safeWeb)
module.exports.listContainer = SafenetworkWebApi.prototype.listContainer.bind(safeWeb)
module.exports.testsNoAuth = SafenetworkWebApi.prototype.testsNoAuth.bind(safeWeb)
module.exports.testsAfterAuth = SafenetworkWebApi.prototype.testsAfterAuth.bind(safeWeb)

module.exports.isFolder = safeUtils.isFolder
module.exports.docpart = safeUtils.docpart
module.exports.pathpart = safeUtils.pathpart
module.exports.hostpart = safeUtils.hostpart
module.exports.protocol = safeUtils.protocol
module.exports.parentPath = safeUtils.parentPath

module.exports.SN_TAGTYPE_LDP = SN_TAGTYPE_LDP
module.exports.SN_SERVICEID_LDP = SN_SERVICEID_LDP

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
  safe: safeWeb.fetch.bind(safeWeb)
//  https: Safenetwork.fetch.bind(Safenetwork), // Debugging with SAFE mock browser
})

module.exports.protoFetch = fetch
