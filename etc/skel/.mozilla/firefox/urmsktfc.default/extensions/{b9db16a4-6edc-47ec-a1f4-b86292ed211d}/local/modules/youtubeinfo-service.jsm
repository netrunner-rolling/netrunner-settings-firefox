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
		this.core=Components.classes["@downloadhelper.net/core;1"].
			getService(Components.interfaces.dhICore);
		var prefService=Components.classes["@mozilla.org/preferences-service;1"]
		                                   .getService(Components.interfaces.nsIPrefService);
		this.pref=prefService.getBranch("dwhelper.");
		try {
			Components.utils['import']("resource://gre/modules/PrivateBrowsingUtils.jsm");
			this.pbUtils=PrivateBrowsingUtils;
		} catch(e) {
			this.pbUtils=null;
		}

		this.formats={
				5: { type: "5", format: "FLV", video: "320x240", audio: "mono", name: "HQ5" },
				6: { type: "6", format: "FLV", video: "360x270", audio: "mono", name: "HQ6" },
				13: { type: "13", format: "3GP", video: "176x144", audio: "mono", name: "HQ13" },
				17: { type: "17", format: "3GP", video: "176x144", audio: "stereo", name: "Mobile" },
				18: { type: "18", format: "MP4", video: "360x270/480x360", audio: "stereo", name: "Medium" },
				22: { type: "22", format: "MP4", video: "1280x720", audio: "stereo", name: "720p" },
				34: { type: "34", format: "FLV", video: "640x360", audio: "stereo", name: "360p" },
				35: { type: "35", format: "FLV", video: "854x480", audio: "stereo", name: "480p" },
				36: { type: "36", format: "3GP", video: "360x240", audio: "stereo", name: "HQ36" },
				37: { type: "37", format: "MP4", video: "1920x1080", audio: "stereo", name: "1080p" },
				38: { type: "38", format: "MP4", video: "4096x3072", audio: "stereo", name: "4K" },
				43: { type: "43", format: "WEBM", video: "640x360", audio: "stereo", name: "WebM360p" },
				44: { type: "44", format: "WEBM", video: "854x480", audio: "stereo", name: "WebM480p" },
				45: { type: "45", format: "WEBM", video: "1280x720", audio: "stereo", name: "WebM720p" },
				46: { type: "46", format: "WEBM", video: "1440x1080", audio: "stereo", name: "WebM1080p" },
				82: { type: "82", format: "MP4", video: "480x360", audio: "stereo", name: "HQ82" },
				83: { type: "83", format: "MP4", video: "360x240", audio: "stereo", name: "HQ83" },
				84: { type: "84", format: "MP4", video: "960x720", audio: "stereo", name: "HQ84" },
				85: { type: "85", format: "MP4", video: "720x540", audio: "stereo", name: "HQ85" },
				/*
				100: { type: "100", format: "WEBM", video: "480x360", audio: "stereo", name: "HQ100" },
				100: { type: "101", format: "WEBM", video: "480x360", audio: "stereo", name: "HQ101" },
				102: { type: "102", format: "WEBM", video: "1080x720", audio: "stereo", name: "HQ102" },
				133: { type: "133", format: "MP4", video: "320x240", audio: "none", name: "HQ133" },
				134: { type: "134", format: "MP4", video: "480x360", audio: "none", name: "HQ134" },
				135: { type: "135", format: "MP4", video: "640x480", audio: "none", name: "HQ135" },
				139: { type: "139", format: "MP4", video: "N/A", audio: "stereo", name: "HQ139" },
				140: { type: "140", format: "MP4", video: "N/A", audio: "stereo", name: "HQ140" },
				141: { type: "141", format: "MP4", video: "N/A", audio: "stereo", name: "HQ141" },
				160: { type: "160", format: "MP4", video: "192x144", audio: "none", name: "HQ160" },
				*/
		}

		var $this=this;
		this.videoMap={};
		this.videoMapCleanTiming=this.pref.getIntPref("yt-cache-timing");
		this.videoMapCleanTimer=Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		this.videoMapCleanTimer.initWithCallback({
			notify: function(timer) {
				$this.videoMapCleanup();
			},
		},10000,Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);

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
		return "[<"+fmt+">] ";
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

