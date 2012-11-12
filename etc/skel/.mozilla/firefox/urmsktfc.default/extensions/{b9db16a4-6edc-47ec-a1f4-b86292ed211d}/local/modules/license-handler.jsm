/******************************************************************************
 *            Copyright (c) 2006-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperLicenseHandlerService"];

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperLicenseHandlerService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new LicenseHandler();
			}
		} catch(e) {
			dump("!!! [LicenseHandlerService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function LicenseHandler() {
	//dump("[LicenseHandler] constructor\n");
    var uriLoader = Components.classes["@mozilla.org/uriloader;1"].getService(Components.interfaces.nsIURILoader);
    uriLoader.registerContentListener(this);
}

LicenseHandler.prototype = {
		get loadCookie() { return this.mLoadCookie; },
		set loadCookie(newval) { return this.mLoadCookie=newval; },
		get parentContentListener() { return this.mParentContentListener; },
		set parentContentListener(newval) { return this.mParentContentListener=newval; }
}

LicenseHandler.prototype.canHandleContent = function( 
	contentType, 
	isContentPreferred, 
	desiredContentType )  {

	//dump("[LicenseHandler] canHandleContent contentType: "+contentType+"\n");

	if(contentType=="application/x-downloadhelper-license") 
		return true;
	else
		return false;
	
}

LicenseHandler.prototype.doContent = function( 
	contentType , 
	isContentPreferred , 
	request , 
	contentHandler ) {
	
	//dump("[LicenseHandler] doContent contentType: "+contentType+"\n");

	if(contentType!="application/x-downloadhelper-license")
		return false;
		
	function StreamListener() {
		this.outputStream=null;
		this.debugData=false;
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

			try {

			this.httpChannel=request.QueryInterface(Components.interfaces.nsIHttpChannel);
			this.responseStatus=this.httpChannel.responseStatus;
			this.responseStatusText=this.httpChannel.responseStatusText;
			this.contentType=this.httpChannel.getResponseHeader("content-type");			
			this.data="";
			
			//dump("[LicenseHandler/StreamListener] onStartRequest response: "+
			//	this.responseStatus+" "+this.responseStatusText+"\n");

			} catch(e) {
				dump("[LicenseHandler/StreamListener] onStartRequest error: "+e+"\n");	
			}

		},
		onDataAvailable: function(request,context,inputStream,offset,count) {
			//dump("[LicenseHandler/StreamListener] onDataAvailable\n");	

			try {
			
			var sstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
                   .createInstance(Components.interfaces.nsIConverterInputStream);
			sstream.init(inputStream, "utf-8", 256, 
				Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

			var str={};
			var n=sstream.readString(128,str);
			while(n>0) {
				this.data+=str.value;
				//dump("[LicenseHandler/StreamListener] onDataAvailable read: "+str.value+"\n");	
				str={};
				n=sstream.readString(128,str);
			}

			} catch(e) {
				dump("[LicenseHandler/StreamListener] onDataAvailable error: "+e+"\n");	
			}

		},
		onStopRequest: function(request,context,nsresult) {
			//dump("[LicenseHandler/StreamListener] onStopRequest\n");

			try {

			if(this.responseStatus==200) {

				//dump("[LicenseHandler/StreamListener] parsing data: "+this.data+"\n");			
					
				var parser=Components.classes["@mozilla.org/xmlextras/domparser;1"].
					createInstance(Components.interfaces.nsIDOMParser);
				var doc=parser.parseFromString(this.data,"text/xml");
				if(doc!=null) {
					var licenseKey=Util.xpGetString(doc.documentElement,"/downloadhelper-license/license-key");
					//dump("[LicenseHandler/StreamListener] license: "+licenseKey+"\n");
					if(licenseKey!=null) {
						Components.utils['import']("resource://dwhelper/conversion-manager.jsm");
						var convertMgr=ConversionManagerService.get();
						convertMgr.register(licenseKey);
					} else {
						dump("[LicenseHandler/StreamListener] no license key found: "+this.data+"\n");
					}
				} else {
					dump("[LicenseHandler/StreamListener] invalid license file: "+this.data+"\n");
				}
			}
			
			} catch(e) {
				dump("[LicenseHandler/StreamListener] onStopRequest error: "+e+"\n");
			}

		}
	}
	
	try {
		contentHandler.value=new StreamListener();
	} catch(e) {
		dump("[LicenseHandler] openAsync error: "+e+"\n");	
	}
		
	return false;
}

LicenseHandler.prototype.isPreferred = function(contentType, desiredContentType) {
	if(contentType=="application/x-downloadhelper-license") 
		return true;
	else
		return false;

}

LicenseHandler.prototype.onStartURIOpen = function( URI ) {
	return false;
}

LicenseHandler.prototype.GetWeakReference = function( ) {
	return this;
}

LicenseHandler.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.nsIURIContentListener) ||
    	iid.equals(Components.interfaces.nsISupportsWeakReference)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

