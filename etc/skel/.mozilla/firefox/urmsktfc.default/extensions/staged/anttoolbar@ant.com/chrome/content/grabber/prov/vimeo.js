// vimeo.js, 2016
// @author ED

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
    Components.utils.import("resource://gre/modules/Services.jsm");

    // The formula of URL of each segment is the following.
    // There is URL of master.json file. Inside JSON file, there is field base_url which is basic for all videos
    // described in master.json. This field should be added to master.json URL which will lead to its stripping
    // because base_url is relative url (e.g. '../../')
    // For each video, there is also base_url field, which should be added to master.json URL. At the end
    // filename of segment should be added.
    // So, the end segment URL formula looks like this:
    //
    // Segment URI = ((Master JSON URI + Base URL) + Video Base URL) + Segment Filename
    //
    // Since Base URL is relative URL, from math point of view this is the same as -(Base URL), so it is like
    // adding a negative number
    //
    function VimeoMediaRequest(Document, MasterJsonUrl, ClipId, BaseURL, VimeoVideoJSON)
    {
        this._document = Document;
        this.m_ClipId = ClipId;
        
        // Strip trailing filename from master JSON
        this.m_SegmentBaseURI = MasterJsonUrl;
        
        let lastSlashIndex = MasterJsonUrl.lastIndexOf("/");
        
        if (lastSlashIndex != -1)
        {
            this.m_SegmentBaseURI = MasterJsonUrl.substring(0, lastSlashIndex);
        }
        
        // Master JSON URI + Base URL
        this.m_SegmentBaseURI = antvd.AntLib.concatAndResolveUrl(this.m_SegmentBaseURI, BaseURL);
        
        // (Master JSON URI + Base URL) + Video Base URL
        this.m_SegmentBaseURI = this.m_SegmentBaseURI + VimeoVideoJSON['base_url'];
        
        // Check for trailing slash
        if(this.m_SegmentBaseURI.endsWith("/") == false)
        {
            this.m_SegmentBaseURI = this.m_SegmentBaseURI + "/";
        }
        
        // Segment filename is added in VimeoMediaRequest.download()
        
        // Extract data from JSON description of Vimeo video
        this.m_InitSegment = VimeoVideoJSON['init_segment'];
        this.m_SegmentsArray = VimeoVideoJSON['segments'];
        this.m_ContentType = VimeoVideoJSON['mime_type'];
        
        // Create clip name that consists of video resolution and clean document title
        // (e.g. "1920x1080 In Japan - Vimeo")
        this.m_CleanDocumentName = antvd.AntLib.sanitize(this._document.title).replace(/[,:()\[\]\|"'.`~▶]/ig,"").trim();
        let cleanName = antvd.AntLib.sprintf('%sx%s %s', VimeoVideoJSON['width'], VimeoVideoJSON['height'], this.m_CleanDocumentName);
        
        this._base = new antvd.MediaRequest(Document.documentURIObject, Document.referrer, cleanName, 0);
    };
    
    VimeoMediaRequest.TEMP_FILE_NAME = "vimeo-stream-chunk";

    VimeoMediaRequest.prototype =
    {
        _base: null,
        _document: null,
        
        m_InitSegment: null,        // Base64 encoded string with video file header
        m_SegmentsArray: null,      // Array of JSON objects, each of them describes video segment
        m_ClipId: null,             // Id of clip
        m_ContentType: null,        // MIME-type of video (e.g. video/mp4)
        m_CleanDocumentName: null,  // Document title, stripped out of extra characters, that can be a filename
        m_SegmentBaseURI: null,     // URL of segment without segment filename
        
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
        
        getFileName: function()
        {
            let extension = ".bin";
            
            switch (this.m_ContentType.toLowerCase())
            {
                case "video/mp4":
                    extension = "mp4";
                    break;
                
                case "video/webm":
                    extension = "webm";
                    break;
            }
            
            return this.m_CleanDocumentName + "." + extension;
        },
        
        download: function(library)
        {
            let ctx = this;
            
            var _downloadFunction = function ()
            {
                var initSegmentArray;           // array[]
                var outputFile;                 // nsIFile
                var outputStream;               // nsIFileOutputStream 
                var binaryOutputStream;         // nsIBinaryOutputStream
                
                // Convert init segment (Base64 string) into Uint8 array and
                // write it to temporary file
                initSegmentArray = antvd.AntLib.convertDataURIToBinary(ctx.m_InitSegment);
                
                if (initSegmentArray.length == 0)
                {
                    antvd.AntLib.logError(
                        "VimeoMediaRequest.download (vimeo.js)",
                        "Initialization segment array is empty", null
                    );
                    
                    return;
                }
                
                // Open output file, stream, and binary stream
                // First write initialization header into output file
                // Then download and write all chunks
                
                outputFile = FileUtils.getFile("TmpD", ["output-" + ctx.m_CleanDocumentName]);
                
                outputStream = FileUtils.openSafeFileOutputStream(outputFile, FileUtils.MODE_WRONLY | FileUtils.MODE_CREATE);
                
                binaryOutputStream = Components.classes["@mozilla.org/binaryoutputstream;1"].createInstance(Components.interfaces.nsIBinaryOutputStream);
                
                binaryOutputStream.setOutputStream(outputStream);
                binaryOutputStream.writeByteArray(initSegmentArray, initSegmentArray.length);
                
                // Download rest of segments
                try
                {
                    for(let i = 0; i < ctx.m_SegmentsArray.length; i++)
                    {
                        let chunkFile, chunkStream, binaryChunkStream;
                        let chunkBinaryContent = [];
                        let _segment_url = NetUtil.newURI(ctx.m_SegmentBaseURI + ctx.m_SegmentsArray[i]['url']);
                        
                        let _video = library.download(
                            _segment_url,
                            antvd.AntLib.sprintf("Chunk-%d-of-%d-%s", i+1, ctx.m_SegmentsArray.length, ctx.m_CleanDocumentName),
                            true
                        );
                        
                        _svideo = yield _video;
                        
                        // Open chunk as binary stream
                        chunkFile = Components.classes["@mozilla.org/file/local;1"].createInstance(
                            Components.interfaces.nsILocalFile
                        );

                        chunkStream = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(
                            Components.interfaces.nsIFileInputStream
                        );
                        
                        binaryChunkStream = Components.classes["@mozilla.org/binaryinputstream;1"].createInstance(
                            Components.interfaces.nsIBinaryInputStream
                        );
                        
                        chunkFile.initWithPath(_svideo.target);

                        chunkStream.init(chunkFile, -1, 0, 0);
                        
                        binaryChunkStream.setInputStream(chunkStream);
                        
                        chunkBinaryContent = binaryChunkStream.readByteArray(chunkFile.fileSize);
                        
                        // Copy chunk stream into output binary stream
                        binaryOutputStream.writeByteArray(chunkBinaryContent, chunkBinaryContent.length);
                        
                        binaryOutputStream.flush();
                        
                        chunkStream.close();

                        //ctx._base.addStream(_svideo.source);
                        //ctx._base.setStreamMetadata(_svideo.source, { size: _svideo.size, time: _svideo.downloadTime });
                    }
                }
                catch (ex)
                {
                    antvd.AntLib.logError("VimeoMediaRequest.download (vimeo.js)", "Failed to download streams", ex);
    
                    throw ex;
                }
    
                FileUtils.closeSafeFileOutputStream(outputStream);

                try
                {
                    yield library.save(
                        {
                            uri: Services.io.newFileURI(outputFile),
                            filename: ctx.getFileName(),
                            origin:
                            {
                                url: ctx._base._originUrl,
                                title: ctx.m_CleanDocumentName,
                                domain: antvd.AntLib.getDomain(ctx._base._originUrl)
                            }
                        }
                    );
                }
                finally
                {
                    try
                    {
                        // Remove init segment + rest segments
                        //for(let i = 0; i < _svideos.length; i++)
                        //{
                        //    FileUtils.File(_svideos[i].target).remove(false);
                        //}
                    }
                    catch (_e0)
                    {
                        antvd.AntLib.logWarning(
                            "VimeoMediaRequest.download (vimeo.js)", "Failed to cleanup temporary files", _e0
                        );
                    }
                }
            };
            
            return Task.spawn(_downloadFunction());
        },

        reportDownload: function()
        {
            // return this._base.reportDownload();
        },
    
        release: function()
        {
        }
    };

    function VimeoSearchResult(MasterJSONUri, Document)
    {
        var m_Ctx = this;
        
        var m_MasterJSONUri = MasterJSONUri;
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
            
            this.withContentUri(m_MasterJSONUri, this.processMasterJSON);
        };
        
        // processMasterJSON method
        // Synchronously parses the content and builds a valid object of VideoSource
        // @member processMasterJSON
        // @param {String} content Vimeo master JSON textual content
        this.processMasterJSON = function(content)
        {
            // type Object
            let masterJsonContent = null;
            let clipId = null;
            let baseUrl = null;
            let videosArray = null;
    
            try
            {
                masterJsonContent = JSON.parse(content);
            
                clipId = masterJsonContent['clip_id'];
                baseUrl = masterJsonContent['base_url'];
                videosArray = masterJsonContent['video'];
                
                antvd.AntLib.toLog(
                    "VimeoSearchResult.processMasterJSON (vimeo.js)",
                    antvd.AntLib.sprintf(
                        "Clip ID: %s; Base URL: %s; Videos count: %d",
                        clipId, baseUrl, videosArray.length
                    )
                );

                if(videosArray.length > 0)
                {
                    for (var i in videosArray)
                    {
                        var video = videosArray[i];
                        
                        var _output = antvd.AntLib.sprintf(
                            '   Video #%d, resolution %sx%s, format %s, segments count %d',
                            i, video['width'], video['height'], video['mime_type'], video['segments'].length
                        );
                        
                        antvd.AntLib.toLog("VimeoSearchResult.processMasterJSON (vimeo.js)", _output);

                        let vimeoMediaRequest = new VimeoMediaRequest(
                            m_Document, m_MasterJSONUri.spec, clipId, baseUrl, video
                        );
                        
                        m_Callback(vimeoMediaRequest);
                    }
                }
            }
            catch (ex)
            {
                antvd.AntLib.logError(
                    "VimeoSearchResult.processMasterJSON (vimeo.js)",
                    "Failed to parse master JSON " + m_MasterJSONUri.spec,
                    ex
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
                            "VimeoSearchResult.withContentUri (vimeo.js)",
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
                    "VimeoSearchResult.withContentUri (vimeo.js)",
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

    // @class VimeoSearchStrategy
    // @implements ISearchStrategy
   antvd.VimeoSearchStrategy = function()
   {
       var ctx = this;
   
       const reManifestPathEnd = "/master.json";
       const reManifestType = "application/json";
   
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
            
            if (docUri.spec.indexOf(reManifestPathEnd) != -1)
            {
                host = docUri;
            }
            else if (reqUri.spec.indexOf(reManifestPathEnd) != -1)
            {
                host = reqUri;
            }
            
            if (host != null)
            {
                antvd.AntLib.toLog(
                    "VimeoSearchStrategy.isApplicable (vimeo.js)",
                    antvd.AntLib.sprintf(
                        "Found manifest file %s at host %s, full URI %s",
                        reManifestPathEnd, host.host, host.spec
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
                return;
            }
            
            var uri = channel.URI;
            
            if ( uri.path.search(reManifestPathEnd) != -1 && channel.contentType == reManifestType)
            {
                var searchResult = new VimeoSearchResult(uri, document);
                
                searchResult.asyncFetch(found);
            }
       };
   };
   
   return antvd;

})(antvd);
