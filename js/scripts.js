//hey cool.
autoScrollFlag = false;

(function($) {

$(function() {
    /* Some script-wide parameters */
    tiles = $(".tiles");
    sidebar = $(".sidebar");
    large = $(".large");
    anchorName = "data-anchor";
    //we're going to make a database for all of the elements.
    pairs = getPairs($(".sidebar-element"), $(".tile-element"), $(".large-element"));
    setupTiles(pairs, $(".animation-layer"));
    setupScrolling(pairs, "sidebar-selected");
    setupHome($(".sidebar-home"));
    //This is called when the back button is pressed
    window.addEventListener("popstate", pageChange, false);
    pageChange();

});


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


var setupTiles = function(pairs, animationlayer) {
    $.each(pairs,function(index,pair) {
        pair.tile.click(function() {
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
            var clone = cloneElement(pair);
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
            actionGoTo(pair, 300, true);
        });
    });
};


var cloneElement = function(pair) {
    return pair.tile.clone();
            clone.offset(tile.offset());
};

var bringInSidebarAndLarge = function(time) {
    tiles.fadeOut(time);
    sidebar.dequeue().fadeTo(time, 1);
    large.fadeIn(time);
};

var goHome = function() {
    tiles.fadeIn(1000);
    sidebar.dequeue().fadeTo(1000, 0);
    preventScrollWatchingFor(2000);
    large.fadeOut(1000);
};



var setupScrolling = function(pairs, selectedClass) {
    $(window).scroll(function() {
        var selected = false;
        $.each(pairs,function(index,pair) {
            if (selected == false && inRange(pair.large)) {
                pair.sidebar.addClass(selectedClass);
                selected = true; //don't select any more than one
                //window.location.hash = pair.large.attr("data-anchor");
                //if (!autoScrollFlag) updatePage(pair);
            } else {
                pair.sidebar.removeClass(selectedClass);
            }
        });
    });
    $.each(pairs,function(index,pair) {
        pair.sidebar.click(function() {
            actionGoTo(pair, 300, true);
        });
    });
};

var inRange = function(elem) {
    var docViewTop = $(window).scrollTop();
    var docViewBottom = docViewTop + $(window).height();
    var docLine = (docViewTop*3+docViewBottom)/4;

    var elemTop = elem.offset().top;
    var elemBottom = elemTop + elem.height();
    // THIS NEEDS TO BE MORE COMPLICATED
    return ((elemBottom >= docLine) && (elemTop <= docLine));
};


var setupHome = function(element) {
    element.click(function(e) {
        actionGoHome();
    });
}

var actionGoHome = function() {
    removePage();
    goHome();
};
var actionGoTo = function(pair, time, fromuser) {
    bringInSidebarAndLarge(time*2);
    preventScrollWatchingFor(time*4);
    $.scrollTo(pair.large, time);
    updatePage(pair, fromuser);
};

var preventScrollWatchingFor = function(millis) {
    autoScrollFlag = true;
    setTimeout(function() { autoScrollFlag = false; }, millis);
};

var pageChange = function(e) {
    var url = window.location.pathname.replace("/","");
    //console.log("New hash: "+url);
    var hasgonesomewhere = false;
    if (url) {
        $.each(pairs,function(index,pair) {
            if (pair.large.attr(anchorName) == url) {
                actionGoTo(pair, 300, false);
                hasgonesomewhere = true;
            }
        });
    }
    if (hasgonesomewhere == false) {
        if (url) removePage();
        goHome();
    }
};
function removePage () { 
    if ("pushState" in history) {
        history.pushState({state: 1}, document.title, "/");
    }
}
function updatePage(pair, forceback) {
    var loc = window.location;
    var newhash = pair.large.attr(anchorName);
    var curhash = loc.pathname.replace("/","");
    //console.log("Updating hash - current: "+curhash+ " new: "+newhash);
    if (newhash == curhash) {
        console.log("No need to update");
        return;
    }
    if ("pushState" in history) {
        if (!curhash || forceback) {
            console.log("new location to "+newhash);
            history.pushState({state: 1}, document.title, newhash);
        } else {
            console.log("update location to "+newhash);
            history.replaceState({state: 1}, document.title, newhash);
        }
    }
}
})(jQuery);


