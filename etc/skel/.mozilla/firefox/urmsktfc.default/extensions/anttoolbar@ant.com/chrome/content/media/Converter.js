/**
 * Converter.js, 2014
 * @author Igor Chornous ichornous@heliostech.hk
 * @namespace antvd
 */
var antvd = (function(antvd) {
    Components.utils.import("resource://gre/modules/Promise.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import("resource://gre/modules/Services.jsm");
    if (!antvd.AntLib)
        antvd.AntLib = AntLib;

    const Cc = Components.classes;
    const Ci = Components.interfaces;
    const Cr = Components.results;

    /**
     * @class MediaConverterError
     * @param {Number} code
     * @param {Object} cause
     */
    function MediaConverterError(code, cause) {
        /** @type Number */
        this.code = code;
        /** @type Object */
        this.cause = cause;
    };

    MediaConverterError.prototype = {
        /**
         * @member toString
         * @returns {String}
         */
        toString: function() {
            /** @type String */
            let message;
            if (this.code == MediaConverterError.E_JOIN_MISSING_INPUT) {
                message = "Missing input";
            } else if (this.code == MediaConverterError.E_CONV_FAILURE) {
                message = "Conversion failed";
            } else if (this.code == MediaConverterError.E_IO_FAILURE) {
                message = "IO failure";
            } else if (this.code == MediaConverterError.E_SETUP_FAILURE) {
                message = "Bad configuration";
            } else if (this.code == MediaConverterError.E_UNEXPECTED_ERROR) {
                message = "Runtime error";
            } else {
                message = "Unexpected error";
            }

            if (this.cause) {
                message = message + ". Caused by " + this.cause;
            }
            return message;
        }
    };

    MediaConverterError.E_JOIN_MISSING_INPUT = 1;
    MediaConverterError.E_CONV_FAILURE = 2;
    MediaConverterError.E_UNEXPECTED_ERROR = 3;
    MediaConverterError.E_IO_FAILURE = 4;
    MediaConverterError.E_SETUP_FAILURE = 5;

    // {{{ 'Converter' class
    /**
     * Proxy to avconv
     *
     * @class Converter
     * @param {ConverterPackage} conf Configuration object
     */
    function Converter(conf)
    {
        /**
         * @private
         * @name ctx
         * @type Converter
         */
        var ctx = this;

        /**
         * @private
         * @name fileName
         * @type String
         */
        var fileName = null;

        /**
         * @private
         * @name output
         * @type nsIFile
         */
        var output = null;

        /**
         * @member setName
         * @param {String} name
         */
        this.setName = function(name) {
            fileName = name;
        };

        // {{{ 'join' public method
        /**
         * Merge audio and video streams into an mpeg media container.
         * Prior to the transcoding step the method ensures that the input files
         * exist on disk, otherwise the operation is rejected with the code
         * E_JOIN_MISSING_INPUT
         *
         * @member join
         * @param {String} video video stream source
         * @param {String} audio audio stream source
         * @returns {Promise} Async result of the conversion procedure
         */
        this.join = function(video, audio)
        {
            try {
                /** The both calls to FileUtils.File may throw
                 if either video or audio contains an invalid path */
                if (!FileUtils.File(video).exists()
                    || !FileUtils.File(audio).exists()) {
                    antvd.AntLib.toLog(
                        "[Converter] Either of streams is missing on the disk:"
                            + "\nVideo: " + video
                            + "\nAudio: " + audio);
                    return Promise.reject(
                        new MediaConverterError(
                            MediaConverterError.E_JOIN_MISSING_INPUT));
                }
            } catch (ex) {
                antvd.AntLib.logError(
                    "Failed to probe for input streams:"
                    + "\nVideo: " + video
                    + "\nAudio: " + audio
                    , ex);
                return Promise.reject(
                    new MediaConverterError(
                        MediaConverterError.E_UNEXPECTED_ERROR, ex));
            }

            /** @type nsIFile*/
            let file = null;
            try {
                file = FileUtils.getFile(
                    "TmpD"
                    , ["output." + Converter.EXT_MP4]);
                file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
                output = file;
            } catch (ex) {
                antvd.AntLib.logError("[Converter]: Failed to create an output file"
                                      + (file ? (":\nPath" + file.path) : "")
                                      , ex);

                return Promise.reject(
                    new MediaConverterError(
                        MediaConverterError.E_IO_FAILURE, ex));
            }

            let args = [
                "-y"
                , "-i"
                , video
                , "-i"
                , audio
                , "-map"
                , "0:v"
                , "-map"
                , "1:a"
                , "-codec"
                , "copy"
                , output.path
            ];
            return run(args);
        };
        // }}}

        /**
         * @member getUri
         * @returns {nsIURI} Uri of the converted file
         */
        this.getUri = function() {
            if (!output) {
                antvd.AntLib.toLog(
                    "[Converter]: Attempt to aquire the file's uri out of order");
                throw new MediaConverterError(
                    MediaConverterError.E_UNEXPECTED_ERROR);
            }

            return Services.io.newFileURI(output);
        };

        /**
         * @member getFileName
         * @returns {String} Name of the converted file
         *                   This one basically is the same as the value assigned
         *                   through a call to setName. Though it may differ in
         *                   extension
         */
        this.getFileName = function() {
            return fileName + "." + Converter.EXT_MP4;
        };

        /**
         * @member finalize
         */
        this.finalize = function() {
            try {
                if (output)
                    output.remove(false);
            } catch (ex) { }
            output = null;
        };

        // {{{ 'run' private method
        /**
         * Executes avconv with the given arguments
         *
         * @private
         * @member run
         * @param {Array.<String>} args Argument list
         * @returns {Promise} To be resolved when the application terminates
         */
        var run = function(args)
        {
            /** @type nsIFile */ let avconvFile = null;
            try {
                avconvFile = conf.getConvExecutable();
            } catch (ex) {
                antvd.AntLib.logError(
                    "[Converter]: Failed to acquire the transcoder's path"
                    , ex);
                return Promise.reject(
                    new MediaConverterError(
                        MediaConverterError.E_SETUP_FAILURE, ex));
            }

            /** @type nsIProcess */
            let process = null;
            try {
                process = Cc["@mozilla.org/process/util;1"]
                    .createInstance(Ci.nsIProcess);
                process.init(avconvFile);
            } catch (ex) {
                antvd.AntLib.logError(
                    "[Converter] Failed to initialize the process"
                    , ex);
                return Promise.reject(
                    new MediaConverterError(
                        MediaConverterError.E_UNEXPECTED_ERROR, ex));
            }

            let deferred = Promise.defer();
            // go
            try {
                antvd.AntLib.toLog("[Converter] Cmd: "
                             + avconvFile.path + " " + args.join(" "));
                /** @type nsIObserver */
                let callback = {
                    observe: function(aSubject, aTopic, aData)
                    {
                        antvd.AntLib.toLog(
                            "[Converter]Exit code: " + process.exitValue);
                        conf.updateSuccessRate(!process.exitValue);
                        if (!process.exitValue) {
                            deferred.resolve();
                        } else {
                            deferred.reject(new MediaConverterError(
                                MediaConverterError.E_CONV_FAILURE
                                , process.exitValue));
                        }
                    }
                };
                process.runAsync(args, args.length, callback, false);
            } catch (ex) {
                antvd.AntLib.logError(
                    "[Converter] Failed to launch the process", ex);
                return Promise.reject(new MediaConverterError(
                    MediaConverterError.E_UNEXPECTED_ERROR, ex));
            }

            return deferred.promise;
        };
        // }}}
    };
    // }}}

    Converter.EXT_MP4 = "mp4";

    // Push objects
    /** @expose */ antvd.Converter = Converter;
    /** @expose */ antvd.MediaConverterError = MediaConverterError;
    return antvd;
})(antvd);
