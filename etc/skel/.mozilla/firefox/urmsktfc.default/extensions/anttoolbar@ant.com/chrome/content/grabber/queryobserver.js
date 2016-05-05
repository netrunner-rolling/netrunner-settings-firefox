/**
 * queryobserver.js, 2008
 * @author Zak
 * @contributor Igor Chornous ichornous@heliostech.hk
 */

/**
 * @namespace antvd
 */
var antvd = (function(antvd) {
    if (!antvd.AntLib)
        antvd.AntLib = AntLib;

    /**
     * @class AntQueryObserver
     */
    function AntQueryObserver()
    {
        const Ci = Components.interfaces;
        const Cc = Components.classes;

        /**
         * DefaultSearchStrategy must remain the last one in the list
         *
         * @name searchStrategy
         * @type Array<ISearchStrategy>
         */
        var searchStrategies = [
            new antvd.YtSearchStrategy(),
            new antvd.DmSearchStrategy(),
            new antvd.VimeoSearchStrategy(),
            new antvd.DefaultSearchStrategy()
        ];

        /**
         * The function called by firefox, entry point of this class
         * @param request       The object containing the request params
         * @param topic         The specific event that trigger the function
         * @param data          the request data (seems to be empty)
         */
        this.observe = function(aRequest, topic, data)
        {
            if (topic.substring(0, 16) != "http-on-examine-")
            {
                return;
            }

            if ( ! gBrowser.getBrowserForDocument )
            {
                return;
            }

            var httpChannel = aRequest.QueryInterface(Ci.nsIHttpChannel);
            
            if ((httpChannel.responseStatus < 200) || (httpChannel.responseStatus > 299))
            {
                return;
            }

            var document = antvd.AntLib.getDocumentByRequest(httpChannel);
            
            if ( ! document )
            {
                return;
            }

            // Ensure that the request has an associated browser
            // In some cases firefox may prefetch the page
            if ( ! gBrowser.getBrowserForDocument(document) )
            {
                return;
            }

            var strategy = getSearchStrategy(document, httpChannel);
            
            if ( ! strategy )
            {
                return;
            }

            try
            {
                var foundFunc = function(request, erase)
                {
                    AntGrabber.foundFlvLink(document, request, erase);
                };
                
                strategy.search(document, httpChannel, foundFunc);
            }
            catch (e)
            {
                antvd.AntLib.logError("AntQueryObserver.observe (queryobserver.js)", "Unexpected program failure", e);
            }
        };

        /**
         * Looks up for an appropriate detecting strategy
         *
         * @private
         * @member getSearchStrategy
         * @param {Document} document Owning document
         * @param {nsIHttpChannel} channel
         * @returns {ISearchStrategy}
         */
        var getSearchStrategy = function(document, channel)
        {
            for each (var strategy in searchStrategies)
            {
                if (strategy.isApplicable(document, channel))
                {
                    return strategy;
                }
            }

            return null;
        };
    };

    antvd.AntQueryObserver = AntQueryObserver;
    
    return antvd;

})(antvd);
