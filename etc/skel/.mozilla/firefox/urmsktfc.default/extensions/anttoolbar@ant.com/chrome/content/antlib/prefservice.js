function AntPrefService(branch)
{
    // body
    this.init(branch);    
}

AntPrefService.prototype =
{
    // body
    init: function (branch)
    {
        //body
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        this.prefs = this.prefs.getBranch(branch + ".");
    },

    get: function (key, type)
    {
        var result = '';

        if ( ! type )
        {
            type = "char"
        };

        try
        {
            switch (type)
            {
                case "bool":
                    result = this.prefs.getBoolPref(key);
                    break;
            
                case "int":
                    result = this.prefs.getIntPref(key);
                    break;
                    //TODO: make an getComplexPref method processing
            
                case "complex":
                    //e.g.: for accepted_languages(investigate is this intergface
                    //can being used only)
                    //let lang = prefs.getComplexValue("accept_languages",
                    //Components.interfaces.nsIPrefLocalizedString).data;
            
                case "char":
                default:
                    result = this.prefs.getCharPref(key);
            }
        }
        catch (e)
        {
            AntLib.logWarning("AntPrefService.get (prefservice.js)", "get() failed", e);
            result = false;
        }
        
        return result;
    },

    set: function (key, value, type)
    {
        var result;

        if ( ! type )
        {
            type = "char"
        };

        try
        {
            switch (type)
            {
                case "bool":
                    result = this.prefs.setBoolPref(key, value);
                    break;
            
                case "int":
                    result = this.prefs.setIntPref(key, value);
                    break;
            
                case "char":
                default:
                    result = this.prefs.setCharPref(key, value);
            }
        }
        catch(e)
        {
            AntLib.logWarning("AntPrefService.set (prefservice.js)", "set() failed", e);
        }
        
        return result;
    },
};
