//
//  grabber.js
//  firefox
//
//  Created by Zak on 2008-07-14.
//  Contributor Brian King
//  Contributor Chornous Igor
//  Copyright 2008-2012 Ant.com. All rights reserved.
//

var AntGrabber =  {

    requestObserver : {
        observe : function (request, topic, data)
        {
            try {

                if ( typeof(Components) == 'undefined' )
                    return;

                request = request.QueryInterface(
                    Components.interfaces["nsIHttpChannel"]);

                if ( request.URI.host.match( /(\.|^)ant.com/ ) ) {
                    request.setRequestHeader( 'X-Ant-UID', AntRank.UUID, false );
                    request.setRequestHeader( 'X-Ant-Agent', AntBar.getAgent(), false );
                }
            }
            catch (e) {
                AntLib.toLog("EXCEPTION : "+e);
            }
        }
    },
    queryObserver: null,

    /**
     * This method starts observing firefox requests and set a onload event
     * to be able to parse the current page and detect flvs
     */
    init: function ()
    {
        var self = AntGrabber;
        self.queryObserver = new antvd.AntQueryObserver();
        self.start();
    },

    /**
     * Start the grabber
     */
    start: function ()
    {
        var self = AntGrabber;
        var observerService = AntLib.CCSV(
            "@mozilla.org/observer-service;1", "nsIObserverService");

        observerService.addObserver(
            self.requestObserver, "http-on-modify-request", false);
        observerService.addObserver(
            self.queryObserver, "http-on-examine-response", false);
        observerService.addObserver(
            self.queryObserver, "http-on-examine-cached-response", false);
        observerService.addObserver(
            self.queryObserver, "http-on-examine-merged-response", false);
    },

    /**
     * Called when a new flv is found
     * @param {IVideoRequest} videoRequest
     * @param {Boolean} eraseList If set, the video list associated with the document
     *                            will be erased prior to inserting new items
     *                            This is a handy flag for the cases when a site
     *                            uses html5's history.pushState to fetch new data
     */
    foundFlvLink: function (origin, videoRequest, eraseList)
    {
        try
        {
            var videos = AntTabMan.getAntData(origin).videos;
        
            if (eraseList)
            {
                AntTabMan.getAntData(origin).releaseVideos();
            }

            for each (var r in videos)
            {
                if (r.compare(videoRequest))
                {
                    return;
                }
            }
            
            videos.push(videoRequest);
            
            AntFlvUi.updateDownloadButton(origin);            
        }
        catch (ex)
        {
            AntLib.logError("[Grabber]: Unexpected exception", ex);
        }
    }
};
