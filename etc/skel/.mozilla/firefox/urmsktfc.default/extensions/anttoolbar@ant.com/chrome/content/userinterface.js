//
//  userinterface.js
//  firefox
//
//  Created by Zak on 2008-06-16.
//  Contributor Brian King
//  Copyright 2008-2012 Ant.com. All rights reserved.
//

var AntFlvUi =
{
    listShown: false,
    doc: null,
    listBox: null,
    listMenu: null,
    downloadButton: [],
    downloadList: [],

    /**
     * Initialize the class with necessary pointers
     * @param doc           The browser interface
     */
    init: function (doc)
    {
        var self = AntFlvUi;
        self.doc = doc;

        self.downloadButton.push(AntLib.ob('antToolBarDownloadButton'));
        self.downloadButton.push(AntLib.ob('ant-video-statusbar-dl-button'));
        for each(var button in self.downloadButton) {
            button.setAttribute("oncommand", "AntFlvUi.videoNotDetected();");
        }

        self.downloadList.push(AntLib.ob('ant-video-toolbar-dllist', doc));
        self.downloadList.push(AntLib.ob('ant-video-statusbar-dllist', doc));
        // Compact toolbar item may be hidden (Customized...)
        try {
            self.downloadList.push(AntLib.ob('ant-ctoolbar-menu', doc));
        }
        catch(e) {}
        
        AntWatchUrl.addWatcher( self.onChangedUrl );
        
    },

    /**
     * Add a button to a toolbar
     * @param toolbarId           The id of the toolbar to add to
     * @param id                  The id of the button to add
     * @param afterId (optional)  The id of the button to insert the new button after
     */
    installButton: function (toolbarId, id, afterId) {
        if (!document.getElementById(id)) {
            var toolbar = document.getElementById(toolbarId);

            // If no afterId is given, then append the item to the toolbar
            var before = null;
            if (afterId) {
                let elem = document.getElementById(afterId);
                if (elem && elem.parentNode == toolbar) 
                    before = elem.nextElementSibling;
            }

            toolbar.insertItem(id, before);
            toolbar.setAttribute("currentset", toolbar.currentSet);
            document.persist(toolbar.id, "currentset");

            if (toolbarId == "addon-bar")
                toolbar.collapsed = false;
        }
    },

    /*
     * onChangedUrl: function called when the location change
     * in the browser
     * @param aURI : the new url location
     */
    onChangedUrl: function (aURI, doc)
    {
        var self = AntFlvUi;
        AntTabMan.getAntData(doc).releaseVideos();
        self.updateDownloadButton(doc);
    },

    /**
     * True if the list is shown, false if not
     */
    isShown: function ()
    {
        var self = AntFlvUi;
        return self.listShown;
    },

    /**
     * Remove all listItems from the ListBox
     */
    removeAll: function ()
    {
        var self = AntFlvUi;
        while (self.listBox.childNodes.length > 2)
            self.listBox.removeChild(self.listBox.childNodes[2]);
    },

    /**
     * Find a node using his URL
     * @param url           The URL to match
     * @return item         a XulNode corresponding to a XUL:ListItem
     */
    getItemByUrl: function (url)
    {
        var self = AntFlvUi;
        for (var i = 0; i < self.listBox.childNodes.length; i++)
        {
            var item = self.listBox.childNodes[i];

            if (url == item.childNodes[1].getAttribute("label"))
                return item;
        }
        return null;
    },

    feedbackClickCallback: function(addonList) {
        
        var self = AntFlvUi;
        var userid = AntRank.UUID;
        var url = gBrowser.selectedBrowser.contentWindow.location.href;
        var addons = AntLib.getExtListString(addonList);
        
        self.getNFPanel().hidePopup();
        var supportTab = 
            gBrowser.addTab(
                'http://support.ant.com/?url='+AntLib.uriEncode(url)+"&userid="+AntLib.uriEncode(userid)+"&addons="+AntLib.uriEncode(addons)
                            );
        
        gBrowser.selectedTab = supportTab;
    },
    feedbackClick: function ()
    {
        var self = AntFlvUi;
        
        if ( AntLib.getFirefoxVersion() < 4 ) {

            self.feedbackClickCallback();
        }
        else {
            Components.utils.import("resource://gre/modules/AddonManager.jsm");
            AddonManager.getAllAddons( self.feedbackClickCallback );
        }
    },
    /**
     * Disable or enable the Download button according to the content of the page
     * (if we find our tainted flvLink item in the page or not)
     */
    updateDownloadButton: function (doc)
    {
        var self = AntFlvUi;

        if (!gBrowser.contentDocument)
        {
            return false;
        }
        else if (!doc || (doc != gBrowser.contentDocument))
        {
            doc = gBrowser.contentDocument;
        }

        var ctoolbarBtn = document.getElementById('ant-ctoolbar-dropdown');
        var data = AntTabMan.getAntData(doc);

        if (data.videos.length) {
            data.notFound = false;
            self.downloadButtonAttrMagic(!data.downloadClicked);

            // Compact toolbar item may be hidden (Customized...)
            if (ctoolbarBtn) {
                ctoolbarBtn.setAttribute(
                    'oncommand'
                    , 'AntBar.onDownloadButtonClick();');
            }

            var btnClass = data.downloadClicked
                    ? 'ant-download-class-downloaded'
                    : 'ant-download-class-detected';
            if ( data.videos.length == 1 ) {
                for each(var button in self.downloadButton) {
                    button.setAttribute('type', '');
                    button.setAttribute(
                        "oncommand", "AntBar.onDownloadButtonClick();");
                    button.setAttribute(
                        'class', self.getDlButtonCSSClass(btnClass, button));
                    button.setAttribute(
                        'label', antvd.AntLang.getString('AntBar.DownloadButtonLabel'));
                }
            } else {
                for each(var button in self.downloadButton) {
                    button.setAttribute('type', 'menu');
                    button.setAttribute("oncommand", "");
                    button.setAttribute(
                        'class', self.getDlButtonCSSClass(btnClass, button));
                    button.setAttribute(
                        'label', antvd.AntLang.getString('AntBar.DownloadButtonLabel'));
                }
            }
            // Regardless of number of videos...
            self.updateMenuDownload(doc);
        } else {
            self.downloadButtonAttrMagic();
            // Compact toolbar item may be hidden (Customized...)
            if (ctoolbarBtn) {
                ctoolbarBtn.setAttribute(
                    'oncommand', 'AntFlvUi.videoNotDetected();');
            }
            
            for each(var button in self.downloadButton) {
                
                button.setAttribute('type', '');
                button.setAttribute("oncommand", "AntFlvUi.videoNotDetected();");
                
                if ( data.notFound ) {
                    button.setAttribute(
                        'class'
                        , self.getDlButtonCSSClass(
                            'ant-video-not-detected'
                            , button));
                    button.setAttribute(
                        'label', antvd.AntLang.getString("AntBar.DownloadButtonNotFound"));
                } else {
                    button.setAttribute(
                        'class'
                        , self.getDlButtonCSSClass(
                            'ant-download-class-not-detected'
                            , button));
                    button.setAttribute(
                        'label', antvd.AntLang.getString('AntBar.DownloadButtonLabel'));
                }
            }
            self.cleanMenuDownload();
        }
        return true;
    },

    isStatusBar: function() {
        return (AntPrefs.displayMode == 'statusbar'
                || AntPrefs.displayMode == 'addonsbar');
    },

    getDlButtonCSSClass: function(extraClass, btn){
        
        var self = AntFlvUi;
        var cssClass = '';
        
        switch ( btn.id ) {
            
            case 'ant-video-statusbar-dl-button':
                cssClass = 'ant-statusbar-button-class';
                break;
            
            case 'ant-ctoolbar-dropdown':
                cssClass = 'chromeclass-toolbar-additional toolbarbutton-1';
                break;
        }
        
        cssClass += ' ' + extraClass;
        return cssClass;

    },
    downloadButtonAttrMagic: function(add) {
        
        var self = AntFlvUi;
        var compact = self.doc.getElementById('ant-ctoolbar-dropdown');
        
        if (compact) {
            if ( add )
                compact.setAttribute('detected', null);
            else
                compact.removeAttribute('detected');
        }
    },

    getDownloadButton: function() {
        
        var self = AntFlvUi;
        var btnId = '';
        switch ( AntPrefs.displayMode ) {
            case 'toolbar':
                btnId = 'antToolBarDownloadButton';
                break;
            
            case 'statusbar':
            case 'addonsbar':
                btnId = 'ant-video-statusbar-dl-button';
                break;
            
            case 'ctoolbar':
                btnId = 'ant-ctoolbar-dropdown';
        }

        // Compact toolbar item may be hidden (Customized...)
        var btnIdEl = document.getElementById(btnId);
        return btnIdEl ? btnIdEl : null;
    },
    getNFPanel: function(autoclose) {
        
        var doc = gBrowser.contentDocument;
        
        if ( doc.getElementById('IETab')
          || doc.getElementById('IETab2') ) {
            
            return document.getElementById( 'ant-ie-tab-mode-panel' );
        }
        
        return document.getElementById( "ant-notfound-video-panel" );
    },
    videoNotDetected: function(){
      
        var self = AntFlvUi;
        var btns = self.downloadButton;
        
        for each(var button in btns)
        {
            button.setAttribute('type', '');
            button.setAttribute('oncommand', 'AntFlvUi.videoNotDetected();');
            button.setAttribute('class', self.getDlButtonCSSClass('ant-video-not-detected', button));
            button.setAttribute('label', antvd.AntLang.getString("AntBar.DownloadButtonNotFound"));
        }
        
        AntTabMan.getAntData( gBrowser.contentDocument ).notFound = true;
          
        if (AntPrefs.showNotFoundWindow())
        {
            var dlBtn = self.getDownloadButton();
            if (dlBtn) {
                var pos = self.isStatusBar() ? 'before_start' : 'after_start';
                self.getNFPanel().openPopup( dlBtn, pos, 0, 0, false, false );
            }
        }
    },

    /*
     * Update the list of videos found
     */

    cleanMenuDownload: function ()
    {
        var self = AntFlvUi;
        for (var i in self.downloadList)
        {
            var menuPopup = self.downloadList[i];
            
            if (!menuPopup)
                continue;

            while (menuPopup.firstChild
                   && (menuPopup.firstChild.id != 'ant-ctoolbar-player'))
            {
                menuPopup.removeChild(menuPopup.firstChild);
            }
        }
    },

    /**
     * Formats the ContentLength value to be displayed to user
     *
     * @member formatDisplaySizeCell
     * @param {Number} sizeInBytes
     * @returns {String} User friendly formatted string
     */
    formatDisplaySizeCell: function(sizeInBytes)
    {
        if (!sizeInBytes || (sizeInBytes < 0))
            return "";
        var a = AntLib.convertByteUnits(sizeInBytes);
        return a[0] + " " + a[1];
    },

    /**
     * @member createMenuItem
     * @param {MediaRequest} videoRequest
     */
    createMenuItem: function(videoRequest, index, menuNum) {
        var self = AntFlvUi;

        const MAX_ITEM_LENGTH = 40;
        var label = AntLib.truncate(videoRequest.displayName, MAX_ITEM_LENGTH);

        var id = menuNum.toString() + index.toString();
        
        var menuItem       = self.doc.createElement('menuitem');
        var menuCellIcon   = self.doc.createElement('listcell');
        var menuCellSize   = self.doc.createElement('listcell');
        //var menuCellOrigin = self.doc.createElement('listcell');
        var menuCellUrl    = self.doc.createElement('listcell');
        var menuCellName   = self.doc.createElement('listcell');
        
        menuCellIcon.setAttribute('class', 'listcell-iconic ant-download-class');
        
        var displayContentLength =
                self.formatDisplaySizeCell(videoRequest.size);

        menuCellSize.setAttribute('id', 'ant-video-tb-size-'+id);
        menuCellSize.setAttribute('label', displayContentLength);
        
        //menuCellOrigin.setAttribute('id', 'ant-video-tb-origin-'+id);
        //menuCellOrigin.setAttribute('label', flvlink.origin);
        
        menuCellUrl.setAttribute('id', 'ant-video-tb-url-'+id);
        menuCellUrl.setAttribute('hidden', true);
        
        menuCellName.setAttribute('id', 'ant-video-tb-name-'+id);
        menuCellName.setAttribute('label', label);
        
        menuItem.appendChild(menuCellIcon);
        menuItem.appendChild(menuCellSize);
        //menuItem.appendChild(menuCellOrigin);
        menuItem.appendChild(menuCellUrl);
        menuItem.appendChild(menuCellName);
        
        menuItem.setAttribute('id', 'ant-video-tb-'+id);
        menuItem.setAttribute('label', label);
        menuItem.setAttribute('tooltiptext', label);
        menuItem.setAttribute('oncommand', 'AntBar.onDownloadListClick(' + index + '); event.stopPropagation();');
        
        return menuItem;
    },
    updateMenuDownload: function (doc)
    {
        var self = AntFlvUi;
        self.cleanMenuDownload();
        
        if (doc == null) {
          var curBrowser = AntLib.getMainWindow().getBrowser();
          doc = curBrowser.selectedBrowser.contentDocument;
        }
        
        var listflv = AntTabMan.getAntData(doc).videos;
        
        for (var i in self.downloadList)
        {
            var menuPopup = self.downloadList[i];
            //self.downloadList.push(AntLib.ob('ant-ctoolbar-menu', doc));

            if (menuPopup) {
                for (var j in listflv)
                {
                    var menuitem = self.createMenuItem(listflv[j], j, i);
                    menuPopup.insertBefore( menuitem, menuPopup.firstChild );
                }
            }
        }
    },
    /*
     * removes animation when download button pressed
     */
    downloadButtonPressed: function() {
        
        var self = AntFlvUi;
        
        for each(var button in self.downloadButton) {
            button.setAttribute(
                'class'
                , self.getDlButtonCSSClass(
                    'ant-download-class-downloaded'
                    , button));
        }
        
        self.downloadButtonAttrMagic();
        AntTabMan.getAntData( gBrowser.contentDocument ).downloadClicked = true;
    }
};