YTInfo.prototype.similar=function(sig1,sig2) {
	var maxIter=20;
	var matches=0;
	var subLength=6;
	
	function CheckSub() {
		var sub=sig1.substr(Math.floor(Math.random()*(sig1-subLength)),subLength);
		if(sig2.indexOf(sub)>=0)
			matches++;
	}
	for(var i=0;i<maxIter && matches<3;i++)
		CheckSub();
	return matches>=3;
}

YTInfo.prototype.findOccurences=function(s,s0) {
	var occurences=[];
	var i0=0;
	while(1) {
		var i=s0.indexOf(s);
		if(i<0)
			return occurences;
		occurences.push(i0+i);
		i0=i0+i+s.length;
		s0=s0.substr(i+s.length);
	}
}

YTInfo.prototype.findBestSeq=function(s,s0) {
	var best={
		index: -1,
		length: 0,
		index0: -1
	}
	for(var i=0;i<s.length;i++) {
		for(var j=s.length-i;j>=0;j--) {
			var occs=this.findOccurences(s.substr(i,j),s0);
			if(occs.length>0) {
				if(j>best.length) {
					best.length=j;
					best.index0=occs;
					best.index=i;
				}
				i+=j-1;
				break;
			}
		}
	}
	return best;
}

YTInfo.prototype.findPerms2=function(s,s0) {
	var guess=[];
	for(var i=0;i<s0.length;i++) {
		var poss=[];
		for(var j=0;j<s0.length;j++)
			poss.push(j);
		guess.push(poss);
	}
	for(var j=0;j<s.length;j++) {
		var perm=[];
		for(var k=0;k<guess[j].length;k++) {
			if(s[j]==s0[guess[j][k]])
				perm.push(guess[j][k]);
		}
		guess[j]=perm;
	}
	var perms=[];
	for(var i=0;i<s.length;i++)
		perms.push([i,1,guess[i]]);
	return perms;
}

YTInfo.prototype.checkEntries=function(vid,itag,signature) {
	var entries=this.core.getEntries();
	var perms=null;
	var toBeFixed=[];
	var iter=entries.enumerate();
	while(iter.hasMoreElements()) {
		var desc=iter.getNext().QueryInterface(Components.interfaces.nsIProperties);
		var itag0=Util.getPropsString(desc,"yt-itag");
		var vid0=Util.getPropsString(desc,"yt-vid");
		if(vid0==vid && itag0==itag) {
			var sig0=Util.getPropsString(desc,"yt-sig0");
			if(sig0!=null) {
				var sig=Util.getPropsString(desc,"yt-sig");
				if(sig!=signature) {
					//dump("itag "+itag+" sig0 "+sig0+" signature "+signature+"\n");
					var modif=false;
					var sig1="";
					try {
						perms=JSON.parse(this.pref.getCharPref("yt-sig-perms-"+sig0.length));
						for(var i=0;i<perms.length;i++) {
							var perm=perms[i];
							var matching=[];
							for(var j=0;j<perm[2].length;j++) {
								var index0=perm[2][j];
								if(sig0.substr(index0,perm[1])==signature.substr(perm[0],perm[1])) {
									matching.push(index0);
								} else {
									modif=true;
								}
							}
							if(matching.length==0) {
								perms=null;
								break;
							}
							perm[2]=matching;
							sig1+=sig0.substr(matching[0],perm[1]);
						}
					} catch(e) {
						modif=true;
					}
					if(perms==null || sig1.length==0) {
						perms=this.findPerms2(signature,sig0);
						modif=true;
					}
					if(perms!=null) {
						if(modif) {
							this.pref.setCharPref("yt-sig-perms-"+sig0.length,JSON.stringify(perms));
							var perm0=[];
							for(var i=0;i<perms.length;i++) {
								var perm=perms[i];
								perm0.push([perm[2][0],perm[2][0]+perm[1]]);
							}
							toBeFixed.push(desc);
							this.pref.setCharPref("yt-sig-perm-"+sig0.length,JSON.stringify(perm0));
						}
					}
				}
			}
		}
	}
	for(var i=0;i<toBeFixed.length;i++) {
		var desc=toBeFixed[i];
		var sig0=Util.getPropsString(desc,"yt-sig0");
		var url=Util.getPropsString(desc,"media-url");
		var m=/^(.*signature=)([0-9A-F\.]+)(.*)$/.exec(url);
		if(m) {
			try {
				var perm=JSON.parse(this.pref.getCharPref("yt-sig-perm-"+sig0.length));
				var sig="";
				for(var j=0;j<perm.length;j++) {
					sig+=sig0.substring(perm[j][0],perm[j][1]);
				}
				var url1=m[1]+sig+m[3];
				Util.setPropsString(desc,"media-url",url1);
			} catch(e) {}
		}
	}
}

