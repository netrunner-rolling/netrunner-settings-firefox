//
// detector.js
//
// Created by Dima Sidorchenko on 21-10-2010
// Contributor Brian King
// Copyright 2008-2012 Ant.com. All rights reserved.
//

/**
 * AntVideoDetector class contains functions for detecting video
 */

var AntSupportedExt = 'flv|mp4|m4v|m4a|f4v|mp3|mov|webm|wmv|ogg|ogv|avi';

var AntVideoDetector = {

    extRex: new RegExp( '\\.(' + AntSupportedExt + ')(?:\\?|&|$)', 'i' ),

    // {{{ isVideo method

    isVideo: function(request) {
        
        var self = AntVideoDetector;
        var score = 0;
        var url = request.name;
        var uri = request.URI;
        var host = uri.host;
        var path = uri.path;
        var contentLength = request.contentLength;
        var lengthStr = contentLength.toString();
        var contentType = request.contentType;
        
        try {
            var referrer = request.referrer.spec;
        }
        catch (e) { referrer = ''; }
        
        try {
           var connection = request.getResponseHeader('Connection'); 
        }
        catch (e) { connection = ''; }
        
        try {
            var encoding = request.getResponseHeader('Content-Transfer-Encoding');
        }
        catch (e) { encoding = ''; }
        
        //not using checking for 'x-flash-version' header. because it is sent only on IE
        //not using checking for cdn.eyewonder.com. not detected for FF. this were ad on break.com
        
        //for hosts like tc.v13.cache8.c.youtube.com
        if ( host.match( /[0-9]+\D+\.\D+/i ) )
            score += 10;
        
        if ( host.match( /[\w\-]*(video|media|server|flv)[\w\.\-]+/i ) )
            score += 6;
            
        if ( host.match( /stream/i ) ) //http://stream2.dus.chefkoch.de/video_streaming_light_new.php?vid=289_a_sid=de0f43db526f959ee82ca80faa7f1de3_a_vak=1453302648_a_t=07b72aa614a56f808d9bc1b2815468f5
            score += 20;

        if ( path.match( /stream/i ) )
            score += 20;
        
        if ( path.match( /banner|ads|advertiser/i ) )
            score += -15;
        
        if ( path.match(self.extRex) || path.match(/\.hlv(\?|&|$)/))
            score += 60;
        
        if ( path.match(new RegExp(AntSupportedExt, 'i')) )
            score += 5;
        
        if ( referrer.match( /\.swf/i ) )
            score += 15;
        
        if ( referrer.match( /player|swf|xmoov/i ) )
            score += 10;
        
        if ( path.match( /\.(jpe?g|png|gif|exe|pdf|doc)/i ) )
            score += -15;
        
        if ( connection.match( /Keep-Alive/i ) )
            score += 4;
        
        if ( contentLength == -1 )
            score += 13;
        
        //last.fm double detection avoiding
        if ( contentLength == -1 && host.match( /last.fm$/i ) && path.match( /user\/[a-f0-9]{32}\.mp3$/i ) )
            score -= 4;
        
        if ( contentLength > 0 && contentLength < 200000 ) //limitation for files less then 200kb, 0 size is accepted
            score -= 100;
        
        //http://www.chefkoch.de/magazin/artikel/1627,0/Chefkoch/Video-Wildconsomm-mit-Trueffelkloesschen.html
        if ( contentLength > 1000000 && contentType.match( /text\/html/i ) )
            score += 50;
        
        //http://www.ntv.co.ke/Churchill/Churchill%20Live%20Episode%2015%20part%202/-/1006102/1073940/-/x5ktxkz/-/index.html
        if ( contentLength > 3000000 && contentType.match(/image\/jpeg/) )
            score += 10;
        
        if ( lengthStr.match( /[0-9]{5,}/i ) )
            score += 6;
        
        if ( lengthStr.match( /[0-9]{7,}/i ) )
            score += 10;
        
        if ( contentType.match( /image\/(jpeg|gif|png)/i ) )
            score += -20;
        
        if ( contentType.match( /text\/(html|xml|css)/i ) )
            score += -20;
        
        if ( contentType.match( /application\/(x-)?javascript/i ) )
            score += -15;
        
        if ( contentType.match( /application\/(x-)?shockwave-flash/i ) )
            score += -5;

        if ( contentType.match( /(application|video)\/(x-)?(flv|mp4|m4v|vnd\.objectvideo|f4v|webm|ms-wmv|ogg|msvideo)/i ) )
            score += 60;

        if ( contentType.match( /application\/ogg/ ) )
            score += 60;
        
        if ( contentType.match( /flv\-application\/octet\-stream/i ) )
            score += 74;
        
        if ( contentType.match( /text\/plain/i ) )
            score += 10;
        
        if ( contentType.match( /application\/(octet-stream|download)/i ) )
            score += 50;
    
        if ( contentType.match( /audio\/(x-)?(mpeg|mpg)/i ) )
            score += 60;
        
        if ( encoding.match( /binary/i ) )
            score += 5;
        
        if ( url.match(  /(videos?|movies?)\/.*\.swf/i ) )
            score += 15;

        if ( host.match(/101\.ru$/i) )
            score += 2;

        //
        // Special advertising rules:
        //

        // Daily :
        if ( (host.match( /\.dmcdn\.net$/i ) && path.match( /^\/mc\//i )) || host.match( /ad\.auditude\.com/) )
          score -= 80;

        if (host.match(/s3\.amazonaws\.com/) && referrer.match(/s3\.amazonaws\.com/) || host.match(/ds\.serving-sys\.com/))
          score -= 200;

      // if (score > 74)
      // {
      //   AntLib.toLog(    'url: '            + url +
      //               '\r\nref: '            + referrer +
      //               '\r\nConnection: '     + connection +
      //               '\r\nContentLength: '  + lengthStr +
      //               '\r\nContentType: '    + contentType +
      //               '\r\nscore: '          + score );
      // }

        return score > 74;
    },

    // }}}

    // {{{ seekToBegin method
    seekToBegin: function(request) {
        
        var self = AntVideoDetector;

        var URI = request.URI;
        var url = URI.spec;
        var valObj = {regrab: false, url: url, unkownSize: false};

        //youtube|break|xhamster|xvideos|spankwire|keezmovies|youjizz.com
        url = url.replace(
                /(\?|&)(begin|range|offset|ts|ec_seek|start|st|fs)=([^&]*)/ig
            //can be start=undefined
            , function(substr, delimiter, key, value, offset, s) {
                /**
                 * Lowercase key
                 * @type String
                 */
                let _key = key ? key.toLowerCase() : "";

                /*
                 * exception for
                 * http://noortvd1gcom.d1g.com/video/show/4054713
                 * leaving ts parameter
                 */
                if ((_key == "ts") && URI.host.match(/(^|\.)d1g.com$/i))
                    return substr;

                //http://www.pornstarnetwork.com/video/81105.html
                //start parameter
                if ((_key == "start") && URI.host.match(/pornstarnetwork.com$/i))
                    return substr;

                if ((_key == "st") && value.match(/[a-z]/ig)) {
                    /** probably not a position argument */
                    return substr;
                }

                if (delimiter == '?') {
                    //url.com/file.flv?begin=1&bla=1            -->     url.com/file.flv?&bla=1
                    if (offset + substr.length < s.length)
                        return '?';
                }
                return '';
            })
            .replace(/\?$/, '')
            .replace(/\?&/, '?');

        valObj.url = url;
        return valObj;
        
        //not fixed double detection:
        //this sites is not so popular or has some issues to remove duplication.
        //http://current.com/items/77430911_1000-bikini-models.htm
        //http://v.youku.com/v_show/id_XMTI3MjIzNTYw.html
    },
    // }}}

    // {{{ isValidVideo method

    isValidVideo: function(request, doc)
    {
        var self = AntVideoDetector;
        if (self.isVideo(request))
        {
            var valObj = self.seekToBegin(request);
            return valObj;
        }
            
        return false;
    }

    // }}}
};
