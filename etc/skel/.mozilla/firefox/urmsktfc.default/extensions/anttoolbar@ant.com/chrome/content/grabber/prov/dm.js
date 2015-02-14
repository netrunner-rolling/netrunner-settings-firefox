/**
 * dm.js, 2013
 * @author Igor Chornous ichornous@heliostech.hk
 */
var antvd = (function(antvd) {
if (!antvd.AntLib)
    antvd.AntLib = AntLib;
const Ci = Components.interfaces;
const Cc = Components.classes;

const ID_HDSPROTOCOL_CONTRACT = "@mozilla.org/network/protocol;1?name=x-hds";
const ID_IOSERVICE_CONTRACT = "@mozilla.org/network/io-service;1";

Components.utils.import("resource://gre/modules/NetUtil.jsm");

// {{{ DmHdsStream
/**
 * @class DmHdsStreamFragment
 */
function DmHdsStreamFragment() {};
DmHdsStreamFragment.prototype = {
    /** @type nsIURI */ uri: null,
    /** @type Number */ size: 0,
    /** @type Number */ time: 0,
    /**
     * Open an asynchronous transmission channel
     * @member createChannel
     * @returns {nsIChannel} newly created channel for the fragment's uri
     */
    createChannel: function() {
        return NetUtil.newChannel(this.uri);
    }
};

/**
 * @static
 * @member fromSpec
 */
DmHdsStreamFragment.fromSpec = function(spec) {
    let fragment = new DmHdsStreamFragment();
    fragment.uri = NetUtil.newURI(spec);
    return fragment;
};

/**
 * @class DmHdsStream
 * @implements IHdsStream
 * @param {String} name
 */
function DmHdsStream(name)
{
    // {{{ Private fields
    /**
     * @private
     * @type Array.<DmHdsStreamFragment>
     * @name fragments
     */
    var fragments = [
        DmHdsStreamFragment.fromSpec(
            "data:binary/octet-stream;base64,RkxWAQUAAAAJAAAAAA==")
    ];

    /**
     * Estimated size of content in bytes
     *
     * @private
     * @type Number
     * @name contentLength
     */
    var contentLength = undefined;
    // }}}

    /**
     * Public access
     */
    // {{{ addFragment method
    /**
     * @member addFragment
     * @param {String} spec Uri of a fragment
     */
    this.addFragment = function(spec)
    {
        fragments.push(DmHdsStreamFragment.fromSpec(spec));
    };
    // }}}

    // {{{ setContentLength method
    /**
     * @member setContentLength
     * @param {Number} length
     */
    this.setContentLength = function(length)
    {
        contentLength = length;
    };
    // }}}

    // {{{ getName method

    /**
     * @member getName
     * @returns {String}
     */
    this.getName = function()
    {
        return name;
    };

    // }}}

    /**
     * IHdsStream implementation
     */
    // {{{ getContentLength method
    /**
     * @member getContentLength
     * @returns {Number}
     */
    this.getContentLength = function()
    {
        return contentLength;
    };
    // }}}

    /**
     * @member getFragmentCount
     * @returns {Number} Number of fragments in the stream
     */
    this.getFragmentCount = function()
    {
        return fragments.length;
    };

    /**
     * @member getFragment
     * @param {Number} index
     * @returns {DmHdsStreamFragment}
     */
    this.getFragment = function(index) {
        return fragments[index];
    };

    // {{{ createChannel method
    /**
     * @deprecated
     * @member createFragmentChannel
     * @param {Number} fragmentIndex
     * @returns {nsIChannel}
     */
    this.createChannel = function(fragmentIndex)
    {
        return fragments[fragmentIndex].createChannel();
    };
    // }}}
};
// }}}

/**
 * @class DmMediaRequest
 * @param {nsIURI} uri Resource uri
 * @param {DmHdsStream} stream Dm stream
 * @param {Document} document Origin document
 */
function DmMediaRequest(uri, stream, document) {
    let protocol = DmMediaRequest._getHdsProtocol();
    let hdsUri = protocol.createUri(uri);
    protocol.addStream(hdsUri, stream);

    try {
        this._base = new antvd.MediaRequest(
            document.documentURIObject
            , document.referrer
            , DmMediaRequest._getCleanName(document.title)
                + " [" + stream.getName() + "]"
            , stream.getContentLength());
        for (let i = 1; i < stream.getFragmentCount(); ++i) {
            this._base.addStream(stream.getFragment(i).uri);
        }
    } catch (e) {
        antvd.AntLib.logError("[DM]: Failed to register dm stream", e);
        protocol.removeStream(hdsUri);
        throw e;
    }

    this._hdsUri = hdsUri;
    this._hdsStream = stream;
};

DmMediaRequest.prototype = {
    /** @public */ get displayName() {
        return this._base.displayName;
    },
    /** @public */ get size() {
        return this._base.size;
    },

    /** @private @type nsIURI */ _hdsUri: null,
    /** @private @type DmHdsStream */ _hdsStream: null,

    /**
     * @since 2.4.7.23
     * @private
     * @type MediaRequest
     */
    _base: null,

    /**
     * Downloads remote video
     *
     * @member download
     * @param {MediaLibrary} library
     * @returns {Promise}
     */
    download: function(library) {
        /** @type DmMediaRequest */
        let ctx = this;

        return library.save({
            uri: this._hdsUri,
            filename: this._getFileName(),
            origin: {
                url: this._base.originUrl,
                title: this.displayName
            }
        }).then(function(/** @type DownloadResult */ dr) {
            for (let i = 1; i < ctx._hdsStream.getFragmentCount(); ++i) {
                let fragment = ctx._hdsStream.getFragment(i);
                ctx._base.setStreamMetadata(fragment.uri, fragment);
            }
            return dr;
        });
    },

    /**
     * @member reportDownload
     * @returns {Promise}
     */
    reportDownload: function() {
        return this._base.reportDownload();
    },

    /**
     * Release an associated protocol object
     *
     * @member release
     */
    release: function() {
        try {
            let protocol = DmMediaRequest._getHdsProtocol();
            protocol.removeStream(this._hdsUri);
        } catch (ex) {
            antvd.AntLib.logError("[DM]: Failed to gently release the stream", ex);
        }
    },

    /**
     * @deprecated To be renamed in 'equals'
     * @member compare
     * @param request
     * @returns {Boolean}
     */
    compare: function(request) {
        if (!request || !request._hdsUri)
            return false;
        try {
            return this._hdsUri.equals(request._hdsUri);
        } catch (e) {
            antvd.AntLib.logError("[DM]: Failed to compare uri's", e);
            throw new Error("Internal failure");
        }
    },

    /**
     * @private
     * @member _getFileName
     * @returns {String}
     */
    _getFileName: function() {
        return antvd.AntLib.mangleFileName(this.displayName, "flv");
    }
};

/**
 * @static
 * @private
 * @member _getHdsProtocol
 * @returns {nsIProtocolHandler}
 */
DmMediaRequest._getHdsProtocol = function() {
    try {
        return Cc[ID_HDSPROTOCOL_CONTRACT]
            .createInstance(Ci.nsIProtocolHandler)
            .wrappedJSObject;
    } catch (e) {
        antvd.AntLib.logError("x-hds protocol component failed to initialize", e);
        throw new Error("Internal failure");
    }
};

/**
 * @static
 * @member _getCleanName
 * @param {String} dirtyName
 */
DmMediaRequest._getCleanName = function(dirtyName) {
    return antvd.AntLib.sanitize(dirtyName)
        .replace(/[,:()\[\]"'.`~▶]/ig,"")
        .trim();
};

// {{{ DmSearchResult

/**
 * @class DmSearchResult
 * @implements ISearchResult
 */
function DmSearchResult()
{
    var ctx = this;

    // {{{ Properties

    /**
     * @name manifestUri
     * @type nsIURI
     */
    var manifestUri = null;

    /**
     * @name document
     * @type Document
     */
    var document = null;

    /**
     * @name callback
     * @type Function
     */
    var callback = null;

    // }}}

    /**
     * ISearchResult implementation
     */
    // {{{ asyncFetch method

    /**
     * Asynchronously downloads and parses the manifest
     * @member asyncFetch
     * @param {Function} clbck May be called multiple times.
     *                         An instance of FlvLink is as a single argument
     * @returns {undefined} nothing
     */
    this.asyncFetch = function(clbck)
    {
        callback = clbck;
        addVideoManifestUri(manifestUri);
    };

    // }}}

    /**
     * Internal interface
     */
    // {{{ setManifestUri method
    /**
     * Specifies the video manifest uri. This function must be
     * called prior to the invokation of asyncFetch
     * @member setManifestUri
     * @param {nsIURI} uri
     */
    this.setManifestUri = function(uri)
    {
        manifestUri = uri;
    };
    // }}}

    // {{{ setDocument method
    /**
     * Specifies the document which is associated with the manifest
     * This function must be called prior to the invokation of asyncFetch
     * @member setDocument
     * @param {Document} associatedDocument
     */
    this.setDocument = function(associatedDocument)
    {
        document = associatedDocument;
    };
    // }}}

    /**
     * Implementation
     */
    // {{{ addVideoManifestUri method
    /**
     * Asynchronously downloads a manifest pointed by uri
     *
     * @member addVideoManifestUri
     * @param {nsIURI} uri Uri of the dm's manifest
     */
    var addVideoManifestUri = function(uri)
    {
        withContentUri(uri, ctx.addVideoManifestContent);
    };
    // }}}

    // {{{ addVideoManifestContent method

    /**
     * Synchronously parses the content and builds a valid object of VideoSource
     * @member addVideoManifestContent
     * @param {String} content Dm manifest's content
     */
    this.addVideoManifestContent = function(content, found)
    {
        var manifest = JSON.parse(content);
        if (manifest['version'] != '1')
        {
            // TODO: Log this error
            return;
        }

        var defaultStreamName = manifest['default'];
        for each(var i in manifest['alternates'])
        {
            var name = i['name'];
            var streamManifestUriSpec = i['template'];
            var streamManifestUri = uriFromString(streamManifestUriSpec);
            ctx.addVideoStreamManifestUri(name, streamManifestUri);
        }
    };

    // }}}

    // {{{ addVideoStreamManifestUri method
    /**
     * @member addVideoStreamManifestUri
     * @param {String} name Name of the stream
     * @param {nsIURI} uri Uri of the stream manifest
     */
    this.addVideoStreamManifestUri = function(name, uri)
    {
        withContentUri(
            uri
            , function(content)
            {
                ctx.addVideoStreamManifestContent(uri, name, content);
            });
    };
    // }}}

    // {{{ addVideoStreamManifestContent method

    /**
     * Parses the dm stream manifest and adds a corresponding hds stream to the queue
     * @member addVideoStreamManifestContent
     * @param {nsIURI} uri Uri of the video stream manifest
     * @param {String} name Name of the stream
     * @param {String} content Manifest's content
     */
    this.addVideoStreamManifestContent = function(uri, name, content)
    {
        var streamManifest = JSON.parse(content);
        if (streamManifest['version'] != "1")
        {
            return;
        }

        var baseUri = uriFromString(uri.prePath);
        var hdsStream = new DmHdsStream(name);

        try
        {
            let bitrate = streamManifest['bitrate'];
            let duration = streamManifest['duration'];
            let length = bitrate * duration * 128;
            hdsStream.setContentLength(length);
        }
        catch (e)
        {
            antvd.AntLib.toLog("Failed to guess the content length: " + e);
        }

        var j = 1;
        var template = streamManifest['template'];
        for each (var fragment in streamManifest['fragments'])
        {
            for (var i = 0; i < fragment[0]; ++i)
            {
                /**
                 * template contains only the path portion of uri
                 * so we need to resolve it
                 */
                var fragmentUriPathStr = template.replace(
                        /\$fragment\$/i, j.toString());

                var fragmentUriStr = baseUri.resolve(fragmentUriPathStr);
                hdsStream.addFragment(fragmentUriStr);
                ++j;
            }
        }

        addVideoStream(uri, hdsStream);
    };

    // }}}

    // {{{ addVideoStream private method

    /**
     * @private
     * @member addVideoStream
     * @param {nsIURI} uri
     * @param {DmHdsStream} hdsStream
     */
    var addVideoStream = function(uri, hdsStream)
    {
        if (hdsStream.getFragmentCount() == 0)
        {
            antvd.AntLib.toLog("Video manifest doesn't contain fragments:\n"
                         + uri.spec + "\n");
            return;
        }

        try
        {
            let mediaRequest = new DmMediaRequest(uri, hdsStream, document);
            callback(mediaRequest);
        }
        catch (e)
        {
            antvd.AntLib.logError("[DM]: Failed to add a stream:"
                                  + "\nUri: " + uri.spec
                                  , e);
        }
    };

    // }}}

    // {{{ withContentUri private method

    /**
     * @private
     * @member withContentUri
     * @param {nsIURI} uri Uri of the remote resource
     * @param {Function} func Function to be supplied with content of the resource
     * @param {Function} [err=null] Function to be called in case of failure
     */
    var withContentUri = function(uri, func, err)
    {
        NetUtil.asyncFetch(
            uri
            , function(inputStream, status)
            {
                if (!Components.isSuccessCode(status) && err)
                {
                    err(uri, status);
                    return;
                }

                try
                {
                    var content =
                            NetUtil.readInputStreamToString(
                                inputStream
                                , inputStream.available());
                    func(content);
                }
                catch (e)
                {
                    // TODO: log error
                    return;
                }
            });
    };

    // }}}

    // {{{ uriFromString private method
    /**
     * @private
     * @member uriFromString
     * @param {String} spec
     * @returns {nsIURI}
     */
    var uriFromString = function(spec)
    {
        var ioService = Cc[ID_IOSERVICE_CONTRACT].getService(Ci.nsIIOService);
        return ioService.newURI(spec, null, null);
    };
    // }}}
};

// }}}

// {{{ DmSearchStrategy

/**
 * @class DmSearchStrategy
 * @implements ISearchStrategy
 */
antvd.DmSearchStrategy = function()
{
    var ctx = this;

    const reHost = /www\.dailymotion\.com/i;
    const reManifestPath =/\/cdn\/manifest\/video\//i;
    const manifestContentType = "application/vnd.lumberjack.manifest";

    /**
     * ISearchStrategy implementation
     */
    // {{{ isApplicable method

    /**
     * @member isApplicable
     * @param {Document} document
     * @param {nsIHttpChannel} channel
     * @returns {Boolean}
     */
    this.isApplicable = function(document, channel)
    {
        var docUri = document.documentURIObject;
        var reqUri = channel.URI;

        try
        {
            // document's uri could be 'about:blank' and so on
            // in that case the `host accessor will throw an exception
            if (docUri.host.match(reHost))
                return true;
        }
        catch (e) { /** ignore */ }

        try
        {
            if (reqUri.host.match(reHost))
                return true;
        }
        catch (e) { /** ignore */ }

        return false;
    };

    // }}}

    // {{{ search method
    /**
     * @member search
     * @param {Document} document Owning document
     * @param {nsIHttpChannel} channel Request's channel to analyze
     * @param {Function} found The function 'found' is to be called in case if video
     *                         content is found. It may be invoked multiple times.
     *                         The single argument is `flvLink:AntFlvLink
     * @returns {undefined} nothing
     */
    this.search = function(document, channel, found)
    {
        if (!document || !channel || !found)
        {
            // TODO(Igor): Notify error
            return;
        }

        var uri = channel.URI;

        // uri.host & path accessors may throw an exception, but we don't care
        if ((channel.contentType != manifestContentType)
            || (channel.requestMethod != 'GET')
            || !uri.host.match(reHost)
            || !uri.path.match(reManifestPath))
        {
            return;
        }

        var searchResult = new DmSearchResult();
        searchResult.setManifestUri(uri);
        searchResult.setDocument(document);
        searchResult.asyncFetch(found);
    };
    // }}}
};
// }}}

return antvd;
})(antvd);
