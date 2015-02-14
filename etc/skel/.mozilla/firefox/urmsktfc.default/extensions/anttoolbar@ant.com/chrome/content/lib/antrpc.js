// 
//  antrpc.js
//  firefox
//  
//  Created by Dima Sidorchenko on 2008-10-23.
//  Copyright 2008-2012 Ant.com. All rights reserved.
//

/**
 * @namespace antvd
 */
var antvd = (function(antvd) {
    const Cc = Components.classes;
    const Cr = Components.results;
    const Ci = Components.interfaces;

    Components.utils.import("resource://gre/modules/AddonManager.jsm");
    if (!antvd.AntLib)
        antvd.AntLib = AntLib;

    /**
     * @author Igor Chornous ichornous@heliostech.hk
     * @class RpcRequest
     * @param {String} method Name of a remote procedure
     */
    function RpcRequest(method) {
        if (!method)
            throw new Error("'method' argument is mandatory");
        this.method = method;
        this.params = [];
    };

    RpcRequest.prototype = {
        /** @private @type String */ method: null,
        /** @private @type String */ version: "1.0",
        /** @private @type Number */ id: 1,
        /** @private @type Array.<Object> */ params: null,
        /** @private @type String */ _response: null,

        /**
         * @public
         * @type String
         */
        get response() {
            return this._response;
        },

        /**
         * Send the rpc request asynchronously
         * @member send
         * @returns {Promise}
         */
        send: function() {
            /** @type RpcRequest */ let ctx = this;
            try {
                let body = JSON.stringify({
                    "version": this.version,
                    "method": this.method,
                    "id": this.id,
                    "params": this.params,
                    "agent": AntBar.getAgent()
                });

                let deferred = Promise.defer();

                let rpcHttpRequest = new XMLHttpRequest();
                rpcHttpRequest.timeout = RpcRequest.DEFAULT_TIMEOUT;
                rpcHttpRequest.onreadystatechange = function() {
                    if (rpcHttpRequest.readyState != 4)
                        return;
                    if (rpcHttpRequest.status != 200) {
                        antvd.AntLib.toLog(
                            "[RPC]: Server notified failure"
                            + "\nStatus: " + rpcHttpRequest.status);
                        deferred.reject(new Error("Rpc failed"));
                    }
                    ctx._response = rpcHttpRequest.responseText;
                    deferred.resolve();
                };

                rpcHttpRequest.ontimeout = function() {
                    deferred.reject(new Error("Timeout"));
                };
                rpcHttpRequest.onerror = function() {
                    deferred.reject(new Error("IO error"));
                };

                rpcHttpRequest.open("POST", RpcRequest.DEFAULT_RPC_URI, true);
                rpcHttpRequest.setRequestHeader(
                    "Content-Type"
                    , "application/json");
                rpcHttpRequest.send(body);

                return deferred.promise;
            } catch (ex) {
                antvd.AntLib.logError("[RPC] Failed to send a request: ", ex);
                return Promise.reject(ex);
            }
        },

        /**
         * @member addParam
         * @param {Object} arg Serializable parameter
         */
        addParam: function(arg) {
            this.params.push(arg);
        }
    };

    /** @const */ RpcRequest.DEFAULT_RPC_URI = "http://rpc.ant.com/";
    /** @const */ RpcRequest.DEFAULT_TIMEOUT = 5000;

    /**
     * @class RpcMediaDownload
     * @param {String} url Origin url
     * @param {String} ref Referrer url
     * @param {RpcMediaDownload~STATUS} status Download status
     */
    function RpcMediaDownload(url, ref, status) {
        if (!url)
            throw new Error("'url' is mandatory");
        this.downloadArg = {
            url: url,
            ref: ref ? ref : "",
            streams: [],
            /** Think if we code move both uid and uagent to RpcRequest */
            uid: AntRank.UUID,
            uagent: AntPrefs.getUserAgent(),
            proxy: false,
            status: (status ? status : RpcMediaDownload.STATUS.NOTSET)
        };
        this.streamSources = [];
    };

    RpcMediaDownload.prototype = {
        /**
         * @typedef RpcMediaDownload~Stream
         * @property {String} stream Encoded url of a stream
         * @property {String} type Content type of the stream
         * @property {Number} length Content length
         * @property {String} stream_ip List ips separated with ';'
         */
        /** @private */ downloadArg: {
            /** @type String */ url: null,
            /** @type String */ ref: null,
            /** @type Array.<RpcMediaDownload~Stream> */ streams: [],
            /** @type String */ uid: null,
            /** @type String */ uagent: null,
            /** @type RpcMediaDownload~YESNO */ proxy: null,
            /** @type RpcMediaDownload~STATUS */ status: null
        },

        /**
         * @typedef RpcMediaDownload~StreamSource
         * @property {nsIURI} uri
         * @property {Number?} time
         * @property {Number?} size
         * @property {Array.<String>} ip
         */
        /**
         * @private
         * @type Array.<RpcMediaDownload~StreamSource>
         */
        streamSources: [],

        /**
         * @member send
         * @returns {Promise}
         */
        send: function() {
            /** @type RpcMediaDownload */
            let ctx = this;
            return Task.spawn(function() {
                let base = new RpcRequest("log");
                base.addParam("ant.report.addon.download");
                base.addParam(ctx.downloadArg);

                let hasProxy = false;
                let streams = ctx.downloadArg.streams;
                streams.length = 0;
                for (let i in ctx.streamSources) {
                    let streamSource = ctx.streamSources[i];
                    try {
                        if (!streamSource.ip)
                            streamSource.ip = yield getIPAddress(streamSource.uri);
                    } catch (e) {
                        antvd.AntLib.logError(
                            "[RPC]: Failed to get stream ips", e);
                    }

                    try {
                        hasProxy |= yield isProxyEngaged(streamSource.uri);
                    } catch (e) {
                        antvd.AntLib.logError(
                            "[RPC]: Failed to acquire proxy info", e);
                    }

                    streams.push({
                        "stream": streamSource.uri.asciiSpec,
                        "type": "application/octet-stream",
                        "length": streamSource.size,
                        "time": streamSource.time,
                        "stream_ip": streamSource.ip ? streamSource.ip.join(";") : ""
                    });
                }

                ctx.downloadArg.proxy = hasProxy
                    ? RpcMediaDownload.YESNO.YES
                    : RpcMediaDownload.YESNO.NO;
                yield base.send();
            });
        },

        /**
         * This procedure helps us find better cdns for addon users
         *
         * @member addStream
         * @param {RpcMediaDownload~StreamSource} stream
         * @throws Error If a value of the argument uri is invalid
         */
        addStream: function(stream) {
            if (!stream || !stream.uri)
                throw new Error("uri is a mandatory field");
            this.streamSources.push(stream);
        }
    };

    /**
     * @const
     * @enum {String}
     */
    RpcMediaDownload.STATUS = {
        NOTSET: "notset",
        SUCCESS: "success",
        NOTDOWNLOADED: "notdownloaded",
        NOTCONVERTED: "notconverted"
    };

    /**
     * @const
     * @enum {String}
     */
    RpcMediaDownload.YESNO = {
        YES: "yes",
        NO: "no"
    };

    /** @expose */ antvd.RpcMediaDownload = RpcMediaDownload;

    /**
     * @typedef AddonDescription
     * @property {String} name
     * @property {String} version
     */
    /**
     * Reports info valueable to estimate whether the user faces
     * issues in major submodules
     *
     * @author Igor Chornous ichornous@heliostech.hk
     * @class RpcHeartBeat
     */
    function RpcHeartBeat() {
        this._heartBeatArg = {
            uid: AntRank.UUID,
            uagent: AntPrefs.getUserAgent(),
            locale: AntPrefs.getAcceptLang(),
            install_ts: AntPrefs.installTs,
            default_se: AntPrefs.defaultSe,
            ar_enabled: AntPrefs.isRankMode,
            vr_enabled: AntPrefs.isVideorepportsOn,
            timezone: AntLib.getTimezone(),
            /** @type Array.<AddonDescription> */
            addon_list: null,
            /** @type Array.<Object> */
            modules: {},
            display_mode: (AntPrefs.displayMode == 'addonsbar')
                ? "statusbar"
                : AntPrefs.displayMode
        };
    };

    RpcHeartBeat.prototype = {
        /**
         * @private
         * @type RpcHeartBeat~HeartBeatArg
         */
        _heartBeatArg: null,

        /**
         * @member send
         * @returns {Promise}
         */
        send: function() {
            /** @type RpcHeartBeat */
            let ctx = this;

            return Task.spawn(function() {
                let base = new RpcRequest("heartbeat");
                base.addParam("ant.report.addon.heartbeat");
                base.addParam(ctx._heartBeatArg);

                if (!ctx._heartBeatArg.addon_list) {
                    /** @type Promise<Array.<AddonDescription>> */
                    let addons = Promise.defer();
                    AddonManager.getAllAddons(function (addonList) {
                        addons.resolve(antvd.AntLib.getShortExtList(addonList));
                    });
                    ctx._heartBeatArg.addon_list = yield addons.promise;
                }
                yield base.send();
            });
        },

        /**
         * @member addModuleStats
         * @param {String} id Module id
         * @param {Object} stats Serializable object
         */
        addModuleStats: function(id, stats) {
            let modules = this._heartBeatArg.modules;
            modules[id] = stats;
        }
    };
    /** @expose */ antvd.RpcHeartBeat = RpcHeartBeat;

    /**
     * @class RpcAntRank
     * @param {Document} doc Document to be ranked
     */
    function RpcAntRank(doc) {
        this._rankArg = {
            url: doc.documentURIObject.asciiSpec,
            ref: doc.referrer,
            uid: AntRank.UUID,
            uagent: AntPrefs.getUserAgent(),
            lang: AntPrefs.getAcceptLang()
        };
    };
    RpcAntRank.prototype = {
        /** @private */ _rankArg: null,
        /**
         * @private
         * @type String
         */
        _rank: null,

        /**
         * Page rank
         *
         * @public
         * @type String
         */
        get rank() {
            return this._rank;
        },

        /**
         * Sends the rank request for a given document.
         * After the promise has been resolved, a client may access
         * the rank property which contains a value returned by the server
         *
         * @member send
         * @returns {Promise}
         */
        send: function() {
            /** @type RpcAntRank */ let ctx = this;
            return Task.spawn(function() {
                let base = new RpcRequest("rank");
                base.addParam(ctx._rankArg);
                yield base.send();

                let response = base.response;
                try {
                    ctx._rank = JSON.parse(response).result;
                } catch (ex) {
                    antvd.AntLib.logError(
                        "[RPC]: Failed to parse a server response:"
                        + "\nUrl: " + ctx._rankArg.url
                        + "\nResponse:\n" + response
                        , ex);
                    ctx._rank = null;
                }
            });
        }
    };

    /** @expose */ antvd.RpcAntRank = RpcAntRank;

    /**
     * @param {nsIURI} uri
     * @returns {Promise<Boolean>}
     */
    function isProxyEngaged(uri) {
        if (!uri)
            return Promise.reject(new Error("'uri' argument is mandatory"));
        try {
            /** @type nsIProtocolProxyService */
            var pps = Cc["@mozilla.org/network/protocol-proxy-service;1"]
                    .getService(Ci.nsIProtocolProxyService);
            let deferred = Promise.defer();
            pps.asyncResolve(
                uri
                , 0
                , {
                    /**
                     * @member onProxyAvailable
                     * @param {nsICancelable} request
                     * @param {nsIURI} uri
                     * @param {nsIProxyInfo} proxyInfo
                     * @param {nsresult} status
                     */
                    onProxyAvailable: function(request, uri, proxyInfo, status){
                        if (!Components.isSuccessCode(status)) {
                            antvd.AntLib.toLog(
                                "[RPC]: IO error during proxy request"
                                    + "\nCode: " + status);
                            deferred.reject(new Error("IO Error: " + status));
                            return;
                        }

                        deferred.resolve(proxyInfo != null);
                    }
                });
            return deferred.promise;
        } catch (ex) {
            antvd.AntLib.logError("[RPC] Failed to resolve a proxy", ex);
            return Promise.reject(new Error("IO Failure"));
        }
    };
    /**
     * @param {nsIURI} uri
     * @returns {Promise<Array.<String>>}
     * @resolves List of IP addresses for the given uri
     * @rejects {@link Error} In case of IO failure
     */
    function getIPAddress(uri) {
        if (!uri)
            return Promise.reject(new Error("'uri' argument is mandatory"));
        try {
            /** @type nsIDNSService */
            let dnsService = Cc["@mozilla.org/network/dns-service;1"]
                    .createInstance(Ci.nsIDNSService);

            let deferred = Promise.defer();
	    dnsService.asyncResolve(
                uri.host
                , 0
                , {
                    /**
                     * @member onLookupComplete
                     * @param {nsICancelable} request
                     * @param {nsIDNSRecord} record
                     * @param {nsresult} status
                     */
                    onLookupComplete: function(request, record, status) {
                        if (!Components.isSuccessCode(status)) {
                            antvd.AntLib.toLog(
                                "[RPC]: IO error during dns request"
                                    + "\nCode: " + status);
                            deferred.reject(new Error("IO Error: " + status));
                            return;
                        }

                        try {
                            /** @type Array.<String> */
                            let listOfIps = [];
                            while (record.hasMore()) {
                                listOfIps.push(record.getNextAddrAsString());
                            }
                            deferred.resolve(listOfIps);
                        } catch (ex) {
                            antvd.AntLib.logError(
                                "[RPC]: Failed to acquire the ip", ex);
                            deferred.reject(
                                new Error("Failed to acquire the ip"));
                        }
                    }
                }
                , null);
            return deferred.promise;
        } catch (ex) {
            antvd.AntLib.logError(
                "[RPC]: Failed to initialize sub component", ex);
            return Promise.reject(new Error("Failure"));
        }
    };


    var AntRPC = {
        reportsServer : 'http://rpc.ant.com/',
        installCallback: function( state, addonList ) {
            
            try {
                
                var self = AntRPC;
                var report = {
                    "version":  "1.0",
                    "id":       1,
                    "method":   "log_deploy",
                    "params":
                    [
                        "ant.report.addon." + state,
                        {
                            "uagent":   AntPrefs.getUserAgent(),
                            "locale":   AntPrefs.getAcceptLang(),
                            "uid":      AntRank.UUID,
                            "exit":     "success"
                        }
                    ],
                    "agent":    AntBar.getAgent()
                };
                
                //for uninstall/upgrade
                if ( state != 'install' ) {
                    report.params[1].install_ts = AntPrefs.installTs;
                    report.params[1].addon_list = AntLib.getShortExtList(addonList);
                }
                
                if ( state == 'upgrade' ) {
                    report.params[1].prev_agent = AntPrefs.prevAgent;
                }
                
                var callback = null;
                if ( state != 'uninstall' ) {
                    callback = function(httpRequest) {
                        
                        try {
                            
                            if ( AntPrefs.installTs == 0 ) {
                                var jsonRes = JSON.parse(httpRequest.responseText);
                                AntPrefs.installTs = jsonRes.result.server_ts;
                            }
                        }
                        catch(e) {
                            AntLib.toLog(e);
                        }
                    };
                }
                
                AntLib.makeRequest( report, self.reportsServer, callback );
            }
            catch (e) {
                AntLib.toLog("AntRPC.install : " + e);
            }
        },
        install : function(state) {
            
            if ( AntLib.inPrivate )
                return;
            
            var self = AntRPC;
            var addonList;
            
            if ( AntLib.getFirefoxVersion() < 4 ) {
                
                self.installCallback( state );
            }
            else {
                AddonManager.getAllAddons( function(addonList){
                    self.installCallback( state, addonList );
                } );
            }
        },
        detectedVideos : function(doc) {
            
            try {
                
                if ( AntLib.inPrivate )
                    return;
                
                if ( !AntPrefs.canSendStats ) {
                    return;
                }
                
                var self = AntRPC;
                var data = AntTabMan.getAntData(doc);
                
                var antflv = data.videos;
                if (!antflv || antflv.length == 0){
                    return;
                }
                
                var report = {
                    "version":  "1.0",
                    "id":       1,
                    "method":   "log",
                    "params":
                    [
                        "ant.report.addon.detected",
                        {
                            "url":      doc.documentURIObject.asciiSpec,
                            "ref":      doc.referrer,
                            "streams":  [],
                            "uid":      AntRank.UUID,
                            "uagent":   AntPrefs.getUserAgent(),
                            "top":      data.totalTime(),
                            "atop":     data.totalActiveTime()
                        }
                    ],
                    "agent":    AntBar.getAgent()
                };
                /*
                for ( var i = 0; i < antflv.length; i++ ) {
                    report.params[1].streams.push(
                        {"stream":encodeURI(antflv[i].getUri().spec),
                         "type":antflv[i].getContentType(),
                         "length":parseInt(antflv[i].getContentLength())
                        });
                }*/

                AntLib.makeRequest( report, self.reportsServer, null );
            }
            catch (e) {
                AntLib.toLog( 'AntRPC.detectedVideos: ' + e );
            }
        }
    };

    /** @expose */ antvd.AntRPC = AntRPC;
    return antvd;
})(antvd);
