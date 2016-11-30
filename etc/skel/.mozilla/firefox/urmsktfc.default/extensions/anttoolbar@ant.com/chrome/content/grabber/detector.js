//
// detector.js
//
// Created by DS on 21-10-2010
// Contributor BK
// Copyright 2008-2016 Ant.com. All rights reserved.
//

// AntVideoDetector class contains functions for detecting video
var AntSupportedExt = 'flv|mp4|m4v|m4a|f4v|mp3|mov|webm|wmv|ogg|ogv|avi';

var AntVideoDetector =
{
    extRex: new RegExp('\\.(' + AntSupportedExt + ')(?:\\?|&|$)', 'i'),
    
    masterScore: 74,
    
    debugLogScoring: function(Message, Score)
    {
        let _display = false;
        let _mode = "";

        if (!AntPrefs)
        {
            return;
        }
        
        try
        {
            _mode = AntPrefs.getAntBranch().getCharPref('logScoring');
        }
        catch(e)
        {
            return;
        }
        
        if (_mode.length == 0)
        {
            return;
        }
            
        switch (_mode.toLowerCase())
        {
            case "all":
                _display = true;
                break;
            
            case "below":
                _display = (Score < this.masterScore);
                break;
            
            case "equalorabove":
                _display = (Score >= this.masterScore);
                break;
            
            default:
                AntLib.toLog("detector.js", "Unknown log scoring mode set: " + _mode);
                return;
        }
                
        if (_display == true)
        {
            AntLib.toLog("detector.js", Message);
        }
    },

    isVideo: function (request)
    {
        var self = AntVideoDetector;
        var score = 0;
        var url = request.name;
        var uri = request.URI;
        var host = uri.host;
        var path = uri.path;
        var contentLength = request.contentLength;
        var lengthStr = contentLength.toString();
        var contentType = request.contentType;
        var logMessage = "";

        try
        {
            var referrer = request.referrer.spec;
        }
        catch (e)
        {
            referrer = '';
        }

        try
        {
            var connection = request.getResponseHeader('Connection');
        }
        catch (e)
        {
            connection = '';
        }

        try
        {
            var encoding = request.getResponseHeader('Content-Transfer-Encoding');
        }
        catch (e)
        {
            encoding = '';
        }
        
        logMessage = "Scoring subsystem, start matching for\nURL: " +  url + "\nCONTENT-TYPE: " + contentType + "\nREFERRER: " + referrer + "\n";
        
        // Not using checking for 'x-flash-version' header. because it is sent only on IE
        // Not using checking for cdn.eyewonder.com. not detected for FF. this were ad on break.com

        // Rule #1
        // For hosts like tc.v13.cache8.c.youtube.com
        if (host.match(/[0-9]+\D+\.\D+/i))
        {
            score += 10;
            logMessage = logMessage + "...rule 1, score 10, total " + score + "\n";
        }

        // Rule #2
        if (host.match(/[\w\-]*(video|media|server|flv)[\w\.\-]+/i))
        {
            score += 6;
            logMessage = logMessage + "...rule 2, score 6, total " + score + "\n";
        }

        // Rule #3
        // http://stream2.dus.chefkoch.de/video_streaming_light_new.php?vid=289_a_sid=de0f43db526f959ee82ca80faa7f1de3_a_vak=1453302648_a_t=07b72aa614a56f808d9bc1b2815468f5
        if (host.match(/stream/i))
        {
            score += 20;
            logMessage = logMessage + "...rule 3, score 20, total " + score + "\n";
        }

        // Rule #4
        if (path.match(/stream/i))
        {
            score += 20;
            logMessage = logMessage + "...rule 4, score 20, total " + score + "\n";
        }

        // Rule #5
        if (path.match(/banner|banners|ads|advertiser/i))
        {
            score += -50;
            logMessage = logMessage + "...rule 5, score -50, total " + score + "\n";
        }

        // Rule #6
        if (path.match(self.extRex) || path.match(/\.hlv(\?|&|$)/))
        {
            score += 60;
            logMessage = logMessage + "...rule 6, score 60, total " + score + "\n";
        }

        // Rule #7
        if (path.match(new RegExp(AntSupportedExt, 'i')))
        {
            score += 5;
            logMessage = logMessage + "...rule 7, score 5, total " + score + "\n";
        }

        // Rule #8
        if (referrer.match(/\.swf/i))
        {
            score += 15;
            logMessage = logMessage + "...rule 8, score 15, total " + score + "\n";
        }

        // Rule #9
        if (referrer.match(/player|swf|xmoov/i))
        {
            score += 10;
            logMessage = logMessage + "...rule 9, score 10, total " + score + "\n";
        }

        // Rule #9-1
        if (referrer.match(/banner|banners|ads|advertiser/i))
        {
            score -= 50;
            logMessage = logMessage + "...rule 9-1, score -50, total " + score + "\n";
        }

        // Rule #10
        if (path.match(/\.(jpe?g|png|gif|exe|pdf|doc)/i))
        {
            score += -15;
            logMessage = logMessage + "...rule 10, score -15, total " + score + "\n";
        }

        // Rule #11
        if (connection.match(/Keep-Alive/i))
        {
            score += 4;
            logMessage = logMessage + "...rule 11, score 4, total " + score + "\n";
        }

        // Rule #12
        if (contentLength == -1)
        {
            score += 13;
            logMessage = logMessage + "...rule 12, score 13, total " + score + "\n";
        }

        // Rule #13
        // last.fm double detection avoiding
        if (contentLength == -1 && host.match(/last.fm$/i) && path.match(/user\/[a-f0-9]{32}\.mp3$/i))
        {
            score -= 4;
            logMessage = logMessage + "...rule 13, score -4, total " + score + "\n";
        }

        // Rule #14
        // Limitation for files less then 200kb, 0 size is accepted
        if (contentLength > 0 && contentLength < 200000)
        {
            score -= 100;
            logMessage = logMessage + "...rule 14, score -100, total " + score + "\n";
        }

        // Rule #15
        // http://www.chefkoch.de/magazin/artikel/1627,0/Chefkoch/Video-Wildconsomm-mit-Trueffelkloesschen.html
        if (contentLength > 1000000 && contentType.match(/text\/html/i))
        {
            score += 50;
            logMessage = logMessage + "...rule 15, score 50, total " + score + "\n";
        }

        // Rule #16
        // http://www.ntv.co.ke/Churchill/Churchill%20Live%20Episode%2015%20part%202/-/1006102/1073940/-/x5ktxkz/-/index.html
        if (contentLength > 3000000 && contentType.match(/image\/jpeg/))
        {
            score += 10;
            logMessage = logMessage + "...rule 16, score 10, total " + score + "\n";
        }

        // Rule #17
        if (lengthStr.match(/[0-9]{5,}/i))
        {
            score += 6;
            logMessage = logMessage + "...rule 17, score 6, total " + score + "\n";
        }

        // Rule #18
        if (lengthStr.match(/[0-9]{7,}/i))
        {
            score += 10;
            logMessage = logMessage + "...rule 18, score 10, total " + score + "\n";
        }

        // Rule #19
        if (contentType.match(/image\/(jpeg|gif|png)/i))
        {
            score += -20;
            logMessage = logMessage + "...rule 19, score -20, total " + score + "\n";
        }

        // Rule #20
        if (contentType.match(/text\/(html|xml|css)/i))
        {
            score += -20;
            logMessage = logMessage + "...rule 20, score -20, total " + score + "\n";
        }

        // Rule #21
        if (contentType.match(/application\/(x-)?javascript/i))
        {
            score += -15;
            logMessage = logMessage + "...rule 21, score -15, total " + score + "\n";
        }

        // Rule #22
        if (contentType.match(/application\/(x-)?shockwave-flash/i))
        {
            score += -5;
            logMessage = logMessage + "...rule 22, score -5, total " + score + "\n";
        }

        // Rule #23
        if (contentType.match(/(application|video)\/(x-)?(flv|mp4|m4v|vnd\.objectvideo|f4v|webm|ms-wmv|ogg|msvideo)/i))
        {
            score += 60;
            logMessage = logMessage + "...rule 23, score 60, total " + score + "\n";
        }

        // Rule #24
        if (contentType.match(/application\/ogg/))
        {
            score += 60;
            logMessage = logMessage + "...rule 24, score 60, total " + score + "\n";
        }

        // Rule #25
        if (contentType.match(/flv\-application\/octet\-stream/i))
        {
            score += 74;
            logMessage = logMessage + "...rule 25, score 74, total " + score + "\n";
        }

        // Rule #26
        if (contentType.match(/text\/plain/i))
        {
            score += 10;
            logMessage = logMessage + "...rule 26, score 10, total " + score + "\n";
        }

        // Rule #27
        if (contentType.match(/application\/(octet-stream|download)/i))
        {
            score += 50;
            logMessage = logMessage + "...rule 27, score 50, total " + score + "\n";
        }

        // Rule #28
        if (contentType.match(/audio\/(x-)?(mpeg|mpg)/i))
        {
            score += 60;
            logMessage = logMessage + "...rule 28, score 60, total " + score + "\n";
        }

        // Rule #29
        if (encoding.match(/binary/i))
        {
            score += 5;
            logMessage = logMessage + "...rule 29, score 5, total " + score + "\n";
        }

        // Rule #30
        if (url.match(/(videos?|movies?)\/.*\.swf/i))
        {
            score += 15;
            logMessage = logMessage + "...rule 30, score 15, total " + score + "\n";
        }

        // Rule #31
        if (host.match(/101\.ru$/i))
        {
            score += 2;
            logMessage = logMessage + "...rule 31, score 2, total " + score + "\n";
        }

        // Rule #32
        if ((host.match(/\.dmcdn\.net$/i) && path.match(/^\/mc\//i)) || host.match(/ad\.auditude\.com/))
        {
            score -= 80;
            logMessage = logMessage + "...rule 32, score -80, total " + score + "\n";
        }

        // Rule #33
        if (host.match(/s3\.amazonaws\.com/) && referrer.match(/s3\.amazonaws\.com/) || host.match(/ds\.serving-sys\.com/))
        {
            score -= 200;
            logMessage = logMessage + "...rule 33, score -200, total " + score + "\n";
        }
        
        // Rule #34
        // http://streaming3.ur.se/urplay/_definst_/mp4:193000-193999/193063-8.mp4/media_1.ts?wowzasessionid=1428451558&pid=9c7j1y&cid=urplay
        if (contentType.toLowerCase() == "video/mp2t" && host.match(/streaming3\.ur\.se/i) && referrer.match(/urplay\.se/i))
        {
            score -= 50;
            logMessage = logMessage + "...rule 34, score -50, total " + score + "\n";
        }

        // Rule #35
        // Vimeo.com video segments, reffered from vimeo, with name "segment-N.m4s"
        if (url.match(/segment\-\d+\.m4s/i) && referrer.match(/vimeo\.com/i))
        {
            score -= 80;
            logMessage = logMessage + "...rule 35, score -80, total " + score + "\n";
        }

        // Rule #36
        // Video segments of webtv.ert.gr (which uses Adobe F4M unimplemented yet)
        if (url.match(/Seg\d+\-Frag\d+\?als=/i))
        {
            score -= 80;
            logMessage = logMessage + "...rule 36, score -80, total " + score + "\n";
        }

        this.debugLogScoring(logMessage, score);

        return score > this.masterScore;
    },

    seekToBegin: function (request)
    {
        var self = AntVideoDetector;

        var URI = request.URI;
        var url = URI.spec;
        var valObj = { regrab: false, url: url, unkownSize: false };
        
        var _replaceFunc = function (substr, delimiter, key, value, offset, s)
        {
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

            if ((_key == "st") && value.match(/[a-z]/ig))
            {
                /** probably not a position argument */
                return substr;
            }

            if (delimiter == '?')
            {
                //url.com/file.flv?begin=1&bla=1            -->     url.com/file.flv?&bla=1
                if (offset + substr.length < s.length)
                    return '?';
            }
            
            return '';
        };

        // youtube|break|xhamster|xvideos|spankwire|keezmovies|youjizz.com
        // Can be start=undefined
        url = url.replace(/(\?|&)(begin|range|offset|ts|ec_seek|start|st|fs)=([^&]*)/ig, _replaceFunc).replace(/\?$/, '').replace(/\?&/, '?');

        valObj.url = url;

        return valObj;

        // Not fixed double detection:
        // These sites are not so popular or have some issues to remove duplication.
        //  http://current.com/items/77430911_1000-bikini-models.htm
        //  http://v.youku.com/v_show/id_XMTI3MjIzNTYw.html
    },

    isValidVideo: function (request, doc)
    {
        var self = AntVideoDetector;

        if (self.isVideo(request))
        {
            var valObj = self.seekToBegin(request);
            return valObj;
        }

        return false;
    }
};
