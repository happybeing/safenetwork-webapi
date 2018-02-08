(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["SafenetworkWebApi"] = factory();
	else
		root["SafenetworkWebApi"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

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

const SafenetworkWebApi = __webpack_require__(1);

exports = module.exports = SafenetworkWebApi;
module.exports.SafenetworkWebApi = SafenetworkWebApi;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {


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
[ ] check everything in:
    - milestone-01 SafenetworkWebApi-coded-broken
    - git tag safe-v0.03
[ ] revert to an earlier vertion without problems (below)
[ ] slowly re-instate changes to isolate problems:
    [ ] ???
    [ ]
    [ ]
[ ]
    [ ] fix problems caused by switch from SafenetworkLDP to SafenetworkWebApi:
      [ ] safeWebLog() no longer outputs
      [ ] solid-plume no longer behaves (e.g. Login > New Post etc)
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

localStorage.debug = 'safe:*';
const oldLog = __webpack_require__(2)('safe:web'); // Decorated console output
oldLog('SUDDENLY oldLog() is %s', 'working!!!!');
// While oldLog not working...
safeWebLog = function () {
  console.log.apply(null, arguments);
};

const SN_TAGTYPE_SERVICES = 15001; // TODO get these from the API CONSTANTS
const SN_TAGTYPE_WWW = 15002;
const SN_TAGTYPE_LDP = 80655; // Linked Data Protocol service (timbl's dob)

const safeUtils = __webpack_require__(6);

const isFolder = safeUtils.isFolder;
const docpart = safeUtils.docpart;
const pathpart = safeUtils.pathpart;
const hostpart = safeUtils.hostpart;
const protocol = safeUtils.protocol;
const parentPath = safeUtils.parentPath;

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


  /*
   * Web API for SAFEnetwork
   * - public IDs
   * - web services (extendable through implementation modules)
   *
   * @Params
   *  appHandle - SAFE API app handle or null
   *
   */
};class SafenetworkWebApi {
  constructor() {
    this._availableServices = new Map(); // Map of installed services
    this.initialise();

    // An app can install additional services as needed
    // TODO update:
    //this.setServiceImplementation(new SafeServiceWww(this)) // A default service for www (passive)
    this.setServiceImplementation(new SafeServiceLDP(this));
  }

  initialise() {
    // TODO implement delete any active services

    // SAFE Network Services
    this._activeServices = new Map(); // Map of host (profile.public-name) to a service instance

    // DOM API settings and and authorisation status
    this._safeAuthUri = '';
    this._isConnected = false;
    this._isAuthorised = false;
    this._authOnAccessDenied = false; // Used by simpleAuthorise() and fetch()

    // Application specific configuration required for authorisation
    // TODO how is this set?
    this._safeAppConfig = {};
    this._safeAppPermissions = {};
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
  setSafeApi(appHandle) {
    this.initialise(); // Clears active services (so DOM API handles will be discarded)
    this._appHandle = appHandle; // SAFE API application handle
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
  async simpleAuthorise(appConfig, appPermissions) {
    safeWebLog('%s.simpleAuthorise(%O,%O)...', this.constructor.name, appConfig, appPermissions);

    // TODO ??? not sure what I'm thinking here...
    // TODO probably best to have initialise called once at start so can
    // TODO access the API with or without authorisation. So: remove the
    // TODO initialise call to a separate point and only call it once on
    // TODO load. Need to change freeSafeAPI() or not call it above.
    this._safeAppConfig = appConfig;
    this._safeAppPermissions = appPermissions != undefined ? appPermissions : defaultPerms;
    this._authOnAccessDenied = true; // Enable auth inside SafenetworkWebApi.fetch() on 401

    let appHandle;
    try {
      appHandle = await window.safeApp.initialise(this._safeAppConfig, newState => {
        // Callback for network state changes
        safeWebLog('SafeNetwork state changed to: ', newState);
        this._isConnected = newState;
      });

      safeWebLog('SAFEApp instance initialised and appHandle returned: ', appHandle);
      safeWeb.setSafeApi(appHandle);
      //safeWeb.testsNoAuth();  // TODO remove (for test only)

      this._safeAuthUri = await window.safeApp.authorise(appHandle, this._safeAppPermissions, this._safeAppConfig.options);
      safeWebLog('SAFEApp was authorised and authUri received: ', this._safeAuthUri);

      await window.safeApp.connectAuthorised(appHandle, this._safeAuthUri);
      safeWebLog('SAFEApp was authorised & a session was created with the SafeNetwork');
      this._isAuthorised = true;
      safeWeb.testsAfterAuth(); // TODO remove (for test only)
      return appHandle;
    } catch (err) {
      safeWebLog('WARNING: ', err);
    }

    return appHandle;
  }

  // For access to SAFE API:
  appHandle() {
    return this._appHandle;
  }
  safeAuthUri() {
    return this._safeAuthUri;
  }
  isConnected() {
    return this._isConnected;
  }
  isAuthorised() {
    return this._isAuthorised;
  }
  appHandle() {
    return this._appHandle;
  }
  services() {
    return this._availableServices;
  }

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
  async getMutableDataValue(mdHandle, key) {
    safeWebLog('getMutableDataValue(%s,%s)...', mdHandle, key);
    try {
      return await window.safeMutableData.get(mdHandle, key);
    } catch (err) {
      safeWebLog("getMutableDataValue() WARNING no entry found for key '%s'", key);
      throw err;
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
  async setMutableDataValue(mdHandle, key, value, mustNotExist) {
    if (mustNotExist == undefined) mustNotExist = true;

    safeWebLog('setMutableDataValue(%s,%s,%s,%s)...', mdHandle, key, value, mustNotExist);
    let entry = null;
    try {
      // Check for an existing entry (before creating services MD)
      try {
        entry = await window.safeMutableData.get(mdHandle, key);
      } catch (err) {}

      if (entry && mustNotExist) throw new Error("Key '" + key + "' already exists");

      let mutationHandle = await window.safeMutableData.newMutation(this.appHandle());
      if (entry) await window.safeMutableDataMutation.update(mutationHandle, key, value.version + 1);else await window.safeMutableDataMutation.insert(mutationHandle, key, value);

      await window.safeMutableData.applyEntriesMutation(mdHandle, mutationHandle);
      safeWebLog('Mutable Data Entry %s', mustNotExist ? 'inserted' : 'updated');
      return true;
    } catch (err) {
      safeWebLog('WARNING - unable to set mutable data value: ', err);
      throw err;
    }

    return false;
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
  async getPublicNameEntry(publicName) {
    safeWebLog('getPublicNameEntry(%s)...', publicName);
    try {
      // TODO wrap access to some MDs (eg for _publicNames container) in a getter that is passed permissions
      // TODO checks those permissions, gets the MD, and caches the value, or returns it immediately if not null
      let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames');
      let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd);
      let entryKey = this.makePublicNamesEntryKey(publicName);
      return {
        key: entryKey,
        valueVersion: await window.safeMutableDataEntries.get(entriesHandle, entryKey)
      };
    } catch (err) {
      safeWebLog('getPublicNameEntry() WARNING no _publicNames entry found for: %s', publicName);
    }

    return null;
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
  async createPublicNameAndSetupService(publicName, hostProfile, serviceId) {
    safeWebLog('createPublicNameAndSetupService(%s,%s,%s)...', publicName, hostProfile, serviceId);
    let createResult = undefined;

    try {
      let service = await this._availableServices.get(serviceId);
      if (!service) {
        throw new Error('requested service \'' + serviceId + '\' is not available');
      }

      createResult = await this._createPublicName(publicName);
      let servicesMd = createResult.servicesMd;

      let host = publicName;
      if (hostProfile != undefined && hostProfile != '') host = hostProfile + '.' + publicName;

      createResult.serviceValue = await service.setupServiceForHost(host, createResult.servicesMd);
      window.safeMutableData.free(servicesMd);
    } catch (err) {
      err = new Error('ERROR failed to create public name with service: ' + err);
      throw err;
    }

    return createResult;
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
  async createPublicName(publicName) {
    safeWebLog('createPublicName(%s)...', publicName);
    try {
      let createResult = await this._createPublicName(publicName);
      let servicesMd = await createResult.servicesMd;
      delete createResult.servicesMd;
      window.safeMutableData.free(servicesMd);
    } catch (err) {
      safeWebLog('Unable to create public name \'' + publicName + '\': ', err);
      throw err;
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
  async createPublicContainer(rootContainer, publicName, containerName, mdTagType) {
    safeWebLog('createPublicContainer(%s,%s,%s,%s)...', rootContainer, publicName, containerName, mdTagType);
    try {
      // Check the container does not yet exist
      let rootMd = await window.safeApp.getContainer(this.appHandle(), rootContainer);
      let rootKey = '/' + rootContainer + '/' + publicName + '/' + containerName;

      // Check the public container doesn't already exist
      let existingValue = null;
      try {
        existingValue = await this.getMutableDataValue(rootMd, rootKey);
      } catch (err) {} // Ok, key doesn't exist yet
      if (existingValue) throw new Error("root container '" + rootContainer + "' already has entry with key: '" + rootKey + "'");

      // Create the new container
      let mdHandle = await window.safeMutableData.newRandomPublic(this.appHandle(), mdTagType);
      let entriesHandle = await window.safeMutableData.newEntries(this.appHandle());
      // TODO review this with Web Hosting Manager (where it creates a new root-www container)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read', 'Update', 'Insert', 'Delete', 'ManagePermissions'];
      let pubKey = await window.safeCrypto.getAppPubSignKey(this.appHandle());
      let pmHandle = await window.safeMutableData.newPermissions(this.appHandle());
      await window.safeMutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet);
      await window.safeMutableData.put(mdHandle, pmHandle, entriesHandle);
      let nameAndTag = await window.safeMutableData.getNameAndTag(mdHandle);

      // Create an entry in rootContainer (fails if key exists for this container)
      await this.setMutableDataValue(rootMd, rootKey, nameAndTag.name.buffer);
      window.safeMutableData.free(mdHandle);
      return nameAndTag;
    } catch (err) {
      safeWebLog('unable to create public container: ', err);
      throw err;
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
  async setupServiceOnHost(host, serviceId) {
    safeWebLog('setupServiceServiceOnHost(%s,%s)...', host, serviceId);
    let serviceValue = undefined;

    try {
      let service = await this._availableServices.get(serviceId);
      if (!service) {
        throw new Error('requested service \'' + serviceId + '\' is not available');
      }

      let servicesMd = await this.getServicesMdFor(host);
      serviceValue = await service.setupServiceForHost(host, servicesMd);
      window.safeMutableData.free(servicesMd);
    } catch (err) {
      err = new Error('ERROR unable to set up service \'' + serviceId + '\': ' + err);
      throw err;
    }

    return serviceValue;
  }

  // Internal version returns a handle which must be freed by the caller
  //
  // @param publicName
  //
  // @returns a Promise which resolves to an object containing the new entry's key, value and handle:
  //  - key:        of the format: '_publicNames/<public-name>'
  //  - value:      the XOR name of the services entry MD for the public name
  //  - servicesMd: the handle of the newly created services MD
  async _createPublicName(publicName) {
    safeWebLog('_createPublicName(%s)...', publicName);
    try {
      // Check for an existing entry (before creating services MD)
      let entry = null;
      try {
        entry = await this.getPublicNameEntry(publicName);
      } catch (err) {} // No existing entry, so ok...

      if (entry) throw new Error('Can\'t create _publicNames entry, already exists for \`' + publicName + "'");

      // Create a new services MD (fails if the publicName is taken)
      // Do this before updating _publicNames and even if that fails, we
      // still own the name so TODO check here first, if one exists that we own
      let servicesMdName = await this.makeServicesMdName(publicName);
      let servicesMd = await window.safeMutableData.newPublic(this.appHandle(), servicesMdName, SN_TAGTYPE_SERVICES);

      let servicesEntriesHandle = await window.safeMutableData.newEntries(this.appHandle());
      //TODO NEXT...
      // TODO review this with Web Hosting Manager (separate into a make or init servicesMd function)
      // TODO clarify what setting these permissions does - and if it means user can modify with another app (e.g. try with WHM)
      let pmSet = ['Read', 'Update', 'Insert', 'Delete', 'ManagePermissions'];
      let pubKey = await window.safeCrypto.getAppPubSignKey(this.appHandle());
      let pmHandle = await window.safeMutableData.newPermissions(this.appHandle());
      await window.safeMutableDataPermissions.insertPermissionsSet(pmHandle, pubKey, pmSet);
      await window.safeMutableData.put(servicesMd, pmHandle, servicesEntriesHandle);

      // TODO do I also need to set metadata?
      // TODO - see: 	http://docs.maidsafe.net/beaker-plugin-safe-app/#windowsafemutabledatasetmetadata
      // TODO free stuff!
      // TODO   - pubKey? - ask why no free() functions for cyrpto library handles)
      // TODO   - servicesEntriesHandle (window.safeMutableData.newEntries doesn't say it should be freed)
      await window.safeMutableDataPermissions.free(pmHandle);

      // TODO remove (test only):
      let r = await window.safeMutableData.getNameAndTag(servicesMd);
      safeWebLog('New Public servicesMd created with tag: ', r.type_tag, ' and name: ', r.name);

      let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames');
      let entryKey = this.makePublicNamesEntryKey(publicName);
      let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd);
      let namesMutation = await window.safeMutableDataEntries.mutate(entriesHandle);
      await window.safeMutableDataMutation.insert(namesMutation, entryKey, servicesMdName);
      await window.safeMutableData.applyEntriesMutation(publicNamesMd, namesMutation);
      await window.safeMutableDataMutation.free(namesMutation);

      // TODO remove (test only):
      r = await window.safeMutableData.getNameAndTag(servicesMd);
      safeWebLog('New Public servicesMd created with tag: ', r.type_tag, ' and name: ', r.name);

      safeWebLog('New _publicNames entry created for %s', publicName);
      return {
        key: entryKey,
        value: servicesMdName,
        'servicesMd': servicesMd
      };
    } catch (err) {
      safeWebLog('_createPublicNameEntry() failed: ', err);
      throw err;
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
  async mutableDataExists(mdHandle) {
    try {
      await window.safeMutableData.getVersion(mdHandle);
      return true;
    } catch (err) {
      return false; // Error indicates this MD doens't exist on the network
    }

    return false;
  }

  // Get the services MD for any public name or host, even ones you don't own
  //
  // This is always public, so no need to be logged in or own the public name.
  //
  // @param host (or public-name), where host=[profile.]public-name
  //
  // @returns promise which resolves to the services MD of the given name
  // You should free() the returned handle with window.safeMutableData.free
  async getServicesMdFor(host) {
    safeWebLog('getServicesMdFor(%s)', host);
    let publicName = host.split('.')[1];
    try {
      if (publicName == undefined) publicName = host;

      safeWebLog("host '%s' has publicName '%s'", host, publicName);

      let servicesName = await this.makeServicesMdName(publicName);
      let mdHandle = await window.safeMutableData.newPublic(this.appHandle(), servicesName, SN_TAGTYPE_SERVICES);
      if (await this.mutableDataExists(mdHandle)) {
        safeWebLog('Look up SUCCESS for MD XOR name: ' + servicesName);
        return mdHandle;
      }
      throw new Error("services Mutable Data not found for public name '" + publicName + "'");
    } catch (err) {
      safeWebLog('Look up FAILED for MD XOR name: ' + (await this.makeServicesMdName(publicName)));
      safeWebLog('getServicesMdFor ERROR: ', err);
      throw err;
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
  async getServicesMdFromContainers(host) {
    safeWebLog('getServicesMdFromContainers(%s)', host);
    try {
      let publicName = host.split('.')[1];
      if (publicName == undefined) publicName = host;
      safeWebLog("host '%s' has publicName '%s'", host, publicName);

      let nameKey = this.makePublicNamesEntryKey(publicName);
      let mdHandle = await window.safeApp.getContainer(this.appHandle(), '_publicNames');
      safeWebLog("_publicNames ----------- start ----------------");
      let entriesHandle = await window.safeMutableData.getEntries(mdHandle);
      await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
        safeWebLog('Key: ', k.toString());
        safeWebLog('Value: ', v.buf.toString());
        safeWebLog('Version: ', v.version);
        if (k == nameKey) {
          safeWebLog('Key: ' + nameKey + '- found');
          return v.buf;
        }
      });
      safeWebLog('Key: ' + nameKey + '- NOT found');
      safeWebLog("getServicesMdFromContainers() - WARNING: No _publicNames entry for '%s'", publicName);
      return null;
    } catch (err) {
      safeWebLog('getServicesMdFromContainers() ERROR: ', err);
      throw err;
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
  async setServiceImplementation(serviceImplementation) {
    this._availableServices.set(serviceImplementation.getIdString(), serviceImplementation);
    return true;
  }

  // Get the service implementation for a service if available
  //
  // @param serviceId
  //
  // @returns the ServiceInterface implementation for the service, or null
  async getServiceImplementation(serviceId) {
    return this._availableServices.get(serviceId);
  }

  // Make service active for a host address
  //
  // - replaces an active service instance if present
  //
  // @param host
  // @param a service instance which handles service requests for this host
  //
  // @returns a promise which resolves to true
  async setActiveService(host, serviceInstance) {
    let oldService = await this.getActiveService(host);
    if (oldService) oldService.freeHandles();

    this._activeServices.set(host, serviceInstance);
    return true;
  }

  // Get the service instance active for this host address
  //
  // @param host
  //
  // @returns the ServiceInterface implementation for the service, or null
  async getActiveService(host) {
    return this._activeServices.get(host);
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
  async getServiceForUri(uri) {
    safeWebLog('getServiceForUri(%s)...', uri);
    try {
      let host = hostpart(uri);
      if (this._activeServices.get(host) != undefined) return this._activeServices.get(host); // Already initialised

      // Lookup the service on this host: profile.public-name
      let uriProfile = host.split('.')[0];
      let publicName = host.split('.')[1];
      if (publicName == undefined) {
        publicName = host;
        uriProfile = '';
      }
      safeWebLog("URI has profile '%s' and publicName '%s'", uriProfile, publicName);

      // Get the services MD for publicName
      let servicesMd = await this.getServicesMdFor(publicName);
      let entriesHandle = await window.safeMutableData.getEntries(mdHandle);
      safeWebLog("checking servicesMd entries for host '%s'", host);
      await window.safeMutableDataEntries.forEach(entriesHandle, async (k, v) => {
        safeWebLog('Key: ', k.toString());
        safeWebLog('Value: ', v.buf.toString());
        safeWebLog('Version: ', v.version);
        let serviceKey = k.toString();
        let serviceProfile = key.split('@')[0];
        let serviceId = key.split('@')[1];
        if (serviceId == undefined) {
          serviceId = serviceKey;
          serviceProfile = '';
        }

        let serviceValue = v.buf.toString();
        safeWebLog("checking: serviceProfile '%s' has serviceId '%s'", serviceProfile, serviceId);
        if (serviceProfile == uriProfile) {
          let serviceFound = this._availableServices.get(serviceId);
          if (serviceFound) {
            // Use the installed service to enable the service on this host
            let hostedService = await serviceFound.makeServiceInstance(host, serviceValue);
            this.setActiveService(host, hostedService); // Cache the instance for subsequent uses
            return hostedService;
          } else {
            let errMsg = "WARNING service '" + serviceId + "' is setup on '" + host + "' but no implementation is available";
            throw new Error(errMsg);
          }
        }
      });

      safeWebLog("WARNING no service setup for host '" + host + "'");
      return null;
    } catch (err) {
      safeWebLog('getServiceForUri(%s) FAILED: %s', uri, err);
      throw err;
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
  async getMdFromHash(hash, tagType) {
    safeWebLog('getMdFromHash(%s,%s)...', hash, tagType);
    try {
      return window.safeMutableData.newPublic(this.appHandle(), hash, tagType);
    } catch (err) {
      safeWebLog('getMdFromHash() ERROR: %s', err);
      throw err;
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
  async makeServicesMdName(publicName) {
    return window.safeCrypto.sha3Hash(this.appHandle(), publicName);
  }

  // Helper to create the key for looking up a public name entry in the _publicNames container
  //
  // @param publicName
  //
  // @returns the key as a string, corresponding to the public name's entry in _publicNames
  makePublicNamesEntryKey(publicName) {
    return '_publicNames/' + publicName;
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
  makeServiceEntryKey(hostProfile, serviceId) {
    return hostProfile + '@' + serviceId;
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
  async fetch(docUri, options) {
    safeWebLog('%s.fetch(%s,%o)...', this.constructor.name, docUri, options);
    // TODO remove:
    //    return httpFetch(docUri,options) // TESTING so pass through

    try {
      //console.assert('safe' == protocol(docUri),protocol(docUri))
      let allowAuthOn401 = false; // TODO reinstate: true
      return this._fetch(docUri, options);
    } catch (err) {
      try {
        if (err.status == '401' && this._authOnAccessDenied && allowAuthOn401) {
          allowAuthOn401 = false; // Once per fetch attempt
          await this.simpleAuthorise(this._safeAppConfig, this._safeAppPermissions);
          return this._fetch(docUri, options);
        }
      } catch (err) {
        safeWebLog('WARNING: ' + err);
        throw err;
      }
    }
  }

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch(docUri, options) {
    safeWebLog('%s.fetch(%s,%o)', this.constructor.name, docUri, options);
    let service = await getServiceForUri(docUri);
    if (service) {
      let handler = service.getHandler(options.method);
      return handler.call(service, docUri, options);
    } else return this.safeApp().webFetch(docUri, options);
  }

  ////// TODO debugging helpers (to remove):

  testsNoAuth() {
    safeWebLog('testsNoAuth() called!');
  }

  // TODO prototyping only for now:
  async testsAfterAuth() {
    safeWebLog('>>>>>> T E S T S testsAfterAuth()');

    try {
      await this.listContainer('_public');
      await this.listContainer('_publicNames');

      // Change public name / host for each run (e.g. testname1 -> testname2)
      //      this.test_createPublicNameAndSetupService('testname11','test','ldp')

      // This requires that the public name of the given host already exists:
      //      this.test_setupServiceOnHost('testname10','ldp')
    } catch (err) {
      safeWebLog('Error: ', err);
    }
  }

  async testServiceCreation1(publicName) {
    safeWebLog('>>>>>> TEST testServiceCreation1(%s)...', publicName);
    let name = publicName;

    safeWebLog('TEST: create public name');
    let newNameResult = await this.createPublicName(name);
    await this.listContainer('_publicNames');
    let entry = await this.getPublicNameEntry(name);
    safeWebLog('_publicNames entry for \'%s\':\n   Key: \'%s\'\n   Value: \'%s\'\n   Version: %s', name, entry.key, entry.valueVersion.value, entry.valueVersion.version);
    await this.listAvailableServices();
    await this.listHostedServices();

    safeWebLog('TEST: install service on \'%s\'', name);
    // Install an LDP service
    let profile = 'ldp';
    //    name = name + '.0'
    let serviceId = 'ldp';
    let servicesMd = await this.getServicesMdFor(name);
    if (servicesMd) {
      safeWebLog("servicesMd for public name '%s' contains...", name);
      await this.listMd(servicesMd);

      let serviceInterface = await this.getServiceImplementation(serviceId);
      let host = profile + '.' + name;

      // Set-up the servicesMD
      let serviceValue = await serviceInterface.setupServiceForHost(host, servicesMd);

      // Activate the service for this host
      let hostedService = await serviceInterface.makeServiceInstance(host, serviceValue);
      this.setActiveService(host, hostedService);

      safeWebLog("servicesMd for public name '%s' contains...", name);
      await this.listMd(servicesMd);
    }

    await this.listHostedServices();

    safeWebLog('<<<<<< TEST END');
  }

  async test_createPublicNameAndSetupService(publicName, hostProfile, serviceId) {
    safeWebLog('>>>>>> TEST: createPublicNameAndSetupService(%s,%s,%s)...', publicName, hostProfile, serviceId);
    let createResult = await this.createPublicNameAndSetupService(publicName, hostProfile, 'ldp');
    safeWebLog('test result: %O', createResult);

    await this.listContainer('_publicNames');
    await this.listContainer('_public');
    await this.listHostedServices();
    safeWebLog('<<<<<< TEST END');
  }

  async test_setupServiceOnHost(host, serviceId) {
    safeWebLog('>>>>>> TEST setupServiceOnHost(%s,%s)', host, serviceId);
    let createResult = await this.setupServiceOnHost(host, serviceId);
    safeWebLog('test result: %O', createResult);

    await this.listContainer('_publicNames');
    await this.listContainer('_public');
    await this.listHostedServices();
    safeWebLog('<<<<<< TEST END');
  }

  async listAvailableServices() {
    safeWebLog('listAvailableServices()...');
    await this._availableServices.forEach(async (v, k) => {
      safeWebLog("%s: '%s' - %s", k, (await v.getName()), (await v.getDescription()));
    });
  }

  async listHostedServices() {
    safeWebLog('listHostedServices()...');
    await this._activeServices.forEach(async (v, k) => {
      safeWebLog("%s: '%s' - %s", k, (await v.getName()), (await v.getDescription()));
    });
  }

  async listContainer(containerName) {
    safeWebLog('listContainer(%s)...', containerName);
    let mdHandle = await window.safeApp.getContainer(this.appHandle(), containerName);
    safeWebLog(containerName + " ----------- start ----------------");
    await this.listMd(mdHandle);
    safeWebLog(containerName + "------------ end -----------------");
  }

  async listMd(mdHandle) {
    let entriesHandle = await window.safeMutableData.getEntries(mdHandle);
    await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
      safeWebLog('Key: ', k.toString());
      safeWebLog('Value: ', v.buf.toString());
      safeWebLog('Version: ', v.version);
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
    this._safeWeb = safeWeb;

    // Should be set in service implementation constructor:
    this._serviceConfig = {};
    this._serviceHandler = new Map(); // Map 'GET', 'PUT' etc to handler function

    // Properties which must be set by setupServiceForHost()
    this._host = '';
    this._serviceValue = '';
  }

  // Free any cached DOM API handles (should be called by anything discarding an active service)
  freeHandles() {}

  safeWeb() {
    return this._safeWeb;
  }

  getName() {
    return this.getServiceConfig().friendlyName;
  }
  getDescription() {
    return this.getServiceConfig().description;
  }
  getIdString() {
    return this.getServiceConfig().idString;
  }
  getTagType() {
    return this.getServiceConfig().tagType;
  }
  setHandler(method, handler) {
    this._serviceHandler.set(method, handler);
  }
  getHandler(method) {
    let handler = this._serviceHandler.get(method);
    if (handler != undefined) return handler;

    // Default handler when service does not provide one
    return async function () {
      return new Response({}, { ok: false, status: 405, statusText: '405 Method Not Allowed' });
    };
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
  async setupServiceForHost(host, servicesMd) {
    safeWebLog('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd);
    throw 'ServiceInterface.setupServiceForHost() not implemented for ' + this.getName() + ' service';
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
  async makeServiceInstance(host, serviceValue) {
    safeWebLog('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED', this.constructor.name, host, serviceValue);
    throw '%s.makeServiceInstance() not implemented for ' + this.getName() + ' service', this.constructor.name;
    /* Example:
    let hostService = await new this.constructor(this.safeWeb())
    hostService._host = host
    hostService._serviceConfig = this.getServiceConfig()
    hostService._serviceValue = serviceValue
    return hostService
    */
  }

  // Your makeServiceInstance() implementation must set the following properties:
  getHost() {
    return this._host;
  } // The host on which service is active (or null)
  getServiceConfig() {
    return this._serviceConfig;
  } // This should be a copy of this.getServiceConfig()
  getServiceSetup() {
    return this._serviceConfig.setupDefaults;
  }
  getServiceValue() {
    return this._serviceValue;
  } // The serviceValue for an enabled service (or undefined)

  // TODO remove _fetch() from ServiceInterface classes - now on SafenetworkWebApi
  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  async _fetch() {
    safeWebLog('%s._fetch() - NOT YET IMPLEMENTED', this.constructor.name, servicesMd);
    throw 'ServiceInterface._fetch() not implemented for ' + this.getName() + ' service';
  }

};

// Keep this service implementation here because it is simple and illustrates
// the basics of providing an implementation. Other implementations would
// probably best be in separate files.
class SafeServiceWww extends ServiceInterface {
  constructor(safeWeb) {
    super(safeWeb);

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {
      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName: "WWW",
      description: "www service (defers to SAFE webFetch)",

      // Service Setup - configures behaviour of setupServiceForHost()
      setupDefaults: {
        setupNfsContainer: true, // Automatically create a file store for this host
        defaultRootContainer: '_public', // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-www' // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // Don't change this unless you are defining a brand new service
      idString: 'www', // Uses:
      // to direct URI to service (e.g. safe://www.somesite)
      // identify service in _publicNames (e.g. happybeing@www)
      // Note: SAFE WHM 0.4.4 leaves blank for www (i.e. happybeing@) (RFC needs to clarify)

      tagType: SN_TAGTYPE_WWW // Mutable data tag type (don't change!)
    };
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
  async setupServiceForHost(host, servicesMd) {
    // This is not implemented for www because this service is passive (see _fetch() below)
    // and so a www service must be set up using another application such as
    // the Maidsafe Web Hosting Manager example. This can't be done here
    // because the user must specify a name for a public container.
    safeWebLog('%s.setupServiceForHost(%s,%o) - NOT YET IMPLEMENTED', host, this.constructor.name, servicesMd);
    throw '%s.setupServiceForHost() not implemented for ' + this.getName() + ' service', this.constructor.name;

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
  async makeServiceInstance(host, serviceValue) {
    safeWebLog('%s.makeServiceInstance(%s,%s) - NOT YET IMPLEMENTED', this.constructor.name, host, serviceValue);
    throw '%s.makeServiceInstance() not implemented for ' + this.getName() + ' service', this.constructor.name;
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
  async _fetch() {
    safeWebLog('%s._fetch(%o) calling window.webFetch()', this.constructor.name, arguments);
    return window.webFetch.apply(null, arguments);
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
  constructor(safeWeb) {
    super(safeWeb);

    // Service configuration (maps to a SAFE API Service)
    this._serviceConfig = {

      // UI - to help identify the service in user interface
      //    - don't match with these in code (use the idString or tagType)
      friendlyName: "LDP",
      description: "LinkedData Platform (http://www.w3.org/TR/ldp/)",

      // Service Setup - configures behaviour of setupServiceForHost()
      setupDefaults: {
        setupNfsContainer: true, // Automatically create a file store for this host
        defaultRootContainer: '_public', // ...in container (e.g. _public, _documents, _pictures etc.)
        defaultContainerName: 'root-ldp' // ...container key: 'root-www' implies key of '_public/<public-name>/root-www'
      },

      // SAFE Network Service Identity
      // - only change this to implementing a new service
      idString: 'ldp', // Uses:
      // to direct URI to service (e.g. safe://ldp.somesite)
      // identify service in _publicNames (e.g. happybeing@ldp)

      tagType: SN_TAGTYPE_LDP // Mutable data tag type (don't change!)


      // Provide a handler for each supported fetch() request method ('GET', 'PUT' etc)
      //
      // Each handler is a function with same parameters and return as window.fetch()
    };this.setHandler('GET', this.get);
    this.setHandler('PUT', this.put);
    this.setHandler('POST', this.post);
    this.setHandler('DELETE', this.delete);
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
  async setupServiceForHost(host, servicesMd) {
    safeWebLog('%s.setupServiceForHost(%s,%o)', this.constructor.name, host, servicesMd);
    let uriProfile = host.split('.')[0];
    let publicName = host.split('.')[1];
    if (publicName == undefined) {
      publicName = host;
      uriProfile = '';
    }
    let serviceKey = this.safeWeb().makeServiceEntryKey(uriProfile, this.getIdString());

    let serviceValue = ''; // Default is do nothing
    let setup = this.getServiceConfig().setupDefaults;
    if (setup.setupNfsContainer) {
      let nameAndTag = await this.safeWeb().createPublicContainer(setup.defaultRootContainer, publicName, setup.defaultContainerName, this.getTagType());

      serviceValue = nameAndTag.name.buffer;
      await this.safeWeb().setMutableDataValue(servicesMd, serviceKey, serviceValue);
      // TODO remove this excess DEBUG:
      safeWebLog('Pubic name \'%s\' services:', publicName);
      await this.safeWeb().listMd(servicesMd);
    }
    return serviceValue;
  }

  // TODO copy theses function header comments to above, (also example code)
  // Create an instance of a service inistalised for a given host
  //  - create and intitialise a new instance of this service implementation
  //
  // @param serviceValue  from the services MD for this host
  //
  // @returns a promise which resolves to a new instance of this service for the given host
  async makeServiceInstance(host, serviceValue) {
    safeWebLog('%s.makeServiceInstance(%s,%s)', this.constructor.name, host, serviceValue);
    let hostService = await new this.constructor(this.safeWeb());
    hostService._host = host;
    hostService._serviceConfig = this.getServiceConfig();
    hostService._serviceValue = serviceValue;
    return hostService;
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
  async storageNfs() {
    if (_storageNfsHandle) return await _storageNfsHandle;

    safeWebLog('storageNfs()');
    try {
      let _storageNfsHandle = window.safeMutableData.emulateAs(this.storageMd(), 'NFS');
      return _storageNfsHandle;
    } catch (err) {
      safeWebLog('Unable to access NFS storage for %s service: %s', this.getName(), err);
      throw err;
    }
  }

  // Get Mutable Data handle of the service's storage container
  //
  // @returns a promise which resolves to the Mutable Handle
  async storageMd() {
    if (_storageMd) return await _storageMd;

    safeWebLog('storageMd()');
    try {
      // The service value is the address of the storage container (Mutable Data)
      this._storageMd = window.safeMutableData.newPublic(this.appHandle(), this.getServiceValue(), this.getTagType());
      return this._storageMd;
    } catch (err) {
      safeWebLog('Unable to access Mutable Data for %s service: %s', this.getName(), err);
      throw err;
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

  async get(docUri, options) {
    safeWebLog('%s.get(%s,%O)', this.constructor.name, docUri, options);
    let path = pathpart(docUri);

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

  async put(docUri, options) {
    safeWebLog('%s.put(%s,%O)', this.constructor.name, docUri, options);
    let path = pathpart(docUri);

    let body = options.body;
    let contentType = options.contentType;

    // TODO Refactor to get rid of putDone...
    const putDone = async response => {
      safeWebLog('%s.put putDone(statusCode: ' + response.statusCode + ') for path: %s', this.constructor.name, path);

      try {
        // mrhTODO response.statusCode checks for versions are untested
        if (response.statusCode >= 200 && response.statusCode < 300) {
          let fileInfo = await this._getFileInfo(path);
          var etagWithoutQuotes = typeof fileInfo.ETag === 'string' ? fileInfo.ETag : undefined;
          return new Response({}, { statusCode: 200, 'contentType': contentType, revision: etagWithoutQuotes });
        } else if (response.statusCode === 412) {
          // Precondition failed
          safeWebLog('putDone(...) conflict - resolving with statusCode 412');
          return new Response({}, { statusCode: 412, revision: 'conflict' });
        } else {
          throw new Error("PUT failed with status " + response.statusCode + " (" + response.responseText + ")");
        }
      } catch (err) {
        safeWebLog('putDone() failed: ' + err);
        throw err;
      }
    };

    try {
      let fileInfo = await this._getFileInfo(path);
      if (fileInfo) {
        if (options && options.ifNoneMatch === '*') {
          return putDone({ statusCode: 412 }); // Precondition failed
          // (because entity exists,
          // version irrelevant)
        }
        return putDone(this._updateFile(path, body, contentType, options));
      } else {
        return putDone(this._createFile(path, body, contentType, options));
      }
    } catch (err) {
      safeWebLog('put failed: %s', err);
      throw err;
    }
  }

  // TODO specialise put/post (RemoteStorage service just has put - so leave til imp RS service)
  async post(docUri, options) {
    safeWebLog('%s.post(%s,%O)', this.constructor.name, docUri, options);
    let path = pathpart(docUri);

    if (isFolder(docPath)) return this._fakeCreateContainer(docPath, options);

    return this.put(docUri, options);
  }

  async delete(docUri, options) {
    safeWebLog('%s.delete(%s,%O)', this.constructor.name, docUri, options);
    let path = pathpart(docUri);

    if (isFolder(path)) return this._fakeDeleteContainer(path, options);

    try {
      let fileInfo = await this._getFileInfo(path);
      if (!fileInfo) {
        // Resource doesn't exist
        return new Response({ statusCode: 404, responseText: '404 Not Found' });
      }

      var etagWithoutQuotes = typeof fileInfo.ETag === 'string' ? fileInfo.ETag : undefined;
      if (ENABLE_ETAGS && options && options.ifMatch && options.ifMatch !== etagWithoutQuotes) {
        return new Response({}, { statusCode: 412, revision: etagWithoutQuotes });
      }

      if (!isFolder(path)) {
        safeWebLog('safeNfs.delete() param this.storageNfs(): ' + this.storageNfs());
        safeWebLog('                 param path: ' + path);
        safeWebLog('                 param version: ' + fileInfo.version);
        safeWebLog('                 param containerVersion: ' + fileInfo.containerVersion);
        await window.safeNfs.delete(this.storageNfs(), path, fileInfo.version + 1);
        this._fileInfoCache.delete(path);
        return new Response({ statusCode: 204, responseText: '204 No Content' });
      }
    } catch (err) {
      safeWebLog('%s.delete() failed: %s', err);
      this._fileInfoCache.delete(path);
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response({}, { statusCode: 500, responseText: '500 Internal Server Error (' + err + ')' });
    }
  }

  /*
   * Helpers for service handlers
   */

  async _fakeCreateContainer(path, options) {
    safeWebLog('fakeCreateContainer(%s,{%o})...');
    return new Response({ ok: true, status: 201, statusText: '201 Created' });
  }

  async _fakeDeleteContainer(path, options) {
    safeWebLog('fakeDeleteContainer(%s,{%o})...');
    return new Response({ statusCode: 204, responseText: '204 No Content' });
  }

  // TODO the remaining helpers should probably be re-written just for LDP because
  // TODO it was only moderately refactored from poor quality RS.js imp

  // Update file
  //
  // @returns promise which resolves to a Resonse object
  async _updateFile(fullPath, body, contentType, options) {
    safeWebLog('%s._updateFile(\'%s\',%O,%o,%O)', this.constructor.name, fullPath, body, contentType, options);
    try {
      // mrhTODO GoogleDrive only I think:
      // if ((!contentType.match(/charset=/)) &&
      //     (encryptedData instanceof ArrayBuffer || WireClient.isArrayBufferView(encryptedData))) {
      //       contentType += '; charset=binary';
      // }

      let fileInfo = await this._getFileInfo(fullPath);
      if (!fileInfo) {
        // File doesn't exist so create (ref: https://stackoverflow.com/questions/630453
        return this._createFile(fullPath, body, contentType, options);
      }

      var etagWithoutQuotes = typeof fileInfo.ETag === 'string' ? fileInfo.ETag : undefined;
      if (options && options.ifMatch && options.ifMatch !== etagWithoutQuotes) {
        return new Response({ statusCode: 412, statusText: '412 Precondition Failed', revision: etagWithoutQuotes });
      }

      // Only act on files (directories are inferred so no need to create)
      if (isFolder(fullPath)) {
        // Strictly we shouldn't get here as the caller should test, but in case we do
        safeWebLog('WARNING: attempt to update a folder');
      } else {
        // Store content as new immutable data (pointed to by fileHandle)
        let fileHandle = await window.safeNfs.create(this.storageNfs(), body);
        // TODO set file metadata (contentType) - how?

        // Add file to directory (by inserting fileHandle into container)
        fileHandle = await window.safeNfs.update(this.storageNfs(), fileHandle, fullPath, fileInfo.containerVersion + 1);
        await this._updateFileInfo(fileHandle, fullPath);
        var response = { statusCode: fileHandle ? 200 : 400 };
        // mrhTODO currently just a response that resolves to truthy (may be exteneded to return status?)
        this.reflectNetworkStatus(true);

        // TODO Not sure if eTags can still be simulated:
        // TODO would it be better to not delete, but set fileHandle in the fileInfo?
        this._fileInfoCache.delete(fullPath); // Invalidate any cached eTag

        // TODO implement LDP PUT response https://www.w3.org/TR/ldp-primer/
        return new Response();
      }
    } catch (err) {
      safeWebLog('Unable to update file \'%s\' : %s', fullPath, err);
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response({}, { statusCode: 500, responseText: '500 Internal Server Error (' + err + ')' });
    }
  }

  // Create file
  //
  // @returns promise which resolves to a Resonse object
  async _createFile(fullPath, body, contentType, options) {
    safeWebLog('%s._createFile(\'%s\',%O,%o,%O)', this.constructor.name, fullPath, body, contentType, options);
    try {
      let fileHandle = await window.safeNfs.create(this.storageNfs(), body);
      // mrhTODOx set file metadata (contentType) - how?

      // Add file to directory (by inserting fileHandle into container)
      fileHandle = await window.safeNfs.insert(this.storageNfs(), fileHandle, fullPath);
      this._updateFileInfo(fileHandle, fullPath);

      // TODO implement LDP POST response https://www.w3.org/TR/ldp-primer/
      return new Response();
    } catch (err) {
      safeWebLog('Unable to create file \'%s\' : %s', fullPath, err);
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response({}, { statusCode: 500, responseText: '500 Internal Server Error (' + err + ')' });
    }
  }

  // For reference see WireClient#get (wireclient.js)
  async _getFile(fullPath, options) {
    safeWebLog('%s._getFile(%s,%O)', this.constructor.name, fullPath, options);
    try {
      if (!this.isConnected()) {
        return new Response({ statusCode: 503, responseText: '503 not connected to SAFE network' });
      }

      // Check if file exists by obtaining directory listing if not already cached
      let fileInfo = await this._getFileInfo(fullPath);
      if (!fileInfo) {
        // TODO does the response object automatically create responseText?
        return new Response({ statusCode: 404 });
      }

      // TODO If the options are being used to retrieve specific version
      // should we get the latest version from the API first?
      var etagWithoutQuotes = fileInfo.ETag;

      // Request is for changed file, so if eTag matches return "304 Not Modified"
      if (ENABLE_ETAGS && options && options.ifNoneMatch && etagWithoutQuotes && etagWithoutQuotes === options.ifNoneMatch) {
        // TODO does the response object automatically create responseText?
        return new Response({ statusCode: 304 });
      }

      let fileHandle = await window.safeNfs.fetch(this.storageNfs(), fullPath);
      safeWebLog('fetched fileHandle: %s', fileHandle.toString());
      fileHandle = window.safeNfs.open(this.storageNfs(), fileHandle, 4 /* read TODO get from safeApp.CONSTANTS */);
      let openHandle = await safeWebLog('safeNfs.open() returns fileHandle: %s', fileHandle.toString());
      let size = window.safeNfsFile.size(openHandle);
      safeWebLog('safeNfsFile.size() returns size: %s', size.toString());
      let content = await window.safeNfsFile.read(openHandle, 0, size);
      safeWebLog('%s bytes read from file.', content.byteLength);

      let decoder = new TextDecoder();
      let data = decoder.decode(content);
      safeWebLog('data: \'%s\'', data);

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
        contentType: 'application/json; charset=UTF-8' // Fairly safe default until SAFE NFS supports save/get of content type
      });

      if (fileInfo && fileInfo['Content-Type']) {
        retResponse.contentType = fileInfo['Content-Type'];
      }
    } catch (err) {
      safeWebLog('Unable to get file: %s', err);
      // TODO can we decode the SAFE API errors to provide better error responses
      return new Response({}, { statusCode: 500, responseText: '500 Internal Server Error (' + err + ')' });
    }
  }

  // Use fileHandle to insert metadata into given fileInfo
  //
  // returns a Promise which resolves to a fileInfo object
  async _makeFileInfo(fileHandle, fileInfo, fullPath) {
    try {
      let fileMetadata = await window.safeNfsFile.metadata(fileHandle);
      fileInfo.created = fileMetadata.created;
      fileInfo.modified = fileMetadata.modified;
      fileInfo.version = fileMetadata.version;
      fileInfo.dataMapName = fileMetadata.dataMapName; // TODO Debug only!

      // Overwrite ETag using the file version (rather than the enry version)
      fileInfo.ETag = fullPath + '-v' + fileMetadata.version;
      return fileInfo;
    } catch (err) {
      safeWebLog('_makeFileInfo(%s) > safeNfsFile.metadata() FAILED: %s', fullPath, err);
      throw err;
    }
  }

  // Use fileHandle to update cached fileInfo with metadata
  //
  // returns a Promise which resolves to an updated fileInfo
  async _updateFileInfo(fileHandle, fullPath) {
    try {
      let fileInfo = await this._getFileInfo(fullPath);
      if (fileInfo) return fileInfo;else throw new Error('_updateFileInfo( ' + fullPath + ') - unable to update - no existing fileInfo');
    } catch (err) {
      safeWebLog('unable to update file info: %s', err);
      throw err;
    }
  }

  // Obtain folder listing
  //

  // TODO implement LDP formatted response https://www.w3.org/TR/ldp-primer/
  async _getFolder(fullPath, options) {
    safeWebLog('%s._getFolder(%s,%O)', this.constructor.name, fullPath, options);
    var listing = {};

    try {
      // Create listing by enumerating container keys beginning with fullPath
      const directoryEntries = [];
      let entriesHandle = await window.safeMutableData.getEntries(this.storageMd());
      await window.safeMutableDataEntries.forEach(entriesHandle, async (k, v) => {
        // Skip deleted entries
        if (v.buf.length == 0) {
          // TODO try without this...
          return true; // Next
        }
        safeWebLog('Key: ', k.toString());
        safeWebLog('Value: ', v.buf.toString('base64'));
        safeWebLog('entryVersion: ', v.version);

        var dirPath = fullPath;
        if (dirPath.slice(-1) != '/') dirPath += '/'; // Ensure a trailing slash

        key = k.toString();
        // If the folder matches the start of the key, the key is within the folder
        if (key.length > dirPath.length && key.substr(0, dirPath.length) == dirPath) {
          var remainder = key.slice(dirPath.length);
          var itemName = remainder; // File name will be up to but excluding first '/'
          var firstSlash = remainder.indexOf('/');
          if (firstSlash != -1) {
            itemName = remainder.slice(0, firstSlash + 1); // Directory name with trailing '/'
          }

          // Add file/directory info to cache and for return as listing
          var fullItemPath = dirPath + itemName;
          // First part of fileInfo
          var fileInfo = {
            name: itemName, // File or directory name
            fullPath: fullItemPath, // Full path including name
            entryVersion: v.version, // mrhTODO for debug

            // Remaining members must pass test: sync.js#corruptServerItemsMap()
            ETag: 'dummy-etag-for-folder' // Must be present, but we fake it because diretories are implied (not versioned objects)
            // For folders an ETag is only useful for get: and _getFolder() ignores options so faking is ok
          };

          if (firstSlash == -1) {
            // File not folder
            // Files have metadata but directories DON'T (faked above)
            var metadata; // mrhTODO ??? - obtain this?
            metadata = { mimetype: 'application/json; charset=UTF-8' }; // mrhTODO fake it until implemented - should never be used
            // mrhTODOx add in get file size - or maybe leave this unset, and set it when getting the file?
            fileInfo['Content-Length'] = 123456; // mrhTODO: item.size,
            fileInfo['Content-Type'] = metadata.mimetype; // metadata.mimetype currently faked (see above) mrhTODO see next
          }
          directoryEntries.push(fileInfo);
        }
      }).then(_ => Promise.all(directoryEntries.map(async fileInfo => {
        safeWebLog('directoryEntries.map() with %s', JSON.stringify(fileInfo));

        if (fileInfo.fullPath.slice(-1) == '/') {
          // Directory entry:
          safeWebLog('Listing: ', fileInfo.name);
          listing[fileInfo.name] = fileInfo;
        } else {
          // File entry:
          try {
            safeWebLog('DEBUG: window.safeNfs.fetch(\'%s\')...', fileInfo.fullPath);
            let fileHandle = await window.safeNfs.fetch(this.storageNfs(), fileInfo.fullPath);
            let fileInfo = await this._makeFileInfo(fileHandle, fileInfo, fileInfo.fullPath);
            safeWebLog('file created: %s', fileInfo.created);
            safeWebLog('file modified: %s', fileInfo.modified);
            safeWebLog('file version: %s', fileInfo.version);
            safeWebLog('file dataMapName: %s', fileInfo.dataMapName.toString('base64'));

            // File entry:
            this._fileInfoCache.set(fileInfo.fullPath, fileInfo);
            safeWebLog('..._fileInfoCache.set(file: \'%s\')', fileInfo.fullPath);
            safeWebLog('Listing: ', fileInfo.name);
            listing[fileInfo.name] = fileInfo;
          } catch (err) {
            safeWebLog('_getFolder(\'%s\') Skipping invalid entry. Error: %s', fileInfo.fullPath, err);
          }
        }
      })));

      safeWebLog('Iteration finished');
      safeWebLog('%s._getFolder(\'%s\', ...) RESULT: listing contains %s', fullPath, JSON.stringify(listing), this.constructor.name);
      var folderMetadata = { contentType: RS_DIR_MIME_TYPE // mrhTODOx - check what is expected and whether we can provide something
      };return new Response({ statusCode: 200, body: listing, meta: folderMetadata, contentType: RS_DIR_MIME_TYPE /*, mrhTODOx revision: folderETagWithoutQuotes*/ });
    } catch (err) {
      safeWebLog('safeNfs.getEntries(\'%s\') failed: %s', fullPath, err.status);
      // var status = (err == 'Unauthorized' ? 401 : 404); // mrhTODO
      // ideally safe-js would provide response code (possible enhancement)
      if (err.status === undefined) err.status = 401; // Force Unauthorised, to handle issue in safe-js:

      /* TODO review -old RS code
      if (err.status == 401){
        // Modelled on how googledrive.js handles expired token
        if (this.connected){
          this.connect();
          return resolve({statusCode: 401}); // mrhTODO should this reject
        }
      }*/
      return new Response({ statusCode: err.status });
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
  async _getFileInfo(fullPath) {
    safeWebLog('%s._getFileInfo(%s)', this.constructor.name, fullPath);
    try {
      if (fullPath === '/') return { path: fullPath, ETag: 'root' // Dummy fileInfo to stop at "root"


      };if (info = await this._fileInfoCache.get(fullPath)) return info;

      // Not yet cached or doesn't exist
      // Load parent folder listing update _fileInfoCache.
      let rootVersion = window.safeMutableData.getVersion(this.storageMd());

      /* TODO there seems no point calling _getFileInfo on a folder so could just
      let that trigger an error in this function, then fix the call to handle differently
      */
      if (isFolder(fullPath)) {
        // folder, so fake its info
        // Add file info to cache
        var fileInfo = {
          fullPath: fullPath // Used by _fileInfoCache() but nothing else
        };
        this._fileInfoCache.set(fullPath, fileInfo);
        return fileInfo;
      }

      // Get the parent directory and test if the file is listed
      await this._getFolder(parentPath(fullPath));
      if (info = this._fileInfoCache.get(fullPath)) {
        return info;
      } else {
        // file, doesn't exist
        safeWebLog('_getFileInfo(%s) file does not exist, no fileInfo available ', fullPath);
        return null;
      }
    } catch (err) {
      safeWebLog('_getFileInfo(%s) > safeMutableData.getVersion() FAILED: %s', fullPath, err);
      throw err;
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

module.exports = SafenetworkWebApi;
module.exports.safeWeb = safeWeb;
module.exports.setSafeApi = SafenetworkWebApi.prototype.setSafeApi.bind(safeWeb);
module.exports.listContainer = SafenetworkWebApi.prototype.listContainer.bind(safeWeb);
module.exports.testsNoAuth = SafenetworkWebApi.prototype.testsNoAuth.bind(safeWeb);
module.exports.testsAfterAuth = SafenetworkWebApi.prototype.testsAfterAuth.bind(safeWeb);

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
const httpFetch = __webpack_require__(7);
const protoFetch = __webpack_require__(9);

// map protocols to fetch()
const fetch = protoFetch({
  http: httpFetch,
  https: httpFetch,
  safe: safeWeb.fetch.bind(safeWeb)
  //  https: Safenetwork.fetch.bind(Safenetwork), // Debugging with SAFE mock browser
});

module.exports.protoFetch = fetch;

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(process) {/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = __webpack_require__(4);
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // Internet Explorer and Edge do not support colors.
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    return false;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(3)))

/***/ }),
/* 3 */
/***/ (function(module, exports) {

// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {


/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = __webpack_require__(5);

/**
 * Active `debug` instances.
 */
exports.instances = [];

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  var prevTime;

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);
  debug.destroy = destroy;

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  exports.instances.push(debug);

  return debug;
}

function destroy () {
  var index = exports.instances.indexOf(this);
  if (index !== -1) {
    exports.instances.splice(index, 1);
    return true;
  } else {
    return false;
  }
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var i;
  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }

  for (i = 0; i < exports.instances.length; i++) {
    var instance = exports.instances[i];
    instance.enabled = exports.enabled(instance.namespace);
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  if (name[name.length - 1] === '*') {
    return true;
  }
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}


/***/ }),
/* 5 */
/***/ (function(module, exports) {

/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}


/***/ }),
/* 6 */
/***/ (function(module, exports) {



// Local helpers
const isFolder = function (path) {
  return path.substr(-1) === '/';
};

// Strip fragment for URI (removes everything from first '#')
const docpart = function (uri) {
  var i;
  i = uri.indexOf('#');
  if (i < 0) {
    return uri;
  } else {
    return uri.slice(0, i);
  }
};

// Return full document path from root (strips host and fragment)
const pathpart = function (uri) {
  let prePath = hostpart(uri);
  return docpart(uri.slice(prePath.length));
};

const hostpart = function (u) {
  var m = /[^\/]*\/\/([^\/]*)\//.exec(u);
  if (m) {
    return m[1];
  } else {
    return '';
  }
};

const protocol = function (uri) {
  var i;
  i = uri.indexOf(':');
  if (i < 0) {
    return null;
  } else {
    return uri.slice(0, i);
  }
};

const parentPath = function (path) {
  return path.replace(/[^\/]+\/?$/, '');
};

module.exports.isFolder = isFolder;
module.exports.docpart = docpart;
module.exports.pathpart = pathpart;
module.exports.hostpart = hostpart;
module.exports.protocol = protocol;
module.exports.parentPath = parentPath;

/***/ }),
/* 7 */
/***/ (function(module, exports, __webpack_require__) {

// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.
__webpack_require__(8);
module.exports = self.fetch.bind(self);


/***/ }),
/* 8 */
/***/ (function(module, exports) {

(function(self) {
  'use strict';

  if (self.fetch) {
    return
  }

  var support = {
    searchParams: 'URLSearchParams' in self,
    iterable: 'Symbol' in self && 'iterator' in Symbol,
    blob: 'FileReader' in self && 'Blob' in self && (function() {
      try {
        new Blob()
        return true
      } catch(e) {
        return false
      }
    })(),
    formData: 'FormData' in self,
    arrayBuffer: 'ArrayBuffer' in self
  }

  if (support.arrayBuffer) {
    var viewClasses = [
      '[object Int8Array]',
      '[object Uint8Array]',
      '[object Uint8ClampedArray]',
      '[object Int16Array]',
      '[object Uint16Array]',
      '[object Int32Array]',
      '[object Uint32Array]',
      '[object Float32Array]',
      '[object Float64Array]'
    ]

    var isDataView = function(obj) {
      return obj && DataView.prototype.isPrototypeOf(obj)
    }

    var isArrayBufferView = ArrayBuffer.isView || function(obj) {
      return obj && viewClasses.indexOf(Object.prototype.toString.call(obj)) > -1
    }
  }

  function normalizeName(name) {
    if (typeof name !== 'string') {
      name = String(name)
    }
    if (/[^a-z0-9\-#$%&'*+.\^_`|~]/i.test(name)) {
      throw new TypeError('Invalid character in header field name')
    }
    return name.toLowerCase()
  }

  function normalizeValue(value) {
    if (typeof value !== 'string') {
      value = String(value)
    }
    return value
  }

  // Build a destructive iterator for the value list
  function iteratorFor(items) {
    var iterator = {
      next: function() {
        var value = items.shift()
        return {done: value === undefined, value: value}
      }
    }

    if (support.iterable) {
      iterator[Symbol.iterator] = function() {
        return iterator
      }
    }

    return iterator
  }

  function Headers(headers) {
    this.map = {}

    if (headers instanceof Headers) {
      headers.forEach(function(value, name) {
        this.append(name, value)
      }, this)
    } else if (Array.isArray(headers)) {
      headers.forEach(function(header) {
        this.append(header[0], header[1])
      }, this)
    } else if (headers) {
      Object.getOwnPropertyNames(headers).forEach(function(name) {
        this.append(name, headers[name])
      }, this)
    }
  }

  Headers.prototype.append = function(name, value) {
    name = normalizeName(name)
    value = normalizeValue(value)
    var oldValue = this.map[name]
    this.map[name] = oldValue ? oldValue+','+value : value
  }

  Headers.prototype['delete'] = function(name) {
    delete this.map[normalizeName(name)]
  }

  Headers.prototype.get = function(name) {
    name = normalizeName(name)
    return this.has(name) ? this.map[name] : null
  }

  Headers.prototype.has = function(name) {
    return this.map.hasOwnProperty(normalizeName(name))
  }

  Headers.prototype.set = function(name, value) {
    this.map[normalizeName(name)] = normalizeValue(value)
  }

  Headers.prototype.forEach = function(callback, thisArg) {
    for (var name in this.map) {
      if (this.map.hasOwnProperty(name)) {
        callback.call(thisArg, this.map[name], name, this)
      }
    }
  }

  Headers.prototype.keys = function() {
    var items = []
    this.forEach(function(value, name) { items.push(name) })
    return iteratorFor(items)
  }

  Headers.prototype.values = function() {
    var items = []
    this.forEach(function(value) { items.push(value) })
    return iteratorFor(items)
  }

  Headers.prototype.entries = function() {
    var items = []
    this.forEach(function(value, name) { items.push([name, value]) })
    return iteratorFor(items)
  }

  if (support.iterable) {
    Headers.prototype[Symbol.iterator] = Headers.prototype.entries
  }

  function consumed(body) {
    if (body.bodyUsed) {
      return Promise.reject(new TypeError('Already read'))
    }
    body.bodyUsed = true
  }

  function fileReaderReady(reader) {
    return new Promise(function(resolve, reject) {
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
    })
  }

  function readBlobAsArrayBuffer(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsArrayBuffer(blob)
    return promise
  }

  function readBlobAsText(blob) {
    var reader = new FileReader()
    var promise = fileReaderReady(reader)
    reader.readAsText(blob)
    return promise
  }

  function readArrayBufferAsText(buf) {
    var view = new Uint8Array(buf)
    var chars = new Array(view.length)

    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i])
    }
    return chars.join('')
  }

  function bufferClone(buf) {
    if (buf.slice) {
      return buf.slice(0)
    } else {
      var view = new Uint8Array(buf.byteLength)
      view.set(new Uint8Array(buf))
      return view.buffer
    }
  }

  function Body() {
    this.bodyUsed = false

    this._initBody = function(body) {
      this._bodyInit = body
      if (!body) {
        this._bodyText = ''
      } else if (typeof body === 'string') {
        this._bodyText = body
      } else if (support.blob && Blob.prototype.isPrototypeOf(body)) {
        this._bodyBlob = body
      } else if (support.formData && FormData.prototype.isPrototypeOf(body)) {
        this._bodyFormData = body
      } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
        this._bodyText = body.toString()
      } else if (support.arrayBuffer && support.blob && isDataView(body)) {
        this._bodyArrayBuffer = bufferClone(body.buffer)
        // IE 10-11 can't handle a DataView body.
        this._bodyInit = new Blob([this._bodyArrayBuffer])
      } else if (support.arrayBuffer && (ArrayBuffer.prototype.isPrototypeOf(body) || isArrayBufferView(body))) {
        this._bodyArrayBuffer = bufferClone(body)
      } else {
        throw new Error('unsupported BodyInit type')
      }

      if (!this.headers.get('content-type')) {
        if (typeof body === 'string') {
          this.headers.set('content-type', 'text/plain;charset=UTF-8')
        } else if (this._bodyBlob && this._bodyBlob.type) {
          this.headers.set('content-type', this._bodyBlob.type)
        } else if (support.searchParams && URLSearchParams.prototype.isPrototypeOf(body)) {
          this.headers.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8')
        }
      }
    }

    if (support.blob) {
      this.blob = function() {
        var rejected = consumed(this)
        if (rejected) {
          return rejected
        }

        if (this._bodyBlob) {
          return Promise.resolve(this._bodyBlob)
        } else if (this._bodyArrayBuffer) {
          return Promise.resolve(new Blob([this._bodyArrayBuffer]))
        } else if (this._bodyFormData) {
          throw new Error('could not read FormData body as blob')
        } else {
          return Promise.resolve(new Blob([this._bodyText]))
        }
      }

      this.arrayBuffer = function() {
        if (this._bodyArrayBuffer) {
          return consumed(this) || Promise.resolve(this._bodyArrayBuffer)
        } else {
          return this.blob().then(readBlobAsArrayBuffer)
        }
      }
    }

    this.text = function() {
      var rejected = consumed(this)
      if (rejected) {
        return rejected
      }

      if (this._bodyBlob) {
        return readBlobAsText(this._bodyBlob)
      } else if (this._bodyArrayBuffer) {
        return Promise.resolve(readArrayBufferAsText(this._bodyArrayBuffer))
      } else if (this._bodyFormData) {
        throw new Error('could not read FormData body as text')
      } else {
        return Promise.resolve(this._bodyText)
      }
    }

    if (support.formData) {
      this.formData = function() {
        return this.text().then(decode)
      }
    }

    this.json = function() {
      return this.text().then(JSON.parse)
    }

    return this
  }

  // HTTP methods whose capitalization should be normalized
  var methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']

  function normalizeMethod(method) {
    var upcased = method.toUpperCase()
    return (methods.indexOf(upcased) > -1) ? upcased : method
  }

  function Request(input, options) {
    options = options || {}
    var body = options.body

    if (input instanceof Request) {
      if (input.bodyUsed) {
        throw new TypeError('Already read')
      }
      this.url = input.url
      this.credentials = input.credentials
      if (!options.headers) {
        this.headers = new Headers(input.headers)
      }
      this.method = input.method
      this.mode = input.mode
      if (!body && input._bodyInit != null) {
        body = input._bodyInit
        input.bodyUsed = true
      }
    } else {
      this.url = String(input)
    }

    this.credentials = options.credentials || this.credentials || 'omit'
    if (options.headers || !this.headers) {
      this.headers = new Headers(options.headers)
    }
    this.method = normalizeMethod(options.method || this.method || 'GET')
    this.mode = options.mode || this.mode || null
    this.referrer = null

    if ((this.method === 'GET' || this.method === 'HEAD') && body) {
      throw new TypeError('Body not allowed for GET or HEAD requests')
    }
    this._initBody(body)
  }

  Request.prototype.clone = function() {
    return new Request(this, { body: this._bodyInit })
  }

  function decode(body) {
    var form = new FormData()
    body.trim().split('&').forEach(function(bytes) {
      if (bytes) {
        var split = bytes.split('=')
        var name = split.shift().replace(/\+/g, ' ')
        var value = split.join('=').replace(/\+/g, ' ')
        form.append(decodeURIComponent(name), decodeURIComponent(value))
      }
    })
    return form
  }

  function parseHeaders(rawHeaders) {
    var headers = new Headers()
    rawHeaders.split(/\r?\n/).forEach(function(line) {
      var parts = line.split(':')
      var key = parts.shift().trim()
      if (key) {
        var value = parts.join(':').trim()
        headers.append(key, value)
      }
    })
    return headers
  }

  Body.call(Request.prototype)

  function Response(bodyInit, options) {
    if (!options) {
      options = {}
    }

    this.type = 'default'
    this.status = 'status' in options ? options.status : 200
    this.ok = this.status >= 200 && this.status < 300
    this.statusText = 'statusText' in options ? options.statusText : 'OK'
    this.headers = new Headers(options.headers)
    this.url = options.url || ''
    this._initBody(bodyInit)
  }

  Body.call(Response.prototype)

  Response.prototype.clone = function() {
    return new Response(this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }

  Response.error = function() {
    var response = new Response(null, {status: 0, statusText: ''})
    response.type = 'error'
    return response
  }

  var redirectStatuses = [301, 302, 303, 307, 308]

  Response.redirect = function(url, status) {
    if (redirectStatuses.indexOf(status) === -1) {
      throw new RangeError('Invalid status code')
    }

    return new Response(null, {status: status, headers: {location: url}})
  }

  self.Headers = Headers
  self.Request = Request
  self.Response = Response

  self.fetch = function(input, init) {
    return new Promise(function(resolve, reject) {
      var request = new Request(input, init)
      var xhr = new XMLHttpRequest()

      xhr.onload = function() {
        var options = {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: parseHeaders(xhr.getAllResponseHeaders() || '')
        }
        options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL')
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(new Response(body, options))
      }

      xhr.onerror = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.ontimeout = function() {
        reject(new TypeError('Network request failed'))
      }

      xhr.open(request.method, request.url, true)

      if (request.credentials === 'include') {
        xhr.withCredentials = true
      }

      if ('responseType' in xhr && support.blob) {
        xhr.responseType = 'blob'
      }

      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value)
      })

      xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit)
    })
  }
  self.fetch.polyfill = true
})(typeof self !== 'undefined' ? self : this);


/***/ }),
/* 9 */
/***/ (function(module, exports, __webpack_require__) {

const url = __webpack_require__(10)

function fetch (iri, options) {
  const protocol = url.parse(iri).protocol.split(':').shift()

  if (protocol in this.protocols) {
    return this.protocols[protocol](iri, options)
  }

  return Promise.reject(new Error('unknown protocol'))
}

function factory (protocols) {
  const instance = (iri, options) => {
    return fetch.call(instance, iri, options)
  }

  instance.protocols = protocols

  return instance
}

module.exports = factory


/***/ }),
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.



var punycode = __webpack_require__(11);
var util = __webpack_require__(14);

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = __webpack_require__(15);

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};


/***/ }),
/* 11 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(module, global) {var __WEBPACK_AMD_DEFINE_RESULT__;/*! https://mths.be/punycode v1.4.1 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.4.1',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		true
	) {
		!(__WEBPACK_AMD_DEFINE_RESULT__ = function() {
			return punycode;
		}.call(exports, __webpack_require__, exports, module),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(12)(module), __webpack_require__(13)))

/***/ }),
/* 12 */
/***/ (function(module, exports) {

module.exports = function(module) {
	if(!module.webpackPolyfill) {
		module.deprecate = function() {};
		module.paths = [];
		// module.parent = undefined by default
		if(!module.children) module.children = [];
		Object.defineProperty(module, "loaded", {
			enumerable: true,
			get: function() {
				return module.l;
			}
		});
		Object.defineProperty(module, "id", {
			enumerable: true,
			get: function() {
				return module.i;
			}
		});
		module.webpackPolyfill = 1;
	}
	return module;
};


/***/ }),
/* 13 */
/***/ (function(module, exports) {

var g;

// This works in non-strict mode
g = (function() {
	return this;
})();

try {
	// This works if eval is allowed (see CSP)
	g = g || Function("return this")() || (1,eval)("this");
} catch(e) {
	// This works if the window reference is available
	if(typeof window === "object")
		g = window;
}

// g can still be undefined, but nothing to do about it...
// We return undefined, instead of nothing here, so it's
// easier to handle this case. if(!global) { ...}

module.exports = g;


/***/ }),
/* 14 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};


/***/ }),
/* 15 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.decode = exports.parse = __webpack_require__(16);
exports.encode = exports.stringify = __webpack_require__(17);


/***/ }),
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.



// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};


/***/ }),
/* 17 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.



var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};


/***/ })
/******/ ]);
});
//# sourceMappingURL=solid-safenetwork.js.map