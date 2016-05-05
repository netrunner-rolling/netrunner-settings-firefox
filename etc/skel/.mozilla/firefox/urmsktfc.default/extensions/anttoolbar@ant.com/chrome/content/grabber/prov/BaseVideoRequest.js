/**
 * BaseVideoRequest.js, 2013
 * @author ICh
 */

/**
 * @namespace antvd
 */
var antvd = (function(antvd)
{
    if (!antvd.AntLib)
    {
        antvd.AntLib = AntLib;
    }

    Components.utils.import("resource://gre/modules/Promise.jsm");

    /**
     * @class MediaRequest
     * @param {nsIURI} originUri Uri of the origin document
     * @param {String} referrerUrl Referrer
     * @param {String?} name Optional display name
     * @param {Number?} size Optional size hint
     */
    function MediaRequest(originUri, referrerUrl, name, size)
    {
        this._originUrl = originUri.asciiSpec;
        this._referrerUrl = referrerUrl;
        this.displayName = name;
        this.size = size;
        this._streams = {};
    };

    MediaRequest.prototype =
    {
        /**
         * Named to be printed in the UI
         *
         * @type String
         */
        displayName: null,

        /**
         * Content size hint. Not used anywhere except for the UI
         *
         * @type Number
         */
        size: null,

        /**
         * Origin url. Must not be null
         *
         * @private
         * @type String
         */
        _originUrl: null,

        /**
         * Referrer
         *
         * @private
         * @type String
         */
        _referrerUrl: null,

        /**
         * @private
         * @type Object.<String,RpcMediaDownload~StreamStream>
         */
        _streams: {},

        /**
         * @member addStream
         * @param {nsIURI} uri Uri of the stream
         */
        addStream: function(uri) {
            this._streams[uri.spec] = {uri: uri};
        },

        /**
         * @member setStreamMetadata
         * @param {nsIURI} uri
         * @param {Number} meta.time
         * @param {Number} meta.size
         * @param {String} meta.type
         */
        setStreamMetadata: function(uri, meta)
        {
            if (meta.time)
            {
                this._streams[uri.spec].time = meta.time;
            }
            
            if (meta.size)
            {
                
                this._streams[uri.spec].size = meta.size;
            }
            
            if (meta.type)
            {
                this._streams[uri.spec].type = meta.type;
            }
        },

        /**
         * @member reportDownload
         * @returns {Promise}
         */
        reportDownload: function()
        {
            /** @type RpcMediaDownload */
            let msg = null;
        
            try
            {
                msg = new antvd.RpcMediaDownload(this._originUrl, this._referrerUrl);

                for (let i in this._streams)
                {
                    msg.addStream(this._streams[i]);
                }
            }
            catch (ex)
            {
                antvd.AntLib.logError("[MediaRequest]: Failed to build an rpc message", ex);
                return Promise.reject(new Error("Unexpected failure"));
            }

            return msg.send();
        }
    };

    /** @expose */ antvd.MediaRequest = MediaRequest;

    /**
     * @class DefaultMediaRequest
     */
    function DefaultMediaRequest() {};
    
    DefaultMediaRequest.prototype =
    {
        /** public */
        get displayName()
        {
            return this._base.displayName;
        },
        
        /** public */
        get size()
        {
            return this._base.size;
        },

        /**
         * @private
         * @type MediaRequest
         */
        _base: null,

        /**
         * @private
         * @type nsIURI
         */
        _streamUri: null,

        /**
         * @private
         * @type String
         */
        _contentType: null,

        /**
         * @member init
         * @param {nsIURI} uri
         * @param {Document} origin
         * @param {Number} size
         * @param {String} [type="video/x-flv"]
         */
        init: function(uri, origin, size, type)
        {
            let cleanName = DefaultMediaRequest.getCleanName(origin.title);
            this._contentType = type ? type : "video/x-flv";

            this._base = new antvd.MediaRequest(
                origin.documentURIObject,
                origin.referrer,
                cleanName,
                size
            );
            
            antvd.AntLib.toLog(
                "DefaultMediaRequest.init (BaseVideoRequest.js)",
                antvd.AntLib.sprintf(
                    "Initialized default media request: clean name -> %s; content type -> %s, document -> %s; stream -> %s",
                    cleanName, this._contentType, origin.documentURIObject, uri.spec
                )
            );

            this._base.addStream(uri);

            if (!type)
            {
                this._base.setStreamMetadata(uri, {type: type});
            }
            
            this._streamUri = uri;
        },

        /**
         * @member download
         * @param {MediaLibrary} library
         * @returns {Promise}
         */
        download: function(library)
        {
            /** @type DefaultMediaRequest */
            let ctx = this;
            var _save_object =
            {
                    uri: this._streamUri,
                    filename: this._getFileName(),
                    origin:
                    {
                        url: this._base.originUrl,
                        title: this.displayName
                    }
            };

            var _then_function = function(dr)
            {
                ctx._base.setStreamMetadata(dr.source, { size: dr.size, time: dr.downloadTime });
                return dr;
            };

            return library.save(_save_object).then(_then_function);
        },

        /**
         * @private
         * @member _getFileName
         */
        _getFileName: function()
        {
            return antvd.AntLib.mangleFileName(
                antvd.AntLib.sanitize(this.displayName),
                antvd.AntLib.deductExtension(this._contentType)
            );
        },

        /**
         * @member reportDownload
         * @returns {Promise}
         */
        reportDownload: function()
        {
            return this._base.reportDownload();
        },

        /**
         * @deprecated To be renamed in 'equals'
         * @member compare
         * @param request
         * @returns {Boolean}
         */
        compare: function(request)
        {
            if (!request || !request._streamUri)
            {
                return false;
            }
            
            try
            {
                return this._streamUri.equals(request._streamUri);
            }
            catch (e)
            {
                throw new Error("Internal failure");
            }
        },

        /**
         * @member release
         */
        release: function() {}
    };

    /**
     * @static
     * @member getCleanName
     * @param {String} dirtyName
     */
    DefaultMediaRequest.getCleanName = function(dirtyName)
    {
        return antvd.AntLib.sanitize(dirtyName).replace(/[,:()\[\]"'.`~▶]/ig,"").trim();
    };

    antvd.DefaultMediaRequest = DefaultMediaRequest;

    return antvd;

})(antvd);
