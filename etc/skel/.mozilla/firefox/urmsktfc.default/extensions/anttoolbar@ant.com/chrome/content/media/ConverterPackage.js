// ConverterPackage.js, 2014-2016
// author       Igor Chornous (ichornous@heliostech.hk)
// contributor  Eugene Dorofeyev (ievgenii.d@webgroup-limited.com)
// namespace    antvd
//

var antvd = (function(antvd)
{
    Components.utils.import("resource://gre/modules/Task.jsm");
    Components.utils.import("resource://gre/modules/Promise.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import("resource://gre/modules/Services.jsm");
    Components.utils.import("resource://gre/modules/osfile.jsm");
    Components.utils.import("resource://gre/modules/Downloads.jsm");
    Components.utils.import("resource://gre/modules/NetUtil.jsm");

    if ( ! antvd.AntLib )
    {
        antvd.AntLib = AntLib;
    }

    const Cc = Components.classes;
    const Ci = Components.interfaces;
    const Cr = Components.results;

    /**
     * @class MediaConverterPackageError
     * @param {Number} code
     * @param {Object} cause
     */
    function MediaConverterPackageError(code, cause)
    {
        // Number
        this.code = code;
        
        // Object
        this.cause = cause;
    };
    
    MediaConverterPackageError.prototype =
    {
        /**
         * @name messages
         * @type Map.<Number,String>
         */
        messages: (function()
        {
            /** @type Map.<Number,String> */
            let arr = {};
            
            arr[MediaConverterPackageError.E_CONF_NOTCONFIGURED]        = "Not configured";
            arr[MediaConverterPackageError.E_CONF_NOFILE]               = "Missing file";
            arr[MediaConverterPackageError.E_CONF_NOTEXECUTABLE]        = "Not executable";
            arr[MediaConverterPackageError.E_SERVICE_UNAVAILABLE]       = "Service unavailable";
            arr[MediaConverterPackageError.E_TEMP_CREATION_FAILURE]     = "Failed to create a temporary file";
            arr[MediaConverterPackageError.E_TARGET_CREATION_FAILURE]   = "Failed to create a file";
            arr[MediaConverterPackageError.E_UNEXPECTED_ERROR]          = "Unexpected error";
            arr[MediaConverterPackageError.E_TARGET_BADHASH]            = "Bad file hash";

            return arr;
        })(),

        /**
         * @name toString
         * @returns {String} Formatted error message
         */
        toString: function()
        {
            let message = this.messages[this.code];
        
            if (!message)
            {
                message = this.messages[MediaConverterPackageError.E_UNEXPECTED_ERROR];
            }

            if (this.cause)
            {
                message += "\nInternal error: " + this.cause;
            }

            return message;
        }
    };

    MediaConverterPackageError.E_CONF_NOTCONFIGURED         = 1;
    MediaConverterPackageError.E_CONF_NOFILE                = 2;
    MediaConverterPackageError.E_CONF_NOTEXECUTABLE         = 3;
    
    // Setup
    MediaConverterPackageError.E_SERVICE_UNAVAILABLE        = 4;
    MediaConverterPackageError.E_UNEXPECTED_ERROR           = 5;
    
    // TODO(Igor): I guess, the next errors should be handled in the UI
    MediaConverterPackageError.E_TEMP_CREATION_FAILURE      = 6;
    MediaConverterPackageError.E_TARGET_CREATION_FAILURE    = 7;
    MediaConverterPackageError.E_TARGET_BADHASH             = 8;
    MediaConverterPackageError.E_INSTALL_IN_PROGRESS        = 9;

    /**
     * Converter configuration object
     *
     * @class ConverterPackage
     */
    function ConverterPackage()
    {
        // @type ConverterPackage
        var ctx = this;

        /**
         * Name of the avconv path pref
         *
         * @private
         * @name avconvPathOption
         * @type String
         */
        const avconvPathOption = "extensions.anttoolbar.avconv";

        /**
         * Name of the success rate path pref
         *
         * @private
         * @type String
         */
        const avconvSuccessPathOption = "extensions.anttoolbar.avconvsuccess";

        /**
         * @private
         * @name avconvUrlOption
         * @type String
         */
        const avconvUrlOption = "extensions.anttoolbar.avconvUrl";

        /**
         * @private
         * @type String
         * @name convTargetDir
         */
        const convTargetDir = OS.Constants.Path.profileDir;

        /**
         * @private
         * @type String
         * @name convIntermediateDir
         */
        const convIntermediateDir = OS.Constants.Path.tmpDir;

        /**
         * @private
         * @name prefStorage
         * @type nsIPrefBranch
         */
        var prefStorage = Services.prefs;

        /**
         * @private
         * @type Boolean
         */
        let _isInstallInProgress = false;

        /**
         * Saves the user specified location of avconv
         *
         * @member setAvconvLocation
         * @param {nsILocalFile} file Reference to the location of a media encoder
         */
        this.setAvconvLocation = function(file)
        {
            prefStorage.setComplexValue(avconvPathOption, Ci.nsILocalFile, file);
        };

        /**
         * Retrieves the location of avconv
         *
         * @member getAvconvLocation
         * @returns {nsILocalFile} Reference to a transcoder
         */
        this.getAvconvLocation = function()
        {
            return prefStorage.getComplexValue(avconvPathOption, Ci.nsILocalFile);
        };

        /**
         * @member ensureConfigured
         * @throws MediaConverterPackageError
         */
        this.ensureConfigured = function()
        {
            ctx.getConvExecutable();
        };

        /**
         * @member getConvExecutable
         * @returns {nsILocalFile} File reference to the configured transcoder
         * @throws MediaConverterPackageError
         *   E_CONF_NOTCONFIGURED: The converter's path is not specified
         *   E_CONF_NOFILE: File set as the converter doesn't exist
         *   E_CONF_NOTEXECUTABLE: File set as the converter is not an executable
         */
        this.getConvExecutable = function()
        {
            /** @type nsILocalFile */
            let file = null;
            let avconvLocationExists = true;
            let avconvLocation = null;
            let _error = null;
            
            try
            {
                file = ctx.getAvconvLocation();
            }
            catch (ex)
            {
                _error = ex;
                avconvLocationExists = false;
            }
            
            if ( avconvLocationExists == false )
            {
                // Check whether converter executable exists in profile directory
                // If exists, then update avconv setting in FF
                let deployedFilePathLinux = OS.Path.join(convTargetDir, "ffmpeg");
                let deployedFilePathWin32 = OS.Path.join(convTargetDir, "ffmpeg.exe");

                // ATTENTION! You *must* first check for Windows ffmpeg.exe path!
                // FF API OS.File.exists() will return TRUE even for Linux path on Windows!
                
                if ( FileUtils.File(deployedFilePathWin32).exists() )
                {
                    avconvLocation = deployedFilePathWin32;
                }
                else if ( FileUtils.File(deployedFilePathLinux).exists()  )
                {
                    avconvLocation = deployedFilePathLinux;                    
                }
                else
                {
                    antvd.AntLib.logError("ConverterPackage.getConvExecutable (ConverterPackage.js)", "ffmpeg/ffmpeg.exe were not found on disk", null);                    
                    throw new MediaConverterPackageError(MediaConverterPackageError.E_CONF_NOTCONFIGURED, _error);
                }
                
                file = FileUtils.File(avconvLocation);
                this.setAvconvLocation(file);
            }

            if (file.exists() == false)
            {
                antvd.AntLib.logError("ConverterPackage.getConvExecutable (ConverterPackage.js)", file.path + " was not found on disk", null);                    
                throw new MediaConverterPackageError(MediaConverterPackageError.E_CONF_NOFILE);
            }

            if (file.isExecutable() == false)
            {
                antvd.AntLib.logError("ConverterPackage.getConvExecutable (ConverterPackage.js)", file.path + " is not executable", null);                    
                throw new MediaConverterPackageError(MediaConverterPackageError.E_CONF_NOTEXECUTABLE);
            }

            return file;
        };

        // Calculates the md5 f or the converter's executable
        //
        // @member getConvHash
        // @returns {Promise<String>}
        this.getConvHash = function()
        {
            /** @type nsILocalFile */
            let file = null;
            
            try
            {
                file = ctx.getConvExecutable();
            }
            catch (ex)
            {
                // getConvExecutable() logs messages
                return Promise.reject(ex);
            }
            
            return antvd.FileUtils.getFileHash(file);
        };

        // Read from the configuration storage the conversion success rate
        //
        // @member getSuccessRate
        this.getSuccessRate = function()
        {
            let result =
            {
                success: 0,
                failure: 0
            };
            
            try
            {
                let payloadStr = prefStorage.getCharPref(avconvSuccessPathOption);
                let payload = JSON.parse(payloadStr);
            
                if (payload.success)
                {
                    result.success = payload.success;
                }
            
                if (payload.failure)
                {
                    result.failure = payload.failure;
                }
            }
            catch (ex)
            {}
            
            return result;
        };

        /**
         * For internal usage only
         *
         * @member updateSuccessRate
         * @param {Boolean} issuccess
         * @todo Make this member private and move execution
         *       checks in this module from Converter.js
         */
        this.updateSuccessRate = function(issuccess)
        {
            let successRate = ctx.getSuccessRate();
        
            if (issuccess)
            {
                successRate.success += 1;
            }
            else
            {
                successRate.failure += 1;
            }
            
            try
            {
                prefStorage.setCharPref(avconvSuccessPathOption, JSON.stringify(successRate));
            }
            catch (ex)
            {
                antvd.AntLib.logError("ConverterPackage.updateSuccessRate (ConverterPackage.js)", "Failed to store converter success rate", ex);
            }
        };

        /**
         * Download a converter and configure related subsystems
         *
         * @member install
         * @returns {Promise} Resolves when the deployment is completed
         *   The promise can be rejected with
         *    {@link MediaConverterPackageError}
         *    Here is the list of possible error codes:
         *     E_UNEXPECTED_ERROR:          Program bug or an unexpected issue, probably QA missed it
         *     E_TEMP_CREATION_FAILURE:     Failed to create a file in the temporary file directory
         *     E_TARGET_CREATION_FAILURE:   Failed to create an executable file in the user's profile directory
         *     E_SERVICE_UNAVAILABLE:       Failed to acquire mandatory info from the server
         *     E_TARGET_BADHASH:            The hash computed for a downloaded file doesn't match the one provided by the server
         *     E_INSTALL_IN_PROGRESS:       If there is an ongoing install task
         */
        this.install = function()
        {
            if (_isInstallInProgress)
            {
                return Promise.reject(new MediaConverterPackageError(MediaConverterPackageError.E_INSTALL_IN_PROGRESS));
            }

            _isInstallInProgress = true;

            let promise = Task.spawn(function ()
            {
                /** @type nsIURI */
                let uri = null;
            
                try
                {
                    uri = getConvUrl();
                }
                catch (ex)
                {
                    antvd.AntLib.logError("ConverterPackage.install (ConverterPackage.js)", "Failed to get conv URL", ex);
                    throw new MediaConverterPackageError(MediaConverterPackageError.E_UNEXPECTED_ERROR, ex);
                }

                /** @type ConverterPackage~AvconvFileInfo */
                let targetFileInfo = null;
                
                try
                {
                    targetFileInfo = yield getConvTargetFileName(uri);
                    
                    antvd.AntLib.toLog("ConverterPackage.install (ConverterPackage.js)", "Converter: " + targetFileInfo.filename + " (hash " + targetFileInfo.hash + ")");
                }
                catch (ex)
                {
                    antvd.AntLib.logError("ConverterPackage.install (ConverterPackage.js)", "Failed to get conv info", ex);
                    throw new MediaConverterPackageError(MediaConverterPackageError.E_SERVICE_UNAVAILABLE);
                }

                // Save the content to a temporary file
                
                // type String
                let targetPath = OS.Path.join(convIntermediateDir, targetFileInfo.filename);

                // type nsIFile
                let targetFile = null;

                try
                {
                    targetFile = FileUtils.File(targetPath);
                    targetFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);

                    antvd.AntLib.toLog("ConverterPackage.install (ConverterPackage.js)", "Created temporary file " + targetFile.path);
                }
                catch (ex)
                {
                    antvd.AntLib.logError("ConverterPackage.install (ConverterPackage.js)", "Failed to create temporary file " + targetPath, ex);
                    throw new MediaConverterPackageError(MediaConverterPackageError.E_TEMP_CREATION_FAILURE);
                }

                try
                {
                    let list = yield Downloads.getList(Downloads.ALL);

                    // type Download
                    let download = yield Downloads.createDownload({ source: uri, target: targetFile, saver: "copy" });

                    yield list.add(download);

                    try
                    {
                        download.start();
                        yield download.whenSucceeded();
                    }
                    catch (ex)
                    {
                        antvd.AntLib.logError("ConverterPackage.install (ConverterPackage.js)", "Failed to download converter from " + download.source.url, ex);
                        throw new MediaConverterPackageError(MediaConverterPackageError.E_SERVICE_UNAVAILABLE);
                    }
                    finally
                    {
                        clear(uri);
                        yield list.remove(download);
                    }

                    // Check whether the downloaded file is indeed the converter we're distributing
                    if (targetFileInfo.hash)
                    {
                        // type String
                        let fileHash = null;

                        try
                        {
                            fileHash = yield antvd.FileUtils.getFileHash(targetFile);
                        }
                        catch (ex)
                        {
                            antvd.AntLib.logError("ConverterPackage.install (ConverterPackage.js)", "Failed to calculate hash for " + targetFile.path, ex);
                            throw new MediaConverterPackageError(MediaConverterPackageError.E_UNEXPECTED_ERROR, ex);
                        }

                        antvd.AntLib.toLog(
                            "ConverterPackage.install (ConverterPackage.js)",
                            "Converter file validation\n       genue hash: " + targetFileInfo.hash + "\non-disk file hash: " + fileHash
                        );

                        if (targetFileInfo.hash != fileHash)
                        {
                            // Probably the connection has been interrupted or the file is not genuine
                            antvd.AntLib.logError("ConverterPackage.install (ConverterPackage.js)", "Converter hashes are not equal, installation aborted", null);
                            throw new MediaConverterPackageError(MediaConverterPackageError.E_TARGET_BADHASH);
                        }
                        else
                        {
                            // Store the the hash to be used in secutiry checks and heartbeat records
                        }
                    }

                    // Ready to deploy

                    // type nsILocalFile
                    let deployedFile = null;

                    try
                    {
                        deployedFile = yield saveFileToProfile(targetFile, targetFileInfo.filename, parseInt("0777", 8));
                    }
                    catch (e)
                    {
                        antvd.AntLib.logError("ConverterPackage.install (ConverterPackage.js)", "Failed to deploy converter executable into profile folder", e);
                        throw new MediaConverterPackageError(MediaConverterPackageError.E_TARGET_CREATION_FAILURE, e);
                    }

                    // Update the stored path
                    ctx.setAvconvLocation(deployedFile);

                    antvd.AntLib.toLog("ConverterPackage.install (ConverterPackage.js)", "Converter installed to " + deployedFile.path);
                }
                finally
                {
                    try
                    {
                        targetFile.remove(false);
                        antvd.AntLib.toLog("ConverterPackage.install (ConverterPackage.js)", "Removed temporary file " + targetFile.path);
                    }
                    catch (e)
                    {
                        antvd.AntLib.logWarning("ConverterPackage.install (ConverterPackage.js)", "Temporary file " + targetFile.path + " was not removed", e);
                    }
                }
            });

            promise.then(function() { _isInstallInProgress = false; }, function() { _isInstallInProgress = false; });
            
            return promise;
        };

        /**
         * @typedef ConverterPackage~AvconvFileInfo
         * @property {String} filename Name of the file along with the extension
         * @property {String?} hash MD5 Hash of the file
         */
        /**
         * Ask server for the target application's attributes (filename + extension)
         * A simple head request
         *
         * @private
         * @member getConvTargetFileName
         * @param {nsIURI} uri Service endpoint
         * @returns {Promise<ConverterPackage~AvconvFileInfo>}
         * @resolves Target's filename along with its md5 hash
         * @rejects {@link Error} in case if a network failure occurs.
         */
        var getConvTargetFileName = function(uri)
        {
            let deferred = Promise.defer();
        
            // type RegEx
            const reContentDisposition = /filename="(.*?)"/i;
        
            let hr = new XMLHttpRequest();
        
            hr.onreadystatechange = function()
            {
                if (hr.readyState != 4)
                {
                    return;
                }
                
                try
                {
                    // The server must provide the "Content-Disposition" header
                    // with the filename attribute set to a valid target's file name
                    let hdr = hr.getResponseHeader("Content-Disposition");
                    let match = reContentDisposition.exec(hdr);
                    
                    if ( ! match || (match.length != 2) )
                    {
                        throw new Error("Missing filename");
                    }

                    // type String
                    let hash = hr.getResponseHeader("X-file-hash");
                    
                    if (hash)
                    {
                        // We admit that the hash may not be provided for a reason so try to be non intrusive
                        hash = hash.trim().toLowerCase();
                    }
                    
                    antvd.AntLib.toLog("ConverterPackage.getConvTargetFileName (ConverterPackage.js)", "Fetched hash " + hash + " from " + uri.asciiSpec);

                    deferred.resolve( { filename: match[1], hash: hash } );
                }
                catch (ex)
                {
                    antvd.AntLib.logError("ConverterPackage.getConvTargetFileName (ConverterPackage.js)", "Failed to parse server response ", ex);
                    deferred.reject(new Error("Invalid server response"));
                }
            };

            hr.ontimeout = function()
            {
                antvd.AntLib.logError("ConverterPackage.getConvTargetFileName (ConverterPackage.js)", "Timeout while requesting target filename from server", null);
                deferred.reject(new Error("Timeout"));
            };

            try
            {
                antvd.AntLib.toLog("ConverterPackage.getConvTargetFileName (ConverterPackage.js)", "Fetching converter filename from server");

                hr.open("HEAD", uri.spec, true);
                hr.send();
            }
            catch (ex)
            {
                antvd.AntLib.logError("ConverterPackage.getConvTargetFileName (ConverterPackage.js)", "Request to " + uri.spec + " failed", ex);
                deferred.reject(new Error("Request failed"));
            }

            return deferred.promise;
        };

        /**
         * @private
         * @member saveFileToProfile
         * @param {nsIFile} source The source file to be deployed
         * @param {String} filename Preferred file name
         * @param {Number} access Access rights
         * @returns {Promise<nsILocalFile>}
         * @resolves References to the target file
         * @rejects {@link Error} in case of IO failure.
         * The function outputs the error info to the addon's log
         */
        var saveFileToProfile = function(source, filename, access)
        {
            return Task.spawn(function()
            {
                let deployedFilePath = OS.Path.join(convTargetDir, filename);
            
                // type nsILocalFile
                let deployedFile = FileUtils.File(deployedFilePath);
                
                try
                {
                    deployedFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, access);
                }
                catch (e)
                {
                    antvd.AntLib.logError("ConverterPackage.saveFileToProfile (ConverterPackage.js)", "Failed to create file in profile folder: " + deployedFile.path, ex);
                    throw new Error("IO failure");
                }

                // type nsIFileOutputStream
                let ostream = FileUtils.openFileOutputStream(deployedFile);

                // type Deferred
                let fetchResultDeferred = Promise.defer();

                NetUtil.asyncFetch(source, function(istream, status)
                {
                    if (!Components.isSuccessCode(status))
                    {
                        antvd.AntLib.logError("ConverterPackage.saveFileToProfile (ConverterPackage.js)", "Failed to open local file " + deployedFile.path + ", status " + status, null);
                        fetchResultDeferred.reject(new Error("IO failure"));

                        return;
                    }

                    fetchResultDeferred.resolve(istream);
                });

                // type nsIInputStream
                let istream = yield fetchResultDeferred.promise;

                // type Deferred
                let copyResultDeferred = Promise.defer();
                
                NetUtil.asyncCopy(istream, ostream, function (status)
                {
                    if (!Components.isSuccessCode(status))
                    {
                        antvd.AntLib.logError("ConverterPackage.saveFileToProfile (ConverterPackage.js)", "Failed to copy stream to " + deployedFile.path + ", status " + status, null);
                        copyResultDeferred.reject(new Error("IO failure"));

                        return;
                    }

                    copyResultDeferred.resolve();
                });

                yield copyResultDeferred.promise;

                // Assign a resolution value to the spawn's promise
                throw new Task.Result(deployedFile);
            });
        };

        /**
         * @private
         * @member getConvUrl
         * @returns {nsIURI} Transcoder's uri
         */
        var getConvUrl = function()
        {
            let url = prefStorage.getCharPref(avconvUrlOption);
        
            return NetUtil.newURI(url);
        };

        /**
         * Removes a download entry from the browser's history
         * FIXME(Igor): This function duplicates the one defined in MediaLibrary.
         *              Think if it could be added to AntLib
         *
         * @private
         * @member clear
         * @param {nsIURI} uri Uri to remove
         */
        var clear = function(uri)
        {
            const SVC_BROWSER_HISTORY = "@mozilla.org/browser/nav-history-service;1";
        
            try
            {
                let browserHistory = Cc[SVC_BROWSER_HISTORY].getService(Ci.nsIBrowserHistory);
                browserHistory.removePage(uri);
            }
            catch (ex)
            {
                antvd.AntLib.logWarning("ConverterPackage.clear (ConverterPackage.js)", "Failed to remove URL from browser history: " + uri.spec, ex);
            }
        };
    };

    (function(me)
     {
        var inst = new me();

        /**
         * @static
         * @member getDefault
         * @returns {ConverterPackage}
         */
        me.getDefault = function()
        {
            return inst;
        };

        /**
         * @typedef ConverterPackage~Stats
         * @property {Number} success Number of successfull transcodings
         * @property {Number} failure Number of failed transcodings
         * @property {String} md5 Hash of the converter's executable
         */
        /**
         * @static
         * @member getStats
         * @returns {Promise<ConverterPackage~Stats>}
         */
        me.getStats = function()
        {
            return Task.spawn(function()
            {
                /** @type ConverterPackage~Stats */
                let stats =
                {
                    success: 0,
                    failure: 0,
                    md5: ""         // not implemented yet
                };

                let successRate = inst.getSuccessRate();
                
                stats.success = successRate.success;
                stats.failure = successRate.failure;
                
                try
                {
                    stats.md5 = yield inst.getConvHash();
                }
                catch (ex)
                {}

                /** Resolve the promise */
                throw new Task.Result(stats);
            });
        };
    })(ConverterPackage);

    antvd.ConverterPackage = ConverterPackage;
    antvd.MediaConverterPackageError = MediaConverterPackageError;

    return antvd;

})(antvd);
