// 
//  tree.js
//  firefox
//  
//  Created by Dima on 2011-02-18.
//  Contributor Brian King
//  Copyright 2008-2012 Ant.com. All rights reserved.
//


var AntTree = function( treeId, treeChId ) {
    
    this.init(treeId, treeChId);
};

AntTree.prototype = {
    
    init: function(aTreeId) {
        
        this.mainTree = document.getElementById( aTreeId );
        this.mainTreeCh = document.getElementById( aTreeId + '-ch' );
    },
    start: function(aData, aModel, aAttachData) {
        
        this.data = aData;
        
        var model           = aModel;
        this.columns        = model.columns;
        this.getPlaylist    = model.playList;
        this.allPlaylists   = model.allPlaylists;
        this.isVisible      = undefined;
        if ( aAttachData )
            this.attachData = aAttachData;
        else
            this.attachData = true;
    },
    cellCreator: function(vFunc, data) {
    
        var cell = document.createElement("treecell");
        cell.setAttribute("label", vFunc(data));
        return cell;
    },
    rowCreator: function(dataI) {
    
        var category = this.getPlaylist(dataI);
        var plChildren = this.allPlaylists[category];
        
        var i = plChildren.childNodes.length;
        var item = document.createElement("treeitem");
        item.id = plChildren.id + "-treeitem" + i;
        
        var row = document.createElement("treerow");
        row.id = item.id + "-row" + i;
        
        for ( var j = 0; j < this.columns.length; j++) {
            
            var cell = this.cellCreator( this.columns[j], dataI );
            cell.id = row.id + "-cell" + j;
            
            row.appendChild(cell);
        }
        
        if ( dataI.UIitem ) {
            var prop = dataI.UIitem.firstChild.firstChild.getAttribute('properties');
            if ( prop )
                row.firstChild.setAttribute( 'properties', prop );
        }
        
        if ( this.attachData ) {
            item.antLinkedObject = dataI;
            dataI.UIitem = item;
        }
        
        item.appendChild(row);
        item.dataI = dataI;
        plChildren.appendChild(item);
    },
    apply: function(removeOld, restoreScroll) {
        
        var box = this.mainTree.treeBoxObject;
        //by default - restoring
        var scrollPos = restoreScroll !== false ? box.getFirstVisibleRow() : 0;
        
        if ( removeOld ) {
            var childs = this.mainTreeCh.childNodes;
            while ( childs.length ) {
                
                this.mainTreeCh.removeChild( childs[0] );
            }
        }
        
        if ( this.filtered ) {
            
            for ( var i = 0; i < this.data.length; i++ ) {
                
                var item = this.data[i];
                if ( this.isVisible(item) ) {
                    this.mainTreeCh.appendChild( item.UIitem );
                }
                else {
                    
                    var parentNode = item.UIitem.parentNode;
                    if ( parentNode )
                        parentNode.removeChild( item.UIitem );
                }
            }
        }
        else {
            
            this.fillCategories();
            for ( var i = 0; i < this.data.length; i++ ) {
                var dataI = this.data[i];
                this.rowCreator(dataI);
            }
        }
        
        box.scrollToRow( scrollPos );
    },
    filter: function(isVisible) {
        
        this.isVisible = isVisible;
        this.apply(true, false);
    },
    get filtered() {
        
        return this.isVisible != null;
    },
    get visibleItems() {
        
        if ( !this.filtered )
            return this.data.slice(0);
        
        var chs = this.mainTreeCh.childNodes;
        var retArr = [];
        for ( var i = 0; i < chs.length; i++ ) {
            
            retArr.push( chs[i].antLinkedObject );
        }
        
        return retArr;
    },
    nextSibling: function(item, prev) {
        
        var prop = prev ? 'previousSibling' : 'nextSibling';
        while ( (item = item[prop]) ) {
            
            if ( !(item.getAttribute('hidden') == 'true') )
                break;
        }
        
        return item;
    },
    firstInList: function(item, first) {
        
        var plNode = item.UIitem.parentNode;
        if ( !plNode )
            plNode = this.mainTreeCh;
        var chNodes = plNode.childNodes;
        
        return first ? chNodes[0] : chNodes[chNodes.length - 1];
    },
    fillCategories: function() {
        
        var cats = [];
        for ( prop in this.allPlaylists ) {
            
            cats.push( prop );
        }
        
        cats.sort( function(a, b) {
                       
                       var a1 = a.toLowerCase();
                       var b1 = b.toLowerCase();
                       
                       if ( a1 < b1 )
                        return -1;
                       else if ( a1 > b1 )
                        return 1;
                       
                       return 0;
                   }
        );
        
        for ( var i = 0; i < cats.length; i++ ) {
            
            var catName = cats[i];
            var catNode = this.createCategoryNode( catName, i );
            this.allPlaylists[catName] = catNode;
            this.mainTreeCh.appendChild( catNode.parentNode );
        }
    },
    getPlaylistNode: function(title) {
        
        var mainItems = this.mainTreeCh.childNodes;
        var catCount = mainItems.length;
        for ( var i = 0; i < catCount; i++ ) {
            
            var curItemId = mainItems[i].id;
            var cell = document.getElementById( curItemId + '-row-cell' );
            if ( cell.getAttribute('label') == title )
                return document.getElementById( curItemId + '-ch' );
        }
        
        return null;
    },
    getCategoriesList: function() {
        
        var playlists = [];
        var mainItems = this.mainTreeCh.childNodes;
        var catCount = mainItems.length;
        for ( var i = 0; i < catCount; i++ ) {
            
            var curItemId = mainItems[i].id;
            var cell = document.getElementById( curItemId + '-row-cell' );
            
            playlists.push( cell.getAttribute('label') );
        }
        
        return playlists;
    },
    createCategoryNode: function(title, index) {
        
        var mainItems = this.mainTreeCh.childNodes;
        if ( index === undefined )
            index = mainItems.length;
            
        var mainItemId = this.mainTreeCh.id + '-item' + index;
        
        var mainItem = document.createElement( 'treeitem' );
        mainItem.id = mainItemId;
        mainItem.setAttribute( 'container', true );
        mainItem.setAttribute( 'open', true );
        
        var treeRow = document.createElement( 'treerow' );
        treeRow.id = mainItemId + '-row';
        
        var treeCell = document.createElement( 'treecell' );
        treeCell.id = treeRow.id + '-cell';
        treeCell.setAttribute( 'label', title );
        
        treeRow.appendChild( treeCell );
        mainItem.appendChild( treeRow );
        
        var plChildren = document.createElement( 'treechildren' );
        plChildren.id = mainItemId + '-ch';
        mainItem.appendChild( plChildren );
        
        return plChildren;
    },
    addNewCategory: function(title, check) {
        
        if ( check ) {
            
            var item = this.getPlaylistNode(title);
            if ( item )
                return item;
        }
        
        var children = this.createCategoryNode( title );
        this.mainTreeCh.appendChild( children.parentNode );
        
        return children;
    }
}