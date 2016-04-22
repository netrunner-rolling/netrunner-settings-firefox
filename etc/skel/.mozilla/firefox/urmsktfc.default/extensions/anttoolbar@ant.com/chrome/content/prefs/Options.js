/**
 * Options.js, 2014
 * @author Igor Chornous ichornous@heliostech.hk
 * @namespace antvd
 */
var antvd = (function(antvd) {
    Components.utils.import("resource://gre/modules/Task.jsm");
    Components.utils.import("resource://gre/modules/Promise.jsm");
    Components.utils.import("resource://gre/modules/FileUtils.jsm");
    Components.utils.import("resource://gre/modules/Services.jsm");
    if (!antvd.AntLib)
        antvd.AntLib = AntLib;

    const Cc = Components.classes;
    const Ci = Components.interfaces;
    const Cr = Components.results;

    const URL_GENERAL_HELP_PAGE =
          "http://www.ant.com/toolbar/firefox/help";
    const URL_TRANSCODER_HELP_PAGE =
          "http://support.ant.com/entries/30182610-How-to-install-Media-Converter";

    /**
     * Facade for preference usecases
     *
     * @class Options
     * @param {ConverterPackage} opts.converterConf
     */
    function Options(opts) {
        /**
         * @private
         * @type Options
         */
        let ctx = this;

        /**
         * Open the preferences window
         *
         * @member showPreferences
         */
        this.showPreferences = function() {
            /** Prevent opening multiple windows */
            var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Ci.nsIWindowMediator);
            let prefDialog = wm.getMostRecentWindow("Ant:Preferences");
            if (prefDialog) {
                prefDialog.focus();
                return;
            }

            /** @type nsIPrefService */
            let prefSvc = Cc["@mozilla.org/preferences-service;1"].
                    getService(Ci.nsIPrefService);
            let prefServiceCache = prefSvc.getBranch(null);

            /** @type Boolean */
            let instantApply = prefServiceCache.getBoolPref(
                "browser.preferences.instantApply");

            let flags = "chrome, titlebar, toolbar, centerscreen"
                    + (instantApply ? ", dialog=no" : ", modal");

            window.openDialog(
                "chrome://antbar/content/xul/options.xul"
                , "antpreferences"
                , flags
                , new antvd.OptionsUI(ctx));
        };

        /**
         * Navigate the user to a help document given the topic id
         *
         * @member showHelp
         * @param {Number} topic
         */
        this.showHelp = function(topic) {
            /** @type String */
            let url;
            switch (topic) {
            case Options.HT_TRANSCODER_INSTALL:
                url = URL_TRANSCODER_HELP_PAGE;
                break;
            case Options.HT_GENERAL:
            default:
                url = URL_GENERAL_HELP_PAGE;
            }

            antvd.AntLib.openURL(url, 1);
        };

        /**
         * Open the select file dialog, and let user choose a transcoder
         *
         * @member selectTranscoder
         * @param {XULWindow?} parent Optional parent window. To be in focus
         */
        this.selectTranscoder = function(parent) {
            /** @type nsIFilePicker */
            let fp = Cc["@mozilla.org/filepicker;1"]
                    .createInstance(Ci.nsIFilePicker);
            fp.init(
                parent ? parent : window
                , "Select converter's executable"
                , Ci.nsIFilePicker.modeOpen);
            fp.appendFilters(Ci.nsIFilePicker.filterApps);

            /** Make sure that the file picker will initially display
             the folder where the currently configured converter resides */
            try {
                let file = opts.converterConf.getAvconvLocation();
                if (file && !file.isDirectory())
                    file = file.parent;

                if (file)
                    fp.displayDirectory = file;
            } catch (ex) {
                antvd.AntLib.logError(
                    "[UI]: Failed to set an initial directory", ex);
            }

            /** @type nsIFilePickerShownCallback */
            let callback = {
                /** @param result returnOK, returnCancel, or returnReplace */
                done: function(result) {
                    if (result != Ci.nsIFilePicker.returnOK)
                        return;
                    opts.converterConf.setAvconvLocation(fp.file);
                }
            };
            fp.open(callback);
        };

        /**
         * Automatically download and install a transcoder
         *
         * @member onInstallTranscoder
         * @param {function()} eventListener.onBeginInstall
         * @param {function()} eventListener.onEndInstall
         * @param {function(reason, error)} eventListener.onFailure
         * @returns {Promise}
         */
        this.installTranscoder = function(eventListener) {
            const InstErr = antvd.MediaConverterPackageError;
            return Task.spawn(function() {
                try {
                    eventListener.onBeginInstall();
                } catch (_e) {
                    antvd.AntLib.logError(
                        "[UI]: Target of execution has failed", _e);
                }

                try {
                    yield opts.converterConf.install();
                    try {
                        eventListener.onEndInstall();
                    } catch (_e) {
                        /** Otherwise that would influence the execution flow */
                        antvd.AntLib.logError(
                            "[UI]: Target of execution has failed", _e);
                    }
                } catch (/** @type MediaConverterPackageError */ ex) {
                    /** @type Number */
                    let errCode;
                    if ((ex.code == InstErr.E_SERVICE_UNAVAILABLE)
                        || (ex.code == InstErr.E_TARGET_BADHASH)) {
                        errCode = Options.E_IT_BADSERVICE;
                    } else if (ex.code == InstErr.E_INSTALL_IN_PROGRESS) {
                        errCode = Options.E_IT_NOTFINISHED;
                    } else {
                        errCode = Options.E_IT_FAILURE;
                        antvd.AntLib.logError(
                            "[UI]: Unexpected failure during the autoconfiguration"
                            , ex);
                    }

                    try {
                        eventListener.onFailure(errCode, ex);
                    } catch (_e) {
                        antvd.AntLib.logError(
                            "[UI]: Target of execution has failed", _e);
                    }
                }
            });
        };
    };

    /** @const */ Options.E_IT_BADSERVICE = 1;
    /** @const */ Options.E_IT_FAILURE = 2;
    /** @const */ Options.E_IT_NOTFINISHED = 3;

    /** Help topics */
    /** @const */ Options.HT_TRANSCODER_INSTALL = 1;
    /** @const */ Options.HT_GENERAL = 2;

    (function(me) {
        let inst = new Options({
            converterConf: antvd.ConverterPackage.getDefault()
        });
        me.getDefault = function() {
            return inst;
        };
    })(Options);

    /** @expose */
    antvd.Options = Options;
    return antvd;
})(antvd);
