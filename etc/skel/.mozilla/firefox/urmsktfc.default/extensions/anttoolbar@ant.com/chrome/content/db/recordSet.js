//
// recordSet.js
// firefox
//
// Created by Dmitriy on 2011-02-15
// Copyright 2008-2012 Ant.com. All rights reserved.
//

function AntRecordSet() {
    if ( arguments.length )
        this.init( arguments );
}

AntRecordSet.prototype = {
    init: function(args) {
        this.statement = AntStorage.connection.createStatement(args[0]);

        if (args.length <= 1)
	    return;
	let params = args[1];
	for (let p in params) {
	    if (!params.hasOwnProperty(p))
		continue;
	    try {
		this.statement.params[p] = params[p];
	    } catch (ex) {
		throw new Error("Failed to assign parameter '" + p + "' value '" + args[i] + "'", ex);
	    }
	}
    },

    getNext: function() {
        if ( this.statement.executeStep() ) {
            return this.statement.row;
        }
        return null;
    },

    getColumnList: function() {
        
        var len = this.statement.columnCount;
        var list = [];
        
        for ( var i = 0; i < len; i++ )
            list.push( this.statement.getColumnName(i) );
        
        return list;
    },
    /*
     * executes the query. should be used only once, as it finalizes the statement
     */
    exec: function() {
        
        try {
            this.statement.execute();
        }
        finally {
            this.close();
        }
        
    },
    close: function() {
        
        this.statement.finalize();
    }
}
