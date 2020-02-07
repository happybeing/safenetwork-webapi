[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](https://github.com/standard/standard)

# What's This?

DEPRECATED: this library was developed as part of a proof of concept and is superceded by [safenetworkjs](https://github.com/theWebalyst/safenetworkjs).

A SAFE Network web API with RESTful services (via fetch() in the browser):

- Adds support for the `safe:` URI schema to fetch() (and rdflib.js Fetcher using this [rdflib.js fork](https://github.com/theWebalyst/rdflib.js/tree/feature/safenetwork)).

- Includes [LDP](https://www.w3.org/TR/ldp/) service which works with Solid apps via window.fetch() or
rdflib.js (for an example see this [solid-plume fork](https://github.com/theWebalyst/solid-plume/tree/safenetwork-poc)).

This is a WORK IN PROGRESS but usable if you read the docs in the comments. Some basic usage is included below, but you should refer to the comments in the source, and the solid-plume example above until documentation is available.

## Usage example:

```
// Include from JS:
var Safenetwork = new require('safenetwork-webapi')

// Include from HTML:
<script src="js/safenetwork-webapi.js"></script>

// Then in App Javascript:
var Safenetwork = new SafenetworkWebApi
const fetch = SafenetworkWebApi.protoFetch  // fetch() that supports 'safe:' protocol
fetch.protocols.safe = Safenetwork.fetch.bind(Safenetwork)

window.addEventListener("beforeunload", function (event) {
  Safenetwork.setSafeApi(null)  // Ensures network connections are freed
});
```

### Usage with rdflib.js:

```
var Safenetwork = new SafenetworkWebApi
var $rdf = require('rdflib')
$rdf.appFetch = Safenetwork.fetch.bind(Safenetwork) // Hook for rdflib Fetcher

window.addEventListener("beforeunload", function (event) {
  Safenetwork.setSafeApi(null)  // Ensures network connections are freed
});
```

### Usage in your app

The above enable support for 'safe:' URIs whenever you use window.fetch(),
and if you also assign $rdf.Safenetwork within rdflib.js Fetcher class.

If your app uses other means for LDP requests, such as XmlHttpRequest,
these will not understand 'safe:' URIs until you convert them to
use fetch() or Fetcher.

If authentication is required to access LDP resources on the SAFE Network,
you must also authorise your app or your LDP requests will fail
(e.g. 401 Access Denied).

You may either authenticate using the SAFE DOM API yourself, and pass
the appHandle to the SafenetworkWebApi object, or you can use the
authorisation methods on that class.

Note that the SafenetworkWebApi class is a high level manager which
provides access to the SAFE DOM API, and to a service based interface.
It is the service interface which implements LDP, and you can
must explicitly use this to install an LDP service on a SAFE public
before the service will operate.

Once the service has been set-up on a public name, the SafenetworkWebApi
will automatically activate it.


NOTES:
(Possibly out of date so refer to comments in the code, or documentation when available)

* function SafenetworkWebApi.fetch() is a drop in replacement for fetch(), and is called by proto-fetch for safe: URIs
	* for a safe: URI, it looks for as suitable service on the public ID
	* if the service is present, but not yet active, it activates it by creating a suitable service instance (e.g. of SafeServiceLDP)
	* if the service is active, it calls handler of the service instance (or if not defaults to safeApp.webFetch())
	* Example: handles URIs for an LDP service on SAFE Network, such as  safe://solid.happybeing/profile/card#me
		* ???check: will automatically try to authorise with SAFE Network on a 404 error
		* attempts to provide and LDP compatible storage on SAFE Network

* class SafeServiceLDP
	* holds application state for the SAFE API
	* is configurable, but should be usable with defaults
	* configuration allows handling of SAFE URI behaviour to be modified:
		* enabled:		false disables support for safe: URI
		* debug:			true enables console debug messages
		* authOnStart:	true attempt authorisation on SAFE Network immediately

# Contributions
Pull requests are welcome for outstanding issues and feature requests. Please note that contributions must be subject to the Project License (see below), and that if an incompatible license is present in your contribution it will be rejected.

**IMPORTANT:** By submitting a pull request, you will be offering code under either the Project License or a license that is compatible with and does not restrict the Project License of any existing files in the Project, or of any code in the Project that is substantially similar to your contribution. If your submission is not compatible with the Project License, the license specified below (under 'License') will apply to your submission by default.

Before submitting your code please consider using `Standard.js` formatting. You may also find it helps to use an editor with support for Standard.js when developing and testing. An easy way is just to use [Atom IDE](https://atom.io/packages/atom-ide-ui) with the package [ide-standardjs] (and optionally [standard-formatter](https://atom.io/packages/standard-formatter)). Or you can install NodeJS [Standard.js](https://standardjs.com/).

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/standard/standard)

# Project License
This project is made available under the [GPL-3.0 LICENSE](https://opensource.org/licenses/GPL-3.0) except for individual files which contain their own license so long as that file license is compatible with GPL-3.0. 

The responsibility for checking this licensing is valid and that your use of this code complies lies with any person and organisation making any use of it.