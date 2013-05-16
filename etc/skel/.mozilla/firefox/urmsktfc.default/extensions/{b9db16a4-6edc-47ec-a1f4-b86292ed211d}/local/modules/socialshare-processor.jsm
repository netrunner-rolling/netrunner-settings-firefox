/******************************************************************************
 *            Copyright (c) 2009-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperSocialShareProcService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");
IOS=Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);

var DWHelperSocialShareProcService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new SocialShare();
			}
		} catch(e) {
			dump("!!! [SocialShareProcService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function SocialShare() {
	try {
		//dump("[SocialShare] constructor\n");
		this.init();
	} catch(e) {
		dump("[SocialShare] !!! constructor: "+e+"\n");
	}
}

SocialShare.prototype = {
		get name() { return "social-share"; },
		get provider() { return "DownloadHelper"; },
		get title() { return Util.getText("social-share.title"); },
		get description() { return Util.getText("social-share.description"); },
		get enabled() { return this.pref.getBoolPref("enabled"); },
		get weight() { return 100; }
}

SocialShare.prototype.init=function() {
	try {
		//dump("[SocialShare] init()\n");
		if(!Util.priorTo19()) {
			var prefService=Components.classes["@mozilla.org/preferences-service;1"]
			                                   .getService(Components.interfaces.nsIPrefService);
			this.pref=prefService.getBranch("dwhelper.social-share.");
			this.core=Components.classes["@downloadhelper.net/core;1"].
				getService(Components.interfaces.dhICore);
			this.services={
				"twitter": {
					"name": "Twitter",
					"icon": "twitter.png",
					"link": "http://twitter.com/?status={st}"
				},
				"facebook": {
					"name": "Facebook",
					"icon": "facebook.png",
					"link": "http://www.facebook.com/sharer.php?u={u}&t={ti}"
				},
				"stumbleupon": {
					"name": "StumbleUpon",
					"icon": "stumbleit.png",
					"link": "http://www.stumbleupon.com/submit?url={u}&title={ti}"
				},
				"slashdot": {
					"name": "SlashDot",
					"icon": "slashdot.png",
					"link": "http://slashdot.org/bookmark.pl?url={u}&title={ti}"
				},
				"pingthis": {
					"name": "Ping This!",
					"icon": "pingthis.png",
					"link": "http://ping.fm/ref/?link={u}&title={ti}&body={te}"
				},
				"google_buzz": {
					"name": "Google Buzz",
					"icon": "google_buzz.png",
					"link": "http://www.google.com/buzz/post?url={u}"
				},
				"google": {
					"name": "Google",
					"icon": "google.png",
					"link": "http://www.google.com/bookmarks/mark?op=add&bkmk={u}&title={ti}"
				},
				"delicious": {
					"name": "del.icio.us",
					"icon": "delicious.png",
					"link": "http://del.icio.us/post?url={u}&title={ti}"
				},
				"digg": {
					"name": "Digg",
					"icon": "digg.png",
					"link": "http://digg.com/submit?phase=2&url={u}&title={ti}"
				},
				"furl": {
					"name": "Furl",
					"icon": "furl.png",
					"link": "http://www.furl.net/storeIt.jsp?u={u}&t={ti}"
				},
				"linkedin": {
					"name": "LinkedIn",
					"icon": "linkedin.png",
					"link": "http://www.linkedin.com/shareArticle?mini=true&url={u}&title={ti}&summary={te}&source=Video+DownloadHelper"
				},
				"technorati": {
					"name": "Technorati",
					"icon": "technorati.png",
					"link": "http://technorati.com/search/{u}"
				},
				"propeller": {
					"name": "Propeller",
					"icon": "propeller.png",
					"link": "http://www.propeller.com/submit/?U={u}&T={ti}"
				},
				"reddit": {
					"name": "Reddit",
					"icon": "reddit.png",
					"link": "http://reddit.com/submit?url={u}&title={ti}"
				},
				"magnoliacom": {
					"name": "Magnoliacom",
					"icon": "magnoliacom.png",
					"link": "http://ma.gnolia.com/bookmarklet/add?url={u}&title={ti}",
				},
				"newsvine": {
					"name": "Newsvine",
					"icon": "newsvine.png",
					"link": "http://www.newsvine.com/_tools/seed&save?u={u}&h={ti}"
				},
				"myspace": {
					"name": "MySpace",
					"icon": "myspace.png",
					"link": "http://www.myspace.com/index.cfm?fuseaction=postto&t={ti}&u={u}"
				},
				"yahoo": {
					"name": "Yahoo",
					"icon": "yahoo.png",
					"link": "http://bookmarks.yahoo.com/myresults/bookmarklet?u={u}&t={ti}"
				},
				"buzz": {
					"name": "Buzz Up!",
					"icon": "buzz.png",
					"link": "http://buzz.yahoo.com/buzz?targetUrl={u}&headline={ti}&summary={te}"
				},
				"icerocket": {
					"name": "Icerocket",
					"icon": "icerocket.png",
					"link": "http://blogs.icerocket.com/search?q={u}"
				},
				"misterwong": {
					"name": "Mister Wong",
					"icon": "misterwong.png",
					"link": "http://www.mister-wong.com/addurl/?bm_url={u}&bm_description={ti}"
				},
				"mixx": {
					"name": "Mixx",
					"icon": "mixx.png",
					"link": "http://www.mixx.com/submit?page_url={u}&title={ti}"
				},
				"box": {
					"name": "Box",
					"icon": "box.png",
					"link": "https://www.box.net/api/1.0/import?url={u}&name={ti}&description={te}&import_as=link"
				},
				"blinklist": {
					"name": "Blinklist",
					"icon": "blinklist.png",
					"link": "http://www.blinklist.com/index.php?Action=Blink/addblink.php&Description={te}&Url={u}&Title={ti}&Pop=yes"
				},
				"identica": {
					"name": "identi.ca",
					"icon": "identica.png",
					"link": "http://identi.ca/?action=newnotice&status_textarea={ti}+{u}"
				}
			}
			this.core.registerProcessor(this);
		}
	} catch(e) {
		dump("[SocialShare] !!! init(): "+e+"\n");
	}	
}

SocialShare.prototype.canHandle=function(desc) {
	//dump("[SocialShare] canHandle()\n");
	var extension=Util.getPropsString(desc,"file-extension");
	if(extension=="flv" || extension=="mp4")
		return true;
	else
		return false;
}

SocialShare.prototype.requireDownload=function(desc) {
	//dump("[SocialShare] requireDownload()\n");
	return false;
}
	
SocialShare.prototype.preDownload=function(desc) {
	//dump("[SocialShare] preDownload()\n");
	return false;
}

SocialShare.prototype.handle=function(desc) {
	//dump("[SocialShare] handle()\n");
	try {
		var purl=Util.getPropsString(desc,"page-url");
		var murl=Util.getPropsString(desc,"media-url");
		var extension=Util.getPropsString(desc,"file-extension");
		var title=Util.getPropsString(desc,"label");
		var smartnaming=false;
		if(desc.has("sn-name")) {
			smartnaming=true;
			title=Util.getPropsString(desc,"sn-name");
		}
		var description="";
		if(desc.has("sn-descr")) {
			smartnaming=true;
			description=Util.getPropsString(desc,"sn-descr");
		} else {
			description=Util.getPropsString(desc,"label");
		}
		var xml=[
		         "<?xml version='1.0' encoding='utf-8'?>\n<media>\n",
		         "  <purl>",Util.xmlEscape(purl),"</purl>\n",
		         "  <murl>",Util.xmlEscape(murl),"</murl>\n",
		         "  <title>",Util.xmlEscape(title),"</title>\n",
		         "  <description>",Util.xmlEscape(description),"</description>\n",
		         "  <extension>",Util.xmlEscape(extension),"</extension>\n",
		         "  <smartname>",""+smartnaming,"</smartname>\n",
		         "</media>"
		         ].join("");
		var url="http://vdh.bz/set-xml.php";
		var uri = IOS.newURI(url, null, null);
		var channel = IOS.newChannelFromURI(uri);
		var httpChannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);
		var listener = new XMLStreamListener(this,"gotLink",{entry: desc, purl: purl, murl: murl, title: title, description: description, 
			smartnaming: smartnaming });
		channel.notificationCallbacks = listener;

		var pipe=Components.classes["@mozilla.org/pipe;1"].
        	createInstance(Components.interfaces.nsIPipe);
		pipe.init(true,false,1024,10,null);
		var charset = "UTF-8"; // Can be any character encoding name that Mozilla supports

		var os = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
		                   .createInstance(Components.interfaces.nsIConverterOutputStream);
		os.init(pipe.outputStream, charset, 0, 0x0000);
		os.writeString(xml);
		os.close();

		var uploadChannel = channel.QueryInterface(Components.interfaces.nsIUploadChannel);
		uploadChannel.setUploadStream(pipe.inputStream, "application/x-binary", -1);

		httpChannel.requestMethod = "POST";	
		channel.asyncOpen(listener, null);
	} catch(e) {
		dump("!!! [SocialShare] handle()/getLink: "+e+"\n");
	}
}

SocialShare.prototype.gotLink=function(args,status,doc,httpStatus,text) {
	//dump("[SocialShare] gotLink("+args+","+status+","+doc+","+httpStatus+",<text>)\n<text>="+text+")\n");
	var shortUrl=null;
	try {
		if(httpStatus!=200 || doc==null || Util.xpGetString(doc.documentElement,"/result/status")!="success") {
			shortUrl=args.purl;
		} else {
			shortUrl=Util.xpGetString(doc.documentElement,"/result/url");
		}
		args.shortUrl=shortUrl;
		
	    var twitterMsg=shortUrl;
	    if(this.pref.getBoolPref("tag-message"))
	    	twitterMsg+=" #vidohe";
	    
	    if(this.twitterLength(args.title+".. "+twitterMsg)>140) {
	    	var title=args.title;
	    	var txt=title+".. "+twitterMsg;
	    	while(this.twitterLength(txt)>140) {
	    		title=title.substr(0,title.length-1);
		    	txt=title+".. "+twitterMsg;
	    	}
	    	twitterMsg=txt;
	    } else {
	    	if(this.twitterLength(args.title+" "+args.description+" "+twitterMsg)>140) {
		    	var description=args.description;
		    	var txt=args.title+" - "+description+".. "+twitterMsg;
	    		while(this.twitterLength(txt)>140) {
		    		description=description.substr(0,description.length-1);
			    	txt=args.title+" - "+description+".. "+twitterMsg;
	    		}
	    		twitterMsg=txt;
	    	} else {
	    		twitterMsg=args.title+" - "+args.description+" "+twitterMsg;
	    	}
	    }

		args.twitterMsg=twitterMsg;
		
		var services={}
		for(var i in this.services) {
			var enabled=true;
			try {
				enabled=this.pref.getBoolPref("service."+i+".enabled");
			} catch(e) {}
			if(enabled)
				services[i]=this.services[i];
		}
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	                                .getService(Components.interfaces.nsIWindowMediator);
		var window = wm.getMostRecentWindow("navigator:browser");
	    var options="chrome,centerscreen,toolbar,modal";
	    var data={
	    	services: services,
	    	socialShareService: this,
	    	data: args
	    }
	    window.openDialog("chrome://dwhelper/content/social-share.xul",'',options, data );
	} catch(e) {
		dump("[SocialShare] gotLink(): "+e+"\n");
	}
}

SocialShare.prototype.twitterLength=function(text) {

	var txt=text.replace(/&/g,"&amp;");
	var txt=txt.replace(/</g,"&lt;");
	var txt=txt.replace(/>/g,"&gt;");

	var string = txt.replace(/\r\n/g,"\n");
	var utftext = "";
	for (var n = 0; n < string.length; n++) {
		var c = string.charCodeAt(n);
		if (c < 128) {
			utftext += String.fromCharCode(c);
		}
		else if((c > 127) && (c < 2048)) {
			utftext += String.fromCharCode((c >> 6) | 192);
			utftext += String.fromCharCode((c & 63) | 128);
		}
		else {
			utftext += String.fromCharCode((c >> 12) | 224);
			utftext += String.fromCharCode(((c >> 6) & 63) | 128);
			utftext += String.fromCharCode((c & 63) | 128);
		}
	}
	return utftext.length;
}

SocialShare.prototype.invokeService=function(aService, aUrl, aTitle, aDescription, aShortText) {
	try {
		if(typeof(this.services[aService])=="undefined")
			return;
		var link=this.services[aService].link;
		link=link.replace(/\{u\}/g,encodeURIComponent(aUrl));
		link=link.replace(/\{ti\}/g,encodeURIComponent(aTitle));
		link=link.replace(/\{te\}/g,encodeURIComponent(aDescription));
		link=link.replace(/\{st\}/g,encodeURIComponent(aShortText));
	    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
	                                .getService(Components.interfaces.nsIWindowMediator);
		var window = wm.getMostRecentWindow("navigator:browser");
		var browser=window.getBrowser();
		browser.selectedTab=browser.addTab(link);
	} catch(e) {
		dump("[SocialShare] invokeService(): "+e+"\n");
	}
}

SocialShare.prototype.getServices=function() {
	var array0=Components.classes["@mozilla.org/array;1"].
		createInstance(Components.interfaces.nsIMutableArray);
	for(var i in this.services) {
		var entry0=Components.classes["@mozilla.org/properties;1"].
			createInstance(Components.interfaces.nsIProperties);
		Util.setPropsString(entry0,"name",i);
		Util.setPropsString(entry0,"title",this.services[i].name);
		array0.appendElement(entry0,false);
	}
	return array0;
}

SocialShare.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIProcessor) ||
       	iid.equals(Components.interfaces.dhISocialShare)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}


function XMLStreamListener(service,callback,args) {
	this.service=service;
	this.callback=callback;
	this.args=args;
}

XMLStreamListener.prototype={
	QueryInterface: function(iid) {
	    if (iid.equals(Components.interfaces.nsISupports) || 
	    	iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
	    	iid.equals(Components.interfaces.nsIStreamListener)) {
	    	return this;
	    }
        throw Components.results.NS_ERROR_NO_INTERFACE;
	},
	onStartRequest: function(request,context) {
		this.data="";
	},
	onDataAvailable: function(request,context,inputStream,offset,count) {
		var sstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
               .createInstance(Components.interfaces.nsIConverterInputStream);
		sstream.init(inputStream, "utf-8", 256, 
			Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

		var str={};
		var n=sstream.readString(128,str);
		while(n>0) {
			this.data+=str.value;
			str={};
			n=sstream.readString(128,str);
		}
	},
	onStopRequest: function(request,context,nsresult) {
		var responseStatus=request.QueryInterface(Components.interfaces.nsIHttpChannel).responseStatus;
		if(responseStatus==200) {
			var parser=Components.classes["@mozilla.org/xmlextras/domparser;1"].
				createInstance(Components.interfaces.nsIDOMParser);
			var doc=parser.parseFromString(this.data,"text/xml");
			this.service[this.callback](this.args,true,doc,responseStatus,this.data);
		} else {
			this.service[this.callback](this.args,false,null,responseStatus,this.data);
		}
	},
	getInterface: function(iid) {
	    if (iid.equals(Components.interfaces.nsISupports) || 
	    	iid.equals(Components.interfaces.nsIInterfaceRequestor) ||
	    	iid.equals(Components.interfaces.nsIStreamListener)) {
	    	return this;
	    }
	    return null;
	},
}

