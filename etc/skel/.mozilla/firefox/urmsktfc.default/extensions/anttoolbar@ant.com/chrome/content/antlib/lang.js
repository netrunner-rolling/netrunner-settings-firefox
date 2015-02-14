/**
 * lang.js, 2008
 * @author Zak
 * @namespace antvd
 */
var antvd = (function(antvd) {
    if (!antvd.AntLib)
        antvd.AntLib = AntLib;

    /**
     * Handle localization of JS strings
     */
    var AntLang = {
	/**
	 * Get a pointer to the string bundle object
	 */
	get lang()
	{
	    return AntLib.ob("antbarStrings");
	},

	/**
	 * Return the string corresponding to the given symbol
	 * @param str       The symbol string to translate
	 */
	getString: function (str)
	{
	    return this.lang.getString(str);
	},

	/**
	 * Return the formated string corresponding to the given symbol
	 * @param fmt       The format string (printf style)
	 */
	getFormatString: function (fmt)
	{
            return this.lang.getFormattedString(
                fmt
                , Array.prototype.slice.call(arguments, 1));
	}
    };

    /** @expose */
    antvd.AntLang = AntLang;
    return antvd;
})(antvd);
