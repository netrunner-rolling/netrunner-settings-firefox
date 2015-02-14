//
// bugreport.js
// Firefox
//
// Created by Seed on 2008-11-07
// Copyright 2008 Ant.com. All right reserved

var AntBugReport =
{
   logs: [],
   init: function ()
   {
     var cs = AntLib.CCSV("@mozilla.org/consoleservice;1", "nsIConsoleService");
     cs.registerListener(this);
     //closure pattern
     var that = this;
     AntWatchUrl.addWatcher(
      function(uri)
      {
        if (uri.spec.indexOf("http://contact.ant.com") == 0) {
          that.fillReport();
        }
      });
   },
   observe: function (aMsg)
   {
     if (aMsg.message.indexOf("[JavaScript Warning:") != 0)
     //ignoring warnings
       this.logs.push(aMsg.message);
   },
   clean: function ()
   {
     this.logs = [];
   },
   getAll: function ()
   {
     return this.logs.join('\n');
   },
  getAddonsList: function ()
  {
    var em = AntLib.CCSV("@mozilla.org/extensions/manager;1", "nsIExtensionManager");
    var list = em.getItemList(AntLib.CI("nsIUpdateItem")["TYPE_EXTENSION"] , {});
    var str = "";
  
    for each (var l in list)
    {
      str += l.id + ": " + l.objectSource + "\n";
    }
    return str;
  },
  fillReport: function ()
  {
    if (content && content.document)
    {
       var doc = content.document;
       if (doc.getElementById("errorlog"))
         doc.getElementById("errorlog").value = this.getAll();
       if (doc.getElementById("addons"))
         doc.getElementById("addons").value = this.getAddonsList();
    }

  }
  
};
