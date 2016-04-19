/**
 * Converter.js, 2014
 * @author Igor Chornous ichornous@heliostech.hk
 * @namespace antvd
 */
var antvd = (function(antvd)
{
    if (!antvd.AntLib)
    {
        antvd.AntLib = AntLib;
    }

    const Cc = Components.classes;
    const Cr = Components.results;
    const Ci = Components.interfaces;

    Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
    Components.utils.import("resource://gre/modules/Downloads.jsm");
    Components.utils.import("resource://gre/modules/Task.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import("resource://gre/modules/Promise.jsm");

    /**
     * @class MediaLibraryError
     * @param {Number} code
     * @param {Object} cause
     */
    function MediaLibraryError(code, cause)
    {
        /** @type Number */
        this.code = code;
        /** @type Object */
        this.cause = cause;
    };

    /** @const */ MediaLibraryError.E_DIR_PATH_INVALID = 1;
    /** @const */ MediaLibraryError.E_DIR_CREATE_DENIED = 2;
    /** @const */ MediaLibraryError.E_FILE_CREATE_DENIED = 3;
    /** @const */ MediaLibraryError.E_DOWNLOAD_FAILED = 4;
    /** @const */ MediaLibraryError.E_INVALID_OPERATION = 5;

    /**
     * DTO
     *
     * @class DownloadResult
     */
    function DownloadResult() { };
    
    DownloadResult.prototype =
    {
        /** @type nsIURI */ source: null,
        /** @type String */ target: null,
        /** @type Number */ size: 0,
        /** @type Number */ downloadTime: 0,

        /**
         * @member toString
         * @returns {String} Formatted represantation
         */
        toString: function()
        {
            return "Uri: " + this.source.spec
                + "\nFile: " + this.target
                + "\nSize: " + this.size
                + "\nTime: " + this.downloadTime;
        }
    };

    /**
     * @static
     * @member create
     * @param {nsIURI} source Uri of the download source
     * @param {String} target Path to a file which contains the downloaded content
     * @param {Number} size Number of bytes transmitted
     * @param {Number} downloadTime Time it took to complete the download
     */
    DownloadResult.create = function(source, target, size, downloadTime)
    {
        let dr = new DownloadResult();
    
        dr.source = source;
        dr.target = target;
        dr.size = size;
        dr.downloadTime = downloadTime;
    
        return dr;
    };

    /**
     * @class MediaLibrary
     * @param {Boolean} isprivate
     */
    function MediaLibrary(isprivate)
    {
        /** @type MediaLibrary */
        var ctx = this;

        /**
         * Ensure the media library is properly configured
         *
         * Check whether the download folder is accessible and
         * all the necessary permissions are granted to the addon
         *
         * @member ensureConfigured
         * @throws MediaLibraryError In case if it isn't permitted to create file in
         *                           the media library's directory
         */
        this.ensureConfigured = function()
        {
            let path = setupTargetPath(".lock").path;
        
            try
            {
                FileUtils.File(path).remove(false);
            }
            catch (ex)
            {}
        };

        /**
         * Save a file to the media library and adds a corresponding record to
         * the library's db
         *
         * @member save
         * @param {Source} source Download source
         * @returns {Promise}
         * @resolves Instance of {@link DownloadResult} when the file has been completely
         *           copied to the media library
         * @rejects {@link MediaLibraryError} if the operation has failed
         */
        this.save = function(source)
        {
            /**
             * source.uri: nsIURI
             * source.filename: String
             * source.origin.url: String
             * source.origin.title: String
             * source.origin.domain: String
             */
            if (!source || !source.uri || !source.filename)
            {
                let _msg = "Mandatory fields are missing:" +
                           "\nSource: " + (source ? "ok" : "n/a") +
                           "\nUri: " + (source.uri ? source.uri.spec : "n/a") +
                           "\nFilename: " + (source.filename ? source.filename : "n/a");
                
                antvd.AntLib.logError("MediaLibrary.save (MediaLibrary.js)", _msg, null);
            
                return Promise.reject(new MediaLibraryError(MediaLibraryError.E_INVALID_OPERATION));
            }

            return ctx.download(source.uri, source.filename, false).then( function(dr)  // @type DownloadResult
            {
                try
                {
                    saveRecord(dr.target, source);
                }
                catch (ex)
                {
                    antvd.AntLib.logWarning(
                        "MediaLibrary.save (MediaLibrary.js)",
                        "Failed to register media record:" + source.uri.spec,
                        ex
                    );
                }
                
                // Important. This gets sent to a next handler in the promise chain
                return dr;
            });
        };

        /**
         * Download a file to the library
         *
         * @member download
         * @param {nsIURI} uri Source location
         * @param {String} filename Desired file name
         * @param {Boolean} istemp Whether the target file should be stored in
         *                         a temporary location instead of the user selected
         *                         library
         * @returns {Promise}
         * @resolves Instance of {@link DownloadResult}
         * @rejects {@link MediaLibraryError} if the operation has failed
         */
        this.download = function(uri, filename, istemp)
        {
            return Task.spawn(function ()
            {
                if (!uri || !filename)
                {
                    let _msg = "Mandatory fields are missing:" +
                               "\nUri: " + (uri ? uri.spec : "n/a") +
                               "\nFilename: " + (filename ? filename : "n/a");
                    
                    antvd.AntLib.logError("MediaLibrary.download (MediaLibrary.js)", _msg, null);
                    
                    throw new MediaLibraryError(MediaLibraryError.E_INVALID_OPERATION);
                }

                // @throws MediaLibraryError
                let target = setupTargetPath(filename, true, istemp);

                // @type Download
                let downloadInst = null;
            
                try
                {
                    let list = yield Downloads.getList(isprivate ? Downloads.PRIVATE : Downloads.ALL);
                
                    downloadInst = yield Downloads.createDownload(
                    {
                        source:
                        {
                            url: uri.spec,
                            isPrivate: isprivate
                        },
                        target: target,
                        saver: "copy"
                    });

                    downloadInst.tryToKeepPartialData = true;
                    yield list.add(downloadInst);

                    try
                    {
                        downloadInst.start();
                    }
                    catch (e)
                    {
                        yield list.remove(downloadInst);
                        throw e;
                    }

                    try
                    {
                        yield downloadInst.whenSucceeded();
                    }
                    finally
                    {
                        if (istemp)
                        {
                            list.remove(downloadInst);
                            clear(uri);
                        }
                    }
                }
                catch (ex)
                {
                    antvd.AntLib.logError(
                        "MediaLibrary.download (MediaLibrary.js)",
                        "Failed to complete download: " + uri.spec,
                        ex
                    );
                    
                    throw new MediaLibraryError(MediaLibraryError.E_DOWNLOAD_FAILED, ex);
                }

                // Resolve the corresponding promise with an instance of DownloadResult
                throw new Task.Result(
                    DownloadResult.create(
                        uri,
                        target.path,
                        downloadInst.currentBytes,
                        Date.now() - downloadInst.startTime.getTime()
                    )
                );
            });
        };

        /**
         * Return the movies destination folder and create it if it doesn't exist
         *
         * @private
         * @member getDestFolder
         * @param {Boolean} istemp
         * @return {nsIFile} Instance which references the folder
         * @throws MediaLibraryError In case of an io exception:
         *   E_DIR_PATH_INVALID If the user specified path is invalid for the current OS
         *   E_DIR_CREATE_DENIED If firefox failed to create the missing folder
         */
        var getDestFolder = function(istemp)
        {
            if (istemp)
            {
                return FileUtils.getDir("TmpD", [], true, false);
            }

            // @type nsIFile
            let file = null;
        
            try
            {
                file = new FileUtils.File(AntPrefs.flvDir);
            }
            catch (e)
            {
                antvd.AntLib.logError(
                    "MediaLibrary.getDestFolder (MediaLibrary.js)",
                    "Failed to initialize a reference to the media library's dir",
                    e
                );
                
                throw new MediaLibraryError(MediaLibraryError.E_DIR_PATH_INVALID, e);
            }

            try
            {
                if (!file.exists() || !file.isDirectory())
                {
                    file.create(Ci.nsIFile.DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
                }

                return file;
            }
            catch (e)
            {
                antvd.AntLib.logError(
                    "MediaLibrary.getDestFolder (MediaLibrary.js)",
                    "Failed to create the missing media library's directory",
                    e
                );

                throw new MediaLibraryError(MediaLibraryError.E_DIR_CREATE_DENIED, e);
            }
        };

        /**
         * @private
         * @member setupTargetPath
         * @param {String} filename
         * @param {Boolean} haspart
         * @param {Boolean} istemp
         * @returns {DownloadTarget}
         * @throws MediaLibraryError
         *   E_FILE_CREATE_DENIED In case if firefox failed to create a file
         */
        var setupTargetPath = function(filename, haspart, istemp)
        {
            let destFile = getDestFolder(istemp);
            destFile.append(filename);

            let partFile = destFile.clone();
            partFile.leafName += ".part";

            try
            {
                destFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
            
                if (!haspart)
                {
                    return { 'path': destFile.path };
                }

                partFile.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
                
                return { 'path': destFile.path, 'partFilePath': partFile.path };
            }
            catch (e)
            {
                antvd.AntLib.logError(
                    "MediaLibrary.setupTargetPath (MediaLibrary.js)",
                    "Failed to create a file in the media library's folder: " + filename,
                    e
                );
                
                throw new MediaLibraryError(MediaLibraryError.E_FILE_CREATE_DENIED, e);
            }
        };

        /**
         * Removes an entry from the browser's download history
         * TODO(Igor): This is a shortcut so we should think if there is a better
         *             architectural solution
         * @private
         * @member clear
         * @param {nsIURI} uri Uri of a download to remove from the download history
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
                antvd.AntLib.logError(
                    "MediaLibrary.clear (MediaLibrary.js)",
                    "Failed to clear the browser history: " + uri.spec,
                    ex
                );
            }
        };

        /**
         * @private
         * @member saveRecord
         * @param {String} target Path of a media file
         * @param {Source} source Remote source
         */
        var saveRecord = function(target, source)
        {
            try
            {
                AntStorage.beginTransaction();
                
                AntStorage.addPlaylist('');
                
                AntStorage.addVideoRecord(
                    AntHash.getFileHash(target),    // sha1
                    source.origin.title,            // title
                    target,                         // path
                    source.uri.spec,                // url
                    source.origin.url,              // feed
                    source.origin.domain,           // domain
                    0,                              // duration
                    0,                              // size
                    '',                             // playlist
                    0,                              // last_view
                    0,                              // nb_views
                    (new Date()).getTime()          // created_at
                );

                AntStorage.endTransaction();
            }
            catch(e)
            {
                antvd.AntLib.logError(
                    "MediaLibrary.saveRecord (MediaLibrary.js)",
                    "Failed to update the Media Library's db",
                    e
                );
            }

            try
            {
                var playerWnd = AntBar.getPlayerWnd();
            
                if (playerWnd)
                {
                    playerWnd.AntPlayer.updateTreeContent();
                }
            }
            catch(e)
            {
                antvd.AntLib.logWarning(
                    "MediaLibrary.saveRecord (MediaLibrary.js)",
                    "Failed to update player's tree content",
                    e
                );
            }
        };
    };

    // Push object
    antvd.MediaLibraryError = MediaLibraryError;
    antvd.MediaLibrary = MediaLibrary;

    return antvd;

})(antvd);
