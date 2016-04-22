// 
//  html5helper.js
//  firefox
//  
//  Created by Dmitriy Sidorchenko on 2008-06-18.
//  Copyright 2008-2012 Ant.com. All rights reserved.
//

function html5VideoHelper() {
    
    this.videoEl = null;
    this.videoEvents = [];
    this.sourceFullScreenVideo = null;
    this.fullScreen = false;
}

html5VideoHelper.prototype.setFullScreenHook = function( el, ev ) {
    
    this.videoEl = el;
    this.videoEvents = ev || [];
    this.fullScreen = false;
    
    var proto = AntLib.getMainWindow().nsContextMenu.prototype;
    this.sourceFullScreenVideo = proto.fullScreenVideo;
    
    var self = this;
    
    proto.fullScreenVideo = function() {
        
        var ret = self.sourceFullScreenVideo.apply( {target: self.videoEl} );
        
        var wm = AntLib.CCSV( '@mozilla.org/appshell/window-mediator;1', 'nsIWindowMediator' );
        var browserEnumerator = wm.getEnumerator(null);
        
        while ( browserEnumerator.hasMoreElements() ) {
            
            let browserWin = browserEnumerator.getNext();
            let curDoc = browserWin.document;
            //seems like instance is dialog, for regular instances it should be XULDocument
            if ( curDoc instanceof HTMLDocument && self.videoEl.ownerDocument != curDoc ) {
                
                browserWin.addEventListener(
                    'load',
                    function() {
                       
                        var els = browserWin.document.getElementsByTagName('video');
                        if ( !els.length )
                            return;
                        
                        var source = self.videoEl.currentSrc || self.videoEl.src;
                        
                        //should be only one video on the page
                        let item = els[0];
                        item.addEventListener(
                           'loadeddata',
                            function() {
                               
                                item.removeEventListener( 'loadeddata',
                                                          arguments.callee,
                                                          false );
                                let src = item.currentSrc || item.src;
                                if ( src == source ) {
                                   
                                    self.fullScreen = true;
                                    browserWin.addEventListener(
                                        'unload',
                                        function() {
                                            
                                            //if user exits fullscreen mode, while
                                            //playback is not finished
                                            if ( !item.ended )
                                                self.fullScreen = false;
                                            
                                            let src = item.currentSrc || item.src;
                                            let oldSrc = self.videoEl.currentSrc || self.videoEl.src;
                                            if ( src != oldSrc ) {
                                                
                                                self.videoEl.src = src;
                                                self.videoEl.load();
                                                
                                                var currentTime = item.currentTime;
                                                var volume = item.volume;
                                                var muted = item.muted;
                                                var playIt = !item.paused && !item.ended;
                                                
                                                item.pause();
                                                item.src = '';
                                                
                                                self.videoEl.addEventListener(
                                                'loadeddata',
                                                function() {
                                                    self.videoEl.removeEventListener( 'loadeddata',
                                                                                      arguments.callee,
                                                                                      false );
                                                    self.videoEl.currentTime = currentTime;
                                                    self.videoEl.volume = volume;
                                                    self.videoEl.muted = muted;
                                                    if ( playIt ) {
                                                      self.videoEl.play();
                                                    }
                                                },
                                                false );
                                            }
                                        },
                                        false );
                                    
                                    for ( let i = 0; i < self.videoEvents.length; i++ ) {
                                        
                                        var evInfo = self.videoEvents[i];
                                        //attaching listeners
                                        //listeners from origin player page will be not fired
                                        //while video played in the other(fullscreen) window
                                        item.addEventListener( evInfo.name,
                                                               evInfo.handler,
                                                               false );
                                    }
                                }
                            },
                            false);
                    },
                    false );
            }
        }
        
        return ret;
    }
}

html5VideoHelper.prototype.removeFullScreenHook = function() {
    
    if ( this.sourceFullScreenVideo ) {
        
        AntLib.getMainWindow().nsContextMenu.prototype.fullScreenVideo = this.sourceFullScreenVideo;
        this.sourceFullScreenVideo = null;
    }
}

html5VideoHelper.prototype.setFullScreen = function() {
    
    AntLib.getMainWindow().nsContextMenu.prototype.fullScreenVideo.apply( {target: this.videoEl} );
}