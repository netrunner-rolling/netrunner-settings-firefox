// 
//  utilities.js
//  uninstall observer
//  
//  Created by Brian King on 2011-05-30.
//  Copyright 2011-2012 Ant.com. All rights reserved.
//

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const Cc = Components.classes;
const Ci = Components.interfaces;

const gEmGUID = "anttoolbar@ant.com";
var gUninstallObserverInited = false;
var gBeingUninstalled = false;

this.__defineGetter__(
  'Observers',
  function() {
    let obs = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
    delete this.Observers;
    return (this.Observers = obs);
  }
);

/* For debugging only */
function alert(msg)
{
  Cc["@mozilla.org/embedcomp/prompt-service;1"]
    .getService(Ci.nsIPromptService)
    .alert(null, "Ant alert", msg);
};

/* When the add-on is uninstalled, but before Firefox is shutdown
 * The user still has a chance to Undo
 * e.g. Show uninstall page
 */
function uninstallMaybe()
{
    try {
        
        var scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Ci.mozIJSSubScriptLoader);
        var uPage = 'http://www.ant.com/video-downloader/uninstalled/';
        
        var bWin = Cc["@mozilla.org/appshell/window-mediator;1"]
                   .getService(Ci.nsIWindowMediator)
                   .getMostRecentWindow("navigator:browser");
        let browser = bWin.gBrowser;
        browser.loadOneTab(uPage, {inBackground: false});
        
        //used inside prefs, not defined in XPCOM code
        navigator = browser.contentWindow.navigator;
        
        scriptLoader.loadSubScript('chrome://antbar/content/toolbar.js');
        scriptLoader.loadSubScript('chrome://antbar/content/antlib/lib.js');
        scriptLoader.loadSubScript('chrome://antbar/content/prefs/prefs.js');
        scriptLoader.loadSubScript('chrome://antbar/content/antlib/rank.js');
        scriptLoader.loadSubScript('chrome://antbar/content/lib/antrpc.js');
        antvd.AntRPC.install("uninstall");
    }
    catch (e) {
    }
}

/* When the add-on is uninstalled, and Firefox is shutting down
 * e.g. Remove prefs set by ant toolbar
 */
function uninstallShutdown() {
    
    try {
        var prefs = Cc["@mozilla.org/preferences-service;1"]
                .getService(Ci.nsIPrefBranch);
        prefs.deleteBranch("extensions.anttoolbar");
        prefs.deleteBranch("extensions.antrankservice");
    }
    catch(e) {
    }
    
    try {
        
        //-------------for FireFox 3.6---------------------------------------
        //in FF 3.6 this event fires before the window.unload event
        var wm = Cc['@mozilla.org/appshell/window-mediator;1']
                 .getService(Ci.nsIWindowMediator );
        
        var browserEnumerator = wm.getEnumerator( 'navigator:browser' );
        
        while ( browserEnumerator.hasMoreElements() ) {
            
            var browserWin = browserEnumerator.getNext();
            
            if (browserWin.AntStorage) {
                browserWin.AntStorage.deinit();
            }
        }
        //-------------------------------------------------------------------
        
        var scriptLoader = Cc["@mozilla.org/moz/jssubscript-loader;1"]
                           .getService(Ci.mozIJSSubScriptLoader);
        
        scriptLoader.loadSubScript('chrome://antbar/content/db/storage.js');        
        AntStorage.removeDB();
    }
    catch (e) {
    }
}

/*
 * Class definitions
 */

/* The anttoolbarUtilities class constructor. */
function anttoolbarUtilities() {
    
    this.wrappedJSObject = this;
    Observers.addObserver(this, "xpcom-shutdown", false);
}

/* the anttoolbarUtilities class def */
anttoolbarUtilities.prototype = {
    
    classDescription: "anttoolbarUtilities JS component",
    classID: Components.ID("{9187993A-C23C-442D-8FB9-55859D01D918}"),
    contractID: "@ant.com/utilities;1",
    wrappedJSObject : null,
    
    startUninstallObserver: function() {
        
        if (gUninstallObserverInited)
            return;
        
        try {
            
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
            
            var listener = {
                onUninstalling: function(addon) {
                    if (addon.id == gEmGUID) {
                        gBeingUninstalled = true;
                        uninstallMaybe();
                    }
                },
                onOperationCancelled: function(addon) {
                    if (addon.id == gEmGUID)
                        gBeingUninstalled = false;
                },
                onUninstalled: function(addon) {},
                onDisabling: function(addon) {},
                onDisabled: function(addon) {}
            };
            
            AddonManager.addAddonListener(listener);
            gUninstallObserverInited = true;
        }
        catch (e) {
            
            //going here when FF version < 4.0
            this.startUninstallObserverLegacyEM();
        }
    },
    
    startUninstallObserverLegacyEM: function() {
        
        var observerService = Cc["@mozilla.org/observer-service;1"]
                              .getService(Ci.nsIObserverService);
                              
        observerService.addObserver(this.addonsAction, "em-action-requested", false);
        observerService.addObserver(this.addonsAction, "quit-application-granted", false);
    },
    
    //for FF 3.6 only
    addonsAction: {
        _uninstall : false,
        observe: function(subject, topic, data) {
            
            if (topic == "em-action-requested") {
                
                subject.QueryInterface(Ci.nsIUpdateItem);
                if (subject.id == gEmGUID) {
                    
                    if (data == "item-uninstalled") {
                        
                        // This fires more than once, so add a check
                        if (this._uninstall == false)
                            uninstallMaybe();
                        this._uninstall = true;
                    }
                    else if (data == "item-cancel-action") {
                        this._uninstall = false;
                    }
                }
            }
            else if (topic == "quit-application-granted") {
                
                if (this._uninstall)
                    uninstallShutdown();
                this.unregister();
            }
        },
        
        unregister: function() {
            
            var observerService = Cc["@mozilla.org/observer-service;1"]
                                  .getService(Ci.nsIObserverService);
            observerService.removeObserver(this, "em-action-requested");
            observerService.removeObserver(this, "quit-application-granted");
        }
    },
    
    /* nsIObserver */
    observe: function (subject, topic, data) {
        
        switch (topic) {
            
            case "profile-after-change":
            Observers.addObserver(this, "profile-change-teardown", false);
            break;
            
            case "profile-change-teardown":
            Observers.removeObserver(this, "profile-change-teardown");
            if (gBeingUninstalled)
                uninstallShutdown();
            break;
            
            case "xpcom-shutdown":
            Observers.removeObserver(this, "xpcom-shutdown");
            break;
        }
    },
    
    QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports, Ci.nsIObserver])
};

let components = [anttoolbarUtilities];
const NSGetFactory = XPCOMUtils.generateNSGetFactory
          ? XPCOMUtils.generateNSGetFactory(components)
          : undefined;
const NSGetModule = !XPCOMUtils.generateNSGetFactory
          ? XPCOMUtils.generateNSGetModule(components)
          : undefined;
