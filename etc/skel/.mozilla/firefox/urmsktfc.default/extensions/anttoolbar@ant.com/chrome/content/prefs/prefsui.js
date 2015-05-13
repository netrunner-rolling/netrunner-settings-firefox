// 
//  prefsui.js
//  firefox
//  
//  Created by Zak on 2008-06-26.
//  Contributor Brian King
//  Copyright 2008-2012 Ant.com. All rights reserved.
// 

var AntPrefsUi = {
    doc: null,

    /**
     * On options.xul Load
     * @param param1    Description
     */
    init: function (doc)
    {
        var self = AntPrefsUi;

        self.manageSearchToolsCheckBox(AntPrefs.displayMode != 'toolbar');
        self.manageBottombar();
    },

    manageSearchToolsCheckBox: function(disabled) {
        
        document.getElementById('antBarPrefsSearchCheckBox').disabled = disabled;
    },

    /**
     * In Firefox 4+ we have the add-ons bar, before that the statusbar
     * This hides the radio item to select one based in the version of Firefox
     */
    manageBottombar: function() {
        
        var isStatusbar = (AntLib.getFirefoxVersion() < 4);
        document.getElementById('ant-prefs-mode-statusbar').hidden = !isStatusbar;
        document.getElementById('ant-prefs-mode-addonsbar').hidden = isStatusbar;
    },

    onModeChanged: function(target) {
        
        var self = AntPrefsUi;
        var mode = target.value;

        //AntPrefs.displayMode = mode;
        self.manageSearchToolsCheckBox(mode != 'toolbar');
    }
}
