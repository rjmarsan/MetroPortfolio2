headerHeight = 75;
currentColumns = 0;

/*
 We wrap all of this in '(function($) {' so that it's all encapsulated.
 In our fancynav, we use a global variable named 'tiles'. If someone else decides to use that, we'd have a conflict.
 But because it's wrapped in this function, we don't have to worry about that.

 We also pass in the $ so we don't get any conflicts if someone decides to mess with $
 (not really an issue - just being overcautious)
*/

(function($) {
    var params = {};
    var data = {};
    var state = { 
        home: false,
        intransition: false,
        currentPair: {},
    };

    var methods = {
        state : function() {
            return state;
        },
    };

    $.fn.fancynav = function( options ) {
        if (methods[options]) { 
            return methods[ options ].apply( this, Array.prototype.slice.call( arguments, 1 ));
        } else {
            params = $.extend( {
                'tilesQuery'     : '.tiles',
                'sidebarQuery'   : '.sidebar',
                'largeQuery'     : '.large',
                'tileElems'      : '.tile-element',
                'sidebarElems'   : '.sidebar-element',
                'largeElems'     : '.large-element',
                'anchorName'     : 'data-anchor',
                'animationLayer' : '.animation-layer',
                'sidebarSelected': 'sidebar-selected',
                'largeSelected'  : 'large-selected',
                'sidebarHome'    : '.homelink',
                'anchorScroll'   : false,         //update page while scrolling
                'doAnimation'    : false,
                'homeCallback'   : function() {},
                'detailsCallback': function() {},

            }, options);

            setup();
        }
        return this;
    };

    var setup = function() {
        /* Some script-wide parameters */
        data.autoScrollFlag = false; //hack - flag to prevent the URL from getting updated when it shouldn't.
        data.tiles = $(params.tilesQuery);
        data.sidebar = $(params.sidebarQuery);
        data.large = $(params.largeQuery);

        /* making a database for all of the elements */
        data.pairs = getPairs($(params.sidebarElems), $(params.tileElems), $(params.largeElems));
        data.lastitem = data.pairs[data.pairs.length-1];

        /* Setting up all of the interactions */
        setupTiles(data.pairs, $(params.animationLayer));
        setupScrolling(data.pairs, params.sidebarSelected, params.largeSelected);
        setupHome($(params.sidebarHome));
        /* event listener for when the back button is pressed */
        window.addEventListener("popstate", pageChange, false);

        /* Read in the current page, and go to it. */
        pageChange();
    };


    /* 
    * Grabs all the [sidebar element, tile element, large element] groups
    * and puts them in a list so we can play with them later 
    */
    var getPairs = function(sidebar, tile, large) {
        var pairs = [];
        sidebar.each(function(index,element) {
            pairs[index] = {};
            pairs[index].sidebar = $(element);
        });
        tile.each(function(index,element) {
            pairs[index].tile = $(element);
        });
        large.each(function(index,element) {
            pairs[index].large = $(element);
        });
        return pairs;
    };


    /*
    * Sets up the interaction when a tile is clicked. does the animation thingie
    */
    var setupTiles = function(pairs, animationlayer) {
        $.each(pairs,function(index,pair) {
            pair.tile.click(function() {
                if (params.doAnimation) {
                    //this is the transition animation
                    var windowtop = $(window).scrollTop();
                    var windowleft = $(window).scrollLeft();
                    var tile = pair.tile;
                    var side = pair.sidebar;
                    var tilex = tile.offset().left - tile.margin().left - tile.padding().left - windowleft;
                    var tiley = tile.offset().top - tile.margin().top - tile.padding().top - windowtop;
                    var sidex = side.offset().left - side.margin().left - side.padding().left - windowleft;
                    var sidey = side.offset().top - side.margin().top - side.padding().top - windowtop;
                    //console.log("tile: ("+tilex+","+tiley+") Sidebar: ("+sidex+","+sidey+")");
                    var clone = pair.tile.clone();
                    //console.log(clone[0].classList);
                    clone.css("position", "absolute");
                    clone.css("top", tiley+"px");
                    clone.css("left", tilex+"px");
                    animationlayer.append(clone);
                    clone.animate({ 
                        "top":sidey, 
                        "left":sidex,
                        "width":side.width(),
                        "height":side.height(),
                        "padding":side.css("padding"),
                        "margin":side.css("margin")
                    }, 500, function() {
                    }).fadeOut(500, function() {
                        clone.remove();
                    });
                }
                actionGoTo(pair, 300, true);
            });
            pair.large.click(function() {
                actionGoTo(pair, 300, true);
            });
        });
    };

    /*
    * The fancy animation/transition from the 'home' view to the 'large' view
    */
    var bringInSidebarAndLarge = function(time) {
        data.tiles.fadeOut(time);
        data.sidebar.dequeue().fadeTo(time, 1);
        data.large.fadeIn(time, function() {
            state.intransition = false;
        });
        state.intransition = true;
        state.home = false;
    };

    /*
    * The fancy animation/transition to the 'home' view from the 'large' view
    * the inverse of above
    */
    var goHome = function() {
        data.tiles.fadeIn(1000);
        data.sidebar.dequeue().fadeTo(1000, 0);
        preventScrollWatchingFor(2000);
        data.large.fadeOut(1000, function() {
            state.intransition = false;
        });
        state.intransition = true;
        state.home = true;
    };




    /*
    * Set up how the user gets 'home'
    */
    var setupHome = function(element) {
        element.click(function(e) {
            actionGoHome();
        });
    }

    /*
    * The actual action of 'going home'
    */
    var actionGoHome = function() {
        removePage();
        goHome();
        params.homeCallback();
    };

    /*
    * The actual action of going to a particular page
    */
    var actionGoTo = function(pair, time, fromuser) {
        bringInSidebarAndLarge(time*2);
        preventScrollWatchingFor(time*4);
        $.scrollTo(pair.large.offset().top-75, time);
        updatePage(pair, fromuser);
        state.currentPair = pair;
        params.detailsCallback(pair);
        onScroll();
    };

    /** Page Events **/

    /*
    * handles what happens when the URL changes
    */
    var pageChange = function(e) {
        var url = window.location.pathname.replace("/","");
        //console.log("New hash: "+url);
        var hasgonesomewhere = false;
        if (url) {
            $.each(data.pairs,function(index,pair) {
                if (pair.large.attr(params.anchorName) == url) {
                    actionGoTo(pair, 300, false);
                    hasgonesomewhere = true;
                }
            });
        }
        if (hasgonesomewhere == false) {
            actionGoHome();
        }
    };

    /*
    * Action to set the URL bar to remove anything but the domain
    */
    function removePage () { 
        var url = window.location.pathname.replace("/","");
        if ("pushState" in history && url) {
            history.pushState({state: 1}, document.title, "/");
        }
    }

    /*
    * Action to update the URL bar to go to a certain page.
    * If it's passed 'foo', and the domain is example.com,
    * the end result will be the URL bar saying example.com/foo
    */
    function updatePage(pair, forceback) {
        var loc = window.location;
        var newhash = pair.large.attr(params.anchorName);
        var curhash = loc.pathname.replace("/","");
        //console.log("Updating hash - current: "+curhash+ " new: "+newhash);
        if (newhash == curhash) {
            //console.log("No need to update");
            return;
        }
        if ("pushState" in history) {
            if (!curhash || forceback) {
                //console.log("new location to "+newhash);
                history.pushState({state: 1}, document.title, newhash);
            } else {
                //console.log("update location to "+newhash);
                history.replaceState({state: 1}, document.title, newhash);
            }
        }
    }


    /** Scrolling **/

    /*
    * Handles what happens for every scroll event
    * This is a tricky bit of code.
    */
    var setupScrolling = function() {
        $(window).scroll(onScroll);
        var pairs = data.pairs;
        $.each(pairs,function(index,pair) {
            pair.sidebar.click(function() {
                actionGoTo(pair, 300, true);
            });
        });
    };
    var onScroll = function() {
        var pairs = data.pairs;
        var selectedClass = params.sidebarSelected;
        var selectedLargeClass = params.largeSelected;
        var selected = false;
        $.each(pairs,function(index,pair) {
            if (selected == false && inRange(pair.large)) {
                selectPair(pair, selectedClass, selectedLargeClass);
                selected = true; //don't select any more than one
                //window.location.hash = pair.large.attr("data-anchor");
                if (params.anchorScroll && !data.autoScrollFlag) updatePage(pair);
            } else {
                unselectPair(pair, selectedClass, selectedLargeClass);
            }
        });
    };
    var unselectPair = function(pair, selectedClass, selectedLargeClass) {
        pair.sidebar.removeClass(selectedClass);
        pair.large.removeClass(selectedLargeClass);
    };
    var selectPair = function(pair, selectedClass, selectedLargeClass) {
        pair.sidebar.addClass(selectedClass);
        pair.large.addClass(selectedLargeClass);

        if (pair != state.highlighted) {
            /* sidebar stuff */
            console.log(pair.sidebar.html());
            var itemtop = pair.sidebar.position().top;
            var itemheight = pair.sidebar.height();
            var containerheight = data.sidebar.height()-headerHeight;
            var itemcenter = itemtop+itemheight;
            var containercenter = containerheight/2;
            var offset = itemcenter - containercenter;
            var lastitemtop = data.lastitem.sidebar.position().top;
            var lastheight = data.lastitem.sidebar.height();
            var totalheight = lastitemtop + lastheight ;
            if (offset + containerheight > totalheight) {
                offset = totalheight-containerheight;
            }
            offset = Math.max(0, offset);
            //offset = Math.max(lastitemtop+lastheight, offset);
            console.log("Offset: "+offset);
            data.sidebar.children(".sidebar-inner").stop(true).animate({"margin-top":-offset},300);


            /* shadows stuff */


            state.highlighted = pair;
        }

    };

    /*
    * Helper function to define what is 'in range' to mark as active
    */
    var inRange = function(elem) {
        var docViewTop = $(window).scrollTop();
        var docViewBottom = docViewTop + $(window).height();
        var docLine = (docViewTop*1+docViewBottom)/2;

        var elemTop = elem.offset().top;
        var elemBottom = elemTop + elem.height();
        // THIS NEEDS TO BE MORE COMPLICATED
        return ((elemBottom >= docLine) && (elemTop <= docLine));
    };

    /*
    * Hack.
    */
    var preventScrollWatchingFor = function(millis) {
        data.autoScrollFlag = true;
        setTimeout(function() { data.autoScrollFlag = false; }, millis);
    };




})(jQuery);




