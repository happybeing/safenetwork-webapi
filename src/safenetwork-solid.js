// safenetwork-solid.js - Safenetwork RS.js backend, tweaked for SOLID LDP prototype
// TODO refactor as Safenetwork service handler for safe://solid.<public_name>
// TODO implement LDP: check get/put/delete
// TODO implement LDP: POST
// TODO implement LDP: OPTIONS
// TODO implement LDP: Headers
// TODO implement LDP: responses
// TODO implement LDP: createContainer
// TODO implement LDP: PATCH

// mrhTODO clean:
//var Authorize = require('./authorize');
//var BaseClient = require('./baseclient');
//var WireClient = require('./wireclient');
//var Sync = require('./sync');
var log = require('./log');
var util = require('./util');
var eventHandling = require('./eventhandling');

  /**
   * WORK IN PROGRESS, NOT RECOMMENDED FOR PRODUCTION USE
   *
   * SAFE Network backend for RemoteStorage.js
   * This file exposes a get/put/delete interface which is compatible with
   * <WireClient>.
   *
   * When remoteStorage.backend is set to 'safenetwork', this backend will
   * initialize and replace remoteStorage.remote with remoteStorage.safenetwork.
   *
   * mrhTODO add note about <BaseClient.getItemURL> (cf. dropbox.js)
   *
   * To use this backend, you need to provide information for SAFE
   * authorisation:
   *
   * (start code)
   *
   * mrhTODO: change example app code for SAFE Network
   * @example
   * remoteStorage.setApiKeys({
   *   dropbox: 'your-app-key'
   * });
   *
   * (end code)
   *
   */

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
  var ENABLE_ETAGS = true;   // false disables ifMatch / ifNoneMatch checks

  var hasLocalStorage;
  var SETTINGS_KEY = 'remotestorage:safenetwork';
  var PATH_PREFIX = '/remotestorage/';  // mrhTODO app configurable?

  var RS_DIR_MIME_TYPE = 'application/json; charset=UTF-8';

  var isFolder = util.isFolder;

  function parentPath(path) {
    return path.replace(/[^\/]+\/?$/, '');
  }

  // Used to cache file info
  var Cache = function (maxAge) {
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
      return (item && item.t >= (now - this.maxAge)) ? item.v : undefined;
    },

    set: function (key, value) {
      this._items[key] = {
        v: value,
        t: new Date().getTime()
      };
    },

    'delete': function (key) {
      if ( this._items[key] ) {
        delete this._items[key];
      }
    }
  };

  var onErrorCb;

  /**
   * @class
   */
  var SafeNetwork = function (rs) {

    this.rs = rs;
    // mrhTODO: info expires after 5 minutes (is this a good idea?)
    this._fileInfoCache = new Cache(60 * 5 * 1000);
    this.connected = false;
    var self = this;

/* Not in latest googledrive.js:
    onErrorCb = function (error){
      // mrhTODO should this affect this.connected, this.online and emit
      // network-offline?

      if (error instanceof RemoteStorage.Unauthorized) {

        // Delete all the settings - see the documentation of
        // wireclient.configure
        self.configure({
          // mrhTODO can probably eliminate all these - check if any apply to
          // SAFE backend first
          userAddress: null,    // webfinger style address (username@server)
          href: null,           // server URL from webfinger
          storageApi: null,     // remoteStorage API dependencies in here
                                // (safenetwork.js), not server, so hardcode?

          // SAFE Launcher auth response:
          appHandle:      null,                // safeApp.initialise() return
                                                // (appToken)
          authUri:        null,                    // safeApp.authorise()
                                                    // return (authUri)
          permissions:    null, // Permissions used to request authorisation
          options:        null,     // Options used to request authorisation
        });
      }
    };
    */
//    this.rs.on('error', onErrorCb);
    eventHandling(this, 'connected', 'not-connected');

    hasLocalStorage = util.localStorageAvailable();

    if (hasLocalStorage){
      var settings;
      try {
        settings = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      } catch(e) {
        localStorage.removeItem(SETTINGS_KEY);  // Clear broken settings
      }

      if (settings)
        this.configure(settings);
    }

};

  SafeNetwork.prototype = {
    connected: false,
    online: true,
    isPathShared: true,         // App private storage mrhTODO shared or
                                // private? app able to control?
    mdRoot:   null,             // Handle for root mutable data (mrhTODO:
                                // initially maps to _public)
    nfsRoot:  null,             // Handle for nfs emulation


    // Return a Promise which resolves to the mdHandle of the public container,
    // or null
    // App must already be authorised (see safeAuthorise())
    _getMdHandle: function (appHandle) {
      self = this;

      let result = new Promise((resolve,reject) => {
        if (self.mdHandle){
          resolve(self.mdHandle);
        }
        else {
          window.safeApp.canAccessContainer(appHandle, '_public', ['Insert', 'Update', 'Delete'])
          .then((r) => {
            if (r) {
            log('[SafeNetwork] The app has been granted permissions for `_public` container');
            window.safeApp.getContainer(appHandle, '_public')
             .then((mdHandle) => {
               self.mdRoot = mdHandle;
               window.safeMutableData.emulateAs(self.mdRoot, 'NFS')
                 .then((nfsHandle) => {
                   self.nfsRoot = nfsHandle;
                   log('[SafeNetwork] _getMdHandle() mdRoot:  ' + self.mdRoot);
                   log('[SafeNetwork] _getMdHandle() nfsRoot: ' + self.nfsRoot);
                   resolve(mdHandle); // Return mdHandle only if we have the
                                      // nfsHandle
                 }, (err) => { // mrhTODO how to handle in UI?
                   log('[SafeNetwork] SafeNetwork failed to access container');
                   log(err);
                   window.safeMutableData.free(self.mdRoot);
                   self.mdRoot = null;
                   reject(null);
                 });
               });
            }
          },
          (err) => {
            log('[SafeNetwork] The app has been DENIED permissions for `_public` container');
            log('[SafeNetwork] ' + err);
          });
        }
      });

      return result;
    },

    // Release all handles from the SAFE API
    freeSafeAPI: function (){
      // Freeing the appHandle also frees all other handles
      if (this.appHandle) {
        window.safeApp.free(this.appHandle);
        this.appHandle = null;
        this.mdRoot = null;
        this.nfsRoot = null;
      }
    },


    configure: function (settings) {
      // We only update these when set to a string or to null:
      if (typeof settings.userAddress !== 'undefined') { this.userAddress = settings.userAddress; }
      if (typeof settings.appHandle !== 'undefined') { this.appHandle = settings.appHandle; }

      var writeSettingsToCache = function() {
        if (hasLocalStorage) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({
            userAddress:    this.userAddress,
            /*
             * appHandle: this.appHandle, authUri: this.authUri, permissions:
             * this.permissions,
             */
          }));
        }
      };

      var handleError = function() {
        this.connected = false;
        delete this.permissions;

        if (hasLocalStorage) {
          localStorage.removeItem(SETTINGS_KEY);
        }
        log('[SafeNetwork] SafeNetwork.configure() [DISCONNECTED]');
      };

      if (this.appHandle) {
        this.connected = true;
        this.permissions = settings.permissions;
        if (this.userAddress) {
          this._emit('connected');
          writeSettingsToCache.apply(this);
          log('[SafeNetwork] SafeNetwork.configure() [CONNECTED-1]');
        } else {
          // No account names on SAFE Network
          // 'account secret' is closest, but best not to show
          this.info().then(function (info){
            this.userAddress = info.accountName;
            this.rs.widget.view.setUserAddress(this.userAddress);
            this._emit('connected');
            writeSettingsToCache.apply(this);
            log('[SafeNetwork] SafeNetwork.configure() [CONNECTED]-2');
          }.bind(this)).catch(function() {
            handleError.apply(this);
            this._emit('error', new Error('Could not fetch account info.'));
          }.bind(this));
        }
      } else {
        handleError.apply(this);
      }
    },

    connect: function () {
      log('[SafeNetwork] SafeNetwork.connect()...');

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

        if (rs.widget)
          rs.widget.initRemoteListeners();

        this.on('connected', function (){
          // fireReady();
          rs._emit('connected');
        });
        this.on('not-connected', function (){
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
        this._emit('not-connected');
      }
    },

    reflectNetworkStatus: function (isOnline){
      if (this.online != isOnline) {
        this.online = isOnline;
        log('[SafeNetwork] reflectNetworkStatus() emitting: ' + (isOnline ? 'network-online' : 'network-offline'));
        this.rs._emit(isOnline ? 'network-online' : 'network-offline');
      }
    },

    safenetworkAuthorize: function (appApiKeys) {
      log('[SafeNetwork] safenetworkAuthorize()...');

      var self = this;
      self.appKeys = appApiKeys.app;

      // mrhTODO untested:
      // tokenKey = SETTINGS_KEY + ':appToken';

    window.safeApp.initialise(self.appKeys, (newState) => {
      log('[SafeNetwork] SafeNetwork state changed to: ', newState); }).then((appHandle) => {
        log('[SafeNetwork] SAFEApp instance initialised and appHandle returned: ', appHandle);

        window.safeApp.authorise(appHandle, self.appKeys.permissions, self.appKeys.options)
        .then((authUri) => {
          log('[SafeNetwork] SAFEApp was authorised and authUri received: ', authUri);
          window.safeApp.connectAuthorised(appHandle, authUri)
          .then(_ => {
            log('[SafeNetwork] SAFEApp was authorised & a session was created with the SafeNetwork');

            self._getMdHandle(appHandle)
            .then((mdHandle) => {
              if (mdHandle){
                self.configure({
                  appHandle: appHandle,   // safeApp.initialise() return (appHandle)
                  authURI: authUri,       // safeApp.authorise() return (authUri)
                  permissions: self.appKeys.permissions, // Permissions used to request authorisation
                  options: self.appKeys.options, // Options used to request authorisation
                });
                log('[SafeNetwork] SAFEApp authorised and configured');
              }
            }, function (err){
              self.reflectNetworkStatus(false); log('[SafeNetwork] SAFEApp SafeNetwork getMdHandle() failed: ' + err);
            });
          }, function (err){
            self.reflectNetworkStatus(false); log('[SafeNetwork] SAFEApp SafeNetwork Connect Failed: ' + err);
          });
        }, function (err){
          self.reflectNetworkStatus(false); log('[SafeNetwork] SAFEApp SafeNetwork Authorisation Failed: ' + err);
        });
      }, function (err){
        self.reflectNetworkStatus(false); log('[SafeNetwork] SAFEApp SafeNetwork Initialise Failed: ' + err);
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
    get: function (path, options) {
      result = this._get(path, options);
      return this._wrapBusyDone.call(this, result, "get", path);
    },

    _get: function (path, options) {
      log('[SafeNetwork] SafeNetwork.get(' + path + ',...)' );
      var fullPath = ( PATH_PREFIX + '/' + path ).replace(/\/+/g, '/');

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

    put: function (path, body, contentType, options) {        return this._wrapBusyDone.call(this, this._put(path, body, contentType, options), "put", path); },

    _put: function (path, body, contentType, options) {
      log('[SafeNetwork] SafeNetwork.put(' + path + ', ' + (options ? ( '{IfMatch: ' + options.IfMatch + ', IfNoneMatch: ' + options.IfNoneMatch + '})') : 'null)' ) );
      var fullPath = ( PATH_PREFIX + '/' + path ).replace(/\/+/g, '/');

      // putDone - handle PUT response codes, optionally decodes metadata from
      // JSON format response
      var self = this;
      function putDone(response) {
        log('[SafeNetwork] SafeNetwork.put putDone(statusCode: ' + response.statusCode + ') for path: ' + path );

        // mrhTODO response.statusCode checks for versions are untested
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return self._getFileInfo(fullPath).then( function (fileInfo){

            var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );
            return Promise.resolve({statusCode: 200, 'contentType': contentType, revision: etagWithoutQuotes});
          }, function (err){
            log('[SafeNetwork] REJECTING!!! ' + err.message)
            return Promise.reject(err);
          });
        } else if (response.statusCode === 412) {   // Precondition failed
          log('[SafeNetwork] putDone(...) conflict - resolving with statusCode 412');
          return Promise.resolve({statusCode: 412, revision: 'conflict'});
        } else {
          return Promise.reject(new Error("PUT failed with status " + response.statusCode + " (" + response.responseText + ")"));
        }
      }
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (fileInfo) {
          if (options && (options.ifNoneMatch === '*')) {
            return putDone({ statusCode: 412 });    // Precondition failed
                                                    // (because entity exists,
                                                    // version irrelevant)
          }
          return self._updateFile(fullPath, body, contentType, options).then(putDone);
        } else {
          return self._createFile(fullPath, body, contentType, options).then(putDone);
        }
      }, function (err){
        log('[SafeNetwork] REJECTING!!! ' + err.message)
        return Promise.reject(err);
      });
    },

    delete: function (path, options) {
      return this._wrapBusyDone.call(this, this._delete(path, options), "delete", path);
    },

    _delete: function (path, options) {
      log('[SafeNetwork] SafeNetwork.delete(' + path + ',...)' );
      var fullPath = ( PATH_PREFIX + '/' + path ).replace(/\/+/g, '/');

      log('[SafeNetwork] SafeNetwork.delete: ' + fullPath + ', ...)' );
      var self = this;

      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (!fileInfo) {
          // File doesn't exist. Ignore.
          // mrhTODO should this be an error?
          return Promise.resolve({statusCode: 200});
        }

        var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );
        if (ENABLE_ETAGS && options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
          return {statusCode: 412, revision: etagWithoutQuotes};
        }

        if ( fullPath.substr(-1) !== '/') {
            log('[SafeNetwork] safeNfs.delete() param self.nfsRoot: ' + self.nfsRoot);
            log('[SafeNetwork]                  param fullPath: ' + fullPath);
            log('[SafeNetwork]                  param version: ' + fileInfo.version);
            log('[SafeNetwork]                  param containerVersion: ' + fileInfo.containerVersion);
            return window.safeNfs.delete(self.nfsRoot, fullPath, fileInfo.version + 1).then(function (success){
              // mrhTODO must handle: if file doesn't exist also do
              // self._fileInfoCache.delete(fullPath);

              self.reflectNetworkStatus(true);   // mrhTODO - should be true,
                                                  // unless 401 - Unauthorized

              if (success) {
                self._fileInfoCache.delete(fullPath);
                return Promise.resolve({statusCode: 200});
              } else {
                // mrhTODO - may need to trigger update of cached container info
                return Promise.reject('safeNFS deleteFunction("' + fullPath + '") failed: ' + success );
              }
            }, function (err){
              // mrhTODO - may need to trigger update of cached container info
              log('[SafeNetwork] REJECTING!!! deleteFunction("' + fullPath + '") failed: ' + err.message)
              return Promise.reject(err);
            });
        }
      }, function (err){
        self.reflectNetworkStatus(false);
        log('[SafeNetwork] REJECTING!!! ' + err.message)
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
    info: function () {        return this._wrapBusyDone.call(this, this._info(), "get", ''); },

    _info: function () {
      // Not implemented on SAFE, so provdie a default
      return Promise.resolve({accountName: 'SafeNetwork'});
    },

    _updateFile: function (fullPath, body, contentType, options) {
      log('[SafeNetwork] SafeNetwork._updateFile(' + fullPath + ',...)' );
      var self = this;


      // mrhTODO GoogleDrive only I think:
      // if ((!contentType.match(/charset=/)) &&
      //     (encryptedData instanceof ArrayBuffer || WireClient.isArrayBufferView(encryptedData))) {
      //       contentType += '; charset=binary';
      // }

      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (!fileInfo) {          // File doesn't exist. Ignore.
          self._fileInfoCache.delete(fullPath);     // Invalidate any cached
                                                    // eTag
          return Promise.resolve({statusCode: 200});
        }

        var etagWithoutQuotes = ( typeof(fileInfo.ETag) === 'string' ? fileInfo.ETag : undefined );
        if (ENABLE_ETAGS && options && options.ifMatch && (options.ifMatch !== etagWithoutQuotes)) {
          return {statusCode: 412, revision: etagWithoutQuotes};
        }

        // Only act on files (directories are inferred so no need to delete)
        if ( fullPath.substr(-1) === '/') {
          self._fileInfoCache.delete(fullPath);     // Directory - invalidate
                                                    // any cached eTag
        }
        else {
          // Store content as new immutable data (pointed to by fileHandle)
          return window.safeNfs.create(self.nfsRoot, body).then((fileHandle) => {
            // mrhTODO set file metadata (contentType) - how?

            // Add file to directory (by inserting fileHandle into container)
            return window.safeNfs.update(self.nfsRoot, fileHandle, fullPath, fileInfo.containerVersion + 1).then((fileHandle) => {
              self._updateFileInfo(fileHandle, fullPath);

              // self._shareIfNeeded(fullPath); // mrhTODO what's this?

              var response = { statusCode: ( fileHandle ? 200 : 400  ) };
              // mrhTODO currently just a response that resolves to truthy (may be exteneded to return status?)
              self.reflectNetworkStatus(true);

              // mrhTODO Not sure if eTags can still be simulated:
              // mrhTODO would it be better to not delete, but set fileHandle
              // in the fileInfo?
              self._fileInfoCache.delete(fullPath);     // Invalidate any cached
                                                        // eTag

              return Promise.resolve(response);
            }, function (err){
              self.reflectNetworkStatus(false);         // mrhTODO - should go offline for Unauth or Timeout
              log('[SafeNetwork] REJECTING!!! safeNfs.update("' + fullPath + '") failed: ' + err.message)
              return Promise.reject(err);
            });
          }, function (err){
            self.reflectNetworkStatus(false);           // mrhTODO - should go offline for Unauth or Timeout
            log('[SafeNetwork] REJECTING!!! safeNfs.create("' + fullPath + '") failed: ' + err.message)
            return Promise.reject(err);
          });
        }
      }, function (err){
        self.reflectNetworkStatus(false);
        log('[SafeNetwork] REJECTING!!! ' + err.message)
        return Promise.reject(err);
      });
    },

    _createFile: function (fullPath, body, contentType, options) {
      log('[SafeNetwork] SafeNetwork._createFile(' + fullPath + ',...)' );
      var self = this;
      var result = new Promise((resolve,reject) => {
        // Store content as new immutable data (pointed to by fileHandle)
        return window.safeNfs.create(self.nfsRoot, body).then(function (fileHandle) {
          // mrhTODOx set file metadata (contentType) - how?

          // Add file to directory (by inserting fileHandle into container)
          return window.safeNfs.insert(self.nfsRoot, fileHandle, fullPath).then(function (fileHandle) {
            // self._shareIfNeeded(fullPath); // mrhTODO what's this?

            var response = { statusCode: ( fileHandle ? 200 : 400  ) }; // mrhTODO currently just a response that resolves to truthy (may be exteneded to return status?)
            self.reflectNetworkStatus(true);

            // mrhTODO Not sure if eTags can still be simulated:
            // mrhTODO would it be better to not delte, but set the fileHandle
            // in the fileInfo?
            // self._fileInfoCache.delete(fullPath);     // Invalidate any cached eTag
            self._updateFileInfo(fileHandle, fullPath);

            return resolve(response);
          }, function (err){
            self.reflectNetworkStatus(false);   // mrhTODO - should go offline for Unauth or Timeout
            log('[SafeNetwork] REJECTING!!! safeNfs.insert("' + fullPath + '") failed: ' + err.message)
            return reject(err);
          });
        }, function (err){
          self.reflectNetworkStatus(false);     // mrhTODO - should go offline for Unauth or Timeout
          log('[SafeNetwork] REJECTING!!! safeNfs.create("' + fullPath + '") failed: ' + err.message)
          return reject(err);
        });
      });

      return result;
    },

    // For reference see WireClient#get (wireclient.js)
    _getFile: function (fullPath, options) {
      log('[SafeNetwork] SafeNetwork._getFile(' + fullPath + ', ...)' );
      if (! this.connected) { return Promise.reject("not connected (fullPath: " + fullPath + ")"); }
      var self = this;

      // Check if file exists by obtaining directory listing if not already cached
      return self._getFileInfo(fullPath).then(function (fileInfo) {
        if (!fileInfo){
          return Promise.resolve({statusCode: 404});   // File does not exist (mrhTODO should this reject?)
        }

        // TODO If the options are being used to retrieve specific version
        // should we get the latest version from the API first?
        var etagWithoutQuotes = fileInfo.ETag;

        // Request is for changed file, so if eTag matches return "304 Not Modified"
        if (ENABLE_ETAGS && options && options.ifNoneMatch && etagWithoutQuotes && (etagWithoutQuotes === options.ifNoneMatch)) {
          return Promise.resolve({statusCode: 304});
        }

        return window.safeNfs.fetch(self.nfsRoot, fullPath)
          .then((fileHandle) => {
            log('[SafeNetwork] fetched fileHandle: ' + fileHandle.toString());
            self.fileHandle = fileHandle; // mrhTODOx need setter to compare & free if new fileHandle
            return window.safeNfs.open(self.nfsRoot,fileHandle,4/* read */)
            .then((fileHandle) => {
              log('[SafeNetwork] safeNfs.open() returns fileHandle: ' + fileHandle.toString());
              self.openFileHandle = fileHandle;
              return window.safeNfsFile.size(self.openFileHandle)
            .then((size) => {
              log('[SafeNetwork] safeNfsFile.size() returns size: ' + size.toString());
              return window.safeNfsFile.read(self.openFileHandle,0,size)
            .then((content) => {
              log('[SafeNetwork] ' + content.byteLength + ' bytes read from file.');

              decoder = new TextDecoder();
              data = decoder.decode(content);
              log('[SafeNetwork] data: "' + data + '"');

              // TODO SAFE API file-metadata - disabled for now:
              // var fileMetadata = response.getResponseHeader('file-metadata');
              // if (fileMetadata && fileMetadata.length() > 0){
              //   fileMetadata = JSON.parse(fileMetadata);
              //   log('[SafeNetwork] ..file-metadata: ' + fileMetadata);
              // }

              // Refer to baseclient.js#getFile for retResponse spec (note getFile header comment wrong!)
              var retResponse = {
                statusCode: 200,
                body: data,
                // TODO look into this:
                /*body: JSON.stringify(data),*/ // TODO Not sure stringify() needed, but without it local copies of nodes differ when loaded from SAFE
                                                // TODO RS ISSUE:  is it a bug that RS#get accepts a string *or an object* for body? Should it only accept a string?
                revision: etagWithoutQuotes,
              };

              retResponse.contentType = 'application/json; charset=UTF-8';   // mrhTODO googledrive.js#put always sets this type, so farily safe default until SAFE NFS supports save/get of content type

              if (fileInfo && fileInfo['Content-Type'] ){
                retResponse.contentType = fileInfo['Content-Type'];
              }

              self.reflectNetworkStatus(true);
              return Promise.resolve( retResponse );
            }, function (err){
              self.reflectNetworkStatus(false); // mrhTODO - should go offline for Unauth or Timeout
              log('[SafeNetwork] REJECTING!!! safeNfs get file: "' + fullPath + '" failed: ' + err.message)
              return Promise.reject({statusCode: 404}); // mrhTODO can we get statusCode from err?
          });
        }, function (err){
          log('[SafeNetwork] REJECTING!!! ' + err.message);// mrhTODO - MAYBE go offline (see above)
          return Promise.reject(err);
        });
      }, function (err){
        log('[SafeNetwork] REJECTING!!! ' + err.message);  // mrhTODO - MAYBE go offline (see above)
        return Promise.reject(err);
      });
    }, function (err){
      log('[SafeNetwork] REJECTING!!! ' + err.message);    // mrhTODO - MAYBE go offline (see above)
      return Promise.reject(err);
    });
      }, function (err){
        log('[SafeNetwork] REJECTING!!! ' + err.message);  // mrhTODO - MAYBE go offline (see above)
        return Promise.reject(err);
      });
    },


    /* _makeFileInfo - use fileHandle to insert metadata into given fileInfo

    returns a Promise which resolves to a fileInfo object
    */
    _makeFileInfo: function (fileHandle, fileInfo, fullPath){
      return new Promise((resolve,reject) => {

        return window.safeNfsFile.metadata(fileHandle)
        .then((fileMetadata) => {
            fileInfo.created = fileMetadata.created;
            fileInfo.modified = fileMetadata.modified;
            fileInfo.version = fileMetadata.version;
            fileInfo.dataMapName = fileMetadata.dataMapName; // mrhTODO Debug only!

            // Overwrite ETag using the file version (rather than the enry version)
            fileInfo.ETag = fullPath + '-v' + fileMetadata.version;
            resolve(fileInfo);
          }, function (err){
            log('[SafeNetwork] _makeFileInfo(' + fullPath + ') > safeNfsFile.metadata() FAILED: ' + err)
            reject(err);
          });
        });
    },

    /* _updateFileInfo - use fileHandle to update cached fileInfo with metadata

    returns a Promise which resolves to an updated fileInfo
    */
    _updateFileInfo: function(fileHandle, fullPath){
      return new Promise((resolve, reject) => {
        return this._getFileInfo(fullPath)
        .then((fileInfo) => {
          if (fileInfo)//mrhTODOcurrent - break in here and see if it seems ok when I save a note
            resolve(fileInfo) ;
          else
            reject('_updateFileInfo( ' + fullPath + ') - unable to update - no existing fileInfo');
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
      log('[SafeNetwork] SafeNetwork._getFolder(' + fullPath + ', ...)' );
      var self = this;
      var listing = {};

      return new Promise((resolve,reject) => {
        // Create listing by enumerating container keys beginning with fullPath
        const directoryEntries = [];
        return window.safeMutableData.getEntries(self.mdRoot)
        .then((entriesHandle) => window.safeMutableDataEntries.forEach(entriesHandle, (k, v) => {
          // Skip deleted entries
          if (v.buf.length == 0){
            // mrhTODOsoon try without this...
            return true;  // Next
          }
          log('[SafeNetwork] Key: ', k.toString());
          log('[SafeNetwork] Value: ', v.buf.toString('base64') );
          log('[SafeNetwork] entryVersion: ', v.version);

          var dirPath = fullPath;
          if (dirPath.slice(-1) != '/')
            dirPath += '/'; // Ensure a trailing slash

          key = k.toString();
          // If the folder matches the start of the key, the key is within the folder
          if (key.length > dirPath.length && key.substr(0,dirPath.length) == dirPath) {
            var remainder = key.slice(dirPath.length);
            var itemName = remainder // File name will be up to but excluding first '/'
            var firstSlash = remainder.indexOf('/');
            if (firstSlash != -1) {
              itemName = remainder.slice(0,firstSlash+1); // Directory name with trailing '/'
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
            directoryEntries.push(fileInfo);
          }
        }))
        .then(() => Promise.all(directoryEntries.map((fileInfo) => {
          log('[SafeNetwork] directoryEntries.map() with ' + JSON.stringify(fileInfo))

          if (fileInfo.fullPath.slice(-1) == '/'){
            // Directory entry:
            log('[SafeNetwork] Listing: ', fileInfo.name);
            listing[fileInfo.name] = fileInfo;
          }
          else {  // File entry:
              try {
              log('[SafeNetwork] DEBUG: window.safeNfs.fetch(' + fileInfo.fullPath + ')...');
              return window.safeNfs.fetch(self.nfsRoot, fileInfo.fullPath)
              .then((fileHandle) => self._makeFileInfo(fileHandle, fileInfo, fileInfo.fullPath)
              .then((fileInfo) => {

                log('[SafeNetwork] file created: ' + fileInfo.created);
                log('[SafeNetwork] file modified: ' + fileInfo.modified);
                log('[SafeNetwork] file version: ' + fileInfo.version);
                log('[SafeNetwork] file dataMapName: ' + fileInfo.dataMapName.toString('base64'));

                // File entry:
                self._fileInfoCache.set(fileInfo.fullPath, fileInfo);
                log('[SafeNetwork] ..._fileInfoCache.set(file: ' + fileInfo.fullPath  + ')' );
                log('[SafeNetwork] Listing: ', fileInfo.name);
                listing[fileInfo.name] = fileInfo;
              }));
            } catch (err){
                log('[SafeNetwork] _getFolder( ' + fileInfo.fullPath + ' ) Skipping invalid entry. Error: ' + err);
            }
          }
        })).then(_ => {
          log('[SafeNetwork] Iteration finished');
          log('[SafeNetwork] SafeNetwork._getFolder(' + fullPath + ', ...) RESULT: listing contains ' + JSON.stringify( listing ) );
          var folderMetadata = { contentType: RS_DIR_MIME_TYPE};        // mrhTODOx - check what is expected and whether we can provide something
          return resolve({statusCode: 200, body: listing, meta: folderMetadata, contentType: RS_DIR_MIME_TYPE /*, mrhTODOx revision: folderETagWithoutQuotes*/ });
        })).catch((err) => {
          log('[SafeNetwork] directoryEntries.map() invalid folder entry - ERROR: ' + err );
        });
      }).catch((err) => {
        self.reflectNetworkStatus(false);                // mrhTODO - should go offline for Unauth or Timeout
        log('[SafeNetwork] safeNfs.getEntries("' + fullPath + '") failed: ' + err.status );
        // var status = (err == 'Unauthorized' ? 401 : 404); // mrhTODO
        // ideally safe-js would provide response code (possible enhancement)
        if (err.status === undefined)
            err.status = 401; // Force Unauthorised, to handle issue in safe-js:

        if (err.status == 401){
          // Modelled on how googledrive.js handles expired token
          if (self.connected){
            self.connect();
            return resolve({statusCode: 401}); // mrhTODO should this reject
          }
        }
        return reject({statusCode: err.status});
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
      log('[SafeNetwork] SafeNetwork._getFileInfo(' + fullPath + ')' );

      var self = this;
      let result = new Promise((resolve,reject) => {

        if (fullPath === '/' ) {
          // Dummy fileInfo to stop at "root"
          return resolve({ path: fullPath, ETag: 'root' });
        }

        if (info = self._fileInfoCache.get(fullPath)){
          return resolve(info);
        }

        // Not yet cached or doesn't exist
        // Load parent folder listing update _fileInfoCache.
        return window.safeMutableData.getVersion(self.mdRoot).then((rootVersion) => {

/* TODO there seems no point calling _getFileInfo on a folder so could just
let that trigger an error in this function, then fix the call to handle differently
*/
          if (fullPath.substr(-1) === '/') {    // folder, so fake its info
            // Add file info to cache
            var fileInfo = {
              fullPath:   fullPath, // Used by _fileInfoCache() but nothing else
            };

            self._fileInfoCache.set(fullPath, fileInfo);
            return resolve(fileInfo);
          }

          return self._getFolder(parentPath(fullPath)).then(_ => {
            if (info = self._fileInfoCache.get(fullPath)){
              return resolve(info);
            }
            else {                                // file, doesn't exist
              log('[SafeNetwork] _getFileInfo(' + fullPath + ') file does not exist, no fileInfo available ')
              return resolve(null);
            }
          }, (err) => {
            log('[SafeNetwork] _getFileInfo(' + fullPath + ') failed to get parent directory of file ')
            return resolve(null);
          });

        }, function (err){
          log('[SafeNetwork] _getFileInfo(' + fullPath + ') > safeMutableData.getVersion() FAILED: ' + err)
          return reject(err);
        });
      });

      return result;
    }
  };

  // TODO review wrt RS 1.0 implementations
  // Differences with RS 0.14 are:
  // 1) config.clientId not present - removed this from this file
  // 2) dropbox uses hookIt() (and in _rs_cleanup() unHookIt()) instead of inline
  // assignements which causes dropbox version to also call hookSync() and hookGetItemURL()
  //
  // mrhTODO re-above, also need to check if app calling setApiKeys for multiple
  // backends breaks this
  // mrhTODO and may cause problems with starting sync?
  // mrhTODO Maybe the hookIt stuff in Dropbox allows chaining, but not yet in
  // GD or SN?
  //

  SafeNetwork._rs_init = function (remoteStorage) {
    hasLocalStorage = util.localStorageAvailable();

    var config = remoteStorage.apiKeys.safenetwork;
    if (config) {
      remoteStorage.safenetwork = new SafeNetwork(remoteStorage, config);
      if (remoteStorage.backend === 'safenetwork' && remoteStorage.remote !== remoteStorage.safenetwork) {
        remoteStorage._safenetworkOrigRemote = remoteStorage.remote;
        remoteStorage.remote = remoteStorage.safenetwork;
      }
    }
  };

  SafeNetwork._rs_supported = function (rs) {
    return true;
  };

// mrhTODO see dropbox version
  SafeNetwork._rs_cleanup = function (remoteStorage) {
    if (remoteStorage.safenetwork)
      remoteStorage.safenetwork.freeSafeAPI();

    remoteStorage.setBackend(undefined);
    if (remoteStorage._safenetworkOrigRemote) {
      remoteStorage.remote = remoteStorage._safenetworkOrigRemote;
      delete remoteStorage._safenetworkOrigRemote;
    }
  };

module.exports = SafeNetwork;
