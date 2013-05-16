/******************************************************************************
 *            Copyright (c) 2008-2011 Michel Gutierrez. All Rights Reserved.
 ******************************************************************************/

EXPORTED_SYMBOLS=["DWHelperConvConfHandlerService"];

/**
 * Constants.
 */
const DHNS = "http://downloadhelper.net/1.0#";

Components.utils['import']("resource://dwhelper/util-service.jsm");

var DWHelperConvConfHandlerService = {
	mProcessor: null,
	start: function() { this.get(); },
	get: function() {
		try {
			if(this.mProcessor==null) {
				this.mProcessor=new ConvConfHandler();
			}
		} catch(e) {
			dump("!!! [ConvConfHandlerService] "+e+"\n");
		}
		return this.mProcessor;
	}
}

/**
* Object constructor
*/
function ConvConfHandler() {
	this.localstore=Components.classes["@mozilla.org/rdf/datasource;1?name=local-store"]
	                                   .getService(Components.interfaces.nsIRDFDataSource);
	this.promptService=Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
	                          			.getService(Components.interfaces.nsIPromptService);
    var uriLoader = Components.classes["@mozilla.org/uriloader;1"].getService(Components.interfaces.nsIURILoader);
    uriLoader.registerContentListener(this);
}

ConvConfHandler.prototype = {
		get loadCookie() { return this.mLoadCookie; },
		set loadCookie(newval) { return this.mLoadCookie=newval; },
		get parentContentListener() { return this.mParentContentListener; },
		set parentContentListener(newval) { return this.mParentContentListener=newval; }
}

ConvConfHandler.prototype.canHandleContent = function( 
	contentType, 
	isContentPreferred, 
	desiredContentType )  {

	//dump("[ConvConfHandler] canHandleContent contentType: "+contentType+"\n");

	if(contentType=="application/x-downloadhelper-convconf") 
		return true;
	else
		return false;
	
}

ConvConfHandler.prototype.doContent = function( 
	contentType , 
	isContentPreferred , 
	request , 
	contentHandler ) {
	
	//dump("[ConvConfHandler] doContent contentType: "+contentType+"\n");

	if(contentType!="application/x-downloadhelper-convconf")
		return false;
		
	function StreamListener(service) {
		this.outputStream=null;
		this.debugData=false;
		this.service=service;
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
			
			//dump("[ConvConfHandler/StreamListener] onStartRequest response: "+
			//	this.responseStatus+" "+this.responseStatusText+"\n");

			} catch(e) {
				dump("[ConvConfHandler/StreamListener] onStartRequest error: "+e+"\n");	
			}

		},
		onDataAvailable: function(request,context,inputStream,offset,count) {
			//dump("[ConvConfHandler/StreamListener] onDataAvailable\n");	

			try {
			
			var sstream = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
                   .createInstance(Components.interfaces.nsIConverterInputStream);
			sstream.init(inputStream, "utf-8", 256, 
				Components.interfaces.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER);

			var str={};
			var n=sstream.readString(128,str);
			while(n>0) {
				this.data+=str.value;
				//dump("[ConvConfHandler/StreamListener] onDataAvailable read: "+str.value+"\n");	
				str={};
				n=sstream.readString(128,str);
			}

			} catch(e) {
				dump("[ConvConfHandler/StreamListener] onDataAvailable error: "+e+"\n");	
			}

		},
		onStopRequest: function(request,context,nsresult) {
			//dump("[ConvConfHandler/StreamListener] onStopRequest\n");

			try {

			if(this.responseStatus==200) {

				//dump("[ConvConfHandler/StreamListener] parsing data: "+this.data+"\n");			
					
				var parser=Components.classes["@mozilla.org/xmlextras/domparser;1"].
					createInstance(Components.interfaces.nsIDOMParser);
				var doc=parser.parseFromString(this.data,"text/xml");
				if(doc!=null) {
					var confNodes=Util.xpGetNodes(doc.documentElement,"/conversion-configs/conversion-config",{});
					for(var i=0;i<confNodes.length;i++) {
						var confNode=confNodes[i];
						var confValue=Util.xpGetString(confNode,"value/text()");
						var confLabel=Util.xpGetString(confNode,"label/text()");
						//dump("=>"+confLabel+" = "+confValue+"\n");
						var gotConf=false;
						var confs=Util.getChildResourcesS(this.service.localstore,DHNS+"conv-confs",{});
						for(var i=0;i<confs.length;i++) {
							var confValue0=Util.getPropertyValueRS(this.service.localstore,confs[i],DHNS+"value");
							if(confValue0==confValue) {
								gotConf=true;
								var confLabel0=Util.getPropertyValueRS(this.service.localstore,confs[i],DHNS+"label");
								if(confLabel0==confLabel) {
									this.service.promptService.alert(null,Util.getText("title.conv-conf-handler"),
											Util.getFText("message.conv-conf.already-exist",[confLabel],1));
								} else {
									var r=this.service.promptService.confirm(null,Util.getText("title.conv-conf-handler"),
											Util.getFText("message.conv-conf.rename",[confLabel,confLabel0],2));
									if(r) {
										Util.setPropertyValueRS(this.service.localstore,confs[i],DHNS+"label",confLabel);
									}
								}
							}
						}
						if(gotConf==false) {
							var r=this.service.promptService.confirm(null,Util.getText("title.conv-conf-handler"),
									Util.getFText("message.conv-conf.create",[confLabel],1));
							if(r) {
								var conf=Util.createNodeSR(this.service.localstore,DHNS+"conv-confs",null);
								Util.setPropertyValueRS(this.service.localstore,conf,DHNS+"label",confLabel);
								Util.setPropertyValueRS(this.service.localstore,conf,DHNS+"value",confValue);
							}
						}
					}
				} else {
					dump("[ConvConfHandler/StreamListener] invalid convconf file: "+this.data+"\n");
				}
			}
			
			} catch(e) {
				dump("[ConvConfHandler/StreamListener] onStopRequest error: "+e+"\n");
			}

		}
	}
	
	try {
		contentHandler.value=new StreamListener(this);
	} catch(e) {
		dump("[ConvConfHandler] openAsync error: "+e+"\n");	
	}
		
	return false;
}

ConvConfHandler.prototype.isPreferred = function( 
	contentType , 
	desiredContentType ) {

	dump("[ConvConfHandler] isPreferred contentType: "+contentType+"\n");

	if(contentType=="application/x-downloadhelper-convconf") 
		return true;
	else
		return false;

}


ConvConfHandler.prototype.onStartURIOpen = function( URI ) {

	//dump("[ConvConfHandler] onStartURIOpen: "+URI.spec+"\n");

	return false;
}

ConvConfHandler.prototype.GetWeakReference = function( ) {

	//dump("[ConvConfHandler] GetWeakReference\n");

	return this;
}

ConvConfHandler.prototype.QueryInterface = function(iid) {
    if (iid.equals(Components.interfaces.nsISupports) || 
       	iid.equals(Components.interfaces.nsIURIContentListener) ||
    	iid.equals(Components.interfaces.nsISupportsWeakReference)
    	) {
    		return this;
        }
    throw Components.results.NS_ERROR_NO_INTERFACE;
}

