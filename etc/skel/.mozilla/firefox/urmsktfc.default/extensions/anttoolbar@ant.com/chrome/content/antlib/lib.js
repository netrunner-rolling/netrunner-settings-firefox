// 
//  lib.js
//  firefox
//  
//  Created by Zak on 2008-06-12.
//  Contributor BK
//  Copyright 2008-2016 Ant.com. All rights reserved.
//

var AntLib =
{
    emGUID : "anttoolbar@ant.com",
    
    internalPrepareConsoleMessage: function(sContext, sMessage)
    {
        let _message = "AVD-FF " + g_AVDFFVersionString + ": ";
        
        if ( (typeof sContext === "string") && (sContext.length > 0) )
        {
            _message = "AVD-FF " + g_AVDFFVersionString + " / " + sContext + ": ";
        }
        
        _message = _message + sMessage;
        
        return _message;
    },
    
    toLog: function (sContext, sMessage)
    {
        Components.utils.import('resource://gre/modules/devtools/Console.jsm', this);
        
        if (AntPrefs)
        {
            if (AntPrefs.getAntBranch().getBoolPref('debug'))
            {
                let _message = this.internalPrepareConsoleMessage(sContext, sMessage);

                console.log(_message);
            }
        }
    },
    
    logError: function(sContext, sMessage, sE)
    {
        Components.utils.import('resource://gre/modules/devtools/Console.jsm');
        
        if (AntPrefs)
        {
            if (AntPrefs.getAntBranch().getBoolPref('debug'))
            {
                let _message = this.internalPrepareConsoleMessage(sContext, sMessage);

                if (sE)
                {
                    _message = _message + "\nError: " + sE;
                    
                    if (sE.result)
                    {
                        _message = _message + "\nResult: " + sE.result;
                    }
                    
                    if (sE.stack)
                    {
                        _message = _message + "\nStack: " + sE.stack;
                    }
                }
                
                console.error(_message);
            }
        }
    },
    
    logWarning: function(sContext, sMessage, sE)
    {
        Components.utils.import('resource://gre/modules/devtools/Console.jsm');
        
        if (AntPrefs)
        {
            if (AntPrefs.getAntBranch().getBoolPref('debug'))
            {
                let _message = this.internalPrepareConsoleMessage(sContext, sMessage);

                if (sE)
                {
                    _message = _message + "\nError: " + sE;
                    
                    if (sE.result)
                    {
                        _message = _message + "\nResult: " + sE.result;
                    }
                    
                    if (sE.stack)
                    {
                        _message = _message + "\nStack: " + sE.stack;
                    }
                }
                
                console.warn(_message);
            }
        }
    },

    openURL: function (url)
    {
        if (arguments.length > 1 && arguments[1])
        {
            getBrowser().selectedTab = getBrowser().addTab(url);
        }
        else
        {
            window._content.document.location = url;
            window.content.focus();
        }
    },

    uriEncode: function (input)
    {
        var self = AntLib;
        var output = encodeURIComponent(input);
        return output;
    },

    openDialog: function (url, windowType, features, arg1, arg2)
    {
        var self = AntLib;
        var wm = self.CCSV("@mozilla.org/appshell/window-mediator;1", "nsIWindowMediator");
        var win = windowType ? wm.getMostRecentWindow(windowType) : null;

        if (win)
        {
            if ("initWithParams" in win)
            {
              win.initWithParams(aParams);
            }
            
            win.focus();
        }
        else
        {
            var winFeatures = "resizable,dialog=no,centerscreen" + (features ? ("," + features) : "");

            var parentWindow = (self.instantApply || !window.opener || window.opener.closed) ? window : window.opener;

            win = parentWindow.openDialog(url, "_blank", winFeatures, arg1, arg2);
        }

        return win;
    },

    MAX_FILE_NAME: 255,
    MAX_FILE_PATH: 300,

    /**
     * Ensures that the full filename is no more than MAX_FILE_NAME symbols
     *
     * @private
     * @member mangleFileName
     * @param {String} fileName
     * @param {String} [fileExtension=null]
     * @return {String} Full file name
     */
    mangleFileName: function(fileName, fileExtension)
    {
        let fileExtLen = fileExtension ? (1 + fileExtension.length) : 0;
        let mangledName = fileName;
        const maxFullNameLen = AntLib.MAX_FILE_NAME;

        if (fileName.length + fileExtLen > maxFullNameLen)
        {
            mangledName = AntLib.truncate(fileName, maxFullNameLen - fileExtLen, "~");
        }

        if (fileExtLen)
        {
            return mangledName + "." + fileExtension;
        }
        
        return mangledName;
    },
    
    truncate: function (str, maxLength, separator)
    {
        if (!str || (str.length <= maxLength))
        {
            return str;
        }

        separator = separator || '...';

        var sepLen = separator.length,
            charsToShow = maxLength - sepLen,
            frontChars = Math.ceil(charsToShow/2),
            backChars = Math.floor(charsToShow/2);

        return str.substr(0, frontChars) + separator + str.substr(str.length - backChars);
    },

    getSiteName: function (locationObj)
    {
        var self = AntLib;
        var hostname = self.safeGet(locationObj, "hostname");

        try
        {
            // Only available in Firefox 3
            var eTLDService = self.CCSV("@mozilla.org/network/effective-tld-service;1", "nsIEffectiveTLDService");
            var suff = eTLDService.getPublicSuffixFromHost(hostname);
            var endPos = hostname.indexOf(suff);
            hostname = hostname.substring(0, endPos-1);
            var startPos = hostname.lastIndexOf('.');
            
            if(startPos > -1)
            {
                hostname =  hostname.substring(startPos+1, hostname.length);
            }
        }
        catch (e)
        {
            var index;
            
            index = hostname.lastIndexOf(".");
            
            if (index > -1)
            {
                hostname = hostname.substring(0, index);
            }
            
            index = hostname.lastIndexOf(".");
            
            if (index > -1)
            {
                hostname = hostname.substring(index + 1);
            }
        }
        
        return hostname;
    },

    getDomain: function (strURL)
    {
        var domain;
        var self = AntLib;
        
        try
        {
            var uri = AntLib.toURI(strURL);
            
            try
            {
                var eTLDService = self.CCSV("@mozilla.org/network/effective-tld-service;1", "nsIEffectiveTLDService");
                
                try
                {
                    domain = eTLDService.getBaseDomain(uri, 1);
                }
                catch (e)
                {
                    if ( e.name != 'NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS')
                    {
                        throw e;
                    }
                    
                    domain = eTLDService.getBaseDomain(uri);
                }
                
                domain = domain.replace( /^www./i, '' );
            }
            catch (e)
            {
                var host = uri.host;
                var TLD = host.substring(host.lastIndexOf('.')+1, host.length);
                var hostNoTLD = host.substring(0, host.lastIndexOf('.'));
                
                domain = TLD;
                
                //including 3 subdomains maximum
                var sdCount = 3;

                while ( sdCount )
                {
                    var index = hostNoTLD.lastIndexOf('.');
                
                    if ( index == -1 )
                    {
                        if ( hostNoTLD != 'www'  )
                        {
                            domain = hostNoTLD + '.' + domain;
                        }
                        
                        break;
                    }
                    
                    var secLevDomain = hostNoTLD.substring( index + 1, hostNoTLD.length );
                    domain = secLevDomain + '.' + domain;
                    hostNoTLD = hostNoTLD.substring( 0, index );
                    sdCount--;
                }
            }
        }
        catch (e)
        {
            return null;
        }
        
        return domain;
    },

    getTabForURL: function(url)
    {
        var uri = AntLib.toURI(url);
        var tabs = gBrowser.tabContainer.childNodes;
        
        for (let i = 0; i < tabs.length; ++i)
        {
            let tab = tabs[i];
        
            if (gBrowser.getBrowserForTab(tab).currentURI.equals(uri))
            {
                return tab;
            }
        }
        
        return null;
    },

    /**
     * @private
     * @member deductExtention
     * @param {String} contentType
     * @returns {String}
     */
    deductExtension: function(contentType)
    {
        const knownExtensions = [
            "flv", "mp4", "m4v", "m4a", "f4v", "mp3", "mov", "webm", "wmv", "ogg", "ogv", "avi", "3gpp"
        ];

        const reContentType = new RegExp("[^\\/]+\\/(x-)?(" + knownExtensions.join("|") + ")", "i");

        if (contentType)
        {
            if (contentType.match(/audio\/(x-)?(mpeg|mpg)/i))
            {
                return "mp3";
            }

            var cmatch = contentType.match(reContentType);
            
            if (cmatch)
            {
                return cmatch[2].toLowerCase();
            }
        }

        return "flv";
    },

    /**
     * Searches a window which opened the channel
     * @member getWindowByRequest
     * @param {nsIChannel} channel
     * @returns {nsIDomWindow} Owning window
     */
    getWindowByRequest: function(request)
    {
        // TODO(ICh): move to the outer scope
        const Ci = Components.interfaces;
        const Cc = Components.classes;

        // type Array.<nsIInterfaceRequestor>
        let clients = [
            request.notificationCallbacks,
            request.loadGroup ? request.loadGroup.notificationCallbacks : null
        ];

        let lastError = null;

        for (let i in clients)
        {
            let client = clients[i];
        
            if (!client || !client.getInterface)
            {
                continue;
            }

            try
            {
                return client.getInterface(Ci.nsILoadContext).associatedWindow;            
            }
            catch (ex)
            {
                lastError = ex;
                
                //AntLib.logError(
                //    "AntLib.getWindowByRequest (lib.js)",
                //    "Error obtaining associatedWindow (1st chance)",
                //    ex
                //);
                
                if (request instanceof Components.interfaces.nsIRequest)
                {
                    try
                    {
                        if (request.notificationCallbacks)
                        {
                            let _i = request.notificationCallbacks.getInterface(Components.interfaces.nsILoadContext);
                            return _i.associatedWindow;
                        }
                    }
                    catch(e)
                    {
                        //AntLib.logError(
                        //    "AntLib.getWindowByRequest (lib.js)",
                        //    "Error obtaining associatedWindow (2nd chance)",
                        //    ex
                        //);
                    }
                        
                    try
                    {
                        if (request.loadGroup && request.loadGroup.notificationCallbacks)
                        {
                            let _i = request.loadGroup.notificationCallbacks.getInterface(Components.interfaces.nsILoadContext);
                            return _i.associatedWindow;
                        }
                    }
                    catch(e)
                    {
                        //AntLib.logError(
                        //    "AntLib.getWindowByRequest (lib.js)",
                        //    "Error obtaining associatedWindow (3rd chance)",
                        //    ex
                        //);
                    }
                }
                
                return null;
            }
        }

        return null;
    },

    /**
     * @member getDocumentByRequest
     * @param {nsIChannel} request
     * @returns {nsIDOMWindow}
     */
    getDocumentByRequest: function (request)
    {
        var self = AntLib;
        var window = self.getWindowByRequest(request);
        
        if (!window)
        {
            return null;
        }
        
        return window.top.document;
    },

    /**
     * @member getUploadStream
     * @param {nsIHttpChannel} channel
     * @return {nsIInputChannel}
     */
    getUploadStream: function (channel)
    {
        const Ci = Components.interfaces;
        const Cc = Components.classes;

        try
        {
            return channel.QueryInterface(Ci.nsIUploadChannel).uploadStream;
        }
        catch (e)
        {
            return null;
        }
    },

    /**
     * Get main browser window, use in order to bypass security context
     */
    getMainWindow: function ()
    {
        var mainWindow = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIWebNavigation)
        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
        .rootTreeItem
        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
        .getInterface(Components.interfaces.nsIDOMWindow);

        return mainWindow;
    },
    
    /**
     * Get the most recent browser window
     */
    getMostRecentBrowserWindow: function ()
    {
        var self = AntLib;
        var wm = self.CCSV("@mozilla.org/appshell/window-mediator;1", "nsIWindowMediator");
        var mainWindow = wm.getMostRecentWindow("navigator:browser");

        return mainWindow;
    },
    
    /*
     * enumerates all tabs in all windows and calls @callback with its instance
     * if callback returns 'true' - breaking the enumeration
     */
    forEachDocument: function( callback, types )
    {
        var self = AntLib;

        if ( !types )
        {
            types = ['navigator:browser'];
        }
        
        var wm = self.CCSV( '@mozilla.org/appshell/window-mediator;1', 'nsIWindowMediator' );
        
        for ( var i = 0; i < types.length; ++i )
        {
            var browserEnumerator = wm.getEnumerator( types[i] );
            
            while ( browserEnumerator.hasMoreElements() )
            {
                var browserWin = browserEnumerator.getNext();
                var tabbrowser = browserWin.gBrowser;
                
                if ( !tabbrowser )
                {
                    var wnd = browserWin.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                        .getInterface(Components.interfaces.nsIWebNavigation)
                                        .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                                        .rootTreeItem
                                        .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                        .getInterface(Components.interfaces.nsIDOMWindow);
                    
                    if ( callback(wnd.document) )
                    {
                        return;
                    }
                    
                    continue;
                }
                
                var tabs = tabbrowser.tabContainer;
                var length = tabs.itemCount;

                for ( var i = 0; i < length; i++ )
                {
                    if ( callback( tabs.getItemAtIndex(i).linkedBrowser.contentDocument ) )
                    {
                        return;
                    }
                }
            }
        }
    },
    
    /**
     * Returns "WINNT" on Windows Vista, XP, 2000, and NT systems
     * "Linux" on GNU/Linux; and "Darwin" on Mac OS X.
     * @return string The Name of the opertating system
     */
    getOsName: function ()
    {
        var self = AntLib;
        return self.CCSV("@mozilla.org/xre/app-info;1", "nsIXULRuntime").OS;
    },
    
    /*
     * returns time zone
     */
    getTimezone: function()
    {
        var rightNow = new Date();
        var jan1 = new Date(rightNow.getFullYear(), 0, 1, 0, 0, 0, 0);
        var temp = jan1.toGMTString();
        var jan2 = new Date( temp.substring(0, temp.lastIndexOf(" ")-1) );
        var stdTimeOffset = (jan1 - jan2) / (1000 * 60 * 60);
        var offsetStr = "GMT";

        offsetStr += (stdTimeOffset >= 0) ? '+' : '';
        offsetStr += stdTimeOffset.toString();
        
        return offsetStr;
    },

    makeRequest: function(requestObj, address, onLoadCallback)
    {
        var self = AntLib;
        var body = JSON.stringify(requestObj);
        
        //this method used from XPCOM, so getting XMLHttpRequest in the following way:
        var httpRequest = self.CCIN('@mozilla.org/xmlextras/xmlhttprequest;1', 'nsIXMLHttpRequest');
        
        if (onLoadCallback)
        {
            httpRequest.onload = function () { onLoadCallback(httpRequest); };       
        }
        
        httpRequest.open('POST', address, true);
        httpRequest.setRequestHeader('Content-Type', 'application/json');
        httpRequest.send(body);
    },
    
    /* TODO Update for Firefox 4+ */
    getExtensionsList: function()
    {
        var self = AntLib;
        var extMan = AntLib.CCSV("@mozilla.org/extensions/manager;1", "nsIExtensionManager");
        var list = extMan.getItemList(AntLib.CI('nsIUpdateItem')["TYPE_EXTENSION"], {});
        return list;
    },  

    getShortExtList: function(list)
    {
        var self = AntLib;
        
        if ( list == undefined )
        {
          list = self.getExtensionsList();
        }
        
        var resList = [];

        for each(var ext in list)
        {
            resList.push({'name':ext.name, 'version':ext.version });
        }

        return resList;
    },

    getExtListString: function(list)
    {
        var self = AntLib;
        
        if ( list == undefined )
        {
            list = self.getExtensionsList();
        }
        
        var result = [];

        for each(var ext in list)
        {
            result.push(ext.name+'_'+ext.version );
        }

        return result.join(',');
    },
    
    /**
    * @return float like 4 or 3.6
    */
    getFirefoxVersion: function()
    {
        var fv = parseFloat(navigator.userAgent.match(/Firefox\/([0-9]{1,}\.[0-9])/)[1]);
        return fv;
    },

    /* Asynchronous function to get meta information about the add-on
      aParameter (function) aCallback A function to call, passing the add-on data
     */
    getExtensionVersion : function(aCallback)
    {
        var self = AntLib;

        try
        {
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
            AddonManager.getAddonByID(self.emGUID, function(addon) { aCallback(addon.version, addon.creator.name); });
        }
        catch (e)
        {
            var extMan = self.CCSV("@mozilla.org/extensions/manager;1", "nsIExtensionManager");
            var ext = extMan.getItemForID(self.emGUID);
            aCallback(ext.version);
        }
    },
    
    /**
     * convert string path to nsIURI
     */
    toURI: function(url)
    {
        return AntLib.CCSV("@mozilla.org/network/io-service;1", "nsIIOService").newURI( url, "UTF-8", null );
    },

    createChannelFromURL: function(url)
    {
        var ioService = AntLib.CCSV("@mozilla.org/network/io-service;1", "nsIIOService");
        var uri = ioService.newURI(url, "UTF-8", null);

        return ioService.newChannelFromURI(uri);
    },
    
    /**
     * convert nsIURL to path
     */
    urlToPath: function (path)
    {
        var ph = Components.classes["@mozilla.org/network/protocol;1?name=file"].createInstance(Components.interfaces.nsIFileProtocolHandler);
        
        return ph.getFileFromURLSpec(path).path;
    },
    
    /**
     * returns path to local file for crome Url
     * @param path path like chrome://filename
     */
    chromeToPath: function (path)
    {
        var self = AntLib;
        var uri = self.toURI(path);
        
        var cr = self.CCSV('@mozilla.org/chrome/chrome-registry;1', 'nsIChromeRegistry');
        var fileURI = cr.convertChromeURL(uri).spec;
        
        return AntLib.urlToPath(fileURI);
    },
    
    /**
     * Converts a number of bytes to the appropriate unit that results in a
     * number that needs fewer than 4 digits
     *
     * NB: The commented part is only available on FF3
     *
     * @param aBytes
     *        Number of bytes to convert
     * @return A pair: [new value with 3 sig. figs., its unit]
     */
    convertByteUnits: function (aBytes)
    {
        var unitIndex = 0;
        var units = ["B", "KB", "MB", "GB"];
        
        while ((aBytes >= 999.5) && (unitIndex < units.length - 1))
        {
            aBytes /= 1024;
            unitIndex++;
        }

        aBytes = aBytes.toFixed((aBytes > 0) && (aBytes < 100) ? 1 : 0);

        return [aBytes, units[unitIndex]];
    },
    
    /*
     * Open a file using external protocol service
     */
    openExternal: function (aFile)
    {
        var uri = Cc["@mozilla.org/network/io-service;1"].
        getService(Ci.nsIIOService).newFileURI(aFile);
     
        var protocolSvc = Cc["@mozilla.org/uriloader/external-protocol-service;1"].
        getService(Ci.nsIExternalProtocolService);
        protocolSvc.loadUrl(uri);
    },
    
    /**
     * Trim a string
     */
    trim: function (str)
    {
        var r = str;
      
        if (!r)
        {
            return '';
        }
        
        r = r.replace(/^\s+/, '');
        r = r.replace(/\s+$/, '');
        r = r.replace(/\s+/g, ' ');
      
        return r;
    },
    
    /**
     * replacing with spaces unaccepted OS specified characters in the string
     */
    sanitize: function (str)
    {
        //windows: \/:*?"<>|
        //mac: :/
        //linux: /
        
        var self = AntLib;
        var os = self.getOsName();
        var replaceRex;

        switch (os)
        {
            case "WINNT":
                replaceRex = /\\|\/|:|\*|\?|\"|<|>|\|/g;
                break;
            case "Darwin":
                replaceRex = /\/|:/g;
                break;
            default: // all others, mostly unix variants
                replaceRex = /\//g;
        }

        return str.replace( replaceRex, ' ' );
    },
    
    sprintf: function()
    {
        var args = arguments, string = args[0], i = 1;
        
        return string.replace(/%((%)|s|d)/g, function (m)
        {
            // m is the matched format, e.g. %s, %d
            var val = null;
            
            if (m[2])
            {
                val = m[2];
            }
            else
            {
                val = args[i];

                // A switch statement so that the formatter can be extended. Default is %s
                switch (m)
                {
                    case '%d':
                        val = parseFloat(val);
                        
                        if (isNaN(val))
                        {
                            val = 0;
                        }
                        
                    break;
                }
            
                i++;
            }
            
            return val;
        });
    },
    
    // Concats two relative URLs into single one
    concatAndResolveUrl: function(url, concat)
    {
        var url1 = url.split('/');
        var url2 = concat.split('/');
        var url3 = [ ];
        
        for(var i = 0, l = url1.length; i < l; i ++)
        {
            if (url1[i] == '..')
            {
                url3.pop();
            }
            else if (url1[i] == '.')
            {
                continue;
            }
            else
            {
                url3.push(url1[i]);
            }
        }
        
        for (var i = 0, l = url2.length; i < l; i ++)
        {
            if (url2[i] == '..')
            {
                url3.pop();
            }
            else if (url2[i] == '.')
            {
                continue;
            }
            else
            {
                url3.push(url2[i]);
            }
        }
        
        return url3.join('/');
    },
    
    /**
     * Safely get a property using try/catch block
     * @param obj           The object to get the property from
     * @param prop          The property to get
     * @return property     The value or an empty string
     */
    safeGet: function(obj, prop)
    {
        var property;
        
        try
        {
            property = obj[prop];
        } 
        catch (e)
        {
            property = '';
        }
        
        return property;
    },
    
    /* This function returns the user profile folder */
    getProfileFolder: function()
    {
        var p;
        var NSIFILE = Components.interfaces.nsIFile;
        var dirLocator = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties);
        p = dirLocator.get("ProfD", NSIFILE).path;
        var dirLocal;

        // requires Gecko 14
        try
        { 
            dirLocal = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
            dirLocal.initWithPath(p);
        }
        catch(e)
        {
            dirLocal = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
            dirLocal.initWithPath(p);
        }
        
        if (dirLocal.exists() && dirLocal.isDirectory())
        {
            return dirLocal;
        }

        return null;
    },
    
    
    _CI: Components.interfaces,
    _CC: Components.classes,
    
    /**
     * Helpers to acces Mozilla Interfaces, Classes and Services
     */
    CC: function(cName)
    {
        var self = AntLib;
        return self._CC[cName];
    },

    CI: function(ifaceName)
    {
        var self = AntLib;
        return self._CI[ifaceName];
    },

    CCSV: function(cName, ifaceName)
    {
        var self = AntLib;
        return self._CC[cName].getService(self._CI[ifaceName]);    
    },
    
    CCIN: function(cName, ifaceName)
    {
        var self = AntLib;
        return self._CC[cName].createInstance(self._CI[ifaceName]);
    },
    
    QI: function(obj, iface)
    {
        return obj.QueryInterface(iface);
    },
    
    GI: function (obj, iface)
    {
        try
        {
            return obj.getInterface(iface);
        }
        catch (e)
        {
            if (e.name == "NS_NOINTERFACE") {}
        }
        
        return null;
    },
    
    /**
     * Abstract for the getElementById function
     * @param id            The id to look for
     * @param doc           (Optional) Search in the specified scope instead of document
     */
    ob: function (id, doc)
    {
        var self = AntLib;
        var ret;
        
        if (doc == undefined)
        {
            ret = document.getElementById(id);
        }
        else
        {
            ret = doc.getElementById(id);
        }
        
        return ret;
    },
    
    registerNS: function(ns)
    {
        var nsParts = ns.split(".");
        var root = window;
        
        for(var i=0; i<nsParts.length; i++)
        {
            if(typeof root[nsParts[i]] == "undefined")
            {
                root[nsParts[i]] = new Object();
            }
            
            root = root[nsParts[i]];
        }
    },
    
    /*
     * returns integer value between min and max
     */
    getRandomInt: function(min, max)
    {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /*
     * syntesize mouse event
     */
    synthesizeMouse: function(type, el, offX, offY, clicks)
    {
        var utils = window.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowUtils);        
        var x, y;

        if ( el )
        {
            var rect = el.getBoundingClientRect();

            if ( typeof(offX) == 'number' )
            {
                x = rect.left + offX;
            }
            else if ( typeof(offX) == 'function' )
            {
                x = offX(rect);
            }
            else
            {
                x = rect.left;
            }
            
            if ( typeof(offY) == 'number' )
            {
                y = rect.top + offY;
            }
            else if ( typeof(offY) == 'function' )
            {
                y = offY(rect);
            }
            else
            {
                y = rect.top;
            }
        }
        else
        {
            x = offX | 0;
            y = offY | 0;
        }
        
        if ( clicks === undefined )
        {
            clicks = 1;
        }
        
        if ( type == 'click' )
        {
            for ( let i = 0; i < clicks; i++ )
            {
                utils.sendMouseEvent('mousedown', x, y, 0, 1, 0);
                utils.sendMouseEvent('mouseup', x, y, 0, 1, 0);
            }
        }
        else
        {
            utils.sendMouseEvent(type, x, y, 0, clicks, 0);
        }
    },
    
    streamToData: function(stream)
    {
        stream.QueryInterface( AntLib._CI['nsISeekableStream'] ).seek( AntLib._CI['nsISeekableStream'].NS_SEEK_SET, 0 );
        var bynStream = AntLib.CCIN( '@mozilla.org/binaryinputstream;1', 'nsIBinaryInputStream' );

        bynStream.setInputStream( stream );
        
        return bynStream.readByteArray( bynStream.available() );
    },

    /* returns true, if browser in private mode.
     * otherwise - false
     */
    get inPrivate()
    {
        try
        {
            Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");

            return PrivateBrowsingUtils.isWindowPrivate(window);
        }
        catch(e)
        {
            AntLib.logError("Failed to get the privacy context", e);
            return false;
        }
    },
    
    /*
     * retrievs first ip of the host
     */
    ipOf: function(url)
    {
        var self = AntLib;
        var dnsService = self.CCIN( '@mozilla.org/network/dns-service;1', 'nsIDNSService' );
        var hostname = self.CCIN( '@mozilla.org/supports-string;1', 'nsISupportsString' ); 

        hostname.data = self.toURI(url).host;
        
        var ips = dnsService.resolve( hostname, 0 );
        return ips && ips.hasMore() ? ips.getNextAddrAsString() : '';
    },
    
    // Converts string in Base64 encoding into Blob object
    Base64ToBlob: function(b64Data, contentType, sliceSize)
    {
        contentType = contentType || '';
        sliceSize = sliceSize || 512;
        
        var byteCharacters = atob(b64Data);
        var byteArrays = [];

        for (var offset = 0; offset < byteCharacters.length; offset += sliceSize)
        {
            var slice = byteCharacters.slice(offset, offset + sliceSize);
            var byteNumbers = new Array(slice.length);
            
            for (var i = 0; i < slice.length; i++)
            {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            
            var byteArray = new Uint8Array(byteNumbers);
            
            byteArrays.push(byteArray);
        }
        
        var blob = new Blob(byteArrays, {type: contentType});
        
        return blob;
    },
    
    convertDataURIToBinary: function(dataURI)
    {
        var BASE64_MARKER = ';base64,';
        var base64Index = dataURI.indexOf(BASE64_MARKER);
        var base64 = dataURI;
        
        if (base64Index > -1)
        {
            base64 = dataURI.substring(base64Index + BASE64_MARKER.length);
        }
        
        var raw = window.atob(base64);
        var rawLength = raw.length;
        
        var array = new Uint8Array(new ArrayBuffer(rawLength));
        
        for(i = 0; i < rawLength; i++)
        {
            array[i] = raw.charCodeAt(i);
        }

        return array;
    },
    
    isURL: function(Link)
    {
        if (Link == null)
        {
            return false;
        }
        
        if (Link.length == 0)
        {
            return false;
        }
        
        return Link.match(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/ig);
    },
    
    startsWithHTTP: function(Link)
    {
        if (Link == null)
        {
            return false;
        }
        
        if (Link.length == 0)
        {
            return false;
        }
        
        let _l = Link.toLowerCase();
        
        return (_l.startsWith("http://") || _l.startsWith("https://"));
    }
};
