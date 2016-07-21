// dash.js, 2016
// @Author ED
//
// Contains implementation of protocol MPEG-DASH
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

    function MpegDashMediaRequest(Document, AudioStreamJson, VideoStreamJson)
    {
        this._document = Document;
        this._audio = AudioStreamJson;
        this._video = VideoStreamJson;
        this.m_CleanDocumentName = antvd.AntLib.sanitize(this._document.title).replace(/[,:()\[\]\|"'.`~▶]/ig,"").trim();
        let cleanName = this.m_CleanDocumentName;

        if(VideoStreamJson.width != "" && VideoStreamJson.height != "")
        {
            cleanName = antvd.AntLib.sprintf(
                "%sx%s - %s",
                VideoStreamJson.width, VideoStreamJson.height, this.m_CleanDocumentName
            );
        }
        
        this._base = new antvd.MediaRequest(Document.documentURIObject, Document.referrer, cleanName, 0);

        antvd.AntLib.toLog(
            "MpegDashMediaRequest.ctor (dash.js)",
            antvd.AntLib.sprintf(
                "Created media request: name %s, document %s",
                cleanName, Document.documentURIObject.spec
            )
        );
    };
    
    MpegDashMediaRequest.prototype =
    {
        _base: null,    
        _audio: null,
        _video: null,
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
            if (request._video.id == this._video.id)
            {
                return true;
            }
            
            return false;
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
                var audio_file = null, audio_file_stream = null;
                var video_file = null, video_file_stream = null;
                var audio_file_binary_stream = null, video_file_binary_stream = null;
                let _url = "", _t, _item;
                
                var chunkFile = Components.classes["@mozilla.org/file/local;1"].createInstance(
                    Components.interfaces.nsILocalFile
                );

                var chunkStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(
                    Components.interfaces.nsIFileInputStream
                );
                
                var binaryChunkStream = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(
                    Components.interfaces.nsIBinaryInputStream
                );

                audio_file = FileUtils.getFile("TmpD", ["output-audio-" + ctx.m_CleanDocumentName]);
                video_file = FileUtils.getFile("TmpD", ["output-video-" + ctx.m_CleanDocumentName]);
                
                audio_file_stream = FileUtils.openSafeFileOutputStream(audio_file, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE);
                video_file_stream = FileUtils.openSafeFileOutputStream(video_file, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE);
                
                audio_file_binary_stream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
                video_file_binary_stream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
                
                audio_file_binary_stream.setOutputStream(audio_file_stream);
                video_file_binary_stream.setOutputStream(video_file_stream);

                try
                {
                    // Put initialization segment at the beginning of segments list
                    // This will greatly simplify task of downloading init segment and rest segments
                    // together in the same output
                    ctx._audio.segment_list.segments.unshift(ctx._audio.segment_list.init);
                    
                    // Download audio segments
                    for(let i = 0; i < ctx._audio.segment_list.segments.length; i++)
                    {
                        _url = ctx._audio.base_url + ctx._audio.segment_list.segments[i];
                        
                        _t = library.download(
                            NetUtil.newURI(_url),
                            antvd.AntLib.sprintf(
                                "Chunk-Audio-%d-of-%d-%s",
                                i+1, ctx._audio.segment_list.segments.length, ctx.m_CleanDocumentName
                            ),
                            true
                        );
                        
                        _item = yield _t;

                        chunkFile.initWithPath(_item.target);
    
                        chunkStream.init(chunkFile, -1, 0, 0);
                        
                        binaryChunkStream.setInputStream(chunkStream);
                        
                        chunkBinaryContent = binaryChunkStream.readByteArray(chunkFile.fileSize);
                        
                        // Copy chunk stream into output binary stream
                        audio_file_binary_stream.writeByteArray(chunkBinaryContent, chunkBinaryContent.length);
                        
                        audio_file_binary_stream.flush();
                        
                        chunkStream.close();
                    }
                    
                    // ***

                    // Download video initialization segment

                    // Put initialization segment at the beginning of segments list
                    // This will greatly simplify task of downloading init segment and rest segments
                    // together in the same output
                    ctx._video.segment_list.segments.unshift(ctx._video.segment_list.init);

                    // Download video segments
                    for(let i = 0; i < ctx._video.segment_list.segments.length; i++)
                    {
                        _url = ctx._video.base_url + ctx._video.segment_list.segments[i];
                        
                        _t = library.download(
                            NetUtil.newURI(_url),
                            antvd.AntLib.sprintf(
                                "Chunk-Video-%d-of-%d-%s",
                                i+1, ctx._video.segment_list.segments.length, ctx.m_CleanDocumentName
                            ),
                            true
                        );
                        
                        _item = yield _t;

                        chunkFile.initWithPath(_item.target);
    
                        chunkStream.init(chunkFile, -1, 0, 0);
                        
                        binaryChunkStream.setInputStream(chunkStream);
                        
                        chunkBinaryContent = binaryChunkStream.readByteArray(chunkFile.fileSize);
                        
                        // Copy chunk stream into output binary stream
                        video_file_binary_stream.writeByteArray(chunkBinaryContent, chunkBinaryContent.length);
                        
                        video_file_binary_stream.flush();
                        
                        chunkStream.close();
                    }
                }
                catch (ex)
                {
                    antvd.AntLib.logError(
                        "MpegDashMediaRequest.download (dash.js)",
                        "Failed to download streams",
                        ex
                    );
    
                    throw ex;
                }
    
                let converter = new antvd.Converter(converterConf);
                converter.setName(ctx._base.displayName);
    
                try
                {
                    yield converter.join(
                        video_file.path, audio_file.path,
                        ctx._video.mime_type, ctx._audio.mime_type
                    );
                }
                catch (ex)
                {
                    antvd.AntLib.logError(
                        "MpegDashMediaRequest.download (dash.js)",
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
                        audio_file.remove(false);
                        video_file.remove(false);
                    }
                    catch (_e0)
                    {
                        antvd.AntLib.logWarning(
                            "MpegDashMediaRequest.download (dash.js)",
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
    
    function MpegDashSearchResult(ManifestUri, Document)
    {
        var m_Ctx = this;
        
        var m_ManifestUri = ManifestUri;
        
        var m_Document = Document;
        var m_Callback = null;
        
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
            
            this.withContentUri(m_ManifestUri, this.processManifest);
        };
        
       
        // processManifest method
        // Synchronously parses the content and builds a valid object of VideoSource
        // @member processManifest
        // @param {String} content HLS manifest's content
        this.processManifest = function(content, found)
        {
            var parser = Components.classes["@mozilla.org/xmlextras/domparser;1"].createInstance(Components.interfaces.nsIDOMParser);
            var manifest = null;
            let parse_failed = false;
            
            // Manifest processing result objects
            var audio_stream = null;        // Currently, only 1 audio stream is supported
            var video_streams = [];
            
            try
            {
                manifest = parser.parseFromString(content, "application/xml");

                if(manifest.documentElement.nodeName == "parsererror")
                {
                    antvd.AntLib.logError(
                        "MpegDashSearchResult.processManifest (dash.js)",
                        "Error while parsing XML manifest",
                        null
                    );

                    parse_failed = true;
                }
            }
            catch(e)
            {
                antvd.AntLib.logError(
                    "MpegDashSearchResult.processManifest (dash.js)",
                    "Exception while parsing XML manifest",
                    e
                );

                parse_failed = true;
            }
            
            if (parse_failed)
            {
                return;
            }
            
            // Create resolver
            // It is vital otherwise function evaluate() will return nothing
            var nsResolver = function(suffix)
            {
                if (suffix === "x")
                {
                    return "urn:mpeg:DASH:schema:MPD:2011";
                }
            };

            // Select all adaptation sets
            var representations = null;            
            var adaptation_sets = manifest.evaluate(
                '//x:AdaptationSet', manifest, nsResolver, XPathResult.ANY_TYPE, null
            );

            try
            {
                var adaptationSetNode = adaptation_sets.iterateNext();
                let adaptationSetNodeName = (adaptationSetNode.tagName != null) ? adaptationSetNode.tagName : "<unknown>";
                var representations = null, base_url = null, segments = null;
                
                while (adaptationSetNode)
                {
                    // Extract Representation set from current adaptation set
                    try
                    {
                        representations = manifest.evaluate(
                            './/x:Representation', adaptationSetNode, nsResolver, XPathResult.ANY_TYPE, null
                        );
                    }
                    catch(e)
                    {
                        antvd.AntLib.logError(
                            "MpegDashSearchResult.processManifest (dash.js)",
                            "Exception while iterating through representations of adaptation set" + adaptationSetNodeName,
                            e
                        );
                    }
                    
                    // Process mime type of adaptation set
                    try
                    {
                        if (adaptationSetNode.attributes['mimeType'].value.match(/^audio\//))
                        {
                            // Extract single representation
                            // From it, extract BaseURL and SegmentsList
                            var audio_representation = representations.iterateNext();
                            var audio_representation_base_url = null;
                            var audio_representation_segments = null;
                            
                            // Initialize empty audio stream object
                            audio_stream = {
                                base_url: "",
                                mime_type: "",
                                segment_list:
                                {
                                    init: "",
                                    segments: []
                                }
                            };
                            
                            audio_stream.mime_type = adaptationSetNode.attributes['mimeType'].value;
                            
                            for(let i = 0; i < audio_representation.children.length; i++)
                            {
                                let _e = audio_representation.children[i];
                                
                                if (_e.tagName === "BaseURL")
                                {
                                    audio_stream.base_url = _e.innerHTML;
                                    continue;
                                }
                                
                                if (_e.tagName === "SegmentList")
                                {
                                    for(k = 0; k < _e.children.length; k++)
                                    {
                                        var _segment = _e.children[k];
                                        
                                        if (_segment.tagName === "Initialization")
                                        {
                                            audio_stream.segment_list.init = _segment.attributes['sourceURL'].value;
                                        }
                                        else if (_segment.tagName === "SegmentURL")
                                        {
                                            audio_stream.segment_list.segments.push(_segment.attributes['media'].value);
                                        }
                                        else
                                        {
                                            antvd.AntLib.toLog(
                                                "MpegDashSearchResult.processManifest (dash.js)",
                                                antvd.AntLib.sprintf(
                                                    "Unexpected tag %s in SegmentList of audio stream adaptation set, skipping",
                                                    _segment.tagName
                                                )
                                            );
                                        }
                                    }
                                }
                            }
                            
                            antvd.AntLib.toLog(
                                "MpegDashSearchResult.processManifest (dash.js)",
                                antvd.AntLib.sprintf(
                                    "Extracted audio stream: %s",
                                    JSON.stringify(audio_stream)
                                )
                            );
                        }
                        else if (adaptationSetNode.attributes['mimeType'].value.match(/^video\//))
                        {
                            var video_representation = representations.iterateNext();
                            
                            while (video_representation)
                            {
                                // Initialize empty video stream object
                                var video_stream = {
                                    id: "",
                                    width: "",
                                    height: "",
                                    mime_type: "",
                                    base_url: "",
                                    segment_list:
                                    {
                                        init: "",
                                        segments: []
                                    }
                                };
                                
                                video_stream.mime_type = adaptationSetNode.attributes['mimeType'].value;
                                
                                if (video_representation.attributes["id"] != null)
                                {
                                    video_stream.id = video_representation.attributes["id"].value;
                                }
                                
                                if (video_representation.attributes["width"] != null)
                                {
                                    video_stream.width = video_representation.attributes["width"].value;
                                }

                                if (video_representation.attributes["height"] != null)
                                {
                                    video_stream.height = video_representation.attributes["height"].value;
                                }

                                for(let i = 0; i < video_representation.children.length; i++)
                                {
                                    let _e = video_representation.children[i];
                                    
                                    if (_e.tagName === "BaseURL")
                                    {
                                        video_stream.base_url = _e.innerHTML;
                                        continue;
                                    }
                                    
                                    if (_e.tagName === "SegmentList")
                                    {
                                        for(k = 0; k < _e.children.length; k++)
                                        {
                                            var _segment = _e.children[k];
                                            
                                            if (_segment.tagName === "Initialization")
                                            {
                                                video_stream.segment_list.init = _segment.attributes['sourceURL'].value;
                                            }
                                            else if (_segment.tagName === "SegmentURL")
                                            {
                                                video_stream.segment_list.segments.push(_segment.attributes['media'].value);
                                            }
                                            else
                                            {
                                                antvd.AntLib.toLog(
                                                    "MpegDashSearchResult.processManifest (dash.js)",
                                                    antvd.AntLib.sprintf(
                                                        "Unexpected tag %s in SegmentList of video stream adaptation set, skipping",
                                                        _segment.tagName
                                                    )
                                                );
                                            }
                                        }
                                    }
                                }
                                
                                antvd.AntLib.toLog(
                                    "MpegDashSearchResult.processManifest (dash.js)",
                                    antvd.AntLib.sprintf(
                                        "Extracted video stream: %s",
                                        JSON.stringify(video_stream)
                                    )
                                );
                                
                                video_streams.push(video_stream);
                                
                                video_representation = representations.iterateNext();
                            }
                        }
                        else
                        {
                            antvd.AntLib.toLog(
                                "MpegDashSearchResult.processManifest (dash.js)",
                                antvd.AntLib.sprintf(
                                    "Unsupported adaptation set '%s' mime type %s, skipping",
                                    adaptationSetNodeName, adaptationSetNode.attributes['mimeType'].value
                                )
                            );
                        }
                    }
                    catch(e)
                    {
                        antvd.AntLib.logError(
                            "MpegDashSearchResult.processManifest (dash.js)",
                            "Exception while processing mime type of adaptation set " + adaptationSetNodeName,
                            e
                        );
                    }
                    
                    adaptationSetNode = adaptation_sets.iterateNext();
                }	
            }
            catch (e)
            {
                antvd.AntLib.logError(
                    "MpegDashSearchResult.processManifest (dash.js)",
                    "Exception while iterating through adaptation sets", e
                );
            }
            
            // Create media requests from JSON audio/video stream objects
            if (audio_stream == null)
            {
                antvd.AntLib.logError(
                    "MpegDashSearchResult.processManifest (dash.js)",
                    "Audio stream is null, unable to proceed", null
                );
            }
            
            if (video_streams.length == 0)
            {
                antvd.AntLib.logError(
                    "MpegDashSearchResult.processManifest (dash.js)",
                    "Video stream array is empty, unable to proceed", null
                );
            }
            
            for(let i = 0; i < video_streams.length; i++)
            {
                let mediaRequest = new MpegDashMediaRequest(m_Document, audio_stream, video_streams[i]);

                m_Callback(mediaRequest);
            }
        };
        
        
        // addVideoStream private method
        // @private
        // @member addVideoStream
        // @param {nsIURI} uri
        // @param {DailymotionHdsStream} hdsStream
        //this.addVideoStream = function(uri, hdsStream)
        //{
        //    if (hdsStream.getFragmentCount() == 0)
        //    {
        //        antvd.AntLib.toLog(
        //            "MpegDashSearchResult.addVideoStream (dash.js)",
        //            "Video manifest doesn't contain fragments: " + uri.spec
        //        );
        //
        //        return;
        //    }
        //
        //    try
        //    {
        //        let mediaRequest = new DailymotionMediaRequest(uri, hdsStream, m_Document);
        //
        //        m_Callback(mediaRequest);
        //    }
        //    catch (e)
        //    {
        //        antvd.AntLib.logError(
        //            "MpegDashSearchResult.addVideoStream (dash.js)",
        //            "Failed to add a stream: " + uri.spec,
        //            e
        //        );
        //    }
        //};
        //
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
                            "MpegDashSearchResult.withContentUri (dash.js)",
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
                    "MpegDashSearchResult.withContentUri (dash.js)",
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
    
     // @class MpegDashSearchStrategy
     // @implements ISearchStrategy
    antvd.MpegDashSearchStrategy = function()
    {
        var ctx = this;
    
        const manifestContentTypeDASH = "video/vnd.mpeg.dash.mpd";
        
        // ISearchStrategy implementation
    
        // @member isApplicable
        // @param {Document} document
        // @param {nsIHttpChannel} channel
        // @returns {Boolean}
        this.isApplicable = function(document, channel)
        {
            if (channel.contentType == manifestContentTypeDASH)
            {
                antvd.AntLib.toLog(
                    "MpegDashSearchStrategy.isApplicable (dash.js)",
                    antvd.AntLib.sprintf(
                        "Detected master playlist file %s at %s",
                        manifestContentTypeDASH, channel.URI.spec
                    )
                );

                return true;
            }
   
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
                antvd.AntLib.logError(
                    "MpegDashSearchStrategy.search(dash.js)",
                    "One of the input parameters is incorrect",
                    null
                );

                return;
            }
    
            var uri = channel.URI;
    
            if (channel.contentType == manifestContentTypeDASH)
            {
                var searchResult = new MpegDashSearchResult(uri, document);
    
                searchResult.asyncFetch(found);
            }
        };
    };
    
    return antvd;

})(antvd);
