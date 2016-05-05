/**
 * HdsProtocol.js, 2013
 * @author ICh
 */

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

const Ci = Components.interfaces;
const Cc = Components.classes;
const Cr = Components.results;

const ID_SIMPLEURI_CONTRACT = "@mozilla.org/network/simple-uri;1";
const ID_IOSERVICE_CONTRACT = "@mozilla.org/network/io-service;1";

/**
 * @class StreamListenerProxy
 * @implements nsIStreamListener
 */
function StreamListenerProxy()
{
    var ctx = this;

    /**
     * Total number of transmitted bytes
     *
     * @field
     * @type Number
     * @name offset
     */
    this.offset = 0;

    /**
     * @field
     * @type nsIRequest
     * @name ownerRequest
     */
    this.ownerRequest = null;

    /**
     * @field
     * @type nsIStreamListener
     * @name ownerListener
     */
    this.ownerListener = null;

    /**
     * @field
     * @type nsISupports
     * @name ownerContext
     */
    this.ownerContext = null;

    /**
     * Holds a reference to a delegate of type f() -> undefined.
     *
     * @field
     * @type Function
     * @name ownerOnStartRequest
     */
    this.ownerOnStartRequest = null;

    /**
     * Holds a reference to a delegate of type
     * f(bytesRead:Number, status:nstatus) -> undefined.
     *
     * @field
     * @type Function
     * @name ownerOnStopRequest
     */
    this.ownerOnStopRequest = null;

    /**
     * Must not throw
     *
     * @field
     * @type Function
     * @name ownerOnOffsetChanged
     */
    this.ownerOnOffsetChanged = null;

    /**
     * nsIStreamListener implementation
     */
    this.onStartRequest = function(aRequest, aContext)
    {
        ctx.ownerOnStartRequest();
    };

    this.onStopRequest = function(aRequest, aContext, aStatus)
    {
        ctx.ownerOnStopRequest(ctx.offset, aStatus);
    };

    /**
     * @member onDataAvailable
     * @see nsIStreamListener#onDataAvailable
     */
    this.onDataAvailable = function(aRequest, aContext, aStream, aSourceOffset, aLength)
    {
        ctx.ownerListener.onDataAvailable(
            ctx.ownerRequest
            , ctx.ownerContext
            , aStream
            , ctx.offset
            , aLength);
        ctx.offset += aLength;
        ctx.ownerOnOffsetChanged(ctx.offset);
    };

    this.QueryInterface = XPCOMUtils.generateQI([Ci.nsIStreamListener,  Ci.nsIRequestObserver]);
};

/**
 * @class HdsChannel
 * @implements nsIChannel
 * @param {nsIURI} uri
 * @param {HdsStream} stream
 */
