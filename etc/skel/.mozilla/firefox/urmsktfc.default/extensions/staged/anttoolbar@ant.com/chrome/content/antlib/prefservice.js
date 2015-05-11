function AntPrefService (branch) {
    // body 
    this.init(branch);
}

AntPrefService.prototype  = {
    // body
    init: function(branch){
      //body
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
                    .getService(Components.interfaces.nsIPrefBranch); 
        this.prefs = this.prefs.getBranch(branch+".")
    }, 
    get: function(key, type){
      var result = '';
      try {
          if (!type) { type = "char" };
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
      } catch (e) {
          AntLib.toLog("AntPrefService get ERROR: "+e);
          result = false; 
      }
      return result;          
    }, 
    set: function(key, value, type){
      //
      if (!type) { type = "char" };
      var result;
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
      return result;
    }, 
};
