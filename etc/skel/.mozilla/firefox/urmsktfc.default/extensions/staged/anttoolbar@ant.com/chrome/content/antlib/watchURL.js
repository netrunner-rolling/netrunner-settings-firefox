// 
//  watchURL.js
//  firefox
//  
//  Created by Zak on 2008-07-14.
//  Copyright 2008-2016 Ant.com. All rights reserved.
// 


var AntTabsProgressListener = {
  onLocationChange: function(aBrowser, webProgress, request, location) {
      if (webProgress.DOMWindow != webProgress.DOMWindow.top) {
          return;
      }

      var doc = aBrowser.contentDocument;
      AntWatchUrl.notify(location, doc);
  },
  onProgressChange: function(){},
  onSecurityChange: function(){},
  onStateChange: function(){},
  onStatusChange: function(){},
  onRefreshAttempted: function(){ return true },
  onLinkIconAvailable: function(){}
};


var AntWatchUrl =
{
    watchers: [],

    init: function ()
    {
        var self = AntWatchUrl;
        
        self.start();
        gBrowser.addEventListener("unload", function() { self.stop() }, false);
    },
    
    start: function (){
        
        gBrowser.addTabsProgressListener(AntTabsProgressListener, Components.interfaces.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
    },

    stop: function ()
    {
        var self = AntWatchUrl;
        gBrowser.removeTabsProgressListener(AntTabsProgressListener);
        //gBrowser.removeEventListener("unload", function() { self.stop() }, true);
    },
    
    addWatcher: function (watcher)
    {
        AntWatchUrl.watchers.push(watcher);
    },
    
    removeWatcher: function (watcher)
    {
        AntArray.remove( AntWatchUrl.watchers, watcher );
    },
    
    notify: function (aURI, doc)
    {
        var self = AntWatchUrl;
        if (aURI == null)
            aURI = {spec: "about:blank"};
        
        var watchers = self.watchers;
        for ( var i in watchers )
            watchers[i](aURI, doc);
    }
};
