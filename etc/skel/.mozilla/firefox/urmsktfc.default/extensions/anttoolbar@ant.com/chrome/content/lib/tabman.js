// 
//  tabman.js
//  firefox
//  
//  Created by Dima Sidorchenko on 2008-11-1.
//  Contributor Brian King
//  Copyright 2008-2012 Ant.com. All rights reserved.
//

function AntData() {
    this.init();
}

AntData.prototype = {
    init: function() {
        this.videos = [];
        this.ytstreams = [];
        this.startTime = new Date();
        this.active = false;
        this.activeTime = 0;
        this.activeStart = null;
        this.sent = false;
        this.notFound = false;
        this.downloadClicked = false;
    },
    releaseVideos: function()
    {
        for (var i = 0; i < this.videos.length; ++i)
        {
            this.videos[i].release();
        }
        this.videos = [];
        this.ytstreams = [];
    },
    activate: function() {
        
        this.deactivate();
        
        this.active = true;
        this.activeStart = new Date();
    },
    deactivate: function() {
        
        if ( this.active ) {
            this.activeTime += parseInt( (new Date() - this.activeStart)/1000 );//ms -> sec
            this.active = false;
        }
    },
    totalTime: function() {
        return parseInt( (new Date() - this.startTime)/1000 );
    },
    totalActiveTime: function() {
        this.deactivate();
        
        return this.activeTime;
    }
};

var AntTabMan = {
    init: function() {
        
        AntTabMan.setupListeners();
    },
    setupListeners: function() {
        
        var self = AntTabMan;
        var tabs = gBrowser.tabContainer;
        
        tabs.addEventListener( 'TabOpen', self.tabOpened, false );
        tabs.addEventListener( 'TabSelect', self.tabSelected, false );
        tabs.addEventListener( 'TabClose', self.tabClosed, false );
        
        //attach to already opened tabs
        for ( var i = 0; i < tabs.itemCount; i++ ) {
            tabs.getItemAtIndex(i)
                 .addEventListener( 'load', AntTabMan.locationChangedEv, false );
        }
    },
    /*
     * note: this location change mechanism is different from AntWatchUrl
     * when AntWatchUrl is firing the event - document object is already new one
     * AntTabMan.locationChangedEv is firing, when previous document still exists
     */
    locationChangedEv: function(event) {
        var self = AntTabMan;
        
        var tab = event.target;
        var browser = tab.linkedBrowser;
        var doc = browser.contentDocument;
        var thisWnd = browser.contentWindow;
        var data = self.getAntData(doc);
        thisWnd.addEventListener( 'unload'
                                  , function(){ self.sendNotification(doc); }
                                  , false );
        
        if ( gBrowser.contentWindow == thisWnd ) {
            data.activate();
        }
    },
    tabOpened: function(event) {
        let tab = event.target;
        tab.addEventListener( 'load', AntTabMan.locationChangedEv, false );
    },
    tabSelected: function(event) {
        
        var self = AntTabMan;
        var tabs = gBrowser.tabContainer;
        
        for ( var i = 0; i < tabs.itemCount; i++ ) {
            
            var itab = tabs.getItemAtIndex(i);
            self.getAntData(itab.linkedBrowser.contentDocument).deactivate();
        }
        
        var contentDocument = event.target.linkedBrowser.contentDocument;
        self.getAntData( contentDocument ).activate();
        
        AntRank.updateRank( AntLib.toURI(contentDocument.location), contentDocument );
        AntFlvUi.updateDownloadButton( contentDocument );
    },
    tabClosed: function(event) {
        
        AntTabMan.sendNotification( event.target.linkedBrowser.contentDocument );
    },
    sendNotification: function(doc) {
        var data = AntTabMan.getAntData(doc);
        if ( !data.sent ) {
            antvd.AntRPC.detectedVideos( doc );
            data.releaseVideos();
            data.sent = true;
        }
    },
    getAntData: function(doc) {
        
        if ( doc.__antData__ == undefined )
            doc.__antData__ = new AntData();
            
        return doc.__antData__;
    }
};
