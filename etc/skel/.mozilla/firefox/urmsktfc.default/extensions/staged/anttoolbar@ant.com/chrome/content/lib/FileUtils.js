/**
 * FileUtils.js, 2013
 * @author ICh
 */

/**
 * @namespace antvd
 */
var antvd = (function(antvd)
{
    if (!antvd.AntLib)
    {
        antvd.AntLib = AntLib;
    }

    const Ci = Components.interfaces;
    const Cc = Components.classes;

    Components.utils.import("resource://gre/modules/Promise.jsm");
    Components.utils.import("resource://gre/modules/NetUtil.jsm");
    Components.utils.import("resource://gre/modules/Task.jsm");

    /**
     * @ignore
     * @type Number
     */
    const PR_UINT32_MAX = 0xffffffff;

    /**
     * @public
     */
    var FileUtils =
    {
        /**
         * @member getFileHash
         * @param {nsIFile} file File to calculate hash for
         * @returns {Promise<String>}
         */
        getFileHash: function(file)
        {
            if (!file)
            {
                return Promise.reject(new Error("'file' is a mandatory argument"));
            }

            /** @type nsICryptoHash */
            let ch = null;
            
            try
            {
                ch = Cc["@mozilla.org/security/hash;1"].createInstance(Ci.nsICryptoHash);

                /** FIXME(ICh): Do we need to customize this? Not sure */
                ch.init(ch.MD5);
            }
            catch (ex)
            {
                antvd.AntLib.logError(
                    "antvd.FileUtils.getFileHash (FileUtils.js)",
                    "Failed to instantiate the crypto service",
                    ex
                );
                
                return Promise.reject(new Error("Failed to instantiate a submodule"));
            }

            let deferred = Promise.defer();

            NetUtil.asyncFetch(
                file,
                function(istream, result)
                {
                    try
                    {
                        if (!Components.isSuccessCode(result))
                        {
                            antvd.AntLib.toLog(
                                "antvd.FileUtils.getFileHash (FileUtils.js)",
                                antvd.AntLib.sprintf(
                                    "Failed to open an input stream from path %s, IO result %d",
                                    file.path, result
                                )
                            );
                            
                            deferred.reject(new Error("IO Failure"));
                            
                            return;
                        }
                        
                        ch.updateFromStream(istream, PR_UINT32_MAX);
                        
                        let hash = ch.finish(false);
                        
                        /** @type String */
                        let strHashArray = [];
                        
                        for (let i in hash)
                        {
                            strHashArray.push(toHex(hash.charCodeAt(i)));
                        }
                        
                        let strHash = strHashArray.join("");
                        
                        deferred.resolve(strHash);
                    }
                    catch (ex)
                    {
                        antvd.AntLib.logError(
                            "antvd.FileUtils.getFileHash (FileUtils.js)",
                            "Unexpected exception occured",
                            ex
                        );
                        
                        deferred.reject(new Error("Unexpected error"));
                    }
                });

            return deferred.promise;
        }
    };

    /**
     * Convert numerical codes to a hex string.
     * Copied this method from mdn
     *
     * @private
     * @member toHex
     * @param {Number} charCode
     * @returns {String}
     */
    function toHex(charCode)
    {
        return ("0" + charCode.toString(16)).slice(-2);
    }

    antvd.FileUtils = FileUtils;
    return antvd;

})(antvd);
