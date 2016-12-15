// yt.js, 2013-2016
// author       ICh
// contributor  ED
// namespace    antvd
//

var antvd = (function(antvd)
{
    if ( ! antvd.AntLib )
    {
        antvd.AntLib = AntLib;
    }

    Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
    Components.utils.import("resource://gre/modules/Downloads.jsm");
    Components.utils.import("resource://gre/modules/Task.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import("resource://gre/modules/Promise.jsm");
    Components.utils.import("resource://gre/modules/NetUtil.jsm");

    const au = "AUDIO";
    const vi = "VIDEO";
    const av = "COMPLETE";

    const Ci = Components.interfaces;
    const Cc = Components.classes;

    // class YtVideoRequest
    var YtVideoRequest = function() {};

    YtVideoRequest.prototype =
    {
        get displayName()
        {
            return this._base.displayName;
        },

        get size()
        {
            return this._base.size;
        },

        // type YtStream
        _video: null,
        _audio: null,

        _id: null,
        _tag: null,

        // since 2.4.7.23
        // type MediaRequest
        _base: null,

        // param {YtStream} video
        // param {YtStream} audio
        init: function(video, audio)
        {
            this._base = new antvd.MediaRequest(
                video.origin.documentURIObject,
                video.origin.referrer,
                YtVideoRequest.getCleanName(video.name),
                video.length + audio.length
            );
            
            this._base.addStream(video.uri);
            this._base.addStream(audio.uri);

            this._video = video;
            this._audio = audio;
            this._id = video.id;
            this._tag = video.tag;
        },

        // Downloads remote media to the local disk
        // member download
        // param {MediaLibrary} library
        // returns {Promise}
        download: function(library)
        {
            // type YtVideoRequest
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
                // type DownloadResult
                let svideo = null;
                let saudio = null;

                try
                {
                    antvd.AntLib.toLog("YtVideoRequest.download (yt.js)", "Downloading video stream " + ctx._video.uri.spec);
                    antvd.AntLib.toLog("YtVideoRequest.download (yt.js)", "Downloading audio stream " + ctx._audio.uri.spec);
                    
                    let vdr = library.download(
                        ctx._video.uri,
                        antvd.AntLib.sprintf("video-stream-%s", ctx.displayName).replace(/ /g, "_"),
                        true
                    );
                    
                    let adr = library.download(
                        ctx._audio.uri,
                        antvd.AntLib.sprintf("audio-stream-%s", ctx.displayName).replace(/ /g, "_"),
                        true
                    );

                    svideo = yield vdr;

                    ctx._base.setStreamMetadata(
                        svideo.source,
                        {
                            size: svideo.size,
                            time: svideo.downloadTime
                        }
                    );

                    saudio = yield adr;
                    
                    ctx._base.setStreamMetadata(
                        saudio.source,
                        {
                            size: saudio.size,
                            time: saudio.downloadTime
                        }
                    );
                }
                catch (ex)
                {
                    antvd.AntLib.logError("YtVideoRequest.download (yt.js)", "Failed to download streams", ex);
                    throw ex;
                }

                let converter = new antvd.Converter(converterConf);
                converter.setName(ctx._getFileName());

                try
                {
                    antvd.AntLib.toLog(
                        "YtVideoRequest.download (yt.js)",
                        antvd.AntLib.sprintf(
                            "Converting\n   video %s\n   audio %s\nto %s",
                            svideo.target, saudio.target, converter.getFileName()
                        )
                    );
                    
                    yield converter.join(svideo.target, saudio.target, ctx._video.ctype, ctx._audio.ctype);
                }
                catch (ex)
                {
                    antvd.AntLib.logError("YtVideoRequest.download (yt.js)", "Failed to merge streams", ex);
                    throw ex;
                }

                try
                {
                    antvd.AntLib.toLog(
                        "YtVideoRequest.download (yt.js)",
                        "Saving video to disk\nuri............" + converter.getUri() +
                        "\nfilename......." + converter.getFileName() +
                        "\norigin/url....." + ctx._base._originUrl +
                        "\norigin/title..." + ctx.displayName
                    );

                    yield library.save(
                        {
                            uri: converter.getUri(),
                            filename: converter.getFileName(),
                            origin:
                            {
                                url: ctx._base._originUrl,
                                title: ctx.displayName,
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
                        // Do not clean up streams if converter stop flag is set
                        if (AntLib.isDebugConverterStop() == false)
                        {
                            // TODO(ICh): Add a shared function which would perform the "nothrow" removal
                            FileUtils.File(svideo.target).remove(false);
                            FileUtils.File(saudio.target).remove(false);
    
                            antvd.AntLib.toLog(
                                "YtVideoRequest.download (yt.js)",
                                "Removed temporary files\n   " + svideo.target + "\n   " + saudio.target
                            );
                        }
                    }
                    catch (_e0)
                    {
                        antvd.AntLib.logWarning("YtVideoRequest.download (yt.js)", "Failed to clean up temporary files", _e0);
                    }
                }
            });
        },

        // returns {Promise}
        reportDownload: function()
        {
            return this._base.reportDownload();
        },

        // deprecated To be renamed to 'equals'
        compare: function(request)
        {
            if ( ! request )
            {
                return false;
            }
            
            return (request._id == this._id) && (request._tag == this._tag);
        },

        release: function() {},

        _getFileName: function(extension)
        {
            return antvd.AntLib.mangleFileName(YtVideoRequest.getCleanName(this.displayName), extension);
        }
    };

    // param {String} dirtyName
    YtVideoRequest.getCleanName = function(dirtyName)
    {
        return antvd.AntLib.sanitize(dirtyName).replace(/[,:()\[\]"'.`~▶]/ig,"").trim();
    };

    // const
    YtVideoRequest.TEMP_FILE_NAME = "yt-stream-chunk";

    // typedef YtStream~StreamInfo
    // property {String} label
    // property {String} br
    // class YtStream
    function YtStream() { };

    YtStream.prototype =
    {
        id: null,               // String
        tag: null,              // Number
        origin: null,           // Document
        uri: null,              // nsIURI
        length: null,           // Number
        ctype: null,            // String
        name: null,             // String
        isInitialized: false,   // Boolean
        media: null,            // YtStream~StreamInfo

        // @member asyncFetch
        // @param {Function} complete Callback to be called in case of success
        asyncFetch: function(complete)
        {
            // type YtStream
            var ctx = this;
            let hr = new XMLHttpRequest();
            
            hr.onreadystatechange = function()
            {
                if (hr.readyState == 4)
                {
                    let clength = -1;
                
                    try
                    {
                        clength = Number(hr.getResponseHeader("Content-Length"));
                    }
                    catch (ex)
                    {
                        antvd.AntLib.logError("YtStream.asyncFetch (yt.js)", "Failed to acquire the size of a stream", ex);
                    }

                    let ctype = null;

                    try
                    {
                        ctype = hr.getResponseHeader("Content-Type");
                    }
                    catch (ex)
                    {
                        antvd.AntLib.logError("YtStream.asyncFetch (yt.js)", "Failed to acquire content type a stream", ex);
                    }

                    ctx.ctype = ctype;
                    ctx.length = clength;
                    ctx.isInitialized = true;

                    complete();
                }
            };

            hr.open("HEAD", this.uri.spec, true);
            hr.send();
        },

        // param {YtStream} stream
        // returns {Boolean} Whether the objects point to the same stream
        equal: function(stream)
        {
            if (this == stream)
            {
                return true;
            }
            
            return (stream.id == this.id) && (stream.tag == this.tag);
        },

        // param {YtStream} stream
        // returns {YtVideoRequest}
        join: function(stream)
        {
            if (this.equal(stream))
            {
                return null;
            }
            
            if ((stream.id != this.id) || (stream.origin != this.origin))
            {
                return null;
            }
        
            if (!this.media || !stream.media)
            {
                return null;
            }
        
            if (this.media.label == stream.media.label)
            {
                return null;
            }
        
            var streams = {};
            streams[this.media.label] = this;
            streams[stream.media.label] = stream;

            var vr = new YtVideoRequest();
        
            vr.init(streams[vi], streams[au]);
        
            return vr;
        },

        // returns {Boolean}
        isComplete: function()
        {
            return (!this.media) || (this.media.label == av);
        },

        // returns {MediaRequest}
        toRequest: function()
        {
            let vr = new antvd.DefaultMediaRequest();

            vr.init(this.uri, this.origin, this.length, this.ctype);

            return vr;
        },

        // @returns {String}
        toString: function()
        {
            return "Complete: " + (this.isComplete() ? "true" : "false")
                + "\nLength: " + ((this.length >= 0) ? this.length : "N/A")
                + "\nType: " + (this.ctype ? this.ctype : "N/A")
                + "\nUri: " + this.uri.spec;
        }
    };

    (function(me)
     {
        // Create a stream
        //
        // static
        // param {Document} origin Request initiator
        // param {nsIChannel} channel Underlying request
        // returns {YtStream?}
        me.create = function(origin, channel)
        {
            const reTagExpr = /itag=(\d+)/i;
            const reIdExpr = /id=([^&#]+)/i;
            const reRangeExpr = /range=[^&#]+/i;
            
            // type String
            var url = channel.URI.spec;
            var tagMatch = reTagExpr.exec(url);
        
            if (!tagMatch || (tagMatch.length != 2))
            {
                return null;
            }

            var idMatch = reIdExpr.exec(url);
            
            if (!idMatch || (idMatch.length != 2))
            {
                return null;
            }

            var id = idMatch[1];
            var tag = Number(tagMatch[1]);

            
            // type String
            var unboundUrl = url.replace(reRangeExpr, "").replace("&&", "&");

            let stream = new YtStream();
            
            stream.ctype    = channel.contentType;
            stream.uri      = NetUtil.newURI(unboundUrl);
            stream.origin   = origin;
            stream.id       = id;
            stream.tag      = tag;
            stream.name     = origin.title;
            stream.media    = getCodecForTag(tag);
            
            return stream;
        };

        // returns {YtStream~StreamInfo}
        var getCodecForTag = function(tag)
        {
            const media =
            {
                18:     { label: av, br: "360p-MP4"     },
                43:     { label: av, br: "360p-WEBM"    },

                133:    { label: vi, br: "240p"         },
                134:    { label: vi, br: "360p"         },
                135:    { label: vi, br: "480p"         },
                136:    { label: vi, br: "720p"         },
                137:    { label: vi, br: "1024p"        },
                138:    { label: vi, br: "2160p"        },
                140:    { label: au                     },
                160:    { label: vi, br: "144p"         },
                171:    { label: au },

                242:    { label: vi, br: "360p-WEBM"    },
                243:    { label: vi, br: "360p-WEBM"    },
                244:    { label: vi, br: "480p-WEBM"    },
                247:    { label: vi, br: "720p-WEBM"    },
                248:    { label: vi, br: "1080p-WEBM"   },
                250:    { label: au },
                251:    { label: au },
                264:    { label: vi, br: "1440p"        },
                266:    { label: vi, br: "1440p"        },
                271:    { label: vi, br: "2160p-WEBM"   },
                278:    { label: vi, br: "144p-WEBM"    },
                298:    { label: vi, br: "720p60"       },
                299:    { label: vi, br: "1080p"        },
                
                302:    { label: vi, br: "720p"         },
                303:    { label: vi, br: "1080p"        },
                313:    { label: vi, br: "2160p-WEBM"   }
            };
            
            return media[tag];
        };
        
    })(YtStream);

    // class YtSearchStrategy
    // implements ISearchStrategy
    antvd.YtSearchStrategy = function()
    {
        const rePage = /.*?youtube\.com/i;
        const reHost = /.*?googlevideo\.com/i;
        const domContentLoadedEventName = "DOMContentLoaded";

        // type Array.<YtStream>
        var streams = [];

        // ISearchStrategy implementation

        // member isApplicable
        // param {Document} document
        // param {nsIHttpChannel} channel
        // returns {Boolean}
        this.isApplicable = function(document, channel)
        {
            var docUri = document.documentURIObject;
            var reqUri = channel.URI;
            let _skip = false;
            
            _skip = (docUri != null && docUri.spec.indexOf("mpd_version") != -1) ||
                    (reqUri != null && reqUri.spec.indexOf("mpd_version") != -1);
            
            if (_skip == true)
            {
                return false;
            }

            try
            {
                if (docUri.host.match(rePage))
                {
                    return true;
                }
            }
            catch (e)
            {}

            try
            {
                // document's uri could be 'about:blank' and so on
                // in that case the `host accessor will throw an exception
                if (reqUri.host.match(reHost))
                {
                    return true;
                }
            }
            catch (e)
            {}

            return false;
        };

        // member search
        // param {Document} document Owning document
        // param {nsIHttpChannel} channel Request's channel to analyze
        // param {Function} found  See {AntGrabber#foundFlvLink} for details
        // returns {undefined} nothing
        this.search = function(document, channel, found)
        {
            if (!document || !channel || !found)
            {
                return;
            }

            var requestUri = channel.URI;
            
            if ( ! requestUri.host.match(reHost) || (channel.requestMethod != "GET") )
            {
                return;
            }

            if (channel.contentType == "text/plain")
            {
                return;
            }

            var sr = YtStream.create(document, channel);
            
            if ( ! sr )
            {
                return;
            }

            // Save the stream for the future use
            var streams = AntTabMan.getAntData(document).ytstreams;
            
            for (let s in streams)
            {
                if (sr.equal(streams[s]))
                {
                    return;
                }
            }

            antvd.AntLib.toLog(
                "YtSearchStrategy.search (yt.js)",
                "Created and pushed stream instance" +
                "\nctype...." + sr.ctype +
                "\nuri......" + sr.uri.spec +
                "\nid......." + sr.id +
                "\ntag......" + sr.tag +
                "\nname....." + sr.name
            );

            streams.push(sr);
            
            sr.asyncFetch(function()
            {
                if (sr.isComplete())
                {
                    found(sr.toRequest());
                    return;
                }

                // Check whether there is a matching stream detected
                for (let s in streams)
                {
                    if (!streams[s].isInitialized)
                    {
                        continue;
                    }
                
                    let vr = sr.join(streams[s]);
                
                    if (vr)
                    {
                        found(vr);
                    }
                }
            });
        };
    };

    return antvd;

})(antvd);
