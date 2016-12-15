// 
//  array.js
//  firefox
//  
//  Created by Zak on 2008-07-03.
//  Copyright 2008-2016 Ant.com. All rights reserved.
// 

//AntList functionality in procedural style due to some problems with push in FF 4.0b8
AntArray = {
    
    remove: function(arr, value) {
        
        for ( var i in arr ) {
            
            if ( arr[i] == value ) {
                
                arr.splice(i, 1);
                break;
            }
        }
    },
    exists: function(arr, value) {
        
        for ( var i in arr ) {
            
            if ( arr[i] == value )
                return true;
        }
        
        return false;
    },
    identical: function(arr1, arr2) {
		
		if ( arr1.length != arr2.length )
			return false;
		
		for ( var i = 0; i < arr1.length; i++ ) {
			
			if ( arr1[i] != arr2[i] )
				return false;
		}
		
		return true;
	}
}