/**
 * yt.js, 2013
 * @author Igor Chornous ichornous@heliostech.hk
 */

/**
 * @namespace antvd
 */
var antvd = (function(antvd) {
    if (!antvd.AntLib)
        antvd.AntLib = AntLib;

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

    // {{{ YtVideoRequest

    /**
     * @class YtVideoRequest
     */
    var YtVideoRequest = function() {};

    YtVideoRequest.prototype = {
        /** @public */ get displayName() {
            return this._base.displayName;
        },
        /** @public */ get size() {
            return this._base.size;
        },

        /** @private @type YtStream*/ _video: null,
        /** @private @type YtStream*/ _audio: null,
        /** @private */ _id: null,
        /** @private */ _tag: null,

        /**
         * @since 2.4.7.23
         * @private
         * @type MediaRequest
         */
        _base: null,

        /**
         * @member init
         * @param {YtStream} video
         * @param {YtStream} audio
         */
        init: function(video, audio) {
            this._base = new antvd.MediaRequest(
                video.origin.documentURIObject
                , video.origin.referrer
                , YtVideoRequest.getCleanName(video.name)
                , video.length + audio.length);
            this._base.addStream(video.uri);
            this._base.addStream(audio.uri);

            this._video = video;
            this._audio = audio;
            this._id = video.id;
            this._tag = video.tag;
        },

        /**
         * Downloads remote media to the local disk
         *
         * @member download
         * @param {MediaLibrary} library
         * @returns {Promise}
         */
        download: function(library) {
            /** @type YtVideoRequest */
            let ctx = this;
            let converterConf = antvd.ConverterPackage.getDefault();
            try {
                library.ensureConfigured();
                converterConf.ensureConfigured();
            } catch (ex) {
                return Promise.reject(ex);
            }

            return Task.spawn(function () {
                /** @type DownloadResult */ let svideo = null;
                /** @type DownloadResult */ let saudio = null;
                try {
                    let vdr = library.download(
                        ctx._video.uri, YtVideoRequest.TEMP_FILE_NAME, true);
                    let adr = library.download(
                        ctx._audio.uri, YtVideoRequest.TEMP_FILE_NAME, true);

                    svideo = yield vdr;
                    ctx._base.setStreamMetadata(
                        svideo.source
                        ,{
                            size: svideo.size,
                            time: svideo.downloadTime
                        });

                    saudio = yield adr;
                    ctx._base.setStreamMetadata(
                        saudio.source
                        ,{
                            size: saudio.size,
                            time: saudio.downloadTime
                        });
                } catch (ex) {
                    antvd.AntLib.logError("Failed to download streams", ex);
                    throw ex;
                }

                let converter = new antvd.Converter(converterConf);
                converter.setName(ctx._getFileName());

                try {
                    yield converter.join(svideo.target, saudio.target);
                } catch (ex) {
                    antvd.AntLib.logError("Failed to convert media", ex);
                    throw ex;
                }

                try {
                    yield library.save({
                        uri: converter.getUri(),
                        filename: converter.getFileName(),
                        origin: {
                            url: ctx._base._originUrl,
                            title: ctx.displayName
                        }
                    });
                    converter.finalize();
                } finally {
                    try {
                        /**
                         * TODO(Igor): Add a shared function which would perform
                         * the "nothrow" removal
                         */
                        FileUtils.File(svideo.target).remove(false);
                        FileUtils.File(saudio.target).remove(false);
                    } catch (_e0) {
                        antvd.AntLib.toLog("Failed to cleanup temporary files:"
                                           + "\nError: " + _e0);
                    }
                }
            });
        },

        /**
         * @member reportDownload
         * @returns {Promise}
         */
        reportDownload: function() {
            return this._base.reportDownload();
        },

        /** @deprecated To be renamed to 'equals' */
        compare: function(request) {
            if (!request)
                return false;
            return (request._id == this._id) && (request._tag == this._tag);
        },

        release: function() {},

        /**
         * @private
         * @member getFileName
         */
        _getFileName: function(extension) {
            return antvd.AntLib.mangleFileName(
                YtVideoRequest.getCleanName(this.displayName)
                , extension);
        }
    };

    /**
     * @static
     * @member getCleanName
     * @param {String} dirtyName
     */
    YtVideoRequest.getCleanName = function(dirtyName) {
        return antvd.AntLib.sanitize(dirtyName)
            .replace(/[,:()\[\]"'.`~▶]/ig,"")
            .trim();
    };

    /** @const */
    YtVideoRequest.TEMP_FILE_NAME = "stream";
    // }}}

    // {{{ YtStream class
    /**
     * @typedef YtStream~StreamInfo
     * @property {String} label
     * @property {String} br
     */
    /**
     * @class YtStream
     */
    function YtStream() { };

    YtStream.prototype = {
        /** @type String */ id: null,
        /** @type Number */ tag: null,
        /** @type Document */ origin: null,
        /** @type nsIURI */ uri: null,
        /** @type Number */ length: null,
        /** @type String */ ctype: null,
        /** @type String */ name: null,
        /** @type Boolean */ isInitialized: false,
        /** @type YtStream~StreamInfo */ media: null,

        /**
         * @member asyncFetch
         * @param {Function} complete Callback to be called in case of success
         */
        asyncFetch: function(complete) {
            /** @type YtStream */ var ctx = this;
            let hr = new XMLHttpRequest();
            hr.onreadystatechange = function() {
                if (hr.readyState == 4) {
                    let clength = -1;
                    try {
                        clength = Number(hr.getResponseHeader("Content-Length"));
                    } catch (ex) {
                        antvd.AntLib.logError(
                            "Failed to acquire the size of a stream", ex);
                    }
                    let ctype = null;
                    try {
                        ctype = hr.getResponseHeader("Content-Type");
                    } catch (ex) {
                        antvd.AntLib.logError(
                            "Failed to acquire content type a stream", ex);
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

        /**
         * @member equal
         * @param {YtStream} stream
         * @returns {Boolean} Whether the objects point to the same stream
         */
        equal: function(stream) {
            if (this == stream)
                return true;
            return (stream.id == this.id) && (stream.tag == this.tag);
        },

        /**
         * @member join
         * @param {YtStream} stream
         * @returns {YtVideoRequest}
         */
        join: function(stream) {
            if (this.equal(stream))
                return null;
            if ((stream.id != this.id) || (stream.origin != this.origin))
                return null;
            if (!this.media || !stream.media)
                return null;
            if (this.media.label == stream.media.label)
                return null;
            var streams = {};
            streams[this.media.label] = this;
            streams[stream.media.label] = stream;

            var vr = new YtVideoRequest();
            vr.init(streams[vi], streams[au]);
            return vr;
        },

        /**
         * @member isComplete
         * @returns {Boolean}
         */
        isComplete: function() {
            return (!this.media) || (this.media.label == av);
        },

        /**
         * @member createRequest
         * @returns {MediaRequest}
         */
        toRequest: function() {
            let vr = new antvd.DefaultMediaRequest();
            vr.init(this.uri, this.origin, this.length, this.ctype);
            return vr;
        },

        /**
         * @member toString
         * @returns {String}
         */
        toString: function() {
            return "Complete: " + (this.isComplete() ? "true" : "false")
                + "\nLength: " + ((this.length >= 0) ? this.length : "N/A")
                + "\nType: " + (this.ctype ? this.ctype : "N/A")
                + "\nUri: " + this.uri.spec;
        }
    };

    /**
     * @ignore
     */
    (function(me) {
        /**
         * Create a stream
         *
         * @static
         * @param {Document} origin Request initiator
         * @param {nsIChannel} channel Underlying request
         * @returns {YtStream?}
         */
        me.create = function(origin, channel) {
            const reTagExpr = /itag=(\d+)/i;
            const reIdExpr = /id=([^&#]+)/i;
            /** @type string */
            var url = channel.URI.spec;

            var tagMatch = reTagExpr.exec(url);
            if (!tagMatch || (tagMatch.length != 2)) {
                return null;
            }

            var idMatch = reIdExpr.exec(url);
            if (!idMatch || (idMatch.length != 2)) {
                return null;
            }

            var id = idMatch[1];
            var tag = Number(tagMatch[1]);

            const reRangeExpr = /range=[^&#]+/i;
            /** @type string */
            var unboundUrl = url.replace(reRangeExpr, "")
                    .replace("&&", "&");

            let stream = new YtStream();
            stream.uri = NetUtil.newURI(unboundUrl);
            stream.origin = origin;
            stream.length = -1;
            stream.id = id;
            stream.tag = tag;
            stream.name = origin.title;
            stream.media = getCodecForTag(tag);
            return stream;
        };

        /**
         * @private
         * @returns {YtStream~StreamInfo}
         */
        var getCodecForTag = function(tag) {
            const media = {
                18: {label: av, br: "360p-MP4"},
                43: {label: av, br: "360p-WEBM"},
                140: {label: au},
                160: {label: vi, br: "144p"},
                133: {label: vi, br: "240p"},
                134: {label: vi, br: "360p"},
                135: {label: vi, br: "480p"},
                136: {label: vi, br: "720p"},
                137: {label: vi, br: "1024p"},
                264: {label: vi, br: "1440p"},
                138: {label: vi, br: "2160p"}
            };
            return media[tag];
        };
    })(YtStream);
    // }}}

    // {{{ YtSearchStrategy

    /**
     * @class YtSearchStrategy
     * @implements ISearchStrategy
     */
    antvd.YtSearchStrategy = function()
    {
        const rePage = /.*?youtube\.com/i;
        const reHost = /.*?googlevideo\.com/i;
        const domContentLoadedEventName = "DOMContentLoaded";

        /**
         * @private
         * @type Array.<YtStream>
         */
        var streams = [];

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
                if (docUri.host.match(rePage))
                    return true;
            }
            catch (e) { }

            try
            {
                // document's uri could be 'about:blank' and so on
                // in that case the `host accessor will throw an exception
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
         * @param {Function} found  See {AntGrabber#foundFlvLink} for details
         * @returns {undefined} nothing
         */
        this.search = function(document, channel, found)
        {
            if (!document || !channel || !found)
            {
                // TODO(Igor): Notify error
                return;
            }

            var requestUri = channel.URI;
            if (!requestUri.host.match(reHost)
                || (channel.requestMethod != "GET"))
                return;

            var sr = YtStream.create(document, channel);
            if (!sr)
                return;

            /** Save the stream for the future use */
            var streams = AntTabMan.getAntData(document).ytstreams;
            for (let s in streams) {
                if (sr.equal(streams[s]))
                    return;
            }

            streams.push(sr);
            sr.asyncFetch(function() {
                if (sr.isComplete()) {
                    found(sr.toRequest());
                    return;
                }

                // Check whether there is a matching stream detected
                for (let s in streams) {
                    if (!streams[s].isInitialized)
                        continue;
                    let vr = sr.join(streams[s]);
                    if (vr)
                        found(vr);
                }
            });
        };
        // }}}
    };

    // }}}

    return antvd;
})(antvd);
