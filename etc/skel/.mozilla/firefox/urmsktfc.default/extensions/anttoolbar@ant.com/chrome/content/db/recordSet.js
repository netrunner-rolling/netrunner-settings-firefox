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
        
        //mozilla warning[https://developer.mozilla.org/en/storage]:
        //You should never try to construct SQL statements on the fly with values inserted in them.
        //By binding the parameters, you prevent possible SQL injection attacks since a bound parameter can never be executed as SQL.
        
        var query = args[0];
        this.statement = AntStorage.connection.createStatement(query);
        
        var length = args.length;
        if ( length > 1 ) {
            
            var params = this.statement.params;
            var i = 1;
            
            for (var p in params) {
                params[p] = args[i];
                i++;
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