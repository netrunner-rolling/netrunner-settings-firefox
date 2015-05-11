//
// hash.js
// firefox
//
// Created by Dmitriy on 2011-02-15
// Copyright 2008-2012 Ant.com. All rights reserved.
//

var AntHash = {
    
    getFileHash: function(path) {

      var file;
      try { // requires Gecko 14
        file = Components.classes["@mozilla.org/file/local;1"]
                           .createInstance(Components.interfaces.nsIFile);
        file.initWithPath(path);
      }
      catch(e) {
        file = Components.classes["@mozilla.org/file/local;1"]
                           .createInstance(Components.interfaces.nsILocalFile);
        file.initWithPath(path);
      }

      try
      {
        var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                                .createInstance(Components.interfaces.nsIFileInputStream)
                                .QueryInterface(Components.interfaces.nsISeekableStream);
        istream.init(file, -1, -1, false);
        
        var ch = Components.classes["@mozilla.org/security/hash;1"]
                           .createInstance(Components.interfaces.nsICryptoHash);
        ch.init( ch.SHA1 );
        
        const offset = 16384;
        var available = istream.available();
        if ( available > offset*2 ) {
            
            istream.seek(0, offset);
            available -= offset;
        }
        var lenToHash = 131072;
        if ( lenToHash > available )
            lenToHash = available;
        
        ch.updateFromStream( istream, lenToHash );
        
        var bynHash = ch.finish(false);
        
        var hash = '';
        for (i in bynHash) {
            
            hash += ('0' + bynHash.charCodeAt(i).toString(16)).slice(-2);
        }
        
        return hash;
      }
      catch(e) { 
          AntLib.toLog("Failed to generate hash: " + e);
          return null;
      }
    }
}
