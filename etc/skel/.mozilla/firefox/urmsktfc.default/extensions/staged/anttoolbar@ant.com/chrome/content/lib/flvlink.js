//
//  antflvlink.js
//  firefox
//
//  Created by Zak on 2008-06-12.
//  Copyright 2008-2012 Ant.com. All rights reserved.
//

// {{{ AntFlvLink class
/**
 * Contains values necessary to list and download a flv
 * @param origin    Where the flv came from
 * @param url       Link to the flv
 * @param name      Guessed name of the movie
 * @param header option header object for request the url
 */
var AntFlvLink = function (obj)
{
    this.webPage = obj.webPage;
    this.origin = obj.origin;
    this.url = obj.url;
    this.name = obj.name;
    this.doc = obj.doc;
    this.path = obj.path ? obj.path : "";
    this.date = obj.date ? obj.date : "";
    this.filesize = obj.filesize ? obj.filesize : "";
    this.contentType = obj.type ? obj.type : "";
    this.contentLength = obj.length ? obj.length : "";
    this.contentCharset = obj.charset ? obj.charset : "";
    this.size = obj.size ? parseInt(obj.size) : -1;
    this.postData = obj.postData;

    if (this.size < 0)
        this.sizeh = '';
    else
    {
        var a = AntLib.convertByteUnits(this.size);
        this.sizeh = a[0] + ' ' + a[1];
    }

    this.score = obj.score ? obj.score : 0;

    if (obj.header)//optional parameter
        this.header = obj.header;
    else
        this.header = '';
};


AntFlvLink.prototype =
{
    /**
      * Return the file extention from the contentType
    */
    getExtension: function () {
        
        if ( this.contentType.match(/audio\/(x-)?(mpeg|mpg)/i) )
            return 'mp3';
        
        var re = new RegExp(AntSupportedExt, 'i');
        var m = this.contentType.match( re );
        
        if (m)
          return m[0].toLowerCase();
        
        m = this.url.spec.match(AntVideoDetector.extRex);//searching file extention
        if( m && m.length == 2 ) //on success regexp will return [0]:.mp4& [1]:mp4
            return m[1].toLowerCase();
        
        m = this.url.spec.match(re); //seraching any presence of mp4/flv etc. word.
        if ( m )
            return m[0].toLowerCase();
        
        if ( this.url.host.match(/pandora.com$/i) )
            return 'mp3';
        
        return 'flv';
    },

    compareStrEx: function( rex, s1, s2 ) {
        
        var m1 = s1.match( rex );
        var m2 = s2.match( rex );
        
        if ( m1.length > 0 && m2.length > 0 ) {
            
            return m1[0] == m2[0];
        }
        
        return null;
    },
    /*
     * Compare two links
     */
    isSame: function(link) {
        
        //code for mz-52 removed. not reproduced
        if ( this.postData ) {
            
            if ( this.url.spec == link.url.spec ) {
                
                if ( AntArray.identical( AntLib.streamToData(link.postData),
                                         AntLib.streamToData(this.postData)) )
                    return true;
                
                return false;
            }
        }
        
        var myHost = this.url.host;
        var myPath = this.url.path;
        if ( myHost.match(/youtube.com$/i) ) {
            
            if ( this.compareStrEx(/id=[^&]+/i, link.url.path, myPath)
              && this.compareStrEx(/itag=[^&]+/i, link.url.path, myPath) )
                return true;
        }
        else if ( myHost.match(/googlevideo.com$/i) ) {
            
            if ( this.compareStrEx(/id=[^&]+/i, link.url.path, myPath) )
                return true;
        }
        else if ( myHost.match(/llnwd.net$/i) ) {
            
            if ( myPath.replace(/(\?|&)(h|e)=[^&]+/ig, '') == link.url.path.replace(/(\?|&)(h|e)=[^&]+/ig, '') )
                return true;
        }
        //dailymotion, break etc
        else if ( myPath.match(AntVideoDetector.extRex) ) {
            
            if ( this.compareStrEx(/^[^?]+/i, link.url.path, myPath) )
                return true;
        }
        
        return link.url.spec == this.url.spec;
    }
};
// }}}
