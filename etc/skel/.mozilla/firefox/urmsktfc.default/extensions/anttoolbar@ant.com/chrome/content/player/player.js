// 
//  player.js
//  firefox
//  
//  Created by Zak on 2008-06-18.
//  Contributor Brian King
//  Copyright 2008-2012 Ant.com. All rights reserved.
// 

var flashPlayerId   = 0;
var html5PlayerId   = 1;
var wmPlayerId      = 2;

/**
 * AntPlayer: Handle all actions inside the player.xul window
 */
var AntPlayer =
{
    movieFileMatch: /^(.+)\.(?:flv|f4v|f4p|mp4|m4v|m4a|mp3|mov|3g2|3gp|wmv|avi|ogg|ogv|webm)$/i,
    doc: null,
    currentVideo: null,
    currentPlayback: { data: null, startTime: null },
    setFullScreen: false,
    videoList: null,
    playlists: null,
    sortByElement: null,
    lastPlayerSize: null,
    randomList: [],
    antTree: null,
    catDropName: null,
    getFlashURL: "http://get.adobe.com/flashplayer/",
    getWMPURLMac: "http://windows.microsoft.com/en-US/windows/products/windows-media-player/wmcomponents",
    getWMPURL: "http://port25.technet.com/pages/windows-media-player-firefox-plugin-download.aspx",
    pluginIconDisabled: "chrome://mozapps/skin/plugins/contentPluginDisabled.png",
    pluginIconNotFound: "chrome://mozapps/skin/plugins/contentPluginMissing.png",
    
    /**
     * Initialize the list
     */
    init: function () {
        
        var self = AntPlayer;
        self.setupGlobal();
        self.checkFolderForUnacceptedChars();
        
        var playOnLoad = false;
        self.antTree = new AntTree('antFlvPlayerTree');
        
        self.updateDB();
        self.videoList = (new AntVideoList()).list;
        self.playlists = (new AntPlaylists()).list;
        self.fillVideos();
        self.restoreLayout();
        
        var emptyTextProp = AntLib.getFirefoxVersion() < 4.0 ? 'emptyText' : 'placeholder';
        document.getElementById( 'search-text' )[emptyTextProp] = antvd.AntLang.getString('AntPlayer.searchHint');
        
        self.antTree.mainTreeCh.addEventListener( 'dblclick', self.onListItemDblClick, false );
        document.getElementById( 'antFlvPlayerTree' ).addEventListener( 'keypress', self.onListItemKeyPress, false );
        
        window.playerReady = function() {
                                
                                var self = AntPlayer;
                                var obj = document.getElementById('antFlvPlayerEmbed');
                                if ( !obj || obj.style.display == 'none' )
                                    return;
                                
                                if ( obj.antApplyItem ) {
                                    obj.jwLoad( 'file:///' + AntLib.uriEncode(obj.antApplyItem.path) );
                                    delete obj.antApplyItem;
                                }
                                
                                obj.jwAddEventListener( 'jwplayerPlayerState', 'AntPlayer.flvPlayerCallback' );
                                obj.jwAddEventListener( 'jwplayerMediaComplete', 'AntPlayer.processNextVideo' );
                                
                                if ( self.setFullScreen ) {
                                    
                                    AntLib.synthesizeMouse( 'click',
                                                            obj,
                                                            function(rect){ return rect.right - 1; },
                                                            function(rect){ return rect.bottom - 1; });
                                }
                            }
        
        //unload because the movie keep running when leaving the player with a bookmark link
        window.addEventListener( 'unload',
                                 function () {
                                    self.antSplash();
                                    self.releaseGlobal();
                                 },
                                 false );
        window.addEventListener( 'resize', function (){ self.windowResized(); }, false );
        
        var playerBox = document.getElementById( 'antFlvPlayerContentBox' );
        playerBox.addEventListener( 'DOMAttrModified',
                                    function () {
                                       
                                       var currentSize = playerBox.getAttribute('width');
                                       if ( self.lastPlayerSize && self.lastPlayerSize != currentSize ) {
                                           window.setTimeout( function() {
                                                                self.playVideo(self.currentVideo, true, true);
                                                              },
                                                              0 );
                                       }
                                       self.lastPlayerSize = currentSize;
                                    },
                                    false );

        // Plugin handling
        document.addEventListener("PluginDisabled", function (event) { self.pluginDisabled(event) }, false);
        document.addEventListener("PluginNotFound", function (event) { self.pluginNotFound(event) }, false);

        self.autoPlay(playOnLoad);
    },

    /*
     * Window resized
    */
    windowResized: function() {
        if (AntLib.ob("antPlayerDeck").selectedIndex == 0) {
            var self = AntPlayer;
            self.playVideo(self.currentVideo, true, true);
        }
    },

    /*
     * Plugin not found
    */
    pluginNotFound: function(aEvent) {
        this.handlePluginWoes(aEvent, "notfound");
    },

    /*
     * Plugin disabled
    */
    pluginDisabled: function(aEvent) {
        this.handlePluginWoes(aEvent, "disabled");
    },

    /*
     * Handle plugin woes
    */
    handlePluginWoes: function(aEvent, aState) {
        //AntLib.toLog("Handling plugin woes : "+aState);
        var self = AntPlayer;
        let plugin = aEvent.target;
        let doc = plugin.ownerDocument;
        let pUrl = "support.mozilla.com/kb/Popular Plugins";
        let pText = "Plugin";

        // We're expecting the target to be a plugin.
        if (!(plugin instanceof Components.interfaces.nsIObjectLoadingContent))
            return;

        var tagMimetype = plugin.QueryInterface(Components.interfaces.nsIObjectLoadingContent)
                               .actualType;
        if (tagMimetype == "")
          tagMimetype = plugin.type;
        //AntLib.toLog("Plugin type = "+tagMimetype);

        // The event is fired when the object is loaded.
        // We need to remove the object to ensure the event is fired when next video is activated
        self.disableCurrentPlayer();

        // XX TODO Handle other plugin types
        switch (tagMimetype) {
            case "application/x-shockwave-flash":
                pUrl = self.getFlashURL;
                pText = antvd.AntLang.getFormatString("AntPlayer.pluginGet", "Flash Player");
                break;
            case "application/x-ms-wmp":
                pUrl = (AntLib.getOsName() == "Darwin") ? self.getWMPURLMac : self.getWMPURL;
                pText = antvd.AntLang.getFormatString("AntPlayer.pluginGet", "Windows Media Plugin");
                break;
            default:
                break;
        }

        // Setup the message stuff
        if (aState == "disabled") {
            AntLib.ob("ant-video-plugin-message").textContent = antvd.AntLang.getString('AntPlayer.pluginDisabled');
            AntLib.ob("ant-video-plugin-image").setAttribute("src", self.pluginIconDisabled);
            AntLib.ob("ant-video-plugin-download").onclick = function() { AntPlayer.openAddons(); };
            AntLib.ob("ant-video-plugin-download").setAttribute("value", antvd.AntLang.getString('AntPlayer.pluginAOM'));
        }
        else if (aState == "notfound") {
            AntLib.ob("ant-video-plugin-image").setAttribute("src", self.pluginIconNotFound);
            AntLib.ob("ant-video-plugin-message").textContent = antvd.AntLang.getString('AntPlayer.pluginNotFound');
            AntLib.ob("ant-video-plugin-download").setAttribute("href", pUrl);
            AntLib.ob("ant-video-plugin-download").setAttribute("value", pText);
        }
        else {
            // something is up
            return;
        }
        AntLib.ob("antPlayerDeck").selectedIndex = 1;
        return;
    },

    /*
      Open add-ons window with Subscriptions tab focused
      @param   aCollectionURL The URL of a collection to show
      */
    openAddons : function() {
        let wm =
          Components.classes["@mozilla.org/appshell/window-mediator;1"].
           getService(Components.interfaces.nsIWindowMediator);
        let win = wm.getMostRecentWindow("navigator:browser");
        win.BrowserOpenAddonsMgr("addons://list/plugin");
    },

    /*
     * declaring global modules
    */
    setupGlobal: function() {
        
        AntStorage.init();
    },
    releaseGlobal: function() {
        
        AntStorage.deinit();
    },
    /*
     * fired, when column attribute is changed
    */
    columnAttrChanged: function(event) {
        
        var el = event.target;
        var w = parseInt( el.getAttribute('width') );
        var propRoot = el.id.replace( /Col$/, '' );
        if ( !isNaN(w) )
            AntPrefs[propRoot + 'Width'] = w;
        
        AntPrefs[propRoot + 'Visible'] = !( el.getAttribute('hidden') == 'true' );
    },
    /*
     * restores column sizes, visibility and last selected sort
     */
    restoreLayout: function() {
        
        var self = AntPlayer;
        
        if ( AntPrefs.loop )
            document.getElementById('loopId').className = 'loopEnabled';
        if ( AntPrefs.random )
            document.getElementById('randomId').className = 'randomEnabled';
        if ( AntPrefs.continuous )
            document.getElementById('continuousId').className = 'continuousEnabled';
        
        var treeBox = self.antTree.mainTree.parentNode;
        var size    = AntPrefs.listWidth;
        if ( size )
            treeBox.setAttribute( 'width', size );
        treeBox.addEventListener( 'DOMAttrModified',
                                    function(){
                                        
                                        var w = parseInt( treeBox.getAttribute('width') );
                                        if ( !isNaN(w) )
                                            AntPrefs.listWidth = w;
                                    },
                                    false );
        
        var name    = document.getElementById( 'titleCol' );
        size        = AntPrefs.titleWidth;
        if ( size )
            name.setAttribute( 'width', size );
        name.addEventListener( 'DOMAttrModified',
                                function(){
                                    
                                    var w = parseInt( name.getAttribute('width') );
                                    if ( !isNaN(w) )
                                        AntPrefs.titleWidth = w;
                                },
                                false );
        
        var sizeCol = document.getElementById( 'sizeCol' );
        var visible = AntPrefs.sizeVisible;
        size        = AntPrefs.sizeWidth;
        
        sizeCol.setAttribute( 'hidden', !visible );
        if ( size )
            sizeCol.setAttribute( 'width', size );
        sizeCol.addEventListener( 'DOMAttrModified', self.columnAttrChanged, false );
        
        var dateCol = document.getElementById( 'created_atCol' );
        visible     = AntPrefs.dateVisible;
        size        = AntPrefs.created_atWidth;
        
        dateCol.setAttribute( 'hidden', !visible );
        if ( size )
            dateCol.setAttribute( 'width', size );
        dateCol.addEventListener( 'DOMAttrModified', self.columnAttrChanged, false );
        
        var domCol  = document.getElementById( 'domainCol' );
        visible     = AntPrefs.domainVisible;
        size        = AntPrefs.domainWidth;
        
        domCol.setAttribute( 'hidden', !visible );
        if ( size )
            domCol.setAttribute( 'width', size );
        domCol.addEventListener( 'DOMAttrModified', self.columnAttrChanged, false );
        
        self.applySort( document.getElementById( AntPrefs.sortBy + 'Col' ), AntPrefs.sortDirection );
    },
    /*
     * Check user folder for unaccepted characters
     */
    replaceUnacceptedFlashChars: function( name ) {
        
        //seems like flash player fixed the issue with '%' in the path,
        //so this code is unnecessary now
        //var newName = name.replace(/%/g, '_');
        
        //jw player doesn't like youtube.com/v
        //                       youtube.com/w
        //                       youtu.be
        //words in any place inside the path.
        //simplifying the path checking,
        //as slash is separator and can't be used inside the single name
        //so replacing the youtube.com only
        return name.replace( /youtube\.com\//g, 'youtube_com' )
                   .replace( /youtu\.be/g, 'youtu_be' );
    },
    hasFlashFiles: function() {
        
        var videoDirectory;
        try { // requires Gecko 14
          videoDirectory = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
          videoDirectory.initWithPath(AntPrefs.flvDir);
        }
        catch(e) {
          videoDirectory = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
          videoDirectory.initWithPath(AntPrefs.flvDir);
        }
        
        if ( !videoDirectory.exists() )
            return false;
        
        try {
            var entries = videoDirectory.directoryEntries;
            var rex = /\.(flv|f4v|f4p|mp4|m4v|mov|3g2|3gp)$/;
            
            while ( entries.hasMoreElements() ) {
                
                var entry = entries.getNext();
                AntLib.QI( entry, AntLib.CI("nsIFile") );
                
                if ( entry.isDirectory() || entry.fileSize == 0 )
                    continue;
                
                if ( rex.test(entry.path) )
                    return true;
            }
        }
        catch (e) {
            //AntLib.toLog(e);
        }
        
        return false;
    },
    checkFolderForUnacceptedChars: function() {
        
        var self = AntPlayer;
        var name = AntPrefs.flvDir;
        var newName = self.replaceUnacceptedFlashChars(name);
        
        if ( name != newName && self.hasFlashFiles() ) {
            
            if (confirm( antvd.AntLang.getFormatString('AntPlayer.invalidPath',
                                                 name,
                                                 newName) )) {
                
                try {
                    
                    var videoDirectory;
                    try { // requires Gecko 14
                      videoDirectory = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
                      videoDirectory.initWithPath(name);
                    }
                    catch(e) {
                      videoDirectory = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
                      videoDirectory.initWithPath(name);
                    }
                    
                    while ( videoDirectory ) {
                        
                        var tmpLeaf = videoDirectory.leafName;
                        var newLeaf = self.replaceUnacceptedFlashChars(tmpLeaf);
                        if ( newLeaf != tmpLeaf ) {
                            
                            videoDirectory.moveTo( null, newLeaf );
                        }
                        
                        videoDirectory = videoDirectory.parent;
                    }
                    
                    AntPrefs.flvDir = newName;
                }
                catch (e) {
                    alert( antvd.AntLang.getString('AntPlater.renameFolderFailed') );
                }
            }
            else {
                
                alert( antvd.AntLang.getString('AntPlayer.youShouldRename') );
            }
        }
    },
    /*
     * players events callback:
     */
    //flash player
    flvPlayerCallback: function( evt ) {
        
        var self = AntPlayer;
        var state = evt.newstate;
        
        if ( state == 'PLAYING' )
            self.onPlaybackStarted();
    },
    //html5 player.
    html5PlayerEndCallback: function() {
        
        AntPlayer.processNextVideo();
    },
    html5PlayerPlay: function() {
        
        AntPlayer.onPlaybackStarted();
    },
    //WMP
    wmpStateChangeCallback: function(state) {
        
        var self = AntPlayer;
        
        if ( state == 3 ) {
            
            if ( self.setFullScreen )
                document.getElementById('MediaPlayer2').fullScreen = true;
            self.onPlaybackStarted();
        }
        if ( state == 8 )
            self.processNextVideo();
    },
    /*
     * helpers for nb_views and last_view storage fields
     */
    onPlaybackStarted: function() {
        
        var self = AntPlayer;
        
        if ( self.currentPlayback.data != self.currentVideo ) {
            
            self.currentPlayback.data = self.currentVideo;
            self.currentPlayback.startTime = new Date();            
        }
    },
    updatePlaybackFieldsDB: function() {
        
        var self = AntPlayer;
        var data = self.currentPlayback.data;
        if ( data ) {
            AntStorage.updateVideoViews( data.sha1,
                                         (data.last_view = self.currentPlayback.startTime.getTime()),
                                         ++data.nb_views );
        }        
    },
    /*
     * called from player callbacks to play the next video
     */
    processNextVideo: function() {
        
        var self = AntPlayer;
        var next;
        
        self.updatePlaybackFieldsDB();
        
        if ( AntPrefs.continuous ) {
            
            self.onNextClicked(false, false);
        }
        else {
            
            if ( AntPrefs.loop ) {
                
                self.playVideo( self.currentVideo, true, false );
            }
        }
    },
    /*
     * switches loop, random or continuous button state
    */
    switchButton: function(el) {
        
        var dis_class = el.getAttribute('st_dis');
        var enabled = !AntPrefs[dis_class];
        
        if ( enabled )
            el.className = el.getAttribute('st_en');
        else
            el.className = dis_class;
        
        AntPrefs[dis_class] = enabled;
    },
    /**
     * Auto play a video when the player loads using preference or trying to guess the last download
     */
    autoPlay: function (playOnLoad) {
        
        var self = AntPlayer;
        var curFromPref = AntPrefs.flvToPlay;
        
        if ( curFromPref ) {
            
            var file;
            try { // requires Gecko 14
                file = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
                file.initWithPath(curFromPref);
            }
            catch(e) {
                file = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
                file.initWithPath(curFromPref);
            }
        }
        
        if (!curFromPref || !file.exists()) {
            
            var list = document.getElementById( 'antFlvPlayerTree-ch-item0-ch' );
            
            if ( list && list.firstChild )
                self.playVideo( list.firstChild.antLinkedObject, playOnLoad);
        }
        else {
            
            var list = self.videoList;
            var item;
            
            for ( var i = 0; i < list.length; i++ ) {
                
                item = list[i];
                if ( item.path == curFromPref )
                    break;
            }
            
            if ( item )
                self.playVideo( item, playOnLoad );
            else
                self.antSplash();
        }
    },

    /**
     * Display the Splash Screen
     */
    antSplash: function () {
        
        var self = AntPlayer;
        
        self.disableCurrentPlayer();
        self.setupFlashPlayer();
        self.fillTitlebar("Ant.com", "Player");
    },

    fillTitlebar: function (aOrigin, aName) {
        var self = AntPlayer;
        // Fix to remove innerHTML insertion by Wladimir Palant, integrated by Brian King
        var str = antvd.AntLang.getFormatString("AntPlayer.TitleBar", aOrigin, aName);
        var element = AntLib.ob("antFlvPlayerTitleBar");
        
        if (/(.*?)<html:strong>(.*?)<\/html:strong>(.*)/.test(str))
        {
            element.textContent = ""; // reset
            
            if ( RegExp.$2 ) {
                
                var strong = document.createElementNS("http://www.w3.org/1999/xhtml", "strong");
                strong.textContent = RegExp.$2;
                
                element.appendChild(document.createTextNode(RegExp.$1));
                element.appendChild(strong);
                element.appendChild(document.createTextNode(RegExp.$3));
            }
            else {
                
                element.appendChild(document.createTextNode( RegExp.$3.replace(/^]\s*/, '') ));
            }
        }
        else
            element.textContent = str;
        // end fix
    },
    
    /**
     * Fill the list with the videos
     */
    fillVideos: function () {
        
        var self = AntPlayer;
        
        var cModel = {
            
            columns: [
                function(data) {
                    
                    return data.title;
                },
                function(data) {
                    
                    var size = AntLib.convertByteUnits(data.size);
                    return size[0] + ' ' + size[1];
                },
                function(data) {
                    
                    return (new Date(data.created_at)).toLocaleFormat("%x");
                },
                function(data) {
                    
                    return data.domain;
                }                
            ],
            playList: function(data) {
                
                var plName = data.playlist;
                return plName ? plName : AntPlaylists.defaultPlaylistName;
            },
            allPlaylists: self.playlists
        };
        
        this.antTree.start(self.videoList, cModel);
    },

    /*
     * reloads video list and updates tree
     */
    updateTreeContent: function() {
        
        //AntLib.toLog("Updating Player Tree Content");
        var self = AntPlayer;
        self.videoList = (new AntVideoList()).list;
        self.fillVideos();
        self.applySort( document.getElementById( AntPrefs.sortBy + 'Col' ), AntPrefs.sortDirection );

        var founded = false;
        if ( self.currentVideo ) {
            var list = self.videoList;
            var length = list.length;
            for ( var i = 0; i < length; i++ ) {
                var item = list[i];
                if ( item.path == self.currentVideo.path ) {
                    founded = true;
                    self.currentVideo = null;
                    self.setAsCurrentItem(item);
                    break;
                }
            }
        }

        if ( !founded )
            self.autoPlay(false);
    },

    /*
     * fired when text changed in search box
     */
    onUpdateSearchResults: function(el) {
        
        var self    = AntPlayer;
        var query   = el.value.toLowerCase();
        
        document.getElementById('close-search').setAttribute( 'hidden', query ? false : true );
        
        var filter;
        if ( query ) {
            
            //escaping srecial regexp symbols
            var rexStr  = query.replace( /\[|\]|\(|\)|\\|\.|\^|\$|\||\?|\+|\*|\{|\}/g, '\\$&' );
            var rex     = new RegExp( rexStr, 'i' );
            
            filter = function(data) {
                                return rex.test( data.title ) || rex.test( data.domain );
                             };
        }
        
        self.antTree.filter( filter );
        self.randomList = [];
    },
    /*
     * fired when key pressed on search box
     */
    onSearchBoxKeyPress: function(event) {
        
        if ( event.keyCode == event.DOM_VK_ESCAPE ) {
            AntPlayer.restoreFullList();
        }
    },
    /*
     * restore full playlists(free seach query)
     */
    restoreFullList: function() {
        
        var self = AntPlayer;
        var searchItem = document.getElementById('search-text');
        searchItem.value = '';
        
        self.onUpdateSearchResults(searchItem);
        document.getElementById('antFlvPlayerTree').focus();
    },
    /*
     * helpers for creating players
     */
    setupFlashPlayer: function( item, start ) {
        
        var self = AntPlayer;
        var videoObject = document.getElementById( 'antFlvPlayerEmbed' );

        var videoBox = document.getElementById('antPlayerBox');
        videoBox.removeAttribute("align");

        if ( start === undefined )
            start = false;
        
        if ( !videoObject ) {
            
            var videoObject = document.createElementNS( 'http://www.w3.org/1999/xhtml', 'embed' );
            
            videoObject.id = 'antFlvPlayerEmbed';
            videoObject.setAttribute( 'src', 'chrome://antbar/content/player/mediaplayer.swf' );
            videoObject.setAttribute( 'type', 'application/x-shockwave-flash' );
            videoObject.setAttribute( 'allowscriptaccess', 'always' );
            videoObject.setAttribute( 'allowfullscreen', true );
            videoObject.setAttribute( 'menu', false );
            videoObject.setAttribute( 'oncontextmenu', 'return false;' );
            videoObject.setAttribute( 'flex', 1 );
            videoObject.setAttribute( 'wmode', 'opaque' );
            if ( item ) {
                videoObject.setAttribute( 'flashvars', 'autostart=' + start.toString() );//file=file:///' + AntLib.uriEncode( item.path ) + '&
                videoObject.antApplyItem = item;
            }
            else
                videoObject.setAttribute( 'flashvars', 'file=chrome://antbar/skin/img/ant.jpg&image=chrome://antbar/skin/img/ant.jpg&controlbar=none&icons=false&frontcolor=0xFFFFFF&lightcolor=0xFFFFFF&screencolor=0xFFFFFF' );
            videoObject.style.display = 'block';
            
            AntLib.ob("antPlayerContainer").appendChild( videoObject );
        }
        else {
            
            videoObject.jwLoad( 'file:///' + AntLib.uriEncode(item.path) );
            videoObject.jwPlay( start );
        }
        
        return videoObject;
    },
    setupWMPlayer: function( item, start, resize ) {
        
        var wmp = document.getElementById('MediaPlayer2');
        var pos = 0.0;

        var videoBox = document.getElementById('antPlayerBox');
        videoBox.removeAttribute("align");

        if ( resize ) {
            
            if ( wmp.getAttribute('mySize') == wmp.parentNode.clientWidth + '_' + wmp.parentNode.clientHeight )
                return wmp;
            
            start = wmp.playState == 3;
            pos = wmp.controls.currentPosition;
            
            wmp.parentNode.removeChild( wmp );
            wmp = null;
        }
        
        if ( !wmp ) {
            
            wmp = document.createElementNS( "http://www.w3.org/1999/xhtml", 'embed' );
            
            wmp.id = 'MediaPlayer2';
            wmp.setAttribute( 'autoStart', false );
            wmp.setAttribute( 'flex', 1 );
            wmp.style.display = 'none';
            wmp.setAttribute( 'pluginspage', 'http://www.microsoft.com/Windows/MediaPlayer/' );
            wmp.setAttribute( 'type', 'application/x-ms-wmp' );
            
            var contentBox = document.getElementById('antPlayerContainer');
            contentBox.appendChild( wmp );
            wmp.setAttribute( 'mySize', contentBox.clientWidth + '_' + contentBox.clientHeight );
        }
        wmp.style.display = 'block';
        
        //seems like plugin is not installed
        if (!wmp.newMedia)
            return wmp;
        
        var path = 'file:///' + item.path;
        var curMedia = wmp.currentMedia;
        if ( !curMedia || curMedia.sourceURL != path )
            wmp.currentMedia = wmp.newMedia( path );
        wmp.controls.currentPosition = pos;
        
        if (start) {
            window.setTimeout( function() { document.getElementById('MediaPlayer2').controls.play(); }, 0 );
        }
        
        return wmp;
    },
    setupHtml5Player: function(item, start, resize) {
        
        var self = AntPlayer;
        var videoObject = document.getElementById('ant-video-cont');

        var videoBox = document.getElementById('antPlayerBox');
        videoBox.setAttribute("align", "center");

        if ( resize ) {
            
            var oldVideo = videoObject.firstChild;
            oldVideo.setAttribute( 'width', "100%" );
            oldVideo.setAttribute( 'height', "100%" );
            
            return videoObject;
        }
        
        var video = videoObject.firstChild;
        var path = 'file:///' + item.path;
        if ( !video ) {

            video = document.createElementNS( 'http://www.w3.org/1999/xhtml', 'html:video' );
            video.setAttribute( 'controls', true );
            video.setAttribute( 'preload', 'auto' );
            if (start)
                video.setAttribute( 'autoplay', start );
            
            videoObject.style.display = 'block';
            video.setAttribute( 'width', "100%" );
            video.setAttribute( 'height', "100%" );
            video.addEventListener( 'ended', function() {
                self.html5PlayerEndCallback();
            }, false );
            video.addEventListener( 'play', function() {
                self.html5PlayerPlay();
            }, false );
            video.setAttribute( 'src', path );
            
            videoObject.appendChild( video );

            videoObject.antHooker = new html5VideoHelper();
            videoObject.antHooker.setFullScreenHook( video,
                                                     [{ name: 'ended',
                                                        handler: function(event) {
                                                                    
                                                                    var next = self.findOutNextItem();
                                                                    var newSrc = next ? 'file:///' + next.path : '';
                                                                    var fsPlayer = event.target;
                                                                    
                                                                    if ( newSrc.match(/\.webm$/i) ) {
                                                                        
                                                                        self.updatePlaybackFieldsDB();
                                                                        var src = fsPlayer.currentSrc || fsPlayer.src;
                                                                        if ( src != newSrc ) {
                                                                            
                                                                            if ( self.randomList.length && self.randomList[0] == next )
                                                                                self.randomList.shift();
                                                                            self.setAsCurrentItem( next );
                                                                            
                                                                            fsPlayer.src = newSrc;
                                                                            fsPlayer.load();
                                                                        }
                                                                        
                                                                        fsPlayer.play();
                                                                    }
                                                                    else {
                                                                        
                                                                        fsPlayer.ownerDocument.defaultView.close();
                                                                    }
                                                                }
                                                        },
                                                        { name: 'play',
                                                          handler: self.html5PlayerPlay
                                                        }] );
        }
        else {
            
            if ( path != video.getAttribute('src') ) {
                
                video.setAttribute( 'src', path );
                video.load();
            }
            
            if ( start )
                video.play();
        }

        if ( self.setFullScreen )
            videoObject.antHooker.setFullScreen();
        
        return videoObject;
    },
    /*
     * returns players array
     */
    get players() {
        
        return [ document.getElementById('antFlvPlayerEmbed'),//can be null!!!
                 AntLib.ob('ant-video-cont'),
                 document.getElementById('MediaPlayer2') ];
    },
    /*
     * cleanups html5 player container
     */
    cleanHtml5Container: function(obj) {
        
        var old = obj.firstChild;
        if ( old ) {
            old.pause();
            obj.removeChild( old );
        }
        
        var hooker = obj.antHooker;
        if ( hooker )
            hooker.removeFullScreenHook();
    },
    /*
     * Disable current player
     */
    disableCurrentPlayer: function( nextId ) {
        
        var self = AntPlayer;
        var players = self.players;
        
        for ( var i = 0; i < players.length; i++ ) {
            
            var item = players[i];
            if ( nextId != i && item && item.style.display == 'block' ) {
                
                switch (i) {
                
                case flashPlayerId:
                    item.parentNode.removeChild( item );
                    break;
                
                case wmPlayerId:
                    item.parentNode.removeChild( item );
                    break;
                
                case html5PlayerId:
                    item.style.display = 'none';
                    self.cleanHtml5Container( item );
                    break;
                }
            }
        }
    },
    /*
     * Returns current display mode { fullscreen = true }
     */
    get currentDisplayMode() {
        
        var self = AntPlayer;
        var players = self.players;
        
        for ( var i = 0; i < players.length; i++ ) {
            
            var item = players[i];
            if ( item && item.style.display == 'block' ) {
                
                switch (i) {
                    
                    case flashPlayerId:
                        if ( item.jwGetFullscreen )
                            return item.jwGetFullscreen();
                        
                        //flash player not loaded yet
                        return false;
                    
                    case wmPlayerId:
                        return item.fullScreen;
                    
                    case html5PlayerId:
                        return item.antHooker.fullScreen;
                }
            }
        }
        
        return false;
    },
    /*
     * marks item as current item
     */
    setAsCurrentItem: function( item ) {
        
        var self = AntPlayer;
        self.fillTitlebar( item.domain, item.title.replace(/_/g, " ") );
        
        if ( self.currentVideo )
            self.currentVideo.UIitem.firstChild.firstChild.removeAttribute( 'properties' );
        
        self.currentVideo = item;
        item.UIitem.firstChild.firstChild.setAttribute( 'properties', 'currentlyPlayed' );
        
        var tree = self.antTree.mainTree;
        var view = tree.view;
        var box = tree.treeBoxObject;
        var index = view.getIndexOfItem( item.UIitem );
        
        tree.currentIndex = index;
        
        if (index + box.getPageLength() > view.rowCount)
            index = view.rowCount - box.getPageLength();
        
        if ( index < box.getFirstVisibleRow() || index > box.getLastVisibleRow() )
            box.scrollToRow( index );
    },
    /**
     * Redraw the video container with needed parameters to play the specified file
     * @param path      The full file path to play (Format: /tmp/origin.title.flv)
     */
    playVideo: function (item, start, resize) {
        
        if ( !item )
            return;
        
        AntLib.ob("antPlayerDeck").selectedIndex = 0;
        var self = AntPlayer;
        var videoObject;
        var path = item.path;
        self.setFullScreen = self.currentDisplayMode;
        
        if ( start === undefined )
            start = true;
        
        if ( path.match(/\.(webm|ogg|ogv)$/i) ) {
            
            self.disableCurrentPlayer( html5PlayerId );
            videoObject = self.setupHtml5Player( item, start, resize );
        }
        else if ( path.match(/\.(wmv|avi)$/i) ) {
            
            self.disableCurrentPlayer( wmPlayerId );
            videoObject = self.setupWMPlayer( item, start, resize );
        }
        else {
            
            if ( resize ) {
                return;
            }
            
            self.toFlashCompatible( item );
            self.disableCurrentPlayer( flashPlayerId );
            
            videoObject = self.setupFlashPlayer( item, start );
        }
        
        if ( resize )
            return;
            
        self.setAsCurrentItem( item );
        
        //FF 4 fix: window not redraws the player element until mouse move event is occured
        if ( !self.setFullScreen && AntLib.getFirefoxVersion() >= 4.0 ) {
            
            AntLib.synthesizeMouse( 'mousemove', videoObject, 0, 0, 0 );
            AntLib.synthesizeMouse( 'mousemove', self.antTree.mainTree, 0, 0, 0 );
        }
    },
    /*
     * returns next item to play for the random mode
     */
    getNextItemRandom: function(forceNext, notShift) {
        
        var self = AntPlayer;
        
        if ( !self.randomList.length ) {
            
            if ( !forceNext && (!AntPrefs.continuous || !AntPrefs.loop) )
                return null;
            
            var tmpArr = self.antTree.visibleItems;
            if ( !tmpArr.length )
                return null;
            
            while ( tmpArr.length ) {
                
                var index = AntLib.getRandomInt( 0, tmpArr.length - 1 );
                self.randomList.push( tmpArr.splice(index, 1)[0] );
            }
            
            if ( self.randomList[0] == self.currentVideo ) {
                
                self.randomList.push(self.currentVideo);
                self.randomList.shift();
            }
        }
        
        if ( notShift )
            return self.randomList[0];
        
        return self.randomList.shift();
    },
    getNextItemLinear: function(prev, manual) {
        
        var self = AntPlayer;
        if ( !self.currentVideo )
            return null;
        
        var item = self.currentVideo.UIitem;
        
        next = self.antTree.nextSibling(item, prev);
        if ( next == null ) {
            if ( !AntPrefs.loop && !manual )
                return null;
            
            next = self.antTree.firstInList( self.currentVideo, !prev );
        }
        
        return next.antLinkedObject;
    },
    findOutNextItem: function() {
        
        var self = AntPlayer;
        var item = null;
        if ( AntPrefs.continuous ) {
            
            if ( AntPrefs.random )
                item = self.getNextItemRandom(false, true);
            else
                item = self.getNextItemLinear(false);
        }
        else {
            
            if ( AntPrefs.loop )
                item = self.currentVideo;
        }
        
        return item;
    },
    /**
     * Callback: fired when the user double click an item in the list
     * @param event     The event that triggered the call to this method
     */
    onListItemDblClick: function ( event ) {
        var self = AntPlayer;
        
        var tree = document.getElementById('antFlvPlayerTree');
        var tbo = tree.treeBoxObject;
        
        var rowIndex = tbo.getRowAt(event.clientX, event.clientY);
        if ( rowIndex >= 0 ) {
            
            var item = tree.view.getItemAtIndex( rowIndex );
            self.playVideo( item.antLinkedObject );
        }
    },
        /**
     * Callback: fired when the user press any key on item in the list
     * @param event     The event that triggered the call to this method
     */
    onListItemKeyPress: function( event ) {
        
        if ( event.keyCode == event.DOM_VK_RETURN ) {
            
            var self = AntPlayer;
            var tree = document.getElementById('antFlvPlayerTree');
            var index = tree.currentIndex;
            if ( index >= 0 ) {
                
                var item = tree.view.getItemAtIndex( index );
                self.playVideo( item.antLinkedObject );
            }
        }
    },
    /**
     * previous/next buttons hendlers
     */
    onNextClicked: function( prev, forceNext ) {
        
        var self = AntPlayer;
        var next;
        
        if ( AntPrefs.random ) {
            
            next = self.getNextItemRandom( forceNext );
        }
        else {
            
            next = self.getNextItemLinear( prev, forceNext );
        }
        
        AntPlayer.playVideo( next );
    },
    /*
     * returns currently selected video
     */
    getSelectedVideoElement: function() {
        
        var self = AntPlayer;
        var tree = document.getElementById('antFlvPlayerTree');
        var view = tree.view;
        
        if ( !view.selection.count ) {
            
            // should be null only in case of no videos
            if ( self.currentVideo )
                return self.currentVideo.UIitem;
            
            if ( self.videoList.length )
                throw new Error( 'should be no elements here!!' );
            
            var propNum = 0;
            var prop;
            for ( prop in self.playlists )
                propNum++;
            
            if ( propNum == 1 )
                return self.playlists[prop];
        }
        else {
            
            var x= {}, y = {}, w = {}, h = {};
            var box = tree.treeBoxObject;
            
            // tree.view.selection.currentIndex doesn't always works
            box.selectionRegion.getBoundingBox( x, y, w, h );
            var index = box.getRowAt( x.value, y.value );
            
            return view.getItemAtIndex( index );
        }
        
        return null;
    },
    /*
     * returns array of selected elements
     */
    getSelectedVideoElements: function() {
        
        var self = AntPlayer;
        var view = document.getElementById('antFlvPlayerTree').view;
        var selection = view.selection;
        
        var numRanges = selection.getRangeCount();
        if ( !numRanges ) {
            
            if ( self.currentVideo )
                return [ self.currentVideo.UIitem ];
        }
        else {
            
            var ret = [];
            for ( var i = 0; i < numRanges; i++ ) {
                
                var start = {};
                var end = {};
                selection.getRangeAt(i,start,end);
                
                for ( var j = start.value; j <= end.value; j++ ) {
                    
                    ret.push( view.getItemAtIndex(j) );
                }
            }
            
            return ret;
        }
        
        return [];
    },
    /*
     * Callback: fired when context menu is opening
     */
    onMenuOpen: function() {
        
        var self = AntPlayer;
        var selected = self.getSelectedVideoElement();
        var openOrigin = document.getElementById('antFlvPlayerPopupPlayOrigin');
        if ( !selected ) {
            
            document.getElementById('antFlvPlayerPopupPlay').setAttribute( 'disabled', true );
            openOrigin.setAttribute( 'label', antvd.AntLang.getFormatString('AntPlayer.openOrigin', '') );
            openOrigin.setAttribute( 'disabled', true );
            document.getElementById('antFlvPlayerPopupRename').setAttribute( 'disabled', true );
            document.getElementById('antFlvPlayerPopupDelete').setAttribute( 'disabled', true );
            document.getElementById('antFlvPlayerAddToPlaylist').setAttribute( 'disabled', true );
        }
        else {
            
            var data = selected.antLinkedObject;
            if ( data ) {
                
                document.getElementById('antFlvPlayerPopupPlay').setAttribute( 'disabled', false );
                if ( data.url )
                    openOrigin.setAttribute( 'disabled', false );
                else
                    openOrigin.setAttribute( 'disabled', true );
                openOrigin.setAttribute( 'label', antvd.AntLang.getFormatString('AntPlayer.openOrigin', data.domain) );
                document.getElementById('antFlvPlayerPopupRename').setAttribute( 'disabled', false );
                document.getElementById('antFlvPlayerPopupDelete').setAttribute( 'disabled', false );
                document.getElementById('antFlvPlayerAddToPlaylist').setAttribute( 'disabled', false );
            }
            else {
                
                if ( document.getElementById(selected.id + '-ch').firstChild )
                    document.getElementById('antFlvPlayerPopupPlay').setAttribute( 'disabled', false );
                else
                    document.getElementById('antFlvPlayerPopupPlay').setAttribute( 'disabled', true );
                openOrigin.setAttribute( 'disabled', true );
                openOrigin.setAttribute( 'label', antvd.AntLang.getFormatString('AntPlayer.openOrigin', '') );
                document.getElementById('antFlvPlayerPopupRename').setAttribute( 'disabled', false );
                document.getElementById('antFlvPlayerPopupDelete').setAttribute( 'disabled', false );
                document.getElementById('antFlvPlayerAddToPlaylist').setAttribute( 'disabled', true );
            }
        }
        
        return true;
    },
    /**
     * Callback: fired when user clicks on "Play" in the context menu
     */
    onPopupPlay: function () {
        
        var self = AntPlayer;
        var element = self.getSelectedVideoElement();
        if ( !element.antLinkedObject ) {
            //playlist clicked
            element = document.getElementById( element.id + '-ch' ).firstChild;
            
            //playlist is empty
            if ( !element )
                return;
        }
        
        self.playVideo( element.antLinkedObject, true );
    },
    /*
     * Callback: fired when user clicks on "Open origin video" in the context menu
     */
    onPopupOpenOrigin: function() {
        
        var self = AntPlayer;
        var element = self.getSelectedVideoElement();
        
        if ( window.antPlayerPopup ) {
            
            window.open( element.antLinkedObject.url );
        }
        else {
            
            var bWin = AntLib.getMostRecentBrowserWindow();
            var gBrowser = bWin.gBrowser;
            gBrowser.selectedTab = gBrowser.addTab( element.antLinkedObject.url );
            bWin.focus();
        }
    },
    /**
     * Callback: fired when user clicks on "Rename" in the context menu
     */
    onPopupRename: function () {
        
        var self = AntPlayer;
        var element = self.getSelectedVideoElement();
        var data = element.antLinkedObject;
        
        if ( data ) {
            
            //video selected
            if ( self.currentVideo == data ) {
                
                alert( antvd.AntLang.getString("AntPlayer.ErrorCurrentlyPlaying") );
                return;
            }
            
            var name = data.title;
            var newName = prompt( antvd.AntLang.getFormatString("AntPlayer.PromptRename", name), name );
            if ( !newName )
                return;
            
            if ( !newName.match(/^\S+/i) ) {
                
                alert( antvd.AntLang.getString("AntPlayer.InvalidFileName") );
                return;
            }
            
            newName = AntLib.sanitize( newName );
            
            var oldPath = data.path;
            var file;
            try { // requires Gecko 14
                file = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
                file.initWithPath(oldPath);
            }
            catch(e) {
                file = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
                file.initWithPath(oldPath);
            }
            if ( file.exists() ) {
                
                try {
                    file.moveTo( file.parent,
                                 data.domain +
                                 "." +
                                 newName +
                                 oldPath.match(/\.[^\.]+$/) );
                }
                catch (e)
                {
                    alert(antvd.AntLang.getString("AntPlayer.ErrorRenaming"));
                    return;
                }
            }
            
            data.title = newName;
            data.path = file.path;
            element.firstChild.firstChild.setAttribute( 'label', newName );
            
            try {
                
                AntStorage.beginTransaction();
                AntStorage.deleteVideoRecord( oldPath );
                AntStorage.addVideoRecord( data.sha1, data.title, data.path, data.url,
                                           data.feed, data.domain, data.duration, data.size,
                                           data.playlist, data.last_view, data.nb_views, data.created_at );
            }
            finally {
                
                AntStorage.endTransaction();
            }
        }
        else {
            
            //playlist selected
            var cell = document.getElementById( element.id + '-row-cell' );
            var name = cell.getAttribute('label');
            var newName = prompt( antvd.AntLang.getFormatString('AntPlayer.PromptRenamePL', name), name );
            
            if ( !newName )
                return;
            
            try {
                
                AntStorage.beginTransaction();
                self.addPlaylist( newName );
                
                var length = self.videoList.length;
                var nativeName = (name == AntPlaylists.defaultPlaylistName) ? '' : name;
                for ( var i = 0; i < length; i++ ) {
                    
                    var item = self.videoList[i];
                    if ( item.playlist == nativeName ) {
                        
                        item.playlist = newName;
                        AntStorage.updateVideoPlaylist( item.sha1, newName );
                    }
                }
                
                self.updatePlaylistForDeleted( nativeName, newName );
                self.removePlaylist( name );
                cell.setAttribute( 'label', newName );
            }
            finally {
                AntStorage.endTransaction();
            }
        }
    },

    /**
     * Callback: fired when user clicks on "Delete" in the context menu
     */
    onPopupDelete: function () {
        
        var self = AntPlayer;
        var selectedEls = self.getSelectedVideoElements();
        
        var hasFiles = 0;
        var hasPlaylists = 0;
        for ( var i = 0; i < selectedEls.length; i++ ) {
            
            var linked = selectedEls[i].antLinkedObject;
            if ( linked )
                hasFiles++;
            else
                hasPlaylists++;
        }
        
        if ( hasFiles ) {
            
            if ( hasFiles > 1 ) {
                
                if ( !confirm(antvd.AntLang.getFormatString('AntPlayer.ConfirmDeleteMultiple', hasFiles)) )
                    return;
            }
            else {
                
                var elem = selectedEls[0].antLinkedObject;
                if ( self.currentVideo == elem ) {
                    
                    alert( antvd.AntLang.getString("AntPlayer.ErrorCurrentlyPlaying") );
                    return;
                }
                
                if ( !confirm(antvd.AntLang.getFormatString("AntPlayer.ConfirmDelete", elem.title)) )
                    return;
            }
            
            for ( var i = 0; i < selectedEls.length; i++ ) {
                
                try  {
                    
                    var item = selectedEls[i].antLinkedObject;
                    if ( !item )
                        continue;
                    
                    if ( item == self.currentVideo ) {
                        
                        alert( antvd.AntLang.getString("AntPlayer.ErrorCurrentlyPlaying") );
                        continue;
                    }
                    
                    var file;
                    try { // requires Gecko 14
                        file = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
                        file.initWithPath(item.path);
                    }
                    catch(e) {
                        file = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
                        file.initWithPath(item.path);
                    }
                    file.remove(false);
                    
                    item.UIitem.parentNode.removeChild( item.UIitem );
                    AntArray.remove( self.videoList, item );
                }
                catch (e) {
                    
                    alert( antvd.AntLang.getString("AntPlayer.ErrorDeleting") );
                    //AntLib.toLog( "ERROR: AntPlayer.onPopupDelete: " + e );
                }
            }
        }
        else if ( hasPlaylists ) {
            
            if ( hasPlaylists > 1 ) {
                
                if ( !confirm(antvd.AntLang.getFormatString('AntPlayer.ConfirmDeleteMultiplePLaylists', hasPlaylists)) )
                    return;
            }
            else {
                
                var oldPlName = document.getElementById( selectedEls[0].id + '-row-cell' ).getAttribute( 'label' );
                if ( !confirm(antvd.AntLang.getFormatString('AntPlayer.ConfirmDeletePlaylist', oldPlName)) )
                    return;
            }
            
            try {
                
                AntStorage.beginTransaction();
                
                for ( var i = 0; i < selectedEls.length; i++ ) {
                    
                    var curEl = selectedEls[i];
                    var oldPlName = document.getElementById( curEl.id + '-row-cell' ).getAttribute( 'label' );
                    
                    var els = document.getElementById( curEl.id + '-ch' ).childNodes;
                    var length = els.length;
                    if ( length )
                        self.addPlaylist( '' );
                    for ( var j = 0; j < length; j++ ) {
                        
                        var item = els[j].antLinkedObject;
                        item.playlist = '';
                        
                        AntStorage.updateVideoPlaylist( item.sha1, '' );
                    }
                    
                    var newPlForDel = '';
                    var deletingDefault = (oldPlName == AntPlaylists.defaultPlaylistName);
                    if ( deletingDefault && !length ) {
                        
                        for ( prop in self.playlists ) {
                            
                            if ( prop != AntPlaylists.defaultPlaylistName ) {
                                
                                newPlForDel = prop;
                                break;
                            }
                        }
                    }
                    
                    self.updatePlaylistForDeleted( oldPlName, newPlForDel );
                    
                    //if playlist is default:
                    //deleting it only in case of no elements and other playlist existence
                    if ( !deletingDefault || newPlForDel )
                        self.removePlaylist( oldPlName );
                }
                
                self.antTree.apply(true);
            }
            finally {
                
                AntStorage.endTransaction();
            }
        }
    },
    /*
     * Callback: fired when user clicks on "Create new playlist" in the context menu
     */
    onPopupCreateNew: function(event) {
        
        var self = AntPlayer;
        var name = prompt( antvd.AntLang.getString('AntPlayer.newPlaylistPrompt') );
        
        if ( name ) {
            
            self.addPlaylist( name );
            self.antTree.apply(true);
        }
    },
    /*
     * Callback: fired before 'add to playlist' popup showing
     */
    onAddToPlaylistShowing: function(event) {
        
        var self = AntPlayer;
        var popup = event.target;
        var childs = popup.childNodes;
        
        while ( childs.length > 1 ) {
            
            popup.removeChild( childs[1] );
        }
        
        var selectedEls = self.getSelectedVideoElements();
        
        var exclude = '';
        var fromPL = {};
        var fromCount = 0;
        for ( var i = 0; i < selectedEls.length; i++ ) {
            
            var item = selectedEls[i].antLinkedObject;
            if ( !item )
                continue;
            
            var pl = item.playlist ? item.playlist : AntPlaylists.defaultPlaylistName;
            if ( !fromPL[pl] ) {
                
                if ( ++fromCount > 1 ) {
                    
                    exclude = '';
                    break;
                }
                
                exclude = pl;
                fromPL[pl] = true;
            }            
        }
        
        var playlists = self.antTree.getCategoriesList();
        for ( var i = 0; i < playlists.length; i++ ) {
            
            var plName = playlists[i];
            if ( exclude != plName ) {
                
                var menuitem = document.createElement( 'menuitem' );
                menuitem.setAttribute( 'label', plName );
                menuitem.setAttribute( 'oncommand', 'AntPlayer.onAddToPlaylist(event);' );
                
                popup.appendChild( menuitem );
            }
        }
        
        return true;
    },
    /*
     * Callback: fired when 'add to new playlist' clicked
     */
    onAddToNewPlaylist: function() {
        
        var newName = prompt( antvd.AntLang.getString('AntPlayer.newPlaylistPrompt') );
        
        if ( newName )
            AntPlayer.addToPlaylist(newName);
    },
    /*
     * Callback: fired when 'add to some playlist' clicked
     */
    onAddToPlaylist: function(event) {
        
        var self = AntPlayer;
        self.addToPlaylist( event.target.getAttribute('label') );
    },
    /*
     * adds selected in the tree items to playlist
     * @param       plName {string}    playlist name
     */
    addToPlaylist: function(plName) {
        
        try {
            
            var self = AntPlayer;
            
            if ( plName == AntPlaylists.defaultPlaylistName )
                plName = '';
            
            AntStorage.beginTransaction();
            self.addPlaylist( plName );
            
            var selectedEls = self.getSelectedVideoElements();
            for ( var i = 0; i < selectedEls.length; i++ ) {
                
                var item = selectedEls[i].antLinkedObject;
                
                if ( item ) {
                    item.playlist = plName;
                    AntStorage.updateVideoPlaylist( item.sha1, plName );
                }                
            }
            
            self.sortVideos( AntPrefs.sortBy, AntPrefs.sortDirection );
            self.antTree.apply(true);
        }
        finally {
            
            AntStorage.endTransaction();
        }
    },
    /*
     * sort helpers
     */
    sortVideos: function(field, dir) {
        
        var self = AntPlayer;
        var ret1, ret2;
        
        if ( dir ) {
            
            ret1 = -1;
            ret2 = 1;
        }
        else {
            
            ret1 = 1;
            ret2 = -1;
        }
        
        self.videoList.sort( function(f, s) {
                        
                        var fField = f[field];
                        var sField = s[field];
                        if ( typeof(fField) == 'string' ) {
                            
                            fField = fField.toLowerCase();
                            sField = sField.toLowerCase();
                        }
                        if ( fField < sField )
                            return ret1;
                        else if ( fField > sField )
                            return ret2;
                        
                        return 0;
                     } );
    },
    applySort: function(el, direction) {
        
        var self = AntPlayer;
        var field = el.id.replace( /Col$/, '' );
        
        self.sortVideos( field, direction );
        
        if ( self.sortByElement )
            self.sortByElement.removeAttribute( 'sortDirection' );
        
        AntPrefs.sortDirection  = direction;
        AntPrefs.sortBy         = field;
        var dirStr              = direction ? 'ascending' : 'descending';
        el.setAttribute( 'sortDirection', dirStr );
        self.sortByElement = el;
        
        self.antTree.apply(true);
    },
    onSort: function(el) {
        
        var self = AntPlayer;
        var dir = el.getAttribute( 'sortDirection' );
        var bDir;
        
        if ( !dir || dir == 'descending')
            bDir = true;
        else 
            bDir = false;
        
        self.applySort( el, bDir );
    },
    /*
     * updates the database
     */
    updateDB: function() {
        
        try {
            
            var self = AntPlayer;
            
            AntStorage.beginTransaction();
            var listFromDb = new AntVideoList(true);
            
            var videoDirectory;
            try { // requires Gecko 14
              videoDirectory = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
              videoDirectory.initWithPath(AntPrefs.flvDir);
            }
            catch(e) {
              videoDirectory = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
              videoDirectory.initWithPath(AntPrefs.flvDir);
            }
            
            if ( !videoDirectory.exists() )
                return;
            
            var entries = videoDirectory.directoryEntries;
            while ( entries.hasMoreElements() ) {

                try {
                    var entry = entries.getNext();
                    AntLib.QI( entry, AntLib.CI("nsIFile") );
                    
                    if ( entry.isDirectory() || entry.fileSize == 0 )
                        continue;
                    
                    var m = entry.leafName.match(self.movieFileMatch);
                    
                    if ( !m )
                        continue;
                    if ( m.length < 2 )
                        throw new Error('should be 2 search results');
                    
                    var path = entry.path;
                    if ( !listFromDb.contain('path', path) ) {
                        
                        var sha1 = AntHash.getFileHash( path );
                        var item = listFromDb.contain('sha1', sha1);
                        if ( !item ) {
                            
                            AntStorage.addPlaylist( '' );
                            AntStorage.addVideoRecord( sha1, m[1], path,
                                                       '', '', '',
                                                       0, entry.fileSize, '',
                                                       0, 0, entry.lastModifiedTime );
                        }
                        else {
                            
                            //deleting first, as some errors with updating primary key
                            AntStorage.deleteVideoRecord( item.path );
                            AntStorage.addVideoRecord( sha1, item.title, path,
                                                       item.url, item.feed, item.domain,
                                                       item.duration, entry.fileSize, item.playlist,
                                                       item.last_view, item.nb_views, entry.lastModifiedTime );
                        }
                    }
                }
                catch (e) {
                    //AntLib.toLog(e);
                }
            }
            
            //on this stage there only items, that not found on the HD
            AntStorage.deleteVideoRecords( listFromDb.deletedFiles,
                                           function(data) {
                                                
                                                var date = data.last_view;
                                                if ( !date )
                                                    date = data.created_at;
                                                
                                                return ( (new Date()) - (new Date(date)) ) > 2678400000; //miliseconds in month
                                           } );
        }
        catch (e) {
            
            //AntLib.toLog(e);
        }
        finally {
            
            AntStorage.endTransaction();
        }
    },
    /*
     * add/remove playlist functions
     */
    addPlaylist: function( name ) {
        
        var self = AntPlayer;
        AntStorage.addPlaylist( name );
        if ( !name )
            name = AntPlaylists.defaultPlaylistName;
        
        self.playlists[name] = true;
    },
    removePlaylist: function( name ) {
        
        var self = AntPlayer;
        
        AntStorage.deletePlaylist( name == AntPlaylists.defaultPlaylistName ? '' : name );
        
        delete self.playlists[name];
    },
    /*
     * updating database records for deleted files.
     * it is needed to remove all the references to playlist in case of deleting it
     */
    updatePlaylistForDeleted: function( oldName, newName ) {
        
        var deletedFiles = (new AntVideoList(true)).deletedFiles;
        var dlength = deletedFiles.length;
        for ( var i = 0; i < dlength; i++ ) {
            
            var item = deletedFiles[i];
            if ( item.playlist == oldName ) {
                AntStorage.updateVideoPlaylist( item.sha1, newName );
            }
        }
    },
    /*
     * Apply flash player naming conversion
     */
    toFlashCompatible: function( item ) {
        
        try {
            //flash player naming conversion
            var self = AntPlayer;
            var sourcePath = item.path;
            var file;
            try { // requires Gecko 14
              file = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
              file.initWithPath(sourcePath);
            }
            catch(e) {
              file = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
              file.initWithPath(sourcePath);
            }
            
            if ( !file.exists() )
                return;
            
            var fName = self.replaceUnacceptedFlashChars( file.leafName );
            if ( fName != file.leafName ) {
                
                file.moveTo( null, fName );
                item.path = file.path;
                
                try {
                
                    AntStorage.beginTransaction();
                    AntStorage.deleteVideoRecord( sourcePath );
                    AntStorage.addVideoRecord( item.sha1,     item.title,     item.path,     item.url,
                                               item.feed,     item.domain,    item.duration, item.size,
                                               item.playlist, item.last_view, item.nb_views, item.created_at );
                }
                finally {
                    
                    AntStorage.endTransaction();
                }
            }
        }
        catch (e) {
            //AntLib.toLog( 'error in toFlashCompatible: ' + e );
        }
    },
    dragStart: function(event) {
        var searchItem = document.getElementById('search-text');
        if (searchItem.value != '')
            return;
        event.dataTransfer.setData('antplayer/item', "ant");
        event.dataTransfer.effectAllowed = "move";
    },
    dragOver: function(event) {
        var self = AntPlayer;
        var jsonData = event.dataTransfer.getData("antplayer/item");
        event.dataTransfer.dropEffect = "move";
        event.preventDefault();

        if (event.target.localName == "treechildren") {
          var tree = document.getElementById("antFlvPlayerTree");
          var row = {};
          var col = {};
          var element = {};
          tree.treeBoxObject.getCellAt(event.clientX, event.clientY,
                                       row, col, element);
          if (row.value >= 0) {
            var item = tree.view.getItemAtIndex(row.value);
            dragRow = item.firstChild;
            if (!dragRow.parentNode.antLinkedObject) { // category
                var cell = document.getElementById( dragRow.id + '-cell' );
                self.catDropName = cell.getAttribute('label');
            }
            else { // video
                self.catDropName = dragRow.parentNode.antLinkedObject.playlist;
            }
          }
          else {
          }
        }
    },
    dragDrop: function(event) {
        var self = AntPlayer;
        self.addToPlaylist(self.catDropName);
    }
}
