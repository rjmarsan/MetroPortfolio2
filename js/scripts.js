
/*
 We wrap all of this in '(function($) {' so that it's all encapsulated.
 In our fancynav, we use a global variable named 'tiles'. If someone else decides to use that, we'd have a conflict.
 But because it's wrapped in this function, we don't have to worry about that.

 We also pass in the $ so we don't get any conflicts if someone decides to mess with $
 (not really an issue - just being overcautious)
*/

(function($) {
    var params = {};

    $(function() {
        setup();
    });

    var setup = function() {
        /* Some script-wide parameters */
        params.tiles = $(".tiles");
        params.sidebar = $(".sidebar");
        params.large = $(".large");
        params.anchorName = "data-anchor";
        params.autoScrollFlag = false; //hack - flag to prevent the URL from getting updated when it shouldn't.

        /* making a database for all of the elements */
        params.pairs = getPairs($(".sidebar-element"), $(".tile-element"), $(".large-element"));

        /* Setting up all of the interactions */
        setupTiles(params.pairs, $(".animation-layer"));
        setupScrolling(params.pairs, "sidebar-selected");
        setupHome($(".sidebar-home"));
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
                actionGoTo(pair, 300, true);
            });
        });
    };

    /*
    * The fancy animation/transition from the 'home' view to the 'large' view
    */
    var bringInSidebarAndLarge = function(time) {
        params.tiles.fadeOut(time);
        params.sidebar.dequeue().fadeTo(time, 1);
        params.large.fadeIn(time);
    };

    /*
    * The fancy animation/transition to the 'home' view from the 'large' view
    * the inverse of above
    */
    var goHome = function() {
        params.tiles.fadeIn(1000);
        params.sidebar.dequeue().fadeTo(1000, 0);
        preventScrollWatchingFor(2000);
        params.large.fadeOut(1000);
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
    };

    /*
    * The actual action of going to a particular page
    */
    var actionGoTo = function(pair, time, fromuser) {
        bringInSidebarAndLarge(time*2);
        preventScrollWatchingFor(time*4);
        $.scrollTo(pair.large, time);
        updatePage(pair, fromuser);
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
            $.each(params.pairs,function(index,pair) {
                if (pair.large.attr(params.anchorName) == url) {
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

    /*
    * Action to set the URL bar to remove anything but the domain
    */
    function removePage () { 
        if ("pushState" in history) {
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
    var setupScrolling = function(pairs, selectedClass) {
        $(window).scroll(function() {
            var selected = false;
            $.each(pairs,function(index,pair) {
                if (selected == false && inRange(pair.large)) {
                    pair.sidebar.addClass(selectedClass);
                    selected = true; //don't select any more than one
                    //window.location.hash = pair.large.attr("data-anchor");
                    //if (!params.autoScrollFlag) updatePage(pair);
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

    /*
    * Helper function to define what is 'in range' to mark as active
    */
    var inRange = function(elem) {
        var docViewTop = $(window).scrollTop();
        var docViewBottom = docViewTop + $(window).height();
        var docLine = (docViewTop*3+docViewBottom)/4;

        var elemTop = elem.offset().top;
        var elemBottom = elemTop + elem.height();
        // THIS NEEDS TO BE MORE COMPLICATED
        return ((elemBottom >= docLine) && (elemTop <= docLine));
    };

    /*
    * Hack.
    */
    var preventScrollWatchingFor = function(millis) {
        params.autoScrollFlag = true;
        setTimeout(function() { params.autoScrollFlag = false; }, millis);
    };




})(jQuery);


