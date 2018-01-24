(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["SafenetworkLDP"] = factory();
	else
		root["SafenetworkLDP"] = factory();
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
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

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

const safeLog = __webpack_require__(1)('safe:web'); // Decorated console output

const SN_TAGTYPE_SERVICES = 15001; // TODO get this from the API

const SN_TAGTYPE_LDP = 80655; // Linked Data Protocol service (timbl's dob)

const safeUtils = __webpack_require__(7);

const isFolder = safeUtils.isFolder;
const docpart = safeUtils.docpart;
const pathpart = safeUtils.pathpart;
const hostpart = safeUtils.hostpart;
const protocol = safeUtils.protocol;
const parentPath = safeUtils.parentPath;

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
  this.setSafeApi(appHandle);
};

SafeWeb.prototype = {
  // Application must set/refresh the SAFE API handles if they become invalid:
  setSafeApi: function (appHandle) {
    this._appHandle = appHandle; // SAFE API application handle
    this._services = {}; // Map of fulldomain (profile.public-name) to service instance

    // TODO if necessary, update/reset managed objects such as MDs
  },

  // For access to SAFE API:
  appHandle: function () {
    return this._appHandle;
  },

  /*
   * SAFE Services API
   */

  // get a service object for the full domain portion of the URI (will create the service if necessary)
  //
  // @param a valid safe:// style URI
  // @returns a promise which evaluates to a ServiceInterface which supports fetch() operations
  getServiceForUri: async function (uri) {
    return new Promise(async (resolve, reject) => {
      try {
        let fullDomain = hostpart(uri);
        if (this._services[fullDomain] != undefined) return resolve(_services[fullDomain]); // Already initialised

        // Lookup the service on this fullDomain: profile.public-name
        let profile = fullDomain.split('.')[0];
        let publicName = fullDomain.split('.')[1];

        // Get the services MD for publicName
        return this.getServicesMdFor(publicName).then(servicesMd => {
          /* TODO
          ??? oops I need a separate thing to create a service on a given profile.public-name
          ??? I was going to imply the service from 'profile' but not any more
          ??? so need that to be controlled by the app using a createNewService(profile,publicName)
          // TODO So here we can only succeed if the servicesMd for publicName has a service setting for profile
          ???
          MAYBE TIME TO SKETCH THIS OUT ON PAPER - BOTH A FINAL AND INTERIM DESIGN VERSIONS
          */
        }).catch(err => {
          // TODO What if there's no services MD?
          // ??? I think this is now an error
        });
      } catch (err) {
        safeLog('getServiceForUri(%s) FAILED: %s', uri, err);
        return reject(err);
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
  listContainer: async function (containerName) {
    safeLog('listContainer(%s)...', containerName);
    let mdHandle = await window.safeApp.getContainer(this.appHandle(), containerName);
    safeLog(containerName + " ----------- start ----------------");
    await this.listMd(mdHandle);
    safeLog(containerName + "------------ end -----------------");
  },

  listMd: async function (mdHandle) {
    let entriesHandle = await window.safeMutableData.getEntries(mdHandle);
    await window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
      safeLog('Key: ', k.toString());
      safeLog('Value: ', v.buf.toString());
      safeLog('Version: ', v.version);
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
  getPublicNameEntry: async function (publicName) {
    safeLog('getPublicNameEntry(%s)...', publicName);
    return new Promise(async (resolve, reject) => {
      try {
        // TODO wrap access to some MDs (eg for _publicNames container) in a getter that is passed permissions
        // TODO checks those permissions, gets the MD, and caches the value, or returns it immediately if not null
        let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames');
        let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd);
        let entryKey = this.makePublicNamesEntryKey(publicName);
        return resolve({
          key: entryKey,
          value: await window.safeMutableDataEntries.get(entriesHandle, entryKey)
        });
      } catch (err) {
        safeLog('getPublicNameEntry() WARNING no _publicNames entry found for: %s', publicName);
        return reject(err);
      }
    });
  },

  // Get mutable data handle for MD hash
  //
  // @param hash
  // @param tagType
  //
  // @returns a promise which resolves to an MD handle
  getMdFromHash: async function (hash, tagType) {
    safeLog('getMdFromHash(%s,%s)...', hash, tagType);
    return new Promise(async (resolve, reject) => {
      try {
        return window.safeMutableData.newPublic(this.appHandle(), hash, tagType).then(mdHandle => resolve(mdHandle));
      } catch (err) {
        safeLog('getMdFromHash() ERROR: %s', err);
        reject(err);
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
  createPublicName: async function (publicName) {
    safeLog('createPublicName(%s)...', publicName);
    return new Promise(async (resolve, reject) => {
      try {
        // Check for an existing entry (before creating services MD)
        try {
          let entry = await this.getPublicNameEntry(publicName);
          return reject('Can\'t create _publicNames entry, already exists for %s', publicName); // Entry already exists, so exit early
        } catch (err) {} // No existing entry, so ok...

        // Create a new services MD (fails if the publicName is taken)
        let servicesMdName = await this.makeServicesMdName(publicName);
        let servicesMd = await window.safeMutableData.newPublic(this.appHandle(), servicesMdName, SN_TAGTYPE_SERVICES);

        // TODO remove (test only):
        await window.safeMutableData.getNameAndTag(servicesMd).then(r => safeLog('New Public servicesMd created with tag: ', r.tag, ' and name: ', r.name.buffer));

        let publicNamesMd = await window.safeApp.getContainer(this.appHandle(), '_publicNames');
        let entryKey = this.makePublicNamesEntryKey(publicName);
        let entriesHandle = await window.safeMutableData.getEntries(publicNamesMd);
        let mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle);
        await window.safeMutableDataMutation.insert(mutationHandle, entryKey, servicesMdName);
        return window.safeMutableData.applyEntriesMutation(publicNamesMd, mutationHandle).then(async _ => {
          safeLog('New _publicNames entry created for %s', publicName);
          resolve({
            key: entryKey,
            value: servicesMdName,
            servicesHandle: servicesMd
          });
        });
      } catch (err) {
        safeLog('createPublicNameEntry() failed: ', err);
        reject(err);
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
  makeServicesMdName: async function (publicName) {
    return window.safeCrypto.sha3Hash(this._appHandle, publicName);
  },

  // Helper to create the key for looking up a public name entry in the _publicNames container
  //
  // @param publicName
  //
  // @returns the key as a string, corresponding to the public name's entry in _publicNames
  makePublicNamesEntryKey: function (publicName) {
    return '_publicNames/' + publicName;
  },

  // Get the services MD for any public name, even ones you don't own
  //
  // This is always public, so no need to be logged in or own the public name.
  //
  // @param publicName
  //
  // @returns promise which resolves to the services MD of the given name
  getServicesMdFor: async function (publicName) {
    safeLog('getServicesMdFor(%s)', publicName);
    return new Promise(async (resolve, reject) => {
      try {
        let servicesName = await this.makeServicesMdName(publicName);
        return window.safeMutableData.newPublic(servicesName, SN_TAGTYPE_SERVICES).then(mdHandle => {
          safeLog('Look up SUCCESS for MD XOR name: ' + servicesName);
          resolve(mdHandle);
        });
      } catch (err) {
        safeLog('Look up FAILED for MD XOR name: ' + this.makeServicesMdName(publicName));
        safeLog('getServicesMdFor ERROR: ', err);
        reject(err);
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
  getServicesMdFromContainers: async function (publicName) {
    safeLog('getServicesForMy(%s)', publicName);
    const self = this;
    return new Promise((resolve, reject) => {
      try {
        let nameKey = this.makePublicNamesEntryKey(publicName);
        window.safeApp.getContainer(this.appHandle(), '_publicNames').then(mdHandle => {
          safeLog("_publicNames ----------- start ----------------");
          return window.safeMutableData.getEntries(mdHandle).then(entriesHandle => window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
            safeLog('Key: ', k.toString());
            safeLog('Value: ', v.buf.toString());
            safeLog('Version: ', v.version);
            if (k == nameKey) {
              safeLog('Key: ' + nameKey + '- found');
              resolve(v.buf);
            }
          }).then(_ => {
            safeLog('Key: ' + nameKey + '- NOT found');
            reject('No _publicNames entry for public name');
          }));
        });
      } catch (err) {
        safeLog('getServicesMdFromContainers ERROR: ', err);
        reject(err);
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
  InitialiseServiceEntry: async function (serviceSettings, overwrite) {
    safeLog('InitialiseServiceEntry(%o,%s)...', serviceSettings, overwrite);
    if (overwrite == undefined) {
      const overwrite = false;
    }

    return new Promise(async (resolve, reject) => {
      try {
        let entriesHandle = await window.safeMutableData.getEntries(serviceSettings.servicesMd);
        try {
          return window.safeMutableDataEntries.get(entriesHandle, serviceSettings.serviceKey).then(async value => {
            // An entry exists for servicePrefix
            if (overwrite) {
              safeLog("Initialise service entry WARNING: service entry exists for key '%s', no action taken", serviceSettings.serviceKey);
              resolve(false);
            } else {
              let mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle);
              await window.safeMutableDataMutation.update(mutationHandle, serviceSettings.serviceKey, serviceSettings.serviceValue);
              return window.safeMutableData.applyEntriesMutation(serviceSettings.servicesMd, mutationHandle).then(_ => {
                window.safeMutableDataMutation.free(mutationHandle);
                resolve(true);
              });
            }
          }), async _ => {
            // No entry exists, so insert one
            let mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle);
            await window.safeMutableDataMutation.insert(mutationHandle, serviceSettings.serviceKey, serviceSettings.serviceValue);
            return window.safeMutableData.applyEntriesMutation(serviceSettings.servicesMd, mutationHandle).then(async _ => {
              window.safeMutableDataMutation.free(mutationHandle);
              resolve(true);
            });
          };
        } catch (err) {
          safeLog('InitialiseServiceEntry() WARNING: %s', err);
          resolve(false);
        }
      } catch (err) {
        safeLog('InitialiseServiceEntry() FAILED: ', err);
        reject(err);
      }
    });
  },

  // Helper to create the key for looking up a public name entry in the _publicNames container
  //
  // @param publicName
  // @param servicePrefix
  //
  // @returns the key as a string, corresponding to a service entry in a servicesMD
  makeServiceEntryKey(publicName, servicePrefix) {
    return publicName + '@' + servicePrefix;
  },

  //////// TODO END of 'move to Service class/implementation'

  // TODO prototyping only for now:
  testsNoAuth: function () {
    safeLog('testsNoAuth() called!');
  },

  // TODO prototyping only for now:
  testsAuth: async function (publicHandle, nfsHandle) {
    safeLog('>>>> testsAuth(%o,%o)', publicHandle, nfsHandle);

    try {
      /*
       let authUri = await window.safeApp.authoriseContainer(this.appHandle(),
                                  { _publicNames: ['Read','Insert','Update'] })
       safeLog('App was authorised and auth URI received: ', authUri)
      */

      safeLog('TEST START create public name');
      await this.listContainer('_publicNames');
      // NOTES:
      //  testname1 has an entry in _publicNames - possibly an invalid services MD
      //  testname2 has an entry in _publicNames (create successful)
      //      await this.createPublicName('testname2')
      await this.listContainer('_publicNames');
      safeLog('TEST END');

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
      safeLog('Error: ', err);
    }
  }

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
var ServiceInterface = function (safeWeb, serviceConfig) {
  this._safeWeb = safeWeb;
  this._serviceConfig = serviceConfig;
};

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

  safeWeb: function () {
    return this._safeWeb;
  },
  serviceConfig: function () {
    return this._serviceConfig;
  },

  getName: function () {
    return this.serviceConfig().name;
  },
  getDescription: function () {
    return this.serviceConfig().description;
  },
  getUriPrefix: function () {
    return this.serviceConfig().uriPrefix;
  },
  getTagType: function () {
    return this.serviceConfig().tagType;
  },

  /*
   * The following stubs must be replaced for each service implementation:
   */

  // Initialise an services MD with an entry for this service
  //
  // @param servicesMd
  //
  // @returns a promise which resolves to the servicesMd
  initialiseService: async function (servicesMd) {
    throw 'ServiceInterface.initialiseServicesMd() not implemented for ' + this.getName() + ' service';
  },

  // Handle web style operations for this service in the manner of browser window.fetch()
  //
  // @params  see window.fetch() and your services specification
  //
  // @returns see window.fetch() and your services specification
  _fetch: async function () {
    throw 'ServiceInterface._fetch() not implemented for ' + this.getName() + ' service';
  }
};

// TODO change to export class, something like this (example rdflib Fetcher.js)
// class SafeWeb {...}
// let safeWeb = new SafeWeb()
// module.exports = SafeWeb
// module.exports.safeWeb = safeWeb


let safeWeb = new SafeWeb();

exports = module.exports = SafeWeb.bind(safeWeb);
module.exports.setSafeApi = SafeWeb.prototype.setSafeApi.bind(safeWeb);
module.exports.listContainer = SafeWeb.prototype.listContainer.bind(safeWeb);
module.exports.testsNoAuth = SafeWeb.prototype.testsNoAuth.bind(safeWeb);
module.exports.testsAuth = SafeWeb.prototype.testsAuth.bind(safeWeb);

// Create and export LDP service for Solid apps:
//
// TODO move this to a services loading feature

// Service configuration (maps to a SAFE API Service)
const ldpServiceConfig = {
  // UI - to help identify the service in user interface
  //    - don't match with these in code (use the uriPrefix or tagType)
  name: "LDP",
  description: "LinkedData Platform (http://www.w3.org/TR/ldp/)",

  // Don't change this unless you are defining a brand new service
  uriPrefix: 'ldp', // Uses:
  // to direct URI to service (e.g. safe://ldp.somesite)
  // identify service in _publicNames (e.g. happybeing@ldp)

  tagType: SN_TAGTYPE_LDP // Mutable data tag type (don't change!)


  // TODO remove once SafenetworkServices implemented:
};let safeLDP = new ServiceInterface(ldpServiceConfig);

module.exports.safeLDP = ServiceInterface.bind(safeLDP);

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(process) {/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = __webpack_require__(5);
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

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(4)))

/***/ }),
/* 2 */
/***/ (function(module, exports, __webpack_require__) {


//import * as SafeWeb from './safenetwork-webapi'
const SafeWeb = __webpack_require__(0);
const SafenetworkLDP = __webpack_require__(3);

module.exports = SafenetworkLDP;
module.exports.SafenetworkLDP = SafenetworkLDP;
module.exports.SafeWeb = SafeWeb;

/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

// WORK IN PROGRESS/PROOF OF CONCEPT - NOT RECOMMENDED FOR PRODUCTION USE
//
// File: safenetwork-solid.js
//
// Description: a class which adds SafeNetwork storage backend to rdflib.js
// in the shape of LDP support by modifying fetch() to support 'safe:' URIs
//
// TODO... move this file (rdflib.js/src/safenetwork-solid.js) back to solid-safenetwork.
// This file is temporarily in rdflib.js but later will be part of an npm
// package which an app can 'require' in order to enable safe: URI support
// in rdflib.js as follows:
//
// require('./safenetwork-solid')
//
// Changes to rdflib.js to add support for 'safe:' protocol URIs:
//  rdflib.js/index.js contains:
//    SafenetworkLDP: require('./safenetwork-solid'),
//  rdflib.js/fetcher.js contains:
//    const safeFetch = require('./safenetwork-solid').protoFetch
//  added dependencies: isomorphic-fetch, proto-fetch
//
// App wishing to use SAFEnetwork as an LDP store:
//  - call Configure() and supply config to identify itself in the SAFE Auth UI
//  - this causes a SafenetworkLDP object to be created in $rdf TODO NYI???
//
// TODO make rdflib.js support safe: URIs has been ebabled, and if not the case
// give a helpful error when a safe: URI is encountered:

// Debugging
localStorage.debug = 'safe:*'; // breaks node-solid-server (comment out and 'npm run build' in rdflib.js)

const safeLog = __webpack_require__(1)('safe:solid'); // Coded for Solid
const safeRsLog = __webpack_require__(1)('safe:rs'); // Coded for RS.js

// TODO Until SAFE Web API is in a separate module, just 'require' it
const safeWeb = __webpack_require__(0);
const safeUtils = __webpack_require__(7);

const isFolder = safeUtils.isFolder;
const docpart = safeUtils.docpart;
const pathpart = safeUtils.pathpart;
const hostpart = safeUtils.hostpart;
const protocol = safeUtils.protocol;
const parentPath = safeUtils.parentPath;

// safenetwork-solid.js - Safenetwork RS.js backend, tweaked for SOLID LDP prototype
// TODO refactor as Safenetwork service handler for safe://solid.<public_name>
// TODO implement LDP: check get/put/delete
// TODO implement LDP: POST
// TODO implement LDP: OPTIONS
// TODO implement LDP: Headers
// TODO implement LDP: responses
// TODO implement LDP: createContainer
// TODO implement LDP: PATCH
// TODO refactor to clean out RemoteStorage specifics

// mrhTODO clean:
//var Authorize = require('./authorize');
//var BaseClient = require('./baseclient');
//var WireClient = require('./wireclient');
//var Sync = require('./sync');
//var log = require('./log');
//var util = require('./util');
//var eventHandling = require('./eventhandling');


// TODO review and adapt/remove these old RemoteStorage TODOs...
// mrhTODO NEXT: go through fixing up all mrhTODOs!
// TODO move to a new Safenetwork.log() which prefixes all msgs with '[Safenetwork]'
// TODO implement a separate flag for Safenetwork.log(), switch on with API config obj
// mrhTODO create new branch on RS1.0-xxx and move TODOs to github issues.
// mrhTODO figure out when/how to free fileHandle / self.fileHandle / self.openFileHandle
//
// o limitation: safeNfs API has a limit of 1000 items (files) per container.
// Directories are inferred so don't add to the count. Ask for way to obtain
// this limit from the API
//
// o SAFE containers: public v private, shared v app specific? Logically I
// think one shared, private container for all RS apps, unless the App
// specifies, in which case the app's data will not be visible to other apps.
// So default is that all user data is private, but visible to all RS apps
// authorised by the user. This leaves question of how to share a
// public URL for later!
// UPDATE: consider use of shareable MDs in the above (added with Test19)
//
// o sharing: how to share a public URL to private data (see use of SAFE
// containers (above)? We could default to all data public, and rely on
// obfuscation of URLs (filenames) to hide from other users, but that's
// insecure and probably easily defeated. May be better for sharing a URL to
// create a copy of the file in a public container used by all RS apps, which
// also providesa way for a user to list what they've shared and invalidate
// the share URLs by deleting the public copy.
//
// o review SAFE API app: init, auth,connect wrt to RS app and widget control
// flows
// o review storage of SAFE API appToken? (Maybe store authUri as token - but
// how to use it?)
//
// NOTES:
// I need to either use a standard container _public, _private etc or create
// one and then...
// Check if RS mutable data exists, and if not create it - and insert it into
// the container
// Save the mdHandle for the RS mutable data.
// -> 1) just use _public and get that working (probably need to write a
// wrapper that caches a file/directory structure based on the MD key
// values/paths)
// -> 2) review behaviours and how to handle >100 entries, and create/insert
// an MD just for RS apps (perhaps chain multiples together!?)
// o safeMutableDataMutation.insert/remove/update add operations to a
// transaction that must later be
// committed by calling applyEntriesMutation on the container MD.
//
// QUESTIONS:
// o what happens when _public, or any other standard container tries to
// exceed MAX_MUTABLE_DATA_ENTRIES (1000 in Test18)?
// o how can web DOM code obtain the value of MAX_MUTABLE_DATA_ENTRIES and
// other magic numbers? -> MaidSafe are about to expose constants, check that.
//

// Debug settings
const ENABLE_ETAGS = true; // false disables ifMatch / ifNoneMatch checks

// SAFE Network settings TODO delete these (now in SAFE Web API)
//const SN_SERVICE_LDP = 'ldp'  // SAFE Network service name (Linked Data Protocol)
//const SN_TYPE_TAG_LDP = 80655 // TimBL's b.d.

// Project Solid settings
const SETTINGS_KEY = 'solid:safenetwork';
const PATH_PREFIX = '/solid-poc01/'; // TODO replace with solid service container (per SAFE public id)

// General Settings
const RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

// Protocol handlers for fetch()
const httpFetch = __webpack_require__(8);
const protoFetch = __webpack_require__(10);

var hasLocalStorage;

// Used to cache file info
const Cache = function (maxAge) {
  this.maxAge = maxAge;
  this._items = {};
};

// Cache of file version info
Cache.prototype = {
  get: function (key) {
    var item = this._items[key];
    var now = new Date().getTime();
    // Google backend expires cached fileInfo, so we do too
    // but I'm not sure if this is helpful. No harm tho.
    return item && item.t >= now - this.maxAge ? item.v : undefined;
  },

  set: function (key, value) {
    this._items[key] = {
      v: value,
      t: new Date().getTime()
    };
  },

  'delete': function (key) {
    if (this._items[key]) {
      delete this._items[key];
    }
  }
};

/**
 * A Linked Data Protocol interface to SAFE Network
 *
 * @class
 * TODO revise these comments...
 * @param rdf {Object}
 * @param config {Object}
 *
 * config is an object with members:
 *    safeUriConfig - see below
 *    safeAppConfig - see SAFE API window.safeApp.initialise()
 *    safeAppPermissions - see SAFE API window.safeApp.authorise
 *
 * Example:
 * (for safeUriConfig - see prototype)
 *
 * The solidConfig allows the user to specify a webid, as well as the
 * storage that will allow LDP style mutations once the user authorises
 * with SAFE Network (logs in to their account). So the storage URI must
 * be a public ID owned by the account the user authorises.
 *
 * solidConfig = {
 *    webid:    'safe://solid.happybeing/profile/card#me' // Public readable resource
 *    storage:  'safe://solid.happybeing'                 // Public read/write solid service
 * }
 *
 * safeAppConfig = {
 *    id:     'net.maidsafe.test.webapp.id',
 *    name:   'WebApp Test',
 *    vendor: 'MaidSafe Ltd.'
 * }
 *
 * safeAppPermissions = {
 *    _public: ['Insert'],         // request to insert into `_public` container
 *    _other: ['Insert', 'Update'] // request to insert and update in `_other` container
 * }
 *
 */

// Example solidConfig TODO: is this needed? - maybe use just for PoC / testing?
const solidCfg = {
  webid: 'safe://solid.happybeing/profile/card#me', // Public readable resource
  storage: 'safe://solid.happybeing' // Public read/write solid service


  // Example Configure() config. Supplied by App to identify it in the SAFE Auth UI
};const appCfg = {
  id: 'com.happybeing',
  name: 'Solid Plume (Testing)',
  vendor: 'happybeing.'

  // Default SAFE Auth permissions to request. Optional parameter to Configure()
};const defaultPerms = {
  // TODO is this right for solid service container (ie solid.<safepublicid>)
  _public: ['Read', 'Insert', 'Update', 'Delete'], // TODO maybe reduce defaults later
  _publicNames: ['Read', 'Insert', 'Update', 'Delete'] // TODO maybe reduce defaults later


  // Safe API object, used by rdflib.js to access the API
  //
};var SafenetworkLDP = function (enable) {
  this._safeUriEnabled = enable == undefined ? true : enable;
  safeLog('SafenetworkLDP(%s)', this._safeUriEnabled);

  /* TODO:
    rdf.safenetworkLDP = this;
    this.rdf = rdf; // The rdflib.js object
  */
  // mrhTODO: info expires after 5 minutes (is this a good idea?)
  this._fileInfoCache = new Cache(60 * 5 * 1000);

  // TODO remove Configure() - move to the app (do I need it to provide rdf)
  //  this.Configure({},solidCfg,appCfg,defaultPerms) // For testing only
};

SafenetworkLDP.prototype = {
  // SAFE API State
  _connected: false, // SAFE connection state (updated by callback)
  //???  _online:    true,
  //???  _isPathShared: true,      // App private storage mrhTODO shared or
  // private? app able to control?

  // SAFE App state: all are valid (non-null) or all are null
  _appHandle: null, // From DOM API window.safeApp.authorise()
  _mdRoot: null, // Handle for root mutable data (mrhTODO:
  // initially maps to _public)
  _nfsRoot: null, // Handle for nfs emulation

  // Defaults (could be made configurable)
  _safeUriEnabled: true, // Enable Fetcher.js fetchUri() for safe: URLs
  _authImmediately: true, // Trigger auth on Congigure() / Enable(true)
  _authOnAccess: true, // Trigger auth on safe: access
  _authOnWrite: false, // Trigger auth on safe: PUT/POST/DELETE/PATCH
  _authOnError401: true, // Trigger auth on not auth error, and retry

  _solidConfig: {}, // Supplied by the App (see above)
  _safeAppConfig: {}, // Supplied by the App (see above)
  _safeAppPermissions: {}, // Supplied by the App (see above)

  _connected: false, // SAFEnetwork connection status

  isConnected: function () {
    return this._connected;
  },
  isEnabled: function () {
    return this._safeUriEnabled;
  },

  // Application must provide config and permissions for writeable store
  //
  // @param solidConfig    - solid config (see example above) TODO remove if not needed
  // @param appConfig      - app details for UI (see example above)
  // @param appPermissions - (optional) requested permissions for SAFE storage (see example above)
  Configure: function (rdflib, solidConfig, appConfig, appPermissions) {
    safeLog('Configure(%o,%O,%O,%O)', rdflib, solidConfig, appConfig, appPermissions);
    if (rdflib != undefined && rdflib) {
      //TODO maybe handle case where rdflib already has SAFE App state (copy to self first?)
      rdflib.SafenetworkLDP = this;
    }

    this._solidConfig = solidConfig;
    this._safeAppConfig = appConfig;
    this._safeAppPermissions = appPermissions != undefined ? appPermissions : defaultPerms;
    this.Enable(this._safeUriEnabled && this._solidConfig && this._safeAppConfig && this._safeAppPermissions);
  },

  Enable: function (flag) {
    safeLog('Enable(' + flag + ')');
    this._safeUriEnabled = flag;

    if (flag && this._authImmediately) this.safenetworkAuthorise();
  },

  // Synchronous authorisation with SAFE Network
  /*  Authorise: async function (){
      //await ???
    },
  */

  /**
   * Explicitly authorise with Safenetwork using config already provided
   *
   * @returns Promise which resolves true on successful authorisation, false if not
   */

  safenetworkAuthorise: function () {
    safeLog('safenetworkAuthorise()...');

    var self = this;
    self.freeSafeAPI();

    // TODO probably best to have initialise called once at start so can
    // TODO access the API with or without authorisation. So: remove the
    // TODO initialise call to a separate point and only call it once on
    // TODO load. Need to change freeSafeAPI() or not call it above.
    let result = new Promise((resolve, reject) => {
      return window.safeApp.initialise(self._safeAppConfig, newState => {
        // Callback for network state changes
        safeLog('SafeNetwork state changed to: ', newState);
        self._connected = newState;
      }).then(appHandle => {
        safeLog('SAFEApp instance initialised and appHandle returned: ', appHandle);
        safeWeb.setSafeApi(appHandle);
        //safeWeb.testsNoAuth();  // TODO remove (for test only)

        return window.safeApp.authorise(appHandle, self._safeAppPermissions, self._safeAppConfig.options).then(authUri => {
          safeLog('SAFEApp was authorised and authUri received: ', authUri);
          return window.safeApp.connectAuthorised(appHandle, authUri).then(_ => {
            safeLog('SAFEApp was authorised & a session was created with the SafeNetwork');

            // TODO remove refreshContainersPermissions() step - was introduced while tracing a bug!
            return window.safeApp.refreshContainersPermissions(appHandle).then(_ => {
              return self._getSafeHandles(appHandle).then(mdHandle => {
                if (mdHandle) {
                  // TODO consider store authUri and other user related settings in browser localStorage?
                  /* self.configure({
                    appHandle: _appHandle,   // safeApp.initialise() return (appHandle)
                    authURI: authUri,       // safeApp.authorise() return (authUri)
                    permissions: self._safeAppPermissions, // Permissions used to request authorisation
                    options: self._safeAppConfig.options, // Options used to request authorisation
                  });*/
                  safeLog('SAFEApp authorised and configured');
                  self._isAuthorised = true;
                  safeWeb.testsAuth(this._mdRoot, this._nfsRoot); // TODO remove (for test only)
                  resolve(true);
                }
              }, function (err) {
                self.reflectNetworkStatus(false);
                safeLog('SAFEApp SafeNetwork getMdHandle() failed: ' + err);
                self.freeSafeAPI();
                reject(false);
              });
            });
          }, function (err) {
            self.reflectNetworkStatus(false);
            safeLog('SAFEApp SafeNetwork Connect Failed: ' + err);
            self.freeSafeAPI();
            reject(false);
          });
        }, function (err) {
          self.reflectNetworkStatus(false);
          safeLog('SAFEApp SafeNetwork Authorisation Failed: ' + err);
          self.freeSafeAPI();
          reject(false);
        });
      }, function (err) {
        self.reflectNetworkStatus(false);
        safeLog('SAFEApp SafeNetwork Initialise Failed: ' + err);
        self.freeSafeAPI();
        reject(false);
      });
    });

    return result;
  },

  /*
  *********************************************************************
  **** Implementation spec: ZIM "SAFE + SOLID and RS Integration" *****
  *********************************************************************
   * EEEEEK: how do I get UI into rdflib.js???
    - Maybe you don't - provide instructions on using WHM to create solid service?
      - does that work or will WHM need to be tweaked for non www services
      - be nice if WHM can list solid folder content!!!
    - Later maybe create a separate solid web app on SAFEnetwork? This would
      remain a two stage process: a) use safe:manage.solid to set up your solid
       storage and WebID profile, b) use any Solid app, unmodified except for
       tr
       building with the SAFE version of rdflib.js
  
  */

  /**
   * Handle 'safe:' URIs to provide LDP interface to Safenetwork backend
   *
   * For Safenetwork proof of concept we:
   *  - assume a public container _public/solid/
   *  - use SAFE API simulateAs('NFS') to manage container contents
   *  - so the URI will be some public name (e.g. pubid) such as
   *      safe:pubid/solidfile
   *    where solidresource maps to _public/solid
   *
   * Notes:
   *    how to handle different public ids (domains) on the same account?
   *      -> keep a map to cache solid service MD corresponding to each public id (domain)
   *    how to handle different pubiic ids (domains) on multiple accounts?
   *      -> not currently supported by SAFE Browser (only one account can be authorised at one time)
   *
   * TODO refactor to implement Safenetwork service 'solid' (cf 'www')
   * TODO Implement PATCH (using GET, modify, POST)
   *
   * @param docUri {string}
   * @param options {Object}
   *
   * @returns null if not handled, or a {Promise<Object} on handling a safe: URI
   */

  fetch: function (docUri, options) {
    safeLog('SafenetworkLDP.fetch(%s,%o)...', docUri, options);
    var self = this;
    //    return httpFetch(docUri,options) // TESTING so pass through

    if (!self.isEnabled()) {
      safeLog('WARNING: safe:// URI handling is not enabled so this will fail');
      return httpFetch(docUri, options);
    }

    let allowAuthOn401 = true;
    let result = new Promise((resolve, reject) => {
      //console.assert('safe' == protocol(docUri),protocol(docUri))

      if (!self._isAuthorised) {
        if (self._authOnAccess || self._authOnWrite && ['POST', 'PUT', 'DELETE', 'PATCH'].indexOf(options.method) != -1) {
          return self.safenetworkAuthorise().then(_ => {
            return self._fetch(docUri, options).then(fetchResponse => {
              return resolve(fetchResponse);
            });
          });
        }
      }

      return self._fetch(docUri, options).then(fetchResponse => {
        return resolve(fetchResponse);
      }, err => {
        if (err.status == '401' && self._authOnAccessDenied && allowAuthOn401) {
          allowAuthOn401 = false; // Once per fetch attempt
          return self.safenetworkAuthorise().then(_ => {
            return self._fetch(docUri, options).then(fetchResponse => {
              return resolve(fetchResponse);
            });
          });
        } else return reject(err);
      });
    });

    return result;
  },

  /**
   * _fetch - do the LDP action, maps GET/PUT/POST etc to SAFE LDP storage
   *
   * Provides mapping from URL to SAFE storage with partial LDP interface
   *
   * IMPLEMENTS:
   *  GET
   *  PUT
   *  POST
   *  DELETE
   *
   * NOT YET IMPLEMENTED:
   *  PATCH/HEAD/OPTIONS
   *
   * @returns request result (a Promise)
  */
  _fetch: function (docUri, options) {
    safeLog('_fetch(%s:%s,{%o})...', options.method, docUri, options);
    let self = this;

    // REMOVE THESE COMMENTS AFTER...
    // TODO refactor to implement Safenetwork service 'solid' (cf 'www')
    // Until then, ignore public id part of URL ('domain'):
    let docPath = pathpart(docUri); // Map URI to LDP storage location

    // TODO maybe: use ldp service specific container rather than _public?
    // TODO maybe: use a wrapper to get the MD for the solid service for the public id (domain)
    // TODO cache them for subsequent use (limit cache to N MDs)
    // How to handle different public ids on the same account?
    //   -> keep a map to cache solid service MD corresponding to each public id (domain)


    /** TODO handle special cases:
      *   create container - always returns success
      *   list container - normal
      *     NOTE: may need to return empty listing if no match, to appear as if empty container exists
      *   delete container - returns success
      *     NOTE: check what LDP does if delete non-empty container (may need to delete all contents)
      *   TODO check notes in this file and Zim!!!
      */

    let result = new Promise((resolve, reject) => {
      let response = {};
      switch (options.method) {
        case 'GET':
          return self.get(docPath, options).then(response => {
            response.status = response.statusCode; // TODO Map remoteStorage implementation until replaced

            // TODO if get() returns 404 (not found) return empty listing to fake existence of empty container
            if (response.status == 404) safeLog('WARNING: SafenetworkLDP::_fetch() may need to return empty listing for non-existant containers');
            return response;
          });
          break;

        case 'POST':
          if (isFolder(docPath)) return self.fakeCreateContainer(docPath, options);else // TODO Separate POST from PUT
            return self.put(docPath, options).then(response => {
              response.status = response.statusCode; // TODO Map remoteStorage implementation until replaced
              return response;
            });
          break;

        case 'PUT':
          return self.put(docPath, options).then(response => {
            response.status = response.statusCode; // TODO Map remoteStorage implementation until replaced
            return response;
          });
          break;

        case 'DELETE':
          if (isFolder(docPath)) return self.fakeDeleteContainer(docPath, options);else // TODO Separate POST from PUT
            return self.delete(docPath, options).then(response => {
              response.status = response.statusCode; // TODO Map remoteStorage implementation until replaced
              return response;
            });
          break;

        default:
          return new Response({}, { ok: false, status: 405, statusText: '405 Method Not Allowed' });
          break;
      }
    });

    return result;
  },

  fakeCreateContainer: function (path, options) {
    safeLog('fakeCreateContainer(%s,{%o})...');
    return new Response({}, { ok: true, status: 201, statusText: '201 Created' });
  },

  fakeDeleteContainer: function (path, options) {
    safeLog('fakeDeleteContainer(%s,{%o})...');
    return new Response({}, { ok: true, status: 200, statusText: 'OK' });
  },

  /**
   * Ensures SAFE API is ready for the given operation (GET/PUT/POST/DELETE/PATCH)
   *
   * GET can be achieved
   * @returns true if SAFE network is
   */

  _ensureInitialised: function () {},

  // Ensures all SAFE API handles are either valid, or all invalid (null)
  //
  // App must already be authorised (see safeAuthorise())
  //
  // Stores SAFE API Handles:
  //  _appHandle, _mdRoot (also returned), and _nfsRoot
  //
  // Returns a Promise which resolves to the mdHandle of the public container,
  // or null.
  _getSafeHandles: function (appHandle) {
    let self = this;

    let result = new Promise((resolve, reject) => {
      if (self._mdRoot && self._nfsRoot) {
        resolve(self._mdRoot);
      } else {
        return window.safeApp.canAccessContainer(appHandle, '_public', ['Read']) //['Insert', 'Update', 'Delete'])
        .then(r => {
          if (r) {
            safeRsLog('The app has been granted permissions for `_public` container');
            return window.safeApp.getContainer(appHandle, '_public').then(mdHandle => {
              self._mdRoot = mdHandle;
              return window.safeMutableData.emulateAs(self._mdRoot, 'NFS').then(nfsHandle => {
                self._appHandle = appHandle;
                self._nfsRoot = nfsHandle;
                safeRsLog('_getSafeHandles() appHandle:  ' + self._appHandle);
                safeRsLog('_getSafeHandles() mdRoot:  ' + self._mdRoot);
                safeRsLog('_getSafeHandles() nfsRoot: ' + self._nfsRoot);
                resolve(self._mdRoot); // Return mdRoot only if also have nfsHandle
              }, err => {
                // mrhTODO how to handle in UI?
                safeRsLog('SafeNetwork failed to access container');
                log(err);
                window.safeMutableData.free(self._mdRoot);
                self._mdRoot = null;
                reject(err);
              });
            });
          }
        }, err => {
          safeRsLog('The app has been DENIED permissions for `_public` container');
          safeRsLog('' + err);
          reject(err);
        });
      }
    });

    return result;
  },

  // Release all handles from the SAFE API
  freeSafeAPI: function () {
    // Freeing the _appHandle also frees all other handles
    if (this._appHandle) {
      window.safeApp.free(this._appHandle);
      this._appHandle = null;
      this._mdRoot = null;
      this._nfsRoot = null;
    }
    this._isAuthorised = false;
  },

  // TODO consider store authUri and other user related settings in browser localStorage?
  OLD_configure: function (settings) {
    // We only update these when set to a string or to null:
    if (typeof settings.userAddress !== 'undefined') {
      this.userAddress = settings.userAddress;
    }
    if (typeof settings.appHandle !== 'undefined') {
      this.appHandle = settings.appHandle;
    }

    var writeSettingsToCache = function () {
      if (hasLocalStorage) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({
          userAddress: this.userAddress
          /*
           * appHandle: this.appHandle, authUri: this.authUri, permissions:
           * this.permissions,
           */
        }));
      }
    };

    var handleError = function () {
      this.connected = false;
      delete this.permissions;

      if (hasLocalStorage) {
        localStorage.removeItem(SETTINGS_KEY);
      }
      safeRsLog('SafeNetwork.configure() [DISCONNECTED]');
    };

    if (this.appHandle) {
      this.connected = true;
      this.permissions = settings.permissions;
      if (this.userAddress) {
        this._emit('connected');
        writeSettingsToCache.apply(this);
        safeRsLog('SafeNetwork.configure() [CONNECTED-1]');
      } else {
        // No account names on SAFE Network
        // 'account secret' is closest, but best not to show
        this.info().then(function (info) {
          this.userAddress = info.accountName;
          this.rs.widget.view.setUserAddress(this.userAddress);
          this._emit('connected');
          writeSettingsToCache.apply(this);
          safeRsLog('SafeNetwork.configure() [CONNECTED]-2');
        }.bind(this)).catch(function () {
          handleError.apply(this);
          this._emit('error', new Error('Could not fetch account info.'));
        }.bind(this));
      }
    } else {
      handleError.apply(this);
    }
  },

  connect: function () {
    safeRsLog('SafeNetwork.connect()...');

    // mrhTODO: dropbox connect calls hookIt() if it has a token - for sync?
    // mrhTODO: dropbox connect skips auth if it has a token - enables it
    // to remember connection across sessions
    // mrhTODO: if storing Authorization consider security risk - e.g. another
    // app could steal to access SAFE Drive?
    this.rs.setBackend('safenetwork');
    this._setBackendExtras('safenetwork');
    this.safenetworkAuthorize(this.rs.apiKeys['safenetwork']);
  },

  // SafeNetwork is the first backend that doesn't involve a re-direct, and so
  // doesn't trigger _init() upon successful authorisation. So we have to
  // do a bit more here to ensure what happens at the end of RS loadFeatures()
  // as a result of the redirect is also done without it.
  //
  // mrhTODO - this should probably go in the RS setBackend()
  _setBackendExtras: function () {
    var rs = this.rs;

    // Missing from setBackend()
    // Needed to ensure we're the active backend or sync won't start
    // if:
    // - this backend was not already set in localStorage on load, *and*
    // - this backend doesn't do a redirect (page reload) after authorisation
    //
    // See: https://github.com/theWebalyst/remotestorage.js/issues/1#
    //
    if (this.rs.backend === 'safenetwork' && typeof this.rs._safenetworkOrigRemote === 'undefined') {
      this.rs._safenetworkOrigRemote = this.rs.remote;
      this.rs.remote = this.rs.safenetwork;
      this.rs.sync.remote = this.rs.safenetwork;

      // mrhTODO - this doesn't check that the event listener hasn't already
      // been installed - should it?

      // mrhTODO - hope fireReady() only matters in RS _init() (see below)

      if (rs.widget) rs.widget.initRemoteListeners();

      this.on('connected', function () {
        // fireReady();
        rs._emit('connected');
      });
      this.on('not-connected', function () {
        // fireReady();
        rs._emit('not-connected');
      });

      if (this.connected) {
        // fireReady();
        rs._emit('connected');
      }

      if (!rs.hasFeature('Authorize')) {
        this.stopWaitingForToken();
      }
    }
  },

  stopWaitingForToken: function () {
    if (!this.connected) {
      safeRsLog('not-connected');
    }
  },

  // TODO switch this to use _connected?
  reflectNetworkStatus: function (isOnline) {
    if (this.online != isOnline) {
      this.online = isOnline;
      safeRsLog('reflectNetworkStatus(): ' + (isOnline ? 'network-online' : 'network-offline'));
      //this.rs._emit(isOnline ? 'network-online' : 'network-offline');
    }
  },

  OLD_safenetworkAuthorize: function (appApiKeys) {
    safeRsLog('safenetworkAuthorize()...');

    var self = this;
    self.appKeys = appApiKeys.app;

    // mrhTODO untested:
    // tokenKey = SETTINGS_KEY + ':appToken';

    window.safeApp.initialise(self.appKeys, newState => {
      safeRsLog('SafeNetwork state changed to: ', newState);
    }).then(appHandle => {
      safeRsLog('SAFEApp instance initialised and appHandle returned: ', appHandle);

      window.safeApp.authorise(appHandle, self.appKeys.permissions, self.appKeys.options).then(authUri => {
        safeRsLog('SAFEApp was authorised and authUri received: ', authUri);
        window.safeApp.connectAuthorised(appHandle, authUri).then(_ => {
          safeRsLog('SAFEApp was authorised & a session was created with the SafeNetwork');

          self._getSafeHandles(appHandle).then(mdHandle => {
            if (mdHandle) {
              self.configure({
                appHandle: appHandle, // safeApp.initialise() return (appHandle)
                authURI: authUri, // safeApp.authorise() return (authUri)
                permissions: self.appKeys.permissions, // Permissions used to request authorisation
                options: self.appKeys.options // Options used to request authorisation
              });
              safeRsLog('SAFEApp authorised and configured');
            }
          }, function (err) {
            self.reflectNetworkStatus(false);safeRsLog('SAFEApp SafeNetwork getMdHandle() failed: ' + err);
          });
        }, function (err) {
          self.reflectNetworkStatus(false);safeRsLog('SAFEApp SafeNetwork Connect Failed: ' + err);
        });
      }, function (err) {
        self.reflectNetworkStatus(false);safeRsLog('SAFEApp SafeNetwork Authorisation Failed: ' + err);
      });
    }, function (err) {
      self.reflectNetworkStatus(false);safeRsLog('SAFEApp SafeNetwork Initialise Failed: ' + err);
    });
  },

  // mrhTODO Adapted from remotestorage.js but may be better way to do this
  _wrapBusyDone: function (result, method, path) {
    var self = this;
    var folderFlag = isFolder(path);

    self._emit('wire-busy', { method: method, isFolder: folderFlag });
    return result.then(function (r) {
      self._emit('wire-done', { method: method, success: true, isFolder: folderFlag });
      return Promise.resolve(r);
    }, function (err) {
      self._emit('wire-done', { method: method, success: false, isFolder: folderFlag });
      return Promise.reject(err);
    });
  },

  // For reference see WireClient#get (wireclient.js)
  RS_get: function (path, options) {
    result = this.get(path, options);
    return this._wrapBusyDone.call(this, result, "get", path);
  },

  get: function (path, options) {
    safeRsLog('SafeNetwork.get(' + path + ',...)');
    var fullPath = (PATH_PREFIX + '/' + path).replace(/\/+/g, '/');

    if (path.substr(-1) === '/') {
      return this._getFolder(fullPath, options);
    } else {
      return this._getFile(fullPath, options);
    }
  },

  // put - create and/or update a file
  //
  // "The response MUST contain a strong etag header, with the document's
  // new version (for instance a hash of its contents) as its value."
  // Spec:
  // https://github.com/remotestorage/spec/blob/master/release/draft-dejong-remotestorage-07.txt#L295-L296
  // See WireClient#put and _request for details of what is returned
  //
  // mrhTODO bug: contentType is not saved (or updated)

  RS_put: function (path, body, contentType, options) {
    return this._wrapBusyDone.call(this, this.put(path, body, contentType, options), "put", path);
  },

  put: function (path, body, contentType, options) {
    safeRsLog('SafeNetwork.put(' + path + ', ' + (options ? '{IfMatch: ' + options.IfMatch + ', IfNoneMatch: ' + options.IfNoneMatch + '})' : 'null)'));
    var fullPath = (PATH_PREFIX + '/' + path).replace(/\/+/g, '/');

    // putDone - handle PUT response codes, optionally decodes metadata from
    // JSON format response
    var self = this;
    function putDone(response) {
      safeRsLog('SafeNetwork.put putDone(statusCode: ' + response.statusCode + ') for path: ' + path);

      // mrhTODO response.statusCode checks for versions are untested
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return self._getFileInfo(fullPath).then(function (fileInfo) {

          var etagWithoutQuotes = typeof fileInfo.ETag === 'string' ? fileInfo.ETag : undefined;
          return Promise.resolve({ statusCode: 200, 'contentType': contentType, revision: etagWithoutQuotes });
        }, function (err) {
          safeRsLog('REJECTING!!! ' + err.message);
          return Promise.reject(err);
        });
      } else if (response.statusCode === 412) {
        // Precondition failed
        safeRsLog('putDone(...) conflict - resolving with statusCode 412');
        return Promise.resolve({ statusCode: 412, revision: 'conflict' });
      } else {
        return Promise.reject(new Error("PUT failed with status " + response.statusCode + " (" + response.responseText + ")"));
      }
    }
    return self._getFileInfo(fullPath).then(function (fileInfo) {
      if (fileInfo) {
        if (options && options.ifNoneMatch === '*') {
          return putDone({ statusCode: 412 }); // Precondition failed
          // (because entity exists,
          // version irrelevant)
        }
        return self._updateFile(fullPath, body, contentType, options).then(putDone);
      } else {
        return self._createFile(fullPath, body, contentType, options).then(putDone);
      }
    }, function (err) {
      safeRsLog('REJECTING!!! ' + err.message);
      return Promise.reject(err);
    });
  },

  RS_delete: function (path, options) {
    return this._wrapBusyDone.call(this, this.delete(path, options), "delete", path);
  },

  delete: function (path, options) {
    safeRsLog('SafeNetwork.delete(' + path + ',...)');
    var fullPath = (PATH_PREFIX + '/' + path).replace(/\/+/g, '/');

    safeRsLog('SafeNetwork.delete: ' + fullPath + ', ...)');
    var self = this;

    return self._getFileInfo(fullPath).then(function (fileInfo) {
      if (!fileInfo) {
        // File doesn't exist. Ignore.
        // mrhTODO should this be an error?
        return Promise.resolve({ statusCode: 200 });
      }

      var etagWithoutQuotes = typeof fileInfo.ETag === 'string' ? fileInfo.ETag : undefined;
      if (ENABLE_ETAGS && options && options.ifMatch && options.ifMatch !== etagWithoutQuotes) {
        return { statusCode: 412, revision: etagWithoutQuotes };
      }

      if (fullPath.substr(-1) !== '/') {
        safeRsLog('safeNfs.delete() param self._nfsRoot: ' + self._nfsRoot);
        safeRsLog('                 param fullPath: ' + fullPath);
        safeRsLog('                 param version: ' + fileInfo.version);
        safeRsLog('                 param containerVersion: ' + fileInfo.containerVersion);
        return window.safeNfs.delete(self._nfsRoot, fullPath, fileInfo.version + 1).then(function (success) {
          // mrhTODO must handle: if file doesn't exist also do
          // self._fileInfoCache.delete(fullPath);

          self.reflectNetworkStatus(true); // mrhTODO - should be true,
          // unless 401 - Unauthorized

          if (success) {
            self._fileInfoCache.delete(fullPath);
            return Promise.resolve({ statusCode: 200 });
          } else {
            // mrhTODO - may need to trigger update of cached container info
            return Promise.reject('safeNFS deleteFunction("' + fullPath + '") failed: ' + success);
          }
        }, function (err) {
          // mrhTODO - may need to trigger update of cached container info
          safeRsLog('REJECTING!!! deleteFunction("' + fullPath + '") failed: ' + err.message);
          return Promise.reject(err);
        });
      }
    }, function (err) {
      self.reflectNetworkStatus(false);
      safeRsLog('REJECTING!!! ' + err.message);
      return Promise.reject(err);
    });
  },

  /**
   * Method: info
   *
   * Fetches an account name for display in widget
   *
   * Returns:
   *
   * A promise to the user's account info
   */
  RS_info: function () {
    return this._wrapBusyDone.call(this, this.info(), "get", '');
  },

  info: function () {
    // Not implemented on SAFE, so provdie a default
    return Promise.resolve({ accountName: 'SafeNetwork' });
  },

  _updateFile: function (fullPath, body, contentType, options) {
    safeRsLog('SafeNetwork._updateFile(' + fullPath + ',...)');
    var self = this;

    // mrhTODO GoogleDrive only I think:
    // if ((!contentType.match(/charset=/)) &&
    //     (encryptedData instanceof ArrayBuffer || WireClient.isArrayBufferView(encryptedData))) {
    //       contentType += '; charset=binary';
    // }

    return self._getFileInfo(fullPath).then(function (fileInfo) {
      if (!fileInfo) {
        // File doesn't exist. Ignore.
        self._fileInfoCache.delete(fullPath); // Invalidate any cached
        // eTag
        return Promise.resolve({ statusCode: 200 });
      }

      var etagWithoutQuotes = typeof fileInfo.ETag === 'string' ? fileInfo.ETag : undefined;
      if (ENABLE_ETAGS && options && options.ifMatch && options.ifMatch !== etagWithoutQuotes) {
        return { statusCode: 412, revision: etagWithoutQuotes };
      }

      // Only act on files (directories are inferred so no need to delete)
      if (fullPath.substr(-1) === '/') {
        self._fileInfoCache.delete(fullPath); // Directory - invalidate
        // any cached eTag
      } else {
        // Store content as new immutable data (pointed to by fileHandle)
        return window.safeNfs.create(self._nfsRoot, body).then(fileHandle => {
          // mrhTODO set file metadata (contentType) - how?

          // Add file to directory (by inserting fileHandle into container)
          return window.safeNfs.update(self._nfsRoot, fileHandle, fullPath, fileInfo.containerVersion + 1).then(fileHandle => {
            self._updateFileInfo(fileHandle, fullPath);

            // self._shareIfNeeded(fullPath); // mrhTODO what's this?

            var response = { statusCode: fileHandle ? 200 : 400 };
            // mrhTODO currently just a response that resolves to truthy (may be exteneded to return status?)
            self.reflectNetworkStatus(true);

            // mrhTODO Not sure if eTags can still be simulated:
            // mrhTODO would it be better to not delete, but set fileHandle
            // in the fileInfo?
            self._fileInfoCache.delete(fullPath); // Invalidate any cached
            // eTag

            return Promise.resolve(response);
          }, function (err) {
            self.reflectNetworkStatus(false); // mrhTODO - should go offline for Unauth or Timeout
            safeRsLog('REJECTING!!! safeNfs.update("' + fullPath + '") failed: ' + err.message);
            return Promise.reject(err);
          });
        }, function (err) {
          self.reflectNetworkStatus(false); // mrhTODO - should go offline for Unauth or Timeout
          safeRsLog('REJECTING!!! safeNfs.create("' + fullPath + '") failed: ' + err.message);
          return Promise.reject(err);
        });
      }
    }, function (err) {
      self.reflectNetworkStatus(false);
      safeRsLog('REJECTING!!! ' + err.message);
      return Promise.reject(err);
    });
  },

  _createFile: function (fullPath, body, contentType, options) {
    safeRsLog('SafeNetwork._createFile(' + fullPath + ',...)');
    var self = this;
    var result = new Promise((resolve, reject) => {
      // Store content as new immutable data (pointed to by fileHandle)
      return window.safeNfs.create(self._nfsRoot, body).then(function (fileHandle) {
        // mrhTODOx set file metadata (contentType) - how?

        // Add file to directory (by inserting fileHandle into container)
        return window.safeNfs.insert(self._nfsRoot, fileHandle, fullPath).then(function (fileHandle) {
          // self._shareIfNeeded(fullPath); // mrhTODO what's this?

          var response = { statusCode: fileHandle ? 200 : 400 }; // mrhTODO currently just a response that resolves to truthy (may be exteneded to return status?)
          self.reflectNetworkStatus(true);

          // mrhTODO Not sure if eTags can still be simulated:
          // mrhTODO would it be better to not delte, but set the fileHandle
          // in the fileInfo?
          // self._fileInfoCache.delete(fullPath);     // Invalidate any cached eTag
          self._updateFileInfo(fileHandle, fullPath);

          return resolve(response);
        }, function (err) {
          self.reflectNetworkStatus(false); // mrhTODO - should go offline for Unauth or Timeout
          safeRsLog('REJECTING!!! safeNfs.insert("' + fullPath + '") failed: ' + err.message);
          return reject(err);
        });
      }, function (err) {
        self.reflectNetworkStatus(false); // mrhTODO - should go offline for Unauth or Timeout
        safeRsLog('REJECTING!!! safeNfs.create("' + fullPath + '") failed: ' + err.message);
        return reject(err);
      });
    });

    return result;
  },

  // For reference see WireClient#get (wireclient.js)
  _getFile: function (fullPath, options) {
    safeRsLog('SafeNetwork._getFile(' + fullPath + ', ...)');
    if (!this.connected) {
      return Promise.reject("not connected (fullPath: " + fullPath + ")");
    }
    var self = this;

    // Check if file exists by obtaining directory listing if not already cached
    return self._getFileInfo(fullPath).then(function (fileInfo) {
      if (!fileInfo) {
        return Promise.resolve({ statusCode: 404 }); // File does not exist (mrhTODO should this reject?)
      }

      // TODO If the options are being used to retrieve specific version
      // should we get the latest version from the API first?
      var etagWithoutQuotes = fileInfo.ETag;

      // Request is for changed file, so if eTag matches return "304 Not Modified"
      if (ENABLE_ETAGS && options && options.ifNoneMatch && etagWithoutQuotes && etagWithoutQuotes === options.ifNoneMatch) {
        return Promise.resolve({ statusCode: 304 });
      }

      return window.safeNfs.fetch(self._nfsRoot, fullPath).then(fileHandle => {
        safeRsLog('fetched fileHandle: ' + fileHandle.toString());
        self.fileHandle = fileHandle; // mrhTODOx need setter to compare & free if new fileHandle
        return window.safeNfs.open(self._nfsRoot, fileHandle, 4 /* read */).then(fileHandle => {
          safeRsLog('safeNfs.open() returns fileHandle: ' + fileHandle.toString());
          self.openFileHandle = fileHandle;
          return window.safeNfsFile.size(self.openFileHandle).then(size => {
            safeRsLog('safeNfsFile.size() returns size: ' + size.toString());
            return window.safeNfsFile.read(self.openFileHandle, 0, size).then(content => {
              safeRsLog('' + content.byteLength + ' bytes read from file.');

              decoder = new TextDecoder();
              data = decoder.decode(content);
              safeRsLog('data: "' + data + '"');

              // TODO SAFE API file-metadata - disabled for now:
              // var fileMetadata = response.getResponseHeader('file-metadata');
              // if (fileMetadata && fileMetadata.length() > 0){
              //   fileMetadata = JSON.parse(fileMetadata);
              //   safeRsLog('..file-metadata: ' + fileMetadata);
              // }

              // Refer to baseclient.js#getFile for retResponse spec (note getFile header comment wrong!)
              var retResponse = {
                statusCode: 200,
                body: data,
                // TODO look into this:
                /*body: JSON.stringify(data),*/ // TODO Not sure stringify() needed, but without it local copies of nodes differ when loaded from SAFE
                // TODO RS ISSUE:  is it a bug that RS#get accepts a string *or an object* for body? Should it only accept a string?
                revision: etagWithoutQuotes
              };

              retResponse.contentType = 'application/json; charset=UTF-8'; // mrhTODO googledrive.js#put always sets this type, so farily safe default until SAFE NFS supports save/get of content type

              if (fileInfo && fileInfo['Content-Type']) {
                retResponse.contentType = fileInfo['Content-Type'];
              }

              self.reflectNetworkStatus(true);
              return Promise.resolve(retResponse);
            }, function (err) {
              self.reflectNetworkStatus(false); // mrhTODO - should go offline for Unauth or Timeout
              safeRsLog('REJECTING!!! safeNfs get file: "' + fullPath + '" failed: ' + err.message);
              return Promise.reject({ statusCode: 404 }); // mrhTODO can we get statusCode from err?
            });
          }, function (err) {
            safeRsLog('REJECTING!!! ' + err.message); // mrhTODO - MAYBE go offline (see above)
            return Promise.reject(err);
          });
        }, function (err) {
          safeRsLog('REJECTING!!! ' + err.message); // mrhTODO - MAYBE go offline (see above)
          return Promise.reject(err);
        });
      }, function (err) {
        safeRsLog('REJECTING!!! ' + err.message); // mrhTODO - MAYBE go offline (see above)
        return Promise.reject(err);
      });
    }, function (err) {
      safeRsLog('REJECTING!!! ' + err.message); // mrhTODO - MAYBE go offline (see above)
      return Promise.reject(err);
    });
  },

  /* _makeFileInfo - use fileHandle to insert metadata into given fileInfo
   returns a Promise which resolves to a fileInfo object
  */
  _makeFileInfo: function (fileHandle, fileInfo, fullPath) {
    return new Promise((resolve, reject) => {

      return window.safeNfsFile.metadata(fileHandle).then(fileMetadata => {
        fileInfo.created = fileMetadata.created;
        fileInfo.modified = fileMetadata.modified;
        fileInfo.version = fileMetadata.version;
        fileInfo.dataMapName = fileMetadata.dataMapName; // mrhTODO Debug only!

        // Overwrite ETag using the file version (rather than the enry version)
        fileInfo.ETag = fullPath + '-v' + fileMetadata.version;
        resolve(fileInfo);
      }, function (err) {
        safeRsLog('_makeFileInfo(' + fullPath + ') > safeNfsFile.metadata() FAILED: ' + err);
        reject(err);
      });
    });
  },

  /* _updateFileInfo - use fileHandle to update cached fileInfo with metadata
   returns a Promise which resolves to an updated fileInfo
  */
  _updateFileInfo: function (fileHandle, fullPath) {
    return new Promise((resolve, reject) => {
      return this._getFileInfo(fullPath).then(fileInfo => {
        if (fileInfo) //mrhTODOcurrent - break in here and see if it seems ok when I save a note
          resolve(fileInfo);else reject('_updateFileInfo( ' + fullPath + ') - unable to update - no existing fileInfo');
      });
    });
  },

  // _getFolder - obtain folder listing
  //
  // For reference see WireClient#get (wireclient.js) summarised as follows:
  // - parse JSON (spec example:
  // https://github.com/remotestorage/spec/blob/master/release/draft-dejong-remotestorage-07.txt#L223-L235)
  // - return a map of item names to item object mapping values for "Etag:",
  // "Content-Type:" and "Content-Length:"
  // - NOTE: googledrive.js only provides ETag, safenetwork.js provides ETag,
  // *fake* Content-Length and *fake* Content-Type
  // - NOTE: safenetwork.js ETag values are faked but adequate

  _getFolder: function (fullPath, options) {
    safeRsLog('SafeNetwork._getFolder(' + fullPath + ', ...)');
    var self = this;
    var listing = {};

    return new Promise((resolve, reject) => {
      // Create listing by enumerating container keys beginning with fullPath
      const directoryEntries = [];
      return window.safeMutableData.getEntries(self._mdRoot).then(entriesHandle => window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
        // Skip deleted entries
        if (v.buf.length == 0) {
          // mrhTODOsoon try without this...
          return true; // Next
        }
        safeRsLog('Key: ', k.toString());
        safeRsLog('Value: ', v.buf.toString('base64'));
        safeRsLog('entryVersion: ', v.version);

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
      })).then(_ => Promise.all(directoryEntries.map(fileInfo => {
        safeRsLog('directoryEntries.map() with ' + JSON.stringify(fileInfo));

        if (fileInfo.fullPath.slice(-1) == '/') {
          // Directory entry:
          safeRsLog('Listing: ', fileInfo.name);
          listing[fileInfo.name] = fileInfo;
        } else {
          // File entry:
          try {
            safeRsLog('DEBUG: window.safeNfs.fetch(' + fileInfo.fullPath + ')...');
            return window.safeNfs.fetch(self._nfsRoot, fileInfo.fullPath).then(fileHandle => self._makeFileInfo(fileHandle, fileInfo, fileInfo.fullPath).then(fileInfo => {

              safeRsLog('file created: ' + fileInfo.created);
              safeRsLog('file modified: ' + fileInfo.modified);
              safeRsLog('file version: ' + fileInfo.version);
              safeRsLog('file dataMapName: ' + fileInfo.dataMapName.toString('base64'));

              // File entry:
              self._fileInfoCache.set(fileInfo.fullPath, fileInfo);
              safeRsLog('..._fileInfoCache.set(file: ' + fileInfo.fullPath + ')');
              safeRsLog('Listing: ', fileInfo.name);
              listing[fileInfo.name] = fileInfo;
            }));
          } catch (err) {
            safeRsLog('_getFolder( ' + fileInfo.fullPath + ' ) Skipping invalid entry. Error: ' + err);
          }
        }
      })).then(_ => {
        safeRsLog('Iteration finished');
        safeRsLog('SafeNetwork._getFolder(' + fullPath + ', ...) RESULT: listing contains ' + JSON.stringify(listing));
        var folderMetadata = { contentType: RS_DIR_MIME_TYPE }; // mrhTODOx - check what is expected and whether we can provide something
        return resolve({ statusCode: 200, body: listing, meta: folderMetadata, contentType: RS_DIR_MIME_TYPE /*, mrhTODOx revision: folderETagWithoutQuotes*/ });
      })).catch(err => {
        safeRsLog('directoryEntries.map() invalid folder entry - ERROR: ' + err);
      });
    }).catch(err => {
      self.reflectNetworkStatus(false); // mrhTODO - should go offline for Unauth or Timeout
      safeRsLog('safeNfs.getEntries("' + fullPath + '") failed: ' + err.status);
      // var status = (err == 'Unauthorized' ? 401 : 404); // mrhTODO
      // ideally safe-js would provide response code (possible enhancement)
      if (err.status === undefined) err.status = 401; // Force Unauthorised, to handle issue in safe-js:

      if (err.status == 401) {
        // Modelled on how googledrive.js handles expired token
        if (self.connected) {
          self.connect();
          return resolve({ statusCode: 401 }); // mrhTODO should this reject
        }
      }
      return reject({ statusCode: err.status });
    });
  },

  // mrhTODO review and fix all these function headers

  // _getFileInfo() - check if file exists
  //
  // Checks if the file (fullPath) is in the _fileInfoCache(), and if
  // not found obtains a parent folder listing to check if it exists.
  // Causes update of _fileInfoCache with contents of its parent folder.
  //
  // Folders - a folder is inferred, so:
  // - a folder is deemed valid if any *file* path contains it
  // - fileInfo for a folder lacks a version or eTag
  //
  // RETURNS
  // Promise() with
  // if a file { path: string, ETag: string, 'Content-Length': number }
  // if a folder { path: string, ETag: string }
  // if root '/' { path: '/' ETag }
  // or {} if file/folder doesn't exist
  // See _getFolder() to confirm the above content values (as it creates
  // fileInfo objects)
  //
  _getFileInfo: function (fullPath) {
    safeRsLog('SafeNetwork._getFileInfo(' + fullPath + ')');

    var self = this;
    let result = new Promise((resolve, reject) => {

      if (fullPath === '/') {
        // Dummy fileInfo to stop at "root"
        return resolve({ path: fullPath, ETag: 'root' });
      }

      if (info = self._fileInfoCache.get(fullPath)) {
        return resolve(info);
      }

      // Not yet cached or doesn't exist
      // Load parent folder listing update _fileInfoCache.
      return window.safeMutableData.getVersion(self._mdRoot).then(rootVersion => {

        /* TODO there seems no point calling _getFileInfo on a folder so could just
        let that trigger an error in this function, then fix the call to handle differently
        */
        if (fullPath.substr(-1) === '/') {
          // folder, so fake its info
          // Add file info to cache
          var fileInfo = {
            fullPath: fullPath // Used by _fileInfoCache() but nothing else
          };

          self._fileInfoCache.set(fullPath, fileInfo);
          return resolve(fileInfo);
        }

        return self._getFolder(parentPath(fullPath)).then(_ => {
          if (info = self._fileInfoCache.get(fullPath)) {
            return resolve(info);
          } else {
            // file, doesn't exist
            safeRsLog('_getFileInfo(' + fullPath + ') file does not exist, no fileInfo available ');
            return resolve(null);
          }
        }, err => {
          safeRsLog('_getFileInfo(' + fullPath + ') failed to get parent directory of file ');
          return resolve(null);
        });
      }, function (err) {
        safeRsLog('_getFileInfo(' + fullPath + ') > safeMutableData.getVersion() FAILED: ' + err);
        return reject(err);
      });
    });

    return result;
  }
};

let Safenetwork = new SafenetworkLDP();

// TODO maybe expose SafenetworkLDP get, put, delete?

exports = module.exports = SafenetworkLDP.bind(Safenetwork);
module.exports.Configure = SafenetworkLDP.prototype.Configure.bind(Safenetwork);
module.exports.Enable = SafenetworkLDP.prototype.Enable.bind(Safenetwork);
module.exports.isEnabled = SafenetworkLDP.prototype.isEnabled.bind(Safenetwork);

// map protocols to fetch()
const fetch = protoFetch({
  http: httpFetch,
  https: httpFetch,
  safe: Safenetwork.fetch.bind(Safenetwork)
  //  https: Safenetwork.fetch.bind(Safenetwork), // Debugging with SAFE mock browser
});

module.exports.protoFetch = fetch;

/***/ }),
/* 4 */
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
/* 5 */
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
exports.humanize = __webpack_require__(6);

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
/* 6 */
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
/* 7 */
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
/* 8 */
/***/ (function(module, exports, __webpack_require__) {

// the whatwg-fetch polyfill installs the fetch() function
// on the global object (window or self)
//
// Return that as the export for use in Webpack, Browserify etc.
__webpack_require__(9);
module.exports = self.fetch.bind(self);


/***/ }),
/* 9 */
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
/* 10 */
/***/ (function(module, exports, __webpack_require__) {

const url = __webpack_require__(11)

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
/* 11 */
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



var punycode = __webpack_require__(12);
var util = __webpack_require__(15);

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
    querystring = __webpack_require__(16);

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
/* 12 */
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

/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(13)(module), __webpack_require__(14)))

/***/ }),
/* 13 */
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
/* 14 */
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
/* 15 */
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
/* 16 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


exports.decode = exports.parse = __webpack_require__(17);
exports.encode = exports.stringify = __webpack_require__(18);


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
/* 18 */
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