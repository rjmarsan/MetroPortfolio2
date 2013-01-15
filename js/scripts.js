DEBUG = false;
function dlog(msg) {
    if (DEBUG && 'console' in window) 
        console.log(msg);
}



headerHeight = 75;
currentColumns = 0;
var cols = [Infinity, 1345, 1095, 855, 595];
var colSizes = [1270, 1025, 780, 535, 290];
currentWidth = 0;
currentDisplayWidth = 0;
overflowHack = false;

/*
 We wrap all of this in '(function($) {' so that it's all encapsulated.
 In our fancynav, we use a global variable named 'tiles'. If someone else decides to use that, we'd have a conflict.
 But because it's wrapped in this function, we don't have to worry about that.

 We also pass in the $ so we don't get any conflicts if someone decides to mess with $
 (not really an issue - just being overcautious)
*/

(function($) {
    var params = {};
    var data = {
        scrollPageTimeout: 0,
    };
    var state = { 
        home: false,
        intransition: false,
        currentPair: {},
        highlighted: null,
    };

    var methods = {
        state : function() {
            return state;
        },
        setAnimations : function(should) {
            params.doAnimation = should;
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
                'anchorScroll'   : true,         //update page while scrolling
                'doAnimation'    : false,
                'doAnimationFunc': function() {return params.doAnimation},
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
        data.animationLayer = $(params.animationLayer);

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
                if (params.doAnimationFunc()) {
                    //this is the transition animation
                    var windowtop = $(window).scrollTop();
                    var windowleft = $(window).scrollLeft();
                    var tile = pair.tile;
                    var side = pair.sidebar;
                    var tilex = tile.offset().left - tile.margin().left - tile.padding().left - windowleft;
                    var tiley = tile.offset().top - tile.margin().top - tile.padding().top - windowtop;
                    var sidex = side.offset().left - side.margin().left - side.padding().left - windowleft;
                    var sidey = side.position().top - side.margin().top - side.padding().top - windowtop + 90;
                    //dlog("tile: ("+tilex+","+tiley+") Sidebar: ("+sidex+","+sidey+")");
                    var clone = pair.tile.clone();
                    //dlog(clone[0].classList);
                    clone.css("position", "absolute");
                    clone.css("top", (tiley-data.animationLayer.offset().top)+"px");
                    clone.css("left", tilex+"px");
                    animationlayer.append(clone);
                    clone.animate({ 
                        "top":sidey, 
                        "left":sidex,
                        "width":side.width(),
                        "height":side.height(),
                        "padding":side.css("padding"),
                        "margin":side.css("margin"),
                        "border-width":0,
                    }, 500, function() {
                        clone.fadeOut(500, function() {
                            clone.remove();
                        });
                    });
                }
                actionGoTo(pair, 300, true);
            });
            //pair.large.click(function() {
                //actionGoTo(pair, 300, true);
            //});
        });
    };

    /*
    * The fancy animation/transition from the 'home' view to the 'large' view
    */
    var bringInSidebarAndLarge = function(time) {
        data.tiles.fadeOut(time);
        data.sidebar.stop(true, false).fadeTo(time, 0.99);
        state.intransition = true;
        data.large.fadeIn(time, function() {
            state.intransition = false;
        });
        state.home = false;
    };

    /*
    * The fancy animation/transition to the 'home' view from the 'large' view
    * the inverse of above
    */
    var goHome = function() {
        data.tiles.fadeIn(1000);
        data.sidebar.stop(true, false).fadeTo(1000, 0.00);
        preventScrollWatchingFor(2000);
        state.intransition = true;
        data.large.fadeOut(1000, function() {
            state.intransition = false;
        });
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
        state.intransition = true;
        $.scrollTo(pair.large.offset().top-75, time, {onAfter:function() {
            setTimeout(function() {
                state.intransition = false;
                dlog("onAfter");
            }, 200);
        }});
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
        if (url.toLowerCase() == "resume") {
            window.location = "files/metro_resume.pdf";
        }
        //dlog("New hash: "+url);
        var hasgonesomewhere = false;
        if (url) {
            $.each(data.pairs,function(index,pair) {
                if (pair.large.attr(params.anchorName).toLowerCase() == url.toLowerCase()) {
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
        //dlog("Updating hash - current: "+curhash+ " new: "+newhash);
        if (newhash == curhash) {
            //dlog("No need to update");
            return;
        }
        if ("pushState" in history) {
            if (!curhash || forceback) {
                //dlog("new location to "+newhash);
                history.pushState({state: 1}, document.title, newhash);
            } else {
                //dlog("update location to "+newhash);
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
                if (params.anchorScroll && !data.autoScrollFlag) {
                    clearTimeout(data.scrollPageTimeout)
                    data.scrollPageTimeout = setTimeout(function() {
                        if (state.home == false && state.intransition == false && pair == state.highlighted)
                            updatePage(pair, false);
                    }, 1000);
                }
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
            dlog(pair.sidebar.html());
            var itemtop = pair.sidebar.position().top;
            var itemheight = pair.sidebar.height();
            var containerheight = data.sidebar.height()-headerHeight-30;
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
            dlog("Offset: "+offset);
            /*
            if (state.intransition) {
                data.sidebar.children(".sidebar-inner").stop(true, false).delay(5000).animate({"margin-top":-offset},300);
            } else {
                data.sidebar.children(".sidebar-inner").stop(true, false).delay(5000).animate({"margin-top":-offset},300);
            }
            */
            data.sidebar.children(".sidebar-inner").stop(true, false).animate({"margin-top":-offset},300);
            data.animationLayer.stop(true, false).animate({"margin-top":-offset},300);


            /* shadows stuff */
            pair.large.children(".shadowbefore, .shadowafter").css("opacity", 0.99);
            pair.large.css({"background-color":"#fff"});
            if (state.highlighted) {
                state.highlighted.large.children(".shadowbefore, .shadowafter").css("opacity", 0);
                state.highlighted.large.css({"background-color":"#f1f1f1"});
            }


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
    fixHeader();
    fixHomeOverflow();
    var recheckTopbar = setupTopBar();
    watchColumns(function() { 
        recheckTopbar(true) 
    });
    var recheckFluidHeader = fluidHeader();
    var fluidimgs = fluidImages();
    var wentHome = function() { 
        recheckTopbar();
        resizeHeader();
        recheckFluidHeader();
    };
    var wentDetails = function(pair) { 
        recheckTopbar();
        resizeHeader();
        recheckFluidHeader();
    };
    $().fancynav({
        "homeCallback": wentHome,
        "detailsCallback": wentDetails,
        "doAnimationFunc": function() { return !isMobile() },
    });
    recheckSite(fluidimgs, recheckFluidHeader);
    addClickToTouch();
});
$(window).load(function() {
    $('.flexslider').flexslider({
        slideshow: false,
        controlNav: true,
        smoothHeight: false,
    });
    removeImageHeights();
});


var watchColumns = function(columnsCallback) {

    var watcher = function() {
        var width = $(window).width();
        var smallestcol = cols.length + 1;
        $.each(cols, function(index, elem) {
            if (width < elem) {
                smallestcol = index;
            }
        });
        var newColumns = cols.length - smallestcol;
        //dlog("New column: "+newColumns);
        if (newColumns != currentColumns) {
            currentColumns = newColumns;
            columnsCallback();
        }
        currentColumns = newColumns;
        currentWidth = colSizes[smallestcol];
    }

    $(window).resize(watcher);

    watcher();

}

var setupTopBar = function() {
    var tiles = $(".tiles");
    var topbar = $("header");
    var attop = true;
    var time = 300;
    var firsttop = 0;
    var lasttop = 0;
    var lastdown = false;
    var topBarFixed = function(top) {
        if (attop == false) { 
            topbar.stop(true).css({"background-color": "rgba(241,241,241,0.96)", "boxShadowBlur": "0px"});
            //fallback for no css animations topbar.stop(true).animate({"background-color": "rgba(241,241,241,0.96)", "boxShadowBlur": "0px"}, time);
            topbar.css("border-bottom-style", "dotted");
            topbar.css({"top":0});
            attop = true;
        }
    };
    var topBarHover = function(top) {
        if (attop == true) {
            topbar.stop(true).css({"background-color": "rgba(250,250,250,0.96)", "boxShadowBlur":"15px"}); //super quick
            //fallback for no css animations topbar.stop(true).animate({"background-color": "rgba(250,250,250,0.96)", "boxShadowBlur":"15px"}, 10); //super quick
            topbar.css("border-bottom-style", "solid");
            attop = false;
        }
    };

    var topBarPeek = function(top, actuallymove) {
        dlog("Top: "+top);
        top = Math.max(0, top);
        if (actuallymove == false || (lasttop < top && lastdown == false) ) {
            dlog("Setting the top when we scroll down");
            if (actuallymove == true &&  firsttop < top && firsttop+topbar.height() > top) {
                dlog("Dont move it right now");
            } else {
                firsttop = top;
            }
            lastdown = true;
        } else if (lasttop > top && lastdown == true) {
            dlog("Setting the new top when we scroll up");
            lastdown = false;
            var newtop = top - topbar.height();
            firsttop = Math.max(newtop, firsttop);
            firsttop = Math.max(0, firsttop);
        }
        lasttop = top;
        var topdist = lasttop - firsttop;
        topdist = Math.max(0, topdist);
        //if (actuallymove) 
            topbar.css({"top":-topdist});
    };
    var topBarNotPeak = function() {
        topbar.css({"top":0});
    };

    var checkScrollTiles = function() {
        if ($().fancynav("state").home == false) return;
        dlog("Tiles scroll");
        var top = tiles.scrollTop();
        if (overflowHack) top = $(window).scrollTop();
        if (top <= 0) {
            topBarFixed(top);
        } else {
            topBarHover(top);
        }
        topBarNotPeak();
    };
    var checkScrollWindow = function(butdontmove) {
        if ($().fancynav("state").home == true) return;
        dlog("Window scroll");
        var top = $(window).scrollTop();
        //if (top <= 0) {
        //    topBarFixed(top);
        //} else {
            topBarHover(top);
            if (isMobile()) {
                if (!butdontmove && $().fancynav("state").intransition == false)
                    topBarPeek(top, true);
                else
                    topBarPeek(top, false);
            } else {
                topBarNotPeak();
            }
        //}
    };

    tiles.scroll(checkScrollTiles);
    $(window).scroll(function() {
        checkScrollWindow();
        if (overflowHack) //well now it might be the tiles too
            checkScrollTiles();
    });
    document.addEventListener('touchmove', function(event) {
        checkScrollWindow();
        if (overflowHack) //well now it might be the tiles too
            checkScrollTiles();
    }, false);


    var recheck = function(dontmove) {
        checkScrollTiles();
        checkScrollWindow(dontmove);
    }

    return recheck;
}




var fixHeader = function() {
    var initialmaxwidth = 354;//0;
    var lastcomputedtextsize = 0;
    var lastcomputedcount = 0;
    var resize = function() {
        var windowwidth = $(window).width();
        var left = $(".metroname");
        var right = $(".links");
        var r1 = $(".resume");
        var r2 = $(".slashslash");
        var r3 = $(".email");
        var theirsize = left.outerWidth(true)+right.outerWidth(true);
        if (initialmaxwidth == 0) {
            dlog("New initial max width: "+theirsize);
            initialmaxwidth = theirsize;
        }
        dlog("Window width: "+windowwidth+ " computedwidth: "+theirsize);

        var maxsizeleft = 23;
        var maxsizeright = 18;
        var maxlmarginleft = 30;
        var maxlmarginright = 22;
        var maxrmargin = 30;
        var maxslashpaddingr = 10;
        var maxslashpaddingl = 10;

        var margins = maxlmarginleft + maxlmarginright + maxrmargin + maxslashpaddingr + maxslashpaddingl;

        var sizeleft = 23;
        var sizeright = 18;
        var lmarginleft = left.margin().left;
        var lmarginright = left.margin().right;
        var rmargin = right.margin().right;
        var slashpaddingr = r2.padding().right;
        var slashpaddingl = r2.padding().left;


        sizeleft      = Math.min(maxsizeleft, windowwidth * (23/initialmaxwidth));
        sizeright     = Math.min(maxsizeright, windowwidth * (18/initialmaxwidth));
        left.css("font-size",sizeleft+"px");
        right.css("font-size",sizeright+"px");
        theirsize = left.outerWidth(true)+right.outerWidth(true); //get an updated size



        var textsize = left.width() + r1.width() + r2.width() + r3.width() + lmarginright;//+ lmarginright + 5; //a bit extra to account for rounding
        dlog("Text takes up "+textsize);
        var scaleby = (windowwidth - textsize) / ((textsize+margins) - textsize); //overflow pixels / pixels that we can change
        dlog("Scale by: "+scaleby);
        if (textsize != lastcomputedtextsize) {
            lastcomputedcount = 0;
            lastcomputedtextsize = textsize;
        }
        lastcomputedcount += 1;
        if (lastcomputedcount > 5) {
            dlog("Recomputing same thing more than 5 times. this isn't healthy");
            return; 
        }


        
        lmarginleft   = Math.floor(Math.min(maxlmarginleft, maxlmarginleft * scaleby));
        //lmarginright  = Math.min(maxlmarginright, lmarginright * scaleby);
        rmargin       = Math.floor(Math.min(maxrmargin, maxrmargin * scaleby));
        slashpaddingr = Math.floor(Math.min(maxslashpaddingr, maxslashpaddingr * scaleby));
        slashpaddingl = Math.floor(Math.min(maxslashpaddingl, maxslashpaddingl * scaleby));
        left.css("margin-left",lmarginleft);
        left.css("margin-right",lmarginright);
        right.css("margin-right",rmargin);
        r2.css("padding-right",slashpaddingr);
        r2.css("padding-left",slashpaddingl);
        

    };
    var resizetwice = function() {
        resize();
        setTimeout(resize, 100);
    }
    $(window).resize(resizetwice);
    resizetwice();
    window.resizeHeader = resizetwice;
    return resizetwice;
};



var fluidHeader = function() {
    var header = $(".header-wrapper");
    var lastwidth = 0;
    var fluid = function() {
        var width = $(window).width();

        //super small. we should just ignore it.
        if (currentColumns == 1) {
            //if (header.css("width") != "100%") {
            //    header.stop(true, false).animate({"width":width}, 300, function() {
                    header.css("width", "100%");
            //    });
            //}


        } else if ($().fancynav("state").home) {
            if (currentWidth != lastwidth) header.css({"width":currentWidth});
            //dlog("Resizing to "+currentWidth);
            lastwidth = currentWidth;
        } else {
            if (currentDisplayWidth != lastwidth) header.css({"width":currentDisplayWidth});
            dlog("Resizing to "+width);
            lastwidth = currentDisplayWidth;
        }




    };

    var waitForDOM = function() {
        setTimeout(fluid, 200);
    };

    $(window).resize(fluid);


    waitForDOM();

    return waitForDOM;

};


var isMobile = function() {
    var width = $(window).width();
    var height = $(window).height();
    if (width <= 595 || (width <= 855 && height <= 700) ) return true;
    return false;
};


var fluidImages = function() {
    var header = $("header");
    var sampleelem = $(".large-element-inner:first");
    var lastwidth = 0;
    var elements = $(".large-element-inner");
    var setmaxheight = function() {
        var height = $(window).height();
        var padding = header.height() + 50;
        var maxheight = height-padding;
        var maxheight = Math.max(maxheight, 250);
        var maxwidth = maxheight * 1.5;

        maxwidth = Math.min(maxwidth, 1210);
        if (isMobile()) {
            elements.css("max-width","100%");
            currentDisplayWidth = $(window).width();
        } else {
            if (lastwidth != maxwidth) elements.css("max-width",maxwidth+"px");
            var samplesize = sampleelem.width();
            if (samplesize <= 0) samplesize = maxwidth;
            currentDisplayWidth = Math.min(samplesize+60,maxwidth+60);
        }


        var width = $(window).width();
        if (isMobile())
            maxwidth = Math.min(maxwidth, width-60);
        else
            maxwidth = Math.min(maxwidth, width-150);
        maxheight = maxwidth / 1.5;
        var height83 = (maxwidth * 3.0/8.0);
        if (unsetHeight == false) {
            $(".ratio1-5").css("height",maxheight+"px");
            $(".ratio8-3").css("height",height83+"px");
        }
        $(".flex-direction-nav a").css("top",(maxheight/2)+"px");
        $(".ratio8-3 .flex-direction-nav a").css("top",(height83/2)+"px");
        lastwidth = maxwidth;
    };

    $(window).resize(setmaxheight);
    setmaxheight(true);

    return setmaxheight;
};

var unsetHeight = false;
var removeImageHeights = function() {
    unsetHeight = true;
    $(".ratio1-5").css("height","");
    $(".ratio8-3").css("height","");
};

var recheckSite = function(setmaxheight, rechecktopbar) {
    var recheck = function() {
        setmaxheight();
        rechecktopbar();
    };

    setInterval(recheck, 2000);

};


var fixHomeOverflow = function() {
    if (!weKnowOverflowWorks()) {
        dlog("Enabling overflow scrolling");
        $(".tiles").css({"position":"relative","overflow":"auto"});
        overflowHack = true;
    } else {
        dlog("Not enabling overflow scrolling");
        overflowHack = false;
    }
};


var addClickToTouch = function() {
    return; //disabling this for now.
    $(".hovertouch").bind('touchstart', function(e) {
        //e.preventDefault();
        $(this).addClass('hover_effect');
    }).bind("touchend", function() {
        //e.preventDefault();
        $(this).removeClass("hover_effect");
    });
};


//grabbed from https://github.com/filamentgroup/Overthrow/
var weKnowOverflowWorks = function() {
    // Touch events are used in the polyfill, and thus are a prerequisite
    var canBeFilledWithPoly = "ontouchmove" in document;
    
    // The following attempts to determine whether the browser has native overflow support
    // so we can enable it but not polyfill
        // Features-first. iOS5 overflow scrolling property check - no UA needed here. thanks Apple :)
    if ("WebkitOverflowScrolling" in document.documentElement.style) return true;
        // Touch events aren't supported and screen width is greater than X
        // ...basically, this is a loose "desktop browser" check. 
        // It may wrongly opt-in very large tablets with no touch support.
    if ( !canBeFilledWithPoly && window.screen.width > 1200 ) return true;
        // Hang on to your hats.
        // Whitelist some popular, overflow-supporting mobile browsers for now and the future
        // These browsers are known to get overlow support right, but give us no way of detecting it.
    if ((function(){
            var ua = window.navigator.userAgent,
                // Webkit crosses platforms, and the browsers on our list run at least version 534
                webkit = ua.match( /AppleWebKit\/([0-9]+)/ ),
                wkversion = webkit && webkit[1],
                wkLte534 = webkit && wkversion >= 534;
                
            return (
                /* Android 3+ with webkit gte 534
                ~: Mozilla/5.0 (Linux; U; Android 3.0; en-us; Xoom Build/HRI39) AppleWebKit/534.13 (KHTML, like Gecko) Version/4.0 Safari/534.13 */
                ua.match( /Android ([0-9]+)/ ) && RegExp.$1 >= 3 && wkLte534 ||
                /* Blackberry 7+ with webkit gte 534
                ~: Mozilla/5.0 (BlackBerry; U; BlackBerry 9900; en-US) AppleWebKit/534.11+ (KHTML, like Gecko) Version/7.0.0 Mobile Safari/534.11+ */
                ua.match( / Version\/([0-9]+)/ ) && RegExp.$1 >= 0 && window.blackberry && wkLte534 ||
                /* Blackberry Playbook with webkit gte 534
                ~: Mozilla/5.0 (PlayBook; U; RIM Tablet OS 1.0.0; en-US) AppleWebKit/534.8+ (KHTML, like Gecko) Version/0.0.1 Safari/534.8+ */   
                ua.indexOf( /PlayBook/ ) > -1 && RegExp.$1 >= 0 && wkLte534 ||
                /* Firefox Mobile (Fennec) 4 and up
                ~: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.7; rv:2.1.1) Gecko/ Firefox/4.0.2pre Fennec/4.0. */
                ua.match( /Fennec\/([0-9]+)/ ) && RegExp.$1 >= 4 ||
                /* WebOS 3 and up (TouchPad too)
                ~: Mozilla/5.0 (hp-tablet; Linux; hpwOS/3.0.0; U; en-US) AppleWebKit/534.6 (KHTML, like Gecko) wOSBrowser/233.48 Safari/534.6 TouchPad/1.0 */
                ua.match( /wOSBrowser\/([0-9]+)/ ) && RegExp.$1 >= 233 && wkLte534 ||
                /* Nokia Browser N8
                ~: Mozilla/5.0 (Symbian/3; Series60/5.2 NokiaN8-00/012.002; Profile/MIDP-2.1 Configuration/CLDC-1.1 ) AppleWebKit/533.4 (KHTML, like Gecko) NokiaBrowser/7.3.0 Mobile Safari/533.4 3gpp-gba 
                ~: Note: the N9 doesn't have native overflow with one-finger touch. wtf */
                ua.match( /NokiaBrowser\/([0-9\.]+)/ ) && parseFloat(RegExp.$1) === 7.3 && webkit && wkversion >= 533
            );
        })()) return true;
}