YTInfo.prototype.handleRequest=function(request) {
	if(/^https?:\/\/[^\/]*\.?youtube\.[^\/\.]+.*videoplayback.*signature/.test(request.name)) {
		var m=/itag=([0-9]+)/.exec(request.name);
		if(m) {
			var itag=m[1];
			m=/signature=([^&$]*)/.exec(request.name);
			if(m) {
				var signature=m[1];
				var m=/[\?&]id=(.*?)[&$]/.exec(request.name);
				if(m) {
					try {
					this.checkEntries(m[1],itag,signature);
					} catch(e) {
						dump("!!! [YTProve] checkEntries: "+e+"\n");
					}
				}
			}
		}
	}
}

YTInfo.prototype.videoMapCleanup=function() {
	//dump("YTInfo.prototype.videoMapCleanup\n");
	var now=Date.now();
	for(var vid in this.videoMap) {
		if(this.videoMap[vid].timestamp+this.videoMapCleanTiming<now) {
			delete this.videoMap[vid];
			//dump("YTInfo.prototype.videoMapCleanup purge "+vid+"\n");
		}
	}
}

YTInfo.prototype.getVideoTitle=function(dom) {
	var title=Util.xpGetString(dom,"/html/head/meta[@name='title']/@content");
	if(title==null || title.length==0) {
		title=Util.xpGetString(dom,".//h3[@id='playnav-restricted-title']/text()");
	}
	if(title==null || title.length==0) {
		title=Util.xpGetString(dom,".//div[@class='content']/div/a/img[@title]/@title");
	}			
	if(title) {
		title=Util.resolveNumericalEntities(title);
		title=title.replace(/"/g,"");
	}
	return title;
}

YTInfo.prototype.getVideoFileName=function(title) {
	var fileName=title;
	var unmodifiedFilename=false;
	try {
		unmodifiedFilename=this.pref.getBoolPref("yt-unmodified-filename");		
	} catch(e) {}
	fileName=fileName.replace(/(?:[\/"\?\*:\|"'\\_]|&quot;|&amp;|&gt;|&lt;)+/g,"_");
	if(unmodifiedFilename==false) {
		var keepSpaces=false;
		try {
			keepSpaces=this.pref.getBoolPref("yt-keep-spaces");
		} catch(e) {}
		if(keepSpaces)
			fileName=fileName.replace(/[^a-zA-Z0-9\.\- ]+/g,"_");
		else
			fileName=fileName.replace(/[^a-zA-Z0-9\.\-]+/g,"_");
		fileName=fileName.replace(/^[^a-zA-Z0-9]+/,"");
		fileName=fileName.replace(/[^a-zA-Z0-9]+$/,"");
	}
	if(title) {
		title=title.replace(/&quot;/g,"\"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
	}
	return fileName;
}

YTInfo.prototype.handleDocument=function(document,window) {
	try {
		this.handleDocumentSpf(document,window);
	} catch(e) {
		dump("!!! [YTInfo] handleDocument: "+e+"\n")
	}
}

YTInfo.prototype.handleDocumentSpf=function(document,window) {
	var $this=this;
	//dump("handleDocumentSpf "+document.URL+"\n")
	var m = /^https?:\/\/[^\/]*\.?youtube\.[^\/\.]+\/.*[\?&]v=([a-zA-Z0-9\-_]+)/.exec(document.URL);
	if(m) {
		var videoId=m[1];

		var title = this.getVideoTitle(document.documentElement);
		
		document=Components.utils.getWeakReference(document);
		window=Components.utils.getWeakReference(window);
		
		function HandleMeta(js) {
			
			var dataElement=null;
			
			var uefsm = null;
			js.forEach(function(obj) {
				for(var f in obj) {
					var args=null;
					if(f=="data" && obj.data && obj.data.swfcfg.args)
						args=obj.data.swfcfg.args;
					else if(f=="swfcfg" && obj.swfcfg.args)
						args=obj.swfcfg.args;
					if(args) {
						if(args.title)
							title = args.title;
						if(args.url_encoded_fmt_stream_map)
							uefsm = args.url_encoded_fmt_stream_map;
					}
				}
			});
			if(!uefsm) {
				dump("!!! [YouTubeInfoService: no variant format in meta information]:\n");
				return;							
			}
			var fileName = $this.getVideoFileName(title);
			
			var variants={};
			uefsm.split(",").forEach(function(variant) {
				var props={};
				variant.split("&").forEach(function(prop) {
					var pLine=decodeURIComponent(prop);
					var m1=/^(.*?)=(.*)$/.exec(pLine);
					if(m1)
						props[m1[1]]=m1[2];
				});
				if(props.itag)
					variants[props.itag]=props;
			});

			window=window.get();
			document=document.get();
			
			if(!window) {
				dump("!!! [YouTubeInfoService]: window expired\n");
				return;
			}
			if(!document) {
				dump("!!! [YouTubeInfoService]: document expired\n");
				return;
			}
			
			var desc=Components.classes["@mozilla.org/properties;1"].
				createInstance(Components.interfaces.nsIProperties);
			Util.setPropsString(desc,"page-url",document.URL);
			Util.setPropsString(desc,"label",title);
			Util.setPropsString(desc,"base-name",fileName);
			Util.setPropsString(desc,"capture-method","youtube-hq");
			Util.setPropsString(desc,"youtube-title",title);
			Util.setPropsString(desc,"icon-url","http://www.youtube.com/favicon.ico");
			try {
				if(this.pbUtils) {
					if(this.pbUtils.privacyContextFromWindow)
						desc.set("loadContext", this.pbUtils.privacyContextFromWindow(window));
					if(this.pbUtils.isWindowPrivate(window)) {
						Util.setPropsString(desc,"private","yes");
						var pbc=channel.QueryInterface(Components.interfaces.nsIPrivateBrowsingChannel);
						pbc.setPrivate(true);
					} else 
						Util.setPropsString(desc,"private","no");
				}
			} catch(e) {
				dump("!!! [YouTubeInfoService] setting loadContext: "+e+"\n");
			}

			var descIndex=0;
			var formats=$this.pref.getCharPref("ythq-formats").split(",");
			var selFormats={};
			for(var i in formats) {
				if(formats[i].length>0) {
					selFormats[formats[i]]=descIndex++;
				}
			}
			
			for(var format in selFormats) {
				if(typeof(variants[format])!="undefined") {
					var url=variants[format].url;
					var desc1=$this.core.cloneEntry(desc);
					Util.setPropsString(desc1,"media-url",url);
					var extension=$this.getExtension(format);
					var fileName=Util.getPropsString(desc,"base-name");
					Util.setPropsString(desc1,"file-name",fileName+"."+extension);
					Util.setPropsString(desc1,"file-extension",extension);
					var title=Util.getPropsString(desc,"youtube-title");
					var prefix=$this.getFormatPrefix(format);
					Util.setPropsString(desc1,"label-prefix",prefix);
					Util.setPropsString(desc1,"label",prefix+title);
					$this.core.addEntryForDocument(desc1,document,window);
					//dump("Added "+prefix+title+"\n");
				}
			}			
		}
		
		
		function StreamListener() {
		}
		StreamListener.prototype={
				QueryInterface: function(iid) {
				    if (!iid.equals(Components.interfaces.nsISupports) && 
				    	!iid.equals(Components.interfaces.nsIStreamListener)) {
				            throw Components.results.NS_ERROR_NO_INTERFACE;
				        }
				    return this;
				},
				onStartRequest: function(request,context) {
					this.httpChannel=request.QueryInterface(Components.interfaces.nsIHttpChannel);
					this.responseStatus=this.httpChannel.responseStatus;
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
					if(this.responseStatus==200) {
						var js;
						try {
							js = JSON.parse(this.data);
						} catch(e) {
							dump("!!! [YouTubeInfoService: cannot JSON decode meta information]: "+e+"\n");
							return;
						}
						videoData.js=js;
						HandleMeta(js)
					} else {
						dump("!!! [YouTubeInfoService]: meta returns "+this.responseStatus+"\n");
						window=window.get();
						document=document.get();
						
						if(!window) {
							dump("!!! [YouTubeInfoService]: window expired\n");
							return;
						}
						if(!document) {
							dump("!!! [YouTubeInfoService]: document expired\n");
							return;
						}
						$this.handleDocumentOriginal(document,window);
					}
				}
			}

		this.videoMapCleanup();
		var videoData=this.videoMap[videoId];
		if(videoData) {
			if(videoData.js)
				HandleMeta(videoData.js);
		} else {
			videoData={
				timestamp: Date.now(),
			};
			$this.videoMap[videoId] = videoData;
			var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				.getService(Components.interfaces.nsIIOService);
			var uri = ioService.newURI("http://www.youtube.com/watch?v="+videoId+"&spf=navigate", null, null);
			var channel = ioService.newChannelFromURI(uri);

			if(this.pref.getBoolPref("yt-meta-referrer")) {
				var referrerURI = ioService.newURI("http://www.youtube.com/results?search_query="+encodeURIComponent(title), null, null);
				var httpChannel = channel.QueryInterface(Components.interfaces.nsIHttpChannel);
				httpChannel.referrer = referrerURI;
			}
			//dump("request meta "+uri.spec+"\n");
			channel.asyncOpen(new StreamListener(), null);
		}
	}
}

YTInfo.prototype.handleDocumentOriginal=function(document,window) {
	try {
		var availFormats={};
		if(/^https?:\/\/[^\/]*\.?youtube\.[^\/\.]+/.test(document.URL)) {
			
			var gotAvailFormat=false;
			var dom=document.documentElement;
			var scripts=Util.xpGetStrings(dom,".//script/text()",{});
			var videoId=null;
			var t=null;
			
			function ExtractFUM(fum) {
				var parts=fum.split(",");
				for(var j in parts) {
					var parts2=parts[j].split("\\u0026");
					var fmts2={}
					var sig=null;
					for(var k in parts2) {
						var pline=decodeURIComponent(parts2[k]);
						var m=/^sig=(.*)/.exec(pline);
						if(m)
							sig=m[1];
						var match2=/^(.*?)=(.*)$/.exec(pline);
						if(match2 && match2.length==3) {
							fmts2[match2[1]]=match2[2];
						}
					}
					if(fmts2['itag'] && fmts2['url']) {
						if(sig!=null)
							fmts2['url']+="&signature="+sig;
						availFormats[fmts2['itag']]=fmts2['url'];
						gotAvailFormat=true;									
					}
				}				
			}
			
			function Extract(script) {
				var match=/fmt_url_map=([^&\\\"]+)/.exec(script);
				if(match!=null && match.length==2) {
					var fum=decodeURIComponent(match[1]);
					var fmts=fum.split(",");
					for(var j in fmts) {
						var m2=/^([0-9]+)\|(.*)/.exec(fmts[j]);
						if(m2 && m2.length==3) {
							availFormats[m2[1]]=m2[2];
							gotAvailFormat=true;
						}
					}
				} else {
					match=/url_encoded_fmt_stream_map": "(.*?)"/.exec(script);
					if(match) {
						var fum=match[1];
						ExtractFUM(fum);
					}
				}				
			}

			for(var i=0;i<scripts.length;i++) {
				var script=scripts[i];
				Extract(script);
			}
			
			if(gotAvailFormat==false) {
				for(var i=0;i<scripts.length;i++) {
					var script=scripts[i];
					var match=/\"fmt_url_map\" *: *\"([^\"]+)\"/.exec(script);
					if(match!=null && match.length==2) {
						var fmts=match[1].replace(/\\\//g,"/").split(",");
						for(var j in fmts) {
							var fmt0=fmts[j].replace(/\\u([0-9]{4})/g,function(str,p1) {
								return String.fromCharCode(parseInt(p1,16));
							});
							var fmt=decodeURIComponent(fmt0);
							var m2=/^([0-9]+)\|(.*)/.exec(fmt);
							if(m2 && m2.length==3) {
								availFormats[m2[1]]=m2[2];
							}
						}
					}
				}
			}

			for(var i=0;i<scripts.length;i++) {
				var script=scripts[i];
				var match=/\"video_id\": \"(.*?)\".*\"t(?:oken)?\": \"(.*?)\"/m.exec(script);
				if(match!=null && match.length==3) {
					videoId=match[1];
					t=match[2];
					break;
				}
				var match=/\"t(?:oken)?\": \"(.*?)\".*\"video_id\": \"(.*?)\"/m.exec(script);
				if(match!=null && match.length==3) {
					videoId=match[2];
					t=match[1];
					break;
				}
			}
			if(videoId==null || t==null) {
				for(var i=0;i<scripts.length;i++) {
					var script=scripts[i];
					var match=/[^_]video_id=([^&]+)(?:&.*)&t=([^&]+)/m.exec(script);
					if(match!=null && match.length==3) {
						videoId=match[1];
						t=match[2];
						break;
					}
					var match=/[&\?]t=(.*?)(?:&|&.*[^_])video_id=(.*?)(?:&|")/m.exec(script);
					if(match!=null && match.length==3) {
						videoId=match[2];
						t=match[1];
						break;
					}
				}
			}
			if(videoId==null || t==null) {
				var embeds=Util.xpGetStrings(dom,".//embed/@src",{});
				for(var i=0;i<embeds.length;i++) {
					var embed=embeds[i];
					var match=/[^_]video_id=(.*?)&.*t=(.*?)(?:&|")/m.exec(embed);
					if(match!=null && match.length==3) {
						videoId=match[1];
						t=match[2];
						break;
					}
				}
				if(videoId==null || t==null) {
					return;
				}
			}
			var title=Util.xpGetString(dom,"/html/head/meta[@name='title']/@content");
			if(title==null || title.length==0) {
				title=Util.xpGetString(dom,".//h3[@id='playnav-restricted-title']/text()");
			}
			if(title==null || title.length==0) {
				title=Util.xpGetString(dom,".//div[@class='content']/div/a/img[@title]/@title");
			}			
			if(title) {
				title=Util.resolveNumericalEntities(title);
				title=title.replace(/"/g,"");
			}
			var url="http://www.youtube.com/get_video?video_id="+videoId+"&t="+t+"&noflv=1&el=detailpage&asv=3&fmt=34";

			var fileName=title;
			var unmodifiedFilename=false;
			try {
				unmodifiedFilename=this.pref.getBoolPref("yt-unmodified-filename");		
			} catch(e) {}
			fileName=fileName.replace(/(?:[\/"\?\*:\|"'\\_]|&quot;|&amp;|&gt;|&lt;)+/g,"_");
			if(unmodifiedFilename==false) {
				var keepSpaces=false;
				try {
					keepSpaces=this.pref.getBoolPref("yt-keep-spaces");
				} catch(e) {}
				if(keepSpaces)
					fileName=fileName.replace(/[^a-zA-Z0-9\.\- ]+/g,"_");
				else
					fileName=fileName.replace(/[^a-zA-Z0-9\.\-]+/g,"_");
				fileName=fileName.replace(/^[^a-zA-Z0-9]+/,"");
				fileName=fileName.replace(/[^a-zA-Z0-9]+$/,"");
			}
			if(title) {
				title=title.replace(/&quot;/g,"\"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">");
			}

			var descs=[]
			var descIndex=0;
			var formats=this.pref.getCharPref("ythq-formats").split(",");
			var selFormats={};
			for(var i in formats) {
				if(formats[i].length>0) {
					selFormats[formats[i]]=descIndex++;
				}
			}
			//dump("selected formats "+JSON.stringify(selFormats)+"\n");

			function StreamListener(desc,service,document,window,availFormats) {
				this.desc=Components.utils.getWeakReference(desc);
				this.service=service;
				this.document=Components.utils.getWeakReference(document);
				this.window=Components.utils.getWeakReference(window);
				this.availFormats=availFormats;
			}

			StreamListener.prototype={
				QueryInterface: function(iid) {
				    if (!iid.equals(Components.interfaces.nsISupports) && 
				    	!iid.equals(Components.interfaces.nsIStreamListener)) {
				            throw Components.results.NS_ERROR_NO_INTERFACE;
				        }
				    return this;
				},
				onStartRequest: function(request,context) {
					this.httpChannel=request.QueryInterface(Components.interfaces.nsIHttpChannel);
					this.responseStatus=this.httpChannel.responseStatus;
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
					if(this.responseStatus==200) {
						var p=this.data.split("&");
						//dump("get info "+JSON.stringify(p)+"\n");
						for(var i in p) {
							var m=/^(.*?)=(.*)$/.exec(p[i]);
							if(m!=null && m.length==3) {
								//dump(m[1]+"="+m[2]+"\n");
								if(m[1]=="fmt_url_map") {
									var fum=decodeURIComponent(m[2]);
									var fmts=fum.split(",");
									for(var j in fmts) {
										var m2=/^([0-9]+)\|(.*)/.exec(fmts[j]);
										if(m2 && m2.length==3) {
											this.availFormats[m2[1]]=m2[2];
										}
									}
								}
							} 
						}
						var desc=this.desc.get();
						var window=this.window.get();
						var document=this.document.get();
						if(desc && window && document) {
							for(var format in selFormats) {
								if(typeof(this.availFormats[format])!="undefined") {
									var url=this.availFormats[format];
									var desc1=this.service.core.cloneEntry(desc);
									Util.setPropsString(desc1,"media-url",url);
									//dump("get info url "+url+"\n");
									var extension=this.service.getExtension(format);
									var fileName=Util.getPropsString(desc,"base-name");
									Util.setPropsString(desc1,"file-name",fileName+"."+extension);
									Util.setPropsString(desc1,"file-extension",extension);
									var title=Util.getPropsString(desc,"youtube-title");
									var prefix=this.service.getFormatPrefix(format);
									Util.setPropsString(desc1,"label-prefix",prefix);
									Util.setPropsString(desc1,"label",prefix+title);
									this.service.core.addEntryForDocument(desc1,document,window);
									//dump("Added "+prefix+title+" for "+url+"\n");
								}
							}
						}
					}
					uri=null;
					channel=null;
				}
			}

			var desc=Components.classes["@mozilla.org/properties;1"].
				createInstance(Components.interfaces.nsIProperties);
			Util.setPropsString(desc,"page-url",document.URL);
			Util.setPropsString(desc,"label",title);
			Util.setPropsString(desc,"base-name",fileName);
			Util.setPropsString(desc,"capture-method","youtube-hq");
			Util.setPropsString(desc,"youtube-title",title);
			Util.setPropsString(desc,"icon-url","http://www.youtube.com/favicon.ico");
			try {
				if(this.pbUtils) {
					if(this.pbUtils.privacyContextFromWindow)
						desc.set("loadContext", this.pbUtils.privacyContextFromWindow(window));
					if(this.pbUtils.isWindowPrivate(window)) {
						Util.setPropsString(desc,"private","yes");
						var pbc=channel.QueryInterface(Components.interfaces.nsIPrivateBrowsingChannel);
						pbc.setPrivate(true);
					} else 
						Util.setPropsString(desc,"private","no");
				}
			} catch(e) {
				dump("!!! [YouTubeInfoService: setting loadContext]: "+e+"\n");
			}
	
			function ExtractAdaptative(fv) {
			    var lines=fv.split("&");
			    var entries=[];
			    for(var i=0;i<lines.length;i++) {
					var line=lines[i];
					var m=/^([^=]+)=(.*)$/.exec(line);
					if(m && (m[1]=="url_encoded_fmt_stream_map" || m[1]=='adaptive_fmts')) {
					    var value=decodeURIComponent(m[2]);
					    var params2=value.split(",");
					    for(var k=0;k<params2.length;k++) {
							var param2=params2[k];
							var params1=param2.split("&");
							var entry={};
							for(var j=0;j<params1.length;j++) {
							    var param1=params1[j];
							    var m1=/^([^=]+)=(.*)$/.exec(param1);
							    if(m1) {
							    	entry[m1[1]]=decodeURIComponent(m1[2]);
							    }
							}
							entries.push(entry);
					    }
					}
			    }
			    return entries;
			}
	
			var gotAdpEntries=false;
			
			var embed=Util.xpGetSingleNode(dom,".//embed");
			if(embed) {
				var flashvars=embed.getAttribute("flashvars");
				var adpEntries=ExtractAdaptative(flashvars);
				if(adpEntries.length>0) {
					var entries=[];
					for(var i=0;i<adpEntries.length;i++) {
						var entry=adpEntries[i];
						if(entry.itag && entry.url) {
							var format=entry.itag;
							var url;
							var sig1=null;
							if(entry.s) {
								try {
									if(this.pref.getBoolPref("yt-log"))
										dump("==> "+entry.itag+" ["+entry.s.length+"] "+entry.s+"\n");
									var sigPerms=[[0,entry.s.length]];
									try {
										sigPerms=JSON.parse(this.pref.getCharPref("yt-sig-perm-"+entry.s.length));
									} catch(e) {
										dump("[YTInfo/ExtractAdaptative] Not found yt perm for "+"yt-sig-perm-"+entry.s.length+"\n");
									}
									var sigParts=[];
									for(var j=0;j<sigPerms.length;j++) {
										var sigPerm=sigPerms[j];
										sigParts.push(entry.s.substring(sigPerm[0],sigPerm[1]));
									}
									var sig=sigParts.join('');
									if(this.pref.getBoolPref("yt-log"))
										dump(">>> "+sig+"\n");
									url=entry.url+="&signature="+sig;
									sig1=sig;
								} catch(e) {
									dump("!!!! [YTInfo/ExtractAdaptative]: "+e+"\n");
								}
							} else if(entry.sig) {
								url=entry.url+="&signature="+entry.sig;								
							} else
								url=entry.url;								
							var desc1=this.core.cloneEntry(desc);
							if(!(format in selFormats))
								Util.setPropsString(desc1,"disabled","disabled");								
							Util.setPropsString(desc1,"media-url",url);
							var extension=this.getExtension(format);
							var fileName=Util.getPropsString(desc,"base-name");
							Util.setPropsString(desc1,"file-name",fileName+"."+extension);
							Util.setPropsString(desc1,"file-extension",extension);
							var title=Util.getPropsString(desc,"youtube-title");
							var prefix=this.getFormatPrefix(format);
							Util.setPropsString(desc1,"label-prefix",prefix);
							Util.setPropsString(desc1,"label",prefix+title);
							if(sig1!=null) {
								var m=/[\?&]id=(.*?)[&$]/.exec(url);
								if(m) {
									Util.setPropsString(desc1,"yt-sig",sig1);
									Util.setPropsString(desc1,"yt-sig0",entry.s);
									Util.setPropsString(desc1,"yt-itag",entry.itag);								
									Util.setPropsString(desc1,"yt-vid",m[1]);
								}
							}
							descs.push(desc1);
							var urlParams=this.extractParams(url);
							entries.push({
								desc: desc1,
								params: urlParams,
								itag: urlParams['itag'],
							});
							gotAdpEntries=true;
						}
					}
				}
			}
	
			if(!gotAdpEntries) {
				var ioService = Components.classes["@mozilla.org/network/io-service;1"]
				                                   .getService(Components.interfaces.nsIIOService);
				var uri = ioService.newURI("http://www.youtube.com/get_video_info?video_id="+videoId+"&fmt=135", null, null);
				var channel = ioService.newChannelFromURI(uri);
				
				channel.asyncOpen(new StreamListener(desc,this,document,window,availFormats), null);
			} else {
				descs.sort(function(d1,d2) {
					var i1;
					try {
						i1=selFormats[Util.getPropsString(d1,"yt-itag")];
					} catch(e) {}
					var i2;
					try {
						i2=selFormats[Util.getPropsString(d2,"yt-itag")];
					} catch(e) {}
					if(i1===undefined && i2===undefined)
						return 0;
					else if(i1!==undefined && i2===undefined)
						return -1;
					else if(i1===undefined && i2!==undefined)
						return 1;
					else
						return i1-i2;
					
				});
				for(var ei=0; ei<descs.length; ei++) {
					this.core.addEntryForDocument(descs[ei],document,window);
				}

			}
		} 
	} catch(e) {
		dump("!!! [YouTubeInfoService] handleDocument("+document.URL+"): "+e+"\n");
	}
	return null;
}

YTInfo.prototype.extractParams=function(url) {
	var urlParams={};
	var urlParts=/^.*?\?(.*)*/.exec(url)[1].split("&");
	var itag="?";
	for(var ui=0;ui<urlParts.length;ui++) {
		var urlPart=urlParts[ui];
		var mui=/^(.*?)=(.*)$/.exec(urlPart);
		urlParams[mui[1]]=mui[2];
	}
	return urlParams;
}

