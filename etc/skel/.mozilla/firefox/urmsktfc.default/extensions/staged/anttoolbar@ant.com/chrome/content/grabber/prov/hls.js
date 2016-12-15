// hds-hls.js, 2013-2016
// @Author ICh
// @Contributor ED
//
// Contains implementation of protocols HLS
// used on web sites dailymotion and xvideos
//

var antvd = (function(antvd)
{
    if ( ! antvd.AntLib )
    {
        antvd.AntLib = AntLib;
    }
    
    const Ci = Components.interfaces;
    const Cc = Components.classes;

    Components.utils.import("resource://gre/modules/NetUtil.jsm");
    Components.utils.import("resource://gre/modules/Downloads.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");

    function HlsMediaRequest(Document, Chunks, QualityTag, Encrypted, MasterPlaylistURL, Strategy)
    {
        this._document = Document;
        this._chunks = Chunks;
        this.m_CleanDocumentName = antvd.AntLib.sanitize(this._document.title).replace(/[,:()\[\]\|"'.`~▶]/ig,"").trim();
        let cleanName = this.m_CleanDocumentName;
        
        this.m_OurStrategy = Strategy;

        if(QualityTag != null)
        {
            this.m_QualityTag = QualityTag;
        }
        else
        {
            this.m_QualityTag = "...x...";
        }
        
        // Patch for vk.com
        if (MasterPlaylistURL.match(/vk\.(?:com|me|cc|ru|ua)\//i))
        {
            try
            {
                var regex_result = MasterPlaylistURL.match(/\/index\-f(\d+)/i);
                
                if (regex_result == null)
                {
                    antvd.AntLib.toLog(
                        "HlsMediaRequest.ctor (hls.js)",
                        "VK patch: Playlist URI does not contain index field, quality tag unchanged",
                        ex
                    );
                }
                else
                {
                    this.m_QualityTag = "Video " + regex_result[1];
                }
            }
            catch(ex)
            {
                antvd.AntLib.logError(
                    "HlsMediaRequest.ctor (hls.js)",
                    "VK patch failed, quality tag unchanged",
                    ex
                );
            }
        }
        
        cleanName = antvd.AntLib.sprintf("%s - %s", this.m_QualityTag, this.m_CleanDocumentName);

        this._base = new antvd.MediaRequest(Document.documentURIObject, Document.referrer, cleanName, 0);
        
        this._base.encrypted = Encrypted;
        
        this.m_MasterPlaylistURL = MasterPlaylistURL;

        antvd.AntLib.toLog(
            "HlsSearchResult.ctor (hls.js)",
            antvd.AntLib.sprintf(
                "Created media request: tag %s, name %s, document %s",
                this.m_QualityTag, cleanName, Document.documentURIObject.spec
            )
        );
    };
    
    HlsMediaRequest.prototype =
    {
        _base: null,    
        _chunks: null,    
        _document: null,
        m_QualityTag: null,
        m_MasterPlaylistURL: null,
        m_OurStrategy: null,
        
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
            let result = false;
            
            // Check if this playlist is in list of dependant media playlists
            if (this.m_OurStrategy)
            {
                let _playlist = this.m_OurStrategy.dependant_media_playlists_map.get(this.m_MasterPlaylistURL);
                
                if (_playlist != undefined)
                {
                    return true;
                }
            }
            
            if (request.m_MasterPlaylistURL == this.m_MasterPlaylistURL)
            {
                if (request.m_QualityTag == this.m_QualityTag)
                {
                    result = true;
                }
            }
            
            antvd.AntLib.toLog(
                "HlsMediaRequest.compare (hls.js)",
                antvd.AntLib.sprintf(
                    "Request: Master playlist URL: %s, quality tag: %s\n   This: Master playlist URL: %s, quality tag: %s\n Result: %d",
                    request.m_MasterPlaylistURL, request.m_QualityTag, this.m_MasterPlaylistURL, this.m_QualityTag, result
                )
            );
            
            return result;
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
                        let _video = library.download(
                            NetUtil.newURI(ctx._chunks[i]),
                            antvd.AntLib.sprintf(
                                "Chunk-%d-of-%d-%s",
                                i+1, ctx._chunks.length, ctx.displayName
                            ),
                            true
                        );
                        
                        _svideo = yield _video;
                        
                        _svideos.push(_svideo);
                        
                        ctx._base.addStream(_svideo.source);
                        ctx._base.setStreamMetadata(_svideo.source, { size: _svideo.size, time: _svideo.downloadTime });
                    }
                }
                catch (ex)
                {
                    antvd.AntLib.logError(
                        "HlsMediaRequest.download (hls.js)",
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
                        "HlsMediaRequest.download (hls.js)",
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
                    // Do not clean up chunks if converter stop flag is set
                    if (AntLib.isDebugConverterStop() == false)
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
                                "HlsMediaRequest.download (hls.js)",
                                "Failed to cleanup temporary files",
                                _e0
                            );
                        }
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
            let ctx = this;
            
            // Remove this playlist from the list of dependant media playlists
            if (ctx.m_OurStrategy)
            {
                ctx.m_OurStrategy.dependant_media_playlists_map.delete(this.m_MasterPlaylistURL);
            }
        }
    };
    
    function HlsSearchResult(MasterPlaylistUri, Document, Strategy)
    {
        var m_Ctx = this;
        var m_OurStrategy = Strategy;
        
        var m_MasterPlaylistUrl = MasterPlaylistUri;
        var m_MasterPlaylistBase = m_MasterPlaylistUrl.spec.substring(0, m_MasterPlaylistUrl.spec.lastIndexOf("/") + 1);
        
        if (m_MasterPlaylistBase.endsWith("/") == false)
        {
            m_MasterPlaylistBase = m_MasterPlaylistBase + "/";
        }
        
        var m_Document = Document;
        var m_Callback = null;
        
        const Ci = Components.interfaces;
        const Cc = Components.classes;
        
        const ID_IOSERVICE_CONTRACT = "@mozilla.org/network/io-service;1";
    
        // ISearchResult implementation
        
        // Asynchronously downloads and parses the manifest
        // @member asyncFetch
        // @param {Function} callback   May be called multiple times.
        //                              An instance of FlvLink is as a single argument
        // @returns {undefined} nothing
        this.asyncFetch = function(callback)
        {
            m_Callback = callback;
            
            this.withContentUri(m_MasterPlaylistUrl, this.processPlaylistCallback);
        };
        
        this.processMediaPlaylist = function(XStreamInf, StreamLink)
        {
            // Here, XStreamInf is the line from EXTM3U playlist. It has the following form:
            // #EXT-X-STREAM-INF:NAME=VALUE,NAME=VALUE,NAME=VALUE,...
            
            // Extract NAME and RESOLUTION fields from X-STREAM-INF
            // Rename NAME field into Quality
            var streamInfArray = XStreamInf.split(",");
            
            // Create payload JSON object that then will go as parameter into callback
            var payload = {};
            var forbidden_chars = /[\/\0\<\>\:\"\\\|\?\*]/gi;
            
            if (streamInfArray.length > 0)
            {
                try
                {
                    for(let i = 0; i < streamInfArray.length; i++)
                    {
                        let value = streamInfArray[i].substr(
                            streamInfArray[i].indexOf("=") + 1, streamInfArray[i].length - 1
                        );
                        
                        if (streamInfArray[i].toLowerCase().startsWith("resolution"))
                        {
                            payload['resolution'] = value.replace(forbidden_chars, "");
                        }
                        else if (streamInfArray[i].toLowerCase().startsWith("name"))
                        {
                            payload['quality'] = value.replace(forbidden_chars, "");
                        }
                    }
                }
                catch(e)
                {
                    antvd.AntLib.logError(
                        "HlsSearchResult.processMediaPlaylist (hls.js)",
                        "Error while parsing EXT-X-STREAM-INF header",
                        e
                    );
                }
            }
            
            // Check and form valid playlist URI
            if (antvd.AntLib.startsWithHTTP(StreamLink) == false)
            {
                StreamLink = m_MasterPlaylistBase + StreamLink;
            }
            
            antvd.AntLib.toLog(
                "HlsSearchStrategy.processMediaPlaylist (hls.js)",
                "Detected media playlist " + StreamLink
            );
            
            payload['playlist'] = StreamLink;
            
            // Set playlist to map of dependant media playlist
            // Once we make HTTP request to obtain media playlist, AVD will re-detect it,
            // and treat as single media playlist
            // Checking map will avoid duplication of qualities in drop-down menu
            m_OurStrategy.dependant_media_playlists_map.set(StreamLink);
            
            let hr = new XMLHttpRequest();
            
            try
            {
                hr.onload = function(ev)
                {
                    if (hr.status == 200)
                    {
                        
                        m_Ctx.processMediaPlaylistCallback(hr.responseText, payload);
                    }
                    else
                    {
                        antvd.AntLib.toLog(
                            "HlsSearchResult.processMediaPlaylist (hls.js)",
                            "Failed to fetch content: " + "\n   URI: " + uri.spec +
                            "\n   Error: " + hr.statusText +
                            "\n   Status: " + hr.status
                        );
                    }
                };
            
                hr.open("GET", StreamLink, true);
                hr.send();
            }
            catch(e)
            {
                antvd.AntLib.logError(
                    "HlsSearchResult.processMediaPlaylist (hls.js)",
                    "Async HTTP request failed, URI: " + StreamLink,
                    e
                );
            }
        };
        
        // processMediaPlaylistCallback method
        // Synchronously parses the content and builds a valid object of VideoSource
        // @member processMediaPlaylistCallback
        // @param {String} content -- Media playlist content
        // @param {JSON} payload -- Additional information from master playlist
        this.processMediaPlaylistCallback = function(content, payload)
        {
            let playlist = null;
            let chunks = new Array();
            let playlist_base = "";
            let playlist_host = "";
            let encrypted = false;
        
            if (payload && payload.hasOwnProperty("playlist"))
            {
                playlist_base = payload['playlist'].substring(
                    0,
                    payload['playlist'].lastIndexOf("/") + 1
                );
                
                try
                {
                    let playlist_uri = antvd.AntLib.toURI(playlist_base);
                    
                    playlist_host = playlist_uri.prePath;                    
                }
                catch(e)
                {
                    antvd.AntLib.logError(
                        "HlsSearchResult.processMediaPlaylistCallback (hls.js)",
                        "Error while extracting pre-path from playlist URI " + playlist_base,
                        e
                    );
                }
            }

            try
            {
                playlist = content.split("\n");
                
                for(let i = 0; i < playlist.length; i++)
                {            
                    if ( typeof(playlist[i]) === undefined )
                    {
                        continue;
                    }
                    
                    if (playlist[i].length == 0)
                    {
                        continue;
                    }
                    
                    if (playlist[i].startsWith("#EXT-X-KEY") == true)
                    {
                        encrypted = true;
                        continue;
                    }
        
                    if (playlist[i].startsWith("#") == false)
                    {
                        let chunk_link = playlist[i];
                        
                        // Chunk URI is full-fledged URI. Add without doubts
                        if (antvd.AntLib.startsWithHTTP(chunk_link) == true)
                        {
                            chunks.push(chunk_link);
                            
                            continue;
                        }
                        
                        // Dailymotion case. Chunk URI is a path relative to playlist host (pre-path)
                        if (chunk_link.match(/^\/[\/\.a-zA-Z0-9()_\-]+$/) != null)
                        {
                            chunk_link = playlist_host + chunk_link;
                            
                            chunks.push(chunk_link);
                            
                            continue;
                        }
                        
                        // Chunk is relative to playlist path...
                        chunk_link = playlist_base + playlist[i];
                        
                        // ...or to master playlist path
                        if (antvd.AntLib.startsWithHTTP(chunk_link) == false)
                        {
                            chunk_link = m_MasterPlaylistBase + playlist[i];
                        }

                        if (antvd.AntLib.startsWithHTTP(chunk_link) == false)
                        {
                            antvd.AntLib.logWarning(
                                "HlsMediaRequest.processMediaPlaylistCallback (hls.js)",
                                "Chunk is not a valid HTTP URI: " + chunk_link,
                                null
                            );
                        }

                        chunks.push(chunk_link);
                    }
                }
            }
            catch (ex)
            {
                antvd.AntLib.logError(
                    "HlsSearchResult.processMediaPlaylistCallback (hls.js)",
                    "Failed to parse playlist",
                    ex
                );
                
                return;
            }
            
            if (chunks.length > 0)
            {
                let quality = null;
                
                if (payload.hasOwnProperty("quality"))
                {
                    quality = payload['quality'];
                }
                else if (payload.hasOwnProperty("resolution"))
                {
                    quality = payload['resolution'];
                }
                
                let mediaRequest = new HlsMediaRequest(
                    m_Document,
                    chunks,
                    quality,
                    encrypted,
                    m_MasterPlaylistUrl.spec
                );

                m_Callback(mediaRequest);
            }
        };
        
        // processPlaylistCallback method
        // Synchronously parses the content and builds a valid object of VideoSource
        // @member processPlaylistCallback
        // @param {String} content HLS manifest's content
        this.processPlaylistCallback = function(content, found)
        {
            let playlist = null;
            let playlist_type_media = false;
            let playlist_type_master = false;
        
            playlist = content.split("\n");
            
            if (playlist.length == 0)
            {
                antvd.AntLib.toLog("HlsSearchResult.processPlaylistCallback (hls.js)", "Empty playlist");
                
                return;
            }
            
            // Scan playlist content to check if it is a master playlist
            for(let i = 0; i < playlist.length; i++)
            {
                if ( typeof(playlist[i]) === undefined )
                {
                    continue;
                }
    
                playlist[i] = playlist[i].trim();
    
                if (playlist[i].startsWith("#EXT-X-STREAM-INF"))
                {
                    playlist_type_master = true;
                    break;
                }
            }
        
            // Scan playlist content to check if it is a media playlist
            for(let i = 0; i < playlist.length; i++)
            {
                if ( typeof(playlist[i]) === undefined )
                {
                    continue;
                }
    
                playlist[i] = playlist[i].trim();
    
                if (playlist[i].startsWith("#EXTINF"))
                {
                    playlist_type_media = true;
                    break;
                }
            }
            
            if (playlist_type_master == true && playlist_type_media == true)
            {
                antvd.AntLib.logError(
                    "HlsSearchResult.processPlaylistCallback (hls.js)",
                    "Playlist is invalid (MASTER and MEDIA at the same time)",
                    null
                );
                
                return;
            }

            if (playlist_type_master == false && playlist_type_media == false)
            {
                antvd.AntLib.toLog(
                    "HlsSearchResult.processPlaylistCallback (hls.js)",
                    "Playlist is not HTTP Live Streaming playlist (not MASTER and not MEDIA)"
                );
                
                return;
            }
            
            if (playlist_type_master == true)
            {
                try
                {
                    for(let i = 0; i < playlist.length; i++)
                    {
                        if ( typeof(playlist[i]) === undefined )
                        {
                            continue;
                        }
            
                        playlist[i] = playlist[i].trim();
            
                        if (playlist[i].startsWith("#EXT-X-STREAM-INF:"))
                        {
                            let stream_description = playlist[i]; i++;
                            let stream_uri = playlist[i];
                            
                            m_Ctx.processMediaPlaylist(stream_description, stream_uri);
                        }
                    }
                }
                catch (ex)
                {
                    antvd.AntLib.logError(
                        "HlsSearchResult.processPlaylistCallback (hls.js)",
                        "Failed to parse master playlist",
                        ex
                    );
                    
                    return;
                }
            }
            else if (playlist_type_media == true)
            {
                try
                {
                    var payload = {};
                    
                    payload['playlist'] = m_MasterPlaylistUrl.spec;
                    
                    m_Ctx.processMediaPlaylistCallback(content, payload);
                }
                catch (ex)
                {
                    antvd.AntLib.logError(
                        "HlsSearchResult.processPlaylistCallback (hls.js)",
                        "Failed to parse media playlist",
                        ex
                    );
                    
                    return;
                }
            }
            else
            {
                antvd.AntLib.logError(
                    "HlsSearchResult.processPlaylistCallback (hls.js)",
                    "Internal error while parsing playlist. Did you mess up with the code?",
                    null
                );
                
                return;
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
                            "HlsSearchResult.withContentUri (hls.js)",
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
                    "HlsSearchResult.withContentUri (hls.js)",
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
    
    // @class HlsSearchStrategy
    // @implements ISearchStrategy
    antvd.HlsSearchStrategy = function()
    {
        var ctx = this;
        
        var dependant_media_playlists_map = null;
    
        const manifestContentTypeHLS        = "application/vnd.apple.mpegurl";
        const manifestContentTypeXMPEGURL   = "application/x-mpegurl";
        
        // Xvideos
        const m_XVReManifestName = "hls.m3u8";
        const manifestContentTypePlain = "text/plain";
        
        // ...add new website here
    
        // ISearchStrategy implementation
    
        // @member isApplicable
        // @param {Document} document
        // @param {nsIHttpChannel} channel
        // @returns {Boolean}
        this.isApplicable = function(document, channel)
        {
            var docUri = document.documentURIObject;
            var reqUri = channel.URI;
            var host = null;
            
            let contentType = channel.contentType.toLowerCase();
            
            if (contentType == manifestContentTypeHLS || contentType == manifestContentTypeXMPEGURL)
            {
                antvd.AntLib.toLog(
                    "HlsSearchStrategy.isApplicable (hls.js)",
                    antvd.AntLib.sprintf(
                        "Detected playlist file %s at %s",
                        contentType, channel.URI.spec
                    )
                );

                return true;
            }
            else
            {
                if (docUri.spec.indexOf(m_XVReManifestName) != -1)
                {
                    host = docUri;
                }
                else if (reqUri.spec.indexOf(m_XVReManifestName) != -1)
                {
                    host = reqUri;
                }
            }
            
            if (host != null)
            {
                antvd.AntLib.toLog(
                    "HlsSearchStrategy.isApplicable (hls.js)",
                    antvd.AntLib.sprintf(
                        "Detected master playlist file %s at host %s, full URI %s",
                        m_XVReManifestName, host.host, host.spec
                    )
                );
            }
   
           return (host != null) ? true : false;
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
                antvd.AntLib.logError("HlsSearchStrategy.search(hls.js)", "One of the input parameters is incorrect", null);

                return;
            }
    
            var uri = channel.URI;
            let _runHLS = false;
    
            let contentType = channel.contentType.toLowerCase();
            
            if (contentType == manifestContentTypeHLS || contentType == manifestContentTypeXMPEGURL)
            {
                _runHLS = true;
            }
            else if (contentType == manifestContentTypePlain)
            {
                if (uri.path.indexOf(m_XVReManifestName) != -1)
                {
                    _runHLS = true;
                }
            }
            else
            {
                antvd.AntLib.toLog(
                    "HlsSearchStrategy.search (hls.js)",
                    "Unsupported manifest type: " + contentType
                );
            }

            if (_runHLS == true)
            {
                if (ctx.dependant_media_playlists_map == null)
                {
                    ctx.dependant_media_playlists_map = new Map();
                }
                
                var searchResult = new HlsSearchResult(uri, document, ctx);
    
                searchResult.asyncFetch(found);
            }
        };
    };
    
    return antvd;

})(antvd);