function HdsChannel(uri, stream)
{
    var ctx = this;

    /**
     * nsIRequest implementation
     */

    /**
     * @type nsLoadFlags
     */
    this.loadFlags = 0;

    /**
     * @private
     * @type nsILoadGroup
     * @name loadGroup
     */
    var loadGroup = null;

    Object.defineProperty(
        this,
        "loadGroup",
        {
            get: function() { return loadGroup; },
            set: function(value) { loadGroup = value; }
        });

    /**
     * @type AUTF8String
     */
    this.name = uri.spec;

    /**
     * @type nsresult
     */
    this.status = Cr.NS_OK;

    /**
     * @member cancel
     * @see nsIRequest#cancel
     */
    this.cancel = function(aStatus)
    {
        if (isCanceled)
        {
            return;
        }
        isCanceled = true;
        ctx.status = aStatus;
        if (activeChannel)
        {
            activeChannel.cancel();
        }
    };

    /**
     * @member isPending
     * @see nsIRequest#isPending
     */
    this.isPending = function()
    {
        return pending && !isCanceled;
    };

    /**
     * @member suspend
     * @see nsIRequest#suspend
     */
    this.suspend = function()
    {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    };

    /**
     * @member resume
     * @see nsIRequest#resume
     */
    this.resume = function()
    {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    };

    /**
     * nsIChannel implemenation
     */

    /**
     * @type Number
     */
    this.contentLength = stream.getContentLength();

    /**
     * @type String
     */
    this.contentType = "application/octet-stream";

    /**
     * @type String
     */
    this.contentCharset = "utf-8";

    /**
     * @type nsIURI
     */
    this.URI = uri;

    /**
     * @type nsIURI
     */
    this.originalURI = uri;

    /**
     * @type nsISupports
     */
    this.owner = null;

    /**
     * @private
     * @field
     * @type nsIInterfaceRequestor
     * @name notificationCallbacks
     */
    var notificationCallbacks = null;

    Object.defineProperty(
        this,
        "notificationCallbacks",
        {
            get: function() { return notificationCallbacks; },
            set: function(value)
            {
                notificationCallbacks = value;
                // Reset cached event sinks as they have probable became invalid
                precacheProgressEventSink();
            }
        });

    /**
     * @type nsISupports
     */
    this.securityInfo = null;

    /**
     * @member asyncOpen
     * @see nsIChannel#asyncOpen
     * @param {nsIStreamListener} aListener
     * @param {nsISupports} aContext
     */
    this.asyncOpen = function(aListener, aContext)
    {
        if (aListener == null)
        {
            throw Cr.NS_ERROR_INVALID_POINTER;
        }
        if (clientStreamListener == aListener)
        {
            throw Cr.NS_ERROR_ALREADY_OPENED;
        }

        clientStreamListener = aListener;
        clientContext = aContext;

        downloadRestStreamAsync(0, 0);
    };

    /**
     * @member open
     * @see nsIChannel#open
     */
    this.open = function()
    {
        throw Cr.NS_ERROR_NOT_IMPLEMENTED;
    };

    /**
     * @private
     * @member downloadRestStreamAsync
     * @param {Number} chunk
     * @param {Number} offset
     */
    var downloadRestStreamAsync = function(chunk, offset)
    {
        /**
         * TODO: ensure that we have at least one chunk in the stream
         */

        /** @type DmHdsStreamFragment */
        let fragment = stream.getFragment(chunk);
        
        /** @type Number */
        let startTime = 0;

        var start = function()
        {
            onBeginChunk(chunk);
            startTime = Date.now();
        };

        var stop = function(bytesRead, status)
        {
            fragment.time = Date.now() - startTime;
            fragment.size = bytesRead;
            onEndChunk(chunk, bytesRead, status);
        };

        var slp = new StreamListenerProxy();
        
        slp.ownerRequest = ctx;
        slp.ownerListener = clientStreamListener;
        slp.ownerContext = clientContext;
        slp.offset = offset;
        slp.ownerOnStartRequest = start;
        slp.ownerOnStopRequest = stop;
        slp.ownerOnOffsetChanged = onProgress;

        var channel = fragment.createChannel();
        
        channel.notificationCallbacks = null;
        channel.asyncOpen(slp, null);
        
        activeChannel = channel;
    };

    /**
     * Channel event handlers
     */

    /**
     * @private
     * @member onBeginChunk
     * @param {Number} chunk Chunk index
     */
    var onBeginChunk = function(chunk)
    {
        if ((chunk == 0) && clientStreamListener)
        {
            clientStreamListener.onStartRequest(ctx, clientContext);
            pending = true;
        }

        if (isSuspended)
        {
            activeChannel.suspend();
        }
    };

    /**
     * @private
     * @member onEndChunk
     * @param {Number} chunk
     * @param {Number} bytesRead
     * @param {nstatus} status
     */
    var onEndChunk = function(chunk, bytesRead, status)
    {
        ctx.status = status;
        activeChannel = null;

        var nextChunkId = chunk + 1;

        if (!Components.isSuccessCode(status) || (true == isCanceled) || (nextChunkId == stream.getFragmentCount()))
        {
            pending = false;

            if (null == clientStreamListener)
            {
                return;
            }
            
            clientStreamListener.onStopRequest(ctx, clientContext, status);
        }
        else
        {
            downloadRestStreamAsync(nextChunkId, bytesRead);
        }
    };

    /**
     * Status notifications
     */

    /**
     * @private
     * @name onProgress
     * @param {Number} offset Amount of data read
     */
    var onProgress = function(offset)
    {
        try {
            notifyTransportProgress(offset, ctx.contentLength);
        } catch (e) {}
    };

    /**
     * @private
     * @member notifyTransportStatus
     * @param {Number} progress
     * @param {Number} total
     * @returns {undefined} nothing
     */
    var notifyTransportProgress = function(progress, total)
    {
        try
        {
            if (!cachedProgressEventSink)
                return;
            cachedProgressEventSink.onProgress(ctx, clientContext, progress, total);
        }
        catch (e)
        {
            precacheProgressEventSink();
            cachedProgressEventSink.onProgress(ctx, clientContext, progress, total);
        }
    };

    /**
     * Queries an instance of the nsIProgressEventSink interface
     * either from notificationCallbacks, either from associated loadGroup.
     * Acquired value is then saved in cachedProgressEventSink
     *
     * @private
     * @member precacheProgressEventSink
     * @returns {undefined} nothing
     */
    var precacheProgressEventSink = function()
    {
        cachedProgressEventSink = null;
        var clbck = getCallback();
        
        if (!clbck)
        {
            return;
        }
        
        cachedProgressEventSink = clbck.getInterface(Ci.nsIProgressEventSink);
    };

    /**
     * @private
     * @member getCallback
     * @returns {nsIInterfaceRequestor}
     */
    var getCallback = function()
    {
        var cb = notificationCallbacks;
        
        if (!cb)
        {
            return null;
        }
        
        return cb.QueryInterface(Ci.nsIInterfaceRequestor);
    };

    /**
     * Channel state
     */

    /**
     * Holds a reference to a user supplied instance of nsIStreamListener.
     * It is initialized upon call to asyncOpen, and release as soon as the request
     * has been completed
     *
     * @private
     * @field
     * @type nsIStreamListener
     * @name clientStreamListener
     */
    var clientStreamListener = null;

    /**
     * Holds a reference to a user supplied opaque pointer
     *
     * @private
     * @field
     * @type nsISupports
     * @name clientContext
     */
    var clientContext = null;

    /**
     * @private
     * @type nsIChannel
     * @name activeChannel
     */
    var activeChannel = null;

    /**
     * @private
     * @type Boolean
     * @name pending
     */
    var pending = false;

    /**
     * @private
     * @type Boolean
     * @name isCanceled
     */
    var isCanceled = false;

    /**
     * @private
     * @type Boolean
     * @name isSuspended
     */
    var isSuspended = false;

    /**
     * Cached reference to an implementation of nsIProgressEventSink
     *
     * @private
     * @field
     * @type nsIProgressEventSink
     * @name cachedProgressEventSink
     */
    var cachedProgressEventSink = null;

    /**
     * Aux
     */

    /**
     * @member QueryInterface
     */
    this.QueryInterface = XPCOMUtils.generateQI([Ci.nsIChannel, Ci.nsIRequest]);
};

