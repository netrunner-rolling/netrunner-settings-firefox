/**
 * flvlist.js, 2008
 * @author Zak
 * @contributor Brian King
 * @contributor Igor Chornous ichornous@heliostech.hk
 *
 * TODO(Igor): Untangle UI. This shouldn't be a separate module
 */

var antvd = (function (antvd)
{
    if (!antvd.AntLib)
    {
        antvd.AntLib = antvd.AntLib;
    }

    const Cc = Components.classes;
    const Ci = Components.interfaces;
    const Cr = Components.results;

    // @class AntFlvListListener
    function AntFlvListListener()
    {
    };

    AntFlvListListener.prototype =
    {
        // @type BaseVideoRequest
        videoRequest: null,

        observe: function (subject, topic, data)
        {
            if (topic == "alertclickcallback")
            {
                AntFlvList.download(this.videoRequest);
            }

            // Clean up the videoRequest object when the notification has gone,
            // otherwise it holds a document reference that leaks
            if (topic == "alertfinished")
            {
                delete this.videoRequest;
            }
        }
    };

    // @class AntFlvList
    function AntFlvList()
    {
        const idAvconvBadService = "MediaConverterPackage.ServerIssue";
        const idAvconvSetupFailure = "MediaConverterPackage.Failure";

        // @type AntFlvList
        var ctx = this;

        // Download media
        // Entry point for the 'download' usecase
        //
        // @member download
        // @param {BaseVideoRequest} videoRequest Media request to be downloaded
        this.download = function (videoRequest)
        {
            let library = new antvd.MediaLibrary(antvd.AntLib.inPrivate);
            
            let downloadPromise = videoRequest.download(library);
            
            let downloadPromiseOnSuccess = function ()
            {
                reportDownload(videoRequest);
            };

            let downloadPromiseOnFailure = function (ex)
            {
                // Handle rejection
                if (ex instanceof antvd.MediaLibraryError)
                {
                    switch (ex.code)
                    {
                        case antvd.MediaLibraryError.E_DIR_PATH_INVALID:
                            reportNotConfigured("MediaLibrary.BadFolder");
                            break;
                        case antvd.MediaLibraryError.E_DIR_CREATE_DENIED:
                            reportNotConfigured("MediaLibrary.NoPermissionsDir");
                            break;
                        case antvd.MediaLibraryError.E_FILE_CREATE_DENIED:
                            reportNotConfigured("MediaLibrary.NoPermissionsFile");
                            break;
                        default:
                            reportFailure("MediaLibrary.UnexpectedError");
                            break;
                    }
                }
                else if (ex instanceof antvd.MediaConverterError)
                {
                    switch (ex.code)
                    {
                        case antvd.MediaConverterError.E_SETUP_FAILURE:
                            reportNoConverter("MediaConverterPackage.NotConfigured");
                            break;
                        case antvd.MediaConverterError.E_JOIN_MISSING_INPUT:
                            reportFailure("MediaConverter.NoInput", videoRequest.displayName);
                            break;
                        case antvd.MediaConverterError.E_CONV_FAILURE:
                            reportNoConverter("MediaConverter.ConversionFailed");
                            break;

                        case antvd.MediaConverterError.E_IO_FAILURE:
                        case antvd.MediaConverterError.E_UNEXPECTED_ERROR:
                        default:
                            reportFailure("MediaConverter.UnexpectedError");
                            break;
                    }
                }
                else if (ex instanceof antvd.MediaConverterPackageError)
                {
                    switch (ex.code)
                    {
                        case antvd.MediaConverterPackageError.E_CONF_NOTCONFIGURED:
                            reportNoConverter("MediaConverterPackage.NotConfigured");
                            break;

                        case antvd.MediaConverterPackageError.E_CONF_NOFILE:
                        case antvd.MediaConverterPackageError.E_CONF_NOTEXECUTABLE:
                            reportNoConverter("MediaConverterPackage.NotExecutable");
                            break;
                    
                        default:
                            reportFailure("MediaConverterPackage.UnexpectedError", ex.code);
                            break;
                    }
                }
                else
                {
                    reportFailure("AntFlvList.DownloadFailure", ex.code);

                    // unexpected error
                    antvd.AntLib.logError(
                        "AntFlvList.download (flvlist.js)",
                        "Download promise rejected", ex
                    );
                }
            };

            downloadPromise.then(
                downloadPromiseOnSuccess,
                downloadPromiseOnFailure
            ).then(null, function (ex) { antvd.AntLib.logError("AntFlvList.download (flvlist.js)", "Unexpected error", ex); });
        };

        // Automatically download and configure a media converter
        //
        // Two popup messages are to be displayed at the beginning and
        // at the end of the procedure. A notification bar with an error
        // message will be shown in case of a failure
        //
        // @private
        // @member installTranscoder
        var installTranscoder = function ()
        {
            antvd.Options.getDefault().installTranscoder(
                {
                    onBeginInstall: function () { notifyAutoInstall(); },
                    onEndInstall: function () { notifyAutoInstall(true);
                },
                
                /**
                 * @param {Number} reason
                 * @param {Number} ex.code
                 */
                onFailure: function (reason, ex)
                {
                    if (antvd.Options.E_IT_BADSERVICE == reason)
                    {
                        reportNoConverter(idAvconvBadService);
                    }
                    else
                    {
                        reportNoConverter(idAvconvSetupFailure, ex.code);
                        
                        antvd.AntLib.logError(
                            "AntFlvList.installTranscoder (flvlist.js)",
                            "Unexpected failure during the transcoder setup",
                            ex
                        );
                    }
                }
            });
        };

        // Send download report if the user has allowed them and he isn't in
        // the private browsing mode
        //
        // @private
        // @member reportDownload
        // @param {MediaRequest} mediaRequest
        // @returns {Promise}
        var reportDownload = function (mediaRequest)
        {
            if (!mediaRequest)
            {
                return Promise.reject(new Error("'mediaRequest' is a mandatory argument"));
            }

            try
            {
                if (!AntPrefs.isVideorepportsOn || antvd.AntLib.inPrivate)
                {
                    return Promise.resolve();
                }
                
                return mediaRequest.reportDownload();            
            }
            catch (ex)
            {
                antvd.AntLib.logError(
                    "AntFlvList.reportDownload (flvlist.js)",
                    "Unexpected error occurred",
                    ex
                );
                
                return Promise.reject(new Error("Unexpected exception"));            
            }
        };

        // Display a popup notification in a corner of the user's display
        //
        // @private
        // @member notifyAutoInstall
        // @param {Boolean} complete
        var notifyAutoInstall = function (complete)
        {
            try
            {
                var alertsService = Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService);
                var _string = antvd.AntLang.getString("MediaConverterPackage.BeginInstallConverter");
                
                if (complete)
                {
                    antvd.AntLang.getString("MediaConverterPackage.EndInstallConverter")
                }

                alertsService.showAlertNotification(
                    "chrome://antbar/skin/logo.png",
                    antvd.AntLang.getString("MediaConverterPackage.AutoConfigurationTitle"),
                    _string
                );

            }
            catch (ex)
            {
                antvd.AntLib.logError(
                    "AntFlvList.notifyAutoInstall (flvlist.js)",
                    "Failed to display a notification",
                    ex
                );
            }
        };

        // @private
        // @member reportNoConverter
        // @param {String} messageId
        var reportNoConverter = function (messageId)
        {
            let str = (arguments.length == 1) ?
                      antvd.AntLang.getString(messageId) :
                      antvd.AntLang.getFormatString(messageId, Array.prototype.slice.call(arguments, 1));

            let acceptButton =
            {
                label: antvd.AntLang.getString("Titles.Button.Configure"),
                accessKey: "C",
                popup: null,
                callback: function ()
                {
                    antvd.Options.getDefault().showPreferences();
                }
            };

            let helpButton =
            {
                label: antvd.AntLang.getString("Titles.Button.Help"),
                accessKey: "H",
                popup: null,
                callback: function ()
                {
                    antvd.Options.getDefault().showHelp(antvd.Options.HT_TRANSCODER_INSTALL);
                }
            };

            let autoInstall =
            {
                label: antvd.AntLang.getString("Titles.Button.Install"),
                accessKey: "I",
                popup: null,
                callback: function ()
                {
                    installTranscoder();
                }
            };

            var nb = gBrowser.getNotificationBox();
            
            nb.appendNotification(
                str,
                'ant-denied-folder',
                'chrome://antbar/skin/favico16.png',
                nb.PRIORITY_WARNING_HIGH,
                [autoInstall, acceptButton, helpButton]
            );
        };

        // @private
        // @member reportNotConfigured
        // @param {String} id Message's id
        var reportNotConfigured = function (id)
        {
            var acceptButton =
            {
                label: antvd.AntLang.getString("Titles.Button.Configure"),
                accessKey: "C",
                popup: null,
                callback: function ()
                {
                    antvd.Options.getDefault().showPreferences();
                }
            };

            let helpButton =
            {
                label: antvd.AntLang.getString("Titles.Button.Help"),
                accessKey: "H",
                popup: null,
                callback: function ()
                {
                    antvd.Options.getDefault().showHelp(antvd.Options.HT_GENERAL);
                }
            };

            var nb = gBrowser.getNotificationBox();
            
            nb.appendNotification(
                antvd.AntLang.getString(id),
                'ant-denied-folder',
                'chrome://antbar/skin/favico16.png',
                nb.PRIORITY_WARNING_HIGH,
                [acceptButton, helpButton]
            );
        };

        // @private
        // @member reportFailure
        // @param {String} id
        // @param {Object..} args
        var reportFailure = function (id)
        {
            let str = antvd.AntLang.getFormatString(id, Array.prototype.slice.call(arguments, 1));
            
            if(arguments.length == 1)
            {
                str = antvd.AntLang.getString(id);
            }

            let helpButton =
            {
                label: antvd.AntLang.getString("Titles.Button.Help"),
                accessKey: "H",
                popup: null,
                callback: function ()
                {
                    antvd.AntLib.openURL("http://www.ant.com/toolbar/firefox/help", 1);
                }
            };

            var nb = gBrowser.getNotificationBox();
            
            nb.appendNotification(
                str,
                'ant-denied-folder',
                'chrome://antbar/skin/favico16.png',
                nb.PRIORITY_WARNING_HIGH,
                [helpButton]
            );
        };
    };

    antvd.AntFlvList = new AntFlvList();

    return antvd;

})(antvd);
