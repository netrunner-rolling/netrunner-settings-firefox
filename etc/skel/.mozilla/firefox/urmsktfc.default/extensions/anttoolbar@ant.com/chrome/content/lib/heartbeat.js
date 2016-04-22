/**
 * heartbeat.js
 *
 * @contributor Igor Chornous ichornous@heliostech.hk
 * Revisited in 2014
 */

/**
 * @namespace antvd
 */
var antvd = (function(antvd) {
    const Cc = Components.classes;
    const Cr = Components.results;
    const Ci = Components.interfaces;

    Components.utils.import("resource://gre/modules/Task.jsm");
    Components.utils.import("resource://gre/modules/Promise.jsm");

    /**
     * @class AntHeartBeat
     */
    function AntHeartBeat() {
        /**
         * @private
         * @type nsITimer
         */
        var _timer = null;

        /**
         * 12 hours delay
         *
         * @private
         * @type Number
         */
        const _delay = 12*60*60*1000;

        /**
         * @private
         * @type Number
         */
        var previous = 0;

        /**
         * @private
         * @type nsITimerCallback
         */
        var _onTimerCallback = {
            notify: function (timer) {
                sendMessage();
            }
        };

        /**
         * @member init
         */
        this.init = function() {
            previous = parseInt(
                AntPrefs.getAntBranch().getCharPref("last_heartbeat_ts"));

            let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
            timer.initWithCallback(
                _onTimerCallback
                , _delay
                , Ci.nsITimer.TYPE_REPEATING_SLACK);
            _timer = timer;

            sendMessage();
        };

        /**
         * @private
         * @member needToSend
         * @returns {Boolean}
         */
        var needToSend = function() {
            let now = Date.now();
            let delta = now - previous;
            if (delta >= _delay) {
                previous = now;
                AntPrefs.getAntBranch()
                    .setCharPref('last_heartbeat_ts', now);
                return true;
            }
            return false;
        };

        /**
         * @private
         * @member sendMessage
         */
        var sendMessage = function() {
            if (!needToSend())
                return;

            if (!AntPrefs.canSendHeartBeat)
                return;

            Task.spawn(function() {
                let message = new antvd.RpcHeartBeat();
                let avconvStats = yield antvd.ConverterPackage.getStats();
                message.addModuleStats("avconv", avconvStats);

                try {
                    yield message.send();
                } catch (ex) {
                    antvd.AntLib.logError(
                        "[RPC]: Failed to send the heartbeat request", ex);
                    throw new Error("Rpc request failed");
                }
            });
        };
    };

    (function() {
        /** @type AntHeartBeat */
        let inst = null;
        try {
            inst = new AntHeartBeat();
        } catch (ex) {
            antvd.AntLib.logError(
                "[Heartbeat]: Failed to startup the heartbeat"
                , ex);
        }

        /**
         * @static
         * @member init
         */
        AntHeartBeat.init = function ()
        {
            antvd.AntLib.toLog("Starting up hearbeat");
        
            if ( ! inst )
            {
                return;
            }
            
            inst.init();
        };

        /**
         * @static
         * @member deinit
         */
        AntHeartBeat.deinit = function() {
            antvd.AntLib.toLog("Shutting down hearbeat");
            if (!inst)
                return;
        };
    })();

    /** @expose */ antvd.AntHeartBeat = AntHeartBeat;
    return antvd;
})(antvd);