/**
 * @class HdsProtocol
 */
function HdsProtocol()
{
    var ctx = this;
    var streams = {};

    /**
     * @member createUri
     * @param {nsIURI} resourceUri
     * @returns {nsIURI} Protocol uri
     */
    this.createUri = function(resourceUri)
    {
        return ctx.newURI(ctx.scheme + ":" + resourceUri.spec, null, null);
    };

    /**
     * @member addStream
     * @param {nsIURI} uri Uri to be registered
     * @param {IHdsStream} stream Stream associated with the uri
     */
    this.addStream = function(uri, stream)
    {
        streams[uri.spec] = stream;
    };

    /**
     * @member removeStream
     * @param {nsIURI} uri
     */
    this.removeStream = function(uri)
    {
        delete streams[uri.spec];
    };

    /**
     * @private
     * @member getStream
     * @param {nsIUri} uri
     * @returns {IHdsStream}
     */
    var getStream = function(uri)
    {
        var stream = streams[uri.spec];
        return stream;
    };

    /**
     * Make this object accessible to js clients
     */
    this.wrappedJSObject = this;

    /**
     * @field
     * @name scheme
     * @type String
     */
    this.scheme = "x-hds";

    /**
     * @field
     * @name defaultPort
     * @type Number
     */
    this.defaultPort = -1;

    /**
     * @field
     * @name protocolFlags
     * @type Number
     */
    this.protocolFlags = Ci.nsIProtocolHandler.URI_NORELATIVE           |
                         Ci.nsIProtocolHandler.URI_NOAUTH               |
                         Ci.nsIProtocolHandler.URI_LOADABLE_BY_ANYONE;

    /**
     * @member netURI
     * @param {AUTF8String} aSpec
     * @param {String} aOriginalCharset
     * @param {nsIURI} aBaseURI
     * @returns {nsIURI}
     */
    this.newURI = function(aSpec, aOriginalCharset, aBaseURI)
    {
        var uri = Cc[ID_SIMPLEURI_CONTRACT].createInstance(Ci.nsIURI);

        uri.spec = aSpec;

        return uri;
    };

    /**
     * @member newChannel
     * @param {nsIURI} aURI
     * @returns {nsIChannel}
     */
    this.newChannel = function(aURI)
    {
        var stream = getStream(aURI);

        if (!stream)
        {
            throw Cr.NS_ERROR_NOT_IMPLEMENTED;
        }
        
        return new HdsChannel(aURI, stream);
    };

    /**
     * @member allowPort
     * @param {Number} port
     * @param {String} scheme
     */
    this.allowPort = function(port, scheme)
    {
        return false;
    };

    /**
     * @member QueryInterface
     * @param {Guid} iid
     * @returns {Object}
     */
    this.QueryInterface = XPCOMUtils.generateQI([Ci.nsIProtocolHandler]);
};

HdsProtocol.prototype =
{
    classDescription: "Implementation of x-hds protocol",
    classID: Components.ID('{20419380-eec6-11e2-91e2-0800200c9a66}'),

    _xpcom_factory: XPCOMUtils.generateSingletonFactory(HdsProtocol)
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory ? XPCOMUtils.generateNSGetFactory([HdsProtocol]) : undefined;
const NSGetModule = !XPCOMUtils.generateNSGetFactory ? XPCOMUtils.generateNSGetModule([HdsProtocol]) : undefined;
