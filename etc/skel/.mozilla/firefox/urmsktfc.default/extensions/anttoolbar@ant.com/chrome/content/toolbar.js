// 
//  toolbar.js
//  antbar
//  
//  Created by Zak on 2008-06-11.
//  Contributor Brian King
//  Copyright 2008-2012 Ant.com. All rights reserved.
// 

var AntBar =
{
    //added after version from install.rdf
    //FIXME:looks like useless need to decide and remove it
    get stage() {
        return (AntPrefs.version.match( /(rc|b)[0-9]*$/ ) ? 'beta' : 'stable');
    },

    getAgent: function()
    {
      return 'vdmoz-' + AntPrefs.version + '-' + AntBar.stage + '.' + AntLib.getOsName().toLowerCase() + '-' + navigator.platform.replace(' ', '-').toLowerCase();
    }, 
    /**
     * Entry point of our toolbar, called before the loading of the homepage,
     * but after that the toolbar has been rendered
     */

    init: function ()
    {
        var self = AntBar;

        try {
            
            AntStorage.init();//uses AntLib only
            AntFlvUi.init(document);
            AntRank.init();
            AntGrabber.init();
            AntPrefs.init();
            AntWatchUrl.init();
            AntTabMan.init();
            //AntBugReport.init();//commented as it is not works. TODO: fix it. see http://red.ant.com/browse/MZ-285 (minor priority)
            antvd.AntHeartBeat.init();
            AntRank.updateVisible();
            
            // set up uninstall observer
            var antUtils = AntLib.CCSV('@ant.com/utilities;1', 'nsISupports');
            antUtils.wrappedJSObject.startUninstallObserver();
        }
        catch(e) {
            
            AntLib.toLog("AntBar.init error : " + e + " trace:" + e.stack);
        }
    },
    
    /*
     * Called on shutdawn
     * Currently used for releasing database file on uninstall
     */
    deinit: function()
    {
        try {
            /**
             * TODO(Igor): Move AntStorage's deinitialization to
             * the quit-application handler.
             */
            //for FF 4.0 and higher
            AntStorage.deinit();
        }
        catch (e) {
            
        }
    },

    /**
     * Handle search using terms typed in the antToolBarSearchBox
     * @param type          The type of search (web,image,video,news,blog)
     */
    doSearch: function (value)
    {
        var searchTerms = AntLib.trim(value);
        
        AntLib.openURL( 'http://www.ant.com/search?s=ff&q=' + AntLib.uriEncode(searchTerms) );
    },

    /**
     * Called when clicking on the "Support" button
     */
    onSupportButtonClick: function (event)
    {
        AntLib.openURL('http://www.ant.com/toolbar/firefox/help', 1);
        
        var combined = AntLib.ob('antToolBarCombinedButton');
        //available only with 'toolbar' mode
        if ( combined )
            combined.style.borderSpacing = 0;
    },

    /**
     * Called when clicking on the "Download" button
     */
    onDownloadButtonClick: function ()
    {
        var videos = AntTabMan.getAntData(gBrowser.contentDocument).videos;

        if ( videos.length ){

            var videoToDownload = videos[0];

            for (var i = 1; i < videos.length; i++){

                if (videos[i].size > videoToDownload.size){
                    videoToDownload = videos[i];
                }
            }
            antvd.AntFlvList.download(videoToDownload);
        }

        AntFlvUi.downloadButtonPressed();
    },

    /**
     * Called when clicking on a video in the download list
     */
    onDownloadListClick: function (id)
    {
        var videos = AntTabMan.getAntData(gBrowser.contentDocument).videos;

        if ( id < videos.length )
            antvd.AntFlvList.download( videos[id] );

        AntFlvUi.downloadButtonPressed();
    },


    /**
     * Called when clicking on the "open directory" button
     */
    onOpenDirButtonClick: function (event)
    {
      var flvDir;
      try { // requires Gecko 14
        flvDir = AntLib.CCSV("@mozilla.org/file/directory_service;1", "nsIProperties")
                         .get("ProfD", AntLib.CI("nsIFile"));
        flvDir.initWithPath(AntPrefs.flvDir);
      }
      catch(e) {
        flvDir = AntLib.CCSV("@mozilla.org/file/directory_service;1", "nsIProperties")
                         .get("ProfD", AntLib.CI("nsILocalFile"));
        flvDir.initWithPath(AntPrefs.flvDir);
      }

      try
      {
        flvDir.reveal();
      }
      catch (e)
      {
        try
        {
          AntLib.openExternal(flvDir);
        }
        catch (e2)
        {
          AntLib.toLog("reveal error : " + e);
          AntLib.toLog("openExternal error : " + e2);
          // XX TODO Localise this string
          alert("This functionnality is not available on your operating system");
        }
      }
    },

    /**
      * Called when click on the rank button
      */
    onRankButtonClick: function ()
    {
      AntRank.goProfil();
    },

    getPlayerWnd: function() {
        
        var existingWnd = null;

        // First look in open tabs
        AntLib.forEachDocument(
            function(doc) {
                                
                var link = doc.location.href;
                if (link == 'about:antplayer'
                    || link == 'chrome://antbar/content/player/player.xul') {
                    existingWnd = doc.defaultView;
                    return true;
                }
                                    
                return false;
            }
            , ['navigator:browser'] );

        // If we don't have it, look for the separate player window
        if (!existingWnd) {
            var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                    .getService(Components.interfaces.nsIWindowMediator);
            var win = wm.getMostRecentWindow("Ant:Player");
            if (win)
                existingWnd = win;
        }

        return existingWnd;
    },

    /**
     * Called when clicking on the "Player" button
     */
    onPlayerButtonClick: function (event) {
        
        var self = AntBar;
        
        var existingOne = self.getPlayerWnd();
        if (existingOne){
            
            var chromeWnd = existingOne.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                .getInterface(Components.interfaces.nsIWebNavigation)
                                .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                                .rootTreeItem
                                .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                .getInterface(Components.interfaces.nsIDOMWindow).window;
            var gBr = chromeWnd.gBrowser;
            
            if (gBr) {
                
                var location = existingOne.document.location;
                var numTabs = gBr.browsers.length;
                
                for (var index = 0; index < numTabs; index++) {
                    
                    var currentBrowser = gBr.getBrowserAtIndex(index);
                    if (location == currentBrowser.contentDocument.location) {
                        
                        gBr.selectedTab = gBr.tabContainer.childNodes[index];
                        chromeWnd.focus();
                        return;
                    }
                }
            }
            else {
                
                chromeWnd.focus();
            }
            
            
            return;
        }
        
        if ( AntPrefs.playerMode == 'popup' ) {
            var x = AntPrefs.playerXScreen;
            var y = AntPrefs.playerYScreen;
            var w = AntPrefs.playerWindowWidth;
            var h = AntPrefs.playerWindowHeight;
            
            var features = 'chrome,titlebar,resizable=yes,dialog=no';
            
            var popup = window.open( 'about:antplayer',
                                     '',
                                     features );
            var mainWindowEl = popup.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                    .getInterface(Components.interfaces.nsIWebNavigation)
                                    .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
                                    .rootTreeItem
                                    .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
                                    .getInterface(Components.interfaces.nsIDOMWindow).window;
            
            mainWindowEl.antPlayerPopup = true;
        }
        else {
            
            AntLib.openURL("about:antplayer", true);
        }
    },

    /**
     * Handle keystrokes entered in the searchBox
     * @param event         The event that triggered the call to this function
     */
    onSearchBoxKeyPress: function (event)
    {
        if ( event.keyCode == event.DOM_VK_RETURN )
        {
            this.doSearch( event.target.value );
        }
    },
    
    /**
     * Open the ant prefs window
     */
    doPrefs: function ()
    {
        try {
            antvd.Options.getDefault().showPreferences();
        } catch (ex) {
            antvd.AntLib.logError(
                "[UI]: Failed to spawn the preferences window"
                , ex);
        }
    },

    /**
     * Open the about dialog
     */
    openAbout: function() {
        
        var instantApply = AntLib.CCSV('@mozilla.org/preferences-service;1', 'nsIPrefService')
                                 .getBranch(null)
                                 .getBoolPref('browser.preferences.instantApply');
        var flags = 'chrome,titlebar,toolbar,centerscreen' + (instantApply ? ',dialog=no' : ',modal');
        
        var wm = AntLib.CCSV('@mozilla.org/appshell/window-mediator;1', 'nsIWindowMediator');
        var wnd = wm.getMostRecentWindow('Ant:about');
        if (wnd) {
            wnd.focus();
        }
        else {
            
            window.openDialog('chrome://antbar/content/xul/about.xul', 'antabout', flags);
        }
    }
};
if ( typeof(window) != 'undefined') {
    
    window.addEventListener('load', AntBar.init, false);
    window.addEventListener('unload', AntBar.deinit, false);
}
