/**
 * OptionsUI.js, 2014
 * @author ICh
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

    const idAvconvEndInstall = "MediaConverterPackage.EndInstallConverter";
    const idAvconvBeginInstall = "MediaConverterPackage.BeginInstallConverter";
    const idAvconvFailureService = "MediaConverterPackage.ServerIssue";
    const idAvconvFailureRuntime = "MediaConverterPackage.Failure";
    const idStrHelp = "Titles.Button.Help";

    /**
     * @class OptionsUI
     * @param {Options} optionsController
     */
    function OptionsUI(optionsController) {
        const idNotificationBox = "ant-prefs-mode-nb";
        const idAvconvInstallButton = "antBarPrefsAvconvInstallButton";
        const idAvconvBrowseButton = "antBarPrefsAvconvPathButton";

        /**
         * @private
         * @type OptionsUI
         */
        let ctx = this;

        /** @type XULWindow */
        let _origin = null;

        /** @type XULDocument */
        let _layout = null;

        /** @type notificationbox */
        let _nb = null;

        /** @type XULElement */
        let _elAvconvInstallButton = null;
        /** @type XULElement */
        let _elAvconvBrowseButton = null;

        /** @type Boolean */
        let _isWindow = false;

        /**
         * @member attach
         * @param {XULWindow} origin
         */
        this.attach = function(origin) {
            _origin = origin;
            _origin.addEventListener("load", init, false);
        };

        /**
         * @private
         * @member init
         * @param {XULDocumet} ev.target
         */
        var init = function(ev) {
            _layout = ev.target;
            _nb = _layout.getElementById(idNotificationBox);

            let elAvconvBrowseButton = _layout.getElementById(idAvconvBrowseButton);
            elAvconvBrowseButton.addEventListener(
                "command"
                , onSelectTranscoder
                , false);

            let elAvconvInstallButton = _layout.getElementById(idAvconvInstallButton);
            elAvconvInstallButton.addEventListener(
                "command"
                , onInstallTranscoder
                , false);

            _elAvconvInstallButton = elAvconvInstallButton;
            _elAvconvBrowseButton = elAvconvBrowseButton;

            _origin.addEventListener("unload", release, false);
            _isWindow = true;
        };

        /** @private */
        var release = function() {
            _isWindow = false;
            _elAvconvBrowseButton.removeEventListener("command", onSelectTranscoder);
            _elAvconvInstallButton.removeEventListener(
                "command", onInstallTranscoder);

            _origin.removeEventListener("load", init);
            _origin.removeEventListener("unload", release);
        };

        /**
         * @private
         * @member onSelectTranscoder
         */
        var onSelectTranscoder = function() {
            optionsController.selectTranscoder(_origin);
        };

        /**
         * @private
         * @member onInstallTranscoder
         */
        var onInstallTranscoder = function() {
            _elAvconvInstallButton.disabled = true;
            optionsController.installTranscoder({
                onBeginInstall: function() { onTranscoderNotifyInstall(false); },
                onEndInstall: function() {
                    _elAvconvInstallButton.disabled = false;
                    onTranscoderNotifyInstall(true);
                },
                /** @function */
                onFailure: function(reason, err) {
                    _elAvconvInstallButton.disabled = false;
                    onTranscoderNotifyInstallFailure(reason, err);
                }
            });
        };

        /**
         * @private
         * @param {String} message
         * @param {Array.<Object>} buttons
         */
        var putNotification = function(message, buttons) {
            _nb.removeAllNotifications(true);
            _nb.appendNotification(
                message                               // label
                , "ant-install-report"                // id
                , "chrome://antbar/skin/favico16.png" // image
                , _nb.PRIORITY_INFO_HIGH              // priority
                , buttons                             // buttons
            );
            _origin.sizeToContent();
        };

        /** @private */
        var onTranscoderNotifyInstall = function(complete) {
            if (!_isWindow)
                return;

            try {
                /** @type String */
                let message = complete
                        ? antvd.AntLang.getString(idAvconvEndInstall)
                        : antvd.AntLang.getString(idAvconvBeginInstall);
                putNotification(message, []);
            } catch (ex) {
                antvd.AntLib.logError(
                    "[UI]: Failed to notify the autoconfiguration status"
                    , ex);
            }
        };

        /** @private */
        var onTranscoderNotifyInstallFailure = function(reason, error) {
            if (!_isWindow)
                return;

            try {
                /** @type String */
                let message;

                if (reason == antvd.Options.E_IT_BADSERVICE) {
                    message = antvd.AntLang.getString(idAvconvFailureService);
                } else if (reason == antvd.Options.E_IT_NOTFINISHED) {
                    message = antvd.AntLang.getString(idAvconvBeginInstall);
                } else {
                    message = antvd.AntLang.getFormatString(
                        idAvconvFailureRuntime
                        , error.code);
                }

                let btnHelp = {
                    label: antvd.AntLang.getString(idStrHelp),
                    accessKey: "H",
                    popup: null,
                    callback: function() {
                        optionsController.showHelp(
                            antvd.Options.HT_TRANSCODER_INSTALL);
                    }
                };
                putNotification(message, [btnHelp]);
            } catch (ex) {
                antvd.AntLib.logError(
                    "[UI]: Failed to notify a failure"
                    , ex);
            }
        };
    };

    /** @expose */
    antvd.OptionsUI = OptionsUI;
    return antvd;
})(antvd);