/**
* So this is when we actually use it
**/
$(function() {
    var recheckTopbar = setupTopBar();
    watchColumns(function() { recheckTopbar(true) });
    var wentHome = function() { 
        recheckTopbar();
    };
    var wentDetails = function(pair) { 
        recheckTopbar();
    };
    $().fancynav({
        "homeCallback": wentHome,
        "detailsCallback": wentDetails,
    });
});


var watchColumns = function(columnsCallback) {
    var cols = [Infinity, 1595, 1345, 1095, 855, 594];

    var watcher = function() {
        var width = $(window).width();
        var smallestcol = cols.length + 1;
        $.each(cols, function(index, elem) {
            if (width < elem) {
                smallestcol = index;
            }
        });
        var newColumns = cols.length - smallestcol;
        if (newColumns != currentColumns) {
            currentColumns = newColumns;
            columnsCallback();
        }
        currentColumns = newColumns;
    }

    $(window).resize(watcher);

    watcher();

}

var setupTopBar = function() {
    var tiles = $(".tiles");
    var topbar = $("header");
    var attop = true;
    var time = 600;
    var firsttop = 0;
    var lasttop = 0;
    var lastdown = false;
    var topBarFixed = function(top) {
        if (attop == false) { 
            topbar.stop(true).animate({"background-color": "rgba(255,255,255,0)", "boxShadowBlur": "0px"}, time);
            topbar.css("border-bottom-style", "dotted");
            topbar.css({"top":0});
            attop = true;
        }
    };
    var topBarHover = function(top) {
        if (attop == true) {
            topbar.stop(true).animate({"background-color": "rgba(250,250,250,0.96)", "boxShadowBlur":"15px"}, time);
            topbar.css("border-bottom-style", "solid");
            attop = false;
        }
    };

    var topBarPeek = function(top, actuallymove) {
        //console.log("Top: "+top);
        if (actuallymove == false || (lasttop < top && lastdown == false) ) {
            firsttop = top;
            lastdown = true;
        } else if (lasttop > top && lastdown == true) {
            lastdown = false;
            var newtop = top - topbar.height();
            firsttop = Math.max(newtop, firsttop);
            firsttop = Math.max(0, firsttop);
        }
        lasttop = top;
        var topdist = lasttop - firsttop;
        topdist = Math.max(0, topdist);
        if (actuallymove) topbar.css({"top":-topdist});
    };
    var topBarNotPeak = function() {
        topbar.css({"top":0});
    };

    var checkScrollTiles = function() {
        if ($().fancynav("state").home == false) return;
        //console.log("Tiles scroll");
        var top = tiles.scrollTop();
        if (top <= 0) {
            topBarFixed(top);
        } else {
            topBarHover(top);
        }
        topBarNotPeak();
    };
    var checkScrollWindow = function(butdontmove) {
        if ($().fancynav("state").home == true) return;
        //console.log("Window scroll");
        var top = $(window).scrollTop();
        if (top <= 0) {
            topBarFixed(top);
        } else {
            topBarHover(top);
            if (currentColumns <= 2) {
                if (!butdontmove && $().fancynav("state").intransition == false)
                    topBarPeek(top, true);
                else
                    topBarPeek(top, false);
            } else {
                topBarNotPeak();
            }
        }
    };

    tiles.scroll(checkScrollTiles);
    $(window).scroll(function() {
        checkScrollWindow();
    });

    var recheck = function(dontmove) {
        checkScrollTiles();
        checkScrollWindow(dontmove);
    }

    return recheck;
}
