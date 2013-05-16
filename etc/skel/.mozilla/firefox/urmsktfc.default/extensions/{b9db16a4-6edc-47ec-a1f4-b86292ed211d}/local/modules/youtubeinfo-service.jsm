/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["YouTubeInfoService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var YouTubeInfoService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new YTInfo();
			}
		} catch(e) {
			dump("!!! [YouTubeInfoService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function YTInfo() {
	try {
		//dump("[YTInfo] constructor\n");
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		this.formats={
				6: { type: "6", format: "FLV", video: "480x360", audio: "mono", name: "HQ6" },
				13: { type: "13", format: "3GP", video: "176x144", audio: "mono", name: "HQ13" },
				17: { type: "17", format: "3GP", video: "176x144", audio: "stereo", name: "Mobile" },
				18: { type: "18", format: "MP4", video: "480x360", audio: "stereo", name: "Medium" },
				34: { type: "34", format: "FLV", video: "640x360", audio: "stereo", name: "360p" },
				35: { type: "35", format: "FLV", video: "854x480", audio: "stereo", name: "480p" },
				22: { type: "22", format: "MP4", video: "1280x720", audio: "stereo", name: "720p" },
				37: { type: "37", format: "MP4", video: "1920x1080", audio: "stereo", name: "1080p" },
				38: { type: "38", format: "MP4", video: "4096x3072", audio: "stereo", name: "4K" },
				45: { type: "45", format: "WEBM", video: "1280x720", audio: "stereo", name: "WebM720p" },
				44: { type: "44", format: "WEBM", video: "854x480", audio: "stereo", name: "WebM480p" },
				43: { type: "43", format: "WEBM", video: "640x360", audio: "stereo", name: "WebM360p" },
				5: { type: "5", format: "FLV", video: "400x226", audio: "stereo", name: "240p" },
		}

	} catch(e) {
		dump("[YTInfo] !!! constructor: "+e+"\n");
	}
}

YTInfo.prototype = {}

YTInfo.prototype.getFixedFormatsList=function() {
	var formats=[];
	var f=this.pref.getCharPref("ythq-formats");
	if(f.length>0)
		formats=f.split(",");
	for(var i in f) {
		if(typeof(this.formats[parseInt(f[i])])!="undefined" && formats.indexOf(f[i])<0)
			formats.push(f[i]);
	}
	if(formats.indexOf("34")<0)
		formats.push("34");
	return formats.join(",");
}

YTInfo.prototype.getFormats=function() {
	var formats=Components.classes["@mozilla.org/array;1"].
    	createInstance(Components.interfaces.nsIMutableArray);
	for(var f in this.formats) {
		var fdesc=Components.classes["@mozilla.org/properties;1"].
			createInstance(Components.interfaces.nsIProperties);
		var format=this.formats[f];
		for(var i in format) {
			Util.setPropsString(fdesc,i,format[i]);
		}
		formats.appendElement(fdesc,false);
	}
	return formats;
}

YTInfo.prototype.getFormatPrefix=function(fmt) {
	if(typeof(this.formats[fmt])=="undefined")
		return "[??] ";
	var format=this.formats[fmt];
	var parts=[];
	var prefix=this.pref.getIntPref("ythq-prefix");
	if(prefix & 1)
		parts.push(format['type']);
	if(prefix & 2)
		parts.push(format['name']);
	if(prefix & 4)
		parts.push(format['video']);
	if(parts.length==0)
		return "";
	else
		return "["+parts.join(" ")+"] ";
}

YTInfo.prototype.getExtension=function(fmt) {
	var f=this.formats[fmt];
	if(f==null)
		return "flv";
	else 
		return f['format'].toLowerCase();
}

YTInfo.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.dhIYTInfo)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}
