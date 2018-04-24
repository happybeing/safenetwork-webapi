# safenetwork-webapi

SAFE Network web API with RESTful services (via fetch() in the browser).

Adds support for the `safe:` URI schema to fetch() (and rdflib.js Fetcher using this [rdflib.js fork](https://github.com/theWebalyst/rdflib.js/tree/feature/safenetwork)).

Includes [LDP](https://www.w3.org/TR/ldp/) service which works with Solid apps via window.fetch() or
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

```

### Usage with rdflib.js:

```
var Safenetwork = new SafenetworkWebApi
var $rdf = require('rdflib')
$rdf.appFetch = Safenetwork.fetch.bind(Safenetwork) // Hook for rdflib Fetcher
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
