/**
 * default.js, 2013
 * @author Igor Chornous ichornous@heliostech.hk
 */

/**
 * @namespace antvd
 */
var antvd = (function(antvd) {

const Ci = Components.interfaces;
const Cc = Components.classes;

// {{{ ISearchStrategy interface
/**
 * @interface ISearchStrategy
 */
antvd.ISearchStrategy = function()
{
    /**
     * @member isApplicable
     * @param {Document} document
     * @param {nsIHttpChannel} channel
     * @returns {Boolean}
     */
    this.isApplicable = function(document, channel) { };

    /**
     * @member search
     * @param {Document} document Owning document
     * @param {nsIHttpChannel} channel Request's channel to analyze
     * @param {Function} found The function 'found' is to be called in case if video
     *                         content is found. It may be invoked multiple times.
     *                         The single argument is `videoRequest:IVideoRequest
     * @returns {undefined} nothing
     */
    this.search = function(document, channel, found) { };
};
// }}}

// {{{ DefaultSearchStrategy
/**
 * @class DefaultSearchStrategy
 * @implements ISearchStrategy
 */
antvd.DefaultSearchStrategy = function()
{
    /**
     * ISearchStrategy implementation
     */
    // {{{ isApplicable method
    /**
     * @member isApplicable
     * @param {Document} document
     * @param {nsIHttpChannel} channel
     * @returns {Boolean}
     */
    this.isApplicable = function(document, channel)
    {
        return true;
    };
    // }}}

    // {{{ search method
    /**
     * Performes a scoring procedure to test if a channel is referencing video content
     *
     * @member search
     * @param {Document} document Owning document
     * @param {nsIHttpChannel} channel Request's channel to analyze
     * @param {Function} found The function 'found' is to be called in case if video
     *                         content is found. It may be invoked multiple times.
     *                         The single argument is `flvLink:AntFlvLink
     * @returns {undefined} nothing
     */
    this.search = function(document, channel, found)
    {
        if (!document || !channel || !found)
        {
            // TODO(Igor): Notify error
            return;
        }

        if (!AntVideoDetector.isVideo(channel))
            return;

        var videoRequestInfo = createVideoRequest(document, channel);
        found(videoRequestInfo);
    };
    // }}}

    // {{{ createVideoRequest private method

    /**
     * @private
     * @member createVideoRequest
     * @param {Document} document
     * @param {nsIHttpChannel} channel
     * @returns {AntFlvLink}
     */
    var createVideoRequest = function(document, channel)
    {
        var uri = getNeatUrl(channel);

        // var params = {
        //     uri: uri,
        //     document: document,
        //     contentType: channel.contentType,
        //     contentLength: channel.contentLength,
        //     method: channel.requestMethod,
        //     payload: AntLib.getUploadStream(channel)
        // };

        var mediaRequest = new antvd.DefaultMediaRequest();
        mediaRequest.init(uri, document, channel.contentLength, channel.contentType);
        return mediaRequest;
    };

    // }}}

    // {{{ getNeatUrl private method

    /**
     * Some video requests point at a certain offset of a video.
     * This method attempts to reconstruct the url in such a way that
     * it will reference beginning of the video
     *
     * @private
     * @member getNeatUri
     * @param {nsIChannel} channel
     * @returns {nsIURI} url
     */
    var getNeatUrl = function(channel)
    {
        var videoObject = AntVideoDetector.seekToBegin(channel);
        return AntLib.toURI(videoObject.url);
    };

    // }}}
};
// }}}

return antvd;
})(antvd);
