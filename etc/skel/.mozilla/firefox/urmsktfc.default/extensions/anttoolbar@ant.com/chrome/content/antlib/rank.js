// 
//  rank.js
//  firefox
//  
//  Created by Seed on 2008-10-23.
//  Contributor Brian King
//  Copyright 2008-2016 Ant.com. All rights reserved.
// 
var AntRank =
{
    url: null,
    rankButton: null,

    init: function ()
    {
        var self = AntRank;

        try
        {
            AntWatchUrl.addWatcher(self.updateRank);
        }
        catch (e)
        {
            AntLib.logWarning("AntRank.init (rank.js)", "Initializing failed", e);
        }
    },

    // @param bool hideIt - if true rank will hide otherwise will show
    hideUI: function (hideIt)
    {
        var status = AntPrefs.displayMode;

        switch (status)
        {
            case 'toolbar':
                document.getElementById('ant-toolbar-rank-img').hidden = hideIt;
                document.getElementById('ant-toolbar-rank-separator').hidden = hideIt;
                document.getElementById('ant-toolbar-rank-label').hidden = hideIt;
                break;

            case 'statusbar':
            case 'addonsbar':
                document.getElementById('ant-statusbar-rank-img').hidden = hideIt;
                document.getElementById('ant-statusbar-rank-label').hidden = hideIt;
                break;

            case 'ctoolbar':
                // Compact toolbar item may be hidden (Customized...)
                var ctoolbarRankEl = document.getElementById('ant-ctoolbar-rank');
                if (ctoolbarRankEl)
                {
                    document.getElementById('ant-ctoolbar-rank').hidden = hideIt;
                }
                break;
        }
    },
    
    updateVisible: function ()
    {
        var self = AntRank;
    
        if (AntPrefs.isRankMode)
        {
            self.hideUI(false);
    
            if (typeof (gBrowser.contentDocument.__antrank__) != "undefined")
            {
                self.setLabelRank(gBrowser.contentDocument.__antrank__);
            }
        }
        else
        {
            self.hideUI(true);
        }
    },

    isValidRankUrl: function (url)
    {
        try
        {
            if (url.match(/^(chrome|about|file):/i))
            {
                return false;
            }

            if (AntLib.ipOf(url).match(/^(192\.168\.)|(127\.0\.0\.1)|(10\.)/))
            {
                return false;
            }

            return url.match(/^https?:\/\//i);
        }
        catch (e)
        {
            // We are getting here if url is non http(s)
            // nsIURI.host throws NS_ERROR_FAILURE for about:blank like link
            if ( ! e.name.match(/NS_ERROR_FAILURE/i) )
            {
                AntLib.logWarning("AntRank.isValidRankUrl (rank.js)", "Validation error or url" + url, e);
            }

            return false;
        }
    },

    setLabelRank: function (rank, doc)
    {
        if (!doc)
        {
            doc = gBrowser.contentDocument;
        }
        else if (gBrowser.contentDocument != doc)
        {
            return;
        }

        var self = AntRank;

        //in compact mode - leave only number and use 'N/A' instead of long 'No Rank' caption.
        if (!rank || !parseInt(rank, 10))
        {
            rank = (AntPrefs.displayMode == 'ctoolbar') ? ' N/A' : antvd.AntLang.getString("AntRank.noRank");
        }
        else if (AntPrefs.displayMode == 'ctoolbar')
        {
            rank = ' ' + rank;
        }
        else
        {
            rank = antvd.AntLang.getString("AntRank.Rank") + ": " + rank;
        }

        var dMode = (AntPrefs.displayMode == 'addonsbar') ? 'statusbar' : AntPrefs.displayMode;
        
        if (dMode == 'ctoolbar')
        {
            // Compact toolbar item may be hidden (Customized...)
            var ctoolbarRankEl = document.getElementById('ant-ctoolbar-rank');
        
            if (ctoolbarRankEl)
            {
                document.getElementById('ant-ctoolbar-rank').label = rank;
            }
        }
        else
        {
            document.getElementById('ant-' + dMode + '-rank-label').value = rank;
        }
    },

    updateRank: function (aURI, doc)
    {
        try
        {
            var self = AntRank;
            var rank = null;

            if (!doc)
            {
                doc = gBrowser.contentDocument;
            }

            if (antvd.AntLib.inPrivate || !AntPrefs.isRankMode)
            {
                return;
            }
            
            if (self.isValidRankUrl(doc.documentURIObject.asciiSpec))
            {
                self.url = doc.documentURIObject;
                
                if (doc.__antrank__)
                {
                    rank = doc.__antrank__;
                }
                else
                {
                    // This added because AntTabsProgressListener.onLocationChange is fired multiple times
                    // In this case updateRank have time to start multiple requests until
                    // one of the requests asynchronous callback will initialize __antRank__ variable
                    // To prevent this, we setting __antRank__ variable before sending request
                    doc.__antrank__ = 'wait';

                    if (antvd.AntLib.getDomain(doc.documentURIObject.asciiSpec) != antvd.AntLib.getDomain(doc.referrer))
                    {
                        self.setLabelRank(false, doc);
                    }

                    let rpcMessage = new antvd.RpcAntRank(doc);
                    var _setLabel = function ()
                    {
                        AntRank.setLabelRank(rpcMessage.rank, doc);
                    }

                    rpcMessage.send().then(_setLabel);

                    return;
                }
            }
            
            if (rank != 'wait')
            {
                self.setLabelRank(rank, doc);
            }
        }
        catch (e)
        {
            AntLib.logWarning("AntRank.updateRank (rank.js)", "Failed to update rank", e);
        }
    },

    goProfil: function ()
    {
        var self = AntRank;
        
        if ( ! self.isValidRankUrl(self.url.spec) )
        {
            return;
        }

        var domain = self.url.host;

        if (domain)
        {
            AntLib.openURL('http://www.ant.com/site/' + domain, true);
        }
    },

    get UUID()
    {
        var pref = AntLib.CCSV("@mozilla.org/preferences-service;1", "nsIPrefService").getBranch("extensions.antrankservice.");
        var uuid = pref.getCharPref("uuid");

        if ( ! uuid || ! uuid.length )
        {
            uuid = AntLib.CCSV("@mozilla.org/uuid-generator;1", 'nsIUUIDGenerator').generateUUID().toString().toUpperCase();
            pref.setCharPref("uuid", uuid);
        }

        return uuid;
    }
};
