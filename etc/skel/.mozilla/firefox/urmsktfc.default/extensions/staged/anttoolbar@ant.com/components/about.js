// 
//  about.js
//  firefox
//  
//  Created by DS on 2011-04-11.
//  Copyright 2008-2016 Ant.com. All rights reserved.
//

const Cc = Components.classes;
const Ci = Components.interfaces;

Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');
 

function AboutAntPlayer() { }

AboutAntPlayer.prototype = {
    
    classDescription: 'about:antplayer',
    contractID: '@mozilla.org/network/protocol/about;1?what=antplayer',
    classID: Components.ID('{580ee6d0-6414-11e0-ae3e-0800200c9a66}'),
    
    QueryInterface: XPCOMUtils.generateQI( [Ci.nsIAboutModule] ),
    getURIFlags: function(aURI) {
        return Ci.nsIAboutModule.ALLOW_SCRIPT;
    },
    newChannel: function(aURI) {
        
        var ios = Cc["@mozilla.org/network/io-service;1"].getService( Ci.nsIIOService );
        var channel = ios.newChannel( 'chrome://antbar/content/player/player.xul', null, null );
        channel.originalURI = aURI;
        
        return channel;
    }
};

const NSGetFactory = XPCOMUtils.generateNSGetFactory
          ? XPCOMUtils.generateNSGetFactory([AboutAntPlayer])
          : undefined;
const NSGetModule = !XPCOMUtils.generateNSGetFactory
          ? XPCOMUtils.generateNSGetModule([AboutAntPlayer])
          : undefined;
