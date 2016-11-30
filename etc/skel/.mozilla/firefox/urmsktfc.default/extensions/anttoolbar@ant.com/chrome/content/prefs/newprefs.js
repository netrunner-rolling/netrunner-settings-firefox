// 
//  prefs.js
//  firefox
//  
//  Created by Zak on 2008-06-17.
//  Contributor BK
//  Copyright 2008-2016 Ant.com. All rights reserved.
// 
var AntPrefs =
{
    prefs: null,
    toolbar: null,

    /**
     * Preferences, first run and update addons
     */
    init: function ()
    {
        var self = AntPrefs;

        self.prefs = new AntPrefService('extensions.anttoolbar');

        var initCallback = function (aVersion)
        {
            var self = AntPrefs;

            if (self.getAntBranch().getBoolPref("firstrun"))
            {

                self.version = aVersion;
                self.firstRun();
            }
            else
            {

                var oldVersion = self.version;
                var compared = self.compareVersions(aVersion, oldVersion);
                if (compared > 0)
                {

                    self.version = aVersion;
                    self.prevAgent = AntBar.getAgent();
                    self.updated(oldVersion);
                }
            }
        };
        
        AntLib.getExtensionVersion(initCallback);

        self._forceCompactMode();
        
        if (self.isRankMode)
        {
            var dMode = (self.displayMode == 'addonsbar') ? "statusbar" : self.displayMode;

            if (dMode == 'ctoolbar')
            {
                // Compact toolbar item may be hidden (Customized...)
                var ctoolbarRankEl = document.getElementById('ant-ctoolbar-rank');
                
                if (ctoolbarRankEl)
                {
                    document.getElementById('ant-ctoolbar-rank').hidden = false;
                }
            }
            else
            {
                document.getElementById('ant-' + dMode + '-rank-img').hidden = false;
                document.getElementById('ant-' + dMode + '-rank-label').hidden = false;
            }
        }

        self.manageSearchBoxDisplay();
        // self.manageFlvDir();
        self.manageDisplayMode(false);
        self.prefWatcher.startup();
        self.flashTrusting();
    },

    _forceCompactMode: function ()
    {
        var self = AntPrefs;
        
        if ((self.displayMode != "ctoolbar") && (self.displayMode != "toolbar"))
        {
            self.displayMode = "ctoolbar";
            return true;
        }
        
        return false;
    },
    
    /**
     * Manage the toolbar or the statusbar mode
     * @param aForce force the widget to display, irrespective of pref settings
     */
    manageDisplayMode: function (aForce)
    {
        var self = AntPrefs;

        if (self._forceCompactMode())
        {
            return;
        }

        var enabled = {};
        var labels =
        {
            'cdropdown': 'ant-ctoolbar-dropdown',
            'crank': 'ant-ctoolbar-rank',
            'toolbar': 'antToolbar',
            'statusbar': 'ant-video-statusbarpanel'
        };

        /**
         * @type String
         * Values: ctoolbar, toolbar, addonsbar, statusbar
         */
        let displayMode = self.displayMode;
        var mode = (displayMode == 'addonsbar') ? 'statusbar' : displayMode;

        enabled[mode] = true;

        switch (mode)
        {
            case 'statusbar':
            case 'addonsbar':
                self.openAddonBar(aForce);
                break;
            
            case 'ctoolbar':
                var toolbarElement = document.getElementById(labels['toolbar']);
                if (toolbarElement != null)
                {
                    self.toolbar = toolbarElement;
                    AntLib.ob('navigator-toolbox').removeChild(self.toolbar);
                }
                
                // If the user switches back to compact mode, show it again even
                //   if tucked away in Customize...
                // A prefs change foreces this, startup init does not
                if (aForce)
                {
                    AntFlvUi.installButton("nav-bar", "ant-ctoolbar-dropdown");
                    AntFlvUi.installButton("nav-bar", "ant-ctoolbar-rank");
                }
                break;
            
            case 'toolbar':
                if (self.toolbar != null)
                {
                    var pt = document.getElementById("PersonalToolbar");
                    AntLib.ob('navigator-toolbox').insertBefore(self.toolbar, pt.nextSibling);
                    self.toolbar = null;
                }
                break;
            
            default:
                throw new Error('unknown mode: ' + mode);
        }

        for (var k in labels)
        {
            var el = document.getElementById(labels[k]);
            
            if (el)
            {
                // AntLib.toLog(el.id);
                // AntLib.toLog(k);
                
                if (k == "cdropdown" || k == "crank")
                    el.hidden = !enabled['ctoolbar'];
                else
                    el.hidden = !enabled[k];
            }
        }
    },
    /**
     * Firefox 4+, show the add-on bar once only
     * @param aForce force the add-ons bar open, irrespective of pref settings
     * Revisit this when https://bugzilla.mozilla.org/show_bug.cgi?id=616419 is fixed
     */
    openAddonBar: function (aForce)
    {
        var self = AntPrefs;

        if (aForce || (!self.addonbarOpened && (self.displayMode == 'statusbar' || self.displayMode == 'addonsbar')))
        {
            var addonBar = document.getElementById("addon-bar");

            if (addonBar)
            {
                setToolbarVisibility(addonBar, true)
            }

            // Now set pref so we never do this again
            AntPrefs.addonbarOpened = true;
        }
    },
    
    /**
     * Manage the display of the ant.com search box in toolbar mode
     */
    manageSearchBoxDisplay: function ()
    {
        var self = AntPrefs;

        if (self.displayMode == 'toolbar')
        {
            var hidden = !self.displaySearchBox;
            AntLib.ob('ant_search').hidden = hidden;
            document.getElementById('antToolBarResizeSplitter').hidden = hidden;
        }
    },

    /**
     * firstRun: is call the absolute first time the toolbar is displayed
     */
    firstRun: function ()
    {
        var self = AntPrefs;

        antvd.AntRPC.install("install");

        self.getAntBranch().setBoolPref("firstrun", false);
        self.displaySearchBox = false;

        AntFlvUi.installButton("nav-bar", "ant-ctoolbar-dropdown");
        AntFlvUi.installButton("nav-bar", "ant-ctoolbar-rank");

        var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);

        var evt =
        {
            observe: function ()
            {
                AntLib.openURL("http://www.ant.com/video-downloader/ff-installed", true);
            }
        };
        
        timer.init(evt, 1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
    },

    /**
     * updated: is called after the toolbar has been updated
     */
    updated: function (oldVersion)
    {
        var self = AntPrefs;
        antvd.AntRPC.install("upgrade");

        var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);

        var evt =
        {
            observe: function ()
            {
                AntLib.openURL("http://www.ant.com/video-downloader/ff-updated", true);
            }
        };
        
        timer.init(evt, 1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);

        try
        {
            self.removeJunkAgent();

            var versionChecker = AntLib.CCSV("@mozilla.org/xpcom/version-comparator;1", "nsIVersionComparator");

            if (versionChecker.compare(oldVersion, '2.3.0') <= 0)
            {
                AntStorage.recreateDB();
            }

            if (versionChecker.compare(oldVersion, '2.3.1b1') <= 0)
            {
                AntPrefs.playerMode = 'tab';
            }
        }
        catch (e)
        {
            AntLib.toLog("Error in AntPrefs.updated : " + e);
        }
    },

    /**
     * manageFlvDir: create it if doesn't exist, update the preference...
     */
    manageFlvDir: function ()
    {
        var self = AntPrefs;
        let isPathValid = false;
    
        if (self.flvDir)
        {
            /** @type nsIFile */
            let dir = null;
            
            try
            {
                dir = FileUtils.File(self.flvDir);
            
                if (!dir.exists() || !dir.isDirectory())
                {
                    AntLib.toLog("[PREFS]: Download directory referenced by flvDir" + " doesn't exist:" + "\nPath: " + self.flvDir);

                    dir.createUnique(AntLib.CI("nsIFile").DIRECTORY_TYPE, FileUtils.PERMS_DIRECTORY);
                }

                isPathValid = true;
            }
            catch (ex)
            {
                AntLib.logError("[PREFS]: The path stored in flvDir is invalid:" + "\nPath: " + self.flvDir, ex);
            }
        }

        try
        {
            if (!isPathValid)
            {
                self.flvDir = FileUtils.getDir("DfltDwnld", ["Ant Videos"], true).path;
            }
        }
        catch (ex)
        {
            AntLib.logError("[PREFS]: Failed to create a default download directory", ex);
        }
    },

    /**
     * Display a FilePicker to chose the Video directory
     */
    selectFlvDir: function ()
    {
        var self = AntPrefs;
        var nsIFilePicker = AntLib.CI("nsIFilePicker");
        var fp = AntLib.CCIN("@mozilla.org/filepicker;1", "nsIFilePicker");
        var path = AntLib.ob("AntPrefsFlvDir").value;
        var file;

        if (path)
        {
            try
            {
                AntLib.toLog("AntPrefs.selectFlvDir - current path is : " + path);
        
                try
                { // requires Gecko 14
                    file = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
                    file.initWithPath(path);
                }
                catch (e)
                {
                    file = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
                    file.initWithPath(path);
                }
                
                fp.displayDirectory = file;
            }
            catch (e)
            {
                AntLib.toLog("Failed to set displayDirectory:" + "\nError: " + e);
            }
        }

        fp.init(window, antvd.AntLang.getString("AntPrefs.selectFlvDirTxt"), AntLib.CI("nsIFilePicker").modeGetFolder);

        var res = fp.show();

        if (res == nsIFilePicker.returnOK)
        {
            path = fp.file.path;
            AntLib.ob("AntPrefsFlvDir").value = path;
            self.flvDir = path;
        }
    },

    /**
     * prefWatcher : observe Preferences and change UI if needed
     */
    prefWatcher:
    {
        prefs: null,

        startup: function ()
        {
            var self = AntPrefs.prefWatcher;
            self.prefs = AntPrefs.getAntBranch();
            self.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
            self.prefs.addObserver("", self, false);
        },

        shutdown: function ()
        {
            var self = AntPrefs.prefWatcher;
            self.prefs.removeObserver("", self);
        },

        observe: function (subject, topic, data)
        {
            try
            {
                var self = AntPrefs.prefWatcher;

                if (topic != "nsPref:changed")
                {
                    AntLib.toLog("not nsPref:changed  topic:" + topic);
                    return;
                }

                AntFlvUi.updateMenuDownload(null);
                AntPrefs.manageDisplayMode(true);

                if (AntPrefs.isRankMode)
                {
                    var url = gBrowser.contentDocument.URL;

                    if (!gBrowser.contentDocument.__antrank__ ||
                          AntLib.getDomain(url) !=
                          AntLib.getDomain(AntRank.url != null ? AntRank.url.spec : 'about:blank')
                        )
                    {
                        AntRank.setLabelRank(false);
                        AntRank.updateRank(url);
                    }
                }
                
                AntRank.updateVisible();

                AntPrefs.manageSearchBoxDisplay();
            }
            catch (e)
            {
                AntLib.toLog("prefWatcher.observe error: " + e + " trace: " + e.stack);
            }
        }
    },

    /**
     *  The old version of the toolbar (<= 2.0.1) added the "Ant Toolbar x.x"
     *  to the useragent string
     *  This function clean it up
     */
    removeJunkAgent: function ()
    {
        var branch = AntLib.CCSV("@mozilla.org/preferences-service;1", "nsIPrefService").getBranch("general.useragent.extra.");

        branch.deleteBranch("anttoolbar");
    },

    /**
     *  Return the domain from an url
     */
    getDomain: function (url)
    {
        url += "";
    
        if (!url)
        {
            return false;
        }

        var match = url.match(/^https?:\/\/(?:[\w]+\.)*([\w-]+\.[\w-]+)/);
        
        if (!match || match.length < 2)
        {
            return false;
        }
        
        return match[1];
    },
    
    /*
     * @returns user agent string
     */
    getUserAgent: function ()
    {
        return navigator.userAgent;
    },
    
    /*
     * @returns accept languages string
    */
    getAcceptLang: function ()
    {
        var prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);

        prefs = prefs.getBranch('intl.');

        return prefs.getComplexValue("accept_languages", Components.interfaces.nsIPrefLocalizedString).data;
    },
    
    /**
     * return the Ant pref branch
     */
    getAntBranch: function ()
    {
        return AntLib.CCSV("@mozilla.org/preferences-service;1", "nsIPrefService").getBranch("extensions.anttoolbar.");
    },

    showNotFoundWindow: function ()
    {
        var self = AntPrefs;
        return self.getAntBranch().getBoolPref('show_not_found_window');
    },

    toggleShowNotFoundWindow: function ()
    {
        var self = AntPrefs;
        self.getAntBranch().setBoolPref('show_not_found_window', !self.showNotFoundWindow());
    },

    /**
     * make Flash trust our flv player 
     */
    flashTrusting: function ()
    {
        var self = AntPrefs;
        var properties = AntLib.CCSV("@mozilla.org/file/directory_service;1", "nsIProperties");
        var os = AntLib.getOsName();

        switch (os)
        {
            case "Linux":
                var home = properties.get("Home", AntLib.CI("nsIFile"));

                if (!self.mkchdir(home, ".macromedia"))
                    return;
        
                if (!self.mkchdir(home, "Flash_Player"))
                    return;
        
                break;

            case "WINNT":
                var home = properties.get("AppData", AntLib.CI("nsIFile"));

                if (!self.mkchdir(home, "Macromedia"))
                    return;
                
                if (!self.mkchdir(home, "Flash Player"))
                    return;

                break;

            case "Darwin":
                var home = properties.get("UsrPrfs", AntLib.CI("nsIFile"));

                if (!self.mkchdir(home, "Macromedia"))
                    return;
                
                if (!self.mkchdir(home, "Flash Player"))
                    return;

                break;
            
            default:
                AntLib.toLog("os Not found in AntPrefs");
                return;
        }

        if (!self.mkchdir(home, "#Security"))
            return;

        self.mkchdir(home, "FlashPlayerTrust");
        home.append("antbar.cfg");
        
        if (!home.exists())
        {
            home.create(AntLib.CI("nsIFile").NORMAL_FILE_TYPE, 0777);
        }

        let systemURL = AntLib.chromeToPath('chrome://antbar/content/player/mediaplayer.swf');
        let data =
          "chrome://antbar/content/player/mediaplayer.swf\n" +
          "chrome://antbar/content/player/\n" +
          systemURL + "\n";

        var swfFile;
        
        try
        { // requires Gecko 14
            swfFile = AntLib.CCIN("@mozilla.org/file/local;1", "nsIFile");
            swfFile.initWithPath(systemURL);
        }
        catch (e)
        {
            swfFile = AntLib.CCIN("@mozilla.org/file/local;1", "nsILocalFile");
            swfFile.initWithPath(systemURL);
        }

        if (!swfFile.exists())
            AntLib.toLog('error: file ' + systemURL + ' should exist');

        var foStream = AntLib.CCIN("@mozilla.org/network/file-output-stream;1", "nsIFileOutputStream");
        foStream.init(home, 0x02 | 0x08 | 0x20, 0666, 0); // write, create, truncate
        foStream.write('\xEF\xBB\xBF', 3);//UTF-8 BOM

        var converter = AntLib.CCIN("@mozilla.org/intl/converter-output-stream;1", "nsIConverterOutputStream");
        converter.init(foStream, 'UTF-8', 0, 0);

        converter.writeString(data);
        converter.close();
        foStream.close();
    },

    /**
     * Create the directory if it does not exist  and change dir
     */
    mkchdir: function (dir, to)
    {
        dir.append(to);
    
        if (!dir.exists())
        {
            try
            {
                dir.create(AntLib.CI("nsIFile").DIRECTORY_TYPE, 0777);
            }
            catch (e)
            {
                AntLib.toLog("AntPrefs.mkchdir ERROR = " + e);
                return false;
            }
        }

        if (!dir.isDirectory())
        {
            return false;
        }
        
        return dir;
    },

    /**
     * Compares 2 version, say old and exisiting version of this add-on
     * @param versionA The first version
     * @param versionB The second version
     * @returns < 0 if A < B
     *          = 0 if A == B
     *          > 0 if A > B
     */
    compareVersions: function (versionA, versionB)
    {
        var versionChecker = AntLib.CCIN("@mozilla.org/xpcom/version-comparator;1", "nsIVersionComparator");

        var result = versionChecker.compare(versionA, versionB);

        return result;
    },

    /**
     * Geters/Seters for extension preferences
     */
    get isVideorepportsOn()
    {
        return new AntPrefService('extensions.anttoolbar').get('videorepports', 'bool');
    },
    
    get displayMode()
    {
        return AntPrefs.getAntBranch().getCharPref('mode');
    },

    set displayMode(value)
    {
        var self = AntPrefs;
        self.getAntBranch().setCharPref("mode", value);
    },

    /**
     * @member get:converterPath
     * @return {String}
     */
    get converterPath()
    {
        const avconvPathOption = "extensions.anttoolbar.avconv";
    
        var prefStorage = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);

        try
        {
            return prefStorage.getCharPref(avconvPathOption);
        }
        catch (ex)
        {
            return "";
        }
    },

    /**
     * @member set:converterPath
     * @param {String} value
     */
    set converterPath(value)
    {
        const avconvPathOption = "extensions.anttoolbar.avconv";
        var prefStorage = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
        prefStorage.setCharPref(avconvPathOption, value);
    },

    get flvDir()
    {
        return AntPrefs.getAntBranch().getComplexValue("flvdir", Components.interfaces.nsISupportsString).data;
    },
    
    set flvDir(value)
    {
        var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
        str.data = value;
        AntPrefs.getAntBranch().setComplexValue("flvdir", Components.interfaces.nsISupportsString, str);
    },

    get flvToPlay()
    {
        return AntPrefs.getAntBranch().getComplexValue("flvToPlay", Components.interfaces.nsISupportsString).data;
    },
    
    set flvToPlay(value)
    {
        var str = Components.classes["@mozilla.org/supports-string;1"].createInstance(Components.interfaces.nsISupportsString);
        str.data = value;
        AntPrefs.getAntBranch().setComplexValue("flvToPlay", Components.interfaces.nsISupportsString, str);
    },

    get displaySearchBox()
    {
        var self = AntPrefs;
        return self.getAntBranch().getBoolPref("display_search_box");
    },
    
    set displaySearchBox(value)
    {
        var self = AntPrefs;
        return self.getAntBranch().setBoolPref("display_search_box", value);
    },

    get isRankMode()
    {
        var self = AntPrefs;
        return self.getAntBranch().getBoolPref("rankmode");
    },
    
    set isRankMode(value)
    {
        var self = AntPrefs;
        self.getAntBranch().setBoolPref("rankmode", value);
    },

    get version()
    {
        var self = AntPrefs;
        return self.getAntBranch().getCharPref("version");
    },
    
    set version(value)
    {
        var self = AntPrefs;
        self.getAntBranch().setCharPref("version", value);
    },

    get canSendStats()
    {
        var self = AntPrefs;
        return self.getAntBranch().getBoolPref("videorepports");
    },
    
    get canSendHeartBeat()
    {

        return AntPrefs.getAntBranch().getBoolPref('heartbeat');
    },
    
    set installTs(value)
    {
        AntPrefs.getAntBranch().setIntPref('install_ts', value);
    },
    
    get installTs()
    {
        return AntPrefs.getAntBranch().getIntPref('install_ts');
    },
    
    get loop()
    {
        return AntPrefs.getAntBranch().getBoolPref('loop');
    },
    
    set loop(value)
    {
        AntPrefs.getAntBranch().setBoolPref('loop', value);
    },
    
    get random()
    {
        return AntPrefs.getAntBranch().getBoolPref('random');
    },
    
    set random(value)
    {
        AntPrefs.getAntBranch().setBoolPref('random', value);
    },
    
    get continuous()
    {
        return AntPrefs.getAntBranch().getBoolPref('continuous');
    },
    
    set continuous(value)
    {
        AntPrefs.getAntBranch().setBoolPref('continuous', value);
    },
    
    get defaultSe()
    {
        return AntLib.CCSV("@mozilla.org/preferences-service;1", "nsIPrefService")
                     .getBranch("browser.search.")
                     .getComplexValue("defaultenginename", Components.interfaces.nsIPrefLocalizedString).data
    },
    /*
     * player tree control dimentions(sizes, sort by, sort direction, columns visibility)
     */
    set listWidth(value)
    {
        AntPrefs.getAntBranch().setIntPref('listWidth', value);
    },
    
    get listWidth()
    {
        return AntPrefs.getAntBranch().getIntPref('listWidth');
    },
    
    set titleWidth(value)
    {
        AntPrefs.getAntBranch().setIntPref('nameWidth', value);
    },
    
    get titleWidth()
    {
        return AntPrefs.getAntBranch().getIntPref('nameWidth');
    },
    
    set sizeWidth(value)
    {
        AntPrefs.getAntBranch().setIntPref('sizeWidth', value);
    },
    
    get sizeWidth()
    {
        return AntPrefs.getAntBranch().getIntPref('sizeWidth');
    },
    
    set created_atWidth(value)
    {
        AntPrefs.getAntBranch().setIntPref('dateWidth', value);
    },
    
    get created_atWidth()
    {
        return AntPrefs.getAntBranch().getIntPref('dateWidth');
    },
    
    set domainWidth(value)
    {
        AntPrefs.getAntBranch().setIntPref('domainWidth', value);
    },
    
    get domainWidth()
    {
        return AntPrefs.getAntBranch().getIntPref('domainWidth');
    },
    
    set sizeVisible(value)
    {
        AntPrefs.getAntBranch().setBoolPref('sizeVisible', value);
    },
    
    get sizeVisible()
    {
        return AntPrefs.getAntBranch().getBoolPref('sizeVisible');
    },
    
    set dateVisible(value)
    {
        AntPrefs.getAntBranch().setBoolPref('dateVisible', value);
    },
    
    get dateVisible()
    {
        return AntPrefs.getAntBranch().getBoolPref('dateVisible');
    },
    
    set domainVisible(value)
    {
        AntPrefs.getAntBranch().setBoolPref('domainVisible', value);
    },
    
    get domainVisible()
    {
        return AntPrefs.getAntBranch().getBoolPref('domainVisible');
    },
    
    set sortBy(value)
    {
        AntPrefs.getAntBranch().setCharPref('sortBy', value);
    },
    
    get sortBy()
    {
        return AntPrefs.getAntBranch().getCharPref('sortBy');
    },
    
    set sortDirection(value)
    {
        AntPrefs.getAntBranch().setBoolPref('sortDirection', value);
    },
    
    get sortDirection()
    {
        return AntPrefs.getAntBranch().getBoolPref('sortDirection');
    },
    
    /*
     * player window position
     */
    get playerMode()
    {
        return AntPrefs.getAntBranch().getCharPref('playerMode');
    },
    
    set playerMode(value)
    {
        AntPrefs.getAntBranch().setCharPref('playerMode', value);
    },

    /*
     * Add-on bar shown
     */
    get addonbarOpened()
    {
        return AntPrefs.getAntBranch().getBoolPref('addonbar_opened');
    },
    
    set addonbarOpened(value)
    {
        AntPrefs.getAntBranch().setBoolPref('addonbar_opened', value);
    },
    
    /*
     *player window sizes
     */
    get playerXScreen()
    {
        return AntPrefs.getAntBranch().getIntPref('playerXscreen');
    },
    
    set playerXScreen(value)
    {
        AntPrefs.getAntBranch().setIntPref('playerXscreen', value);
    },
    
    get playerYScreen()
    {
        return AntPrefs.getAntBranch().getIntPref('playerYscreen');
    },
    
    set playerYScreen(value)
    {
        AntPrefs.getAntBranch().setIntPref('playerYscreen', value);
    },
    
    get playerWindowWidth()
    {
        return AntPrefs.getAntBranch().getIntPref('playerWindowWidth');
    },
    
    set playerWindowWidth(value)
    {
        AntPrefs.getAntBranch().setIntPref('playerWindowWidth', value);
    },
    
    get playerWindowHeight()
    {
        return AntPrefs.getAntBranch().getIntPref('playerWindowHeight');
    },
    
    set playerWindowHeight(value)
    {
        AntPrefs.getAntBranch().setIntPref('playerWindowHeight', value);
    },
};
