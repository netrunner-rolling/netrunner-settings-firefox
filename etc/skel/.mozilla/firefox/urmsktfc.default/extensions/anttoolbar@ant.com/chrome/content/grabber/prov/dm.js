// dm.js, 2013
// @author Igor Chornous ichornous@heliostech.hk
var antvd = (function(antvd)
{
    if ( ! antvd.AntLib )
    {
        antvd.AntLib = AntLib;
    }
    
    const Ci = Components.interfaces;
    const Cc = Components.classes;
    
    const ID_HDSPROTOCOL_CONTRACT = "@mozilla.org/network/protocol;1?name=x-hds";
    const ID_IOSERVICE_CONTRACT = "@mozilla.org/network/io-service;1";

    Components.utils.import("resource://gre/modules/NetUtil.jsm");
    Components.utils.import("resource://gre/modules/Downloads.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");

// @class DmHdsStreamFragment
function DmHdsStreamFragment() {};

DmHdsStreamFragment.prototype =
{
    // type nsIURI
    uri: null,
    
    // type Number
    size: 0,
    
    // type Number
    time: 0,
    
    // Open an asynchronous transmission channel
    // @member createChannel
    // @returns {nsIChannel} newly created channel for the fragment's uri
    createChannel: function()
    {
        return NetUtil.newChannel(this.uri);
    }
};

// @static
// @member fromSpec
DmHdsStreamFragment.fromSpec = function(spec)
{
    let fragment = new DmHdsStreamFragment();

    fragment.uri = NetUtil.newURI(spec);

    return fragment;
};

// @class DmHdsStream
// @implements IHdsStream
// @param {String} name
function DmHdsStream(name)
{
    // @private
    // @type Array.<DmHdsStreamFragment>
    // @name fragments
    var fragments = [ DmHdsStreamFragment.fromSpec("data:binary/octet-stream;base64,RkxWAQUAAAAJAAAAAA==") ];

    // Estimated size of content in bytes
    //
    // @private
    // @type Number
    // @name contentLength
    var contentLength = undefined;

    // Public access

    // @member addFragment
    // @param {String} spec Uri of a fragment
    this.addFragment = function(spec)
    {
        fragments.push(DmHdsStreamFragment.fromSpec(spec));
    };

    // @member setContentLength
    // @param {Number} length
    this.setContentLength = function(length)
    {
        contentLength = length;
    };

    // @member getName
    // @returns {String}
    this.getName = function()
    {
        return name;
    };

    // IHdsStream implementation

    // @member getContentLength
    // @returns {Number}
    this.getContentLength = function()
    {
        return contentLength;
    };

    // @member getFragmentCount
    // @returns {Number} Number of fragments in the stream
    this.getFragmentCount = function()
    {
        return fragments.length;
    };

    // @member getFragment
    // @param {Number} index
    // @returns {DmHdsStreamFragment}
    this.getFragment = function(index)
    {
        return fragments[index];
    };

    // @deprecated
    // @member createFragmentChannel
    // @param {Number} fragmentIndex
    // @returns {nsIChannel}
    this.createChannel = function(fragmentIndex)
    {
        return fragments[fragmentIndex].createChannel();
    };
};

// @class DmMediaRequest
// @param {nsIURI} uri Resource uri
// @param {DmHdsStream} stream Dm stream
// @param {Document} document Origin document
function DmMediaRequest(uri, stream, document)
{
    let protocol = DmMediaRequest._getHdsProtocol();
    let hdsUri = protocol.createUri(uri);

    protocol.addStream(hdsUri, stream);

    try
    {
        this._base = new antvd.MediaRequest(
            document.documentURIObject,
            document.referrer,
            DmMediaRequest._getCleanName(document.title) + " [" + stream.getName() + "]",
            stream.getContentLength()
        );

        for (let i = 1; i < stream.getFragmentCount(); ++i)
        {
            this._base.addStream(stream.getFragment(i).uri);
        }
    }
    catch (e)
    {
        antvd.AntLib.logError("DmMediaRequest.ctor (dm.js)", "Failed to register dailymotion stream", e);
        protocol.removeStream(hdsUri);
        throw e;
    }

    this._hdsUri = hdsUri;
    this._hdsStream = stream;
};

DmMediaRequest.prototype =
{
    get displayName()
    {
        return this._base.displayName;
    },
    
    get size()
    {
        return this._base.size;
    },

    // private nsIURI
    _hdsUri: null,
    
    // private DmHdsStream
    _hdsStream: null,

    // @since 2.4.7.23
    // @private
    // @type MediaRequest
    _base: null,

    // Downloads remote video
    //
    // @member download
    // @param {MediaLibrary} library
    // @returns {Promise}
    download: function(library)
    {
        // type DmMediaRequest
        let ctx = this;

        return library.save(
            {
                uri: this._hdsUri,
                filename: this._getFileName(),
                origin:
                {
                    url: this._base.originUrl,
                    title: this.displayName
                }
            }).then(function(dr)    // type DownloadResult
                    {
                        for (let i = 1; i < ctx._hdsStream.getFragmentCount(); ++i)
                        {
                            let fragment = ctx._hdsStream.getFragment(i);
                            ctx._base.setStreamMetadata(fragment.uri, fragment);
                        }
                        
                        return dr;
                    }
                );
    },

    // @member reportDownload
    // @returns {Promise}
    reportDownload: function()
    {
        return this._base.reportDownload();
    },

    // Release an associated protocol object
    // @member release
    release: function()
    {
        try
        {
            let protocol = DmMediaRequest._getHdsProtocol();
            protocol.removeStream(this._hdsUri);
        }
        catch (ex)
        {
            antvd.AntLib.logError(
                "DmMediaRequest.release (dm.js)",
                "Failed to gently release the stream",
                ex
            );
        }
    },

    // @deprecated To be renamed in 'equals'
    // @member compare
    // @param request
    // @returns {Boolean}
    compare: function(request)
    {
        if (!request || !request._hdsUri)
        {
            return false;
        }
        
        try
        {
            return this._hdsUri.equals(request._hdsUri);
        }
        catch (e)
        {
            antvd.AntLib.logError(
                "DmMediaRequest.compare (dm.js)",
                "Failed to compare URIs",
                e
            );
            
            throw new Error("Internal failure");
        }
    },

    // @private
    // @member _getFileName
    // @returns {String}
    _getFileName: function()
    {
        return antvd.AntLib.mangleFileName(this.displayName, "flv");
    }
};

// @static
// @private
// @member _getHdsProtocol
// @returns {nsIProtocolHandler}
DmMediaRequest._getHdsProtocol = function()
{
    try
    {
        return Cc[ID_HDSPROTOCOL_CONTRACT].createInstance(Ci.nsIProtocolHandler).wrappedJSObject;
    }
    catch (e)
    {
        antvd.AntLib.logError(
            "DmMediaRequest._getHdsProtocol (dm.js)",
            "X-HDS protocol component failed to initialize",
            e
        );
        
        throw new Error("Internal failure");
    }
};

 // @static
 // @member _getCleanName
 // @param {String} dirtyName
DmMediaRequest._getCleanName = function(dirtyName)
{
    return antvd.AntLib.sanitize(dirtyName).replace(/[,:()\[\]"'.`~▶]/ig,"").trim();
};

// @class DmSearchResult
// @implements ISearchResult
function DmSearchResult()
{
    var ctx = this;

    // nsIURI
    var manifestUri = null;

    // Document
    var document = null;

    // Function
    var callback = null;

    // ISearchResult implementation

    // Asynchronously downloads and parses the manifest
    // @member asyncFetch
    // @param {Function} clbck May be called multiple times.
    //                         An instance of FlvLink is as a single argument
    // @returns {undefined} nothing
    this.asyncFetch = function(clbck)
    {
        callback = clbck;
        addVideoManifestUri(manifestUri);
    };

    // Internal interface
    ///
    // Specifies the video manifest uri. This function must be
    // called prior to the invokation of asyncFetch
    // @member setManifestUri
    // @param {nsIURI} uri
    this.setManifestUri = function(uri)
    {
        manifestUri = uri;
    };

    // Specifies the document which is associated with the manifest
    // This function must be called prior to the invokation of asyncFetch
    // @member setDocument
    // @param {Document} associatedDocument
    this.setDocument = function(associatedDocument)
    {
        document = associatedDocument;
    };

    // Implementation

    // Asynchronously downloads a manifest pointed by uri
    //
    // @member addVideoManifestUri
    // @param {nsIURI} uri Uri of the dm's manifest
    var addVideoManifestUri = function(uri)
    {
        withContentUri(uri, ctx.addVideoManifestContent);
    };

    // Synchronously parses the content and builds a valid object of VideoSource
    // @member addVideoManifestContent
    // @param {String} content Dm manifest's content
    this.addVideoManifestContent = function(content, found)
    {
        // type Object
        let manifest = null;

        try
        {
            manifest = JSON.parse(content);
        }
        catch (ex)
        {
            antvd.AntLib.logError(
                "DmSearchResult.addVideoManifestContent (dm.js)",
                "Failed to parse video manifest",
                ex
            );
            
            return;
        }

        if (manifest['version'] != '1')
        {
            antvd.AntLib.toLog(
                "DmSearchResult.addVideoManifestContent (dm.js)",
                "Unsupported video manifest version: " + manifest['version']
            );
        }

        try
        {
            let defaultStreamName = manifest['default'];
        
            for each(var i in manifest['alternates'])
            {
                let name = i['name'];
                let streamManifestUriSpec = i['template'];
                let streamManifestUri = uriFromString(streamManifestUriSpec);
                
                ctx.addVideoStreamManifestUri(name, streamManifestUri);
            }
        }
        catch (ex)
        {
            antvd.AntLib.logError(
                "DmSearchResult.addVideoManifestContent (dm.js)",
                "Failed to extract stream manifests",
                ex
            );
        }
    };

    // @member addVideoStreamManifestUri
    // @param {String} name Name of the stream
    // @param {nsIURI} uri Uri of the stream manifest
    this.addVideoStreamManifestUri = function(name, uri)
    {
        withContentUri(uri, function(content)
        {
            try
            {
                ctx.addVideoStreamManifestContent(uri, name, content);
            }
            catch (ex)
            {
                antvd.AntLib.logError(
                    "DmSearchResult.addVideoStreamManifestUri (dm.js)",
                    "Failed to register a stream manifest",
                    ex
                );
            }
        });
    };

    // Parses the dm stream manifest and adds a corresponding hds stream to the queue
    // @member addVideoStreamManifestContent
    // @param {nsIURI} uri Uri of the video stream manifest
    // @param {String} name Name of the stream
    // @param {String} content Manifest's content
    this.addVideoStreamManifestContent = function(uri, name, content)
    {
        // type Object
        let streamManifest = null;

        try
        {
            streamManifest = JSON.parse(content);
        
            if (streamManifest['version'] != "1")
            {
                antvd.AntLib.toLog(
                    "DmSearchResult.addVideoStreamManifestContent (dm.js)",
                    "Unsupported manifest version:" +
                    "\n   URI: " + uri.spec + "\n   Version: " + streamManifest['version']
                );
            }
        }
        catch (ex)
        {
            antvd.AntLib.logError(
                "DmSearchResult.addVideoStreamManifestContent (dm.js)",
                "Failed to parse a stream manifest:" + "\nURI: " + uri.spec,
                ex
            );
            
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
            antvd.AntLib.toLog(
                "DmSearchResult.addVideoStreamManifestContent (dm.js)",
                "Failed to guess the content length",
                e
            );
        }

        var j = 1;
        var template = streamManifest['template'];

        for each (var fragment in streamManifest['fragments'])
        {
            for (var i = 0; i < fragment[0]; ++i)
            {
                // template contains only the path portion of uri
                // so we need to resolve it
                var fragmentUriPathStr = template.replace(/\$fragment\$/i, j.toString());
                var fragmentUriStr = baseUri.resolve(fragmentUriPathStr);

                hdsStream.addFragment(fragmentUriStr);

                ++j;
            }
        }

        addVideoStream(uri, hdsStream);
    };

    // @private
    // @member addVideoStream
    // @param {nsIURI} uri
    // @param {DmHdsStream} hdsStream
    var addVideoStream = function(uri, hdsStream)
    {
        if (hdsStream.getFragmentCount() == 0)
        {
            antvd.AntLib.toLog(
                "DmSearchResult.addVideoStream (dm.js)",
                "Video manifest doesn't contain fragments: " + uri.spec
            );

            return;
        }

        try
        {
            let mediaRequest = new DmMediaRequest(uri, hdsStream, document);
            callback(mediaRequest);
        }
        catch (e)
        {
            antvd.AntLib.logError(
                "DmSearchResult.addVideoStream (dm.js)",
                "Failed to add a stream: " + uri.spec, e
            );
        }
    };

    // @private
    // @member withContentUri
    // @param {nsIURI} uri Uri of the remote resource
    // @param {Function} func Function to be supplied with content of the resource
    // @param {Function} [err=null] Function to be called in case of failure
    var withContentUri = function(uri, func, err)
    {
        // type XMLHttpRequest
        let hr = new XMLHttpRequest();

        hr.onload = function(ev)
        {
            if (hr.status == 200)
            {
                func(hr.responseText);
            }
            else
            {
                antvd.AntLib.toLog(
                    "DmSearchResult.withContentUri (dm.js)",
                    "[DM] Failed to fetch content:" +
                    "\nURI: " + uri.spec +
                    "\nError: " + hr.statusText +
                    "\nStatus: " + hr.status
                );
            }
        };

        hr.open("GET", uri.spec, true);
        hr.send();
    };

    // @private
    // @member uriFromString
    // @param {String} spec
    // @returns {nsIURI}
    var uriFromString = function(spec)
    {
        var ioService = Cc[ID_IOSERVICE_CONTRACT].getService(Ci.nsIIOService);
        return ioService.newURI(spec, null, null);
    };
};

function DmHlsMediaRequest(Document, Chunks)
{
    this._document = Document;
    this._chunks = Chunks;
    
    let cleanName = antvd.AntLib.sanitize(this._document.title).replace(/[,:()\[\]\|"'.`~▶]/ig,"").trim();
    
    this._base = new antvd.MediaRequest(Document.documentURIObject, Document.referrer, cleanName, 0);
};

DmHlsMediaRequest.TEMP_FILE_NAME = "dm-stream-chunk";

DmHlsMediaRequest.prototype =
{
    _base: null,    
    _chunks: null,    
    _document: null,
    
    get displayName()
    {
        return this._base.displayName;
    },
    
    get size()
    {
        return this._base.size;
    },

    compare: function(request)
    {
    },
    
    download: function(library)
    {
        let ctx = this;
        let converterConf = antvd.ConverterPackage.getDefault();
        
        try
        {
            library.ensureConfigured();
            converterConf.ensureConfigured();
        }
        catch (ex)
        {
            return Promise.reject(ex);
        }

        return Task.spawn(function ()
        {
            let _svideo = null;
            let _svideos = [];
            
            try
            {
                for(let i = 0; i < ctx._chunks.length; i++)
                {
                    let _video = library.download(NetUtil.newURI(ctx._chunks[i]), DmHlsMediaRequest.TEMP_FILE_NAME, true);
                    
                    _svideo = yield _video;
                    
                    _svideos.push(_svideo);
                    
                    ctx._base.addStream(_svideo.source);
                    ctx._base.setStreamMetadata(_svideo.source, { size: _svideo.size, time: _svideo.downloadTime });
                }
            }
            catch (ex)
            {
                antvd.AntLib.logError(
                    "DmHlsMediaRequest.download (dm.js)",
                    "Failed to download streams",
                    ex
                );

                throw ex;
            }

            let converter = new antvd.Converter(converterConf);
            converter.setName(ctx._base.displayName);

            try
            {
                yield converter.joinChunks(_svideos, ["-bsf:a", "aac_adtstoasc"]);
            }
            catch (ex)
            {
                antvd.AntLib.logError(
                    "DmHlsMediaRequest.download (dm.js)",
                    "Failed to convert media",
                    ex
                );

                throw ex;
            }

            try
            {
                yield library.save(
                    {
                        uri: converter.getUri(),
                        filename: converter.getFileName(),
                        origin:
                        {
                            url: ctx._base._originUrl,
                            title: ctx._base.displayName,
                            domain: antvd.AntLib.getDomain(ctx._base._originUrl)
                        }
                    }
                );
                
                converter.finalize();
            }
            finally
            {
                try
                {
                    for(let i = 0; i < ctx._chunks.length; i++)
                    {
                        FileUtils.File(_svideos[i].target).remove(false);
                    }
                }
                catch (_e0)
                {
                    antvd.AntLib.logWarning(
                        "DmHlsMediaRequest.download (dm.js)",
                        "Failed to cleanup temporary files",
                        _e0
                    );
                }
            }
        });
    },
    
    reportDownload: function()
    {
        // return this._base.reportDownload();
    },

    release: function()
    {
    }
};

function DmHlsSearchResult(MasterPlaylistUri, Document)
{
    var m_Ctx = this;
    
    var m_MasterPlaylistUrl = MasterPlaylistUri;
    var m_AvgPlaylist1 = null;
    var m_AvgPlaylist2 = null;
    var m_Document = Document;
    var m_Callback = null;
    var m_BaseVideoURL = null;
    
    const Ci = Components.interfaces;
    const Cc = Components.classes;

    const ID_IOSERVICE_CONTRACT = "@mozilla.org/network/io-service;1";

    // ISearchResult implementation
    
    // Asynchronously downloads and parses the manifest
    // @member asyncFetch
    // @param {Function} clbck May be called multiple times.
    //                         An instance of FlvLink is as a single argument
    // @returns {undefined} nothing
    this.asyncFetch = function(callback)
    {
        m_Callback = callback;
    
        m_AvgPlaylist1 = null;
        m_AvgPlaylist2 = null;
        
        this.withContentUri(m_MasterPlaylistUrl, this.processMasterPlaylist);
    };
    
    // processMasterPlaylist method
    // Synchronously parses the content and builds a valid object of VideoSource
    // @member processMasterPlaylist
    // @param {String} content Dailymotion manifest's content
    this.processOrdinalPlaylist = function(content, found)
    {
        let playlist = null;
        let chunks = new Array();
    
        try
        {
            playlist = content.split("\n");
            
            for(let i = 0; i < playlist.length; i++)
            {            
                if ( typeof(playlist[i]) === undefined )
                {
                    continue;
                }
    
                // playlist[i] = playlist[i].trim();
    
                if (!playlist[i].startsWith("#"))
                {
                    if (m_BaseVideoURL)
                    {
                        chunks.push(m_BaseVideoURL + playlist[i]);
                    }
                }
            }
        }
        catch (ex)
        {
            antvd.AntLib.logError(
                "DmHlsSearchResult.processOrdinalPlaylist (dm.js)",
                "Failed to parse playlist",
                ex
            );
            
            return;
        }
        
        if (chunks.length > 0)
        {
            let mediaRequest = new DmHlsMediaRequest(m_Document, chunks);
            m_Callback(mediaRequest);
        }
    };
    
    // processMasterPlaylist method
    // Synchronously parses the content and builds a valid object of VideoSource
    // @member processMasterPlaylist
    // @param {String} content Dailymotion manifest's content
    this.processMasterPlaylist = function(content, found)
    {
        let master_playlist = null;
    
        try
        {
            master_playlist = content.split("\n");
            
            for(let i = 0; i < master_playlist.length; i++)
            {
                if ( typeof(master_playlist[i]) === undefined )
                {
                    continue;
                }
    
                master_playlist[i] = master_playlist[i].trim();
    
                if (master_playlist[i].startsWith("#EXT-X-STREAM-INF:"))
                {
                    if (!(typeof(master_playlist[i+1]) === undefined))
                    {
                        if (m_Ctx.m_AvgPlaylist1 == null)
                        {
                            m_Ctx.m_AvgPlaylist1 = master_playlist[i+1];
                            i++;
                            continue;
                        }
                        else if (m_Ctx.m_AvgPlaylist2 == null)
                        {
                            m_Ctx.m_AvgPlaylist2 = master_playlist[i+1];
                            i++;
                            continue;
                        }
                        else
                        {
                            break;
                        }
                    }
                }
            }
        }
        catch (ex)
        {
            antvd.AntLib.logError(
                "DmHlsSearchResult.processMasterPlaylist (dm.js)",
                "Failed to parse master playlist",
                ex
            );
            
            return;
        }
        
        let _url = (m_Ctx.m_AvgPlaylist1 != null) ? m_Ctx.m_AvgPlaylist1 : m_Ctx.m_AvgPlaylist2;
        
        // Extract host to use with Dailymotion HLS chunks
        let _urlObject = new URL(_url);
        
        if (_urlObject && _urlObject.origin)
        {
            m_BaseVideoURL = _urlObject.origin;
        }
 
        // Continue with parsing playlists   
        if (_url != null)
        {
            m_Ctx.withContentUri(m_Ctx.uriFromString(_url), m_Ctx.processOrdinalPlaylist);
        }
        else
        {
            antvd.AntLib.toLog(
                "DmHlsSearchResult.processMasterPlaylist (dm.js)",
                "Failed to obtain links to average video from master playlist"
            );
        }
    };
    
    
    // addVideoStream private method
    // @private
    // @member addVideoStream
    // @param {nsIURI} uri
    // @param {DailymotionHdsStream} hdsStream
    this.addVideoStream = function(uri, hdsStream)
    {
        if (hdsStream.getFragmentCount() == 0)
        {
            antvd.AntLib.toLog(
                "DmHlsSearchResult.addVideoStream (dm.js)",
                "Video manifest doesn't contain fragments: " + uri.spec
            );
    
            return;
        }
    
        try
        {
            let mediaRequest = new DailymotionMediaRequest(uri, hdsStream, m_Document);
    
            m_Callback(mediaRequest);
        }
        catch (e)
        {
            antvd.AntLib.logError(
                "DmHlsSearchResult.addVideoStream (dm.js)",
                "Failed to add a stream: " + uri.spec,
                e
            );
        }
    };
    
    // withContentUri private method
    // @private
    // @member withContentUri
    // @param {nsIURI} uri Uri of the remote resource
    // @param {Function} func Function to be supplied with content of the resource
    // @param {Function} [err=null] Function to be called in case of failure
    this.withContentUri = function(uri, func, err)
    {
        let hr = new XMLHttpRequest();
        
        try
        {
            hr.onload = function(ev)
            {
                if (hr.status == 200)
                {
                    func(hr.responseText);
                }
                else
                {
                    antvd.AntLib.toLog(
                        "DmHlsSearchResult.withContentUri (dm.js)",
                        "Failed to fetch content: " + "\n   URI: " + uri.spec +
                        "\n   Error: " + hr.statusText +
                        "\n   Status: " + hr.status
                    );
                }
            };
        
            hr.open("GET", uri.spec, true);
            hr.send();
        }
        catch(e)
        {
            antvd.AntLib.logError(
                "DmHlsSearchResult.withContentUri (dm.js)",
                "Async HTTP request failed, URI: " + uri.spec,
                e
            );
        }
    };
    
    // @member uriFromString
    // @param {String} spec
    // @returns {nsIURI}
    this.uriFromString = function(spec)
    {
        var ioService = Cc[ID_IOSERVICE_CONTRACT].getService(Ci.nsIIOService);
        return ioService.newURI(spec, null, null);
    };
};

 // @class DmSearchStrategy
 // @implements ISearchStrategy
antvd.DmSearchStrategy = function()
{
    var ctx = this;

    const reHost = /www\.dailymotion\.com/i;
    const reManifestPath =/\/cdn\/manifest\/video\//i;
    const manifestContentTypeHDS = "application/vnd.lumberjack.manifest";
    const manifestContentTypeHLS = "application/vnd.apple.mpegurl";

    // ISearchStrategy implementation

    // @member isApplicable
    // @param {Document} document
    // @param {nsIHttpChannel} channel
    // @returns {Boolean}
    this.isApplicable = function(document, channel)
    {
        var docUri = document.documentURIObject;
        var reqUri = channel.URI;

        try
        {
            // document's uri could be 'about:blank' and so on
            // in that case the `host accessor will throw an exception
            if (docUri.host.match(reHost))
            {
                return true;
            }
        }
        catch (e)
        {}

        try
        {
            if (reqUri.host.match(reHost))
            {
                return true;
            }
        }
        catch (e)
        {}

        return false;
    };

    // @member search
    // @param {Document} document Owning document
    // @param {nsIHttpChannel} channel Request's channel to analyze
    // @param {Function} found The function 'found' is to be called in case if video
    //                         content is found. It may be invoked multiple times.
    //                         The single argument is `flvLink:AntFlvLink
    // @returns {undefined} nothing
    this.search = function(document, channel, found)
    {
        if (!document || !channel || !found)
        {
            // TODO(Igor): Notify error
            return;
        }

        var uri = channel.URI;

        // uri.host & path accessors may throw an exception, but we don't care
        if ((channel.requestMethod != 'GET') || !uri.host.match(reHost) || !uri.path.match(reManifestPath))
        {
            return;
        }
        
        if (channel.contentType == manifestContentTypeHDS)
        {
            var searchResult = new DmSearchResult();
            
            searchResult.setManifestUri(uri);
            searchResult.setDocument(document);
            searchResult.asyncFetch(found);
        }
        else if (channel.contentType == manifestContentTypeHLS)
        {
            var searchResult = new DmHlsSearchResult(uri, document);

            searchResult.asyncFetch(found);
        }
        else
        {
            antvd.AntLib.toLog(
                "DmSearchStrategy.search (dm.js)",
                "Unsupported manifest type: " + channel.contentType
            );
        }
    };
};

return antvd;

})(antvd);
